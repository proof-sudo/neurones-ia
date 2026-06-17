# -*- coding: utf-8 -*-
"""Test de l'endpoint /v1/chat/query sur des questions professionnelles GED."""
import sys, io, json, time, requests
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = "http://localhost:8000"
EMAIL, PWD = "psoro@neuronestech.com", "Stalker"

QUESTIONS = [
    "Combien de documents la GED contient-elle exactement et comment sont-ils organisés (dossiers / catégories) ?",
    "Quels CV et certifications avons-nous dans la GED ? Listez les certifications réseaux et sécurité disponibles.",
    "Quels domaines techniques sont couverts par notre documentation ABE (fiches techniques) ?",
    "Avons-nous des compétences certifiées Cisco et Huawei dans nos ressources ? Lesquelles ?",
]

def login():
    r = requests.post(f"{BASE}/v1/auth/login", json={"email": EMAIL, "password": PWD}, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]

def ask(token, text, sid):
    headers = {"Authorization": f"Bearer {token}", "Accept": "text/event-stream"}
    data = {"text": text, "session_id": sid, "history": "[]"}
    full, tools = "", []
    t0 = time.time()
    with requests.post(f"{BASE}/v1/chat/query", data=data, headers=headers, stream=True, timeout=180) as resp:
        for raw in resp.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data: "):
                continue
            d = raw[6:]
            if d == "[DONE]":
                break
            try:
                obj = json.loads(d)
            except Exception:
                continue
            t = obj.get("type", "")
            if t == "token":
                full += obj.get("content", "")
            elif t == "tool_call":
                tools.append(obj.get("tool", "?"))
    return full.strip(), tools, time.time() - t0

def main():
    print("Connexion en tant que", EMAIL, "...")
    token = login()
    print("OK\n")
    for i, q in enumerate(QUESTIONS, 1):
        print("=" * 90)
        print(f"Q{i}: {q}")
        print("-" * 90)
        ans, tools, dt = ask(token, q, f"gedtest{i}")
        print(f"[outils appelés: {tools or 'aucun'}]  [{dt:.1f}s]")
        print(ans or "(réponse vide)")
        print()

if __name__ == "__main__":
    main()
