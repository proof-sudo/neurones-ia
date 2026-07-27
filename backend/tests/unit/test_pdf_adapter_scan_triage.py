"""PDFAdapter — triage en amont (routeur) : un scan (couche texte quasi absente)
saute `pymupdf4llm` entièrement au lieu de le laisser tourner pour un résultat
qu'on sait déjà inexploitable (confirmé en prod : pymupdf4llm ne rend que des
tirets vides sur une page-image). Ne couvre PAS le cas dense-tableaux (aucune
heuristique fiable identifiée pour prédire ce cas sans risquer la qualité)."""
import asyncio

import fitz

from adapters.parser.pdf_adapter import PDFAdapter


def _make_blank_pdf(path, n_pages: int = 3) -> None:
    """PDF sans AUCUN texte — simule un scan pur (couche texte totalement absente)."""
    doc = fitz.open()
    for _ in range(n_pages):
        doc.new_page()
    doc.save(str(path))
    doc.close()


def _make_text_pdf(path, n_pages: int = 3) -> None:
    """PDF avec du texte réel largement au-dessus du seuil de fidélité (200 car.)."""
    doc = fitz.open()
    for i in range(n_pages):
        page = doc.new_page()
        for j in range(20):
            page.insert_text((72, 72 + j * 14), f"Ligne {j} de contenu réel sur la page {i}.")
    doc.save(str(path))
    doc.close()


def test_looks_like_scan_detecte_pdf_sans_texte(tmp_path):
    pdf_path = tmp_path / "scan.pdf"
    _make_blank_pdf(pdf_path)
    adapter = PDFAdapter()

    assert adapter._looks_like_scan(str(pdf_path)) is True


def test_looks_like_scan_detecte_pdf_avec_texte_normal(tmp_path):
    pdf_path = tmp_path / "normal.pdf"
    _make_text_pdf(pdf_path)
    adapter = PDFAdapter()

    assert adapter._looks_like_scan(str(pdf_path)) is False


def test_parse_saute_pymupdf4llm_sur_scan(tmp_path, monkeypatch):
    import adapters.parser.pdf_adapter as m

    pdf_path = tmp_path / "scan.pdf"
    _make_blank_pdf(pdf_path)
    adapter = PDFAdapter()

    calls: list[str] = []

    async def _fake_pymupdf4llm_subprocess(self, file_path):
        calls.append("pymupdf4llm")
        return "ne devrait jamais être appelé"

    def _fake_fallback(self, file_path):
        calls.append("fallback")
        return "texte de repli"

    monkeypatch.setattr(m.PDFAdapter, "_run_pymupdf4llm_subprocess", _fake_pymupdf4llm_subprocess)
    monkeypatch.setattr(m.PDFAdapter, "_parse_fallback_sync", _fake_fallback)

    result = asyncio.run(adapter.parse(str(pdf_path)))

    assert calls == ["fallback"]  # pymupdf4llm jamais invoqué
    assert result == "texte de repli"


def test_parse_tente_pymupdf4llm_sur_texte_normal(tmp_path, monkeypatch):
    import adapters.parser.pdf_adapter as m

    pdf_path = tmp_path / "normal.pdf"
    _make_text_pdf(pdf_path)
    adapter = PDFAdapter()

    calls: list[str] = []

    async def _fake_pymupdf4llm_subprocess(self, file_path):
        calls.append("pymupdf4llm")
        return ""  # simule un échec — on vérifie juste que l'appel a bien lieu

    def _fake_fallback(self, file_path):
        calls.append("fallback")
        return "texte de repli"

    monkeypatch.setattr(m.PDFAdapter, "_run_pymupdf4llm_subprocess", _fake_pymupdf4llm_subprocess)
    monkeypatch.setattr(m.PDFAdapter, "_parse_fallback_sync", _fake_fallback)

    asyncio.run(adapter.parse(str(pdf_path)))

    assert calls[0] == "pymupdf4llm"  # comportement inchangé : toujours tenté sur un doc normal
