# Alternative Proposal Workflow — legacy-compatible (design)

> **Design only (read-only) — AUCUN code, AUCUNE migration, AUCUN UPDATE exécutés.** Owner-GO + OBSERVE (fin 2026-06-08).
> Suite de [unavailable-quarantine-plan.md](./unavailable-quarantine-plan.md) + [relance-tracking-2026-05-31.md](./relance-tracking-2026-05-31.md).
> Stratégie : **quarantaine + proposition d'alternative compatible/disponible + acceptation explicite client** (pas de substitution silencieuse). Maj 2026-05-31.

## 0. Découverte clé — le workflow d'équivalence est **DÉJÀ porté en NestJS**
Le legacy PHP (statuts 91/92/93, `ORL_EQUIV_ID`, consentement panier) **a déjà son équivalent moderne** dans le repo. Donc : **IMPROVE/REUSE, PAS CREATE.** La machinerie existe ; **ce qui manque, ce sont les pièces de sécurité** (capture consentement, gate paiement, filtres dispo/marge) — toutes **parkées**.

## 1. Ce qui est **REUSE réel** (déployé, vérifié dans le code)
| Capacité | Où | Rôle |
|---|---|---|
| `___xtr_order_line.orl_equiv_id` | `order-actions.service.ts` (propose/reject/updateLineStatus) | lien traçable ancienne↔nouvelle ligne |
| Statuts **91/92/93/94** (enum typé) | `packages/domain-commerce/src/order-line-status.ts` | 91 proposition · 92 accepté · 93 refusé · 94 validé |
| `proposeEquivalent / acceptEquivalent / rejectEquivalent / validateEquivalent` | `OrderActionsService` | crée/valide la ligne équivalente |
| `___xtr_order_line_equiv_ticket.orlet_amount_ttc` | `validateEquivalent` (`amountDiff`) | **supplément / remboursement** |
| Signal quarantaine `piece_display=false` + `pricing_state='FROZEN'` | pilote 2026-05-31 (import-safe) | précondition « pièce gelée » |
| RPC compat `rm_get_page_complete_v2` / `get_pieces_for_type_gamme` | migrations RPC | trouve les pièces **compatibles** du même gamme+véhicule |
| Event stream commande `___xtr_order_history` (`append_order_event`) | migration order_history | tracking niveau commande |

## 2. ⚠️ Corrections du critic — ce qui n'est PAS du reuse (à ne pas croire acquis)
1. **Le RPC compat n'exclut PAS `FROZEN`** — il ne filtre que `piece_display=true` (aucun `pricing_state` dans les migrations RPC). FROZEN est le **verrou import-safe**, pas un filtre RPC. La recherche d'alternative DOIT ajouter explicitement `pricing_state <> 'FROZEN'` **ET** `pri_dispo IN ('1','2','3')` (et noter : `rm_get_page_complete_v2` ne filtre pas `pri_dispo=0`, il ne fait que trier ; seul `get_pieces_for_type_gamme_v4` filtre `pri_dispo='1'`). → **filtres NEUFS à construire**.
2. **Veto marge = build, pas reuse** : `validateEquivalent` calcule **seulement** `amountDiff` (prix), **jamais** `computeMargePct`. Le contrôle « marge OK sur l'alternative » est un **câblage neuf**.
3. **`OrderActionsService` = SoT conventionnel, pas scellé** : le guard ast-grep `commerce-no-direct-line-status-write` **ignore** ce service et ne matche que la forme littérale `.from('___xtr_order_line')` (le service écrit via `TABLES.xtr_order_line`). Ne pas surclaimer « écriture interdite ailleurs ».
4. **🔴 Bug d'argent — TVA hardcodée** : `proposeEquivalent` fixe `TVA=1.2` (`// TODO récupérer taux réel`), divergent de `pri_tva_n`. Un supplément **payé par le client** avec une mauvaise TVA = **mauvaise facturation**. → **précondition à corriger AVANT tout supplément client**.
5. **🔴 Substitution silencieuse par proxy** : `acceptEquivalent` ne fait que passer au statut 92 — **aucun contrôle qu'un consentement client authentifié l'a précédé**. Si l'UI client est câblée naïvement, un clic opérateur = substitution sans consentement. → **le statut 92 NE DOIT PAS valoir consentement** : il faut un **record de consentement** (champ/event dédié, reason enum) comme **précondition dure** de l'acceptation.

## 3. Le workflow (étapes → département → mécanisme)
| # | Étape | Département | Mécanisme |
|---|---|---|---|
| 1 | Détection (commande non payée / paiement annulé rupture, pièce gelée) | Service Client + Achats | **REUSE** signal quarantaine |
| 2 | Gate précondition (preuve gel) | Achats + Gouvernance | **REUSE** `FROZEN`+`piece_display=false`+reason |
| 3 | Capture véhicule (plaque/VIN/modèle/réf origine) **+ consentement** | Service Client + Commercial | **PARKED** (`AutomotiveOrdersDto` orphelin) |
| 4 | Recherche alternative compatible **+ disponible** | Catalogue + Achats | **REUSE** RPC compat **+ PARKED** filtres `<>FROZEN`/`pri_dispo IN(1,2,3)` |
| 5 | Recalcul prix : supplément/remboursement **+ veto marge** | Pricing | **REUSE** `amountDiff` + equiv-ticket · **PARKED** veto marge + **fix TVA** |
| 6 | Assemblage proposition (comparatif ancienne/nouvelle + délai) | Commercial + Pricing | **REUSE** champs `proposeEquivalent` |
| 7 | Création enregistrement équivalence (lien + statut 91) | Service Client (système) | **REUSE** `proposeEquivalent` → `orl_equiv_id` |
| 8 | Envoi proposition au client | Commercial | **REUSE** lien `___xtr_msg.msg_orl_equiv_id` (livraison = parked) |
| 9 | Acceptation / refus **explicite** | Service Client + Commercial | **REUSE** accept(92)/reject(93) · **PARKED** record de consentement dur |
| 10 | Validation + ticket financier | Pricing + Service Client | **REUSE** `validateEquivalent`(94)+ticket (après fix TVA) |
| 11 | Tracking conversion alternative | Data + Gouvernance | **PARTIAL** — order-stream existe ; events ligne EQUIV_* = **PARKED** |

**Exemple vérifié** : pièce gelée 3283441 (émetteur LUK/ACR) sur véhicule 5354 → `rm_get_page_complete_v2(234,5354)` = **count 1 → une alternative existe** (autre émetteur non-gelé). Sur 5643 → count 0 → **pas d'alternative sur ce véhicule** → fallback (autre fournisseur/sourcing manuel). La recherche d'alternative **marche** via l'existant (+ les filtres dispo à ajouter).

## 4. À GARDER du legacy · À NE PAS reprendre
**Garder** : consentement AVANT validation forte · capture véhicule · jamais de paiement sur réf gelée · comparatif ancienne/nouvelle · accept/refus explicite · lien `orl_equiv_id`.
**Jeter** : spaghetti PHP/`$_SESSION` · statuts magiques non documentés (→ enum typé) · proposition sans traçabilité · auto-équivalence sans preuve dispo **ET** marge · paiement sur réf gelée.

## 5. Carte départements
Achats = confirme rupture + dispo de l'alternative · Catalogue = équivalents compatibles (RPC + fallback) · Pricing = supplément/remboursement + **veto marge** + **fix TVA** · Commercial = envoie la proposition · Service Client = capture + suit accept/refus + supplément/remboursement · Data = conversion alternative · **Gouvernance = interdit la substitution silencieuse** (consentement + traçabilité + preuve dispo/marge + no-payment-on-frozen).

## 6. Garde-fous (invariants)
- **Pas de substitution silencieuse** : jamais d'alternative sans proposition + décision explicite ; **le statut 92 ne vaut PAS consentement** → record de consentement requis.
- **Pas de paiement sur réf gelée** : règle posée **dès maintenant** ; son enforcement (gate pré-paiement) reste **parké** (le cart ne lit que `piece_stock`).
- **Traçable** : tout = `orl_equiv_id` + `pricing_state_reason`.
- **Pas d'auto-équivalence** sans preuve **dispo** (`<>FROZEN` + `pri_dispo IN 1,2,3`) **ET** marge OK.
- **TVA réelle** (`pri_tva_n`) avant tout supplément client — pas de constante `1.2`.
- **Design-only / OBSERVE** : tout (capture, UI, filtres, veto, gate, events) = **PARKED owner-GO**. Rien implémenté.

## 7. Décision scoring & backlog parké
**IMPROVE + REUSE, PAS CREATE.** Aujourd'hui : la **relance manuelle** (message B) **EST** la version manuelle de ce workflow → continuer manuellement.
**Backlog PARKÉ (owner-GO, post-OBSERVE), par priorité de sécurité :**
1. **Fix TVA** `proposeEquivalent` (`pri_tva_n`) — bug d'argent, à corriger avant tout supplément.
2. **Record de consentement** (précondition dure de l'acceptation) + capture véhicule (câbler `AutomotiveOrdersDto`).
3. **Filtres dispo** dans la recherche alternative (`<>FROZEN` + `pri_dispo IN 1,2,3`).
4. **Veto marge** sur l'alternative (câbler `computeMargePct`).
5. **Gate pré-paiement** sur réf gelée (consumer absent). ⚠️ payment-adjacent → **GO nominatif**.
6. Events ligne `EQUIV_PROPOSED/ACCEPTED/REJECTED` (conversion).

---

## Mini-report départemental (format standard)
**Commercial & Ventes / Achats — Alternative Proposal** · Période : design 2026-05-31 · KPI : conversion d'alternative (vs remboursement) · Résultat : workflow d'équivalence **déjà porté** (statuts 91-94 + `orl_equiv_id` + equiv-ticket) — REUSE confirmé · Score : opportunité forte · Évolution : design · Preuve : ce doc + code `order-actions.service.ts` · Trou : capture consentement/véhicule, filtres dispo, veto marge, **TVA hardcodée**, gate pré-paiement = **parkés** · Cause probable : flow équivalence post-commande non relié à la quarantaine ni au consentement client · Action : **IMPROVE** — continuer la **relance manuelle** (= ce workflow à la main) ; industrialiser plus tard en réutilisant l'existant · Risque : moyen (sécurité : consentement + TVA) · Owner-GO requis : **oui** (tout câblage) · Prochaine preuve : taux d'acceptation des alternatives sur la relance manuelle en cours.
