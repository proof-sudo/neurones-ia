# Registre des décisions — portage maquette Neurones Intelligence

Conforme à la règle §9 du prompt de portage : chaque décision structurante est datée et motivée.

---

## D1 — Design system : coexistence assumée (2026-07-28)

**Décision** : les tokens de la maquette (`--ink`, `--paper`, `--accent`, polices Bricolage Grotesque / Instrument Sans / IBM Plex Mono) sont adoptés **uniquement pour les nouveaux écrans du portage**. Les 12 écrans existants gardent le design system Tailwind actuel, inchangé.

**Motif** : reprendre la maquette à l'identique sur toute l'application impliquerait une refonte visuelle intégrale des écrans déjà en production, hors périmètre du portage, avec un risque de régression visuelle qu'aucune baseline actuelle ne permet de détecter finement (cf. Phase 0, §4 — baseline non-régression incomplète sur le volet visuel). C'est l'écart minimal explicitement prévu par le prompt (§0) quand la fidélité totale n'est pas raisonnable.

**Réversibilité** : haute — une migration progressive de l'existant vers les tokens de la maquette reste possible plus tard, écran par écran, sans que ce choix ne l'empêche.

## D2 — Rôle « AM » → `commercial` (2026-07-28)

**Décision** : le profil « Account Manager » de la maquette correspond au rôle applicatif `commercial` (pas `presale`).

**Motif** : les modules AM de la maquette (fiche compte avant rendez-vous, next best action, radar renouvellement, alerte rupture de rythme sur un portefeuille client) décrivent une fonction de gestion de portefeuille client dans la durée. `presale` (Équipe Avant-Vente) répond aux appels d'offres (module `uc10_presales` déjà en production) — périmètre fonctionnel différent. `commercial` est le rôle existant le plus proche sémantiquement, non encore rattaché à un des 5 profils du cahier des charges.

**Réversibilité** : haute — un nouveau rôle `account_manager` dédié pourrait être créé plus tard si `commercial` s'avère trop générique à l'usage.

## D3 — Réplica/entrepôt analytique : compromis existant accepté (2026-07-28)

**Décision** : le miroir SQLite local resynchronisé toutes les 5 minutes reste l'architecture de lecture pour la suite du portage. Aucun réplica Odoo formel ni entrepôt analytique dédié n'est construit dans le cadre de ce projet.

**Motif** : construire un vrai réplica est un projet d'infrastructure indépendant et significativement plus lourd que le portage de la maquette. Le compromis actuel tourne en production depuis plusieurs mois sans incident constaté, et atteint l'effet recherché (isoler la charge analytique de la base transactionnelle Odoo), au prix d'une fraîcheur à 5 minutes près plutôt qu'un temps réel strict.

**Réversibilité** : moyenne — un réplica pourrait être introduit plus tard sans remettre en cause le code applicatif qui lit aujourd'hui le miroir SQLite (même contrat de lecture, source différente).

## D4 — Lot 0 (snapshot quotidien) : lancé immédiatement (2026-07-28)

**Décision** : implémentation du Lot 0 dès maintenant, indépendamment des décisions D1-D3 et de la suite du portage.

**Motif** : seule tâche du projet qualifiée par le prompt lui-même de dommage irréversible en cas de report (Odoo écrase ses propres états — confirmé Phase 0). Faible risque (additive, aucune modification de comportement existant), scope indépendant (mécanisme de planification déjà en place en production).

**Réversibilité** : n/a — c'est un ajout pur, rien à révoquer.
