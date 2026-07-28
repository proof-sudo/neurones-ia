# Phase 0 — État des lieux

**Périmètre** : dépôt `neurones-ia` (`D:\NEURONES IA`, branches `main`/`preprod-new` synchronisées). Document produit en lecture seule, aucune modification de code effectuée pendant sa rédaction.

**Méthode** : lecture directe du dépôt (fichiers cités `chemin:ligne`), plus vérifications ponctuelles exécutées ce jour. Toute affirmation non vérifiable par lecture du dépôt est classée en section 5 (« Ce que je ne sais pas ») plutôt que supposée.

---

## 1. Constat préalable — ce prompt suppose un contexte qui ne correspond pas exactement au dépôt réel

Le prompt de portage (§0, §4.2) est écrit pour un ingénieur découvrant un dépôt **Odoo natif inconnu**, devant arbitrer entre trois options d'architecture (A. module Odoo/OWL, B. frontend séparé, C. hybride).

**Constat factuel** : `neurones-ia` n'est ni un module Odoo, ni un dépôt inconnu — c'est une application **Next.js (frontend) + FastAPI (backend)** déjà en production, qui consomme Odoo en lecture via JSON-RPC (`backend/adapters/crm/odoo_adapter.py`) et maintient un miroir SQLite local resynchronisé périodiquement (`backend/jobs/odoo_sync_job.py`). C'est donc déjà, dans les faits, l'**Option B** du prompt — pas une décision à instruire en Phase 2, mais un état existant à documenter et dont il faut chiffrer les écarts (fidélité déjà à 100 % côté rendu, puisqu'aucune contrainte OWL/backend Odoo ne s'applique — en revanche écart de *design system* réel, cf. §2.2).

Ce constat ne dispense pas de la Phase 2 (elle reste utile pour documenter *pourquoi* B est la bonne option et acter les prérequis bloquants du §4.4 du prompt — réplica, snapshot), mais son issue est essentiellement jouée d'avance.

---

## 2. Inventaire technique (§2.1 du prompt)

### 2.1.1 Stack

**Frontend** (`frontend/package.json`) :
- Next.js `16.2.10`, React `19.2.4` / React DOM `19.2.4`, TypeScript 5, Tailwind CSS 4.
- Gestionnaire : npm (`package-lock.json` présent, `lockfileVersion: 3`).
- App Router confirmé (`frontend/app/layout.tsx`, `frontend/app/(cockpit)/layout.tsx`, un `page.tsx` par écran).
- Server Components par défaut (pas de `"use client"` sur les pages elles-mêmes, fetch de données côté serveur) ; Server Actions confirmées (`frontend/app/actions.ts:1`, `"use server"`).
- Accès API centralisé par domaine : `frontend/lib/api/*.ts` (un fichier par domaine fonctionnel).

**Backend** (`backend/requirements.txt` — pas de `pyproject.toml`) :
- Python 3.12 (`backend/Dockerfile:9`, confirmé CI `.github/workflows/ci.yml:43`).
- `fastapi==0.115.5`, `uvicorn[standard]==0.32.1`, `sqlalchemy[asyncio]==2.0.36`, `aiosqlite==0.20.0`.
- `anthropic==0.116.0`, `openai==1.57.0`, `tiktoken==0.13.0` (extraction/scoring LLM).
- `PyJWT==2.9.0`, `bcrypt==5.0.0` (auth).
- `pytest==8.3.4`, `pytest-asyncio==0.24.0`.
- `alembic==1.14.0` déclaré en dépendance mais **non utilisé en pratique** — voir §2.1.5.

### 2.1.2 Mode d'accès aux données Odoo

- **JSON-RPC** exclusivement, session persistante par cookie (`backend/adapters/crm/odoo_adapter.py:29-70`, méthodes `_authenticate`/`_call`).
- **Aucun réplica en lecture**, **aucun entrepôt analytique séparé**. Un miroir SQLite local (`backend/db/database.py`) est repeuplé par un job de synchro (`backend/jobs/odoo_sync_job.py`, `run_odoo_sync`) planifié toutes les 5 minutes (mode incrémental sur `write_date`, avec bascule en synchro complète si `last_sync.json` absent ou `force_full=True`).
- **Conséquence directe pour le §4.4 du prompt** : le prérequis bloquant « absence de réplica/entrepôt » n'est PAS levé aujourd'hui — l'architecture actuelle est un compromis (miroir SQLite, fraîcheur à 5 minutes près) qui n'est ni un vrai réplica read-only Odoo, ni un entrepôt analytique dédié pré-agrégé. À documenter comme état accepté par le projet actuel, pas comme un point neuf à trancher.

### 2.1.3 Base de données

- SQLite (fichier local, chemin piloté par `settings.local_db_path`), mode WAL activé (`backend/db/database.py:23-32`), pas de moteur serveur séparé (pas Postgres/MySQL).
- Pas de politique de sauvegarde constatée dans le dépôt (aucun script de dump/backup trouvé pour cette base — à vérifier en Phase 1/opérations).

### 2.1.4 CI/CD

Deux workflows GitHub Actions :

**`ci.yml`** (PR vers `main`/`dev`/`preprod`) — 4 jobs :
- `lint-frontend` : Node 22, `npm ci && npm run lint` (ESLint).
- `lint-backend` : Python 3.12, `ruff check backend/` (config `backend/ruff.toml`).
- `test-backend` : `pytest tests/unit -q` **uniquement** — les tests d'intégration sont explicitement exclus (commentaire dans le workflow : nécessitent des services externes).
- `build-images` : build Docker frontend+backend sans push, validation seule.

**`deploy.yml`** (push vers `main`) — 3 jobs séquentiels :
1. `quality` : relint + tests unitaires (même portes que ci.yml, remises car un push direct sur `main` ne passe pas par PR).
2. `build-push` : build + push GHCR (tag SHA + `latest`).
3. `deploy` : SSH vers le VPS (`appleboy/ssh-action`), SCP de `docker-compose.yml`+`nginx.neurones-ia.conf`, `docker compose pull && up -d --wait`, healthcheck HTTP post-déploiement, **rollback automatique** vers le tag précédent si le déploiement ou le healthcheck échoue.

**Portes de qualité bloquantes** : lint frontend, lint backend, tests unitaires backend, build Docker. **Aucun test frontend** n'existe (pas de Jest/Vitest/Playwright configuré) — seul l'ESLint protège le frontend en CI.

### 2.1.5 Migrations de schéma

`alembic` est dans `requirements.txt` et un dossier `backend/migrations/versions/` existe, mais **ne contient aucun fichier de migration source exploitable** (uniquement des `.pyc` en cache, sans `.py` correspondant, sans `alembic.ini` à la racine). Le mécanisme réellement actif est un **`ALTER TABLE` manuel et idempotent au démarrage** (`backend/db/database.py`, fonctions `_migrate_veille_entries`, `_migrate_sale_orders`, `_migrate_opportunities`, `_migrate_purchase_orders`) : `Base.metadata.create_all()` crée les tables manquantes, puis chaque fonction `_migrate_*` ajoute les colonnes ajoutées après coup si absentes. C'est le patron à reprendre pour toute évolution de schéma sur ce projet — pas Alembic malgré la dépendance déclarée.

### 2.1.6 Authentification et rôles

- JWT stateless (`PyJWT`) + hash `bcrypt` (`backend/adapters/auth/jwt_adapter.py`), endpoints `backend/api/v1/auth.py` (`/login`, `/me`, `/logout`, `/users`, `/permissions`).
- Table `UserModel` (`backend/db/models.py:170-180`) : email, mot de passe haché, `role` (défaut `"user"`), actif, dernière connexion.
- **Rôles réellement codés** (`backend/core/domain/user.py`, enum `UserRole`) : `admin`, `user` (legacy), `viewer` (legacy), `dg`, `dir_commercial`, `dir_operations`, `presale`, `dir_financier`, `commercial`.
- **Correspondance avec les 5 profils du cahier des charges (DG/DC/DO/DF/AM)** — vérifiée dans `frontend/lib/fixtures/profiles.ts` :
  - DG → `dg` ✅ correspondance directe.
  - DC → `dir_commercial` ✅ correspondance directe.
  - DO → `dir_operations` ✅ correspondance directe.
  - DF → `dir_financier` ✅ correspondance directe.
  - **AM → aucune correspondance directe.** Le rôle le plus proche par intitulé est `presale` (« Équipe Avant-Vente », initiales AV) ; un rôle `commercial` existe aussi, sans lien explicite avec « AM » dans le code. **Point à trancher en Phase 2/3** : quel rôle existant recouvre le profil AM du cahier des charges, ou faut-il en créer un nouveau ? Je ne tranche pas — remonté en §5.
- Droits par module : matrice statique par défaut (`backend/config/permissions.py`, `DEFAULT_MODULE_ACCESS`) + surcharges persistées (`ModulePermissionModel`) éditables depuis l'écran Administration.

### 2.1.7 Multi-société et multi-devise

- **Multi-société : absent.** Aucune occurrence de `res.company` ni de `company_id` dans tout `backend/`. Le code suppose implicitement une société Odoo unique. **Si l'instance Odoo réelle a plusieurs sociétés, c'est un angle mort actuel non couvert par l'existant** — à confirmer en Phase 1.
- **Multi-devise : partiellement géré.** XOF est la devise pivot de stockage partout (colonnes `currency` par défaut `"XOF"`). La conversion vers XOF au moment de la synchro (`odoo_sync_job.py`, `_get_xof_rates`/`_to_xof`) utilise `res.currency.inverse_rate`, un **taux courant**, pas historisé. **Un montant en devise étrangère synchronisé aujourd'hui est converti au taux d'aujourd'hui, même si sa date d'origine est antérieure.** Aucune table ne conserve un taux à une date donnée. C'est un écart potentiel avec l'exigence de fidélité comptable si des KPI historiques en devise doivent être exacts rétroactivement — à signaler explicitement dans la couche sémantique (Phase 3) si c'est un point sensible.

### 2.1.8 Historisation / snapshots — constat majeur pour la Phase 2 (Lot 0)

**Aucun mécanisme d'historisation temporelle n'existe.** Le sync pratique un upsert qui écrase l'état courant :
- `OpportunityModel`, `SaleOrderModel`, `DossierModel` : chaque cycle de synchro réassigne directement les champs (`existing.stage = ...`, `existing.state = ...`, etc.) sans conserver l'état précédent. Aucune table `*_history`/`*_snapshot`, aucune colonne `valid_from`/`as_of_date`.
- Seul `last_sync.json` trace un **curseur technique** (date de dernière synchro globale), pas un historique métier.

**Conséquence directe et vérifiée sur le prompt (§4.4, §5.2 M5)** : le **Lot 0** du prompt (« snapshot quotidien du pipeline et du carnet de commandes », qualifié de *seule tâche dont le report cause un dommage irréversible*) n'est PAS en place. Le moteur M5 (scoring pipeline calibré sur historique) et les modules qui en dépendent (02, 06, 07, 09, 10) sont donc **indisponibles dès aujourd'hui**, factuellement, pas par supposition — tant que ce lot 0 n'est pas livré. Odoo écrase ses propres états ; toute journée sans snapshot est une donnée d'historique perdue définitivement.

### 2.1.9 Feuilles de temps et analytique

- `account.analytic.line`, `hr_timesheet`, `hr.employee`, `project.task` : **absents**, aucune occurrence dans le code de synchro.
- `project.project` : synchronisé de façon minimale (id, nom, partenaire, description, dates, responsable), **jamais mis à jour après création initiale** (`odoo_sync_job.py` : `if not existing:` — pas de branche `else` de mise à jour), champs `technologies`/`engineers` toujours vides.
- **Conséquence directe** : conforme à l'anticipation du prompt lui-même — les modules 11, 12, 13 ne peuvent être que des **proxys sur le carnet de commandes**, jamais une vraie mesure de charge. C'est déjà le statut à leur donner nativement, sans ambiguïté à lever en Phase 1 sur ce point précis (mais le TAUX DE REMPLISSAGE des champs de durée contractuelle, lui, reste à mesurer en Phase 1).

### 2.1.10 Rattachement achat/vente et affaires

- Un lien **document-à-document** existe : `PurchaseOrderModel.dossier_id` et `SaleOrderModel.dossier_id` pointent vers `DossierModel.dossier_ref` (`neurones.dossier.manager` côté Odoo) — ajouté ce soir pour `purchase_orders`, déjà présent pour `sale_orders`.
- **Aucun lien ligne-à-ligne** : recherche de `purchase.order.line`/`purchase_order_line` dans tout le backend → 0 résultat. Le rattachement s'arrête au niveau du dossier commercial entier, jamais entre une ligne d'achat précise et la ligne de vente qu'elle sert.
- **Conséquence directe sur le module 19 (effet ciseau achat/vente)** : seule l'option de repli anticipée par le prompt lui-même est possible avec l'existant — comparaison au niveau référence produit (si la catégorisation produit est fiable, cf. §2.1.11), pas au niveau affaire.

### 2.1.11 Catégorisation produit

- `product.product` (`categ_id`, `default_code`) est lu **à la volée** pour enrichir les lignes de vente (`odoo_adapter.py`, `get_order_lines_by_ids`), stocké uniquement en JSON dans `SaleOrderModel.order_lines`.
- **Aucune table dédiée** aux produits/catégories/familles de prestation (pas de `ProductModel`, pas de `ProductCategoryModel`). Impossible aujourd'hui d'interroger un référentiel produit indépendamment — chaque lecture repasse par les lignes de commande brutes.
- Conséquence : le prérequis du prompt (« qualité des libellés, taux de doublons sémantiques, structuration categ_id ») ne peut pas être mesuré sur le miroir local actuel — il faudra profiler directement sur Odoo (Phase 1), pas sur SQLite.

---

## 3. Inventaire fonctionnel de l'existant (§2.2 du prompt)

### 3.1 Écrans existants

| Écran (dossier `frontend/app/(cockpit)/`) | Donnbroée(s) backend | Rôle apparent |
|---|---|---|
| `dashboard` | `GET /v1/dashboard/kpis`, `/clients-by-country`, `/monthly-revenue`, `/top-clients`, briefing IA | Tableau de bord général, KPI agrégés, briefing du jour |
| `tresorerie` | `GET /v1/dashboard/unpaid`, `POST /unpaid/analysis`, `/unpaid/recouvrement-decision` | Impayés, exposition, décisions de recouvrement assistées IA |
| `performance` | `GET /v1/dashboard/performance/summary`, `POST /performance/analysis` | Synthèse de performance, analyse IA |
| `forecast` | `GET /v1/dashboard/forecast`, `/forecast/pipeline-weighted`, `POST /forecast/analysis`, `/forecast/client-decision` | Prévisions, pipeline pondéré |
| `pipeline` | `GET /v1/dashboard/pipeline`, `/pipeline/opportunities` | Vue pipeline commercial |
| `presales` (Appel d'offre) | `backend/modules/uc10_presales/router.py` (`/score`, `/dossiers`, `/generate`, `/bid-strategy`, `/matrix/*`, exports) | Scoring AO, génération d'offre, stratégie de réponse assistée IA |
| `veille` | `backend/modules/uc_veille/router.py` (`/feed`, `/scan`, `/entries/{id}/pitch`, `/debrief`) | Veille AO/marché |
| `crosssell` | `fetchCrossSellSignals` | Signaux de cross-sell |
| `clients` | `fetchClientPortfolio` | Portefeuille clients |
| `partenaires` (Fournisseurs) | `fetchTopSuppliers`, `fetchSupplierIntelligence` | Portefeuille fournisseurs + indicateurs différenciants (ajoutés cette session) |
| `documents` | `backend/api/v1/ged.py` (`/tree`, `/status`, `/files`, `/upload`, quarantaine) | Gestion documentaire (GED) |
| `admin` | `/auth/users`, `/auth/permissions` | Gestion utilisateurs et droits |

Vues additionnelles présentes dans la matrice de droits (`backend/config/permissions.py`) mais **sans dossier `app/(cockpit)/` dédié constaté** : `briefing`, `actions`, `veille-client`, `veille-ao`, `portefeuille`, `offres`, `couts`, `workflow`, `taches`, `leads`, `catalogue` — possiblement fusionnées dans les écrans ci-dessus via la route dynamique `[view]`, **non vérifié en détail** (reporté en §5).

Chat/copilote transverse : `backend/api/v1/chat.py` (ré-exporte `modules/uc02_capital_knowledge/router.py`) + `frontend/components/shell/CopilotRail.tsx`, rendu sur tous les écrans.

### 3.2 Table de correspondance — 25 modules de la maquette vs existant

Légende : ✅ existe déjà à l'identique · 🟡 existe partiellement, à étendre · ⬜ n'existe pas, à créer · ❓ à vérifier (non tranché par lecture du dépôt seul)

| # | Module (maquette) | Statut | Constat |
|---|---|---|---|
| 01 | Briefing de direction | 🟡 | Un briefing IA existe (`dashboard`, `fetchBriefingAction`) — périmètre exact du contenu vs maquette non comparé ligne à ligne. |
| 02 | Atterrissage et scénarios | 🟡 | `forecast`/pipeline pondéré existent ; notion de « scénarios » multiples non confirmée. Dépend de M3 (backlog/facturation), lui-même dépendant du taux de rattachement facture/commande (Phase 1). |
| 03 | Radar de dépendance (client) | 🟡 | Une « dépendance/concentration » existe côté **fournisseurs** (`partenaires`, ajouté ce soir) ; côté **clients**, non confirmé — `clients` existe mais son contenu exact de concentration n'a pas été vérifié. |
| 04 | Explication d'écart budgétaire | ⬜ | Aucune notion de « budget » trouvée dans le dépôt. |
| 05 | Interrogation en langage naturel | ✅ | Chat/copilote transverse déjà en place (`uc02_capital_knowledge`, `CopilotRail`). |
| 06 | Crédibilité du forecast (calibrée par commercial) | ⬜ | Nécessite un historique de fiabilité (M5) — **indisponible** : pas de snapshot (§2.1.8). |
| 07 | Opportunités à risque | 🟡 | Pipeline/forecast existent ; framing « à risque » explicite non confirmé. |
| 08 | Ciblage cross-sell chiffré | ✅ | `crosssell` existe déjà avec signaux dédiés. |
| 09 | Analyse des motifs de perte | 🟡 | `get_lost_deals` (`local_crm_adapter.py:1169`) agrège déjà les opportunités perdues par client et par commercial, **mais ne ventile PAS par motif** (`lost_reason_id` non exploité) — le cœur du module (« motifs ») manque. |
| 10 | Coaching de portefeuille | ⬜ | Rien de comparable trouvé. |
| 11 | Consommation du backlog vs plan | ⬜ | Dépend de M3 et d'une durée contractuelle fiable (taux de remplissage à mesurer Phase 1) ; rien d'équivalent trouvé aujourd'hui. |
| 12 | Mois de visibilité par practice | ⬜ | Aucun référentiel « practice »/famille de prestation persistée (§2.1.11). |
| 13 | Détection de dérive d'affaire | ⬜ | Rien de comparable trouvé ; dépend de M3. |
| 14 | Fiabilité fournisseurs | 🟡 | Fortement recoupé par le travail de ce soir : `get_supplier_intelligence` calcule déjà un retard réel de paiement fournisseur vs délai négocié. Le volet « délai de RÉCEPTION » (stock.picking) n'est en revanche pas couvert — actuellement basé sur la date de facture, pas de livraison. |
| 15 | Tension sur la sous-traitance | 🟡 | Recoupé par `get_supplier_intelligence` (taux de dépendance, marge de sous-traitance, risque de rupture) — ajouté ce soir, à comparer précisément aux attentes du module de la maquette. |
| 16 | Prévision d'encaissement comportementale | 🟡 | `tresorerie`/`unpaid` existent ; caractère « comportemental » (calibré sur historique de paiement réel par client) non confirmé dans l'implémentation actuelle. |
| 17 | Dérive du délai de paiement (client) | 🟡 | Des dates d'échéance/paiement client existent (`InvoiceModel.payment_date`, mécanisme symétrique à celui construit ce soir côté fournisseurs) ; une détection de « dérive » (tendance sur 3 mois) au sens M2 n'est pas confirmée comme implémentée. |
| 18 | Surveillance de l'exposition | 🟡 | `unpaid.exposure.top_10_debiteurs` référencé dans le dashboard — à comparer précisément aux seuils/présentation de la maquette. |
| 19 | Effet ciseau achat/vente | ⬜ | Aucun rapprochement prix achat/vente par référence trouvé ; bloqué en granularité affaire (§2.1.10), seule la granularité produit serait envisageable. |
| 20 | Détection d'anomalies de facturation | ⬜ | Rien de comparable trouvé explicitement. |
| 21 | Fiche compte avant rendez-vous | 🟡 | `clients`/portefeuille existent ; contenu exact (fiche pré-rendez-vous formatée) non confirmé. |
| 22 | Next best action | ⬜ | Rien de comparable trouvé. |
| 23 | Alerte rupture de rythme (M1) | ⬜ | Aucune détection de rythme/rupture de cadence de commande trouvée. |
| 24 | Radar renouvellement et obsolescence de parc | ⬜ | Rien de comparable trouvé. |
| 25 | Aide à la rédaction contextualisée | ✅ | Le module `uc10_presales` génère déjà des sections d'offre et une stratégie de réponse via LLM (`generate_bid_strategy`, `use_case.py:333`) — recoupement fonctionnel fort, même si le contexte (réponse à AO) diffère de celui de la maquette (communication compte). |

**Synthèse chiffrée** : sur 25 modules, **3 existent déjà** (05, 08, 25), **11 existent partiellement** (01, 02, 03, 07, 09, 14, 15, 16, 17, 18, 21), **11 n'existent pas** (04, 06, 10, 11, 12, 13, 19, 20, 22, 23, 24). Les modules 14 et 15 sont ceux où le recoupement avec le travail déjà livré ce soir (indicateurs fournisseurs) est le plus direct.

### 3.3 Design system — verdict de compatibilité

L'application dispose déjà d'un design system propre (Tailwind CSS 4, tokens CSS custom déjà en place dans les composants explorés ce soir — `var(--color-bad)`, `var(--color-warn)`, `var(--color-good)`, `var(--color-ai)`, classes utilitaires `rounded-card`, `border-line`, `bg-panel`). Ces tokens **ne correspondent pas** à la palette de la maquette (`--ink`, `--paper`, `--accent`, etc., §6.1 du prompt) ni à ses trois polices (Bricolage Grotesque / Instrument Sans / IBM Plex Mono).

**Verdict** : reprendre les tokens de la maquette « à l'identique » (comme demandé au §6.1 du prompt) impliquerait soit (a) une refonte visuelle de **toute** l'application existante (pas seulement les nouveaux écrans, pour rester cohérent), soit (b) une coexistence de deux design systems. **C'est une décision structurante à trancher explicitement (règle §1.9 du prompt : ne pas trancher seul)**, pas une simple exécution du §6.1 — reporté en §5.

### 3.4 Tests

- Backend : 26 fichiers de test (`tests/unit` : 23, `tests/integration` : 3), pytest + pytest-asyncio.
  - **175 tests unitaires passent** (`pytest tests/unit -q`, seul jeu exécuté en CI).
  - **182 tests passent** en tout (unitaires + intégration), exécutés manuellement ce jour — les tests d'intégration ne tournent jamais en CI (nécessitent des services externes, non détaillé plus avant ici).
- Frontend : **aucun test automatisé** (ni Jest, ni Vitest, ni Playwright configurés, aucun fichier `*.test.*`/`*.spec.*`). Seul l'ESLint protège le frontend en CI.
- **Conséquence pour la Phase 6 du prompt** (exigences de tests unitaires/moteurs/disponibilité/anti-hallucination/snapshots/cohérence/droits/accessibilité/performance/fidélité visuelle) : l'infrastructure de test **frontend est à créer intégralement** — rien n'existe aujourd'hui pour porter les tests d'accessibilité, de fidélité visuelle ou de cohérence inter-écrans exigés par le prompt.

---

## 4. Baseline de non-régression (§2.3 du prompt)

| Élément de baseline | Statut |
|---|---|
| Résultat de la suite de tests backend existante | ✅ Capturé : 175/175 (unitaires, CI), 182/182 (unitaires + intégration, exécution manuelle de ce jour) — aucun échec préexistant constaté. |
| Résultat de la suite de tests frontend existante | N/A — aucune suite n'existe (constat, pas un manque de capture). |
| Capture de la sortie de chaque écran existant (snapshot HTML/JSON) | ⬜ **Non fait.** 12 écrans identifiés (§3.1) ; la capture systématique (screenshot + JSON des KPI affichés) est un travail dédié non réalisé dans cette phase — à planifier comme sous-tâche explicite avant toute modification des écrans concernés par le portage. |
| Capture de la valeur courante de chaque KPI existant sur un jeu de données figé | ⬜ **Non fait**, pour la même raison — nécessite de figer un instantané des données (le miroir SQLite change toutes les 5 minutes). |
| Empreinte de performance des 10 écrans les plus lourds | ⬜ **Non fait.** |

**Honnêteté explicite (conforme à la règle du prompt de ne jamais garantir zéro régression)** : cette baseline est **incomplète**. Le seul élément solide capturé est le résultat de la suite de tests. La capture visuelle/KPI/performance des écrans existants reste à faire avant toute modification qui les toucherait — je la signale comme prérequis non levé plutôt que de l'ignorer ou de la simuler.

---

## 5. Ce que je ne sais pas (à faire valider ou vérifier avant la suite)

**Nécessitant un accès direct à l'instance Odoo (Phase 1, pas cette phase) :**
- Version exacte d'Odoo et édition (Community/Enterprise) — aucune information trouvée dans le dépôt (pas de fichier `odoo/release.py` ni équivalent, l'app ne fait qu'y appeler du JSON-RPC).
- Modules Odoo installés (standard, OCA, développements internes) — connu uniquement `neurones.dossier.manager` (module custom) par son usage dans le code.
- Taux de remplissage réel des champs critiques listés par le prompt (`commitment_date`, `credit_limit`/`use_credit_limit`, `industry_id`, `lost_reason_id`, `mail.tracking.value` sur `crm.lead`, etc.) — c'est explicitement l'objet de la Phase 1, pas de cette phase.
- Présence ou non de plusieurs `res.company` sur l'instance réelle (le code suppose une société unique, mais je n'ai pas vérifié l'instance elle-même).
- Le module Inventaire (stock.picking/stock.move) est-il installé et utilisé ? Conditionne le module 14 en version complète (délai de réception réel).

**Questions métier à faire trancher (remontées, pas résolues) :**
- Les KPI de la maquette sont-ils HT ou TTC ? (Le prompt lui-même signale cette ambiguïté, §3.1.)
- Le CA récurrent inclut-il la TMA hors contrat pluriannuel ?
- Les avoirs (`out_refund`) sont-ils déduits du CA et rattachés à la facture d'origine dans la définition métier attendue ?
- **Quel rôle applicatif existant correspond au profil « AM » (Account Manager)** de la maquette — `presale`, `commercial`, un nouveau rôle ? (§2.1.6)
- **Le design system de la maquette doit-il remplacer l'existant, coexister, ou seulement inspirer les nouveaux écrans ?** (§3.3) — décision structurante non tranchée.
- Le taux de change devise→XOF non historisé (§2.1.7) est-il acceptable pour les KPI historiques du portage, ou faut-il l'historiser d'abord ?

**Vues de la matrice de droits sans dossier `app/(cockpit)/` identifié** (`briefing`, `actions`, `veille-client`, `veille-ao`, `portefeuille`, `offres`, `couts`, `workflow`, `taches`, `leads`, `catalogue`) : possiblement gérées via la route dynamique `[view]`, non vérifié précisément — à clarifier avant de déclarer un module de la maquette "n'existe pas" par excès de prudence ou, à l'inverse, de manquer un recoupement réel.

**Politique de sauvegarde de la base SQLite locale** : non trouvée dans le dépôt — à confirmer côté exploitation/VPS (hors dépôt).

---

## 6. Synthèse — vers la Phase 1

Cette phase 0 confirme trois choses structurantes pour la suite :
1. L'architecture (Option B) est déjà tranchée dans les faits — la Phase 2 devient une phase de documentation/chiffrage d'écart, pas un arbitrage réel.
2. Le **Lot 0 (snapshot quotidien pipeline/carnet de commandes)** n'est pas en place et bloque déjà, factuellement, 5 modules (02, 06, 07, 09, 10) et le moteur M5 — c'est la priorité la plus urgente identifiée par ce document, cohérente avec ce que le prompt lui-même anticipe comme le seul dommage irréversible du projet.
3. Les modules 14 et 15 ont un recoupement direct et déjà partiellement livré avec le travail de ce soir (indicateurs fournisseurs) — un point d'appui concret pour amorcer la Phase 1 sur un périmètre déjà bien compris plutôt que de repartir de zéro.

**Ce document ne contient aucune décision d'exécution.** J'attends la validation avant de démarrer la Phase 1 (profiling Odoo champ par champ + registre de disponibilité).
