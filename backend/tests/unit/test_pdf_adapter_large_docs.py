"""PDFAdapter.parse — seuil de pages qui évite pymupdf4llm sur les gros documents.
Bug réel trouvé en testant un AO de 97 pages à tableaux denses : pymupdf4llm seul a
mis 781s (13 min). Plutôt que de perdre le délai du timeout à chaque essai voué à
l'échec, on saute pymupdf4llm proactivement au-delà d'un seuil de pages."""
import asyncio

import pytest

from adapters.parser.pdf_adapter import PDFAdapter


def test_gros_document_saute_pymupdf4llm(monkeypatch):
    adapter = PDFAdapter()
    monkeypatch.setattr(adapter, "_page_count", lambda file_path: 97)

    called = {"pymupdf4llm": False}

    def _fake_try(file_path):
        called["pymupdf4llm"] = True
        return "ne devrait jamais être appelé"

    monkeypatch.setattr(adapter, "_try_pymupdf4llm_if_faithful", _fake_try)
    monkeypatch.setattr(adapter, "_parse_fallback_sync", lambda file_path: "texte de repli")

    result = asyncio.run(adapter.parse("/tmp/gros.pdf"))

    assert result == "texte de repli"
    assert called["pymupdf4llm"] is False


def test_petit_document_tente_pymupdf4llm(monkeypatch):
    adapter = PDFAdapter()
    monkeypatch.setattr(adapter, "_page_count", lambda file_path: 5)
    monkeypatch.setattr(adapter, "_try_pymupdf4llm_if_faithful", lambda file_path: "# Titre\ncontenu")
    monkeypatch.setattr(
        adapter, "_parse_fallback_sync",
        lambda file_path: pytest.fail("ne devrait pas être appelé si pymupdf4llm réussit"),
    )

    result = asyncio.run(adapter.parse("/tmp/petit.pdf"))

    assert result == "# Titre\ncontenu"
