"""
Teste l'OdooAdapter corrigé (session persistante) et affiche les stats réelles.
Usage: ODOO_URL=... ODOO_DB=... ODOO_USERNAME=... ODOO_PASSWORD=... python scripts/test_odoo_adapter.py
(ou : lit ces variables depuis backend/.env si présent — jamais de credentials en dur ici.)
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

REQUIRED = ("ODOO_URL", "ODOO_DB", "ODOO_USERNAME", "ODOO_PASSWORD")
missing = [name for name in REQUIRED if not os.environ.get(name)]
if missing:
    print(f"Variables d'environnement manquantes : {', '.join(missing)}")
    print("Renseigne-les (ou charge backend/.env) avant de relancer ce script.")
    sys.exit(1)

# Monkey-patch settings avant import — valeurs lues depuis l'environnement,
# jamais codées en dur (mandat sécurité : aucun credential réel dans le repo).
import types
settings_mod = types.ModuleType("config.settings")
class _S:
    odoo_url      = os.environ["ODOO_URL"]
    odoo_db       = os.environ["ODOO_DB"]
    odoo_username = os.environ["ODOO_USERNAME"]
    odoo_password = os.environ["ODOO_PASSWORD"]
settings_mod.settings = _S()
sys.modules["config"] = types.ModuleType("config")
sys.modules["config.settings"] = settings_mod

from adapters.crm.odoo_adapter import OdooAdapter


async def main():
    adapter = OdooAdapter()
    try:
        print("=== Stats globales ===")
        stats = await adapter.get_stats()
        for k, v in stats.items():
            print(f"  {k:25s}: {v:,}")

        print("\n=== 5 premiers clients ===")
        clients = await adapter.get_all_clients(limit=5)
        for c in clients:
            print(f"  [{c.odoo_id}] {c.name} | {c.contact_email or '—'}")

        print("\n=== 5 dernières factures ===")
        invoices = await adapter.get_all_invoices(limit=5)
        for inv in invoices:
            print(f"  {inv.invoice_id:6s} | {inv.amount:>15,.0f} {inv.currency} | {inv.status.value}")

        print("\n=== Opportunités CRM (5) ===")
        opps = await adapter.get_opportunities(limit=5)
        for o in opps:
            p = (o.get("partner_id") or [None, "?"])
            print(f"  {o['name'][:50]:50s} | {p[1]} | {o.get('expected_revenue',0):,.0f}")

    finally:
        await adapter.close()

asyncio.run(main())
