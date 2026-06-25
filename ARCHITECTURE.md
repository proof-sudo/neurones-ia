# ARCHITECTURE — Cartographie de l'existant (Phase 0)

> Produit en **Phase 0** du *RAG Upgrade Playbook* (`docs/rag-upgrade-playbook.md`).
> Objectif : documenter les pipelines d'ingestion et de requête actuels, puis
> identifier les points d'extension pour brancher une **couche structurée**
> (extraction typée → base relationnelle → routeur text-to-SQL) **sans rien casser**.
>
> ⚠️ Ce document **décrit l'existant** et **propose un plan**. Aucune ligne de code
> n'a été modifiée. Voir aussi `BASE_CONNAISSANCE_GED.md` (référence détaillée du GED).

---

## 0. Stack & repères

- Backend : **Python 3.12 · FastAPI**, architecture **hexagonale** (`core/ports` ⇄ `adapters/`),
  câblage par conteneur DI ([backend/config/container.py](backend/config/container.py)).
- Vectoriel (dense) : **ChromaDB** · Lexical (sparse) : **BM25** · Fusion **RRF**.
- Relationnel : **SQLite async** (SQLAlchemy 2.0 + aiosqlite), une seule base
  `../data/local_db/neurones.db` ([backend/db/database.py](backend/db/database.py)).
- LLM : cascade **Claude Haiku 4.5 → GPT-4o-mini → Ollama** ([backend/config/container.py:75-91](backend/config/container.py#L75-L91)).
- Embeddings : OpenAI `text-embedding-3-small` (1536) → fallback `all-MiniLM-L6-v2` (384).

---

## 1. Pipeline d'ingestion actuel

**Orchestrateur** : `GEDIndexer.process()` — [backend/core/services/ged_indexer.py:67-172](backend/core/services/ged_indexer.py#L67-L172).
Déclencheurs : watcher temps réel ([backend/watchers/ged_watcher.py](backend/watchers/ged_watcher.py)),
scan nocturne 02:00 ([backend/jobs/scheduler.py](backend/jobs/scheduler.py)), upload API
(`POST /ged/upload`), réindexation (`POST /ged/reindex`).

| # | Étape | Composant | Détail |
|---|-------|-----------|--------|
| 1 | **Hash check** | `_compute_hash_sync` | SHA-256 par blocs ; si inchangé et `force=False` → skip. **Idempotence native.** |
| 2 | **Parsing** | `PDFAdapter` / `DocxAdapter` + fallback `.txt` | Cascade PDF→DOCX→TXT, fallback OCR (pytesseract). |
| 3 | **Validation qualité** | `QualityValidator` | Échec → **quarantaine** (`QuarantineAdapter`), jamais de perte silencieuse. |
| 4 | **Extraction métadonnées LLM** | `MetadataExtractor` | Claude Haiku via `tool_use`, **un schéma JSON par type**. Sortie → `dict extracted_fields`. Texte tronqué à 3000 car. |
| 5 | **Détection PII** | `PIIDetector` | CV uniquement (RGPD). |
| 6 | **Chunking adaptatif** | `ChunkingRouter` | 4 stratégies (hiérarchique/contextuel/agenda/plat), parent-enfant *small-to-big*. |
| 7 | **Embeddings + upsert** | `Embedder` + `ChromaDBAdapter` | Batch ≤ 96, upsert collection `neurones_ged`. |
| 8 | **Sparse + registre** | `BM25Adapter` + `SQLiteRegistryAdapter` | Index BM25 ; upsert `ged_entries` (doc_id, file_path, hash, doc_type, vector_ids). |

### Constat clé sur l'étape 4 (extraction typée)

Une extraction typée **existe déjà** ([backend/core/services/metadata_extractor.py](backend/core/services/metadata_extractor.py))
mais :

- Sa sortie (`extracted_fields`) est un **dict libre** posé dans `DocumentMetadata`
  ([backend/core/domain/document.py:33](backend/core/domain/document.py#L33)), **aplati dans les
  métadonnées ChromaDB** uniquement. **Elle n'est PAS écrite dans une table relationnelle**
  → impossible de faire `COUNT`, `SUM`, filtres `> X`, ou jointures dessus.
- Les schémas actuels sont **plus pauvres** que ceux du playbook (ex. CV = nom/role/skills…,
  sans expériences typées ni montants ; AO sans `references_demandees`).
- Montants/dates restent des **chaînes** (`budget_estime: "200M FCFA"`) → non filtrables.
- Pas de validation Pydantic stricte : on prend `tool_calls[0]["input"]` tel quel.

C'est exactement le gap que la couche structurée vient combler.

---

## 2. Pipeline de requête actuel

> 🔧 **Correction (constatée en Phase 3).** Le **vrai chemin de production** n'est PAS
> `QueryDispatcher` mais un **chat agentique à tool-use** dans
> [backend/modules/uc02_capital_knowledge/router.py](backend/modules/uc02_capital_knowledge/router.py)
> (endpoints `chat_query` SSE + `chat_query_sync`). Le LLM y dispose d'~18 outils
> (`rechercher_clients`, `obtenir_donnees_client`, **`executer_analyse_sql`**, RAG GED…)
> et **choisit lui-même** lesquels appeler — c'est lui le « routeur ». Le
> `QueryDispatcher` ci-dessous (intentions `{rag, local_db, hybrid}`) est un chemin
> **secondaire/legacy**. Conséquence majeure : **un text-to-SQL existe déjà** via
> `executer_analyse_sql`, mais contre les **tables Odoo** (et, avant la Phase 3, sur la
> connexion read-write sans liste blanche → exposition de `users`). La **Phase 3** s'est
> donc branchée dans ce routeur agentique (nouvel outil `interroger_documents` sur `kb_*` +
> connexion lecture seule + garde-fou partagé `sql_guard`), pas dans `QueryDispatcher`.

Chemin **legacy** : `POST /chat` → [backend/api/v1/chat.py](backend/api/v1/chat.py) → UC02 router →
`CapitalKnowledgeUseCase.query()` ([backend/modules/uc02_capital_knowledge/use_case.py](backend/modules/uc02_capital_knowledge/use_case.py))
→ **`QueryDispatcher.dispatch()`** ([backend/core/services/query_dispatcher.py:158-182](backend/core/services/query_dispatcher.py#L158-L182)).

```
question ─▶ QueryDispatcher.dispatch
              │  1. classify intent (règles regex, puis LLM si ambigu)
              │     intentions = { rag | local_db | hybrid }
              ├─ rag / hybrid   ─▶ RAGEngine.search()  (dense+sparse → RRF → rerank? → parent-expand)
              ├─ local_db/hybrid─▶ _build_crm_context() (Python codé en dur sur le miroir Odoo)
              └─▶ _generate_answer()  (LLM, cite [fichier.docx])
```

**Recherche RAG** (`RAGEngine.search` — [backend/core/services/rag_engine.py](backend/core/services/rag_engine.py)) :
dense (Chroma) ∥ sparse (BM25) → fusion **RRF** (k=60) → rerank cross-encoder *(off par défaut)*
→ diversité (max 2/doc) → **expansion parent** (small-to-big). Retourne des `Source`.

### Constats clés sur la requête

- ~~**Aucun text-to-SQL n'existe.**~~ *(Corrigé en Phase 3 — voir l'encadré ci-dessus :*
  *`executer_analyse_sql` fait déjà du text-to-SQL sur le miroir Odoo. La Phase 3 ajoute*
  *`interroger_documents` sur `kb_*` en lecture seule.)* Le chemin `local_db` du
  `QueryDispatcher` legacy, lui, reste du **Python impératif** + regex FR.
- Le **routeur existant** (`{rag, local_db, hybrid}`) a une taxonomie **différente** de
  celle du playbook (`{factuel_document, analytique, croisement}`). Le nouveau chemin
  *analytique/croisement sur documents* est une **4ᵉ voie** à intégrer.
- La traçabilité s'arrête au **nom de fichier** (`[Offre-X.docx]`). Le champ
  `Source.page` existe ([document.py:79](backend/core/domain/document.py#L79)) mais **n'est pas
  peuplé** par les chunkers aujourd'hui.

---

## 3. Couche relationnelle existante

`db/models.py` contient déjà des tables, **toutes alimentées par Odoo** (CRM/ERP), pas par
les documents : `clients`, `projects`, `contracts`, `invoices`, `sale_orders`,
`purchase_orders`, `dossiers`, `opportunities`, + `ged_entries`, `quarantine`, `users`…
([backend/db/models.py](backend/db/models.py)).

> ⚠️ **Collision de noms à éviter** : les tables `clients` et `projects` existent **déjà**
> (miroir Odoo). Les **entités canoniques du playbook** (clients/personnes/projets issus
> des *documents*) devront porter des noms distincts (préfixe proposé `kb_*`, « knowledge
> base ») pour ne pas écraser le CRM.

Base unique, créée au démarrage via `Base.metadata.create_all` ([database.py:38-41](backend/db/database.py#L38-L41)),
PRAGMA WAL activés. Une seule `engine` async (lecture+écriture) aujourd'hui.

---

## 4. Couverture des 6 types du playbook (`DocumentType`)

[backend/core/domain/document.py:7-18](backend/core/domain/document.py#L7-L18) :

| Playbook | `DocumentType` existant | Schéma extraction §4 existant |
|---|---|---|
| cv | `CV` ✓ | oui (pauvre) |
| appel_offres | `AO` ✓ | oui (pauvre) |
| compte_rendu | `COMPTE_RENDU` ✓ | oui |
| pv_recette | `PV_RECETTE` ✓ | oui |
| attestation_bonne_execution | `ABE` ✓ | oui (très pauvre) |
| **certification** | ❌ **absent** | ❌ **absent** |

→ **À ajouter en Phase 1** : valeur d'enum `CERTIFICATION = "certification"` + son schéma.

---

## 5. Points d'extension (où brancher SANS casser)

| Besoin | Point d'accroche | Stratégie non destructive |
|---|---|---|
| **Extraction typée riche + validée** | `GEDIndexer.process` après l'étape 4 ([ged_indexer.py:108-109](backend/core/services/ged_indexer.py#L108-L109)) | Nouveau service `StructuredExtractor` appelé **en plus** (non à la place) du `MetadataExtractor`. Le pipeline vectoriel reste intact. Écriture conditionnée au `score_confiance`. |
| **Validation Pydantic** | Nouveau module `core/services/extraction/schemas.py` | 6 modèles Pydantic (la stack a déjà `pydantic`/`pydantic-settings`). Valide la sortie `tool_use` avant insertion. |
| **Persistance relationnelle** | `db/models.py` + nouveau `KBRepository` (adapter) | Nouvelles tables `kb_*` (faits par type + entités canoniques), créées par le `create_all` existant. Clé d'idempotence = `doc_id`/`hash`. |
| **Résolution d'entités** | Nouveau `EntityResolver` (Phase 2), après extraction | Tables `kb_clients/kb_personnes/kb_projets` + `kb_aliases` + flag `revue_humaine`. |
| **Routeur text-to-SQL** | `QueryDispatcher.dispatch` ([query_dispatcher.py:158](backend/core/services/query_dispatcher.py#L158)) | Ajouter une intention `structured_sql` (analytique/croisement docs) qui délègue à un nouveau `SQLRouter`. Les chemins `rag`/`local_db`/`hybrid` restent inchangés. |
| **Connexion SQL lecture seule** | Nouveau `engine` SQLAlchemy distinct | Engine `mode=ro` (URI `?mode=ro`), borné au schéma `kb_*`, validation anti-écriture avant exécution. **Jamais** l'engine R/W existant. |
| **Câblage** | `container._init_services` ([container.py:131-180](backend/config/container.py#L131-L180)) | Instancier et injecter les nouveaux services ; passer `StructuredExtractor` au `GEDIndexer`, `SQLRouter` au `QueryDispatcher`. |
| **Traçabilité page** | Chunkers + `MetadataExtractor` | Propager le n° de page (pdfplumber le fournit) jusqu'à `Source.page` et aux lignes `kb_*`. |

---

## 6. Plan d'intégration proposé (Phases 1→4)

**Principe** : la couche structurée s'ajoute **en parallèle** du vectoriel. Le vectoriel
reste la voie « retrouve/résume un document » ; le relationnel sert « compter/filtrer/croiser ».

```
                         ┌─ (existant) MetadataExtractor ─▶ ChromaDB (inchangé)
GEDIndexer.process ──┤
   (après étape 4)       └─ (NOUVEAU) StructuredExtractor ─▶ Pydantic ─▶ KBRepository ─▶ tables kb_*
                                                                              │
QueryDispatcher.dispatch ──▶ (NOUVEAU) SQLRouter ──▶ text-to-SQL lecture seule ┘ ─▶ réponse + citations (doc_id+page)
```

- **Phase 1 — Classifieur + extraction typée + DDL.**
  Ajout enum `CERTIFICATION` ; 6 schémas Pydantic ; `StructuredExtractor` (réutilise la
  cascade LLM `tool_use`) ; tables `kb_*` (faits par type + entités) ; persistance
  doc_id/fichier/page/hash/score_confiance ; normalisation montants→colonne numérique + devise,
  dates→ISO. Branché dans `GEDIndexer`. Tests sur 2-3 docs.
- **Phase 2 — Résolution d'entités.** `EntityResolver` (normalisation + appariement flou,
  seuil configurable), `kb_aliases`, mode revue humaine. Test : même projet dans AO+PV+ABE.
- **Phase 3 — Routeur + text-to-SQL.** Intention `structured_sql` dans `QueryDispatcher` ;
  génération SQL bornée au DDL `kb_*` ; **garde-fous** (lecture seule, liste blanche
  tables/colonnes, refus de tout mot-clé d'écriture) ; reformulation citant doc_id+page ;
  mode hybride. Tests sur les questions types (§6 playbook).
- **Phase 4 — Évaluation.** Jeu de ~20 questions (factuel/analytique/croisement),
  script de scoring **par catégorie**, journalisation des SQL générés pour audit.

### Décisions à valider avant de coder (Phase 1)

1. **Préfixe `kb_*`** pour les nouvelles tables (évite la collision avec les `clients`/
   `projects` Odoo). OK ?
2. **`StructuredExtractor` en plus** de `MetadataExtractor` (les deux coexistent) plutôt que
   le remplacer — sécurité maximale pour l'existant. OK ?
3. **Montants** : colonne `montant_valeur REAL` + `montant_devise TEXT` (FCFA/XOF/EUR…),
   normalisation « 200M » / « 200 000 000 » → `200000000`. OK ?
4. **Engine SQL lecture seule séparé** pour le text-to-SQL (Phase 3). OK ?

---

**➡️ Fin de la Phase 0. J'attends ta validation (et tes réponses aux 4 questions ci-dessus)
avant de démarrer la Phase 1.**
