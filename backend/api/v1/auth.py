import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.auth.jwt_adapter import create_access_token, hash_password, verify_password
from api.v1.dependencies import get_current_user
from core.domain.user import User
from db.database import get_session
from db.models import UserModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class CreateUserRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""
    role: str = "user"


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(UserModel).where(UserModel.email == body.email.lower().strip())
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    user.last_login = datetime.now(timezone.utc)
    await session.commit()

    token = create_access_token(user.id, user.email, user.role)
    logger.info("Login réussi — %s (%s)", user.email, user.role)

    return LoginResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
        },
    )


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
    }


@router.post("/logout")
async def logout():
    # Avec JWT stateless, le logout se fait côté client (suppression du token)
    return {"message": "Déconnecté"}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Crée un utilisateur (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux admins")

    existing = await session.execute(
        select(UserModel).where(UserModel.email == body.email.lower().strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email déjà utilisé")

    new_user = UserModel(
        email=body.email.lower().strip(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    logger.info("Nouvel utilisateur créé : %s (%s) par %s", new_user.email, new_user.role, current_user.email)
    return {"id": new_user.id, "email": new_user.email, "role": new_user.role}


@router.get("/users")
async def list_users(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Liste les utilisateurs (admin uniquement)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux admins")

    result = await session.execute(select(UserModel).order_by(UserModel.created_at))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]
