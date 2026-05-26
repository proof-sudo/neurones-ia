"""
Lance le premier sync Odoo -> SQLite manuellement.
Usage: python scripts/run_sync.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Charger les variables d'environnement depuis .env
from pathlib import Path
env_file = Path(__file__).parent.parent / "backend" / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")


async def main():
    # Créer les tables si elles n'existent pas
    from db.database import engine, Base
    from db import models  # noqa: importe tous les modèles

    print("Création des tables SQLite...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables créées.")

    # Lancer le sync
    from jobs.odoo_sync_job import run_odoo_sync
    print("\nDémarrage synchronisation Odoo → SQLite...\n")
    result = await run_odoo_sync()

    print("\n=== RÉSULTAT ===")
    for k, v in result.items():
        print(f"  {k:20s}: {v}")


asyncio.run(main())
