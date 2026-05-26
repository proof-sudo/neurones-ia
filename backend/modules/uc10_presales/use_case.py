import json
import logging

from core.ports.llm_gateway import LLMGateway
from core.ports.document_parser import DocumentParser
from core.domain.offer import ScoringResult, OfferDraft
from core.services.rag_engine import RAGEngine
from modules.uc10_presales.scoring_pipeline import ScoringPipeline, _clean_json
from modules.uc10_presales.offer_generator import OfferGenerator

logger = logging.getLogger(__name__)

_STRATEGY_SYSTEM = """Tu es un directeur commercial senior chez Neurones Technologies CI, ESN ivoirienne spécialisée en intégration IT, développement logiciel, infrastructure et cybersécurité.

Tu dois produire une stratégie de réponse opérationnelle, précise et différenciante pour un appel d'offres.
Décision retenue : {decision}

━━━ RÈGLE ABSOLUE ━━━
Réponds UNIQUEMENT en JSON valide. Dans toutes les valeurs string, utilise \\n pour les sauts de ligne — PAS de vrais retours à la ligne ni de tabulations dans les valeurs JSON.

━━━ FORMAT ATTENDU ━━━
{{
  "strategy": "§1 texte.\\n\\n§2 texte.\\n\\n§3 texte.\\n\\n§4 texte.\\n\\n§5 texte.",
  "chronogram": [
    {{"semaine": "S1 — J1 à J5", "action": "action précise et opérationnelle", "responsable": "Rôle exact"}},
    ...
  ],
  "response_plan": "§1 texte.\\n\\n§2 texte.\\n\\n§3 texte.\\n\\n§4 texte."
}}

━━━ ACTEURS DE NEURONES TECHNOLOGIES CI ━━━
Utilise exclusivement ces rôles dans le chronogramme :
- Directeur Commercial — pilote global, relation client, validation décisions
- Directeur Technique — architecture solution, cohérence offre technique
- Chef de Projet désigné — planning, coordination, disponibilité à valider
- Responsable RH — mobilisation profils, vérification disponibilité, CVs
- Responsable Administratif & Juridique — collecte pièces admin, caution bancaire, légalité
- Responsable Financier — BPU, chiffrage, marge, validité offre financière
- Équipe de rédaction technique — rédaction corpus offre, fiches techniques, références
- Direction Générale — validation finale, signature, engagements stratégiques

━━━ CHRONOGRAMME ━━━
- Base le chronogramme sur la date de remise réelle fournie dans le contexte
- Si la date de remise est connue, calcule le nombre de semaines restantes et adapte le rythme
- Formule les semaines en "S1 — J1 à J5" ou "S2 — J6 à J10" pour être lisible
- Minimum 7 actions, maximum 10 actions couvrant TOUT le cycle :
  1. Kick-off interne & attribution des rôles (J1-J2)
  2. Relecture AO complète & questions de clarification au maître d'ouvrage
  3. Mobilisation des profils et vérification disponibilité (RH)
  4. Collecte des pièces administratives et caution bancaire
  5. Rédaction de l'offre technique (méthodologie, planning projet, profils)
  6. Montage de l'offre financière (BPU, détail des coûts)
  7. Identification et collecte des références similaires avec attestations
  8. Revue interne croisée (technique + commercial + administratif)
  9. Validation Direction Générale et signature
  10. Dépôt / soumission dans les délais (J avant deadline)

━━━ STRATEGY (5 paragraphes obligatoires) ━━━
§1 — Lecture stratégique de l'AO : enjeux pour le commanditaire, opportunité pour Neurones, niveau de compétition estimé, criticité du projet
§2 — Positionnement différenciant : pourquoi Neurones est bien placé, références pertinentes à valoriser, atouts sur les critères clés, expertises à mettre en avant
§3 — Axes prioritaires de l'offre : critères de sélection à surcoter, sections à soigner en priorité, angle de réponse sur les besoins identifiés
§4 — Gestion des écarts et risques : comment compenser les gaps identifiés, partenariats à mobiliser si besoin, arguments pour atténuer les faiblesses
§5 — Stratégie de prix et positionnement commercial : fourchette recommandée, arbitrages marge/compétitivité, éléments de valeur à mettre en avant pour justifier le prix

━━━ RESPONSE_PLAN (4 paragraphes obligatoires) ━━━
§1 — Organisation de l'équipe de réponse : qui fait quoi, point de coordination, cadence des revues internes
§2 — Documents et informations à rassembler en priorité : liste précise des pièces admin (RCCM, DGI, CNPS, bilans N-1/N-2/N-3, statuts, pouvoirs de signature), preuves de références (attestations, PV de recette), CVs à actualiser
§3 — Points de vérification critiques avant dépôt : conformité administrative, cohérence technique/financière, respect du plan de présentation exigé, vérification des délais de validité des documents
§4 — Facteurs de succès et pièges à éviter : erreurs fréquentes sur ce type d'AO, points sur lesquels les dossiers sont souvent rejetés, éléments différenciants à ne pas oublier"""


class PresalesUseCase:
    """
    UC10 — Avant-vente : scoring AO + génération d'offre technique.
    Logique métier pure — utilise uniquement les ports (interfaces).
    """

    def __init__(
        self,
        llm_haiku: LLMGateway,
        llm_sonnet: LLMGateway,
        rag_engine: RAGEngine,
        pdf_parser: DocumentParser,
        docx_parser: DocumentParser,
    ):
        self._pipeline = ScoringPipeline(llm=llm_haiku, rag_engine=rag_engine)
        self._generator = OfferGenerator(llm=llm_haiku)
        self._llm_sonnet = llm_sonnet
        self._pdf_parser = pdf_parser
        self._docx_parser = docx_parser

    async def score_ao(self, filename: str, file_bytes: bytes) -> ScoringResult:
        text = await self._extract_text(filename, file_bytes)
        if not text.strip():
            raise ValueError(
                f"Impossible d'extraire le texte de « {filename} ». "
                "Ce PDF semble être entièrement scanné (images sans couche texte). "
                "Assurez-vous que Tesseract OCR est installé "
                "(https://github.com/UB-Mannheim/tesseract/wiki) "
                "avec le pack de langue français (fra), puis relancez le backend."
            )
        return await self._pipeline.run(ao_filename=filename, ao_text=text)

    async def generate_offer(
        self,
        scoring: ScoringResult,
        client_name: str = "",
    ) -> OfferDraft:
        return await self._generator.generate(scoring=scoring, client_name=client_name)

    async def generate_bid_strategy(
        self,
        scoring: ScoringResult,
        client_name: str = "",
        decision: str = "GO",
        decision_reason: str = "",
    ) -> dict:
        decision_label = {"GO": "GO — Répondre", "CONDITIONAL": "CONDITIONNEL — Sous conditions", "NO_BID": "NO-BID — Ne pas répondre"}.get(decision, decision)
        system = _STRATEGY_SYSTEM.replace("{decision}", decision_label)

        # Extraire les éléments clés du scoring
        key_map: dict[str, str] = {e.category.lower(): e.value for e in scoring.key_elements}
        date_remise = scoring.date_remise or key_map.get("date de remise", key_map.get("délai", "non précisé"))
        budget = key_map.get("budget", key_map.get("montant", "non précisé"))
        type_marche = key_map.get("type de marché", key_map.get("type marché", "non précisé"))
        secteur = key_map.get("secteur", "non précisé")
        livrables = key_map.get("livrables", "non précisé")

        lines = [
            f"═══ CONTEXTE AO ═══",
            f"Intitulé AO : {scoring.ao_filename}",
            f"Client / Commanditaire : {client_name or 'Non précisé'}",
            f"Secteur : {secteur}",
            f"Type de marché : {type_marche}",
            f"Budget estimé : {budget}",
            f"DATE DE REMISE : {date_remise}  ← baser le chronogramme sur cette date",
            f"Score GED Neurones : {scoring.score}/100",
            f"Décision retenue : {decision_label}",
            "",
            f"═══ RÉSUMÉ AO ═══",
            scoring.summary[:800],
            "",
        ]

        if scoring.criteres_selection:
            lines += ["═══ CRITÈRES DE SÉLECTION (à surcoter) ═══"] + [f"  • {c}" for c in scoring.criteres_selection[:8]] + [""]

        if scoring.besoins:
            lines += ["═══ BESOINS IDENTIFIÉS ═══"] + [f"  • {b}" for b in scoring.besoins[:8]] + [""]

        if scoring.ressources_demandees:
            lines += ["═══ PROFILS & RESSOURCES DEMANDÉS ═══"] + [f"  • {r}" for r in scoring.ressources_demandees[:8]] + [""]

        if scoring.prerequis:
            lines += ["═══ PRÉREQUIS (administratifs, techniques, certifications) ═══"] + [f"  • {p}" for p in scoring.prerequis[:8]] + [""]

        if scoring.points_vigilance:
            lines += ["═══ POINTS DE VIGILANCE ═══"] + [f"  • {v}" for v in scoring.points_vigilance[:6]] + [""]

        if livrables and livrables != "non précisé":
            lines += [f"═══ LIVRABLES ATTENDUS ═══", livrables, ""]

        if scoring.strengths:
            lines += ["═══ FORCES DE NEURONES SUR CET AO ═══"] + [f"  + {s}" for s in scoring.strengths[:6]] + [""]

        if scoring.risks:
            lines += ["═══ RISQUES & FAIBLESSES ═══"] + [f"  - {r}" for r in scoring.risks[:6]] + [""]

        if scoring.gaps_analysis:
            lines += ["═══ ANALYSE DES ÉCARTS (ce qui manque / ce qu'il faut compenser) ═══", scoring.gaps_analysis[:500], ""]

        if decision_reason:
            lines += [f"═══ JUSTIFICATION DE LA DÉCISION ═══", decision_reason, ""]

        user = "\n".join(lines)
        raw = await self._llm_sonnet.generate(system=system, user=user, max_tokens=3500)
        try:
            data = json.loads(_clean_json(raw))
            return {
                "strategy": data.get("strategy", ""),
                "chronogram": data.get("chronogram", []),
                "response_plan": data.get("response_plan", ""),
            }
        except Exception as exc:
            logger.warning("Strategy JSON parse failed (%s) — tentative extraction regex", exc)
            import re
            # Tenter d'extraire le champ "strategy" via regex si JSON invalide
            m = re.search(r'"strategy"\s*:\s*"((?:[^"\\]|\\.)*)"', raw, re.DOTALL)
            strategy_text = m.group(1).replace("\\n", "\n") if m else ""
            m2 = re.search(r'"response_plan"\s*:\s*"((?:[^"\\]|\\.)*)"', raw, re.DOTALL)
            plan_text = m2.group(1).replace("\\n", "\n") if m2 else ""
            if not strategy_text:
                # Dernier recours : retirer les balises JSON et renvoyer le texte brut
                strategy_text = re.sub(r'^\s*\{.*?"strategy"\s*:\s*"', "", raw, flags=re.DOTALL)
                strategy_text = re.sub(r'",?\s*"chronogram".*$', "", strategy_text, flags=re.DOTALL).strip()
            return {"strategy": strategy_text or "Génération indisponible — veuillez réessayer.", "chronogram": [], "response_plan": plan_text}

    async def match_team(self, req) -> dict:
        """Cherche dans la GED les CVs correspondant aux profils demandés par l'AO."""
        from modules.uc10_presales.schemas import TeamMatchResponse, TeamMatchProfile

        query_parts = [p for p in req.requirements[:6] if p.strip()]
        if req.ao_context:
            query_parts = [req.ao_context[:300]] + query_parts
        query = " ".join(query_parts) if query_parts else "ingénieur développeur"

        try:
            sources = await self._pipeline._rag_engine.search(
                query=query,
                filter_metadata={"doc_type": "cv"},
                top_k=req.top_k,
            )
        except Exception:
            sources = []

        profiles = []
        for src in sources:
            name = src.filename.replace(".docx", "").replace(".pdf", "").replace("-", " ").replace("_", " ")
            if name.lower().startswith("cv "):
                name = name[3:]
            profiles.append(TeamMatchProfile(
                filename=src.filename,
                name=name.strip().title(),
                excerpt=src.excerpt[:400],
                relevance_score=round(src.relevance_score, 2),
            ))

        return TeamMatchResponse(profiles=profiles, query_used=query[:200])

    async def _extract_text(self, filename: str, file_bytes: bytes) -> str:
        import tempfile, os
        ext = filename.lower().rsplit(".", 1)[-1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            if ext == "pdf":
                return await self._pdf_parser.parse(tmp_path)
            elif ext in ("docx", "doc"):
                return await self._docx_parser.parse(tmp_path)
            else:
                return file_bytes.decode("utf-8", errors="ignore")
        finally:
            os.unlink(tmp_path)
