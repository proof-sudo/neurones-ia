# Phase 1 — Verdict de faisabilité par module (document contractuel)

Fondé sur le profiling réel Odoo (`docs/portage/01-audit-donnees.md`) et le registre `config/data_availability.yaml`. Verdict : **disponible** / **dégradé** / **indisponible**, avec motif et prérequis de levée.

**Synthèse** : 9 disponibles, 12 dégradés, 4 indisponibles — sur 25.

Note méthodologique importante par rapport à la lecture préliminaire de Phase 0 : les moteurs **M1** (rupture de rythme) et **M2** (dérive de délai) ne nécessitent **aucun** historique de snapshot — ils s'appuient sur des dates de transactions déjà historiques par nature (`sale.order.date_order`, `account.move.invoice_date`, dates de paiement). Seuls **M3** (dénominateur de durée contractuelle absent) et **M5** (nécessite un historique d'état, bloqué) sont réellement contraints. Cette distinction améliore sensiblement le nombre de modules disponibles par rapport à l'hypothèse initiale.

---

| # | Module | Verdict | Motif | Prérequis de levée |
|---|---|---|---|---|
| 01 | Briefing de direction | ✅ Disponible | Existe déjà en production, sur des agrégats déjà calculés. | — |
| 02 | Atterrissage et scénarios | 🟡 Dégradé | Projection simple possible (rattachement facture/commande à 99,7%). Scénarios calibrés bloqués par M5. | Débloquer M5 (voir module 06). |
| 03 | Radar de dépendance (client) | 🟡 Dégradé | Concentration par volume calculable (M1 dispo). Volet expertise rare dégradé (produit non segmenté). | Clarifier si les plans analytiques `x_plan2/3/4_id` portent une segmentation exploitable. |
| 04 | Explication d'écart budgétaire | ⬜ Indisponible | Aucune notion de « budget » trouvée, ni dans le dépôt ni dans Odoo. | Décision humaine : définir la source d'un référentiel budgétaire (n'existe nulle part aujourd'hui). |
| 05 | Interrogation en langage naturel | ✅ Disponible | Chat/copilote déjà en production. | — |
| 06 | Crédibilité du forecast | ⬜ Indisponible | M5 bloqué : pas de snapshot (Lot 0 absent) et historisation native Odoo non vérifiable (accès refusé sur `mail.tracking.value`). | Lot 0 (snapshot quotidien) **et/ou** accès Odoo élevé (rôle Administrateur) pour vérifier `mail.tracking.value`. |
| 07 | Opportunités à risque | 🟡 Dégradé | Données brutes très riches (99,8%/99,3%). Version par règles simples possible ; version calibrée sur historique bloquée (M5). | Même prérequis que le module 06 pour la version calibrée. |
| 08 | Ciblage cross-sell chiffré | ✅ Disponible | Déjà en production. M1 nativement calculable. | — |
| 09 | Analyse des motifs de perte | 🟡 Dégradé | 1040 opportunités perdues identifiées, mais seulement 15,6% ont un motif renseigné (3 motifs définis au total). | Aucun prérequis technique — c'est une question de discipline de saisie côté Odoo, hors périmètre du portage. À afficher avec un taux de couverture explicite. |
| 10 | Coaching de portefeuille | ⬜ Indisponible | Dépend de M5, bloqué. | Idem module 06. |
| 11 | Consommation du backlog vs plan | 🟡 Dégradé | Rattachement facture/commande excellent, mais `commitment_date` à 0,0% et aucun champ custom de repli trouvé. | Décision humaine : soit un champ de durée contractuelle est saisi ailleurs (à identifier), soit le module reste un proxy volume explicitement étiqueté comme tel en permanence. |
| 12 | Mois de visibilité par practice | ⬜ Indisponible | Double blocage : pas de durée contractuelle (cf. 11) et `categ_id` non exploité (97% dans une seule valeur « All »). | Vérifier le contenu métier des plans analytiques custom `x_plan2/3/4_id` — pourraient combler ce vide, non confirmé dans cette phase. |
| 13 | Détection de dérive d'affaire | 🟡 Dégradé | Même blocage que le module 11 sur la durée contractuelle. | Idem module 11. |
| 14 | Fiabilité fournisseurs | ✅ Disponible | **Upgradé vs hypothèse initiale** : module Inventaire confirmé installé et utilisé (52 705 mouvements de stock rattachés à des lignes d'achat) — délai de réception réel mesurable. Recoupe l'indicateur déjà livré ce soir. | — |
| 15 | Tension sur la sous-traitance | 🟡 Dégradé | L'indicateur déjà livré ce soir (marge, dépendance, rupture) fonctionne sans M4. Le volet comparaison de prix par référence produit (si retenu dans la définition finale du module) reste dégradé. | Clarifier avec le métier si la définition retenue inclut ou non la comparaison de prix par référence. |
| 16 | Prévision d'encaissement comportementale | ✅ Disponible | M2 calculable côté client (dates d'échéance et de paiement réel disponibles). | — |
| 17 | Dérive du délai de paiement (client) | ✅ Disponible | Même base que le module 16. | — |
| 18 | Surveillance de l'exposition | ✅ Disponible | M1 et M2 tous deux calculables. | — |
| 19 | Effet ciseau achat/vente | 🟡 Dégradé | Aucun rattachement achat/vente ligne-à-ligne — seule la granularité référence produit est envisageable, elle-même dégradée (`default_code` à 0,1%, `categ_id` non exploité). | Décision humaine sur la granularité acceptable (affaire vs référence produit) ; amélioration de la qualité de catégorisation produit si le niveau référence est retenu. |
| 20 | Détection d'anomalies de facturation | 🟡 Dégradé | Dépend de M3 et M4, tous deux dégradés. | Cumul des prérequis des modules 11 et 19. |
| 21 | Fiche compte avant rendez-vous | 🟡 Dégradé | Portefeuille client existant ; contenu exact du format attendu par la maquette non comparé précisément. | Comparaison écran par écran avec la maquette (Phase 5). |
| 22 | Next best action | 🟡 Dégradé | M1 disponible, M3 dégradé — action fondée sur le rythme, pas sur un calendrier contractuel théorique. | Idem module 11 pour la partie M3. |
| 23 | Alerte rupture de rythme | ✅ Disponible | M1 pur, aucun snapshot requis, dates naturellement historiques. **Upgradé vs hypothèse initiale.** | — |
| 24 | Radar renouvellement et obsolescence de parc | 🟡 Dégradé | M1 disponible, M3 dégradé — renouvellement par rythme observable, pas par date de fin de contrat réelle. | Idem module 11. |
| 25 | Aide à la rédaction contextualisée | ✅ Disponible | Génération de sections d'offre/stratégie déjà en production (module Appel d'offre). | Clarifier le périmètre exact attendu (réponse à AO existant vs communication compte à créer). |

---

## Prérequis bloquants transverses (à lever avant certaines phases suivantes)

1. **Lot 0 — snapshot quotidien du pipeline et du carnet de commandes.** Bloque directement les modules 02 (partiellement), 06, 07 (partiellement), 09 (partiellement), 10. C'est, mot pour mot, le seul prérequis que le prompt de portage qualifie lui-même de dommage irréversible en cas de report — je recommande de le lancer indépendamment de la suite de l'arbitrage.
2. **Accès Odoo élevé (rôle Administrateur) ou méthode alternative** pour vérifier `mail.tracking.value` sur `crm.lead` — sans quoi l'existence d'un historique NATIF Odoo (qui rendrait M5 possible sans même attendre le Lot 0) reste une inconnue, pas un fait établi.
3. **Clarification métier sur les plans analytiques custom `x_plan2_id`/`x_plan3_id`/`x_plan4_id`** — pourraient débloquer une vraie segmentation par practice (modules 03, 12, 15, 19, 20) si leur contenu s'y prête. Non vérifiable par lecture de champ seule.
4. **Décision sur le rôle applicatif correspondant au profil « AM »** (aucune correspondance directe trouvée en Phase 0) — nécessaire avant la Phase 5 (droits d'accès par profil).
5. **Décision sur le design system** (reprise à l'identique de la maquette vs coexistence vs inspiration seule) — nécessaire avant la Phase 4.

---

**Ce document ne contient aucune décision d'exécution. J'attends la validation avant de démarrer la Phase 2 (décision d'architecture — formalité étant donné que l'Option B est déjà en place, mais qui doit acter explicitement le statut du Lot 0 et des prérequis ci-dessus).**
