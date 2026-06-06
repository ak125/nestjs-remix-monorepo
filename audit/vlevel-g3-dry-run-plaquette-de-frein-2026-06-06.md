# G3 — DRY-RUN read-only · `plaquette-de-frein` (pg_id 402) · 2026-06-06

> **AUCUNE MUTATION.** SELECT only. Aucun UPDATE/INSERT/DELETE, aucune migration,
> aucun recalcul réel, aucun changement runtime. Verdict pour une **future** étape
> owner-gated — **pas** pour appliquer maintenant.
> Harnais : `scripts/seo/vlevel-g3-dryrun.ts` (read-only, paramétrable par pg_id).
> Diff machine : `audit/vlevel-g3-dry-run-plaquette-de-frein-diff.json`.

## 0. Snapshot BEFORE (pg_402)
- V2/V3/V4 véhicule (input élection) : **378** keywords.
- V5 persisté : **716 rows / 581 type_id distincts**, dont **263 sur modèles root**.
- 40 modèles distincts classés (V2/V3/V4).

## A. Correction C — energy `NULL`→`'unknown'`
**Impact sur pg_402 : 0 changement** (`changed_by_energy_fix = 0`). Les 3 groupes qui
fusionneraient (mesure globale) sont dans une **autre gamme**, pas plaquette-de-frein.

⚠️ **Caveat de fidélité** : la ré-élection simulée reproduit le `v_level` persisté à
**85 % (322/378)**. Les 15 % d'écart viennent de `propagate_vlevel_per_typeid` + triggers
DB (qui uniformisent **après** l'élection). ⇒ Une simulation C **exacte sur d'autres gammes**
exigera de rejouer le **pipeline complet** (élection + propagate), pas une simple ré-élection.
Ici c'est **sans objet** (C = no-op sur 402).

→ **Verdict C (pg_402)** : `GO` trivial (no-op). Rien à appliquer.

## B. Correction B — V5 sur modèles root
**263 V5 sur modèles root** (`modele_parent = 0`) dans pg_402.
Échantillon des modèles root concernés : *2008 I, 207, 208 I, 3008 MPV, 307, 308 I, 407,
5008 I, 508 I, A1, A3 II, A4 Allroad I B8…*

Or la règle V5 « siblings » ne produit **jamais** de root (un sibling = enfant d'un parent
≠ 0). Ces 263 sont donc **non-conformes à la règle actuelle** — vraisemblablement créés par
une version antérieure de l'algorithme.

→ **Verdict B (pg_402)** : `REVIEW_OWNER` — **ne pas auto-supprimer**. 263 type_id à trancher
au cas par cas (supprimer vs garder si légitimement enfants d'un véhicule cherché). Liste
complète dans le diff JSON.

## C. Correction A — V5 union (siblings + enfants)
La règle union appliquée à pg_402 produirait :
| Source | Modèles | Nouveaux V5 type_id |
|---|---|---|
| **siblings** (même parent, root-skip) | 5 | **9** |
| **enfants** (modele_parent = modèle classé) | 27 | **191** |
| **UNION (nouveaux)** | — | **200** |

**MAIS V5 actuel persisté = 581 type_id.** Écart majeur : la règle ne « justifie » que ~200
V5 (dont la plupart **enfants**, aujourd'hui **absents**), alors que **581** sont persistés
(dont 263 root non-conformes). ⇒ Appliquer la règle = **restructuration profonde** du V5 de
cette gamme : retirer les non-conformes **et** ajouter ~191 enfants (véhicules **sans demande
Google** → risque **thin-content R8**, cf. outil `r8-diversity-check`).

→ **Verdict A (pg_402)** : `NO-GO sans liste type_id complète + décision owner`. Changement
marketing-data important (≈ −381 / +200). Liste candidate dans le diff JSON.

## Totaux (pg_402)
| Élément | Valeur |
|---|---|
| V5 actuels (type_id) | 581 |
| dont sur root (suspects, REVIEW) | 263 |
| V5 union « nouveaux » (siblings 9 + enfants 191) | 200 |
| V5 changés par energy (C) | 0 |

## Verdict global : **GO-PARTIEL** (pour la PHASE SUIVANTE owner-gated, pas pour appliquer)
- **C** : `GO` (no-op ici ; sim full-pipeline requise pour les autres gammes).
- **B** : `REVIEW_OWNER` (263 root, par-ligne, jamais auto-remove).
- **A** : `NO-GO` sans liste exacte + décision owner (restructuration V5 + risque thin-content).

## Limites honnêtes de ce dry-run
1. C/élection : reproduction à 85 % (propagate + triggers non rejoués) → pour une mutation C
   exacte, construire la sim **pipeline complet** d'abord.
2. B/A sont **exacts** (hiérarchie `auto_modele`, indépendants de l'élection).
3. Rien n'a été écrit. Étapes 4-5 (mutation réversible + snapshot AFTER) attendent un GO
   **par correction**, sur **une seule gamme pilote**, avec backup + rollback + journal `__seo_event_log`.

## Prochaine étape proposée (toujours read-only jusqu'au GO mutation)
Construire la **sim pipeline-complet** (élection + propagate) pour atteindre 100 % de fidélité
sur C, **si** tu veux corriger C ailleurs. Sinon, le vrai sujet ici = **A/B (V5)**, déjà exacts.
