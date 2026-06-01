import logging
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from config.settings import settings
from core.domain.document import DocumentType

logger = logging.getLogger(__name__)

router = APIRouter()

_TYPE_MAP: dict[str, dict] = {
    "cvs":               {"label": "CVs Ingénieurs",       "doc_type": DocumentType.CV},
    "offres-techniques": {"label": "Offres Techniques",     "doc_type": DocumentType.OFFRE_TECHNIQUE},
    "abe":               {"label": "ABE / Marchés publics", "doc_type": DocumentType.ABE},
    "pv-recette":        {"label": "PV de Recette",         "doc_type": DocumentType.PV_RECETTE},
    "procedures":        {"label": "Procédures internes",   "doc_type": DocumentType.PROCEDURE},
    "fiches-techniques": {"label": "Fiches Techniques",     "doc_type": DocumentType.FICHE_TECHNIQUE},
    "comptes-rendus":    {"label": "Comptes Rendus",        "doc_type": DocumentType.COMPTE_RENDU},
}

_SUPPORTED_EXT = {".pdf", ".docx", ".doc", ".txt"}
_GED_ROOT = Path(settings.ged_path)


def _container(request: Request):
    return request.app.state.container


def _safe_resolve(rel_path: str) -> Path:
    """Résout un chemin relatif et vérifie qu'il reste dans la GED. Lève 400 sinon."""
    try:
        resolved = (_GED_ROOT / rel_path).resolve()
        resolved.relative_to(_GED_ROOT.resolve())
        return resolved
    except (ValueError, RuntimeError):
        raise HTTPException(status_code=400, detail="Chemin invalide ou hors de la GED")


def _build_subtree(folder: Path, rel: str) -> dict:
    file_count = 0
    subfolders = []
    if folder.exists():
        for item in sorted(folder.iterdir()):
            if item.is_dir():
                sub_rel = f"{rel}/{item.name}"
                sub = _build_subtree(item, sub_rel)
                subfolders.append(sub)
                file_count += sub["file_count"]
            elif item.is_file() and item.suffix.lower() in _SUPPORTED_EXT:
                file_count += 1
    return {"path": rel, "name": folder.name, "file_count": file_count, "subfolders": subfolders}


# ── GET /ged/tree ─────────────────────────────────────────────────────────────

@router.get("/ged/tree")
async def get_tree():
    """Arbre de dossiers GED avec comptage de fichiers par nœud."""
    _GED_ROOT.mkdir(parents=True, exist_ok=True)
    # Créer les catégories par défaut si elles n'existent pas
    for folder_name in _TYPE_MAP:
        (_GED_ROOT / folder_name).mkdir(parents=True, exist_ok=True)

    categories = []
    for folder_path in sorted(_GED_ROOT.iterdir()):
        if not folder_path.is_dir():
            continue
        folder_name = folder_path.name
        meta = _TYPE_MAP.get(folder_name, {})
        tree = _build_subtree(folder_path, folder_name)
        categories.append({
            "name": folder_name,
            "label": meta.get("label", folder_name.replace("-", " ").title()),
            "doc_type": meta.get("doc_type", DocumentType.UNKNOWN).value,
            "file_count": tree["file_count"],
            "subfolders": tree["subfolders"],
        })
    return {"categories": categories}


# ── GET /ged/status ───────────────────────────────────────────────────────────

@router.get("/ged/status")
async def get_status(request: Request):
    """Stats GED : fichiers indexés, total disque, répartition par type."""
    registry = _container(request).doc_registry
    entries = await registry.list_active_entries()

    by_type: dict[str, int] = {}
    last_indexed_at = None
    for e in entries:
        by_type[e.doc_type.value] = by_type.get(e.doc_type.value, 0) + 1
        if last_indexed_at is None or e.last_indexed > last_indexed_at:
            last_indexed_at = e.last_indexed

    total_on_disk = sum(
        1
        for folder_name in _TYPE_MAP
        for f in (_GED_ROOT / folder_name).rglob("*")
        if f.is_file() and f.suffix.lower() in _SUPPORTED_EXT
        if (_GED_ROOT / folder_name).exists()
    )

    return {
        "total_indexed": len(entries),
        "total_on_disk": total_on_disk,
        "by_type": by_type,
        "last_indexed_at": last_indexed_at.isoformat() if last_indexed_at else None,
    }


# ── GET /ged/files ────────────────────────────────────────────────────────────

@router.get("/ged/files")
async def list_files(
    request: Request,
    folder: Optional[str] = None,
    search: Optional[str] = None,
):
    """Liste les fichiers GED. Combine les entrées indexées (registry) et les fichiers disque non encore indexés."""
    registry = _container(request).doc_registry
    entries = await registry.list_active_entries()

    # Toujours travailler avec des chemins absolus résolus pour éviter les
    # incompatibilités entre le chemin relatif _GED_ROOT et les chemins absolus
    # stockés dans le registry (par _safe_resolve → .resolve()).
    ged_root_abs = _GED_ROOT.resolve()

    # Index par chemin relatif normalisé (séparateurs forward slash)
    indexed_by_relpath: dict[str, dict] = {}
    for e in entries:
        try:
            rel = Path(e.file_path).resolve().relative_to(ged_root_abs)
            key = str(rel).replace("\\", "/")
            indexed_by_relpath[key] = {
                "doc_id": e.doc_id,
                "last_indexed": e.last_indexed.isoformat(),
                "is_indexed": True,
            }
        except ValueError:
            pass

    result = []

    # Walk filesystem — tous les dossiers racine présents dans la GED
    all_root_dirs = [p.name for p in ged_root_abs.iterdir() if p.is_dir()] if ged_root_abs.exists() else []
    for folder_name in all_root_dirs:
        root = ged_root_abs / folder_name
        if not root.exists():
            continue
        for f in sorted(root.rglob("*")):
            if not f.is_file() or f.suffix.lower() not in _SUPPORTED_EXT:
                continue
            try:
                rel = f.relative_to(ged_root_abs)
            except ValueError:
                continue
            rel_str = str(rel).replace("\\", "/")
            folder_rel = str(rel.parent).replace("\\", "/") if str(rel.parent) != "." else folder_name

            # Filtre par dossier
            if folder:
                folder_clean = folder.rstrip("/")
                if rel_str != f"{folder_clean}/{f.name}" and not rel_str.startswith(folder_clean + "/"):
                    if rel_str.split("/")[0] != folder_clean:
                        continue

            # Filtre par recherche texte
            if search and search.lower() not in f.name.lower():
                continue

            registry_info = indexed_by_relpath.get(rel_str)

            try:
                size_bytes = f.stat().st_size
            except OSError:
                size_bytes = 0

            result.append({
                "doc_id": registry_info["doc_id"] if registry_info else None,
                "filename": f.name,
                "file_path": rel_str,
                "folder_path": folder_rel,
                "category": folder_name,
                "doc_type": _TYPE_MAP.get(folder_name, {}).get("doc_type", DocumentType.UNKNOWN).value,
                "size_bytes": size_bytes,
                "last_indexed": registry_info["last_indexed"] if registry_info else None,
                "is_indexed": bool(registry_info),
            })

    return {"files": result, "total": len(result)}


# ── POST /ged/upload ──────────────────────────────────────────────────────────

@router.post("/ged/upload", status_code=201)
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    folder_path: str = Form(...),
):
    """Upload un fichier dans la GED et lance l'indexation en arrière-plan."""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in _SUPPORTED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporté : {suffix}. Acceptés : PDF, DOCX, DOC, TXT",
        )

    parts = Path(folder_path).parts
    if not parts:
        raise HTTPException(status_code=400, detail="Chemin de dossier invalide")

    target_dir = _safe_resolve(folder_path)
    target_dir.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    dest = target_dir / file.filename
    dest.write_bytes(content)

    doc_type: DocumentType = _TYPE_MAP.get(parts[0], {}).get("doc_type", DocumentType.UNKNOWN)
    ged_indexer = _container(request).ged_indexer
    background_tasks.add_task(_index_file, ged_indexer, dest, doc_type)

    logger.info("Upload GED : %s → %s", file.filename, dest)
    return {
        "filename": file.filename,
        "folder_path": folder_path,
        "doc_type": doc_type.value,
        "size_bytes": len(content),
        "status": "indexing",
    }


async def _index_file(ged_indexer, file_path: Path, doc_type: DocumentType):
    try:
        indexed = await ged_indexer.process(file_path, doc_type)
        logger.info("Indexation %s : %s", file_path.name, "OK" if indexed else "ignoré (inchangé)")
    except Exception as e:
        logger.error("Erreur indexation %s : %s", file_path.name, e)


# ── GET /ged/quarantine ───────────────────────────────────────────────────────

@router.get("/ged/quarantine")
async def list_quarantine(request: Request):
    """Fichiers rejetés par le validateur qualité — en attente de correction."""
    quarantine = _container(request).quarantine
    entries = await quarantine.list_all()
    return {
        "quarantine": [
            {
                "id": e.id,
                "filename": Path(e.file_path).name,
                "file_path": e.file_path,
                "doc_type": e.doc_type,
                "reason": e.reason,
                "quarantined_at": e.quarantined_at.isoformat(),
                "retry_count": e.retry_count,
                "file_size_bytes": e.file_size_bytes,
                "text_length": e.text_length,
            }
            for e in entries
        ],
        "total": len(entries),
    }


# ── POST /ged/quarantine/retry ─────────────────────────────────────────────────

class RetryRequest(BaseModel):
    file_path: str


@router.post("/ged/quarantine/retry")
async def retry_quarantine(
    body: RetryRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Retente l'indexation d'un fichier en quarantaine."""
    path = Path(body.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable sur le disque")

    parts = path.parts
    folder_name = next((p for p in parts if p in _TYPE_MAP), None)
    doc_type = _TYPE_MAP.get(folder_name, {}).get("doc_type", DocumentType.UNKNOWN) if folder_name else DocumentType.UNKNOWN
    ged_indexer = _container(request).ged_indexer
    background_tasks.add_task(_index_file, ged_indexer, path, doc_type)
    return {"status": "retrying", "file_path": body.file_path}


# ── DELETE /ged/files/{doc_id} ────────────────────────────────────────────────

@router.delete("/ged/files/{doc_id}")
async def delete_file(doc_id: str, request: Request):
    """Supprime un fichier de la GED (disque + index vectoriel + registre)."""
    registry = _container(request).doc_registry
    ged_indexer = _container(request).ged_indexer

    entries = await registry.list_active_entries()
    entry = next((e for e in entries if e.doc_id == doc_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="Document introuvable")

    file_path = Path(entry.file_path)
    # RGPD : hard delete pour les CV (purge complète du registre, pas soft-delete)
    hard_delete = entry.doc_type.value == "cv"
    await ged_indexer.remove(file_path, hard_delete=hard_delete)

    if file_path.exists():
        file_path.unlink()

    logger.info("Fichier supprimé de la GED : %s (hard_delete=%s)", file_path.name, hard_delete)
    return {"deleted": True, "doc_id": doc_id, "filename": file_path.name}


# ── POST /ged/folders ─────────────────────────────────────────────────────────

class FolderRequest(BaseModel):
    path: str


@router.post("/ged/folders", status_code=201)
async def create_folder(body: FolderRequest):
    """Crée un dossier, un sous-dossier, ou une nouvelle catégorie racine dans la GED."""
    parts = Path(body.path).parts
    if not parts:
        raise HTTPException(status_code=400, detail="Chemin invalide")
    target = _safe_resolve(body.path)
    target.mkdir(parents=True, exist_ok=True)
    return {"path": body.path, "created": True}


@router.post("/ged/reindex")
async def reindex_all(request: Request, background_tasks: BackgroundTasks):
    """Relance l'indexation de tous les fichiers non encore indexés (ou modifiés)."""
    registry = _container(request).doc_registry
    ged_indexer = _container(request).ged_indexer
    ged_root_abs = _GED_ROOT.resolve()

    entries = await registry.list_active_entries()
    indexed_paths = {str(Path(e.file_path).resolve()) for e in entries}

    pending = []
    for folder_name, meta in _TYPE_MAP.items():
        root = ged_root_abs / folder_name
        if not root.exists():
            continue
        for f in root.rglob("*"):
            if f.is_file() and f.suffix.lower() in _SUPPORTED_EXT:
                if str(f.resolve()) not in indexed_paths:
                    pending.append((f, meta["doc_type"]))

    for file_path, doc_type in pending:
        background_tasks.add_task(_index_file, ged_indexer, file_path, doc_type)

    return {"queued": len(pending), "message": f"{len(pending)} fichier(s) mis en file d'indexation"}


@router.delete("/ged/folders")
async def delete_folder(path: str, request: Request):
    """Supprime un dossier et tout son contenu (désindexation incluse). Les catégories système ne peuvent pas être supprimées."""
    parts = Path(path).parts
    if len(parts) <= 1 and path in _TYPE_MAP:
        raise HTTPException(status_code=400, detail="Les catégories système ne peuvent pas être supprimées")
    if len(parts) == 0:
        raise HTTPException(status_code=400, detail="Chemin invalide")

    target = _safe_resolve(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # Désindexer tous les fichiers contenus dans ce dossier
    registry = _container(request).doc_registry
    ged_indexer = _container(request).ged_indexer
    entries = await registry.list_active_entries()
    target_resolved = target.resolve()
    removed_count = 0
    for e in entries:
        try:
            entry_path = Path(e.file_path).resolve()
            entry_path.relative_to(target_resolved)
            await ged_indexer.remove(entry_path)
            removed_count += 1
        except ValueError:
            pass
        except Exception as ex:
            logger.warning("Erreur désindexation %s : %s", e.file_path, ex)

    shutil.rmtree(target)
    logger.info("Dossier supprimé : %s (%d fichier(s) désindexé(s))", path, removed_count)
    return {"deleted": True, "path": path, "files_deindexed": removed_count}
