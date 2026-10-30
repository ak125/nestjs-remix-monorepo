# V-Level V3 — Procédure par gamme

Procédure de préparation et de revue des packs V-Level. Le CLI lit la base et génère des fichiers
locaux ; il n'exécute pas les mutations proposées. Tout apply exige un **GO nommé**, un périmètre
vérifié et une exécution gardée séparée.

Voir le [guide du CLI](../../../scripts/seo/vlevel-v3-pipeline-README.md) pour les commandes,
les sorties et les limites réelles de validation. Les règles partagées sont dans
[`@repo/seo-roles`](../../../packages/seo-roles/src/vlevel-invariants.ts) ; le CLI conserve
certaines règles locales (voir §5). Les constats du 2026-06-07 ci-dessous sont historiques.

## 0. Périmètre et inventaire historique

La classification V-Level n'existe **que pour les gammes ayant des keywords dans `__seo_keywords`**.
Inventaire du 2026-06-07 : **19 gammes** avaient des keywords ; environ 9700 n'en avaient pas.
Revalider cet inventaire avant de choisir un lot ; ces nombres ne décrivent pas l'état courant.

| Famille | Gammes (pg_id) |
|---|---|
| **FREINAGE (14)** | disque-82, plaquette-402, cable-124, kit-freins-arrière-3859, étrier-78, maître-cylindre-258, tambour-123, interrupteur-feux-806, flexible-83, pompe-à-vide-387, cylindre-de-roue-277, répartiteur-73, mâchoires-70, témoin-usure-407 |
| **FILTRATION (5)** | filtre-à-huile-7, filtre-habitacle-424, filtre-à-carburant-9, filtre-à-air-8, filtre-boîte-auto-416 |

**Hors périmètre, jamais touché** : V5 (famille siblings+enfants), V6/V1 (à construire), toute gamme sans keyword.

## 1. Invariants à préserver

- **diesel par défaut** sur modèle-seul ; **essence ≠ diesel** = véhicules/pages V3 **distincts**, jamais fusionnés.
- **V5 préservé** (jamais déclassé/réélu/recalculé).
- **gamme-term-aware** : un keyword d'une autre pièce ne peut pas être champion d'une gamme (anti re-contamination, #882).
- type_id valide = **`type_display='1'`** + modèle + marque + alias → URL `/pieces/{gamme}/{marque}/{modele}/{type}.html` constructible.
- **cylindrée du keyword** doit matcher le candidat (sinon REVIEW, pas apply).

## 2. Méthode par gamme — préparation sans mutation DB

| # | Étape | Quand | Mode du CLI | Transformation proposée |
|---|---|---|---|---|
| 0 | **Triage** | toujours | `auto-plan --family F` + `blocked-plan --family F` | — |
| 1 | **Décontamination** | gamme polluée cross-gamme | `decontaminate-pack --pg-id N` | déclasse v_level→NULL (keywords autre pièce) |
| 2 | **Réélection** | gamme sous-élue / 100% V4 | `reelection-pack --pg-id N` | V2/V3/V4 miroir canonique, terme-gamme scopé |
| 3 | **Type_id diesel-default** | génériques modèle-seul V2/V3/V4 des modèles confirmés par le seed | `generics-pack --pg-id N` | re-cible modèle-seul → rep diesel |
| 4 | **Blocked-resolve** | champions cassés | `blocked-plan` → `blocked-apply-pack --family F` | champions cassés → rendables (cas clairs only) |

Tous ces modes génèrent des fichiers locaux, mais **pas tous du SQL gardé** : `generics-pack`
produit un CSV et un JSON. La proposition SQL de `apply-pack --dry-run` n'a pas les gardes
transactionnelles des packs spécialisés. Consulter le guide du CLI avant de choisir une sortie ;
aucun fichier généré ne vaut autorisation d'exécution.

## 3. Classification du triage

`auto-plan` distingue `AUTO_APPLY_SAFE`, `OWNER_REVIEW`, `DEFER` et `BLOCKED` ; les critères
exacts sont dans sa fonction `autoPlan`. **`AUTO_APPLY_SAFE` est une classification de candidat,
pas une autorisation ni un apply automatique** ; elle comprend aussi des lignes déjà sur cible.
Les cas `OWNER_REVIEW` exigent une décision, les `DEFER` une investigation séparée et les
`BLOCKED` un diagnostic via `blocked-plan`.

Ne pas confondre ces labels avec les propositions `*_CANDIDATE` de `decision-pack` ou avec
les décisions humaines `APPROVE` / `APPROVE_DISTINCT` du CSV. Leurs critères sont distincts.

## 4. Garde-fous (NON-NÉGOCIABLES)

- **Préparation sans mutation DB d'abord.** Aucun apply sans dry-run relu ; préserver les fichiers des packs précédents.
- **Avant toute exécution séparée, exiger un SQL gardé** : `BEGIN` → UPDATE set-based depuis VALUES → `GET DIAGNOSTICS ROW_COUNT` →
  `IF n <> attendu RAISE EXCEPTION` (rollback atomique) → checks (display=1, exclus inchangés, cible conforme) →
  COMMIT seulement si tout vert. Vérifier le snapshot et le rollback du lot ; ne pas présumer
  ces garanties du nom du pack ni d'un résultat `validate-pack` vert.
- **JAMAIS auto-appliqué** : V5 · cross-gamme/WRONG_GAMME · QUARANTINE · DEFER_CATALOG · cylindrée-approx ·
  le **recalc admin global** (`recalculateVLevel`) sur une gamme polluée (il re-contamine — n'est sûr que post-#882).
- **Contrôles par ligne avant apply** : pg_id · keyword exact · v_level exact · old_type_id · new_type_id ·
  `type_display=1` · URL /pieces constructible · `rows_matched=1` · cylindrée cohérente.
- **Owner-gated** : tout apply data = **GO nommé** explicite. Toute mutation runtime (service) = PR séparée gouvernée.
- Ne **pas** mélanger les packages : décontamination ≠ réélection ≠ type_id ≠ blocked. Un package = une transformation.

## 5. Inputs par gamme (à fournir/étendre)

- **Terme distinctif de la gamme** : vérifier la table effectivement utilisée. Le CLI utilise
  `GAMME_PARTS` dans [`vlevel-v3-pipeline.ts`](../../../scripts/seo/vlevel-v3-pipeline.ts),
  tandis que les helpers partagés utilisent `GAMME_PART_TERMS` dans `@repo/seo-roles`.
  Ces tables n'ont pas le même périmètre ; modifier l'une ne met pas l'autre à jour.
  Une gamme absente d'une table ne bénéficie pas de sa garde par terme. Toute extension
  exige une modification revue de la source concernée, pas une regex proposée dans ce runbook.
- **Validation du terme avant décontamination** : le critère de ce runbook reste
  **≥ ~95 % de keywords correspondants**, avec examen des synonymes et des exclusions. Mesurer sur
  le lot courant ; les pourcentages de juin 2026 ne prouvent pas sa couverture actuelle.
  Un dry-run conforme ne prouve pas non plus l'activation de la même garde dans le runtime.

- **seed `vlevel-v3-web-evidence.json`** (`diesel_default_by_modele`) : **model-keyed → réutilisable cross-gamme**
  (les mêmes modèles apparaissent dans toutes les gammes). À **étendre** aux modèles des nouvelles gammes (preuve
  web curée, jamais inventée). Manque rep = `OWNER_REVIEW`, jamais devinette.

## 6. Priorités consignées le 2026-06-07 (à réévaluer)

1. **filtre-à-huile (7)** — 117 V3, **19 cassés (16%)**, priorité identifiée à cette date.
2. plaquette (402) ✅ · disque (82) ✅ · cable (124) ✅ (faits).
3. **10 gammes 100% V4** (zéro V3 élu) : filtre-air/carburant/habitacle/boîte, étrier, tambour, interrupteur,
   flexible, cylindre-de-roue, témoin → **besoin réélection** (étape 2) d'abord, puis 3-4.
4. gammes V3 partielles : maître-cylindre (25 V3), kit-freins-arrière (39 V3), répartiteur (9), mâchoires (4),
   pompe-à-vide (3) → triage + blocked-resolve.

## 7. État historique (2026-06-07)

- **Fait** : disque + plaquette + cable (décontam / réélection / type_id) + 8 champions cassés résolus.
- **Outils mergés** : #882 (anti-recontam runtime), #883 (parser modelMatchKey). **En revue** : #878 (orchestrateur
  + blocked-plan + blocked-apply-pack).
- **Gate RPC auto-apply** : backlog, NO-GO jusqu'à preuve sur ≥ 2-3 familles.

## 8. Utilisation du CLI

Les commandes et précautions sur les fichiers sont maintenues dans le
[guide du CLI](../../../scripts/seo/vlevel-v3-pipeline-README.md). Aucun mode, y compris
`blocked-apply-pack`, n'exécute le SQL produit. `apply-pack --apply` est refusé.

---
_Toute évolution de règle V (seuils, gates) passe par sa source (vault ADR / `@repo/seo-roles`
ou règle locale du CLI identifiée au §5), pas par ce runbook._
