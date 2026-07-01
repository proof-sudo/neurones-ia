"""
OfferGenerator — deux moteurs de remplissage, choisis automatiquement à l'ouverture
du template (`_fill_template`) :

  • Template « à variables » (présence de placeholders {{...}}, ex.
    Offre_Technique_template.docx) → `_fill_placeholder_template` : substitution des
    placeholders simples (titre, nom client, mois/année) partout (corps + en-têtes +
    zones de texte), éclatement des placeholders « liste » (besoins, proposition,
    fonctionnalités) en paragraphes au style du modèle, insertion d'un tableau
    Fonctionnalité→Composant à {{Répartition...}}, tableau équipe alimenté par les CV
    choisis, planning mis à jour J/H PAR ACTIVITÉ + TOTAL recalculé.

  • Template legacy (noms BGFI/KORAZ + ancres de titres) → `_fill_legacy_template`
    (moteur v7 historique, décrit ci-dessous).

Moteur legacy v7 — zones remplies :
  1. Nom legacy (BGFI/KORAZ/SOCOPRIM) dans tous les paragraphes et cellules
  2. Page de garde : text boxes → titre projet + date
  3. EXPRESSION DES BESOINS        : effacement + 3 nouveaux paragraphes + bullets besoins
  4. OBJECTIFS DE NEURONES          : effacement + 3 nouveaux paragraphes
  5. PRESENTATION DE LA REPONSE     : effacement + contenu spécifique au projet
  6. Description détaillée → MÉTHODOLOGIE : suppression COMPLÈTE du bloc KORAZ (P175–P449)
     puis injection : liste des fonctionnalités + sous-sections par module
  7. TABLE 0 (composants/prérequis) : UPDATE en place des lignes 1–5 (preserve gridSpan)
  8. TABLE 1 (équipe)               : effacement lignes data + ajout nouvelles lignes
  9. TABLE dernière (planning)      : UPDATE J/H en place (preserve gridSpan/vMerge)

Zones préservées : Présentation Neurones, Méthodologie, Gestion de projet, Certifications.
"""

import copy
import json
import logging
import re
import unicodedata
from datetime import datetime
from io import BytesIO
from pathlib import Path

from docx import Document as DocxDocument
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import RGBColor

from core.ports.llm_gateway import LLMGateway, OutputTruncatedError
from core.domain.offer import ScoringResult, OfferDraft
from config.settings import settings
from modules.uc10_presales.scoring_pipeline import _clean_json
from modules.uc10_presales.domain_classifier import primary_domain
from modules.uc10_presales.template_contract import (
    LEGACY_NAMES as _LEGACY_NAMES,
    LEGACY_TITLE_KEYWORDS as _LEGACY_TITLE_KEYWORDS,
    H_BESOINS, H_OBJECTIFS, H_PRESENTATION, H_DESCRIPTION, H_METHODOLOGIE,
    TECH_TABLE_DATA_ROWS, PLANNING_PHASES, PLANNING_MIN_PHASES_MATCH,
    PH_TITRE, PH_CLIENT, PH_MOIS, PH_ANNEE, PH_BESOINS, PH_BESOINS_TYPO,
    PH_PROPOSITION, PH_FONCTIONNALITES, PH_REPARTITION, REPARTITION_HEADERS,
)

logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────
# Les noms legacy, mots-clés de titre et ancres de section (H_*) sont définis dans
# template_contract (source unique partagée avec le validateur). Voir ce module.

# Marqueur visible des éléments que le modèle n'a pas permis de remplir
# automatiquement : la génération n'est JAMAIS bloquée — à la place, l'espace est
# laissé et une instruction est insérée à l'endroit concerné (page de garde) ou
# dans une annexe de fin (sections / tableaux dont l'ancre est introuvable).
_TODO_MARK = "⟦À COMPLÉTER⟧"
_TODO_COLOR = RGBColor(0xC0, 0x00, 0x00)  # rouge — repère visuel dans le .docx

_DEFAULT_STACKS: dict[str, list[dict]] = {
    "Digitalisation": [
        {"composant": "Framework Backend", "version": "À définir"},
        {"composant": "Framework Frontend", "version": "À définir"},
        {"composant": "Base de données", "version": "PostgreSQL 15"},
        {"composant": "Serveur d'application", "version": "Nginx"},
        {"composant": "Système d'exploitation", "version": "Ubuntu 22.04 LTS"},
    ],
    "Infrastructure": [
        {"composant": "Équipements réseau", "version": "Cisco / Fortinet"},
        {"composant": "Supervision réseau", "version": "À définir"},
        {"composant": "Système d'exploitation", "version": "À définir"},
    ],
    "Cybersécurité": [
        {"composant": "SIEM", "version": "À définir"},
        {"composant": "Pare-feu / UTM", "version": "À définir"},
        {"composant": "Antivirus / EDR", "version": "À définir"},
    ],
    "Cloud": [
        {"composant": "Fournisseur Cloud", "version": "AWS / Azure / GCP"},
        {"composant": "Conteneurisation", "version": "Docker / Kubernetes"},
        {"composant": "CI/CD", "version": "GitLab CI / GitHub Actions"},
    ],
}


# ── Contexte d'offre & parse tolérant (offre à fort impact) ─────────────────────
# Fonctions PURES (testables) : enrichissement du prompt + récupération partielle du
# JSON + garde-fou qualité. But : passer d'un « remplisseur de gabarit » à un conseiller
# qui propose du contenu spécifique et différenciant, et ne PLUS tout perdre si le JSON
# casse (on sauve la prose IA récupérable au lieu de retomber en générique total).

_STR_ARRAY_KEYS = ("expression_besoins", "objectifs_reponse", "presentation_reponse", "fonctionnalites")


def _offer_user_context(scoring: ScoringResult, client_name: str, domain: str,
                        delai: str, budget: str) -> str:
    """Contexte utilisateur ENRICHI pour la génération des sections d'offre.

    Au-delà du résumé + besoins, on fournit la matière pour une offre DIFFÉRENCIANTE :
    atouts de Neurones, écarts à compenser, risques+mitigations, critères à surcoter,
    profils attendus, signaux client (Odoo) et références mobilisables. Tout provient du
    ScoringResult — aucun nouvel appel LLM."""
    lines = [
        f"AO : {scoring.ao_filename}",
        f"Client : {client_name or 'Non précisé'}",
        f"Domaine : {domain}",
        f"Délai de livraison : {delai}",
        f"Budget estimé : {budget}",
        "",
        "RÉSUMÉ DE L'AO :",
        scoring.summary[:900] if scoring.summary else "(non disponible)",
    ]
    if scoring.besoins:
        lines += ["", "BESOINS IDENTIFIÉS :"] + [f"- {b.texte}" for b in scoring.besoins[:12]]
    if scoring.criteres_selection:
        lines += ["", "CRITÈRES DE SÉLECTION À SURCOTER (soigner ces angles) :"] + \
                 [f"- {c.texte}" for c in scoring.criteres_selection[:8]]
    if scoring.strengths:
        lines += ["", "ATOUTS DE NEURONES À VALORISER (différenciateurs) :"] + \
                 [f"+ {s}" for s in scoring.strengths[:6]]
    if scoring.risks:
        lines += ["", "RISQUES À ADRESSER DANS L'OFFRE (montrer la maîtrise) :"] + \
                 [f"- [{r.criticite}] {r.label}" + (f" → {r.mitigation}" if r.mitigation else "")
                  for r in scoring.risks[:6]]
    if scoring.gaps_analysis:
        lines += ["", "ÉCARTS À COMPENSER :", scoring.gaps_analysis[:400]]
    if scoring.profils_demandes:
        lines += ["", "PROFILS ATTENDUS :"] + \
                 [f"- {p.profil}" + (f" ({p.domaine})" if p.domaine else "")
                  for p in scoring.profils_demandes[:8]]
    cc = getattr(scoring, "client_context", None)
    if cc is not None and getattr(cc, "matched", False):
        sig: list[str] = []
        if cc.is_existing_client:
            sig.append("client existant de Neurones")
        if cc.deployed_technologies:
            sig.append("technologies déjà déployées chez lui : " + ", ".join(cc.deployed_technologies[:6]))
        sig += list(cc.relationship_signals[:3])
        if sig:
            lines += ["", "CONTEXTE CLIENT (historique Odoo, à exploiter avec tact) :"] + \
                     [f"· {s}" for s in sig]
    refs = [d.filename for d in (scoring.similar_projects or [])][:5]
    if refs:
        lines += ["", "RÉFÉRENCES MOBILISABLES (projets similaires en GED) :"] + [f"· {r}" for r in refs]
    lines += [
        "",
        "Rédige des sections SPÉCIFIQUES à cet AO et à ce client : cite les vraies technologies, "
        "valorise les atouts ci-dessus, montre comment les risques sont maîtrisés et propose des "
        "modules à forte valeur. Bannis tout texte générique passe-partout.",
    ]
    return "\n".join(lines)


def _salvage_string_array(text: str, key: str) -> list[str]:
    """Extrait un tableau de chaînes d'un JSON malformé/tronqué (best effort)."""
    m = re.search(r'"' + re.escape(key) + r'"\s*:\s*\[(.*?)\]', text, re.DOTALL)
    if not m:
        return []
    out: list[str] = []
    for it in re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1)):
        s = it.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\').strip()
        if s:
            out.append(s)
    return out


def _salvage_offer_json(text: str) -> dict:
    """Récupère ce qui est lisible d'un JSON cassé : titre + paragraphes (la prose IA)."""
    data: dict = {}
    m = re.search(r'"titre_projet"\s*:\s*"([^"]{3,300})"', text)
    if m:
        data["titre_projet"] = m.group(1).strip()
    for key in _STR_ARRAY_KEYS:
        arr = _salvage_string_array(text, key)
        if arr:
            data[key] = arr
    return data


def _loads_offer_json(raw: str) -> dict:
    """Parse le JSON des sections, avec RÉCUPÉRATION partielle si malformé/tronqué.

    Au lieu de tout perdre (→ offre 100 % générique), on sauve au moins la prose IA
    récupérable ; les listes structurées (modules, stack…) retombent sur leurs défauts."""
    cleaned = _clean_json(raw or "")
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    return _salvage_offer_json(cleaned)


def _offer_quality_warnings(data: dict) -> list[str]:
    """Liste les sections retombées en repli générique (clés absentes du JSON LLM)."""
    if not data:
        return ["JSON LLM totalement illisible — offre en repli générique."]
    return [f"section '{key}' en repli générique"
            for key in (("titre_projet",) + _STR_ARRAY_KEYS + ("modules", "stack_technique"))
            if not data.get(key)]


# ── LLM prompt ────────────────────────────────────────────────────────────────
# Le prompt est construit par `_build_sections_system` : le bloc « planning » varie
# selon le template (par phase pour les modèles legacy ; par activité pour les
# modèles « à variables » où le tableau de planning est figé ligne par ligne).

_SECTIONS_HEAD = """\
Tu es expert en rédaction d'offres techniques IT pour Neurones Technologies CI.
À partir du scoring d'un AO, génère les sections variables en JSON strict.
Utilise \\n pour les retours à la ligne dans les strings JSON.
N'utilise JAMAIS de vrais retours à la ligne dans les valeurs JSON.

{
  "titre_projet": "Titre court (6-12 mots, commence par verbe d'action : Développement / Mise en place / Conception / Déploiement)",
  "expression_besoins": [
    "§1 : contexte métier du client, son secteur d'activité, ses enjeux (3-4 phrases). Utiliser le vrai nom du client.",
    "§2 : besoins fonctionnels et techniques précis issus de l'AO, problèmes à résoudre (3-4 phrases).",
    "§3 : objectifs attendus par le client et engagement de Neurones Technologies (2-3 phrases)."
  ],
  "objectifs_reponse": [
    "§1 : objectif global de Neurones Technologies pour ce projet (2-3 phrases).",
    "§2 : livrables attendus — documentation, plan de recette, manuel exploitation, rapport déploiement, formation (3-4 phrases).",
    "§3 : engagement collaboration, respect délais et budget, support post-déploiement (2-3 phrases)."
  ],
  "presentation_reponse": [
    "§1 : approche technologique retenue, architecture globale (2-3 phrases). Mentionner les technologies clés.",
    "§2 : les 3 piliers ou axes structurants de la solution proposée (2-3 phrases).",
    "§3 : engagements de Neurones Technologies envers le client (2-3 phrases)."
  ],
  "fonctionnalites": [
    "Fonctionnalité principale 1",
    "Fonctionnalité principale 2",
    "Fonctionnalité principale 3",
    "Fonctionnalité principale 4",
    "Fonctionnalité principale 5"
  ],
  "modules": [
    {
      "titre": "MODULE 1 — Titre fonctionnel (ex: Gestion des utilisateurs et authentification)",
      "description": "Description technique et fonctionnelle en 3-4 phrases. Préciser les fonctionnalités clés, interfaces, règles métier importantes."
    }
  ],
  "stack_technique": [
    {"composant": "Nom du composant", "version": "Version ou précision"},
    {"composant": "Base de données", "version": "PostgreSQL 15"},
    {"composant": "Serveur d'application", "version": "Nginx"},
    {"composant": "Système d'exploitation", "version": "Ubuntu 22.04 LTS"}
  ],
  "repartition": [
    {"fonctionnalite": "Reprendre une des fonctionnalités ci-dessus", "composant": "Couche / composant technique (ex: Frontend Web, Backend API, Base de données, Module d'intégration, Sécurité)"}
  ],
"""

_PLANNING_LEGACY = """\
  "planning": [
    {"phase": "PREALABLE",        "activite": "Validation du processus et réception du bon de commande", "jh": ""},
    {"phase": "PLANIFICATION",     "activite": "Kick-off et validation du chronogramme",                 "jh": "3"},
    {"phase": "CADRAGE",           "activite": "Ateliers techniques et plan de recette",                 "jh": "10"},
    {"phase": "IMPLEMENTATION",    "activite": "Développement et paramétrage de la solution",            "jh": "60"},
    {"phase": "FORMATION",         "activite": "Formation et transfert de compétences",                  "jh": "5"},
    {"phase": "VALIDATION DE LA RECETTE ET PERIODE D'OBSERVATION", "activite": "Validation de la recette et mise en production", "jh": "5"},
    {"phase": "GESTION DE PROJET", "activite": "Coordination, reporting et suivi des risques",           "jh": ""}
  ]
}
"""

_RULES_COMMON = """\

Règles :
- titre_projet : 6-12 mots, verbe d'action obligatoire en début
- expression_besoins : exactement 3 items, nom du client dans §1
- objectifs_reponse : exactement 3 items, perspective Neurones Technologies
- presentation_reponse : exactement 3 items
- fonctionnalites : 5 à 8 items, une fonctionnalité par item (phrase courte)
- modules : 4 à 8 modules, chaque module = 1 composant fonctionnel distinct
- stack_technique : 4 à 8 items, technologies réelles adaptées au projet
- repartition : une ligne par fonctionnalité principale, associée à sa couche/composant technique"""

_PLANNING_RULE_LEGACY = """
- planning : utiliser EXACTEMENT ces noms de phases (correspondent aux lignes existantes du tableau) :
  PREALABLE, PLANIFICATION, CADRAGE, IMPLEMENTATION, FORMATION,
  "VALIDATION DE LA RECETTE ET PERIODE D'OBSERVATION", GESTION DE PROJET
  Ne créer UNE SEULE activité par phase. Estimer les J/H selon la complexité de l'AO."""


def _build_sections_system(planning_activities: list[tuple[str, str]] | None = None) -> str:
    """Prompt système de génération des sections de l'offre.

    - sans `planning_activities` (templates legacy) → planning demandé par PHASE ;
    - avec `planning_activities` (templates « à variables ») → on fournit la liste
      EXACTE des activités du tableau de planning et on demande un J/H par activité
      (le tableau du modèle est figé, une ligne = une activité).
    """
    if planning_activities:
        acts = "\n".join(
            f"  {i}. [{ph}] {act}" for i, (ph, act) in enumerate(planning_activities, start=1)
        )
        planning_block = (
            '  "planning_jh": [\n'
            '    {"index": 1, "jh": "3"},\n'
            '    {"index": 2, "jh": "5"}\n'
            "  ]\n"
            "}\n"
        )
        planning_rule = (
            "\n- planning_jh : estime la charge en J/H (jours-homme, entier) de CHACUNE "
            f"des {len(planning_activities)} activités listées ci-dessous, dans CET ORDRE "
            "(référencées par `index`). Mets \"\" pour une activité sans charge chiffrable "
            "(préalable administratif, gestion de projet transverse). Adapte les charges à "
            "la complexité réelle de l'AO.\n\n"
            "ACTIVITÉS DU PLANNING (ordre figé du modèle, ne pas réordonner) :\n" + acts
        )
        return _SECTIONS_HEAD + planning_block + _RULES_COMMON + planning_rule
    return _SECTIONS_HEAD + _PLANNING_LEGACY + _RULES_COMMON + _PLANNING_RULE_LEGACY


# ── Helpers texte ─────────────────────────────────────────────────────────────

def _norm(s: str) -> str:
    """Normalise une chaîne pour comparaison : NFC, quotes, espaces, minuscules."""
    s = unicodedata.normalize("NFC", s)
    return (
        s.replace("’", "'").replace("‘", "'")
         .replace("’", "'").replace(" ", " ")
         .replace(" ", " ").replace("–", "-").replace("—", "-")
         .replace("“", '"').replace("”", '"')
         .lower()
    )


def _replace_runs(para, old: str, new: str) -> bool:
    """Remplace old→new dans les runs d'un paragraphe (gère split-run).
    Retourne True si un remplacement a eu lieu."""
    if old not in para.text:
        return False
    # Tentative run direct
    for run in para.runs:
        if old in run.text:
            run.text = run.text.replace(old, new)
            return True
    # Fallback split-run : recomposer
    full = para.text.replace(old, new)
    for run in para.runs:
        run.text = ""
    if para.runs:
        para.runs[0].text = full
    return True


def _replace_all_body(doc: DocxDocument, old: str, new: str) -> int:
    """Remplace old→new dans tous les paragraphes du corps et des cellules.
    Retourne le nombre de paragraphes modifiés."""
    n = 0
    for p in doc.paragraphs:
        n += _replace_runs(p, old, new)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    n += _replace_runs(p, old, new)
    return n


# ── Text boxes ────────────────────────────────────────────────────────────────

def _replace_in_cover_textboxes(doc: DocxDocument, old: str, new: str) -> int:
    """Remplace old→new dans les 12 premières text boxes (page de garde uniquement).
    Retourne le nombre de remplacements effectués."""
    body = doc.element.body
    count = 0
    hits = 0
    for txbx in body.findall(".//" + qn("w:txbxContent")):
        for p_elem in txbx.findall(qn("w:p")):
            t_elems = p_elem.findall(".//" + qn("w:t"))
            full = "".join(t.text or "" for t in t_elems)
            if old in full:
                t_elems[0].text = full.replace(old, new)
                for t in t_elems[1:]:
                    t.text = ""
                hits += 1
        count += 1
        if count >= 12:
            break
    return hits


def _update_header_title(doc: DocxDocument, new_title: str) -> bool:
    """Remplace le titre legacy dans les en-têtes (parties header*.xml, hors corps).

    Le titre peut y être réparti sur PLUSIEURS paragraphes d'une même zone de
    texte (cas MCI CARE) : on matche donc le texte concaténé de chaque zone, et
    on traite chaque copie mc:Choice / mc:Fallback séparément. Les paragraphes
    hors zone de texte sont matchés individuellement. Retourne True si au moins
    un titre a été remplacé.
    """
    hit = False
    seen: set[int] = set()
    for section in doc.sections:
        for kind in ("header", "first_page_header", "even_page_header"):
            hdr_el = getattr(section, kind)._element
            if id(hdr_el) in seen:
                continue
            seen.add(id(hdr_el))
            for txbx in hdr_el.findall(".//" + qn("w:txbxContent")):
                t_elems = txbx.findall(".//" + qn("w:t"))
                full = "".join(t.text or "" for t in t_elems)
                if t_elems and any(kw in _norm(full) for kw in _LEGACY_TITLE_KEYWORDS):
                    t_elems[0].text = new_title.upper() if full.isupper() else new_title
                    for t in t_elems[1:]:
                        t.text = ""
                    hit = True
            for p_elem in hdr_el.findall(".//" + qn("w:p")):
                if any(True for _ in p_elem.iterancestors(qn("w:txbxContent"))):
                    continue  # déjà traité au niveau de la zone de texte
                t_elems = p_elem.findall(".//" + qn("w:t"))
                own = [t for t in t_elems
                       if not any(True for _ in t.iterancestors(qn("w:txbxContent")))]
                full = "".join(t.text or "" for t in own)
                if own and any(kw in _norm(full) for kw in _LEGACY_TITLE_KEYWORDS):
                    own[0].text = new_title.upper() if full.isupper() else new_title
                    for t in own[1:]:
                        t.text = ""
                    hit = True
    return hit


def _cover_paragraphs(doc: DocxDocument, limit: int = 80) -> list:
    """Les premiers w:p du document : page de garde, paragraphes du corps ET
    paragraphes de text boxes (copies mc:Choice / mc:Fallback comprises)."""
    return doc.element.body.findall(".//" + qn("w:p"))[:limit]


def _update_txbx_title(doc: DocxDocument, new_title: str) -> bool:
    """Remplace le titre legacy sur la page de garde — selon le template, il vit
    dans une text box (KORAZ) ou dans un paragraphe normal du corps (MCI CARE).
    Retourne True si le titre a été remplacé."""
    hit = False
    for p_elem in _cover_paragraphs(doc):
        t_elems = p_elem.findall(".//" + qn("w:t"))
        full = "".join(t.text or "" for t in t_elems)
        if t_elems and any(kw in _norm(full) for kw in _LEGACY_TITLE_KEYWORDS):
            t_elems[0].text = new_title.upper() if full.isupper() else new_title
            for t in t_elems[1:]:
                t.text = ""
            hit = True
    return hit


_MONTHS_FR = {
    1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
    5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
    9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
}


def _cover_date_str() -> str:
    """Date « Mois Année » du jour, pour la page de garde."""
    now = datetime.now()
    return f"{_MONTHS_FR[now.month]} {now.year}"


def _update_txbx_date(doc: DocxDocument) -> bool:
    """Met à jour la date (mois + année) sur la page de garde, quelle que soit la
    casse du template (« AVRIL 2026 » comme « Avril 2026 »).
    Retourne True si une date a été mise à jour."""
    new_date = _cover_date_str()
    all_months = list(_MONTHS_FR.values()) + [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    month_re = re.compile(r"\b(" + "|".join(m.upper() for m in all_months) + r")\b")
    year_re = re.compile(r"\b20[2-9]\d\b")
    hit = False
    for p_elem in _cover_paragraphs(doc):
        t_elems = p_elem.findall(".//" + qn("w:t"))
        full = "".join(t.text or "" for t in t_elems)
        if t_elems and month_re.search(_norm(full).upper()) and year_re.search(full):
            t_elems[0].text = new_date.upper() if full.isupper() else new_date
            for t in t_elems[1:]:
                t.text = ""
            hit = True
    return hit


# ── Sections (heading-based) ──────────────────────────────────────────────────

_TOC_TAIL = re.compile(r"\t\s*\d+\s*$")  # entrée de sommaire : « … <TAB> 12 »


def _is_numbered(p) -> bool:
    """Vrai si le paragraphe porte une numérotation/puce de liste (w:numPr)."""
    pPr = p._p.find(qn("w:pPr"))
    return pPr is not None and pPr.find(qn("w:numPr")) is not None


def _looks_like_title(p) -> bool:
    """Un paragraphe est un TITRE de section si son style est Heading*, OU s'il
    s'agit d'un titre numéroté hors style Heading (templates dont les titres sont
    des éléments de liste, ex. IIPS). Les lignes de sommaire (texte finissant par
    TAB + n° de page) sont toujours exclues."""
    text = p.text or ""
    if _TOC_TAIL.search(text):
        return False
    if (p.style.name or "").startswith("Heading"):
        return True
    return _is_numbered(p)


def _find_heading_idx(paras: list, fragment: str, start: int = 0) -> int | None:
    """Index du premier TITRE contenant `fragment`, à partir de `start`.

    - les entrées de sommaire (TAB + n° de page) sont ignorées ;
    - une correspondance EXACTE (texte du paragraphe == fragment) gagne, quel que
      soit le style — un paragraphe dont tout le texte est le nom de section EST le
      titre, même s'il n'est pas stylé Heading ;
    - sinon, on accepte une inclusion mais seulement sur un paragraphe « titre »
      (cf. _looks_like_title), pour ne pas matcher un paragraphe de corps.
    """
    frag = _norm(fragment)
    exact: list[int] = []
    contains: list[int] = []
    for i in range(start, len(paras)):
        text = paras[i].text or ""
        if _TOC_TAIL.search(text):
            continue
        ntext = _norm(text)
        if frag not in ntext:
            continue
        if ntext.strip() == frag:
            exact.append(i)
        elif _looks_like_title(paras[i]):
            contains.append(i)
    if exact:
        return exact[0]
    return contains[0] if contains else None


def _clear_section(doc: DocxDocument, start_heading: str, end_heading: str | None = None) -> int | None:
    """
    Supprime tous les paragraphes ENTRE start_heading et end_heading (exclusifs).
    Retourne l'index de start_heading dans doc.paragraphs (après suppression).
    """
    paras = doc.paragraphs
    h_idx = _find_heading_idx(paras, start_heading)
    if h_idx is None:
        logger.warning("Heading '%s' non trouvé", start_heading)
        return None

    if end_heading:
        n_idx = _find_heading_idx(paras, end_heading, start=h_idx + 1)
        if n_idx is None:
            n_idx = len(paras)
    else:
        n_idx = next(
            (i for i in range(h_idx + 1, len(paras)) if _looks_like_title(paras[i])),
            len(paras),
        )

    to_remove = paras[h_idx + 1 : n_idx]
    for p in to_remove:
        parent = p._element.getparent()
        if parent is not None:
            parent.remove(p._element)

    logger.info("Section '%s' vidée : %d para(s) supprimés", start_heading, len(to_remove))
    return h_idx


def _insert_after_heading(doc: DocxDocument, heading_fragment: str, texts: list[str], style: str = "Body Text") -> bool:
    """
    Insère des paragraphes juste après le heading dont le texte contient heading_fragment.
    Retourne True si le heading a été trouvé.
    """
    paras = doc.paragraphs
    h_idx = _find_heading_idx(paras, heading_fragment)
    if h_idx is None:
        return False

    anchor = paras[h_idx]._element
    resolved_style = doc.styles[style] if style in doc.styles else doc.styles["Normal"]

    for text in texts:
        new_p = doc.add_paragraph(text)
        new_p.style = resolved_style
        anchor.addnext(new_p._element)
        anchor = new_p._element

    return True


def _fill_description_section(doc: DocxDocument, fonctionnalites: list[str], modules: list[dict]) -> bool:
    """
    Après le heading 'Description détaillée de la solution proposée', insère dans l'ordre :
      1. Intro + liste de fonctionnalités (List Paragraph)
      2. Intro modules + sous-sections par module (Heading 2 + Body Text)
    Tout est inséré en séquence correcte via addnext.
    """
    paras = doc.paragraphs
    h_idx = _find_heading_idx(paras, H_DESCRIPTION)
    if h_idx is None:
        h_idx = _find_heading_idx(paras, "Fonctionnalités de l")
        if h_idx is None:
            logger.warning("Heading 'Description détaillée' non trouvé")
            return False

    anchor = paras[h_idx]._element
    # python-docx : l'objet Styles n'a pas de .get() — on teste l'appartenance.
    body_style = doc.styles["Body Text"] if "Body Text" in doc.styles else doc.styles["Normal"]
    list_style = doc.styles["List Paragraph"] if "List Paragraph" in doc.styles else doc.styles["Normal"]
    h2_style = next((s for s in doc.styles if s.name == "Heading 2"), None)

    def _add(text: str, style=None):
        nonlocal anchor
        p = doc.add_paragraph(text)
        if style:
            p.style = style
        anchor.addnext(p._element)
        anchor = p._element

    # ── Fonctionnalités ───────────────────────────────────────────────────────
    _add("Elle aura les fonctionnalités principales suivantes :", body_style)
    for feat in fonctionnalites:
        _add(feat, list_style)

    # ── Modules ───────────────────────────────────────────────────────────────
    _add(
        "La solution proposée par Neurones Technologies est structurée en modules "
        "fonctionnels indépendants et interopérables, couvrant l'ensemble des besoins "
        "exprimés dans le présent appel d'offres.",
        body_style,
    )
    for mod in modules:
        titre = mod.get("titre", "").strip()
        desc = mod.get("description", "").strip()
        if not titre:
            continue
        _add(titre.upper(), h2_style)
        if desc:
            _add(desc, body_style)

    logger.info("Section description remplie : %d fonctionnalités, %d modules", len(fonctionnalites), len(modules))
    return True


# ── TABLE 0 : composants techniques ──────────────────────────────────────────

def _update_tech_table(doc: DocxDocument, stack: list[dict]) -> bool:
    """
    Met à jour TABLE 0 (composants/prérequis) EN PLACE.
    - Lignes 1 à N_DATA : mises à jour avec notre stack (sans toucher à la structure merged)
    - Lignes restantes jusqu'à la ligne serveur web (Row 6) : laissées intactes
    Retourne False si le tableau est absent (→ stack à intégrer manuellement).
    """
    if not doc.tables:
        return False
    table = doc.tables[0]
    rows = table.rows

    # Lignes 1-5 sont les composants logiciels (GoLang, SQL Server, Oracle, Ubuntu, LB)
    # On remplace leur contenu par notre stack
    data_rows_count = min(TECH_TABLE_DATA_ROWS, len(rows) - 1)  # max 5 lignes data (rows 1-5)
    stack_items = stack[:data_rows_count]

    for i, item in enumerate(stack_items):
        row_idx = i + 1  # row 0 = header
        if row_idx >= len(rows):
            break
        row = rows[row_idx]
        cells = row.cells
        n = len(cells)
        if n == 0:
            continue
        # Mettre à jour la première cellule logique (col 0)
        _set_cell_text(cells[0], item.get("composant", ""))
        # Mettre à jour la dernière cellule logique (col -1, la version)
        _set_cell_text(cells[n - 1], item.get("version", ""))

    # Si on a moins d'items que de lignes data, vider les lignes restantes
    for i in range(len(stack_items), data_rows_count):
        row_idx = i + 1
        if row_idx >= len(rows):
            break
        row = rows[row_idx]
        cells = row.cells
        _set_cell_text(cells[0], "")
        _set_cell_text(cells[len(cells) - 1], "")

    logger.info("Table composants mise à jour : %d items", len(stack_items))
    return True


def _set_cell_text(cell, text: str) -> None:
    """Met à jour le texte d'une cellule sans casser la mise en forme."""
    # Vider les runs du premier paragraphe
    if cell.paragraphs:
        para = cell.paragraphs[0]
        for run in para.runs:
            run.text = ""
        if para.runs:
            para.runs[0].text = text
        else:
            para.add_run(text)


# ── TABLE 1 : équipe ──────────────────────────────────────────────────────────

def _update_team_table(doc: DocxDocument, rows_data: list[list[str]]) -> bool:
    """Met à jour la table équipe (TABLE 1) en conservant l'en-tête.
    Retourne False si le tableau est absent (→ équipe à intégrer manuellement)."""
    if len(doc.tables) < 2:
        return False
    table = doc.tables[1]
    # Supprimer les lignes de données (conserver header = row 0)
    while len(table.rows) > 1:
        tr = table.rows[-1]._tr
        tr.getparent().remove(tr)
    n_cols = len(table.columns)
    for row_vals in rows_data:
        row = table.add_row()
        for col_idx, val in enumerate(row_vals[:n_cols]):
            row.cells[col_idx].text = str(val)
    return True


# ── TABLE planning ────────────────────────────────────────────────────────────

def _find_planning_table(doc: DocxDocument):
    """Repère le tableau de planning par son CONTENU (libellés de phases) plutôt
    que par sa position : `doc.tables[-1]` peut être un autre tableau (annexe, CV…).
    Retourne le tableau contenant le plus de phases, ou None s'il en contient trop
    peu (< PLANNING_MIN_PHASES_MATCH) — auquel cas le planning n'est pas mis à jour."""
    best, best_score = None, 0
    for table in doc.tables:
        txt = _norm(" ".join(c.text for r in table.rows for c in r.cells))
        score = sum(1 for ph in PLANNING_PHASES if _norm(ph) in txt)
        if score > best_score:
            best, best_score = table, score
    return best if best_score >= PLANNING_MIN_PHASES_MATCH else None


def _update_planning_table(doc: DocxDocument, planning_items: list[dict]) -> bool:
    """
    Met à jour le planning EN PLACE (preserve gridSpan/vMerge).
    - Cherche chaque phase dans les lignes en-tête (lignes complètes fusionnées)
    - Met à jour les J/H dans la colonne droite des lignes d'activités
    - Met à jour le TOTAL
    Retourne False si le tableau de planning est introuvable (→ à intégrer manuellement).
    """
    table = _find_planning_table(doc)
    if table is None:
        logger.warning("Tableau de planning introuvable (phases absentes) — J/H non mis à jour")
        return False
    rows = table.rows
    n_cols = len(table.columns)

    # Construire un mapping phase → J/H depuis nos données
    phase_jh: dict[str, str] = {}
    for item in planning_items:
        phase = _norm(item.get("phase", ""))
        jh = str(item.get("jh", "")).strip()
        phase_jh[phase] = jh

    current_phase = ""
    for row in rows:
        cells = row.cells
        if not cells:
            continue

        # Détecter si c'est une ligne de phase (toutes les cellules ont le même _tc = merged)
        # ou une ligne TOTAL
        first_text = _norm(cells[0].text.strip())

        # Ligne TOTAL
        if "total" in first_text:
            total = sum(
                int(i.get("jh", 0)) for i in planning_items
                if str(i.get("jh", "")).isdigit()
            )
            _set_cell_text(cells[n_cols - 1], str(total) if total else "")
            continue

        # Ligne de phase : la cellule 0 et la cellule N-1 pointent vers le même _tc
        # (à cause du gridSpan) — le texte occupe toute la largeur
        if n_cols >= 2 and cells[0]._tc is cells[n_cols - 1]._tc:
            current_phase = first_text
            continue

        # Ligne d'activité : mettre à jour J/H si on a une valeur pour cette phase
        if current_phase in phase_jh:
            jh = phase_jh[current_phase]
            if jh:
                _set_cell_text(cells[n_cols - 1], jh)

    logger.info("Planning mis à jour avec %d phases", len(phase_jh))
    return True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_domain(scoring: ScoringResult) -> str:
    """Domaine UNIQUE pour choisir le template Word (vue mono-domaine).

    Délègue au classifieur partagé (matching scoré sur frontière de mot, source
    unique des mots-clés). La matrice de conformité, elle, conserve le tag
    multi-valeur via `domain_classifier.suggested_domains`."""
    text = scoring.summary + " " + " ".join(e.value for e in scoring.key_elements)
    return primary_domain(text)


def _find_template(domain: str) -> Path | None:
    ged = Path(settings.ged_path)
    for subpath in [
        ged / "offres-techniques" / "TEMPLATE" / domain,
        ged / "offres-techniques" / "TEMPLATE",
    ]:
        if subpath.exists():
            files = list(subpath.glob("*.docx"))
            if files:
                return files[0]
    return None


def _planning_activities_for(domain: str) -> list[tuple[str, str]]:
    """Si le template du domaine est « à variables », renvoie ses activités de planning
    (pour demander un J/H par activité au LLM) ; sinon liste vide (mode legacy par phase)."""
    path = _find_template(domain)
    if path is None:
        return []
    try:
        doc = DocxDocument(str(path))
    except Exception as exc:
        logger.warning("Lecture template '%s' échouée (%s) — planning par phase", path, exc)
        return []
    if not _placeholders_present(doc):
        return []
    return _extract_planning_activities(doc)


def _extract_client_from_scoring(scoring: ScoringResult) -> str:
    """Tente d'extraire le nom du client depuis les key_elements."""
    for e in scoring.key_elements:
        if any(k in e.category.lower() for k in ("client", "commanditaire", "maître", "donneur")):
            v = e.value.strip()
            if v and v.lower() not in ("non précisé", "inconnu", ""):
                return v
    return ""


def _clean_person_name(filename: str) -> str:
    """« CV_Jean_Konan.docx » → « Jean Konan » : retire l'extension, le préfixe CV
    et les séparateurs, pour afficher un nom lisible dans le tableau équipe."""
    name = filename.rsplit(".", 1)[0]
    name = re.sub(r"^cv[\s_-]+", "", name, flags=re.IGNORECASE)
    return name.replace("_", " ").replace("-", " ").strip()


def _resolve_ged_files(filenames: list[str], folder: Path) -> list[Path]:
    """Mappe des noms de fichiers (choisis dans le modal) vers leur chemin réel sous
    la GED (recherche récursive). Les fichiers introuvables (supprimés depuis) sont
    ignorés silencieusement — la génération n'est jamais bloquée."""
    if not filenames or not folder.exists():
        return []
    by_name = {f.name: f for f in folder.rglob("*") if f.is_file()}
    return [by_name[n] for n in filenames if n in by_name]


def _insert_pdf_pages(doc: DocxDocument, pdf_path: Path, max_pages: int = 25) -> tuple[int, int]:
    """Insère chaque page du PDF comme une image pleine page (aspect préservé, centrée)
    dans le document. Retourne (pages_insérées, pages_totales)."""
    import fitz
    from docx.shared import Emu
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    sec = doc.sections[0]
    usable_w = int(sec.page_width - sec.left_margin - sec.right_margin)
    usable_h = int(sec.page_height - sec.top_margin - sec.bottom_margin)
    zoom = 130 / 72.0  # ~130 DPI : lisible sans alourdir exagérément le .docx
    mat = fitz.Matrix(zoom, zoom)

    inserted, total = 0, 0
    with fitz.open(str(pdf_path)) as pdf:
        total = pdf.page_count
        n_to_insert = min(max_pages, total)
        for i, page in enumerate(pdf):
            if i >= max_pages:
                break
            try:
                pix = page.get_pixmap(matrix=mat)
                png = pix.tobytes("png")
                ratio = (pix.width / pix.height) if pix.height else 1.0
                target_w = usable_w
                if usable_h and (target_w / ratio) > usable_h:
                    target_w = int(usable_h * ratio)
                doc.add_picture(BytesIO(png), width=Emu(target_w))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                inserted += 1
                if i < n_to_insert - 1:
                    doc.add_page_break()
            except Exception as exc:
                logger.warning("Page %d de %s non insérée (%s)", i + 1, pdf_path.name, exc)
    return inserted, total


def _append_document_annexes(doc: DocxDocument, cv_paths: list[Path], abe_paths: list[Path]) -> None:
    """Intègre EN ANNEXE, à la fin de l'offre, les CV et ABE choisis dans le modal :
    chaque page PDF est rendue en image pleine page. Les formats non-PDF sont signalés
    « à annexer manuellement » (rouge). Sans sélection, ne fait rien."""
    from docx.shared import Pt

    groups: list[tuple[str, list[Path]]] = []
    if cv_paths:
        groups.append(("ANNEXE — CV DES INTERVENANTS", cv_paths))
    if abe_paths:
        groups.append(("ANNEXE — ATTESTATIONS DE BONNE EXÉCUTION (ABE)", abe_paths))
    if not groups:
        return

    for heading, paths in groups:
        doc.add_page_break()
        title = doc.add_paragraph()
        tr = title.add_run(heading)
        tr.bold = True
        tr.font.size = Pt(14)
        tr.font.color.rgb = RGBColor(0x0F, 0x29, 0x5A)

        for path in paths:
            sub = doc.add_paragraph()
            sr = sub.add_run(path.stem.replace("_", " ").replace("-", " ").strip())
            sr.bold = True
            sr.font.color.rgb = RGBColor(0x1E, 0x40, 0xAF)
            if path.suffix.lower() == ".pdf":
                inserted, total = _insert_pdf_pages(doc, path)
                if inserted == 0:
                    nr = doc.add_paragraph().add_run(
                        f"{_TODO_MARK} Impossible d'extraire « {path.name} » — à annexer manuellement.")
                    nr.font.color.rgb = _TODO_COLOR
                elif total > inserted:
                    nr = doc.add_paragraph().add_run(
                        f"{_TODO_MARK} {total - inserted} page(s) de « {path.name} » non insérée(s) "
                        f"(limite {inserted}).")
                    nr.font.color.rgb = _TODO_COLOR
            else:
                nr = doc.add_paragraph().add_run(
                    f"{_TODO_MARK} « {path.name} » (format {path.suffix}) à annexer manuellement.")
                nr.font.color.rgb = _TODO_COLOR
            doc.add_page_break()


# ── Placeholders « à compléter » (génération jamais bloquante) ────────────────

def _todo_paragraph(doc: DocxDocument, text: str, *, bold: bool = False):
    """Crée (en fin de corps) un paragraphe rouge marqué « à compléter »."""
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.color.rgb = _TODO_COLOR
    run.bold = bold
    return p


def _add_cover_todo_banner(doc: DocxDocument, lines: list[str]) -> None:
    """Insère un encadré d'instructions EN HAUT du document (page de garde), pour
    les éléments que le modèle n'a pas permis de substituer automatiquement.

    On crée les paragraphes (ajoutés en fin de corps par python-docx) puis on les
    déplace devant le premier élément du corps, dans l'ordre — l'encadré apparaît
    ainsi tout en haut de la page 1, à l'endroit concerné."""
    if not lines:
        return
    created = [_todo_paragraph(
        doc, f"{_TODO_MARK} PAGE DE GARDE À COMPLÉTER MANUELLEMENT", bold=True)._element]
    for line in lines:
        created.append(_todo_paragraph(doc, f"•  {line}")._element)

    body = doc.element.body
    anchor = body[0]  # premier élément AVANT déplacement (les nouveaux sont en fin)
    for el in created:
        body.remove(el)
        anchor.addprevious(el)


def _append_manual_appendix(
    doc: DocxDocument,
    missing_sections: list[tuple[str, list[str]]],
    missing_desc: tuple[list[str], list[dict]] | None,
    missing_tables: list[tuple[str, list[str]]],
) -> None:
    """Ajoute en fin de document une annexe regroupant le contenu généré dont
    l'emplacement (heading / tableau) est introuvable dans le modèle. Le contenu
    n'est jamais perdu : il est reproduit ici, à recopier au bon endroit."""
    if not (missing_sections or missing_desc or missing_tables):
        return

    doc.add_page_break()
    _todo_paragraph(doc, f"{_TODO_MARK} ÉLÉMENTS À INTÉGRER MANUELLEMENT", bold=True)
    note = doc.add_paragraph()
    nr = note.add_run(
        "Le modèle .docx ne contenait pas l'emplacement attendu pour les éléments "
        "ci-dessous. Le contenu généré par l'IA est reproduit ici : recopiez-le à "
        "l'endroit approprié de votre document."
    )
    nr.italic = True
    nr.font.color.rgb = _TODO_COLOR

    for label, paras in missing_sections:
        _todo_paragraph(doc, f"▸ {label}", bold=True)
        for txt in paras:
            doc.add_paragraph(txt)

    if missing_desc:
        fonctionnalites, modules = missing_desc
        _todo_paragraph(doc, "▸ Description détaillée de la solution proposée", bold=True)
        doc.add_paragraph("Fonctionnalités principales :")
        for feat in fonctionnalites:
            doc.add_paragraph(f"- {feat}")
        for mod in modules:
            titre = (mod.get("titre") or "").strip()
            desc = (mod.get("description") or "").strip()
            if titre:
                doc.add_paragraph(titre)
            if desc:
                doc.add_paragraph(desc)

    for label, rows in missing_tables:
        _todo_paragraph(doc, f"▸ {label}", bold=True)
        for line in rows:
            doc.add_paragraph(line)


# ── Templates « à variables » {{ }} ──────────────────────────────────────────
# Remplissage par substitution de placeholders (vs. legacy : noms + ancres de titres).
# Détection automatique : un .docx contenant un {{ bascule sur ce moteur.

_PH_RE = re.compile(r"\{\{\s*([^{}]*?)\s*\}\}")


def _ph_norm(s: str) -> str:
    """Clé de comparaison d'un placeholder : normalisée (casse/accents/apostrophes/
    espaces) et débarrassée des espaces de bord — tolère « {{Nom client }} »."""
    return _norm(s).strip()


def _all_text_roots(doc: DocxDocument) -> list:
    """Racines XML à balayer : corps + en-têtes/pieds de toutes les sections (et
    variantes première page / pages paires), dédupliquées."""
    roots = [doc.element.body]
    seen = {id(doc.element.body)}
    for section in doc.sections:
        for kind in ("header", "first_page_header", "even_page_header",
                     "footer", "first_page_footer", "even_page_footer"):
            try:
                el = getattr(section, kind)._element
            except Exception:
                continue
            if el is not None and id(el) not in seen:
                seen.add(id(el))
                roots.append(el)
    return roots


def _placeholders_present(doc: DocxDocument) -> bool:
    """Vrai si le .docx contient au moins un placeholder {{...}} (corps, en-têtes,
    pieds, zones de texte) — sélectionne le moteur de remplissage."""
    for root in _all_text_roots(doc):
        for p_el in root.findall(".//" + qn("w:p")):
            full = "".join((t.text or "") for t in p_el.findall(".//" + qn("w:t")))
            if "{{" in full:
                return True
    return False


def _present_placeholder_keys(doc: DocxDocument) -> set[str]:
    """Ensemble des clés (normalisées) de tous les placeholders {{...}} présents dans
    le .docx (corps + en-têtes/pieds + zones de texte). Utilisé par le validateur."""
    present: set[str] = set()
    for root in _all_text_roots(doc):
        for p_el in root.findall(".//" + qn("w:p")):
            full = "".join((t.text or "") for t in p_el.findall(".//" + qn("w:t")))
            for m in _PH_RE.finditer(full):
                present.add(_ph_norm(m.group(1)))
    return present


def _sub_simple_in_root(root, repl: dict) -> int:
    """Substitue les placeholders « simples » (valeur unique) dans tous les paragraphes
    sous `root`. `repl` : clé normalisée (_ph_norm) → valeur. Gère le split-run. Ne
    touche QUE les paragraphes contenant '{{' ; les tokens inconnus sont laissés."""
    n = 0
    for p_el in root.findall(".//" + qn("w:p")):
        t_els = p_el.findall(".//" + qn("w:t"))
        if not t_els:
            continue
        full = "".join(t.text or "" for t in t_els)
        if "{{" not in full:
            continue
        new = _PH_RE.sub(lambda m: repl.get(_ph_norm(m.group(1)), m.group(0)), full)
        if new != full:
            t_els[0].text = new
            for t in t_els[1:]:
                t.text = ""
            n += 1
    return n


def _replace_paragraph_with_items(p_el, items: list[str]) -> None:
    """Remplace le paragraphe `p_el` (porteur d'un placeholder « liste ») par un
    paragraphe par item, en clonant sa mise en forme (pPr + rPr du 1er run) — conserve
    le style du modèle (puces, retrait…). `items` vide → supprime le paragraphe."""
    ppr = p_el.find(qn("w:pPr"))
    first_r = p_el.find(qn("w:r"))
    rpr = first_r.find(qn("w:rPr")) if first_r is not None else None
    for item in items:
        np = OxmlElement("w:p")
        if ppr is not None:
            np.append(copy.deepcopy(ppr))
        r = OxmlElement("w:r")
        if rpr is not None:
            r.append(copy.deepcopy(rpr))
        t = OxmlElement("w:t")
        t.set(qn("xml:space"), "preserve")
        t.text = str(item)
        r.append(t)
        np.append(r)
        p_el.addprevious(np)
    parent = p_el.getparent()
    if parent is not None:
        parent.remove(p_el)


def _find_body_placeholder(doc: DocxDocument, norm_keys: set[str]):
    """Premier paragraphe du corps dont le placeholder a une clé dans `norm_keys`."""
    for p_el in doc.element.body.findall(".//" + qn("w:p")):
        full = "".join((t.text or "") for t in p_el.findall(".//" + qn("w:t")))
        m = _PH_RE.search(full)
        if m and _ph_norm(m.group(1)) in norm_keys:
            return p_el
    return None


def _expand_list_placeholder(doc: DocxDocument, norm_keys: set[str], items: list[str]) -> bool:
    """Remplace le placeholder « liste » par un paragraphe par item (style cloné)."""
    p_el = _find_body_placeholder(doc, norm_keys)
    if p_el is None:
        return False
    _replace_paragraph_with_items(p_el, [s for s in items if str(s).strip()])
    return True


def _insert_repartition_at_placeholder(doc: DocxDocument, norm_keys: set[str], rows: list[dict]) -> bool:
    """Insère à l'emplacement du placeholder un tableau Fonctionnalité → Composant,
    puis supprime le paragraphe placeholder. Retourne True si l'emplacement existe."""
    target = _find_body_placeholder(doc, norm_keys)
    if target is None:
        return False
    rows = [r for r in rows if (r.get("fonctionnalite") or "").strip()]
    table = doc.add_table(rows=1 + len(rows), cols=2)
    if "Table Grid" in doc.styles:
        table.style = doc.styles["Table Grid"]
    h0, h1 = REPARTITION_HEADERS
    table.rows[0].cells[0].text = h0
    table.rows[0].cells[1].text = h1
    for c in table.rows[0].cells:
        for p in c.paragraphs:
            for run in p.runs:
                run.bold = True
    for i, item in enumerate(rows, start=1):
        cells = table.rows[i].cells
        cells[0].text = (item.get("fonctionnalite") or "").strip()
        cells[1].text = (item.get("composant") or "").strip()
    tbl_el = table._tbl
    tbl_el.getparent().remove(tbl_el)   # add_table l'a placé en fin de corps
    target.addprevious(tbl_el)
    parent = target.getparent()
    if parent is not None:
        parent.remove(target)
    logger.info("Répartition insérée : tableau %d ligne(s)", len(rows))
    return True


def _find_team_table(doc: DocxDocument):
    """Repère le tableau ÉQUIPE par son en-tête (NOM + FONCTION/RÔLE), indépendamment
    de sa position. Retourne None si introuvable."""
    for t in doc.tables:
        if not t.rows:
            continue
        hdr = _norm(" ".join(c.text for c in t.rows[0].cells))
        if "nom" in hdr and ("fonction" in hdr or "role" in hdr or "rôle" in hdr):
            return t
    return None


def _update_team_table_named(doc: DocxDocument, people: list[tuple[str, str]]) -> bool:
    """Remplace les lignes de données du tableau équipe (NOM | FONCTION) par `people`,
    en conservant l'en-tête. Retourne False si le tableau est introuvable."""
    table = _find_team_table(doc)
    if table is None:
        return False
    while len(table.rows) > 1:
        tr = table.rows[-1]._tr
        tr.getparent().remove(tr)
    n_cols = len(table.columns)
    for name, func in people:
        cells = table.add_row().cells
        _set_cell_text(cells[0], name)
        if n_cols > 1:
            _set_cell_text(cells[n_cols - 1], func)
    logger.info("Tableau équipe : %d intervenant(s)", len(people))
    return True


def _named_team_from_cvs(selected_cvs: list[str]) -> list[tuple[str, str]]:
    """(Nom, Fonction) à partir des CV choisis : 1er = Chef de Projet, suivants =
    Consultant / Développeur Senior."""
    names = [_clean_person_name(f).strip().title() for f in selected_cvs if f]
    return [
        (name, "Chef de Projet" if i == 0 else "Consultant / Développeur Senior")
        for i, name in enumerate(names)
    ]


def _extract_planning_activities(doc: DocxDocument) -> list[tuple[str, str]]:
    """Liste ordonnée (phase, activité) des lignes de données du tableau de planning
    (hors lignes de phase fusionnées et hors ligne TOTAL). Vide si pas de tableau."""
    table = _find_planning_table(doc)
    if table is None:
        return []
    n_cols = len(table.columns)
    out: list[tuple[str, str]] = []
    current_phase = ""
    for row in table.rows:
        cells = row.cells
        if not cells:
            continue
        first = cells[0].text.strip()
        if "total" in _norm(first):
            continue
        if n_cols >= 2 and cells[0]._tc is cells[n_cols - 1]._tc:
            current_phase = first
            continue
        act = cells[1].text.strip() if n_cols >= 2 else first
        if act:
            out.append((current_phase, act))
    return out


def _update_planning_activities(doc: DocxDocument, planning_items: list[dict]) -> bool:
    """Met à jour le planning par ACTIVITÉ : écrit le J/H de chaque ligne de données
    dans l'ordre des `planning_items`, puis recalcule le TOTAL. Préserve la structure
    (lignes de phase fusionnées, numérotation). False si pas de tableau de planning."""
    table = _find_planning_table(doc)
    if table is None:
        logger.warning("Tableau de planning introuvable — J/H non mis à jour")
        return False
    n_cols = len(table.columns)
    jh_seq = [str(it.get("jh", "")).strip() for it in planning_items]
    total, data_i, total_row = 0, 0, None
    for row in table.rows:
        cells = row.cells
        if not cells:
            continue
        if "total" in _norm(cells[0].text.strip()):
            total_row = row
            continue
        if n_cols >= 2 and cells[0]._tc is cells[n_cols - 1]._tc:
            continue  # ligne de phase fusionnée
        jh = jh_seq[data_i] if data_i < len(jh_seq) else ""
        data_i += 1
        _set_cell_text(cells[n_cols - 1], jh)
        if jh.isdigit():
            total += int(jh)
    if total_row is not None:
        _set_cell_text(total_row.cells[n_cols - 1], str(total) if total else "")
    logger.info("Planning (par activité) : %d ligne(s), total=%d J/H", data_i, total)
    return True


def _cover_date_parts() -> tuple[str, str]:
    """(« Mois », « Année ») du jour, pour {{Mois}} / {{Année}}."""
    now = datetime.now()
    return _MONTHS_FR[now.month], str(now.year)


def _ensure_header_title(doc: DocxDocument, title: str) -> None:
    """Garantit la présence du titre dans le header des pages de contenu. Les headers
    portant {{Titre de l'offre}} sont déjà remplis par le balayage simple ; ici on
    complète les headers PROPRES À UNE SECTION qui sont VIDES (ex. dernière section
    rattachée à un header séparé). Les headers hérités (liés au précédent) et la page
    de garde (sans header propre) ne sont pas touchés."""
    if not title:
        return
    for section in doc.sections:
        try:
            hdr = section.header
        except Exception:
            continue
        if hdr is None or hdr.is_linked_to_previous:
            continue
        el = hdr._element
        if any((t.text or "").strip() for t in el.findall(".//" + qn("w:t"))):
            continue  # déjà du contenu (placeholder rempli / texte) → pas de doublon
        if hdr.paragraphs:
            hdr.paragraphs[0].text = title
        else:
            hdr.add_paragraph(title)


# ── Classe principale ─────────────────────────────────────────────────────────

class OfferGenerator:

    def __init__(self, llm: LLMGateway, llm_premium: LLMGateway | None = None):
        self._llm = llm
        # Modèle « premium » optionnel (Sonnet) pour une offre plus qualitative / à fort
        # impact ; activé via settings.offer_sections_model == "sonnet". None → toujours Haiku.
        self._llm_premium = llm_premium

    @staticmethod
    def build_filename(scoring: ScoringResult, client_name: str = "") -> str:
        """Nom du fichier généré : « Offre_Technique_<client>_<Mois>_<Année>.docx ».
        Les espaces du client deviennent des « _ » ; les caractères interdits en nom de
        fichier sont remplacés par « - »."""
        raw = client_name.strip() if client_name and client_name.strip() else "Client"
        safe_client = re.sub(r"\s+", "_", raw)
        safe_client = re.sub(r'[\\/:*?"<>|]', "-", safe_client)
        mois, annee = _cover_date_parts()
        return f"Offre_Technique_{safe_client}__{mois}_{annee}.docx"

    async def build_sections(self, scoring: ScoringResult, client_name: str = "") -> tuple[dict, str, str]:
        """Étape 1 : génère (LLM) les sections éditables, SANS produire le .docx.
        Retourne (sections, domaine, client_name enrichi)."""
        domain = _detect_domain(scoring)
        if not client_name or not client_name.strip():
            client_name = _extract_client_from_scoring(scoring)
        # Template « à variables » : on aligne le planning sur les activités RÉELLES du
        # tableau du modèle (J/H par activité) plutôt que sur des phases génériques.
        planning_activities = _planning_activities_for(domain)
        sections = await self._generate_sections(scoring, client_name, domain, planning_activities)
        return sections, domain, client_name

    def render(
        self,
        scoring: ScoringResult,
        sections: dict,
        client_name: str = "",
        selected_cvs: list[str] | None = None,
        selected_abes: list[str] | None = None,
    ) -> OfferDraft:
        """Étape 2 : produit le .docx à partir de `sections` (éventuellement éditées).

        `selected_cvs` / `selected_abes` : noms de fichiers GED choisis dans le modal.
        Les CV alimentent le tableau équipe ; les ABE une section « Références »."""
        domain = _detect_domain(scoring)
        template_path = _find_template(domain)
        if not template_path:
            raise FileNotFoundError(
                f"Aucun template trouvé pour le domaine '{domain}'. "
                "Déposez un .docx dans data/ged/offres-techniques/TEMPLATE/{domaine}/"
            )
        if not client_name or not client_name.strip():
            client_name = _extract_client_from_scoring(scoring)

        docx_bytes = self._fill_template(
            template_path, scoring, sections, client_name,
            selected_cvs or [], selected_abes or [],
        )
        filename = self.build_filename(scoring, client_name)
        logger.info("Offre rendue : %s  (domaine=%s)", filename, domain)
        return OfferDraft(
            filename=filename,
            content_docx=docx_bytes,
            ao_filename=scoring.ao_filename,
            sections=["Expression des besoins", "Objectifs", "Présentation réponse", "Modules", "Stack", "Équipe", "Planning"],
        )

    async def generate(
        self,
        scoring: ScoringResult,
        client_name: str = "",
        selected_cvs: list[str] | None = None,
        selected_abes: list[str] | None = None,
    ) -> OfferDraft:
        """Flux complet (1 passe) : sections IA puis rendu .docx. Conservé pour l'endpoint /generate."""
        sections, _domain, client = await self.build_sections(scoring, client_name)
        return self.render(scoring, sections, client, selected_cvs, selected_abes)

    # ── Génération LLM ────────────────────────────────────────────────────────

    async def _generate_sections(
        self, scoring: ScoringResult, client_name: str, domain: str,
        planning_activities: list[tuple[str, str]] | None = None,
    ) -> dict:
        delai = next(
            (e.value for e in scoring.key_elements
             if any(k in e.category.lower() for k in ("délai", "date", "remise"))),
            "non précisé",
        )
        budget = next(
            (e.value for e in scoring.key_elements
             if any(k in e.category.lower() for k in ("budget", "montant", "coût"))),
            "non précisé",
        )
        # Contexte ENRICHI : atouts, écarts, risques, critères, profils, signaux client,
        # références → matière pour une offre spécifique et différenciante (cf. _offer_user_context).
        user = _offer_user_context(scoring, client_name, domain, delai, budget)
        # Modèle de rédaction : Sonnet (offre + qualitative / à fort impact) si configuré ET
        # disponible, sinon Haiku (rapide, défaut). Le budget de sortie suit le modèle.
        use_premium = bool(self._llm_premium) and settings.offer_sections_model == "sonnet"
        gen_llm = self._llm_premium if use_premium else self._llm
        max_out = 8000 if use_premium else 6000
        try:
            raw = await gen_llm.generate(
                system=_build_sections_system(planning_activities),
                user=user, max_tokens=max_out, raise_on_truncation=True,
                temperature=0.7,  # rédaction de l'offre : créativité conservée
            )
        except OutputTruncatedError as exc:
            logger.error(
                "Sections d'offre TRONQUÉES au plafond de %d tokens — relève le budget si récurrent.",
                exc.max_tokens,
            )
            raw = exc.partial_text  # parse de RÉCUPÉRATION : on sauve la prose IA récupérable
        # Parse tolérant : récupération partielle plutôt que tout perdre (→ offre générique).
        data = _loads_offer_json(raw)
        warnings = _offer_quality_warnings(data)
        if warnings:
            logger.warning("Qualité sections d'offre (%s) — %s", domain, " ; ".join(warnings))

        client = client_name or "le client"
        ao_short = scoring.ao_filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ")

        # besoins est désormais list[ExtractedItem] → on travaille sur le texte
        besoins_txt = [b.texte for b in scoring.besoins] or ["Solution informatique"]
        fallback_modules = [
            {"titre": f"Module {i+1} — {b.split(':')[0] if ':' in b else b[:60]}",
             "description": b}
            for i, b in enumerate(besoins_txt[:6])
        ]

        # ── Planning ──────────────────────────────────────────────────────────
        # Template « à variables » : on a fourni au LLM la liste exacte des activités
        # → on reconstruit le planning aligné sur ces activités, J/H indexé par position.
        if planning_activities:
            jh_by_index: dict[int, str] = {}
            for it in (data.get("planning_jh") or []):
                if not isinstance(it, dict):
                    continue
                try:
                    idx = int(it.get("index"))
                except (TypeError, ValueError):
                    continue
                jh_by_index[idx] = "" if it.get("jh") is None else str(it.get("jh")).strip()
            planning = [
                {"phase": ph, "activite": act, "jh": jh_by_index.get(i, "")}
                for i, (ph, act) in enumerate(planning_activities, start=1)
            ]
        else:
            planning = data.get("planning") or [
                {"phase": "PREALABLE",        "activite": "Validation et réception bon de commande", "jh": ""},
                {"phase": "PLANIFICATION",     "activite": "Kick-off et validation chronogramme",     "jh": "3"},
                {"phase": "CADRAGE",           "activite": "Ateliers techniques et plan de recette",  "jh": "10"},
                {"phase": "IMPLEMENTATION",    "activite": "Développement et paramétrage",            "jh": "60"},
                {"phase": "FORMATION",         "activite": "Formation et transfert compétences",      "jh": "5"},
                {"phase": "VALIDATION DE LA RECETTE ET PERIODE D'OBSERVATION",
                                              "activite": "Recette et mise en production",            "jh": "5"},
                {"phase": "GESTION DE PROJET", "activite": "Coordination et reporting",               "jh": ""},
            ]

        # ── Répartition (tableau Fonctionnalité → Composant) ───────────────────
        feats = data.get("fonctionnalites") or besoins_txt[:6]
        raw_rep = data.get("repartition")
        if not raw_rep:
            raw_rep = [{"fonctionnalite": f, "composant": "Application"} for f in feats]
        repartition = [
            {"fonctionnalite": str(r.get("fonctionnalite", "")).strip(),
             "composant": str(r.get("composant", "")).strip()}
            for r in raw_rep if isinstance(r, dict) and str(r.get("fonctionnalite", "")).strip()
        ]

        return {
            "titre_projet": data.get("titre_projet") or f"Développement d'une solution — {ao_short}",
            "expression_besoins": data.get("expression_besoins") or [
                f"Dans le cadre de son développement, {client} sollicite Neurones Technologies "
                "pour la réalisation d'un projet informatique stratégique.",
                scoring.summary[:400] if scoring.summary else "Voir le détail de l'appel d'offres.",
                "Neurones Technologies s'engage à proposer une solution performante, sécurisée "
                "et parfaitement adaptée aux besoins exprimés.",
            ],
            "objectifs_reponse": data.get("objectifs_reponse") or [
                "Neurones Technologies a pour objectif de proposer une solution hautement "
                "performante répondant parfaitement au besoin exprimé.",
                "À la fin de ce projet, des livrables (documentation technique, plan de recette, "
                "manuel d'exploitation, rapport de déploiement et supports de formation) seront produits.",
                "Neurones Technologies s'engage à travailler en étroite collaboration avec les équipes "
                f"de {client} afin de garantir le succès du projet dans les délais et le budget impartis.",
            ],
            "presentation_reponse": data.get("presentation_reponse") or [
                f"Neurones Technologies propose une approche technologique moderne et durable, "
                f"conçue pour répondre aux besoins exprimés par {client}.",
                "Notre proposition repose sur une architecture robuste, interopérable et évolutive.",
                "Neurones Technologies s'engage à livrer une solution de qualité, dans les délais "
                "convenus et avec un accompagnement complet.",
            ],
            "fonctionnalites": data.get("fonctionnalites") or besoins_txt[:6] or [
                "Gestion des données et des utilisateurs",
                "Interfaces web et mobile",
                "Reporting et tableaux de bord",
                "Sécurité et authentification",
                "Administration et configuration",
            ],
            "modules": data.get("modules") or fallback_modules,
            "stack_technique": data.get("stack_technique") or _DEFAULT_STACKS.get(domain, _DEFAULT_STACKS["Digitalisation"]),
            "planning": planning,
            "repartition": repartition,
        }

    # ── Remplissage du template ───────────────────────────────────────────────

    def _fill_template(
        self,
        template_path: Path,
        scoring: ScoringResult,
        sections: dict,
        client_name: str,
        selected_cvs: list[str] | None = None,
        selected_abes: list[str] | None = None,
    ) -> bytes:
        """Ouvre le template et choisit le moteur de remplissage :
        - template « à variables » (présence de {{...}}) → substitution de placeholders ;
        - sinon → moteur legacy (noms + ancres de titres, comportement historique)."""
        doc = DocxDocument(str(template_path))
        if _placeholders_present(doc):
            return self._fill_placeholder_template(
                doc, scoring, sections, client_name, selected_cvs or [], selected_abes or [])
        return self._fill_legacy_template(
            doc, scoring, sections, client_name, selected_cvs or [], selected_abes or [])

    # ── Moteur « à variables » {{ }} ──────────────────────────────────────────

    def _fill_placeholder_template(
        self,
        doc: DocxDocument,
        scoring: ScoringResult,
        sections: dict,
        client_name: str,
        selected_cvs: list[str],
        selected_abes: list[str],
    ) -> bytes:
        real_client = client_name.strip() if client_name and client_name.strip() else "Neurones Technologies"
        titre = sections.get("titre_projet", "")
        mois, annee = _cover_date_parts()

        # 1. Placeholders simples (corps + en-têtes/pieds + zones de texte). Le nom du
        #    client et le titre sont substitués partout où ils apparaissent.
        simple = {
            _ph_norm(PH_TITRE): titre,
            _ph_norm(PH_CLIENT): real_client,
            _ph_norm(PH_MOIS): mois,
            _ph_norm(PH_ANNEE): annee,
        }
        for root in _all_text_roots(doc):
            _sub_simple_in_root(root, simple)
        # 1bis. Titre dans le header des sections au header propre encore vide.
        _ensure_header_title(doc, titre)

        # 2. Placeholders « liste » → un paragraphe par item (style du modèle cloné).
        #    La typo « besion » du modèle est tolérée (les deux clés sont acceptées).
        _expand_list_placeholder(
            doc, {_ph_norm(PH_BESOINS), _ph_norm(PH_BESOINS_TYPO)},
            sections.get("expression_besoins", []))
        _expand_list_placeholder(
            doc, {_ph_norm(PH_PROPOSITION)}, sections.get("presentation_reponse", []))
        _expand_list_placeholder(
            doc, {_ph_norm(PH_FONCTIONNALITES)}, sections.get("fonctionnalites", []))

        # 3. Répartition → tableau Fonctionnalité | Composant.
        _insert_repartition_at_placeholder(
            doc, {_ph_norm(PH_REPARTITION)}, sections.get("repartition", []))

        # 4. Tableau équipe : remplacé par les CV choisis (sinon laissé tel quel).
        if selected_cvs:
            _update_team_table_named(doc, _named_team_from_cvs(selected_cvs))

        # 5. Planning : J/H par activité (ordre figé du modèle) + recalcul du TOTAL.
        _update_planning_activities(doc, sections.get("planning", []))

        # 6. Annexes : CV / ABE choisis, intégrés en fin de document (pages PDF → images).
        ged_root = Path(settings.ged_path)
        cv_paths = _resolve_ged_files(selected_cvs, ged_root / "cvs")
        abe_paths = _resolve_ged_files(selected_abes, ged_root / "abe")
        logger.info(
            "Annexes offre — CV résolus=%d/%d, ABE résolus=%d/%d (ged=%s)",
            len(cv_paths), len(selected_cvs), len(abe_paths), len(selected_abes), ged_root,
        )
        _append_document_annexes(doc, cv_paths, abe_paths)

        buf = BytesIO()
        doc.save(buf)
        return buf.getvalue()

    # ── Moteur legacy (noms + ancres de titres) ───────────────────────────────

    def _fill_legacy_template(
        self,
        doc: DocxDocument,
        scoring: ScoringResult,
        sections: dict,
        client_name: str,
        selected_cvs: list[str] | None = None,
        selected_abes: list[str] | None = None,
    ) -> bytes:
        real_client = client_name.strip() if client_name and client_name.strip() else "Neurones Technologies"

        # Principe : la génération n'est JAMAIS bloquée. Quand le modèle ne permet
        # pas de remplir un élément (ancre absente), on laisse l'espace et on insère
        # une consigne : page de garde → bannière en haut ; section/tableau dont
        # l'emplacement est introuvable → annexe de fin (contenu généré reproduit).
        cover_todos: list[str] = []  # noqa: F841 — TODO: câbler annexe page de garde (feature WIP)
        missing_sections: list[tuple[str, list[str]]] = []
        missing_desc: tuple[list[str], list[dict]] | None = None
        missing_tables: list[tuple[str, list[str]]] = []

        # ── 1. Remplacer les noms legacy dans tout le corps ───────────────────
        sum(_replace_all_body(doc, legacy, real_client) for legacy in _LEGACY_NAMES)

        # ── 2. Page de garde : text boxes → nom client, titre, date ──────────
        sum(_replace_in_cover_textboxes(doc, legacy, real_client) for legacy in _LEGACY_NAMES)
        _update_txbx_title(doc, sections["titre_projet"])
        _update_txbx_date(doc)

        # ── 2bis. En-têtes : titre projet (parties header*.xml, hors corps) ──
        _update_header_title(doc, sections["titre_projet"])

        # ── 3. EXPRESSION DES BESOINS ─────────────────────────────────────────
        _clear_section(doc, H_BESOINS, H_OBJECTIFS)
        if not _insert_after_heading(doc, H_BESOINS, sections["expression_besoins"]):
            missing_sections.append((H_BESOINS, sections["expression_besoins"]))

        # ── 4. OBJECTIFS DE NEURONES TECHNOLOGIES ────────────────────────────
        _clear_section(doc, H_OBJECTIFS, H_PRESENTATION)
        if not _insert_after_heading(doc, H_OBJECTIFS, sections["objectifs_reponse"]):
            missing_sections.append((H_OBJECTIFS, sections["objectifs_reponse"]))

        # ── 5. PRESENTATION DE LA REPONSE ────────────────────────────────────
        _clear_section(doc, H_PRESENTATION, H_DESCRIPTION)
        if not _insert_after_heading(doc, H_PRESENTATION, sections["presentation_reponse"]):
            missing_sections.append((H_PRESENTATION, sections["presentation_reponse"]))

        # ── 6. Description détaillée : SUPPRIMER tout le bloc KORAZ ──────────
        # Supprime tout de P174 → P449 (Fonctionnalités KORAZ, CORS API, APP WEB/MOBILE, etc.)
        # puis insère fonctionnalités + modules dans le bon ordre
        _clear_section(doc, H_DESCRIPTION, H_METHODOLOGIE)
        if not _fill_description_section(doc, sections["fonctionnalites"], sections["modules"]):
            missing_desc = (sections["fonctionnalites"], sections["modules"])  # noqa: F841 — TODO: câbler annexe description (feature WIP)

        # ── 7. TABLE 0 : composants techniques (UPDATE en place) ──────────────
        if not _update_tech_table(doc, sections["stack_technique"]):
            missing_tables.append((
                "Tableau des composants techniques",
                [f"{i.get('composant', '')} — {i.get('version', '')}" for i in sections["stack_technique"]],
            ))

        # ── 8. TABLE 1 : équipe (rebuild data rows) ───────────────────────────
        team_rows = self._build_team_rows(scoring, selected_cvs)
        if not _update_team_table(doc, team_rows):
            missing_tables.append((
                "Tableau de l'équipe projet",
                [" — ".join(str(c) for c in r) for r in team_rows],
            ))

        # ── 9. TABLE dernière : planning (UPDATE J/H en place) ────────────────
        if not _update_planning_table(doc, sections["planning"]):
            missing_tables.append((
                "Planning du projet (J/H)",
                [f"{i.get('phase', '')} — {i.get('activite', '')} — {i.get('jh', '')} J/H"
                 for i in sections["planning"]],
            ))

        # ── 9bis. ANNEXES : CV et ABE choisis, intégrés au document (pages PDF
        #          rendues en images pleine page). Les CV alimentent aussi le
        #          tableau équipe (étape 8) ; ici on joint les documents complets.
        ged_root = Path(settings.ged_path)
        cv_paths = _resolve_ged_files(selected_cvs or [], ged_root / "cvs")
        abe_paths = _resolve_ged_files(selected_abes or [], ged_root / "abe")
        logger.info(
            "Annexes offre — CV résolus=%d/%d, ABE résolus=%d/%d (ged=%s)",
            len(cv_paths), len(selected_cvs or []),
            len(abe_paths), len(selected_abes or []), ged_root,
        )
        _append_document_annexes(doc, cv_paths, abe_paths)

        # ── 10. Bannières « à compléter » DÉSACTIVÉES (sur demande) : ni bannière
        #         « PAGE DE GARDE À COMPLÉTER » en haut, ni annexe de fin
        #         « ÉLÉMENTS À INTÉGRER MANUELLEMENT » / marques ⟦À COMPLÉTER⟧.
        #         (cover_todos / missing_* restent calculés mais ne sont plus rendus.)

        buf = BytesIO()
        doc.save(buf)
        return buf.getvalue()

    @staticmethod
    def _build_team_rows(scoring: ScoringResult, selected_cvs: list[str] | None = None) -> list[list[str]]:
        # Priorité aux CV choisis explicitement dans le modal ; à défaut, repli sur
        # les CV matchés automatiquement pendant le scoring (comportement historique).
        if selected_cvs:
            cv_names = [_clean_person_name(f) for f in selected_cvs]
        else:
            cv_names = [
                _clean_person_name(m.filename)
                for m in scoring.matched_documents
                if "cv" in m.doc_type.lower() or "cv" in m.filename.lower()
            ]
        if cv_names:
            rows: list[list[str]] = [["Chef de Projet", "Coordination et pilotage du projet"]]
            for name in cv_names[:4]:
                rows.append([name.strip().title(), "Consultant / Développeur Senior"])
            return rows
        return [
            ["Chef de Projet",          "Coordination et pilotage du projet"],
            ["Expert Technique Senior", "Architecture et développement"],
            ["Développeur Senior",      "Implémentation et intégration"],
            ["Ingénieur QA / Recette",  "Tests, validation et documentation"],
        ]
