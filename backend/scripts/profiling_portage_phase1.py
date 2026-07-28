"""Phase 1 du portage maquette — profiling Odoo champ par champ (lecture seule).

Rejouable : `python scripts/profiling_portage_phase1.py`. N'écrit jamais dans Odoo.
Produit un JSON structuré (stdout) consommé pour rédiger
docs/portage/01-audit-donnees.md et config/data_availability.yaml.
"""
import asyncio
import json
import sys
from collections import Counter
from datetime import datetime, timedelta

sys.path.insert(0, "/app")

from adapters.crm.odoo_adapter import OdooAdapter  # noqa: E402


def _rate(records: list[dict], field: str, *, zero_counts_as_empty: bool = False) -> float:
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


def _distinct(records: list[dict], field: str) -> dict:
    c = Counter()
    for r in records:
        v = r.get(field)
        if isinstance(v, list) and len(v) == 2:
            v = v[1]
        c[str(v)] += 1
    return dict(c.most_common(20))


async def profile_partners(odoo: OdooAdapter) -> dict:
    total = await odoo._call("res.partner", "search_count", [[]], {})
    total_companies = await odoo._call("res.partner", "search_count", [[["is_company", "=", True]]], {})
    fields = [
        "id", "name", "commercial_partner_id", "parent_id", "credit_limit",
        "use_partner_credit_limit", "property_payment_term_id", "industry_id",
        "country_id", "category_id", "active", "customer_rank", "supplier_rank", "vat",
    ]
    sample = await odoo._call(
        "res.partner", "search_read", [[["is_company", "=", True]]],
        {"fields": fields, "limit": 5000},
    )
    inactive = await odoo._call("res.partner", "search_count", [[["active", "=", False]]], {})
    with_parent = sum(1 for r in sample if r.get("parent_id"))
    self_commercial = sum(
        1 for r in sample
        if r.get("commercial_partner_id") and r.get("commercial_partner_id")[0] == r["id"]
    )
    return {
        "total_partners": total,
        "total_companies": total_companies,
        "echantillon_analyse": len(sample),
        "inactifs": inactive,
        "taux_avec_parent_id_pct": round(with_parent / len(sample) * 100, 1) if sample else 0,
        "taux_commercial_partner_est_soi_meme_pct": round(self_commercial / len(sample) * 100, 1) if sample else 0,
        "taux_credit_limit_configure_pct": _rate(sample, "credit_limit", zero_counts_as_empty=True),
        "nb_use_partner_credit_limit_actif": sum(1 for r in sample if r.get("use_partner_credit_limit")),
        "taux_payment_term_pct": _rate(sample, "property_payment_term_id"),
        "taux_industry_id_pct": _rate(sample, "industry_id"),
        "taux_country_id_pct": _rate(sample, "country_id"),
        "taux_category_id_pct": _rate(sample, "category_id"),
        "taux_vat_pct": _rate(sample, "vat"),
        "distinct_industries": _distinct(sample, "industry_id"),
        "distinct_countries": _distinct(sample, "country_id"),
    }


async def profile_invoices(odoo: OdooAdapter) -> dict:
    move_type_counts = {}
    for mt in ["out_invoice", "out_refund", "in_invoice", "in_refund", "entry"]:
        move_type_counts[mt] = await odoo._call(
            "account.move", "search_count", [[["move_type", "=", mt]]], {}
        )
    fields = [
        "id", "move_type", "state", "amount_untaxed", "amount_total", "amount_residual",
        "currency_id", "invoice_date", "date", "invoice_date_due", "create_date",
        "invoice_origin", "payment_state", "reversed_entry_id",
    ]
    sample_out = await odoo._call(
        "account.move", "search_read",
        [[["move_type", "=", "out_invoice"], ["state", "=", "posted"]]],
        {"fields": fields, "limit": 5000, "order": "invoice_date desc"},
    )
    sample_in = await odoo._call(
        "account.move", "search_read",
        [[["move_type", "=", "in_invoice"], ["state", "=", "posted"]]],
        {"fields": fields, "limit": 5000, "order": "invoice_date desc"},
    )
    payment_state_out = _distinct(sample_out, "payment_state")
    payment_state_in = _distinct(sample_in, "payment_state")
    origin_rate_out = _rate(sample_out, "invoice_origin")
    return {
        "distribution_move_type": move_type_counts,
        "echantillon_out_invoice": len(sample_out),
        "echantillon_in_invoice": len(sample_in),
        "taux_invoice_origin_rempli_out_invoice_pct": origin_rate_out,
        "distribution_payment_state_out_invoice": payment_state_out,
        "distribution_payment_state_in_invoice": payment_state_in,
        "taux_reversed_entry_id_sur_refunds_pct": None,  # calculé ci-dessous si des refunds existent
    }


async def profile_sale_orders(odoo: OdooAdapter) -> dict:
    state_counts = {}
    for st in ["draft", "sent", "sale", "done", "cancel"]:
        state_counts[st] = await odoo._call(
            "sale.order", "search_count", [[["state", "=", st]]], {}
        )
    fields = [
        "id", "state", "invoice_status", "amount_untaxed", "date_order",
        "commitment_date", "validity_date",
    ]
    sample = await odoo._call(
        "sale.order", "search_read", [[["state", "in", ["sale", "done"]]]],
        {"fields": fields, "limit": 5000, "order": "date_order desc"},
    )
    line_fields = ["order_id", "product_id", "name"]
    line_sample = await odoo._call(
        "sale.order.line", "search_read", [[["order_id", "in", [r["id"] for r in sample[:2000]]]]],
        {"fields": line_fields, "limit": 20000},
    )
    return {
        "distribution_state": state_counts,
        "echantillon_analyse_sale_done": len(sample),
        "taux_commitment_date_pct": _rate(sample, "commitment_date"),
        "taux_validity_date_pct": _rate(sample, "date_order"),
        "nb_lignes_echantillonnees": len(line_sample),
        "taux_product_id_sur_lignes_pct": _rate(line_sample, "product_id"),
    }


async def profile_crm_leads(odoo: OdooAdapter) -> dict:
    type_counts = {}
    for t in ["lead", "opportunity"]:
        type_counts[t] = await odoo._call("crm.lead", "search_count", [[["type", "=", t]]], {})
    fields = [
        "id", "type", "expected_revenue", "probability", "date_deadline",
        "stage_id", "user_id", "team_id", "date_closed", "lost_reason_id", "active",
    ]
    sample = await odoo._call(
        "crm.lead", "search_read", [[["type", "=", "opportunity"]]],
        {"fields": fields, "limit": 5000, "order": "create_date desc"},
    )
    lost_reasons_total = await odoo._call("crm.lost.reason", "search_count", [[]], {})
    lost_sample = [r for r in sample if not r.get("active")]
    lost_reason_rate = _rate(lost_sample, "lost_reason_id") if lost_sample else None
    # Historisation : mail.tracking.value sur les champs stage_id/expected_revenue/date_deadline
    tracking_count = 0
    try:
        tracking_count = await odoo._call(
            "mail.tracking.value", "search_count",
            [[["field_id.model", "=", "crm.lead"], ["field_id.name", "in", ["stage_id", "expected_revenue", "date_deadline"]]]],
            {},
        )
    except Exception as e:
        tracking_count = f"ERREUR: {e}"
    return {
        "distribution_type": type_counts,
        "nb_lost_reasons_definis": lost_reasons_total,
        "echantillon_opportunites": len(sample),
        "taux_expected_revenue_pct": _rate(sample, "expected_revenue", zero_counts_as_empty=True),
        "taux_date_deadline_pct": _rate(sample, "date_deadline"),
        "nb_opportunites_perdues_echantillon": len(lost_sample),
        "taux_lost_reason_id_sur_perdues_pct": lost_reason_rate,
        "nb_mail_tracking_value_stage_expected_deadline": tracking_count,
    }


async def profile_purchase_orders(odoo: OdooAdapter) -> dict:
    state_counts = {}
    for st in ["draft", "sent", "purchase", "done", "cancel"]:
        state_counts[st] = await odoo._call(
            "purchase.order", "search_count", [[["state", "=", st]]], {}
        )
    fields = ["id", "state", "date_order", "date_planned", "date_approve", "amount_untaxed", "partner_id"]
    sample = await odoo._call(
        "purchase.order", "search_read", [[["state", "in", ["purchase", "done"]]]],
        {"fields": fields, "limit": 5000, "order": "date_order desc"},
    )
    line_sample = await odoo._call(
        "purchase.order.line", "search_read", [[["order_id", "in", [r["id"] for r in sample[:2000]]]]],
        {"fields": ["order_id", "product_id", "name"], "limit": 20000},
    )
    stock_picking_count = 0
    stock_move_count = 0
    try:
        stock_picking_count = await odoo._call("stock.picking", "search_count", [[]], {})
        stock_move_count = await odoo._call(
            "stock.move", "search_count", [[["purchase_line_id", "!=", False]]], {}
        )
    except Exception as e:
        stock_picking_count = f"ERREUR (module Inventaire absent ?) : {e}"
    return {
        "distribution_state": state_counts,
        "echantillon_purchase_done": len(sample),
        "taux_date_planned_pct": _rate(sample, "date_planned"),
        "taux_date_approve_pct": _rate(sample, "date_approve"),
        "nb_lignes_echantillonnees": len(line_sample),
        "taux_product_id_sur_lignes_pct": _rate(line_sample, "product_id"),
        "nb_stock_picking_total": stock_picking_count,
        "nb_stock_move_rattaches_a_ligne_achat": stock_move_count,
    }


async def profile_products(odoo: OdooAdapter) -> dict:
    total = await odoo._call("product.product", "search_count", [[]], {})
    total_templates = await odoo._call("product.template", "search_count", [[]], {})
    sample = await odoo._call(
        "product.product", "search_read", [[]],
        {"fields": ["id", "name", "default_code", "categ_id"], "limit": 5000},
    )
    categ_dist = _distinct(sample, "categ_id")
    names_normalized = Counter(r["name"].strip().lower() for r in sample if r.get("name"))
    duplicates = sum(1 for _, n in names_normalized.items() if n > 1)
    return {
        "total_product_product": total,
        "total_product_template": total_templates,
        "echantillon_analyse": len(sample),
        "taux_default_code_pct": _rate(sample, "default_code"),
        "taux_categ_id_pct": _rate(sample, "categ_id"),
        "nb_categories_distinctes_dans_echantillon": len(categ_dist),
        "top_categories": categ_dist,
        "nb_libelles_normalises_dupliques": duplicates,
    }


async def profile_timesheets_analytics(odoo: OdooAdapter) -> dict:
    result = {}
    checks = [
        ("account.analytic.line", [["amount", "!=", 0]]),
        ("account.analytic.account", []),
        ("project.project", []),
        ("project.task", []),
        ("hr.employee", []),
    ]
    for model, domain in checks:
        try:
            result[model] = await odoo._call(model, "search_count", [domain], {})
        except Exception as e:
            result[model] = f"ERREUR (modèle absent/inaccessible) : {e}"
    return result


async def main():
    odoo = OdooAdapter()
    out = {"genere_le": datetime.utcnow().isoformat()}
    try:
        out["res_partner"] = await profile_partners(odoo)
        print("... res.partner OK", file=sys.stderr)
        out["account_move"] = await profile_invoices(odoo)
        print("... account.move OK", file=sys.stderr)
        out["sale_order"] = await profile_sale_orders(odoo)
        print("... sale.order OK", file=sys.stderr)
        out["crm_lead"] = await profile_crm_leads(odoo)
        print("... crm.lead OK", file=sys.stderr)
        out["purchase_order"] = await profile_purchase_orders(odoo)
        print("... purchase.order OK", file=sys.stderr)
        out["product"] = await profile_products(odoo)
        print("... product OK", file=sys.stderr)
        out["timesheets_analytics"] = await profile_timesheets_analytics(odoo)
        print("... timesheets/analytics OK", file=sys.stderr)
    finally:
        await odoo.close()
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
