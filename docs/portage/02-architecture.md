# Phase 2 — Décision d'architecture

**Statut** : cette phase ne code rien. Elle documente trois options et recommande, sans trancher seul les points qui restent structurants.

---

## 1. Le point dur (§4.1 du prompt)

La maquette utilise un design system propre (police Bricolage Grotesque/Instrument Sans/IBM Plex Mono, palette `--ink`/`--paper`/`--accent`, primitives visuelles sur mesure). `neurones-ia` a **déjà** son propre design system en production (Tailwind CSS 4, tokens `--color-bad`/`--color-warn`/`--color-good`/`--color-ai`, classes `rounded-card`/`border-line`/`bg-panel`, constaté sur les composants explorés cette session). Les deux ne correspondent pas.

**Chiffrage de l'écart par option** :
- **Option A (module Odoo/OWL)** : écart double — ni les tokens de la maquette, ni ceux de l'existant `neurones-ia` ne s'appliqueraient ; il faudrait un troisième système contraint par le framework OWL et la cascade CSS du backend Odoo. Fidélité réaliste 80-90% avec l'un OU l'autre design, jamais les deux dans le même rendu.
- **Option B (frontend séparé — état actuel)** : aucune contrainte de rendu imposée par un tiers. Fidélité à la maquette **atteignable à 100%** techniquement — mais implique de choisir entre reprendre les tokens de la maquette (refonte visuelle de toute l'app existante pour rester cohérent) ou les adapter au design system déjà en place (fidélité moindre à la maquette, cohérence préservée avec l'existant). **C'est un choix de fidélité, pas une limite technique.**
- **Option C (hybride)** : cumule les deux écarts (contrainte partielle du rendu Odoo pour le menu/auth, contrainte de cohérence avec l'existant pour les écrans encapsulés).

---

## 2. Options instruites (§4.2)

### Option A — Module Odoo natif (OWL, client action)

- **Constat factuel** : `neurones-ia` n'est pas un module Odoo aujourd'hui. Migrer vers cette option signifierait abandonner l'application existante (Next.js/FastAPI, 12 écrans en production, 175 tests unitaires, pipeline CI/CD opérationnel) pour la reconstruire dans le framework OWL.
- Authentification et droits hérités nativement d'Odoo — mais **notre système de rôles actuel (`admin`/`dg`/`dir_commercial`/`dir_operations`/`presale`/`dir_financier`/`commercial`) est indépendant d'Odoo** (JWT propre, table `UserModel` locale) : il faudrait le reconstruire sur les groupes Odoo, ou le dupliquer.
- Fidélité réaliste 80-90% (cascade CSS, contraintes de grille, polices à embarquer dans le framework OWL).
- **Coût** : réécriture complète du frontend ET de l'authentification, perte de l'historique de production actuel (12 écrans, LLM d'extraction/scoring déjà opérationnels côté FastAPI qu'il faudrait migrer ou faire cohabiter).

### Option B — Frontend séparé consommant Odoo en lecture (état actuel)

- **Constat factuel, pas une proposition** : c'est l'architecture déjà en production. Next.js (App Router, Server Components/Actions) + FastAPI, miroir SQLite local resynchronisé toutes les 5 minutes depuis Odoo via JSON-RPC (`backend/adapters/crm/odoo_adapter.py`, `backend/jobs/odoo_sync_job.py`).
- Fidélité 100% atteignable côté rendu (aucune contrainte OWL/CSS Odoo).
- Authentification et droits déjà réimplémentés (JWT, 7 rôles applicatifs) — le coût que le prompt anticipe pour cette option (« authentification à recâbler, droits à réimplémenter ») **est déjà payé**, pas à prévoir.
- Déploiement déjà en place : GitHub Actions → GHCR → SSH/docker-compose sur VPS, avec rollback automatique sur échec de healthcheck.

### Option C — Hybride (menu/auth Odoo, écrans encapsulés)

- Reviendrait à abandonner l'authentification et les droits déjà construits pour les recâbler sur Odoo, tout en gardant les écrans séparés.
- Aucun bénéfice identifié par rapport à B dans le contexte de ce dépôt : B a déjà l'authentification propre ET le rendu libre. C ajouterait de la complexité (double système d'auth à synchroniser) sans gain de fidélité supplémentaire.

---

## 3. Critères d'arbitrage (§4.3)

| Critère | Option A | Option B (actuelle) | Option C |
|---|---|---|---|
| Fidélité visuelle | 80-90% | 100% | 80-95% (selon le périmètre encapsulé) |
| Coût de mise en œuvre | Très élevé (réécriture complète) | **Nul — déjà fait** | Élevé (double auth) |
| Coût de maintenance à 3 ans | Dépendant des montées de version Odoo/OWL | Indépendant d'Odoo côté rendu, dépend de Next.js/FastAPI (stack déjà choisie et maîtrisée) | Dépendant des deux stacks |
| Dépendance à la version Odoo | Forte (OWL versionné avec Odoo) | Faible (JSON-RPC stable, deux versions d'écart tolérées habituellement) | Moyenne |
| Gestion des droits | Héritée d'Odoo nativement, mais incompatible avec le système de rôles métier déjà défini (DG/DC/DO/DF/AM) | **Déjà implémentée**, alignée sur les profils métier | À resynchroniser entre deux systèmes |
| Performance | Dépend du serveur Odoo de production (risque de charge) | Miroir local dédié — déjà découplé de la charge Odoo | Mixte |
| Capacité de l'équipe à maintenir | Nécessite une compétence OWL/Odoo à développer | **Déjà maîtrisée** (l'équipe maintient cette stack depuis plusieurs mois, historique de commits en atteste) | Nécessite les deux compétences |

---

## 4. Recommandation

**Rester sur l'Option B — ce n'est pas un choix nouveau, c'est la confirmation formelle de l'architecture déjà en production**, avec deux nuances à trancher explicitement (pas par moi) :

1. **Le design system** : reprendre les tokens de la maquette à l'identique impliquerait une refonte visuelle de l'application existante entière (les 12 écrans actuels), pas seulement des nouveaux écrans du portage — sans quoi l'application afficherait deux langages visuels incohérents. **Décision à prendre avant la Phase 4** : refonte globale, adaptation des tokens de la maquette au design system existant, ou coexistence assumée section par section.
2. **Rôle « AM »** (déjà signalé Phase 0) : aucune correspondance directe dans les rôles applicatifs actuels.

---

## 5. Prérequis bloquants (§4.4)

### 5.1 Réplica en lecture / entrepôt analytique

**Constat nuancé, pas un simple « absent »** : il n'existe pas de réplica Odoo formel ni d'entrepôt dédié. **Mais l'effet recherché par cette exigence — ne jamais faire porter la charge analytique à la base transactionnelle Odoo — est déjà atteint autrement** : l'application ne lit jamais Odoo directement pour les KPI affichés à l'utilisateur ; elle lit un miroir SQLite local, repeuplé par un ETL toutes les 5 minutes. C'est un compromis différent de celui envisagé par le prompt (pas un réplica temps réel, une synchronisation périodique), avec ses propres limites :
- Fraîcheur des données à 5 minutes près (pas de requête ad hoc en temps réel sur Odoo).
- Pas de requête analytique arbitraire possible sans l'ajouter d'abord au code de synchro (contrairement à un vrai entrepôt interrogeable librement).

**Ce compromis est-il acceptable pour la suite du portage, ou faut-il un vrai réplica/entrepôt avant d'aller plus loin ?** Je ne tranche pas — c'est une décision de tolérance au risque et de coût (mettre en place un réplica formel est un projet en soi, indépendant du portage de la maquette).

### 5.2 Snapshot quotidien du pipeline et du carnet de commandes (Lot 0)

**Non satisfait, confirmé en Phase 1.** Aucun mécanisme n'existe. Je réitère la recommandation du prompt lui-même : lancer ce lot **indépendamment de l'arbitrage du reste**, dès maintenant, car chaque jour sans snapshot est une perte d'historique définitive (Odoo écrase ses propres états — confirmé en Phase 0 sur `OpportunityModel`/`SaleOrderModel`/`DossierModel`).

**Proposition concrète pour le Lot 0** (à valider avant implémentation, pas codée ici) :
- Une tâche planifiée quotidienne (le mécanisme de planification existe déjà : `apscheduler`, utilisé pour la synchro Odoo toutes les 5 minutes et d'autres tâches nocturnes constatées en production).
- Capture d'un instantané de `crm.lead` (stage, probability, expected_revenue, date_deadline) et de `sale.order` (état, montant, backlog) dans une nouvelle table dédiée à l'historique (ex. `opportunity_snapshots`, `sale_order_snapshots`), **jamais écrasée**, purgée seulement selon une politique de rétention à définir.
- Coût d'implémentation estimé : quelques jours (le patron de migration de schéma et le mécanisme de tâche planifiée existent déjà, pas de nouvelle infrastructure à construire).

---

**Ce document ne contient aucune décision d'exécution.** J'attends la validation — en particulier sur les deux nuances de la section 4 (design system, rôle AM) et le lancement du Lot 0 — avant de démarrer la Phase 3 (couche sémantique et moteurs).
