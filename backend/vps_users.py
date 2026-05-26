"""Affiche les comptes utilisateurs sur le VPS."""
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "187.127.228.104"
VPS_USER = "root"
VPS_PASS = "&RE1KN&.#rLzQ0?M"
REMOTE_DIR = "/opt/neurones-ia"

def run(client, cmd, timeout=20):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    return (out + err).strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)

# Requete SQLite directe dans le volume
print("=== Comptes utilisateurs ===")
print(run(client,
    "docker compose -f /opt/neurones-ia/docker-compose.yml exec -T backend "
    "sqlite3 /app/data/local_db/neurones.db "
    "'SELECT id, email, full_name, role, is_active FROM users;'",
    timeout=15))

# Aussi verifier via python plus simple
print("\n=== Via python sqlite3 ===")
print(run(client,
    "docker compose -f /opt/neurones-ia/docker-compose.yml exec -T backend "
    "python3 -c '"
    "import sqlite3; "
    "c=sqlite3.connect(\"/app/data/local_db/neurones.db\"); "
    "rows=c.execute(\"SELECT email,role,is_active FROM users\").fetchall(); "
    "[print(r) for r in rows]; "
    "c.close()"
    "'",
    timeout=15))

client.close()
