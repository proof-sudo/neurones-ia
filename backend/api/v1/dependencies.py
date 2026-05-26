import logging
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.auth.jwt_adapter import decode_token
from core.domain.user import User, UserRole
from db.database import get_session
from db.models import UserModel

logger = logging.getLogger(__name__)
_bearer = HTTPBearer(auto_error=False)

# Cache JWT user 60s — évite un SELECT à chaque requête (dashboard + chat = 5-15 requêtes/session)
_user_cache: dict[int, tuple[User, float]] = {}
_USER_CACHE_TTL = 60.0


def _get_cached_user(user_id: int) -> User | None:
    import time
    entry = _user_cache.get(user_id)
    if entry and time.monotonic() - entry[1] < _USER_CACHE_TTL:
        return entry[0]
    _user_cache.pop(user_id, None)
    return None


def _cache_user(user_id: int, user: User) -> None:
    import time
    _user_cache[user_id] = (user, time.monotonic())
    # Éviter croissance illimitée
    if len(_user_cache) > 1024:
        oldest = min(_user_cache, key=lambda k: _user_cache[k][1])
        _user_cache.pop(oldest, None)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: AsyncSession = Depends(get_session),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expiré")
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")

    cached = _get_cached_user(user_id)
    if cached is not None:
        return cached

    result = await session.execute(select(UserModel).where(UserModel.id == user_id))
    user_row = result.scalar_one_or_none()

    if not user_row or not user_row.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable ou désactivé")

    user = User(
        id=user_row.id,
        email=user_row.email,
        full_name=user_row.full_name,
        role=UserRole(user_row.role),
        is_active=user_row.is_active,
        created_at=user_row.created_at,
        last_login=user_row.last_login,
    )
    _cache_user(user_id, user)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
