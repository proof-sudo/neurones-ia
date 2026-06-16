import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path

from core.ports.vector_store import VectorStore
from core.ports.sparse_search import SparseSearch
from core.ports.embedder import Embedder
from core.ports.document_registry import DocumentRegistry
from core.ports.document_parser import DocumentParser
from core.domain.document import Chunk, Document, GEDEntry, DocumentType, DocumentMetadata
from core.services.chunking.router import ChunkingRouter
from core.services.metadata_extractor import MetadataExtractor
from core.services.quality_validator import QualityValidator
from core.services.pii_detector import PIIDetector

logger = logging.getLogger(__name__)

_EMBED_BATCH = 96


class GEDIndexer:
    """
    Pipeline d'indexation incrémentale de la GED.

    Ordre d'exécution :
      1. Hash check (skip si inchangé)
      2. Extraction texte
      3. Validation qualité → quarantaine si rejeté
      4. Extraction métadonnées via LLM (Haiku, tool_use)
      5. Détection PII (CV uniquement)
      6. Chunking adapté au type (ChunkingRouter)
      7. Embedding + upsert ChromaDB
      8. BM25 + registre SQLite
    """

    def __init__(
        self,
        vector_store: VectorStore,
        sparse_search: SparseSearch,
        embedder: Embedder,
        registry: DocumentRegistry,
        pdf_parser: DocumentParser,
        docx_parser: DocumentParser,
        chunking_router: ChunkingRouter,
        metadata_extractor: MetadataExtractor,
        quality_validator: QualityValidator,
        pii_detector: PIIDetector,
        quarantine,  # QuarantineAdapter — import circulaire évité
        structured_extractor=None,  # StructuredExtractor — couche kb_* (optionnel)
        kb_repository=None,         # KBRepository — persistance kb_* (optionnel)
        classifier=None,            # DocumentClassifier — fallback si type UNKNOWN (optionnel)
        entity_resolver=None,       # EntityResolver — résolution d'entités P2 (optionnel)
        chunk_size: int = 600,
        chunk_overlap: int = 60,
    ):
        self._vector_store = vector_store
        self._sparse_search = sparse_search
        self._embedder = embedder
        self._registry = registry
        self._parsers: list[DocumentParser] = [pdf_parser, docx_parser]
        self._chunking_router = chunking_router
        self._metadata_extractor = metadata_extractor
        self._quality_validator = quality_validator
        self._pii_detector = pii_detector
        self._quarantine = quarantine
        self._structured_extractor = structured_extractor
        self._kb_repository = kb_repository
        self._classifier = classifier
        self._entity_resolver = entity_resolver

    async def process(
        self,
        file_path: Path,
        doc_type: DocumentType = DocumentType.UNKNOWN,
        force: bool = False,
    ) -> bool:
        """
        Indexe un fichier si son contenu a changé depuis la dernière indexation.
        force=True : ré-indexe même si le hash est identique (ex. après changement
        de stratégie de chunking).
        Retourne True si indexé, False si ignoré (hash identique ou quarantaine).
        """
        # Normaliser en chemin absolu résolu : le watcher passe des chemins relatifs
        # (../data/ged/...) et le reindex de l'API des chemins absolus. Sans ça, le même
        # fichier est enregistré sous deux clés → indexation en double.
        file_path = Path(file_path).resolve()
        file_str = str(file_path)

        # ── 1. Hash check ──────────────────────────────────────────────────
        current_hash = await asyncio.to_thread(self._compute_hash_sync, file_path)
        existing = await self._registry.get_entry(file_str)
        if existing and existing.hash_sha256 == current_hash and not force:
            logger.debug("Fichier inchangé, skip : %s", file_path.name)
            return False

        # ── 2. Extraction texte ────────────────────────────────────────────
        text = await self._parse(file_path)

        # ── 3. Validation qualité ──────────────────────────────────────────
        validation = self._quality_validator.validate(text, file_path)
        if not validation.is_valid:
            file_size = self._file_size(file_path)
            await self._quarantine.add(
                file_path=file_str,
                doc_type=doc_type.value,
                reason=validation.reason,
                file_size_bytes=file_size,
                text_length=len(text),
            )
            return False

        if validation.warnings:
            for w in validation.warnings:
                logger.warning("QualityValidator [%s] : %s", file_path.name, w)

        # ── 3bis. Classification (fallback si le dossier n'a pas donné le type) ──
        if doc_type == DocumentType.UNKNOWN and self._classifier:
            try:
                doc_type = await self._classifier.classify(text, file_path.name)
                logger.info("Classifieur → %s pour %s", doc_type.value, file_path.name)
            except Exception as exc:
                logger.warning("Classification échouée pour %s : %s", file_path.name, exc)

        # ── 4. Extraction métadonnées ──────────────────────────────────────
        extracted_fields = await self._metadata_extractor.extract(text, doc_type)

        # ── 5. Détection PII ───────────────────────────────────────────────
        pii_report = self._pii_detector.detect(text) if doc_type == DocumentType.CV else None

        # ── 6. Construction des métadonnées du document ───────────────────
        if existing:
            await self._vector_store.delete_by_doc_id(existing.doc_id)
            self._sparse_search.remove(existing.vector_ids)
            doc_id = existing.doc_id
        else:
            doc_id = str(uuid.uuid4())

        metadata = DocumentMetadata(
            doc_id=doc_id,
            filename=file_path.name,
            doc_type=doc_type,
            source_path=file_str,
            extracted_fields=extracted_fields,
            contains_pii=pii_report.has_pii if pii_report else False,
            pii_categories=pii_report.categories if pii_report else [],
        )

        # ── 7. Chunking adapté au type ─────────────────────────────────────
        chunks = self._chunking_router.chunk(text, doc_id, metadata)
        if not chunks:
            logger.warning("Aucun chunk généré pour %s", file_path.name)
            return False

        # ── 8. Embeddings par batch ────────────────────────────────────────
        embeddings: list[list[float]] = []
        contents = [c.content for c in chunks]
        for i in range(0, len(contents), _EMBED_BATCH):
            batch = contents[i : i + _EMBED_BATCH]
            batch_emb = await self._embedder.embed_texts(batch)
            embeddings.extend(batch_emb)

        await self._vector_store.upsert(chunks, embeddings)

        # ── 9. BM25 + registre ─────────────────────────────────────────────
        bm25_chunks = [(c.chunk_id, c.content) for c in chunks]
        await asyncio.to_thread(self._sparse_search.index, bm25_chunks)
        await asyncio.to_thread(self._sparse_search.save)

        entry = GEDEntry(
            doc_id=doc_id,
            file_path=file_str,
            hash_sha256=current_hash,
            doc_type=doc_type,
            last_indexed=datetime.utcnow(),
            vector_ids=[c.chunk_id for c in chunks],
            is_active=True,
        )
        await self._registry.upsert_entry(entry)

        # Retirer de la quarantaine si le fichier y était (ex : retry après correction)
        await self._quarantine.remove(file_str)

        # ── 10. Extraction structurée → base relationnelle kb_* (couche additive) ──
        # Jamais bloquant : un échec ici n'invalide pas l'indexation vectorielle.
        await self._extract_structured(text, doc_type, doc_id, file_str, current_hash)

        # ── 11. Résolution d'entités → ids canoniques (kb_clients/personnes/projets) ──
        await self._resolve_entities(doc_id, doc_type)

        pii_note = f" [PII: {','.join(pii_report.categories)}]" if pii_report and pii_report.has_pii else ""
        logger.info(
            "Indexé : %s → %d chunks (type=%s, doc_id=%s)%s",
            file_path.name, len(chunks), doc_type.value, doc_id, pii_note,
        )
        return True

    async def remove(self, file_path: Path, hard_delete: bool = False) -> None:
        """
        Supprime un fichier du RAG.
        hard_delete=True pour les CV (RGPD : purge complète du registre, pas soft-delete).
        """
        file_path = Path(file_path).resolve()
        file_str = str(file_path)
        entry = await self._registry.get_entry(file_str)
        if entry:
            await self._vector_store.delete_by_doc_id(entry.doc_id)
            self._sparse_search.remove(entry.vector_ids)
            await asyncio.to_thread(self._sparse_search.save)
            if self._kb_repository:
                try:
                    await self._kb_repository.delete_by_doc_id(entry.doc_id)
                except Exception as exc:
                    logger.warning("Suppression kb_* échouée pour %s : %s", file_path.name, exc)
            if hard_delete:
                await self._registry.hard_delete(file_str)
                logger.info("RGPD — Purge complète : %s", file_path.name)
            else:
                await self._registry.mark_deleted(file_str)
                logger.info("Supprimé du RAG : %s", file_path.name)
        await self._quarantine.remove(file_str)

    async def _extract_structured(
        self, text: str, doc_type: DocumentType, doc_id: str, file_str: str, current_hash: str
    ) -> None:
        """Extraction typée + persistance kb_*. Tolérante aux pannes (best-effort)."""
        if not self._structured_extractor or not self._kb_repository:
            return
        try:
            result = await self._structured_extractor.extract(text, doc_type)
            if result is None:
                return
            await self._kb_repository.save_extraction(
                doc_id=doc_id,
                doc_type=doc_type,
                fichier_source=file_str,
                hash_sha256=current_hash,
                result=result,
            )
        except Exception as exc:
            logger.warning("Extraction structurée échouée pour %s : %s", file_str, exc)

    async def _resolve_entities(self, doc_id: str, doc_type: DocumentType) -> None:
        """Résolution d'entités → ids canoniques. Tolérante aux pannes (best-effort)."""
        if not self._entity_resolver or not self._kb_repository:
            return
        try:
            await self._kb_repository.resolve_document(doc_id, doc_type, self._entity_resolver)
        except Exception as exc:
            logger.warning("Résolution d'entités échouée pour %s : %s", doc_id, exc)

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _compute_hash_sync(file_path: Path) -> str:
        h = hashlib.sha256()
        with open(file_path, "rb") as f:
            for block in iter(lambda: f.read(65536), b""):
                h.update(block)
        return h.hexdigest()

    @staticmethod
    def _file_size(file_path: Path) -> int:
        try:
            return file_path.stat().st_size
        except OSError:
            return 0

    async def _parse(self, file_path: Path) -> str:
        for parser in self._parsers:
            if parser.supports(str(file_path)):
                return await parser.parse(str(file_path))
        if file_path.suffix == ".txt":
            return file_path.read_text(encoding="utf-8", errors="ignore")
        return ""
