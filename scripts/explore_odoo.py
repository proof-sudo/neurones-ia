"""
Script d'exploration Odoo — teste la connexion et affiche les données disponibles.
Usage: ODOO_URL=... ODOO_DB=... ODOO_USERNAME=... ODOO_PASSWORD=... python scripts/explore_odoo.py
Jamais de credentials en dur ici (mandat sécurité) — variables d'environnement uniquement.
"""
import json
import os
import sys
import urllib.request
import urllib.error

REQUIRED = ("ODOO_URL", "ODOO_DB", "ODOO_USERNAME", "ODOO_PASSWORD")
missing = [name for name in REQUIRED if not os.environ.get(name)]
if missing:
    print(f"Variables d'environnement manquantes : {', '.join(missing)}")
    sys.exit(1)

ODOO_URL  = os.environ["ODOO_URL"]
ODOO_DB   = os.environ["ODOO_DB"]
ODOO_USER = os.environ["ODOO_USERNAME"]
ODOO_PASS = os.environ["ODOO_PASSWORD"]


def rpc(endpoint: str, params: dict) -> dict:
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "call",
        "id": 1,
        "params": params,
    }).encode()
    req = urllib.request.Request(
        f"{ODOO_URL}{endpoint}",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:300]}")
        sys.exit(1)
    except Exception as e:
        print(f"Erreur réseau: {e}")
        sys.exit(1)


def call_kw(model: str, method: str, args: list, kwargs: dict = None, uid: int = None, password: str = None) -> list:
    result = rpc("/web/dataset/call_kw", {
        "model": model,
        "method": method,
        "args": args,
        "kwargs": kwargs or {},
    })
    if "error" in result:
        print(f"  Erreur RPC [{model}.{method}]: {result['error'].get('data', {}).get('message', result['error'])}")
        return []
    return result.get("result", [])


def sep(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


# ─── 1. Authentification ────────────────────────────────────────
sep("1. AUTHENTIFICATION")
auth = rpc("/web/session/authenticate", {
    "db": ODOO_DB,
    "login": ODOO_USER,
    "password": ODOO_PASS,
})

if "error" in auth:
    print(f"ÉCHEC: {auth['error']}")
    sys.exit(1)

result = auth.get("result", {})
uid = result.get("uid")
if not uid:
    print(f"ÉCHEC auth — réponse: {json.dumps(result, indent=2)[:500]}")
    sys.exit(1)

print(f"✓ Connecté — uid={uid}, name={result.get('name')}, company={result.get('company_id')}")
session_id = auth.get("id")


# ─── 2. Clients (res.partner) ───────────────────────────────────
sep("2. CLIENTS (res.partner) — 10 premiers")
partners = call_kw(
    "res.partner", "search_read",
    [[["is_company", "=", True], ["customer_rank", ">", 0]]],
    {"fields": ["id", "name", "email", "phone", "industry_id", "city", "country_id"], "limit": 10, "order": "name asc"},
)
print(f"Trouvé: {len(partners)} clients")
for p in partners:
    print(f"  [{p['id']}] {p['name']} | {p.get('email','—')} | {p.get('city','—')}")


# ─── 3. Factures (account.move) ─────────────────────────────────
sep("3. FACTURES (account.move) — 10 dernières")
invoices = call_kw(
    "account.move", "search_read",
    [[["move_type", "=", "out_invoice"], ["state", "=", "posted"]]],
    {"fields": ["id", "name", "partner_id", "amount_total", "currency_id", "invoice_date", "invoice_date_due", "payment_state"], "limit": 10, "order": "invoice_date desc"},
)
print(f"Trouvé: {len(invoices)} factures")
for inv in invoices:
    print(f"  [{inv['id']}] {inv['name']} | {inv.get('partner_id', [None,'—'])[1]} | {inv.get('amount_total',0):,.0f} {inv.get('currency_id',[None,'XOF'])[1]} | {inv.get('payment_state')}")


# ─── 4. Projets (project.project) ───────────────────────────────
sep("4. PROJETS (project.project) — 10 premiers")
projects = call_kw(
    "project.project", "search_read",
    [[]],
    {"fields": ["id", "name", "partner_id", "date_start", "date", "description", "user_id"], "limit": 10, "order": "name asc"},
)
print(f"Trouvé: {len(projects)} projets")
for pr in projects:
    print(f"  [{pr['id']}] {pr['name']} | client={pr.get('partner_id', [None,'—'])[1] if pr.get('partner_id') else '—'} | {pr.get('date_start','—')} → {pr.get('date','—')}")


# ─── 5. Comptes analytiques / Contrats ──────────────────────────
sep("5. COMPTES ANALYTIQUES (account.analytic.account)")
analytics = call_kw(
    "account.analytic.account", "search_read",
    [[]],
    {"fields": ["id", "name", "partner_id", "code", "plan_id"], "limit": 10, "order": "name asc"},
)
print(f"Trouvé: {len(analytics)} comptes analytiques")
for a in analytics:
    print(f"  [{a['id']}] {a['name']} | partner={a.get('partner_id', [None,'—'])[1] if a.get('partner_id') else '—'} | code={a.get('code','—')}")


# ─── 6. Bons de commande / Ventes (sale.order) ──────────────────
sep("6. COMMANDES CLIENTS (sale.order) — 10 dernières")
sales = call_kw(
    "sale.order", "search_read",
    [[["state", "in", ["sale", "done"]]]],
    {"fields": ["id", "name", "partner_id", "amount_total", "currency_id", "date_order", "state"], "limit": 10, "order": "date_order desc"},
)
print(f"Trouvé: {len(sales)} commandes")
for s in sales:
    print(f"  [{s['id']}] {s['name']} | {s.get('partner_id', [None,'—'])[1]} | {s.get('amount_total',0):,.0f} | {s.get('state')}")


# ─── 7. Modules installés (pour info) ───────────────────────────
sep("7. MODULES INSTALLÉS (pertinents)")
modules = call_kw(
    "ir.module.module", "search_read",
    [[["state", "=", "installed"], ["name", "in", [
        "sale", "project", "account", "account_accountant",
        "analytic", "crm", "hr", "hr_contract", "maintenance",
        "helpdesk", "subscription", "sale_subscription",
    ]]]],
    {"fields": ["name", "shortdesc", "installed_version"], "order": "name asc"},
)
print(f"Modules installés pertinents:")
for m in modules:
    print(f"  {m['name']:30s} v{m.get('installed_version','?'):<12} — {m.get('shortdesc','')}")

print("\n✓ Exploration terminée.\n")
