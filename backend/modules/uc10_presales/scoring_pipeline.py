import asyncio
import json
import logging

from core.ports.llm_gateway import LLMGateway
from core.services.rag_engine import RAGEngine
from core.domain.offer import ScoringResult, KeyElement, MatchedDocument, BidRecommendation
from core.domain.document import DocumentType

logger = logging.getLogger(__name__)

_EXTRACT_SYSTEM = """Tu es un expert en analyse d'appels d'offres IT.

Analyse ce document et extrais les informations importantes. Retourne UN JSON valide :
{
  "key_points": [
    {"label": "Nom court du point", "value": "valeur ou description concise"}
  ],
  "criteres_selection": ["critère de sélection explicite"],
  "besoins": ["besoin fonctionnel ou technique exprimé"],
  "prerequis": ["prérequis ou qualification obligatoire"],
  "ressources_demandees": ["profil ou ressource humaine demandée"],
  "points_vigilance": ["risque, contrainte ou point d'attention"],
  "date_remise": "date limite de remise ou chaîne vide"
}

Pour key_points : identifie 5 à 10 points CRITIQUES propres à CE document.
Choisis librement les labels selon ce que tu trouves — budget, délai, client, secteur, technologie principale,
périmètre géographique, volume, certification requise, type de marché, clause particulière, etc.
Adapte-toi strictement au contenu : n'invente rien qui n'est pas dans le texte.

Réponds UNIQUEMENT avec le JSON valide, sans balises markdown."""

_SUMMARY_SYSTEM = """Tu es un expert en avant-vente IT.
Rédige un résumé structuré de cet appel d'offres en 3 à 5 phrases courtes et professionnelles.
Couvre : contexte et objectif, périmètre technique, enjeux principaux.
IMPORTANT : réponds en texte brut uniquement, sans markdown, sans titres, sans puces, sans caractères gras."""

_ANALYSIS_SYSTEM = """Tu es un directeur commercial senior en IT.
Analyse cet appel d'offres en comparant nos capacités (documents fournis) avec les exigences.
Identifie :
1. Nos forces (ce qu'on maîtrise bien)
2. Les gaps (ce qui nous manque ou nous est peu familier)
3. Les risques principaux
4. Un score de 0 à 100 (100 = parfaitement adapté)
5. Recommandation : GO, NO_BID ou CONDITIONAL

Réponds en JSON :
{
  "gaps_analysis": "analyse des écarts",
  "strengths": ["force1", "force2"],
  "risks": ["risque1", "risque2"],
  "score": 75,
  "recommendation": "GO",
  "justification": "Explication en 2-3 phrases"
}"""


def _fix_json_newlines(s: str) -> str:
    """Échappe les newlines réels dans les valeurs string JSON (LLM met parfois de vrais \\n)."""
    result = []
    in_string = False
    i = 0
    while i < len(s):
        c = s[i]
        if c == "\\" and in_string and i + 1 < len(s):
            result.append(c)
            result.append(s[i + 1])
            i += 2
            continue
        if c == '"':
            in_string = not in_string
        elif c == "\n" and in_string:
            result.append("\\n")
            i += 1
            continue
        elif c == "\r" and in_string:
            i += 1
            continue
        result.append(c)
        i += 1
    return "".join(result)


def _clean_json(raw: str) -> str:
    """Extrait le bloc JSON d'une réponse LLM, même avec texte autour."""
    raw = raw.strip()
    # Supprimer les fences markdown
    if raw.startswith("```"):
        first_newline = raw.find("\n")
        raw = raw[first_newline + 1:] if first_newline != -1 else raw[3:]
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()
    # Extraire le premier objet JSON {...} même si le LLM ajoute du texte avant/après
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start : end + 1]
    # Corriger les newlines réels dans les strings JSON
    return _fix_json_newlines(raw).strip()



class ScoringPipeline:
    """
    Pipeline de scoring AO en 5 étapes — logique métier pure.
    Utilise LLMGateway (interface) → indépendant du modèle.
    """

    def __init__(self, llm: LLMGateway, rag_engine: RAGEngine):
        self._llm = llm
        self._rag_engine = rag_engine

    async def run(self, ao_filename: str, ao_text: str) -> ScoringResult:
        logger.info("Pipeline scoring démarré pour : %s", ao_filename)

        # Étapes 1 + 2 en parallèle (indépendantes, même input)
        (key_elements, extra), summary = await asyncio.gather(
            self._step1_extract(ao_text),
            self._step2_summarize(ao_text),
        )
        logger.debug("Steps 1+2 done : %d éléments + résumé", len(key_elements))

        # Étape 3a + 3b en parallèle (CVs et projets similaires indépendants)
        cv_query = " ".join(extra.get("ressources_demandees", [])[:6]) or f"ingénieur {summary[:200]}"
        project_query = f"{summary} {' '.join(e.value for e in key_elements[:4])}"

        cv_sources, project_sources = await asyncio.gather(
            self._rag_engine.search(
                query=cv_query,
                filter_metadata={"doc_type": "cv"},
                top_k=6,
            ),
            self._rag_engine.search_diverse(
                query=project_query,
                doc_types=["offre_technique", "abe", "pv_recette", "marches_similaires"],
                per_type=2,
            ),
        )

        team_matches = [
            MatchedDocument(
                doc_id=s.doc_id,
                filename=s.filename,
                doc_type=s.doc_type.value,
                relevance_score=round(s.relevance_score, 2),
                excerpt=s.excerpt[:500],
            )
            for s in cv_sources
        ]
        logger.debug("Step 3a done : %d CVs matchés", len(team_matches))
        similar_projects = [
            MatchedDocument(
                doc_id=s.doc_id,
                filename=s.filename,
                doc_type=s.doc_type.value,
                relevance_score=round(s.relevance_score, 2),
                excerpt=s.excerpt[:500],
            )
            for s in project_sources
        ]
        logger.debug("Step 3b done : %d projets similaires trouvés", len(similar_projects))

        # matched_documents = union CVs + projets (pour la rétrocompatibilité)
        all_sources = cv_sources + project_sources
        seen: set[str] = set()
        unique_sources = []
        for s in all_sources:
            if s.filename not in seen:
                unique_sources.append(s)
                seen.add(s.filename)
        matched_docs = [
            MatchedDocument(
                doc_id=s.doc_id,
                filename=s.filename,
                doc_type=s.doc_type.value,
                relevance_score=round(s.relevance_score, 2),
                excerpt=s.excerpt[:500],
            )
            for s in unique_sources
        ]

        # Étape 4 & 5 : Analyse + Score (context = projets similaires uniquement, pas CVs)
        rag_context = await self._rag_engine.build_context(project_sources)
        gaps, strengths, risks, score, recommendation, justification = await self._step4_analyze(
            ao_text=ao_text,
            summary=summary,
            rag_context=rag_context,
        )
        logger.info("Pipeline terminé : score=%d, recommandation=%s", score, recommendation)

        return ScoringResult(
            ao_filename=ao_filename,
            summary=summary,
            key_elements=key_elements,
            matched_documents=matched_docs,
            gaps_analysis=gaps,
            strengths=strengths,
            risks=risks,
            score=score,
            recommendation=recommendation,
            justification=justification,
            criteres_selection=extra.get("criteres_selection", []),
            besoins=extra.get("besoins", []),
            prerequis=extra.get("prerequis", []),
            ressources_demandees=extra.get("ressources_demandees", []),
            points_vigilance=extra.get("points_vigilance", []),
            date_remise=extra.get("date_remise", ""),
            team_matches=team_matches,
            similar_projects=similar_projects,
        )

    async def _step1_extract(self, ao_text: str) -> tuple[list[KeyElement], dict]:
        snippet = ao_text[:5000]
        raw = await self._llm.extract(prompt=_EXTRACT_SYSTEM, text=snippet, max_tokens=1200)
        empty_extra: dict = {
            "criteres_selection": [], "besoins": [], "prerequis": [],
            "ressources_demandees": [], "points_vigilance": [], "date_remise": "",
        }

        def _list(d: dict, key: str) -> list[str]:
            val = d.get(key, [])
            return [str(v).strip() for v in (val if isinstance(val, list) else []) if str(v).strip()]

        try:
            cleaned = _clean_json(raw)
            data = json.loads(cleaned)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Extraction JSON échouée (%s). Réponse brute : %r", exc, raw[:300])
            return [], empty_extra

        # key_points : liste libre [{label, value}] fournie par l'IA
        elements: list[KeyElement] = []
        raw_kp = data.get("key_points", [])
        if isinstance(raw_kp, list):
            for kp in raw_kp:
                if isinstance(kp, dict):
                    label = str(kp.get("label", "")).strip()
                    value = str(kp.get("value", "")).strip()
                    if label and value:
                        elements.append(KeyElement(category=label, value=value))

        extra = {
            "criteres_selection": _list(data, "criteres_selection"),
            "besoins": _list(data, "besoins"),
            "prerequis": _list(data, "prerequis"),
            "ressources_demandees": _list(data, "ressources_demandees"),
            "points_vigilance": _list(data, "points_vigilance"),
            "date_remise": str(data.get("date_remise", "")).strip(),
        }
        return elements, extra

    async def _step2_summarize(self, ao_text: str) -> str:
        snippet = ao_text[:6000]
        return await self._llm.generate(
            system=_SUMMARY_SYSTEM,
            user=snippet,
            max_tokens=400,
        )

    async def _step4_analyze(
        self,
        ao_text: str,
        summary: str,
        rag_context: str,
    ) -> tuple:
        user_prompt = (
            f"## Résumé de l'AO\n{summary}\n\n"
            f"## Nos références (RAG)\n{rag_context}\n\n"
            f"## Extrait AO\n{ao_text[:3000]}"
        )
        raw = await self._llm.generate(
            system=_ANALYSIS_SYSTEM,
            user=user_prompt,
            max_tokens=1500,
        )
        try:
            data = json.loads(_clean_json(raw))
            rec_str = data.get("recommendation", "CONDITIONAL").upper()
            try:
                recommendation = BidRecommendation(rec_str)
            except ValueError:
                recommendation = BidRecommendation.CONDITIONAL

            def _to_list(val) -> list[str]:
                if isinstance(val, list):
                    return [str(v).strip() for v in val if str(v).strip()]
                return []

            return (
                str(data.get("gaps_analysis", "") or "").strip(),
                _to_list(data.get("strengths")),
                _to_list(data.get("risks")),
                max(0, min(100, int(data.get("score", 50)))),
                recommendation,
                str(data.get("justification", "") or "").strip(),
            )
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            logger.warning("Analyse JSON échouée (%s). Réponse brute : %r", exc, raw[:200])
            return ("", [], [], 50, BidRecommendation.CONDITIONAL, "Analyse indisponible — veuillez réessayer.")
