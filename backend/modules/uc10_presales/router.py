import json
import logging
import re
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from fastapi.responses import Response

from modules.uc10_presales.schemas import (
    ScoringResultSchema, OfferGenerationRequest, OfferGenerationResponse,
    KeyElementSchema, MatchedDocumentSchema, BidRecommendationSchema,
    BidStrategyRequest, BidStrategyResponse, AnalysisExportRequest,
    StrategyExportRequest, ChecklistExportRequest,
    TeamMatchRequest, TeamMatchResponse,
)
from modules.uc10_presales.use_case import PresalesUseCase
from core.domain.offer import ScoringResult

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/presales", tags=["UC10 - Pre-Sales"])

_ALLOWED_TYPES = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
_DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _get_use_case(request: Request) -> PresalesUseCase:
    container = request.app.state.container
    return PresalesUseCase(
        llm_haiku=container.llm_haiku,
        llm_sonnet=container.llm_sonnet,
        rag_engine=container.rag_engine,
        pdf_parser=container.pdf_parser,
        docx_parser=container.docx_parser,
    )


@router.post("/score", response_model=ScoringResultSchema)
async def score_ao(
    request: Request,
    file: UploadFile = File(..., description="AO en PDF ou Word"),
):
    """Upload un AO et lance le pipeline de scoring en 5 étapes."""
    logger.info("Score AO reçu — fichier=%s content_type=%s", file.filename, file.content_type)
    if file.content_type not in _ALLOWED_TYPES and not file.filename.endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez PDF ou DOCX.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10 MB).")

    use_case = _get_use_case(request)
    try:
        result = await use_case.score_ao(filename=file.filename, file_bytes=file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Erreur pipeline scoring AO '%s'", file.filename)
        raise HTTPException(status_code=500, detail=f"Erreur analyse AO : {type(e).__name__}: {e}")

    return _to_schema(result)


@router.post("/generate")
async def generate_offer(body: OfferGenerationRequest, request: Request):
    """Génère une offre technique Word à partir du résultat de scoring."""
    use_case = _get_use_case(request)
    scoring = _from_schema(body.scoring_result)
    draft = await use_case.generate_offer(
        scoring=scoring,
        client_name=body.client_name or "",
    )
    return Response(
        content=draft.content_docx,
        media_type=_DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{draft.filename}"'},
    )


@router.post("/bid-strategy", response_model=BidStrategyResponse)
async def bid_strategy(body: BidStrategyRequest, request: Request):
    """Génère une stratégie de réponse et chronogramme pour un AO."""
    use_case = _get_use_case(request)
    scoring = _from_schema(body.scoring_result)
    try:
        result = await use_case.generate_bid_strategy(
            scoring=scoring,
            client_name=body.client_name or "",
            decision=body.decision,
            decision_reason=body.decision_reason or "",
        )
        return BidStrategyResponse(**result)
    except Exception as e:
        logger.exception("Bid strategy generation failed")
        raise HTTPException(status_code=500, detail=str(e))


def _docx_helpers(doc):
    """Retourne les helpers de mise en forme partagés entre les deux exports."""
    from docx.shared import Pt, RGBColor, Cm
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    C_NAVY  = RGBColor(0x0F, 0x29, 0x5A)
    C_BLUE  = RGBColor(0x1E, 0x40, 0xAF)
    C_GREEN = RGBColor(0x15, 0x80, 0x3D)
    C_RED   = RGBColor(0xB9, 0x1C, 0x1C)
    C_AMBER = RGBColor(0x92, 0x40, 0x0E)
    C_GRAY  = RGBColor(0x64, 0x74, 0x8B)
    C_WHITE = RGBColor(0xFF, 0xFF, 0xFF)
    C_TEXT  = RGBColor(0x1E, 0x29, 0x3B)

    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    def _cell_bg(cell, hex_color: str):
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), hex_color)
        tcPr.append(shd)

    def _cell_style(cell, font_size=10, bold=False, color=None, bg=None):
        if bg:
            _cell_bg(cell, bg)
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.size = Pt(font_size)
                if bold:
                    run.bold = True
                if color:
                    run.font.color.rgb = color

    def _section_title(text: str, color: RGBColor = None, num: str = ""):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(5)
        run = p.add_run((f"{num}. " if num else "") + text.upper())
        run.bold = True
        run.font.size = Pt(11)
        run.font.color.rgb = color or C_BLUE
        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), "1")
        bottom.set(qn("w:color"), "1E40AF")
        pBdr.append(bottom)
        pPr.append(pBdr)
        return p

    def _bullet(text: str, color: RGBColor = None):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.6)
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        b = p.add_run("▸  ")
        b.font.color.rgb = color or C_BLUE
        b.font.size = Pt(9)
        r = p.add_run(text.strip())
        r.font.size = Pt(10)
        r.font.color.rgb = C_TEXT
        return p

    def _body_para(text: str, justify=True):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(5)
        if justify:
            p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r = p.add_run(text.strip())
        r.font.size = Pt(10)
        r.font.color.rgb = C_TEXT
        return p

    def _render_rich_text(text: str):
        """Convertit du texte avec markdown basique en paragraphes Word bien formatés."""
        paragraphs = re.split(r"\n{2,}", text.strip())
        for block in paragraphs:
            lines = [l.strip() for l in block.split("\n") if l.strip()]
            for line in lines:
                # Puce markdown ou tiret
                if re.match(r"^[-•*]\s+", line):
                    content = re.sub(r"^[-•*]\s+", "", line)
                    _bullet(_strip_bold(content))
                # Liste numérotée
                elif re.match(r"^\d+[.)]\s+", line):
                    content = re.sub(r"^\d+[.)]\s+", "", line)
                    p = doc.add_paragraph()
                    p.paragraph_format.left_indent = Cm(0.6)
                    p.paragraph_format.space_after = Pt(3)
                    m = re.match(r"^(\d+)", line)
                    num_r = p.add_run(f"{m.group(1)}.  ")
                    num_r.font.color.rgb = C_BLUE
                    num_r.bold = True
                    num_r.font.size = Pt(9)
                    txt_r = p.add_run(_strip_bold(content))
                    txt_r.font.size = Pt(10)
                    txt_r.font.color.rgb = C_TEXT
                # Ligne courte en majuscules = sous-titre implicite
                elif line.isupper() and len(line) < 80:
                    p = doc.add_paragraph()
                    p.paragraph_format.space_before = Pt(8)
                    p.paragraph_format.space_after = Pt(3)
                    r = p.add_run(line)
                    r.bold = True
                    r.font.size = Pt(10)
                    r.font.color.rgb = C_NAVY
                else:
                    # Paragraphe avec gras inline **...**
                    p = doc.add_paragraph()
                    p.paragraph_format.space_after = Pt(5)
                    p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                    parts = re.split(r"\*\*(.+?)\*\*", line)
                    for idx, part in enumerate(parts):
                        if not part:
                            continue
                        r = p.add_run(part)
                        r.font.size = Pt(10)
                        r.font.color.rgb = C_TEXT
                        if idx % 2 == 1:
                            r.bold = True

    def _strip_bold(text: str) -> str:
        return re.sub(r"\*\*(.+?)\*\*", r"\1", text)

    def _cover_table(rows_data: list[tuple], col_widths=(Cm(5.5), Cm(10.5))):
        t = doc.add_table(rows=len(rows_data), cols=2)
        t.style = "Table Grid"
        for i, (label, value) in enumerate(rows_data):
            row = t.rows[i]
            row.cells[0].text = label
            row.cells[1].text = value
            _cell_bg(row.cells[0], "0F295A")
            _cell_bg(row.cells[1], "EFF6FF" if i % 2 == 0 else "F8FAFC")
            for para in row.cells[0].paragraphs:
                for run in para.runs:
                    run.font.color.rgb = C_WHITE
                    run.font.size = Pt(10)
                    run.bold = True
            for para in row.cells[1].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(10)
                    run.font.color.rgb = C_TEXT
            row.cells[0].width = col_widths[0]
            row.cells[1].width = col_widths[1]
        return t

    def _footer_line():
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(20)
        p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(f"Neurones Technologies CI  ·  Document confidentiel  ·  Généré le {datetime.now().strftime('%d/%m/%Y')}")
        r.font.size = Pt(8)
        r.font.color.rgb = C_GRAY
        r.italic = True

    return dict(
        C_NAVY=C_NAVY, C_BLUE=C_BLUE, C_GREEN=C_GREEN,
        C_RED=C_RED, C_AMBER=C_AMBER, C_GRAY=C_GRAY,
        C_WHITE=C_WHITE, C_TEXT=C_TEXT,
        cell_bg=_cell_bg, cell_style=_cell_style,
        section_title=_section_title, bullet=_bullet,
        body_para=_body_para, render_rich_text=_render_rich_text,
        cover_table=_cover_table, footer_line=_footer_line,
        Pt=Pt, RGBColor=RGBColor, Cm=Cm,
        WD_ALIGN_PARAGRAPH=WD_ALIGN_PARAGRAPH,
    )


@router.post("/export-analysis")
async def export_analysis(body: AnalysisExportRequest, request: Request):
    """Exporte l'analyse complète de l'AO en document Word professionnel."""
    from docx import Document as DocxDocument

    scoring = _from_schema(body.scoring_result)
    client_name = body.client_name or "Non précisé"
    doc = DocxDocument()
    h = _docx_helpers(doc)
    Pt = h["Pt"]; RGBColor = h["RGBColor"]; Cm = h["Cm"]
    WD = h["WD_ALIGN_PARAGRAPH"]

    # ── PAGE DE COUVERTURE ────────────────────────────────────────────────────
    title_p = doc.add_paragraph()
    title_p.alignment = WD.CENTER
    title_p.paragraph_format.space_before = Pt(30)
    title_p.paragraph_format.space_after = Pt(2)
    tr = title_p.add_run("ANALYSE")
    tr.bold = True; tr.font.size = Pt(32); tr.font.color.rgb = h["C_NAVY"]

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD.CENTER
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(4)
    sr = sub_p.add_run("APPEL D'OFFRES")
    sr.bold = True; sr.font.size = Pt(20); sr.font.color.rgb = h["C_BLUE"]

    sep = doc.add_paragraph()
    sep.alignment = WD.CENTER
    sep.paragraph_format.space_after = Pt(30)
    sep.add_run("─" * 45).font.color.rgb = h["C_BLUE"]

    h["cover_table"]([
        ("Appel d'offres", scoring.ao_filename),
        ("Client / Commanditaire", client_name),
        ("Date d'analyse", datetime.now().strftime("%d %B %Y")),
        ("Statut document", "Analyse AO — Confidentiel"),
    ])

    doc.add_page_break()

    # ── 1. RÉSUMÉ EXÉCUTIF ────────────────────────────────────────────────────
    h["section_title"]("Résumé exécutif", num="1")
    if scoring.summary:
        h["body_para"](scoring.summary)

    # ── 2. POINTS CLÉS ───────────────────────────────────────────────────────
    if scoring.key_elements:
        h["section_title"]("Points clés identifiés par l'IA", num="2")
        from docx.enum.table import WD_TABLE_ALIGNMENT
        kp_t = doc.add_table(rows=1, cols=2)
        kp_t.style = "Table Grid"
        for cell, lbl in zip(kp_t.rows[0].cells, ["Critère", "Valeur"]):
            cell.text = lbl
            h["cell_bg"](cell, "1E40AF")
            for para in cell.paragraphs:
                for run in para.runs:
                    run.bold = True; run.font.color.rgb = h["C_WHITE"]; run.font.size = Pt(10)
        for i, el in enumerate(scoring.key_elements):
            row = kp_t.add_row().cells
            row[0].text = el.category
            row[1].text = el.value
            h["cell_bg"](row[0], "EFF6FF" if i % 2 == 0 else "FFFFFF")
            h["cell_bg"](row[1], "F8FAFC" if i % 2 == 0 else "FFFFFF")
            for cell in row:
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(10)
            if row[0].paragraphs[0].runs:
                row[0].paragraphs[0].runs[0].bold = True
            row[0].width = Cm(6); row[1].width = Cm(10)
        doc.add_paragraph("")

    # ── 3-7. SECTIONS DOSSIER ─────────────────────────────────────────────────
    sections = [
        ("Critères de sélection", scoring.criteres_selection, "3", h["C_BLUE"]),
        ("Besoins identifiés", scoring.besoins, "4", h["C_BLUE"]),
        ("Prérequis", scoring.prerequis, "5", h["C_NAVY"]),
        ("Ressources demandées", scoring.ressources_demandees, "6", h["C_NAVY"]),
        ("Points de vigilance", scoring.points_vigilance, "7", h["C_AMBER"]),
    ]
    for title, items, num, color in sections:
        if items:
            h["section_title"](title, color=color, num=num)
            for item in items:
                h["bullet"](item, color)
            doc.add_paragraph("")

    h["footer_line"]()
    buffer = BytesIO()
    doc.save(buffer)
    safe_name = re.sub(r"\.(pdf|docx)$", "", scoring.ao_filename, flags=re.IGNORECASE).replace(" ", "-")
    return Response(
        content=buffer.getvalue(), media_type=_DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="Analyse-AO_{safe_name}.docx"'},
    )


@router.post("/export-scoring")
async def export_scoring(body: AnalysisExportRequest, request: Request):
    """Exporte le scoring & positionnement (Step 2) : score, forces, risques, écarts, docs GED."""
    from docx import Document as DocxDocument

    scoring = _from_schema(body.scoring_result)
    client_name = body.client_name or "Non précisé"
    doc = DocxDocument()
    h = _docx_helpers(doc)
    Pt = h["Pt"]; RGBColor = h["RGBColor"]; Cm = h["Cm"]
    WD = h["WD_ALIGN_PARAGRAPH"]

    score_color = h["C_GREEN"] if scoring.score >= 70 else (h["C_AMBER"] if scoring.score >= 40 else h["C_RED"])
    rec_map = {
        "GO": ("GO — Répondre à l'AO", h["C_GREEN"]),
        "CONDITIONAL": ("CONDITIONNEL — Sous réserve", h["C_AMBER"]),
        "NO_BID": ("NO-BID — Ne pas répondre", h["C_RED"]),
    }
    rec_label, rec_color = rec_map.get(scoring.recommendation.value, ("—", h["C_AMBER"]))

    # ── PAGE DE COUVERTURE ────────────────────────────────────────────────────
    title_p = doc.add_paragraph()
    title_p.alignment = WD.CENTER
    title_p.paragraph_format.space_before = Pt(30)
    title_p.paragraph_format.space_after = Pt(2)
    tr = title_p.add_run("SCORING")
    tr.bold = True; tr.font.size = Pt(32); tr.font.color.rgb = h["C_NAVY"]

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD.CENTER
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(4)
    sr = sub_p.add_run("& POSITIONNEMENT")
    sr.bold = True; sr.font.size = Pt(20); sr.font.color.rgb = h["C_BLUE"]

    sep = doc.add_paragraph()
    sep.alignment = WD.CENTER
    sep.paragraph_format.space_after = Pt(20)
    sep.add_run("─" * 45).font.color.rgb = h["C_BLUE"]

    h["cover_table"]([
        ("Appel d'offres", scoring.ao_filename),
        ("Client / Commanditaire", client_name),
        ("Date d'analyse", datetime.now().strftime("%d %B %Y")),
        ("Statut document", "Scoring & Décision — Confidentiel"),
    ])

    score_p = doc.add_paragraph()
    score_p.alignment = WD.CENTER
    score_p.paragraph_format.space_before = Pt(18)
    score_p.paragraph_format.space_after = Pt(4)
    sc_r = score_p.add_run(f"Score GED : {scoring.score} / 100")
    sc_r.bold = True; sc_r.font.size = Pt(22); sc_r.font.color.rgb = score_color

    rec_p = doc.add_paragraph()
    rec_p.alignment = WD.CENTER
    rec_p.paragraph_format.space_after = Pt(30)
    rr = rec_p.add_run(f"Recommandation IA : {rec_label}")
    rr.bold = True; rr.font.size = Pt(14); rr.font.color.rgb = rec_color

    doc.add_page_break()

    # ── 1. RECOMMANDATION & JUSTIFICATION ─────────────────────────────────────
    h["section_title"]("Recommandation & Justification", num="1")
    if scoring.justification:
        jp = doc.add_paragraph()
        jp.paragraph_format.space_after = Pt(8)
        jp.paragraph_format.alignment = WD.JUSTIFY
        jr = jp.add_run(scoring.justification)
        jr.font.size = Pt(10); jr.italic = True; jr.font.color.rgb = h["C_TEXT"]

    # ── 2. FORCES & ATOUTS ────────────────────────────────────────────────────
    if scoring.strengths:
        h["section_title"]("Forces & Atouts de Neurones", num="2", color=h["C_GREEN"])
        for s in scoring.strengths:
            h["bullet"](s, h["C_GREEN"])
        doc.add_paragraph("")

    # ── 3. RISQUES IDENTIFIÉS ─────────────────────────────────────────────────
    if scoring.risks:
        h["section_title"]("Risques identifiés", num="3", color=h["C_RED"])
        for r in scoring.risks:
            h["bullet"](r, h["C_RED"])
        doc.add_paragraph("")

    # ── 4. ANALYSE DES ÉCARTS ─────────────────────────────────────────────────
    if scoring.gaps_analysis:
        h["section_title"]("Analyse des écarts", num="4", color=h["C_AMBER"])
        h["render_rich_text"](scoring.gaps_analysis)
        doc.add_paragraph("")

    # ── 5. DOCUMENTS GED PERTINENTS ──────────────────────────────────────────
    all_docs = list(scoring.team_matches or []) + list(scoring.similar_projects or []) + list(scoring.matched_documents or [])
    seen_keys: set = set()
    unique_docs = []
    for d in all_docs:
        key = d.doc_id or d.filename
        if key not in seen_keys:
            seen_keys.add(key)
            unique_docs.append(d)
    unique_docs.sort(key=lambda d: d.relevance_score, reverse=True)
    if unique_docs:
        h["section_title"]("Documents GED pertinents", num="5", color=h["C_NAVY"])
        ged_t = doc.add_table(rows=1, cols=3)
        ged_t.style = "Table Grid"
        for cell, lbl in zip(ged_t.rows[0].cells, ["Document", "Type", "Pertinence"]):
            cell.text = lbl
            h["cell_bg"](cell, "1E40AF")
            for para in cell.paragraphs:
                for run in para.runs:
                    run.bold = True; run.font.color.rgb = h["C_WHITE"]; run.font.size = Pt(10)
        for i, d in enumerate(unique_docs[:10]):
            row = ged_t.add_row().cells
            row[0].text = d.filename
            row[1].text = str(d.doc_type)
            score_pct = int(d.relevance_score * 100) if d.relevance_score <= 1.0 else int(d.relevance_score)
            row[2].text = f"{score_pct}%"
            bg = "F0FDF4" if i % 2 == 0 else "FFFFFF"
            for cell in row:
                h["cell_bg"](cell, bg)
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(10)
        doc.add_paragraph("")

    h["footer_line"]()
    buffer = BytesIO()
    doc.save(buffer)
    safe_name = re.sub(r"\.(pdf|docx)$", "", scoring.ao_filename, flags=re.IGNORECASE).replace(" ", "-")
    return Response(
        content=buffer.getvalue(), media_type=_DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="Scoring-AO_{safe_name}.docx"'},
    )


@router.post("/export-strategy")
async def export_strategy(body: StrategyExportRequest):
    """Exporte la stratégie de réponse en document Word professionnel."""
    from docx import Document as DocxDocument
    from docx.enum.table import WD_TABLE_ALIGNMENT

    scoring = _from_schema(body.scoring_result)
    client_name = body.client_name or "Non précisé"
    dec_labels = {"GO": "GO — Répondre à l'AO", "CONDITIONAL": "CONDITIONNEL — Sous réserve", "NO_BID": "NO-BID — Ne pas répondre"}
    decision_label = dec_labels.get(body.decision, body.decision)

    doc = DocxDocument()
    h = _docx_helpers(doc)
    Pt = h["Pt"]; RGBColor = h["RGBColor"]; Cm = h["Cm"]
    WD = h["WD_ALIGN_PARAGRAPH"]

    score_color = h["C_GREEN"] if scoring.score >= 70 else (h["C_AMBER"] if scoring.score >= 40 else h["C_RED"])
    rec_map = {
        "GO": ("GO — Répondre à l'AO", h["C_GREEN"]),
        "CONDITIONAL": ("CONDITIONNEL — Sous réserve", h["C_AMBER"]),
        "NO_BID": ("NO-BID — Ne pas répondre", h["C_RED"]),
    }
    rec_label, rec_color = rec_map.get(scoring.recommendation.value, ("—", h["C_AMBER"]))
    dec_color = h["C_GREEN"] if body.decision == "GO" else (h["C_AMBER"] if body.decision == "CONDITIONAL" else h["C_RED"])

    # ── PAGE DE COUVERTURE ────────────────────────────────────────────────────
    t1 = doc.add_paragraph()
    t1.alignment = WD.CENTER
    t1.paragraph_format.space_before = Pt(30)
    t1.paragraph_format.space_after = Pt(2)
    t1r = t1.add_run("STRATÉGIE DE RÉPONSE")
    t1r.bold = True; t1r.font.size = Pt(28); t1r.font.color.rgb = h["C_NAVY"]

    t2 = doc.add_paragraph()
    t2.alignment = WD.CENTER
    t2.paragraph_format.space_after = Pt(4)
    t2r = t2.add_run("Appel d'offres — " + scoring.ao_filename)
    t2r.italic = True; t2r.font.size = Pt(12); t2r.font.color.rgb = h["C_BLUE"]

    sep = doc.add_paragraph()
    sep.alignment = WD.CENTER
    sep.paragraph_format.space_after = Pt(20)
    sep.add_run("─" * 45).font.color.rgb = h["C_BLUE"]

    h["cover_table"]([
        ("Client / Commanditaire", client_name),
        ("Score de matching GED", f"{scoring.score} / 100"),
        ("Recommandation IA", rec_label),
        ("Décision commerciale", decision_label),
    ])

    dec_p = doc.add_paragraph()
    dec_p.alignment = WD.CENTER
    dec_p.paragraph_format.space_before = Pt(20)
    dec_p.paragraph_format.space_after = Pt(30)
    dec_r = dec_p.add_run(f"DÉCISION : {decision_label.upper()}")
    dec_r.bold = True; dec_r.font.size = Pt(14); dec_r.font.color.rgb = dec_color

    doc.add_page_break()

    # ── 1. CONTEXTE DE L'AO ───────────────────────────────────────────────────
    h["section_title"]("Contexte de l'appel d'offres", num="1")
    if scoring.summary:
        h["body_para"](scoring.summary)
    if scoring.key_elements:
        doc.add_paragraph("")
        kp_t = doc.add_table(rows=1, cols=2)
        kp_t.style = "Table Grid"
        for cell, lbl in zip(kp_t.rows[0].cells, ["Critère", "Valeur"]):
            cell.text = lbl
            h["cell_bg"](cell, "0F295A")
            for para in cell.paragraphs:
                for run in para.runs:
                    run.bold = True; run.font.color.rgb = h["C_WHITE"]; run.font.size = Pt(10)
        for i, el in enumerate(scoring.key_elements):
            row = kp_t.add_row().cells
            row[0].text = el.category
            row[1].text = el.value
            h["cell_bg"](row[0], "EFF6FF" if i % 2 == 0 else "FFFFFF")
            for cell in row:
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(10)
            if row[0].paragraphs[0].runs:
                row[0].paragraphs[0].runs[0].bold = True
            row[0].width = Cm(5.5); row[1].width = Cm(10.5)
        doc.add_paragraph("")

    # ── 2. STRATÉGIE DE RÉPONSE ───────────────────────────────────────────────
    h["section_title"]("Stratégie de réponse", num="2")
    if body.strategy.strip():
        h["render_rich_text"](body.strategy)
    else:
        h["body_para"]("Stratégie non définie.")
    doc.add_paragraph("")

    # ── 3. CHRONOGRAMME ───────────────────────────────────────────────────────
    if body.chronogram:
        h["section_title"]("Chronogramme de traitement", num="3")
        chrono_t = doc.add_table(rows=1, cols=3)
        chrono_t.style = "Table Grid"
        chrono_t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for cell, lbl in zip(chrono_t.rows[0].cells, ["Période", "Action à mener", "Responsable"]):
            cell.text = lbl
            h["cell_bg"](cell, "1E40AF")
            for para in cell.paragraphs:
                for run in para.runs:
                    run.bold = True; run.font.color.rgb = h["C_WHITE"]; run.font.size = Pt(10)
        chrono_t.rows[0].cells[0].width = Cm(2.5)
        chrono_t.rows[0].cells[1].width = Cm(11)
        chrono_t.rows[0].cells[2].width = Cm(3)

        for i, item in enumerate(body.chronogram):
            row = chrono_t.add_row().cells
            row[0].text = str(item.get("semaine", ""))
            row[1].text = str(item.get("action", ""))
            row[2].text = str(item.get("responsable", ""))
            bg = "EFF6FF" if i % 2 == 0 else "FFFFFF"
            h["cell_bg"](row[1], bg); h["cell_bg"](row[2], bg)
            h["cell_bg"](row[0], "DBEAFE")
            for cell in row:
                for para in cell.paragraphs:
                    for run in para.runs:
                        run.font.size = Pt(10)
            if row[0].paragraphs[0].runs:
                row[0].paragraphs[0].runs[0].bold = True
                row[0].paragraphs[0].runs[0].font.color.rgb = h["C_BLUE"]
            row[0].width = Cm(2.5); row[1].width = Cm(11); row[2].width = Cm(3)
        doc.add_paragraph("")

    # ── 4. PLAN DE RÉPONSE ────────────────────────────────────────────────────
    if body.response_plan.strip():
        h["section_title"]("Plan de réponse détaillé", num="4")
        h["render_rich_text"](body.response_plan)
        doc.add_paragraph("")

    h["footer_line"]()
    buffer = BytesIO()
    doc.save(buffer)
    safe_name = re.sub(r"\.(pdf|docx)$", "", scoring.ao_filename, flags=re.IGNORECASE).replace(" ", "-")
    return Response(
        content=buffer.getvalue(), media_type=_DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="Strategie-Reponse_{safe_name}.docx"'},
    )


@router.post("/export-checklist")
async def export_checklist(body: ChecklistExportRequest):
    """Exporte la checklist dossier en document Word professionnel."""
    from docx import Document as DocxDocument

    doc = DocxDocument()
    h = _docx_helpers(doc)
    Pt = h["Pt"]; Cm = h["Cm"]
    WD = h["WD_ALIGN_PARAGRAPH"]

    # ── Titre ────────────────────────────────────────────────────────────────────
    title_p = doc.add_paragraph()
    title_p.alignment = WD.CENTER
    title_p.paragraph_format.space_before = Pt(20)
    title_p.paragraph_format.space_after = Pt(2)
    tr = title_p.add_run("CHECKLIST DOSSIER DE RÉPONSE")
    tr.bold = True; tr.font.size = Pt(22); tr.font.color.rgb = h["C_NAVY"]

    sep = doc.add_paragraph()
    sep.alignment = WD.CENTER
    sep.paragraph_format.space_after = Pt(16)
    sep.add_run("─" * 45).font.color.rgb = h["C_BLUE"]

    h["cover_table"]([
        ("Appel d'offres", body.ao_filename),
        ("Client / Commanditaire", body.client_name or "Non précisé"),
        ("Date de soumission prévue", body.submission_date or "Non précisée"),
        ("Date d'export", datetime.now().strftime("%d %B %Y")),
    ])

    # Score de complétude
    required_items = [it for it in body.items if it.required]
    checked_required = [it for it in required_items if it.checked]
    total_all = len(body.items)
    score_p = doc.add_paragraph()
    score_p.alignment = WD.CENTER
    score_p.paragraph_format.space_before = Pt(14)
    score_p.paragraph_format.space_after = Pt(20)
    score_color = h["C_GREEN"] if len(checked_required) == len(required_items) else (
        h["C_AMBER"] if len(checked_required) >= len(required_items) * 0.6 else h["C_RED"]
    )
    sc_r = score_p.add_run(
        f"Complétude : {len(checked_required)}/{len(required_items)} items obligatoires cochés"
        f"  ·  {sum(1 for it in body.items if it.checked)}/{total_all} items totaux"
    )
    sc_r.bold = True; sc_r.font.size = Pt(11); sc_r.font.color.rgb = score_color

    doc.add_page_break()

    # ── Sections par catégorie ────────────────────────────────────────────────────
    cat_order = ["Technique", "Administratif", "Commercial"]
    cat_colors = {
        "Technique": h["C_BLUE"],
        "Administratif": h["C_NAVY"],
        "Commercial": h["C_AMBER"],
    }
    cat_num = {"Technique": "1", "Administratif": "2", "Commercial": "3"}

    for cat in cat_order:
        items_cat = [it for it in body.items if it.category == cat]
        if not items_cat:
            continue
        h["section_title"](cat, color=cat_colors[cat], num=cat_num[cat])

        tbl = doc.add_table(rows=1, cols=3)
        tbl.style = "Table Grid"
        for cell, lbl in zip(tbl.rows[0].cells, ["Statut", "Élément du dossier", "Observations"]):
            cell.text = lbl
            h["cell_bg"](cell, "0F295A")
            for para in cell.paragraphs:
                for run in para.runs:
                    run.bold = True; run.font.color.rgb = h["C_WHITE"]; run.font.size = Pt(9)
        tbl.rows[0].cells[0].width = Cm(1.5)
        tbl.rows[0].cells[1].width = Cm(11)
        tbl.rows[0].cells[2].width = Cm(4)

        for i, item in enumerate(items_cat):
            row = tbl.add_row().cells
            symbol = "✓" if item.checked else "☐"
            row[0].text = symbol
            row[1].text = item.label
            row[2].text = item.note or ""

            # Fond : vert si coché, bleu pâle si required non coché, blanc sinon
            if item.checked:
                bg = "D1FAE5"
            elif item.required:
                bg = "EFF6FF"
            else:
                bg = "FFFFFF" if i % 2 == 0 else "F8FAFC"
            for cell in row:
                h["cell_bg"](cell, bg)

            # Style symbole
            for para in row[0].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(12)
                    run.bold = True
                    run.font.color.rgb = h["C_GREEN"] if item.checked else h["C_RED"]
                    para.paragraph_format.alignment = WD.CENTER

            # Style label : bold si required
            for para in row[1].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(9)
                    if item.required:
                        run.bold = True

            for para in row[2].paragraphs:
                for run in para.runs:
                    run.font.size = Pt(9)
                    run.font.color.rgb = h["C_GRAY"]

            row[0].width = Cm(1.5); row[1].width = Cm(11); row[2].width = Cm(4)

        doc.add_paragraph("")

    h["footer_line"]()
    buffer = BytesIO()
    doc.save(buffer)
    safe_name = re.sub(r"\.(pdf|docx)$", "", body.ao_filename, flags=re.IGNORECASE).replace(" ", "-")
    return Response(
        content=buffer.getvalue(), media_type=_DOCX_MIME,
        headers={"Content-Disposition": f'attachment; filename="Checklist_{safe_name}.docx"'},
    )


@router.post("/match-team", response_model=TeamMatchResponse)
async def match_team(body: TeamMatchRequest, request: Request):
    """Cherche dans la GED les CVs correspondant aux profils demandés par l'AO."""
    use_case = _get_use_case(request)
    return await use_case.match_team(body)


def _to_schema(result: ScoringResult) -> ScoringResultSchema:
    return ScoringResultSchema(
        ao_filename=result.ao_filename,
        summary=result.summary,
        key_elements=[KeyElementSchema(category=e.category, value=e.value) for e in result.key_elements],
        matched_documents=[
            MatchedDocumentSchema(
                doc_id=m.doc_id,
                filename=m.filename,
                doc_type=m.doc_type,
                relevance_score=m.relevance_score,
                excerpt=m.excerpt,
            )
            for m in result.matched_documents
        ],
        gaps_analysis=result.gaps_analysis,
        strengths=result.strengths,
        risks=result.risks,
        score=result.score,
        recommendation=BidRecommendationSchema(result.recommendation.value),
        justification=result.justification,
        criteres_selection=result.criteres_selection,
        besoins=result.besoins,
        prerequis=result.prerequis,
        ressources_demandees=result.ressources_demandees,
        points_vigilance=result.points_vigilance,
        date_remise=result.date_remise,
        team_matches=[
            MatchedDocumentSchema(
                doc_id=m.doc_id, filename=m.filename, doc_type=m.doc_type,
                relevance_score=m.relevance_score, excerpt=m.excerpt,
            )
            for m in result.team_matches
        ],
        similar_projects=[
            MatchedDocumentSchema(
                doc_id=m.doc_id, filename=m.filename, doc_type=m.doc_type,
                relevance_score=m.relevance_score, excerpt=m.excerpt,
            )
            for m in result.similar_projects
        ],
    )


def _from_schema(schema: ScoringResultSchema) -> ScoringResult:
    from core.domain.offer import KeyElement, MatchedDocument, BidRecommendation
    return ScoringResult(
        ao_filename=schema.ao_filename,
        summary=schema.summary,
        key_elements=[KeyElement(category=e.category, value=e.value) for e in schema.key_elements],
        matched_documents=[
            MatchedDocument(
                doc_id=m.doc_id, filename=m.filename, doc_type=m.doc_type,
                relevance_score=m.relevance_score, excerpt=m.excerpt,
            )
            for m in schema.matched_documents
        ],
        gaps_analysis=schema.gaps_analysis,
        strengths=schema.strengths,
        risks=schema.risks,
        score=schema.score,
        recommendation=BidRecommendation(schema.recommendation.value),
        justification=schema.justification,
        criteres_selection=schema.criteres_selection,
        besoins=schema.besoins,
        prerequis=schema.prerequis,
        ressources_demandees=schema.ressources_demandees,
        points_vigilance=schema.points_vigilance,
        date_remise=schema.date_remise,
        team_matches=[
            MatchedDocument(
                doc_id=m.doc_id, filename=m.filename, doc_type=m.doc_type,
                relevance_score=m.relevance_score, excerpt=m.excerpt,
            )
            for m in schema.team_matches
        ],
        similar_projects=[
            MatchedDocument(
                doc_id=m.doc_id, filename=m.filename, doc_type=m.doc_type,
                relevance_score=m.relevance_score, excerpt=m.excerpt,
            )
            for m in schema.similar_projects
        ],
    )
