import sqlite3

conn = sqlite3.connect(r"D:\Neurones-IA\data\local_db\neurones.db")
cur = conn.cursor()

print("=== TABLES ===")
for (t,) in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall():
    cnt = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t:20s}: {cnt:,} lignes")

print("\n=== VENTES VERSUS BANK ===")
rows = cur.execute("""
    SELECT so.name, so.date_order, so.amount, so.currency, so.state
    FROM sale_orders so
    JOIN clients c ON c.client_id = so.client_id
    WHERE c.name LIKE '%VERSUS%'
    ORDER BY so.date_order DESC
    LIMIT 10
""").fetchall()
print(f"Trouve: {len(rows)} bons de commande")
for r in rows:
    d = str(r[1])[:10] if r[1] else "?"
    print(f"  {r[0]} | {d} | {r[2]:>15,.0f} {r[3]} | {r[4]}")

print("\n=== TOP 5 CLIENTS PAR VOLUME DE VENTES ===")
rows = cur.execute("""
    SELECT c.name, COUNT(so.order_id) as nb, SUM(so.amount) as total
    FROM sale_orders so
    JOIN clients c ON c.client_id = so.client_id
    GROUP BY so.client_id
    ORDER BY total DESC
    LIMIT 5
""").fetchall()
for r in rows:
    print(f"  {r[0][:40]:40s} | {r[1]:3d} BDC | {r[2]:>18,.0f} XOF")

conn.close()
