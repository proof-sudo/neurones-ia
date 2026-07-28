"""Phase 1 (complément) — corrige le filtre actif sur crm.lead perdues, profile le
contenu réel de account.analytic.line, et cherche un champ custom de date de fin
de prestation sur sale.order (fields_get, comme dossier_id l'a été)."""
import asyncio
import json
import sys
from collections import Counter

sys.path.insert(0, "/app")

from adapters.crm.odoo_adapter import OdooAdapter  # noqa: E402


def _rate(records, field, zero_counts_as_empty=False):
    if not records:
        return 0.0
    filled = 0
    for r in records:
        v = r.get(field)
        if v in (False, None, ""):
            continue
        if zero_counts_as_empty and v == 0:
            continue
        filled += 1
    return round(filled / len(records) * 100, 1)


async def main():
    odoo = OdooAdapter()
    out = {}
    try:
        # 1. Opportunités perdues — inclure explicitement les archivées (active=False)
        lost = await odoo._call(
            "crm.lead", "search_read",
            [[["type", "=", "opportunity"], ["active", "=", False]]],
            {"fields": ["id", "lost_reason_id", "probability", "date_closed"], "limit": 5000},
        )
        out["crm_lead_perdues_corrige"] = {
            "nb_perdues_total_archivees": len(lost),
            "taux_lost_reason_id_pct": _rate(lost, "lost_reason_id"),
        }

        # 2. Contenu réel de account.analytic.line — découvre d'abord les champs réels
        # (le modèle diffère selon que hr_timesheet est installé ou non : sans lui, pas
        # de employee_id/task_id, ce ne sont que des lignes analytiques comptables).
        aal_all_fields = await odoo._call("account.analytic.line", "fields_get", [], {"attributes": ["string", "type"]})
        candidate_fields = ["employee_id", "user_id", "unit_amount", "product_id", "account_id",
                             "project_id", "task_id", "date", "amount", "partner_id", "move_line_id",
                             "general_account_id", "so_line", "category"]
        aal_fields = ["id"] + [f for f in candidate_fields if f in aal_all_fields]
        out["account_analytic_line_champs_disponibles"] = sorted(aal_all_fields.keys())
        aal_sample = await odoo._call(
            "account.analytic.line", "search_read", [[]],
            {"fields": aal_fields, "limit": 3000, "order": "date desc"},
        )
        content = {"echantillon": len(aal_sample), "champs_lus": aal_fields}
        for f in aal_fields:
            if f == "id":
                continue
            content[f"taux_{f}_pct"] = _rate(aal_sample, f, zero_counts_as_empty=(f in ("unit_amount", "amount")))
        out["account_analytic_line_contenu"] = content

        # 3. hr_timesheet module installé ? (modèle hr.timesheet vs project.task avec des lignes analytiques liées)
        try:
            ts_count = await odoo._call(
                "account.analytic.line", "search_count",
                [[["project_id", "!=", False]]], {},
            )
            out["nb_analytic_lines_liees_a_un_projet"] = ts_count
        except Exception as e:
            out["nb_analytic_lines_liees_a_un_projet"] = f"ERREUR: {e}"

        # 4. Champ custom de date de fin de prestation sur sale.order ?
        so_fields = await odoo._call("sale.order", "fields_get", [], {"attributes": ["string", "type"]})
        candidats = {
            k: v for k, v in so_fields.items()
            if any(kw in k.lower() for kw in ["end", "fin", "duree", "duration", "close", "cloture"])
        }
        out["sale_order_champs_candidats_date_fin"] = candidats

    finally:
        await odoo.close()
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
