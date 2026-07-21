"""Config partagée par les scripts d'administration VPS (vps_*.py, deploy_vps*.py).

Les identifiants ne sont JAMAIS hardcodés ici : ils viennent de l'environnement,
chargé depuis backend/.env.vps (gitignored — cf. .env.vps.example pour le
modèle). Objectif : ne plus jamais committer un mot de passe VPS en clair.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env.vps")

VPS_HOST = os.environ.get("VPS_HOST", "76.13.51.87")
VPS_USER = os.environ.get("VPS_USER", "root")
VPS_PASS = os.environ.get("VPS_PASS")
REMOTE_DIR = os.environ.get("VPS_REMOTE_DIR", "/opt/neurones-ia")

if not VPS_PASS:
    sys.exit(
        "VPS_PASS manquant. Crée backend/.env.vps (voir backend/.env.vps.example) "
        "avec le mot de passe root actuel du VPS, ou exporte VPS_PASS dans l'environnement."
    )
