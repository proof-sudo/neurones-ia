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

# Pour les CV : chunks larges pour éviter de couper un profil en deux.
# Un CV de 5 pages fait ~1 500-2 000 mots — 3 000 mots garantit un seul chunk dans 95 % des cas.
_CV_CHUNK_SIZE = 3000
_CV_CHUNK_OVERLAP = 150

_OFFRE_CHUNK_SIZE = 1500
_OFFRE_CHUNK_OVERLAP = 100


def _list_to_str(value) -> str:
    if isinstance(value, list):
        return ", ".join(str(v) for v in value if v)
    return str(value) if value else ""


def _build_cv_header(fields: dict) -> str:
    """
    Construit un en-tête structuré injecté dans CHAQUE chunk du CV.
    Même si le retrieval ne ramène qu'un seul chunk, le LLM voit :
    - Le nom de la personne
    - Son rôle et ses années d'expérience
    - Toutes ses certifications (l'information la plus souvent cherchée)
    - Ses compétences clés
    Cela évite la réponse "la partie certifications n'est pas accessible".
    """
    lines = []
    if fields.get("nom"):
        lines.append(f"Ingénieur : {fields['nom']}")
    if fields.get("role"):
        lines.append(f"Poste     : {fields['role']}")
    if fields.get("experience_years"):
        lines.append(f"Expérience: {fields['experience_years']} ans")

    certs = _list_to_str(fields.get("certifications", []))
    if certs:
        lines.append(f"Certifications: {certs}")

    skills = fields.get("skills", [])
    if isinstance(skills, list) and skills:
        lines.append(f"Compétences   : {', '.join(str(s) for s in skills[:12])}")

    diplomes = _list_to_str(fields.get("diplomes", []))
    if diplomes:
        lines.append(f"Diplômes      : {diplomes}")

    langues = _list_to_str(fields.get("langues", []))
    if langues:
        lines.append(f"Langues       : {langues}")

    if not lines:
        return ""
    return "=== FICHE STRUCTURÉE ===\n" + "\n".join(lines) + "\n=== TEXTE DU CV ===\n"


def _build_offre_prefix(fields: dict) -> str:
    parts = []
    if fields.get("titre"):
        parts.append(f"Projet: {fields['titre']}")
    if fields.get("client"):
        parts.append(f"Client: {fields['client']}")
    if fields.get("statut_gagne") is not None:
        parts.append("Statut: Gagnée" if fields["statut_gagne"] else "Statut: Perdue")
    return f"[{' | '.join(parts)}]\n" if parts else ""


class ContextualChunker(BaseChunker):
    def chunk(self, text: str, doc_id: str, metadata: DocumentMetadata) -> list[Chunk]:
        words = text.split()
        if not words:
            return []

        fields = metadata.extracted_fields or {}

        if metadata.doc_type == DocumentType.CV:
            return self._chunk_cv(text, words, doc_id, metadata, fields)
        return self._chunk_offre(words, doc_id, metadata, fields)

    def _chunk_cv(
        self, text: str, words: list[str], doc_id: str, metadata: DocumentMetadata, fields: dict
    ) -> list[Chunk]:
        header = _build_cv_header(fields)
        step = max(1, _CV_CHUNK_SIZE - _CV_CHUNK_OVERLAP)
        chunks: list[Chunk] = []

        for i, start in enumerate(range(0, len(words), step)):
            block = words[start : start + _CV_CHUNK_SIZE]
            if len(block) < 20:
                continue
            # L'en-tête structuré est répété dans CHAQUE chunk :
            # si le CV est coupé, chaque partie reste autonome et contient les certifications.
            content = header + " ".join(block)
            chunks.append(Chunk(
                chunk_id=f"{doc_id}_chunk_{i}",
                doc_id=doc_id,
                content=content,
                token_count=len(content.split()),
                chunk_index=i,
                metadata=metadata,
            ))

        return chunks

    def _chunk_offre(
        self, words: list[str], doc_id: str, metadata: DocumentMetadata, fields: dict
    ) -> list[Chunk]:
        prefix = _build_offre_prefix(fields)
        step = max(1, _OFFRE_CHUNK_SIZE - _OFFRE_CHUNK_OVERLAP)
        chunks: list[Chunk] = []

        for i, start in enumerate(range(0, len(words), step)):
            block = words[start : start + _OFFRE_CHUNK_SIZE]
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
