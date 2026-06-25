# Base de connaissance — GED Neurones IA

> Document de référence destiné à un Projet Claude.ai. Il décrit l'architecture, le
> pipeline d'indexation et les fonctionnalités de la Gestion Électronique des Documents
> (GED) du monorepo `neurones-ia`. À jour de la branche `feature/refont_ged`.

---

## 1. Vue d'ensemble

La **GED** est le sous-système de Neurones IA chargé d'ingérer, d'indexer et de rendre
recherchables les documents métiers de l'entreprise (CV d'ingénieurs, offres techniques,
appels d'offres, marchés publics, procédures, PV de recette, comptes rendus, fiches
techniques). Elle alimente un moteur de **recherche hybride RAG** qui sert de socle au
chat/assistant.

**Objectifs clés :**
- Indexer automatiquement tout document déposé (temps réel + scan de secours).
- Extraire des métadonnées structurées par type de document (via LLM).
- Découper intelligemment chaque document selon sa nature (chunking adaptatif).
- Permettre une recherche précise (passages) tout en fournissant un contexte large au LLM
  (stratégie *small-to-big* parent-enfant).
- Respecter le RGPD (détection PII, suppression physique des CV).
- Ne jamais perdre silencieusement un document : échec de validation = **quarantaine**.

---

## 2. Stack technique

| Couche | Technologie |
|---|---|
| Backend API | Python 3.12 · FastAPI · Uvicorn |
| Frontend | Next.js 15 · React 19 · TypeScript · shadcn |
| Base vectorielle (dense) | ChromaDB (PersistentClient) |
| Recherche lexicale (sparse) | BM25 (`rank_bm25.BM25Okapi`) |
| Registre / métadonnées | SQLite async (SQLAlchemy 2.0 + aiosqlite) |
| Embeddings | `all-MiniLM-L6-v2` (384 dims) · `text-embedding-3-small` (OpenAI, 1536 dims) |
| LLM | Claude Haiku 4.5 → GPT-4o-mini → Ollama (llama3.1) en cascade |
| Parsing documents | pdfplumber · pymupdf · python-docx · pytesseract (OCR) |
| Planification | APScheduler |
| Surveillance fichiers | watchdog |

**Dépendances notables** : `anthropic==0.40.0`, `openai==1.57.0`, `chromadb==0.5.23`,
`rank-bm25==0.2.2`, `sentence-transformers==3.3.1`, `langchain==0.3.9`, `tiktoken==0.8.0`.

---

## 3. Architecture (hexagonale / ports & adapters)

Le backend suit une architecture en couches :

- **API** (`backend/api/v1/ged.py`) — endpoints REST.
- **Services métier** (`backend/core/services/`) — logique d'indexation, chunking, RAG.
- **Domaine** (`backend/core/domain/document.py`) — entités `Document`, `Chunk`, `Source`.
- **Adapters** (`backend/adapters/`) — implémentations concrètes (ChromaDB, BM25, SQLite,
  LLM, embeddings). Branchés via un conteneur d'injection de dépendances
  (`backend/config/container.py`).

Cette séparation permet de remplacer un adapter (ex. ChromaDB → pgvector) sans toucher à
la couche service.

**Catégories de documents supportées (8)** et famille de chunking associée :

| Type de document | Famille | Stratégie de chunking |
|---|---|---|
| CV ingénieurs | B | Contextuel |
| Offres techniques | B | Contextuel |
| ABE / Marchés publics | A | Hiérarchique |
| Appels d'offres (AO) | A | Hiérarchique |
| Procédures internes | A | Hiérarchique |
| Fiches techniques | A | Hiérarchique |
| PV de recette | C | Agenda |
| Comptes rendus | C | Agenda |

Formats acceptés : `.pdf`, `.docx`, `.doc`, `.txt`.

---

## 4. Pipeline d'indexation (`GEDIndexer`)

Fichier : `backend/core/services/ged_indexer.py`. Pipeline **incrémental en 8 étapes**,
exécuté de façon asynchrone :

1. **Vérification de hash (SHA-256)** — lecture par blocs. Si le hash est identique à
   l'entrée existante, le document est ignoré (sauf `force=True`).
2. **Extraction de texte** — essai en cascade PDF → DOCX → TXT, avec fallback OCR pour les
   PDF non extractibles.
3. **Validation qualité** (`QualityValidator`) — texte ≥ 100 caractères ; pour un PDF
   > 10 Ko, ratio minimal de 0.8 char/Ko. En cas d'échec → **quarantaine** (jamais de
   suppression silencieuse).
4. **Extraction de métadonnées par LLM** (`MetadataExtractor`) — Claude Haiku 4.5 via
   `tool_use` (sortie JSON structurée garantie, jamais de texte libre). Texte tronqué à
   3 000 caractères. Un schéma JSON par type de document (ex. CV → nom, rôle, années
   d'expérience, compétences, certifications, diplômes, langues ; AO → client, secteur,
   budget estimé, date limite, statut).
5. **Détection PII** (`PIIDetector`) — regex sur 5 catégories (NSS français, IBAN, email,
   téléphone FR/CI/SN, date de naissance). **Activée uniquement pour les CV** (RGPD).
   Produit un `PIIReport(has_pii, categories)`. Détection seulement : le contenu n'est pas
   masqué (les CV restent exploitables).
6. **Chunking adapté au type** (`ChunkingRouter`) — route vers l'une des 4 stratégies
   (voir §5).
7. **Embeddings par batch** — jusqu'à 96 chunks par lot, puis upsert dans ChromaDB.
8. **Indexation sparse + registre** — ajout des chunks à l'index BM25 ; upsert de l'entrée
   dans la table SQLite `ged_entries` (doc_id, file_path, hash, doc_type, last_indexed,
   vector_ids). Retrait de la quarantaine si le document y figurait.

---

## 5. Stratégie de chunking *small-to-big* (parent-enfant)

Principe : un document est découpé en **chunks parents** (gros blocs, contexte large) et
**chunks enfants** (petits passages, matching précis). À la recherche, on retrouve l'enfant
pertinent puis on remonte son parent pour donner du contexte au LLM. Le lien est porté par
`child.parent_chunk_id = parent.chunk_id`.

Entité `Chunk` (`backend/core/domain/document.py`) :

```python
@dataclass
class Chunk:
    chunk_id: str
    doc_id: str
    content: str
    token_count: int
    chunk_index: int
    metadata: DocumentMetadata
    parent_chunk_id: Optional[str] = None  # référence au parent
    is_parent: bool = False
```

Le routeur (`backend/core/services/chunking/router.py`) choisit la stratégie :

- **HierarchicalChunker** (famille A — `hierarchical.py`) : détecte les sections via regex
  (« Article X », « 1. Titre », titres en MAJUSCULES…). Chaque section devient un parent ;
  elle est ensuite redécoupée en enfants de ~200 mots (overlap 20), chacun préfixé de
  `[Section: {titre}]`.
- **ContextualChunker** (famille B — `contextual.py`) : parents de 1600 mots (CV) ou
  1200 mots (offres) ; enfants de 200 mots (overlap 30). **Un en-tête structuré est injecté
  dans chaque chunk** (ex. `[Ingénieur: Jean Dupont | Rôle: Lead Dev | Exp: 5 ans |
  Skills: Go, Rust…]`) pour qu'un enfant isolé reste auto-suffisant au matching.
- **AgendaChunker** (famille C — `agenda.py`) : détecte les points d'ordre du jour
  (« 1. Point », « ODJ 3 »…). Chaque point devient un chunk autonome annoté
  (`[PV | Date | Point X]`). Fallback plat (400 mots, overlap 40) si aucun marqueur.
- **FlatChunker** (défaut — `flat.py`) : découpe par mots (600 mots, overlap 60). Utilisé
  pour les types non mappés.

---

## 6. Stockage et index

- **ChromaDB** (`adapters/vector_store/chromadb_adapter.py`) — collection `neurones_ged`,
  métrique cosine. Stocke embeddings + contenus + métadonnées aplaties (doc_id, filename,
  doc_type, extracted_fields JSON, contains_pii, parent_chunk_id, is_parent…). Dimension
  détectée au runtime (384 ou 1536), recréation auto si elle change. Comptage approximatif
  mis en cache.
- **BM25** (`adapters/sparse_search/bm25_adapter.py`) — corpus tokenisé, persisté en pickle
  (`bm25.pkl` + `bm25_meta.json`), rebuild incrémental.
- **Embeddings** — `SentenceTransformersAdapter` (MiniLM, CPU-friendly, lazy load) ou
  `OpenAIEmbedAdapter` ; `FallbackEmbedAdapter` bascule automatiquement OpenAI →
  sentence-transformers si le quota est épuisé.
- **Registre SQLite** (`adapters/registry/sqlite_registry_adapter.py`, modèle
  `GEDEntryModel`) — source de vérité des documents indexés ; `is_active` pour le
  soft-delete ; `vector_ids` référence les chunks dans ChromaDB.

---

## 7. Recherche hybride RAG (`RAGEngine`)

Fichier : `backend/core/services/rag_engine.py`. Méthode
`search(query, filter_metadata, top_k, rerank)` :

1. **Parallélisation** dense (embedding de la requête) + sparse (BM25).
2. **Dense** : similarité cosine sur `neurones_ged` (filtre optionnel par doc_type…).
3. **Sparse** : ranking BM25Okapi.
4. **Fusion RRF (Reciprocal Rank Fusion)**, k = 60 :
   `score[cid] = 1/(60 + rang_dense + 1) + 1/(60 + rang_sparse + 1)`. Les chunks remontés
   uniquement par BM25 sont enrichis depuis ChromaDB.
5. **Reranking cross-encoder** *(optionnel, `rerank_enabled=False` par défaut)* —
   `ms-marco-MiniLM-L-6-v2` re-score le top 20.
6. **Diversité & dédoublonnage** — max 2 chunks par document ; dédoublonnage par parent.
7. **Expansion parent (small-to-big)** — pour chaque chunk retenu ayant un parent :
   `content` (envoyé au LLM) = contenu du **parent** ; `excerpt` (citation affichée) =
   contenu de l'**enfant**.

Entité `Source` retournée : `doc_id`, `filename`, `doc_type`, `excerpt`,
`relevance_score`, `content` (contexte complet), `parent_chunk_id`.

---

## 8. Fonctionnalités GED

### Quarantaine (`adapters/registry/quarantine_adapter.py`)
Tout document échouant la validation qualité y est placé avec un motif lisible
(ex. « Texte trop court : 45 caractères »), un `retry_count`, la taille et la longueur de
texte. Opérations : `add`, `list_all`, `remove`, `remove_resolved` (dédoublonne les chemins
absolu/relatif), `purge_expired` (auto-suppression après N jours, défaut 7).

### Suppression & RGPD
- **Soft-delete** (`mark_deleted`, `is_active=False`) pour la plupart des documents.
- **Hard-delete** (`hard_delete`) réservé aux **CV** (purge physique du registre — RGPD).
- `DELETE /ged/files/{doc_id}` supprime le fichier disque + les vecteurs ChromaDB + l'index
  BM25 + l'entrée registre.

### Observabilité
- `GET /ged/documents/{doc_id}/chunks` — inspection détaillée de chaque chunk (is_parent,
  parent_chunk_id, word/char count, métadonnées extraites, flag PII).
- `GET /ged/index-health` — stats ChromaDB + registre, et détection d'anomalies :
  `in_registry_without_chunks` (migration ratée) et `in_vector_without_registry` (vecteurs
  orphelins).
- `POST /ged/search-debug` vs `POST /ged/search-prod` — debug chunk-par-chunk
  (scores dense/sparse/RRF) versus résultat fusionné réellement servi au chat.

---

## 9. Endpoints API (`backend/api/v1/ged.py`)

| Méthode | Endpoint | Rôle |
|---|---|---|
| GET | `/ged/tree` | Arborescence des dossiers + comptage |
| GET | `/ged/status` | Stats globales (indexés, par type, dernier indexage) |
| GET | `/ged/files` | Liste filtrable (dossier, recherche texte) |
| GET | `/ged/quarantine` | Fichiers en quarantaine + motif |
| GET | `/ged/documents/{doc_id}/chunks` | Inspection des chunks |
| GET | `/ged/index-health` | Métriques de santé + anomalies |
| POST | `/ged/upload` | Upload + indexation asynchrone |
| POST | `/ged/reindex` | Réindexation de masse (option `force`) |
| POST | `/ged/folders` | Création de dossier |
| POST | `/ged/search-debug` | Recherche hybride détaillée |
| POST | `/ged/search-prod` | Recherche hybride de production |
| POST | `/ged/quarantine/retry` | Retenter l'indexation d'un fichier quarantiné |
| DELETE | `/ged/files/{doc_id}` | Suppression complète (disque + index + registre) |
| DELETE | `/ged/quarantine` | Suppression d'un fichier en quarantaine |
| DELETE | `/ged/folders` | Suppression de dossier (avec désindexation) |

---

## 10. Indexation temps réel & jobs planifiés

**File watcher** (`backend/watchers/ged_watcher.py`) — `GEDWatcher` surveille le dossier
GED (récursif) via watchdog, avec **debounce de 3 s** (Word/PDF génèrent de nombreux events
à l'enregistrement) et dédoublonnage par timestamp. `on_deleted` déclenche une suppression
immédiate. Le type de document est inféré depuis le chemin du dossier.

**Jobs APScheduler** (`backend/jobs/scheduler.py`) :

| Job | Déclenchement | Rôle |
|---|---|---|
| `ged_scan` | Cron 02:00 | Scan de nuit (filet de secours si le watcher a raté un fichier) |
| `quarantine_purge` | Cron 03:30 | Purge des entrées de quarantaine périmées + fichiers |
| `budget_reset` | Cron 01/01 00:00 | Reset du budget de tokens mensuel |
| `odoo_sync` | Intervalle | Sync incrémentale Odoo → SQLite |
| `veille_scan` | Intervalle 6 h | Scan de sources RSS/HTML (appels d'offres) |

Jobs configurés en `coalesce` et `max_instances=1` (pas d'exécutions parallèles).

---

## 11. LLM, coûts et budget

Cascade LLM (`adapters/llm/`) : **Claude Haiku 4.5** (extraction de métadonnées, chat,
classification ; prompt caching éphémère) → **GPT-4o-mini** (fallback si l'API Anthropic
est indisponible) → **Ollama / llama3.1** (fallback local).

`TokenBudgetManager` (`backend/core/services/token_budget_manager.py`) compte les tokens
réels (tiktoken `cl100k_base`), calcule le coût en USD puis le convertit en FCFA
(1 USD = 600 FCFA), et alerte au-delà de 80 % du budget mensuel.

---

## 12. Configuration (`backend/config/settings.py`)

| Paramètre | Valeur par défaut |
|---|---|
| `ged_path` | `../data/ged` |
| `chromadb_path` | `../data/chromadb` |
| `bm25_index_path` | `../data/bm25_index` |
| `local_db_path` | `../data/local_db/neurones.db` |
| `chunk_size` / `chunk_overlap` | 600 / 60 mots |
| `retrieval_top_k` / `rerank_top_k` | 10 / 5 |
| `max_context_tokens` | 3000 |
| `rerank_enabled` | `False` |
| `quarantine_retention_days` | 7 |

---

## 13. Principes de conception à retenir

1. **Chunking adaptatif** : 4 stratégies selon le type de document.
2. **Parent-enfant (*small-to-big*)** : matching précis sur les enfants, contexte large via
   les parents.
3. **Recherche hybride** : la fusion RRF dense + sparse évite la dépendance à un seul moteur.
4. **Validation multi-étapes** : qualité → métadonnées → PII → chunking → index.
5. **RGPD par conception** : hard-delete des CV, détection PII.
6. **Quarantaine intelligente** : un échec de validation n'efface jamais le document ;
   retry + auto-purge configurable.
7. **Observabilité** : inspection des chunks, health check, mode search-debug.
8. **Évolutivité** : la couche service est découplée des adapters (ChromaDB → pgvector
   possible sans réécriture).
