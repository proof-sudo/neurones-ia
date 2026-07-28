# Phase 1 — Audit de la structure de données Odoo

**Méthode** : profiling en lecture seule sur l'instance Odoo réelle, via `OdooAdapter` (JSON-RPC, mêmes identifiants que la synchro de production). Script rejouable : `backend/scripts/profiling_portage_phase1.py` (profiling principal) + `backend/scripts/profiling_portage_phase1b.py` (compléments : correction du filtre actif sur les opportunités perdues, contenu réel de `account.analytic.line`, recherche de champ custom de fin de prestation sur `sale.order`). Exécutés le 28/07/2026. Aucune écriture Odoo.

---

## 1. `res.partner` (comptes clients et fournisseurs)

- **3311 partenaires** au total, **2111 sociétés** (`is_company=True`), **35 inactifs**.
- **Hiérarchie quasi inexistante** : `parent_id` rempli sur **0,1%** des sociétés ; **100%** des sociétés sont leur propre `commercial_partner_id`. **Conclusion : pas de structure de comptes consolidés à gérer** — chaque partenaire est de fait une entité autonome. Le risque anticipé par le prompt (concentration mal calculée si on ignore la hiérarchie) ne s'applique pas ici : il n'y a pas de hiérarchie à ignorer.
- **`credit_limit` configuré (>0) : 0,0%** sur 2111 sociétés (confirmé sur un échantillon complet, pas juste les 5 fournisseurs vérifiés hier). `use_partner_credit_limit` actif : **0 partenaire**. **Aucun compte n'a de ligne de crédit Odoo configurée, sans exception.**
- **`property_payment_term_id` rempli : 0,0%.** Aucun délai de paiement contractuel n'est déclaré au niveau du compte, nulle part.
- **`industry_id` rempli : 0,0%** (1 seul partenaire sur 2111 a un secteur renseigné : « IT/Communication »). Le ciblage cross-sell par analogie sectorielle (module 08) ne peut structurellement pas s'appuyer sur ce champ.
- **`country_id` rempli : 22,1%.** Distribution sur les valeurs renseignées : Côte d'Ivoire (256), Burkina Faso (94), France (22), et une longue traîne de pays.
- **`category_id` rempli : 100%**, mais avec une seule valeur dominante apparente dans l'échantillon (à interpréter avec prudence : Odoo assigne souvent une catégorie de contact par défaut, ce n'est pas nécessairement une segmentation métier volontaire — non tranché, à vérifier auprès des équipes qui saisissent dans Odoo).
- **`vat` (identifiant fiscal) rempli : 19,3%.**
- Détection de doublons (nom/numéro) : **non réalisée** dans ce profiling (nécessite un algorithme de similarité dédié, hors scope d'un script de comptage — à prévoir comme tâche séparée si le nettoyage de données devient un prérequis).

## 2. `account.move` / factures

- **Distribution `move_type`** : `out_invoice` 3017, `out_refund` 166, `in_invoice` 5847, `in_refund` 86, **`entry` 39249**. Confirme littéralement le « piège classique » signalé par le prompt : les écritures comptables pures (`entry`) représentent la写 grande majorité des enregistrements du modèle — **tout calcul doit filtrer `move_type` explicitement**, ce que le code de synchro actuel fait déjà correctement (vérifié Phase 0).
- **`invoice_origin` rempli sur `out_invoice` posté : 99,7%.** Taux de rattachement facture↔commande **excellent** — signal très favorable pour le moteur M3 (écart backlog/facturation), qui alimente 7 modules (02, 11, 12, 13, 20, 22, 24).
- **`payment_state` (out_invoice)** : paid 2030, not_paid 841, reversed 46, partial 9.
- **`payment_state` (in_invoice)** : not_paid 3625, paid 1372, partial 3.
- HT/TTC, traitement précis des avoirs (`reversed_entry_id`), quatre variantes de date (`invoice_date`/`date`/`invoice_date_due`/`create_date`) : **non tranchés ici** — ce sont des questions de définition métier (couche sémantique, Phase 3), pas des faits à mesurer. Reportés en section « Ce que je ne sais pas » du présent document.

## 3. `sale.order` / commandes clients

- **Distribution `state`** : draft 3766, sent 4734, **sale 3107**, done 0, cancel 166. Seul `sale` constitue du carnet signé actif (`done` n'est jamais utilisé sur cette instance).
- **`commitment_date` rempli : 0,0%** sur les commandes `sale`/`done`. **Confirmé sans ambiguïté.**
- **Recherche de champ custom de date de fin de prestation** (`fields_get` sur `sale.order`, filtre sur les libellés contenant end/fin/durée/duration/close/clôture) : **aucun candidat trouvé** — seuls des champs sans rapport (`activity_calendar_event_id`, `pending_email_template_id`) matchent le filtre.
- **Conclusion ferme** : il n'existe **aucune donnée de durée contractuelle exploitable**, ni sur le champ standard, ni sur un champ custom. Les modules 11 et 13 (qui en dépendent directement pour leur dénominateur) sont **structurellement indisponibles** en l'état, pas seulement dégradés — sauf si une autre source de vérité existe hors Odoo (à vérifier auprès des équipes, hors scope de ce dépôt).
- **Taux de remplissage `product_id` sur les lignes de commande : 78,7%** (13 500 lignes échantillonnées). ~21% des lignes sont donc manuelles/libres, sans produit rattaché — dégrade toute analyse par famille sur cette fraction.
- Mécanisme de récurrence/abonnement : **non trouvé** dans le code ni recherché spécifiquement côté Odoo dans ce profiling (à vérifier explicitement si le CA récurrent devient un KPI prioritaire).

## 4. `crm.lead` / opportunités

- **Distribution `type`** : lead 25, **opportunity 6675**.
- **`expected_revenue` rempli : 99,8%**, **`date_deadline` rempli : 99,3%** sur les opportunités actives — taux très élevés, favorables aux modules 02/06/07/09/10 **sur le plan de la donnée brute**.
- **Opportunités perdues (archivées, `active=False`) : 1040** au total.
- **`lost_reason_id` rempli sur les perdues : seulement 15,6%.** Sur 3 motifs de perte définis au total dans le système. **Le module 09 (analyse des motifs de perte) serait construit sur une base incomplète à 84,4%** — l'analyse resterait valide mais partielle, à qualifier clairement à l'écran plutôt que présentée comme exhaustive.
- **Historisation (`mail.tracking.value` sur `stage_id`/`expected_revenue`/`date_deadline`) : impossible à vérifier.** L'appel a été refusé par Odoo : *« Vous n'êtes pas autorisé à accéder aux enregistrements 'Mail Tracking Value' — autorisé seulement pour Role / Administrator »*. **C'est un vrai blocage d'accès, pas une absence constatée** — contrairement à ce que la Phase 0 supposait par défaut (aucun mécanisme applicatif d'historisation dans notre code), l'existence d'un historique NATIF Odoo (message tracking) reste **non tranchée**. Nécessite soit un accès élevé (rôle Administrateur Odoo), soit une autre méthode de vérification. **Reporté en section 6 comme prérequis bloquant pour trancher M5 définitivement.**

## 5. `purchase.order` / achats

- **Distribution `state`** : draft 98, sent 16, **purchase 7475**, done 0, cancel 253.
- **`date_planned` rempli : 100%**, **`date_approve` rempli : 100%** sur les achats confirmés.
- **`product_id` sur les lignes d'achat : 99,9%** (9063 lignes échantillonnées) — excellent, quasi aucune ligne manuelle libre côté achats.
- **Module Inventaire (Stock) confirmé installé et utilisé** : **13 780 `stock.picking`**, **52 705 `stock.move` rattachés à une ligne d'achat** (`purchase_line_id`). **Correction du verdict de Phase 0** : le module 14 (fiabilité fournisseurs) n'a PAS à se rabattre sur la date de facture comme proxy dégradé — les dates de réception réelles (mouvements de stock) existent en volume et peuvent être comparées à `date_planned` pour un délai de réception réel et fiable.
- **Rattachement achat↔vente ligne à ligne** : confirmé absent (Phase 0, pas re-testé ici — recherche de `purchase.order.line`/`sale.order.line` croisée déjà faite, 0 résultat de lien direct standard). Le module 19 (effet ciseau) reste limité à la granularité référence produit.

## 6. `product.product` / catégorisation

- **38 848 `product.product`**, **38 849 `product.template`** — volumétrie très importante.
- **`default_code` (référence interne) rempli : 0,1%.** Quasiment aucun produit n'a de code de référence structuré.
- **`categ_id` rempli : 97,0%**, mais avec seulement **4 catégories distinctes** dans l'échantillon, dont **« All » à 97% (4847/5000)** — c'est-à-dire que la catégorisation standard `categ_id` **n'est pas exploitée pour distinguer des familles de prestation** : tout est dans la catégorie racine par défaut. Seules 3 fiches sur 5000 portent « Service » ou « Équipement ».
- **245 libellés normalisés en doublon** sur les 5000 produits échantillonnés (même nom, casse/espaces différents) — confirme le risque de qualité de libellé signalé par le prompt.
- **Découverte non résolue — champs analytiques `x_plan2_id`, `x_plan3_id`, `x_plan4_id`** (trouvés sur `account.analytic.line`, cf. section 7) : ce sont des dimensions d'analytique multi-plan (fonctionnalité Odoo récente remplaçant l'analytique à compte unique). **Il est possible qu'une segmentation par practice/famille existe réellement dans ces plans analytiques plutôt que dans `product.categ_id`** — non vérifié dans ce profiling (nécessite de connaître la configuration métier de ces plans, question humaine, pas une lecture de champ). **Reporté en section 6.**

## 7. Feuilles de temps et analytique

**Comptages bruts** :
- `account.analytic.line` : **26 467** enregistrements — volumétrie substantielle, à l'opposé de l'hypothèse de départ.
- `account.analytic.account` : 455.
- `project.project` : **1**.
- `project.task` : **1**.
- `hr.employee` : **199**.

**Correction majeure par rapport à la Phase 0** : la Phase 0 concluait à l'absence de toute donnée de temps/analytique en se basant sur l'absence de code de synchro dans notre application — ce qui reste vrai (rien n'est synchronisé), **mais la donnée SOURCE existe en volume côté Odoo**, ce qui change la question posée : ce n'est pas « la donnée existe-t-elle » mais « la donnée est-elle du bon TYPE pour les modules 11-13 ».

**Profiling du contenu réel de `account.analytic.line`** (3000 lignes échantillonnées, tri par date décroissante) :
- Champs `employee_id`, `task_id`, `project_id` : **absents du modèle** (`Invalid field`) — confirmé par `fields_get` : **le module `hr_timesheet` n'est pas installé** sur cette instance. Il ne s'agit donc **pas** de feuilles de temps.
- Champs réellement présents et remplis : `user_id` (100%), `account_id` (98,6%), `general_account_id` (100%), `move_line_id` (99,2%), `amount` (99,5%), `unit_amount` (94,1%), `partner_id` (74,3%), `product_id` (65,2%).
- **`so_line` (lien vers une ligne de commande de vente) : 0,0% rempli.**

**Conclusion sans ambiguïté** : `account.analytic.line` sur cette instance est un mécanisme de **ventilation analytique comptable** (allocation de charges/produits à des comptes analytiques via les écritures comptables), **pas un système de suivi du temps passé par employé/tâche**. `project.project`/`project.task` à 1 enregistrement chacun confirment que le module Projet n'est pas utilisé en pratique. **Le verdict de la Phase 0 sur les modules 11/12/13 (proxys uniquement, jamais une vraie mesure de charge) est confirmé et renforcé**, avec une nuance de vocabulaire à corriger : ce n'est pas « pas de données analytiques » mais « des données analytiques existent, mais elles mesurent des flux comptables, pas du temps ou de la charge de travail ».

---

## 8. Constat transverse — accès Odoo limité par rôle

L'appel à `mail.tracking.value` a été explicitement refusé par un contrôle de droits Odoo (réservé au rôle Administrateur). **Le compte de service utilisé par l'application n'a pas ce niveau d'accès.** Cela signifie que certaines vérifications de Phase 1 (historisation via message tracking, et potentiellement d'autres modèles à droits restreints non encore rencontrés) resteront bloquées tant qu'un accès plus large n'est pas accordé, ou qu'une méthode alternative n'est pas trouvée (ex. modèle applicatif dédié, export ponctuel validé par un administrateur Odoo humain).

---

## 9. Ce que je ne sais pas encore (Phase 1)

- Le contenu réel des plans analytiques custom `x_plan2_id`/`x_plan3_id`/`x_plan4_id` — pourraient porter une segmentation par practice non trouvée ailleurs. Question à poser aux équipes qui administrent Odoo, pas déductible par lecture de champ seule.
- Confirmation définitive de l'historisation (ou son absence) du pipeline commercial — bloqué par les droits d'accès (§8).
- Détection de doublons clients/fournisseurs par similarité — non automatisée dans ce profiling.
- Mécanisme de récurrence/abonnement sur les commandes — non recherché spécifiquement.
- Politique de rattachement des avoirs et traitement HT/TTC — questions de définition métier, pas de fait technique (couche sémantique, Phase 3).
- Multi-société réelle sur l'instance — non vérifiée dans ce profiling (aurait nécessité une requête sur `res.company`, non incluse dans le script ; à ajouter si jugé utile avant la Phase 3).

---

## 10. Table récapitulative des taux de remplissage clés

| Champ | Modèle | Taux | Modules impactés |
|---|---|---|---|
| `commitment_date` | sale.order | 0,0% | 11, 13 (bloquant confirmé) |
| `credit_limit` configuré | res.partner | 0,0% | 18, et l'indicateur crédit fournisseur ajouté ce soir |
| `property_payment_term_id` | res.partner | 0,0% | 17, et le délai négocié fournisseur ajouté ce soir |
| `industry_id` | res.partner | 0,0% | 08 (déjà existant par un autre mécanisme) |
| `invoice_origin` | account.move (out_invoice) | 99,7% | 02, 11, 12, 13, 20, 22, 24 (M3) — favorable |
| `expected_revenue` / `date_deadline` | crm.lead | 99,8% / 99,3% | 02, 06, 07, 09, 10 — favorable sur la donnée, bloqué par l'historisation (M5) |
| `lost_reason_id` sur perdues | crm.lead | 15,6% | 09 — dégradé |
| `product_id` sur lignes de vente | sale.order.line | 78,7% | analyses par famille |
| `product_id` sur lignes d'achat | purchase.order.line | 99,9% | favorable |
| `default_code` | product.product | 0,1% | catalogue/référencement |
| `categ_id` significatif (hors « All ») | product.product | ~3% | 08, 12, 15, 19 — dégradé sauf si x_plan2-4 comblent le vide |
| Réception réelle (stock.move rattaché) | purchase.order (via Stock) | 52 705 mouvements confirmés | 14 — **upgradé** vs hypothèse Phase 0 |
