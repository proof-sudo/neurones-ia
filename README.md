# Neurones IA — Plateforme Intelligence Artificielle

Plateforme IA modulaire pour ESN/services IT. Elle connecte un miroir local d'Odoo,
une GED hybride (dense + sparse) et des LLMs (Claude, GPT-4o-mini, Ollama) pour
répondre aux questions métier, scorer des appels d'offres et générer des offres Word.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Prérequis](#prérequis)
4. [Installation locale (dev)](#installation-locale-dev)
5. [Lancement avec Docker](#lancement-avec-docker)
6. [Variables d'environnement](#variables-denvironnement)
7. [API — Endpoints](#api--endpoints)
8. [Base de données SQLite](#base-de-données-sqlite)
9. [GED — Gestion documentaire](#ged--gestion-documentaire)
10. [Jobs planifiés](#jobs-planifiés)
11. [Pages Frontend](#pages-frontend)
12. [Débogage](#débogage)
13. [Problèmes fréquents](#problèmes-fréquents)
14. [Workflow Git](#workflow-git)

---

## Fonctionnalités

### Chat IA — Connaissance métier (`/chat`)
- Questions en langage naturel sur les données Odoo (clients, BDC, factures, contrats)
- Recherche hybride dans la GED (CVs, offres techniques, PV-recette, marchés similaires)
- Réponses en streaming (SSE), historique de sessions, pièces jointes analysables (PDF, DOCX, TXT)
- 6 outils LLM : recherche GED, CRM client, BDC, factures, statistiques, produits

### Avant-vente IA — Scoring AO (`/presales`)
- Upload d'un appel d'offres (PDF ou Word) → analyse complète en 7 étapes :
  1. **Analyse AO** — résumé, critères, budget, prérequis, ressources, vigilance
  2. **Score & Décision** — GO / CONDITIONNEL / NO-BID avec justification RAG
  3. **Stratégie** — plan de réponse généré par Claude Sonnet
  4. **Plan de réponse** — chronogramme structuré
  5. **Offre technique** — document Word professionnel généré
  6. **Checklist dossier** — liste administrative auto-générée, cochable, exportable
  7. **Suivi soumission** — date, canal, confirmation
- Exports Word : analyse, scoring, stratégie, checklist

### GED — Documents (`/ged`)
- Upload drag-drop (PDF, DOCX, TXT)
- Arborescence par catégorie : `cvs/`, `offres-techniques/`, `abe/`, `pv-recette/`, `marches-similaires/`, `procedures/`, `fiches-techniques/`, `comptes-rendus/`
- Indexation automatique (watchdog temps réel + scan nocturne à 2h)
- Re-indexation manuelle via bouton ou API
- Recherche hybride BM25 + ChromaDB avec RRF fusion

### Veille AO (`/veille`)
- Scan de sources configurables (RSS, HTML) toutes les 6h
- Scoring de pertinence 0-100, détection budget et deadline
- Statuts : nouveau / lu / archivé / en avant-vente

### Dashboard (`/`)
- KPIs Odoo en direct : clients, BDC, factures, opportunités
- Sync Odoo toutes les 2 minutes (incrémental)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Nginx (port 80 / 8080)  ←  Reverse proxy               │
│   /api/* → backend:8000                                  │
│   /*      → frontend:3000                                │
└──────────────┬──────────────────┬───────────────────────┘
               │                  │
    ┌──────────▼──────┐  ┌────────▼──────────┐
    │  FastAPI :8000  │  │  Next.js 15 :3000 │
    │  Python 3.12    │  │  React 19 / TS    │
    └──────────┬──────┘  └───────────────────┘
               │
    ┌──────────▼──────────────────────────────────────┐
    │  Services internes                               │
    │  ├── SQLite  (miroir Odoo — clients, BDC, etc.) │
    │  ├── ChromaDB  (vecteurs GED)                   │
    │  ├── BM25 index  (sparse search GED)            │
    │  └── Ollama :11434  (LLM local fallback)        │
    └──────────────────────────────────────────────────┘

LLM Cascade : Claude Haiku 4.5 → GPT-4o-mini → Ollama llama3.1
Embed Cascade : text-embedding-3-small → all-MiniLM-L6-v2
```

### Structure des dossiers

```
neurones-ia/
├── backend/                    ← FastAPI (Python 3.12)
│   ├── adapters/               ← Implémentations concrètes (LLM, CRM, GED, embeddings…)
│   ├── api/v1/                 ← Routers FastAPI (health, auth, chat, presales, ged…)
│   ├── config/
│   │   ├── settings.py         ← Toute la config (pydantic-settings, lit .env)
│   │   └── container.py        ← Injection de dépendances (câble ports ↔ adapters)
│   ├── core/
│   │   ├── domain/             ← Entités métier (Document, Client, Offer…)
│   │   ├── ports/              ← Interfaces abstraites (LLMGateway, CRMRepository…)
│   │   └── services/           ← Services partagés (RAGEngine, QueryDispatcher…)
│   ├── db/
│   │   ├── models.py           ← Modèles SQLAlchemy (14 tables)
│   │   └── database.py         ← Engine SQLite async + session factory
│   ├── jobs/
│   │   ├── scheduler.py        ← APScheduler (4 jobs planifiés)
│   │   └── odoo_sync_job.py    ← ETL Odoo → SQLite
│   ├── modules/
│   │   ├── uc02_capital_knowledge/   ← Chat RAG
│   │   └── uc10_presales/            ← Avant-vente
│   ├── watchers/
│   │   └── ged_watcher.py      ← Watchdog sur data/ged/
│   ├── main.py                 ← Point d'entrée FastAPI
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                   ← Next.js 15.3.2 (TypeScript)
│   ├── app/
│   │   ├── page.tsx            ← Dashboard
│   │   ├── chat/page.tsx       ← Chat IA
│   │   ├── presales/page.tsx   ← Avant-vente
│   │   ├── ged/page.tsx        ← GED
│   │   ├── veille/page.tsx     ← Veille AO
│   │   └── login/page.tsx      ← Authentification
│   ├── components/             ← Composants réutilisables (Sidebar, AppShell…)
│   ├── lib/
│   │   ├── api.ts              ← Toutes les fonctions d'appel API
│   │   └── auth.ts             ← JWT (localStorage)
│   └── Dockerfile
│
├── data/                       ← NON versionné (volumes Docker)
│   ├── ged/                    ← Documents (indexés automatiquement)
│   ├── chromadb/               ← Vecteurs
│   ├── bm25_index/             ← Index BM25 sérialisé
│   ├── local_db/neurones.db    ← SQLite
│   ├── uploads/                ← AOs temporaires
│   └── templates/              ← Templates Word (.docx)
│
├── docker-compose.yml
├── nginx.neurones-ia.conf
├── .env.prod                   ← NON versionné (secrets prod)
├── CONTRIBUTING.md             ← Guide Git pour l'équipe
└── README.md
```

---

## Prérequis

| Outil | Version min | Rôle |
|---|---|---|
| Python | 3.12 | Backend |
| Node.js | 22 | Frontend |
| Docker + Compose | 24 / 2.x | Déploiement |
| Git | 2.x | Versioning |
| Tesseract OCR | 4.x+ | Extraction PDF scannés (pack langue `fra` requis) |

**Clés API nécessaires :**
- `ANTHROPIC_API_KEY` — Claude Haiku + Sonnet ([console.anthropic.com](https://console.anthropic.com))
- `OPENAI_API_KEY` — Embeddings + fallback GPT ([platform.openai.com](https://platform.openai.com))

---

## Installation locale (dev)

### 1. Cloner le projet

```bash
git clone https://github.com/proof-sudo/neurones-ia.git
cd neurones-ia
```

### 2. Backend

```bash
cd backend

# Créer et activer l'environnement virtuel
python -m venv .venv
source .venv/bin/activate        # Linux/Mac
# .\.venv\Scripts\activate       # Windows PowerShell

# Installer les dépendances
pip install -r requirements.txt

# Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env : renseigner ANTHROPIC_API_KEY, OPENAI_API_KEY, ODOO_* ...

# Lancer le backend
uvicorn main:app --reload --port 8000
```

L'API est disponible sur [http://localhost:8000](http://localhost:8000).
Documentation interactive Swagger : [http://localhost:8000/docs](http://localhost:8000/docs).

#### Tesseract OCR (PDF scannés)

L'OCR n'est sollicité que pour les **PDF scannés** (sans couche texte). Il faut le binaire Tesseract **et** le pack de langue français `fra` — sinon l'OCR retombe sur l'anglais et lit mal les accents (un *warning* l'indique dans les logs du backend).

```bash
# Debian / Ubuntu
sudo apt-get install -y tesseract-ocr tesseract-ocr-fra

# macOS (Homebrew) — tesseract-lang fournit toutes les langues dont fra
brew install tesseract tesseract-lang
```

**Windows :**
1. Installer Tesseract via l'installeur [UB-Mannheim](https://github.com/UB-Mannheim/tesseract/wiki) et **cocher « French » dans « Additional language data »**.
2. Si le pack français n'a pas été coché, télécharger `fra.traineddata` et le placer dans le dossier `tessdata` :
   ```powershell
   Invoke-WebRequest `
     -Uri "https://github.com/tesseract-ocr/tessdata/raw/main/fra.traineddata" `
     -OutFile "C:\Program Files\Tesseract-OCR\tessdata\fra.traineddata"
   # (terminal Administrateur requis pour écrire dans Program Files)
   ```
3. Si Tesseract n'est pas installé au chemin par défaut, définir la variable `TESSERACT_CMD` vers `tesseract.exe`.

**Vérifier l'installation** — `fra` doit apparaître dans la liste :
```bash
tesseract --list-langs
```

> En **Docker**, rien à faire : le `Dockerfile` installe déjà `tesseract-ocr` + `tesseract-ocr-fra`.

### 3. Frontend

```bash
cd frontend

# Installer les dépendances
npm install

# Configurer l'URL de l'API
# Dans .env.local (créer le fichier) :
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/v1" > .env.local

# Lancer le frontend
npm run dev
```

L'app est disponible sur [http://localhost:3000](http://localhost:3000).

### 4. Indexer la GED (première fois)

Déposer des documents dans `data/ged/` selon l'arborescence, puis :

```bash
cd backend
python scripts/initial_ingest.py
```

Résultat attendu : tous les fichiers indexés dans ChromaDB + BM25.

---

## Lancement avec Docker

### Développement local

```bash
# Copier le fichier d'env
cp backend/.env.example .env.prod
# Éditer .env.prod avec vos vraies clés

# Lancer tous les services
docker compose up --build

# En arrière-plan
docker compose up --build -d

# Suivre les logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Services et ports

| Service | Port interne | Port exposé | URL |
|---|---|---|---|
| Frontend (Next.js) | 3000 | 3001 (→ Nginx :80/8080) | http://localhost:3001 |
| Backend (FastAPI) | 8000 | 8000 (→ Nginx :80/8080) | http://localhost:8000 |
| Ollama (LLM local) | 11434 | — (localhost only) | http://localhost:11434 |

> En production, Nginx proxy le tout sur le port 80 (DNS) et 8080 (IP directe).

### Commandes Docker utiles

```bash
# Statut des containers
docker compose ps

# Redémarrer un service
docker compose restart backend

# Rebuild d'un seul service
docker compose up --build -d backend

# Accéder au shell du backend
docker compose exec backend bash

# Voir les logs en temps réel
docker compose logs -f --tail=50 backend

# Nettoyer les images inutilisées
docker image prune -f
```

---

## Variables d'environnement

Copier `backend/.env.example` → `.env.prod` (Docker) ou `backend/.env` (dev local).

```env
# ── LLM ─────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...            # Claude Haiku 4.5 + Sonnet 4.6
OPENAI_API_KEY=sk-proj-...             # Embeddings + fallback GPT-4o-mini

# ── Modèles ──────────────────────────────────────────────────────
HAIKU_MODEL=claude-haiku-4-5-20251001  # Modèle Haiku (rapide, peu cher)
SONNET_MODEL=claude-sonnet-4-6         # Modèle Sonnet (génération longue)
EMBEDDING_MODEL=text-embedding-3-small # Embeddings OpenAI

# ── Fallback LLM (si Anthropic indisponible) ─────────────────────
LLM_FALLBACK_ENABLED=true
OPENAI_CHAT_MODEL=gpt-4o-mini
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://ollama:11434    # "ollama" = nom du service Docker
OLLAMA_MODEL=llama3.1

# ── Odoo ─────────────────────────────────────────────────────────
ODOO_URL=https://odoo.neuronestech.com
ODOO_DB=Neurones_Prod
ODOO_USERNAME=admin@neuronestech.com
ODOO_PASSWORD=...
ODOO_SYNC_INTERVAL_MINUTES=2          # Sync incrémentale toutes les 2 min
ODOO_WEBHOOK_SECRET=...               # Secret HMAC pour les webhooks Odoo

# ── Chemins data (relatifs depuis backend/) ───────────────────────
GED_PATH=../data/ged
TEMPLATES_PATH=../data/templates
UPLOADS_PATH=../data/uploads
CHROMADB_PATH=../data/chromadb
BM25_INDEX_PATH=../data/bm25_index
LOCAL_DB_PATH=../data/local_db/neurones.db

# ── RAG ──────────────────────────────────────────────────────────
CHUNK_SIZE=600                        # Taille des chunks (tokens)
CHUNK_OVERLAP=60                      # Overlap entre chunks (10%)
RETRIEVAL_TOP_K=10                    # Candidats avant re-ranking
RERANK_TOP_K=5                        # Chunks finaux envoyés au LLM
MAX_CONTEXT_TOKENS=3000               # Taille max du contexte RAG

# ── Chat ─────────────────────────────────────────────────────────
MAX_HISTORY_TURNS=6                   # Nb de tours gardés en mémoire

# ── Auth JWT ─────────────────────────────────────────────────────
SECRET_KEY=...                        # openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=12

# ── Budget tokens ────────────────────────────────────────────────
TOKEN_BUDGET_MONTHLY_FCFA=130000      # ~200€/mois
TOKEN_ALERT_THRESHOLD_PCT=80          # Alerte à 80% du budget

# ── CORS ─────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# ── App ──────────────────────────────────────────────────────────
APP_ENV=production                    # development | production
LOG_LEVEL=INFO
```

---

## API — Endpoints

Base URL : `http://localhost:8000/v1`

### Authentification

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login → retourne `access_token` JWT |
| `POST` | `/auth/logout` | Invalider la session |
| `GET` | `/auth/me` | Infos de l'utilisateur connecté |

```bash
# Exemple login
curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@neuronestech.com", "password": "..."}'
# Réponse : {"access_token": "eyJ...", "token_type": "bearer"}
```

Tous les endpoints protégés nécessitent le header :
```
Authorization: Bearer eyJ...
```

### Chat (`/chat`)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/chat/query` | **Stream SSE** — question + historique + fichiers joints |
| `POST` | `/chat/query/sync` | Réponse synchrone (tests) |
| `GET` | `/chat/sessions` | Liste des sessions de l'utilisateur |
| `GET` | `/chat/sessions/{id}` | Historique d'une session |
| `DELETE` | `/chat/session/{id}` | Supprimer une session |

```bash
# Exemple streaming
curl -X POST http://localhost:8000/v1/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -F "text=Quel est le CA de Orange CI cette année ?" \
  -F "session_id=abc123" \
  -F "history=[]"
# Réponse : stream SSE avec events type "token", "tool_call", "done"
```

### Avant-vente (`/presales`)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/presales/score` | Scorer un AO (multipart: `file` PDF/DOCX) |
| `POST` | `/presales/bid-strategy` | Générer une stratégie de réponse |
| `POST` | `/presales/generate` | Générer l'offre technique Word |
| `POST` | `/presales/match-team` | Matcher l'équipe aux profils demandés |
| `POST` | `/presales/export-analysis` | Exporter l'analyse en Word |
| `POST` | `/presales/export-scoring` | Exporter le scoring en Word |
| `POST` | `/presales/export-strategy` | Exporter la stratégie en Word |
| `POST` | `/presales/export-checklist` | Exporter la checklist en Word |

### GED (`/ged`)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/ged/list` | Lister tous les documents indexés |
| `POST` | `/ged/upload` | Uploader et indexer un document |
| `DELETE` | `/ged/delete/{doc_id}` | Supprimer un document |
| `POST` | `/ged/reindex` | Re-indexer tous les documents |
| `GET` | `/ged/search?q=...` | Recherche hybride dans la GED |

### Statistiques & CRM

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/stats` | KPIs dashboard (clients, BDC, factures, opportunities) |
| `GET` | `/crm/client/{name}` | Fiche client (lookup direct SQLite) |
| `POST` | `/crm/query` | Requête CRM en langage naturel |

### Santé

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | `{"status": "ok", "version": "0.1.0"}` |

---

## Base de données SQLite

Fichier : `data/local_db/neurones.db`
Miroir local d'Odoo — mis à jour toutes les 2 minutes.

### Tables principales

| Table | Description | Lignes (~) |
|---|---|---|
| `clients` | Clients Odoo (nom, secteur, contact, pays) | 1 377 |
| `sale_orders` | Bons de commande + lignes JSON | 3 051 |
| `invoices` | Factures (montant, statut, échéance) | 2 882 |
| `contracts` | Contrats (valeur, dates, statut) | — |
| `purchase_orders` | Achats fournisseurs | — |
| `dossiers` | Dossiers commerciaux (CA, marge, backlog) | — |
| `opportunities` | Pipeline commercial CRM | 500+ |
| `users` | Utilisateurs (email, rôle, hash mot de passe) | — |
| `conversations` | Historique chat | — |
| `ged_entries` | Registre des documents indexés | — |
| `token_usage` | Budget tokens consommé | — |
| `veille_sources` | Sources de veille AO | — |
| `veille_entries` | AOs détectés par la veille | — |

### Inspecter la DB

```bash
# Via shell Docker
docker compose exec backend bash
sqlite3 /app/data/local_db/neurones.db

# Requêtes utiles
.tables
.schema sale_orders
SELECT COUNT(*), ROUND(SUM(amount)/1e9,2) FROM sale_orders WHERE state!='cancel';
SELECT name, role, is_active FROM users;
```

### Ajouter un utilisateur admin

```bash
docker compose exec backend python3 - << 'EOF'
import asyncio
from db.database import AsyncSessionLocal
from db.models import UserModel
from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"])

async def create_user():
    async with AsyncSessionLocal() as session:
        user = UserModel(
            email="nouveau@neuronestech.com",
            full_name="Prénom Nom",
            hashed_password=pwd.hash("MotDePasse123!"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()
        print("Utilisateur créé")

asyncio.run(create_user())
EOF
```

---

## GED — Gestion documentaire

### Arborescence `data/ged/`

```
data/ged/
├── cvs/                        ← CVs ingénieurs (PDF/DOCX)
├── offres-techniques/          ← Offres déposées
│   └── 2025/CLIENT-ID/
├── abe/                        ← Analyses de besoin
├── pv-recette/                 ← PV de recette projet
│   └── 2025/CLIENT-ID/
├── marches-similaires/         ← Références marchés
├── procedures/                 ← Procédures internes
├── fiches-techniques/          ← Fiches produits/solutions
└── comptes-rendus/             ← CR de réunions
```

### Conventions de nommage

```
cvs/       → NOM-Prenom_TitrePoste.pdf
offres-techniques/ → 2025/ORANGE-CI/offre-reseau-wan-v2.docx
pv-recette/ → 2026/SGCI/pv-recette-infra-datacenter.pdf
```

### Indexation

- **Automatique** : watchdog détecte tout fichier ajouté/modifié dans `data/ged/`
- **Scan nocturne** : tous les jours à 2h du matin (fallback)
- **Manuelle** : bouton "Re-indexer" dans `/ged` ou `POST /v1/ged/reindex`

---

## Jobs planifiés

| Job | Fréquence | Description |
|---|---|---|
| `odoo_sync` | Toutes les **2 min** | ETL incrémental Odoo → SQLite (clients, BDC, factures, dossiers) |
| `ged_scan` | Tous les jours à **2h00** | Scan complet de `data/ged/`, re-indexation si hash modifié |
| `veille_scan` | Toutes les **6h** | Scraping sources RSS/HTML, scoring AOs détectés |
| `budget_reset` | **1er du mois à 00h00** | Remise à zéro du compteur de tokens mensuel |

### Forcer une sync Odoo manuellement

```bash
docker compose exec backend python3 - << 'EOF'
import asyncio
from jobs.odoo_sync_job import run_odoo_sync
asyncio.run(run_odoo_sync(force=True))
EOF
```

---

## Pages Frontend

| Route | Module | Description |
|---|---|---|
| `/` | Dashboard | KPIs Odoo, refresh manuel |
| `/chat` | UC02 | Chat RAG avec streaming, historique, upload docs |
| `/presales` | UC10 | Workflow avant-vente 7 étapes, exports Word |
| `/ged` | GED | Arborescence, upload, suppression, re-indexation |
| `/veille` | Veille | Sources AO, entrées scorées, filtres |
| `/login` | Auth | Formulaire JWT, redirection automatique |

---

## Débogage

### Logs en temps réel

```bash
# Tous les services
docker compose logs -f

# Backend uniquement (le plus utile)
docker compose logs -f backend --tail=100

# Chercher une erreur spécifique
docker compose logs backend 2>&1 | grep -i "error\|exception\|traceback"
```

### Tester l'API directement

```bash
# Health check (pas besoin de token)
curl http://localhost:8000/v1/health

# Login et récupérer un token
TOKEN=$(curl -s -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@neuronestech.com","password":"Neurones2026!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Tester le chat (sync, sans streaming)
curl -X POST http://localhost:8000/v1/chat/query/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Bonjour, qui sont nos 3 meilleurs clients ?","session_id":"test","history":[]}'
```

### Inspecter ChromaDB

```bash
docker compose exec backend python3 - << 'EOF'
import chromadb
client = chromadb.PersistentClient(path="/app/data/chromadb")
cols = client.list_collections()
for c in cols:
    col = client.get_collection(c.name)
    print(f"{c.name}: {col.count()} vecteurs")
EOF
```

### Vérifier les modèles Ollama disponibles

```bash
docker compose exec ollama ollama list
# Si vide, télécharger le modèle :
docker compose exec ollama ollama pull llama3.1
```

### Réinitialiser la base de données

```bash
# ⚠️ Supprime toutes les données locales
docker compose exec backend bash -c "rm /app/data/local_db/neurones.db"
docker compose restart backend
# Puis forcer une resync Odoo
```

---

## Problèmes fréquents

### `Application error: a client-side exception`
**Cause** : Hydration mismatch Next.js (souvent `new Date()` ou `localStorage` au rendu serveur).
**Solution** : Utiliser `useState` + `useEffect` pour tout accès à ces APIs côté client.

### `crypto.randomUUID is not a function`
**Cause** : `crypto.randomUUID()` n'existe pas en HTTP plain (non-HTTPS).
**Solution** : Vérifier `typeof crypto.randomUUID === "function"` avant d'appeler + fallback `Math.random()`.

### `ERR_CONNECTION_REFUSED` sur port 8080
**Cause** : UFW firewall bloque le port.
**Solution** :
```bash
ufw allow 8080/tcp && ufw reload
```

### Backend démarre mais les requêtes Odoo échouent
**Cause** : Credentials Odoo incorrects ou VPN requis.
**Solution** : Vérifier `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_PASSWORD` dans `.env.prod`.
Tester : `docker compose exec backend python3 -c "from adapters.crm.odoo_adapter import OdooAdapter; ..."`

### La GED ne répond pas / RAG vide
**Cause** : ChromaDB vide ou BM25 non initialisé.
**Solution** :
```bash
# Vérifier
docker compose exec backend python3 -c "
import chromadb
c = chromadb.PersistentClient('/app/data/chromadb')
print([col.name + ': ' + str(c.get_collection(col.name).count()) for col in c.list_collections()])
"
# Si vide, re-indexer
curl -X POST http://localhost:8000/v1/ged/reindex \
  -H "Authorization: Bearer $TOKEN"
```

### `ModuleNotFoundError` au démarrage backend
**Cause** : Dépendance manquante ou virtualenv non activé.
**Solution** :
```bash
pip install -r requirements.txt
# ou dans Docker :
docker compose up --build backend
```

### Token JWT expiré (401 sur toutes les requêtes)
**Cause** : Token expire après 12h par défaut.
**Solution** : Se reconnecter via `POST /v1/auth/login` pour obtenir un nouveau token.

### Le déploiement GitHub Actions échoue
**Cause fréquente** : Secret `VPS_SSH_KEY` malformé ou `.env.prod` manquant sur le VPS.
**Vérification** :
```bash
# Sur le VPS
ls -la /opt/neurones-ia/.env.prod
cd /opt/neurones-ia && git pull origin main
docker compose up --build -d 2>&1 | tail -20
```

---

## Workflow Git

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le guide complet.

```
feature/ma-feature  →  dev  →  main  →  déploiement automatique VPS
```

- `dev` : branche d'intégration équipe
- `main` : préprod — tout merge déclenche un déploiement automatique
- Jamais de push direct sur `main`

---

## Contacts

| Rôle | Contact |
|---|---|
| Responsable technique | dtraore@neuronestech.com |
| Application (préprod) | http://76.13.51.87:8080 |
| Repo GitHub | https://github.com/proof-sudo/neurones-ia |
| Odoo (production) | https://odoo.neuronestech.com |
