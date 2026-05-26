"""
OfferGenerator v7 — Basé sur l'analyse du template et de l'exemple IIPS.

Zones remplies :
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

import json
import logging
import unicodedata
from datetime import datetime
from io import BytesIO
from pathlib import Path

from docx import Document as DocxDocument
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import RGBColor

from core.ports.llm_gateway import LLMGateway
from core.domain.offer import ScoringResult, OfferDraft
from config.settings import settings
from modules.uc10_presales.scoring_pipeline import _clean_json

logger = logging.getLogger(__name__)

# ── Constantes ────────────────────────────────────────────────────────────────

_LEGACY_NAMES = [
    "BGFI BANK", "BGFI", "KORAZ PARTNERS", "KORAZ PARTNER", "KORAZ", "SOCOPRIM",
]

_LEGACY_TITLE_KEYWORDS = [
    "ticket restaurant", "solution de ticket", "gestion de ticket",
    "application de ticket", "conception d",
]

_DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "Digitalisation": [
        "application", "mobile", "web", "digital", "plateforme", "logiciel",
        "développement", "saas", "api", "portail", "erp", "crm", "applicatif",
        "progiciel", "solution informatique",
    ],
    "Infrastructure": [
        "réseau", "infrastructure", "serveur", "switch", "routeur", "lan",
        "wan", "data center", "équipement", "fibre", "câblage",
    ],
    "Cybersécurité": [
        "sécurité", "cybersécurité", "firewall", "siem", "soc", "pentest",
        "audit sécurité",
    ],
    "Cloud": [
        "cloud", "aws", "azure", "gcp", "migration cloud", "hébergement",
        "virtualisation",
    ],
}

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


# ── LLM prompt ────────────────────────────────────────────────────────────────

_SECTIONS_SYSTEM = """\
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

Règles :
- titre_projet : 6-12 mots, verbe d'action obligatoire en début
- expression_besoins : exactement 3 items, nom du client dans §1
- objectifs_reponse : exactement 3 items, perspective Neurones Technologies
- presentation_reponse : exactement 3 items
- fonctionnalites : 5 à 8 items, une fonctionnalité par item (phrase courte)
- modules : 4 à 8 modules, chaque module = 1 composant fonctionnel distinct
- stack_technique : 4 à 8 items, technologies réelles adaptées au projet
- planning : utiliser EXACTEMENT ces noms de phases (correspondent aux lignes existantes du tableau) :
  PREALABLE, PLANIFICATION, CADRAGE, IMPLEMENTATION, FORMATION,
  "VALIDATION DE LA RECETTE ET PERIODE D'OBSERVATION", GESTION DE PROJET
  Ne créer UNE SEULE activité par phase. Estimer les J/H selon la complexité de l'AO.\
"""


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


def _replace_runs(para, old: str, new: str) -> None:
    """Remplace old→new dans les runs d'un paragraphe (gère split-run)."""
    if old not in para.text:
        return
    # Tentative run direct
    for run in para.runs:
        if old in run.text:
            run.text = run.text.replace(old, new)
            return
    # Fallback split-run : recomposer
    full = para.text.replace(old, new)
    for run in para.runs:
        run.text = ""
    if para.runs:
        para.runs[0].text = full


def _replace_all_body(doc: DocxDocument, old: str, new: str) -> None:
    """Remplace old→new dans tous les paragraphes du corps et des cellules."""
    for p in doc.paragraphs:
        _replace_runs(p, old, new)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    _replace_runs(p, old, new)


# ── Text boxes ────────────────────────────────────────────────────────────────

def _replace_in_cover_textboxes(doc: DocxDocument, old: str, new: str) -> None:
    """Remplace old→new dans les 12 premières text boxes (page de garde uniquement)."""
    body = doc.element.body
    count = 0
    for txbx in body.findall(".//" + qn("w:txbxContent")):
        for p_elem in txbx.findall(qn("w:p")):
            t_elems = p_elem.findall(".//" + qn("w:t"))
            full = "".join(t.text or "" for t in t_elems)
            if old in full:
                t_elems[0].text = full.replace(old, new)
                for t in t_elems[1:]:
                    t.text = ""
        count += 1
        if count >= 12:
            break


def _update_txbx_title(doc: DocxDocument, new_title: str) -> None:
    """Remplace le titre legacy dans les text boxes de couverture."""
    body = doc.element.body
    for txbx in body.findall(".//" + qn("w:txbxContent")):
        for p_elem in txbx.findall(qn("w:p")):
            t_elems = p_elem.findall(".//" + qn("w:t"))
            full = "".join(t.text or "" for t in t_elems)
            if any(kw in _norm(full) for kw in _LEGACY_TITLE_KEYWORDS):
                if t_elems:
                    t_elems[0].text = new_title
                    for t in t_elems[1:]:
                        t.text = ""
                return


def _update_txbx_date(doc: DocxDocument) -> None:
    """Met à jour la date dans les text boxes de couverture."""
    months_fr = {
        1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
        5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
        9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
    }
    now = datetime.now()
    new_date = f"{months_fr[now.month]}  {now.year}"
    all_months = list(months_fr.values()) + [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    body = doc.element.body
    for txbx in body.findall(".//" + qn("w:txbxContent")):
        for p_elem in txbx.findall(qn("w:p")):
            t_elems = p_elem.findall(".//" + qn("w:t"))
            full = "".join(t.text or "" for t in t_elems)
            if any(m in full for m in all_months) and any(str(y) in full for y in range(2020, 2030)):
                if t_elems:
                    t_elems[0].text = new_date
                    for t in t_elems[1:]:
                        t.text = ""
                return


# ── Sections (heading-based) ──────────────────────────────────────────────────

def _find_heading_idx(paras: list, fragment: str) -> int | None:
    """Trouve l'index du premier heading dont le texte normalisé contient fragment."""
    frag = _norm(fragment)
    return next(
        (i for i, p in enumerate(paras)
         if p.style.name.startswith("Heading") and frag in _norm(p.text)),
        None,
    )


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
        end_frag = _norm(end_heading)
        n_idx = next(
            (i for i in range(h_idx + 1, len(paras))
             if paras[i].style.name.startswith("Heading") and end_frag in _norm(paras[i].text)),
            len(paras),
        )
    else:
        n_idx = next(
            (i for i in range(h_idx + 1, len(paras))
             if paras[i].style.name.startswith("Heading")),
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
    h_idx = _find_heading_idx(paras, "Description détaillée de la solution proposée")
    if h_idx is None:
        h_idx = _find_heading_idx(paras, "Fonctionnalités de l")
        if h_idx is None:
            logger.warning("Heading 'Description détaillée' non trouvé")
            return False

    anchor = paras[h_idx]._element
    body_style = doc.styles.get("Body Text") or doc.styles["Normal"]
    list_style = doc.styles.get("List Paragraph") or doc.styles["Normal"]
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

def _update_tech_table(doc: DocxDocument, stack: list[dict]) -> None:
    """
    Met à jour TABLE 0 (composants/prérequis) EN PLACE.
    - Lignes 1 à N_DATA : mises à jour avec notre stack (sans toucher à la structure merged)
    - Lignes restantes jusqu'à la ligne serveur web (Row 6) : laissées intactes
    """
    if not doc.tables:
        return
    table = doc.tables[0]
    rows = table.rows

    # Lignes 1-5 sont les composants logiciels (GoLang, SQL Server, Oracle, Ubuntu, LB)
    # On remplace leur contenu par notre stack
    data_rows_count = min(5, len(rows) - 1)  # max 5 lignes data (rows 1-5)
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

def _update_team_table(doc: DocxDocument, rows_data: list[list[str]]) -> None:
    """Met à jour la table équipe (TABLE 1) en conservant l'en-tête."""
    if len(doc.tables) < 2:
        return
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


# ── TABLE dernière : planning ─────────────────────────────────────────────────

def _update_planning_table(doc: DocxDocument, planning_items: list[dict]) -> None:
    """
    Met à jour le planning EN PLACE (preserve gridSpan/vMerge).
    - Cherche chaque phase dans les lignes en-tête (lignes complètes fusionnées)
    - Met à jour les J/H dans la colonne droite des lignes d'activités
    - Met à jour le TOTAL
    """
    if not doc.tables:
        return
    table = doc.tables[-1]
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
        last_text = cells[n_cols - 1].text.strip() if n_cols > 1 else ""

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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _detect_domain(scoring: ScoringResult) -> str:
    text = (scoring.summary + " " + " ".join(e.value for e in scoring.key_elements)).lower()
    best = max(_DOMAIN_KEYWORDS, key=lambda d: sum(1 for kw in _DOMAIN_KEYWORDS[d] if kw in text))
    if not any(kw in text for kw in _DOMAIN_KEYWORDS[best]):
        return "Digitalisation"
    return best


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


def _extract_client_from_scoring(scoring: ScoringResult) -> str:
    """Tente d'extraire le nom du client depuis les key_elements."""
    for e in scoring.key_elements:
        if any(k in e.category.lower() for k in ("client", "commanditaire", "maître", "donneur")):
            v = e.value.strip()
            if v and v.lower() not in ("non précisé", "inconnu", ""):
                return v
    return ""


# ── Classe principale ─────────────────────────────────────────────────────────

class OfferGenerator:

    def __init__(self, llm: LLMGateway):
        self._llm = llm

    async def generate(self, scoring: ScoringResult, client_name: str = "") -> OfferDraft:
        domain = _detect_domain(scoring)
        template_path = _find_template(domain)
        if not template_path:
            raise FileNotFoundError(
                f"Aucun template trouvé pour le domaine '{domain}'. "
                "Déposez un .docx dans data/ged/offres-techniques/TEMPLATE/{domaine}/"
            )

        # Enrichir le nom client si non fourni
        if not client_name or not client_name.strip():
            client_name = _extract_client_from_scoring(scoring)

        sections = await self._generate_sections(scoring, client_name, domain)
        docx_bytes = self._fill_template(template_path, scoring, sections, client_name)

        safe_client = (client_name or "Client").replace("/", "-").replace("\\", "-")
        filename = (
            f"Offre-Technique_{safe_client}_"
            f"{scoring.ao_filename.rsplit('.', 1)[0]}.docx"
        )
        logger.info("Offre générée : %s  (domaine=%s)", filename, domain)
        return OfferDraft(
            filename=filename,
            content_docx=docx_bytes,
            ao_filename=scoring.ao_filename,
            sections=["Expression des besoins", "Objectifs", "Présentation réponse", "Modules", "Stack", "Équipe", "Planning"],
        )

    # ── Génération LLM ────────────────────────────────────────────────────────

    async def _generate_sections(self, scoring: ScoringResult, client_name: str, domain: str) -> dict:
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
        user = (
            f"AO : {scoring.ao_filename}\n"
            f"Client : {client_name or 'Non précisé'}\n"
            f"Domaine : {domain}\n"
            f"Délai de livraison : {delai}\n"
            f"Budget estimé : {budget}\n"
            f"Résumé AO :\n{scoring.summary[:600]}\n\n"
            f"Besoins identifiés :\n"
            + "\n".join(f"- {b}" for b in scoring.besoins[:12])
            + "\n\nRessources demandées :\n"
            + "\n".join(f"- {r}" for r in scoring.ressources_demandees[:6])
        )
        raw = await self._llm.generate(system=_SECTIONS_SYSTEM, user=user, max_tokens=3000)
        try:
            data = json.loads(_clean_json(raw))
        except Exception as exc:
            logger.warning("JSON sections parse failed (%s) — fallback", exc)
            data = {}

        client = client_name or "le client"
        ao_short = scoring.ao_filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ")

        fallback_modules = [
            {"titre": f"Module {i+1} — {b.split(':')[0] if ':' in b else b[:60]}",
             "description": b}
            for i, b in enumerate((scoring.besoins or ["Solution informatique"])[:6])
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
            "fonctionnalites": data.get("fonctionnalites") or scoring.besoins[:6] or [
                "Gestion des données et des utilisateurs",
                "Interfaces web et mobile",
                "Reporting et tableaux de bord",
                "Sécurité et authentification",
                "Administration et configuration",
            ],
            "modules": data.get("modules") or fallback_modules,
            "stack_technique": data.get("stack_technique") or _DEFAULT_STACKS.get(domain, _DEFAULT_STACKS["Digitalisation"]),
            "planning": data.get("planning") or [
                {"phase": "PREALABLE",        "activite": "Validation et réception bon de commande", "jh": ""},
                {"phase": "PLANIFICATION",     "activite": "Kick-off et validation chronogramme",     "jh": "3"},
                {"phase": "CADRAGE",           "activite": "Ateliers techniques et plan de recette",  "jh": "10"},
                {"phase": "IMPLEMENTATION",    "activite": "Développement et paramétrage",            "jh": "60"},
                {"phase": "FORMATION",         "activite": "Formation et transfert compétences",      "jh": "5"},
                {"phase": "VALIDATION DE LA RECETTE ET PERIODE D'OBSERVATION",
                                              "activite": "Recette et mise en production",            "jh": "5"},
                {"phase": "GESTION DE PROJET", "activite": "Coordination et reporting",               "jh": ""},
            ],
        }

    # ── Remplissage du template ───────────────────────────────────────────────

    def _fill_template(self, template_path: Path, scoring: ScoringResult, sections: dict, client_name: str) -> bytes:
        doc = DocxDocument(str(template_path))
        real_client = client_name.strip() if client_name and client_name.strip() else "Neurones Technologies"

        # ── 1. Remplacer les noms legacy dans tout le corps ───────────────────
        for legacy in _LEGACY_NAMES:
            _replace_all_body(doc, legacy, real_client)

        # ── 2. Page de garde : text boxes → nom client, titre, date ──────────
        for legacy in _LEGACY_NAMES:
            _replace_in_cover_textboxes(doc, legacy, real_client)
        _update_txbx_title(doc, sections["titre_projet"])
        _update_txbx_date(doc)

        # ── 3. EXPRESSION DES BESOINS ─────────────────────────────────────────
        _clear_section(doc, "EXPRESSION DES BESOINS", "OBJECTIFS DE NEURONES TECHNOLOGIES")
        _insert_after_heading(doc, "EXPRESSION DES BESOINS", sections["expression_besoins"])

        # ── 4. OBJECTIFS DE NEURONES TECHNOLOGIES ────────────────────────────
        _clear_section(doc, "OBJECTIFS DE NEURONES TECHNOLOGIES", "PRESENTATION DE LA REPONSE")
        _insert_after_heading(doc, "OBJECTIFS DE NEURONES TECHNOLOGIES", sections["objectifs_reponse"])

        # ── 5. PRESENTATION DE LA REPONSE ────────────────────────────────────
        _clear_section(
            doc,
            "PRESENTATION DE LA REPONSE DE NEURONES TECHNOLOGIES",
            "Description détaillée de la solution proposée",
        )
        _insert_after_heading(
            doc,
            "PRESENTATION DE LA REPONSE DE NEURONES TECHNOLOGIES",
            sections["presentation_reponse"],
        )

        # ── 6. Description détaillée : SUPPRIMER tout le bloc KORAZ ──────────
        # Supprime tout de P174 → P449 (Fonctionnalités KORAZ, CORS API, APP WEB/MOBILE, etc.)
        # puis insère fonctionnalités + modules dans le bon ordre
        _clear_section(
            doc,
            "Description détaillée de la solution proposée",
            "MÉTHODOLOGIE DE TRAVAIL ET DESCRIPTION DES SERVICES",
        )
        _fill_description_section(doc, sections["fonctionnalites"], sections["modules"])

        # ── 7. TABLE 0 : composants techniques (UPDATE en place) ──────────────
        _update_tech_table(doc, sections["stack_technique"])

        # ── 8. TABLE 1 : équipe (rebuild data rows) ───────────────────────────
        team_rows = self._build_team_rows(scoring)
        _update_team_table(doc, team_rows)

        # ── 9. TABLE dernière : planning (UPDATE J/H en place) ────────────────
        _update_planning_table(doc, sections["planning"])

        buf = BytesIO()
        doc.save(buf)
        return buf.getvalue()

    @staticmethod
    def _build_team_rows(scoring: ScoringResult) -> list[list[str]]:
        cv_names = [
            m.filename.rsplit(".", 1)[0].replace("CV_", "").replace("cv_", "").replace("_", " ")
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
