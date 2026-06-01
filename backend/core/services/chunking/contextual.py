"""
Chunking contextuel pour les documents semi-structurés (Famille B).
Cibles : CV, offres techniques.

Stratégie :
- Gros chunks (1 500 mots) pour conserver la cohérence du document
- Préfixe de contexte injecté dans chaque chunk à partir des métadonnées extraites
  → "[Ingénieur: Jean Dupont | Rôle: Lead Dev]" pour les CV
  → "[Projet: X | Client: Y]" pour les offres
- Sans ce préfixe, "5 ans d'expérience Go" n'est pas rattaché à une personne.
"""
from core.domain.document import Chunk, DocumentMetadata, DocumentType
from .base import BaseChunker

_CHUNK_SIZE = 1500
_CHUNK_OVERLAP = 100


def _build_prefix(doc_type: DocumentType, fields: dict) -> str:
    if doc_type == DocumentType.CV:
        parts = []
        if fields.get("nom"):
            parts.append(f"Ingénieur: {fields['nom']}")
        if fields.get("role"):
            parts.append(f"Rôle: {fields['role']}")
        if fields.get("experience_years"):
            parts.append(f"Expérience: {fields['experience_years']} ans")
        return f"[{' | '.join(parts)}] " if parts else ""

    if doc_type == DocumentType.OFFRE_TECHNIQUE:
        parts = []
        if fields.get("projet_id") or fields.get("titre"):
            parts.append(f"Projet: {fields.get('titre') or fields.get('projet_id', '')}")
        if fields.get("client"):
            parts.append(f"Client: {fields['client']}")
        if fields.get("statut_gagne") is not None:
            label = "Gagnée" if fields["statut_gagne"] else "Perdue"
            parts.append(f"Statut: {label}")
        return f"[{' | '.join(parts)}] " if parts else ""

    return ""


class ContextualChunker(BaseChunker):
    def chunk(self, text: str, doc_id: str, metadata: DocumentMetadata) -> list[Chunk]:
        words = text.split()
        if not words:
            return []

        prefix = _build_prefix(metadata.doc_type, metadata.extracted_fields)
        step = max(1, _CHUNK_SIZE - _CHUNK_OVERLAP)
        chunks: list[Chunk] = []

        for i, start in enumerate(range(0, len(words), step)):
            block = words[start : start + _CHUNK_SIZE]
            if len(block) < 20:
                continue
            content = prefix + " ".join(block)
            chunks.append(Chunk(
                chunk_id=f"{doc_id}_chunk_{i}",
                doc_id=doc_id,
                content=content,
                token_count=len(content.split()),
                chunk_index=i,
                metadata=metadata,
            ))

        return chunks
