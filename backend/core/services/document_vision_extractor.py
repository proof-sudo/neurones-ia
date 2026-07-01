"""
DocumentVisionExtractor — lit le CONTENU VISUEL des pages porteuses d'images (tous types de
documents) que ni la couche texte ni l'OCR ne restituent : schémas/diagrammes, tableaux en
image, captures, logos et badges de certification.

Déclencheur ciblé (coût borné) : pages dont les images couvrent ≥ area_ratio de la surface,
OU page de CV titrée « certifications » (badges souvent petits). Ces pages sont rendues en PNG
et envoyées en UN SEUL appel à un LLM multimodal (Claude Haiku) qui transcrit + décrit, et
liste les certifications par leur nom officiel.

Best-effort : toute panne (pas de clé API, modèle indisponible, JSON invalide, doc non-PDF)
renvoie un résultat vide sans jamais interrompre l'indexation.
"""
from __future__ import annotations

import json
import logging
import re
import unicodedata
from pathlib import Path

logger = logging.getLogger(__name__)

_VISION_SYSTEM = (
    "Tu reçois une ou plusieurs images de pages d'un document professionnel (CV, appel d'offres, "
    "attestation, schéma technique, certificat…). Pour CHAQUE page :\n"
    "- TRANSCRIS fidèlement tout le texte lisible.\n"
    "- DÉCRIS brièvement les éléments visuels porteurs d'information : schémas/diagrammes "
    "(composants et liens), tableaux (contenu principal), captures d'écran, logos/badges de "
    "certification (donne le NOM OFFICIEL complet).\n"
    "RÈGLES STRICTES : n'invente RIEN ; si un élément est illisible ou ambigu, ignore-le ; "
    "pas de commentaire décoratif.\n"
    "Réponds UNIQUEMENT par un objet JSON, sans texte autour :\n"
    '{"contenu": "<transcription + descriptions>", "certifications": ["<nom officiel>", ...]}'
)

_EMPTY = {"contenu": "", "certifications": []}


def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


class DocumentVisionExtractor:
    def __init__(self, vision_llm, max_pages: int = 3, area_ratio: float = 0.15, dpi: int = 150):
        # vision_llm : objet exposant generate_with_images(system, user, images, ...).
        self._llm = vision_llm
        self._max_pages = max_pages
        self._area_ratio = area_ratio
        self._dpi = dpi

    @property
    def available(self) -> bool:
        return self._llm is not None and hasattr(self._llm, "generate_with_images")

    @staticmethod
    def _page_image_ratio(page) -> float:
        """Part de la surface de la page couverte par des images (0–1)."""
        try:
            infos = page.get_image_info()
        except Exception:
            return 0.0
        page_area = abs(page.rect.width * page.rect.height) or 1.0
        covered = 0.0
        for it in infos or []:
            bb = it.get("bbox")
            if bb and len(bb) == 4:
                covered += abs((bb[2] - bb[0]) * (bb[3] - bb[1]))
        return min(1.0, covered / page_area)

    def _candidate_pages(self, doc) -> list[int]:
        """Pages valant un appel vision : forte couverture image, OU page « certif » à logos,
        OU page-image à faible texte suivant un titre « certif »."""
        pages_text = [_normalize(p.get_text()) for p in doc]
        candidates: list[int] = []
        for i, page in enumerate(doc):
            if not page.get_images(full=True):
                continue
            here = pages_text[i]
            prev = pages_text[i - 1] if i > 0 else ""
            if self._page_image_ratio(page) >= self._area_ratio:
                candidates.append(i)
            elif "certif" in here:
                candidates.append(i)
            elif "certif" in prev and len(here.strip()) < 400:
                candidates.append(i)
        return candidates[: self._max_pages]

    async def extract(self, file_path: Path, doc_type=None) -> dict:
        """Renvoie {"contenu": str, "certifications": list[str]} ; vide si rien à analyser."""
        if not self.available:
            return dict(_EMPTY)
        path = Path(file_path)
        if path.suffix.lower() != ".pdf":
            return dict(_EMPTY)
        try:
            import fitz  # PyMuPDF
        except ImportError:
            logger.debug("PyMuPDF absent — extraction vision désactivée.")
            return dict(_EMPTY)

        try:
            doc = fitz.open(str(path))
        except Exception as exc:
            logger.warning("Vision : ouverture PDF échouée (%s) : %s", path.name, exc)
            return dict(_EMPTY)
        try:
            pages = self._candidate_pages(doc)
            if not pages:
                return dict(_EMPTY)
            images: list[tuple[str, bytes]] = []
            for idx in pages:
                pix = doc[idx].get_pixmap(dpi=self._dpi)
                images.append(("image/png", pix.tobytes("png")))
        except Exception as exc:
            logger.warning("Vision : rendu des pages échoué (%s) : %s", path.name, exc)
            return dict(_EMPTY)
        finally:
            doc.close()

        user = "Voici la/les page(s) à contenu visuel de ce document. Transcris et décris fidèlement."
        try:
            raw = await self._llm.generate_with_images(
                system=_VISION_SYSTEM, user=user, images=images,
                max_tokens=4000, temperature=0.0,   # transcription multi-pages = verbeux
            )
        except Exception as exc:
            logger.warning("Vision : appel LLM échoué (%s) : %s", path.name, exc)
            return dict(_EMPTY)

        result = self._parse(raw)
        if result["contenu"] or result["certifications"]:
            logger.info(
                "Vision : %d page(s) lue(s) sur %s (%d certif, %d chars de contenu)",
                len(pages), path.name, len(result["certifications"]), len(result["contenu"]),
            )
        return result

    @staticmethod
    def _dedup(names: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for it in names:
            name = str(it).strip()
            key = _normalize(name)
            if name and key not in seen:
                seen.add(key)
                out.append(name)
        return out

    @classmethod
    def _parse(cls, raw: str) -> dict:
        """Tolère le fence ```json ... ``` ET un JSON TRONQUÉ (réponse coupée au plafond de
        tokens) : on tente d'abord json.loads, puis une récupération best-effort par regex."""
        if not raw:
            return dict(_EMPTY)
        # Essai 1 : JSON complet (la regex { … } ignore un éventuel fence markdown autour).
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group(0))
                if isinstance(data, dict):
                    certs = data.get("certifications")
                    return {
                        "contenu": str(data.get("contenu") or "").strip(),
                        "certifications": cls._dedup(certs if isinstance(certs, list) else []),
                    }
            except (ValueError, TypeError):
                pass  # JSON tronqué/malformé → récupération ci-dessous
        # Essai 2 : récupérer au moins "contenu" (chaîne éventuellement non fermée) + certifs.
        contenu = ""
        cm = re.search(r'"contenu"\s*:\s*"(.*)', raw, re.DOTALL)
        if cm:
            s = re.split(r'",\s*"certifications"', cm.group(1))[0].rstrip().rstrip('"')
            contenu = s.replace("\\n", "\n").replace('\\"', '"').replace("\\t", "\t").strip()
        certs: list[str] = []
        block = re.search(r'"certifications"\s*:\s*\[(.*?)\]', raw, re.DOTALL)
        if block:
            certs = cls._dedup(re.findall(r'"([^"]+)"', block.group(1)))
        return {"contenu": contenu, "certifications": certs}
