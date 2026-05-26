"""
Teste l'OdooAdapter corrigé (session persistante) et affiche les stats réelles.
Usage: python scripts/test_odoo_adapter.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Monkey-patch settings avant import
import types
settings_mod = types.ModuleType("config.settings")
class _S:
    odoo_url      = "https://erpntci.neuronestech.com"
    odoo_db       = "Neurones_Prod"
    odoo_username = "odooAgent@neurone"
    odoo_password = "OdooAgent2024!"
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
