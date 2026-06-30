# Plan de nettoyage — Documents & index GED

> Diagnostic et plan d'action. Branche `feature/refont_ged`. Établi le 15/06/2026.

---

## 1. Constat

Les dossiers `data/ged/*` (cvs, offres-techniques, abe, fiches-techniques, comptes-rendus, procedures, pv-recette) sont **vides sur le disque**, alors que l'index continue de décrire des documents :

| Composant | État | Détail |
|---|---|---|
| `data/ged/**` | **0 fichier** | Les 7 sous-dossiers existent mais sont vides |
| `ged_entries` (SQLite) | **21 lignes** | 12 actives (`is_active=1`, chemins absolus `D:\…`) + 9 inactives (`is_active=0`, chemins relatifs `..\`) |
| ChromaDB | **260 vecteurs / 12 doc_id** | Correspondent exactement aux 12 entrées actives |
| BM25 | `bm25.pkl` (~758 Ko) | Index lexical |

**Cohérence interne de l'index : OK.** 12 docs actifs ↔ 12 doc_id ↔ 260 vecteurs. Aucun vecteur orphelin côté Chroma, aucune entrée active sans vecteurs. Les 9 entrées inactives ont déjà eu leurs vecteurs purgés.

**Le vrai problème : tout l'index est orphelin par rapport au disque.** Les 12 documents actifs pointent vers des fichiers qui n'existent plus. La recherche RAG renvoie donc du contenu de fichiers que l'utilisateur ne peut plus ouvrir.

---

## 2. Causes identifiées

**a) Les fichiers ne sont récupérables ni via Git, ni localement.**
`.gitignore` exclut `data/ged/`, `data/uploads/`, `data/chromadb/`, `data/bm25_index/`, `data/local_db/`. Les documents n'ont **jamais été versionnés** : ils n'existaient que sur le disque local. Recherche faite : aucun `.pdf`/`.docx`/`.doc` dans les dossiers montés, pas de dossier `data/uploads/`. → Pas de filet de sécurité versionné.

**b) Les fichiers ont été supprimés pendant que l'application/watcher était arrêté.**
Le watcher (`backend/watchers/ged_watcher.py`) gère bien `on_deleted` → `GEDIndexer.remove()` (soft-delete + purge vecteurs), **mais uniquement quand l'app tourne**. Chronologie : ré-indexation le 15/06 à 15:09–15:12 (entrées absolues actives), puis dossiers vidés à 15:43 → aucun event `on_deleted` capté → le registre n'a pas été mis à jour → 12 orphelins actifs subsistent.

**c) Doublons rel/abs = déduplication par chemin, pas par hash.**
Dans `GEDIndexer.process()` (`core/services/ged_indexer.py`), le « skip si inchangé » repose sur `existing = registry.get_entry(file_str)` puis comparaison de hash — la clé de recherche est la **chaîne `file_path`**. Le même fichier indexé une fois en relatif (`..\data\ged\…`, 01–02/06) puis en absolu (`D:\…`, 15/06) ne se retrouve pas → traité comme nouveau → nouveau `doc_id` (uuid4) → vecteurs dupliqués. Le contrôle SHA-256 est court-circuité car la recherche se fait par chemin et non par contenu. 9 documents sont ainsi présents en double.

---

## 3. Plan d'action

### Étape 0 — Ne rien purger avant la décision de récupération
Le contenu indexé (260 vecteurs, métadonnées extraites) est aujourd'hui la **seule trace** des documents. Tant que la récupération n'est pas tranchée, ne pas vider Chroma/BM25/`ged_entries` : ce serait perdre définitivement l'information résiduelle.

### Étape 1 — Tenter de récupérer les fichiers sources
Par ordre de probabilité :

1. **Corbeille Windows** du poste (`D:`) — restauration directe si suppression manuelle récente.
2. **Sauvegarde / historique** : OneDrive/Google Drive, « Historique des fichiers » Windows, sauvegarde disque, versions précédentes du dossier.
3. **Déploiement VPS (production).** Le repo se déploie sur un VPS (cf. `backend/deploy_vps*.py`, `vps_*.py`). Le `data/ged/` **de production** détient probablement encore les originaux. À récupérer par `scp`/`rsync` depuis le serveur. *C'est la piste la plus fiable.*

→ **Si fichiers récupérés : aller en 2A. Sinon : aller en 2B.**

### Étape 2A — Cas « fichiers récupérés » : restaurer puis ré-indexer proprement
1. Restaurer les fichiers dans les bons sous-dossiers de `data/ged/`.
2. **Repartir d'un index propre** plutôt que d'empiler : purger l'index actuel (voir 2B, commandes de purge) puis ré-indexer de zéro via l'endpoint `POST /v1/ged/reindex` (ou le scan nocturne). Cela élimine d'un coup doublons et orphelins.
3. Vérifier via `GET /v1/ged/index-health` (déjà implémenté, `api/v1/ged.py:334`) : 0 orphelin attendu.

### Étape 2B — Cas « fichiers perdus » : purger l'index orphelin
Objectif : que la recherche cesse de renvoyer des documents fantômes.

1. **Sauvegarde préalable** des bases (au cas où) :
   ```bash
   cp data/local_db/neurones.db        data/local_db/neurones.db.bak
   cp -r data/chromadb                 data/chromadb.bak
   cp data/bm25_index/bm25.pkl         data/bm25_index/bm25.pkl.bak
   ```
2. **Voie recommandée — via l'API** (purge cohérente Chroma + BM25 + registre + tables `kb_*`), pour chacun des 12 `doc_id` actifs :
   ```
   DELETE /v1/ged/files/{doc_id}
   ```
   (les CV déclenchent un hard-delete RGPD ; les autres un soft-delete — voir point 3 ci-dessous pour forcer la purge complète).
3. **Nettoyer les 9 lignes inactives résiduelles** dans `ged_entries` (bruit de registre, vecteurs déjà purgés) :
   ```sql
   DELETE FROM ged_entries WHERE is_active = 0;
   ```
4. **Vérifier** : `GET /v1/ged/index-health` et `GET /v1/ged/status` → 0 document, 0 vecteur, BM25 vide.

### Étape 3 — Corriger la cause racine (éviter la récidive des doublons)
Dans `GEDIndexer.process()` :
- **Dédupliquer par hash de contenu** : avant de créer un nouveau `doc_id`, chercher une entrée existante par `hash_sha256` (et non seulement par `file_path`). Si trouvée → mise à jour de l'entrée existante (réutiliser le `doc_id`, mettre à jour `file_path`).
- **Normaliser systématiquement `file_path` en absolu** (`Path.resolve()`) à l'entrée du pipeline et à l'enregistrement registre, pour que relatif et absolu ne divergent jamais.
- S'assurer que `GED_PATH` (config) est résolu en chemin absolu au démarrage, identique en dev et en prod.

### Étape 4 — Prévention (réconciliation disque ↔ registre)
- **Job de réconciliation périodique** : au démarrage + dans le scan nocturne, comparer les fichiers présents sur le disque aux entrées `is_active=1`. Toute entrée pointant vers un fichier absent → `remove()` (soft-delete + purge vecteurs). Cela aurait évité les 12 orphelins actuels.
- L'endpoint `GET /v1/ged/index-health` détecte déjà les orphelins (`in_registry_without_chunks`, `in_vector_without_registry`) — **ajouter la détection « registre actif sans fichier sur disque »** et l'exposer dans l'UI `/ged`.
- **Filet de sécurité documents** : `data/ged/` étant volontairement hors Git, mettre en place une **sauvegarde dédiée** (snapshot quotidien, ou réplication VPS↔local) pour ne plus dépendre d'une unique copie disque.

### Étape 5 — Convention de nommage (qualité documentaire)
Les noms actuels sont hétérogènes : `2022 - INCONNU - C V Kouassi 2.pdf`, `NSE_4_Certificate (3).pdf`, `CAHIER DE CHARGE appel d'offres_Informatique_permier_semestre 2026 (1).pdf`. Recommandation au ré-import : schéma `AAAA-MM_CLIENT_TYPE_intitulé.ext`, sans suffixes `(1)`/`(2)`, sans `INCONNU` (compléter la métadonnée), espaces → `_`. À appliquer manuellement ou via un petit script de renommage avant ré-indexation.

### Étape 6 — Vérification finale
- `GET /v1/ged/index-health` : aucun orphelin (registre↔Chroma↔disque).
- `GET /v1/ged/status` : nombre de documents = nombre de fichiers réellement présents.
- Un test de recherche RAG ne renvoie que des documents ouvrables.

---

## 4. Synthèse priorisée

| Priorité | Action | Réversible ? |
|---|---|---|
| **P0** | Récupérer les sources (corbeille → backup → **VPS prod**) avant toute purge | — |
| **P1** | Selon issue : ré-indexer proprement (2A) **ou** purger l'index orphelin (2B) | Oui (sauvegardes `.bak`) |
| **P1** | Supprimer les 9 lignes `is_active=0` résiduelles | Oui |
| **P2** | Corriger la dédup (par hash + chemins absolus) | Code |
| **P2** | Job de réconciliation disque↔registre + alerte UI | Code |
| **P3** | Sauvegarde dédiée de `data/ged/` | Infra |
| **P3** | Convention de nommage au ré-import | Process |
