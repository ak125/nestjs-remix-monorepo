# V-Level V3 — Procédure d'application par gamme (runbook gelé)

> **Stratégie figée** (2026-06-07), prouvée bout-en-bout sur la famille FREINAGE. À appliquer
> **uniformément** à chaque gamme qui a des keywords SEO. Ce runbook **pointe** vers la doctrine
> (mémoire / vault) — il ne la redéfinit pas. **Read-only d'abord, apply gardé owner-gated, réversible.**
>
> Outils : `scripts/seo/vlevel-v3-pipeline.ts` (PR #878). Garde anti-recontamination runtime : #882.
> Parser accent/roman : #883. Doctrine V-Level : `@repo/seo-roles` (`vlevel-invariants.ts`) + mémoire
> `project_vlevel_global_audit_findings_20260606`.

## 0. Périmètre RÉEL (ne pas halluciner « 241 gammes »)

La classification V-Level n'existe **que pour les gammes ayant des keywords dans `__seo_keywords`**.
État 2026-06-07 : **19 gammes** (les seules classifiables ; les ~9700 autres n'ont aucun keyword).

| Famille | Gammes (pg_id) |
|---|---|
| **FREINAGE (14)** | disque-82, plaquette-402, cable-124, kit-freins-arrière-3859, étrier-78, maître-cylindre-258, tambour-123, interrupteur-feux-806, flexible-83, pompe-à-vide-387, cylindre-de-roue-277, répartiteur-73, mâchoires-70, témoin-usure-407 |
| **FILTRATION (5)** | filtre-à-huile-7, filtre-habitacle-424, filtre-à-carburant-9, filtre-à-air-8, filtre-boîte-auto-416 |

**Hors périmètre, jamais touché** : V5 (famille siblings+enfants), V6/V1 (à construire), toute gamme sans keyword.

## 1. Doctrine (pointeurs — figés ailleurs, ne pas réécrire)

- **diesel par défaut** sur modèle-seul ; **essence ≠ diesel** = véhicules/pages V3 **distincts**, jamais fusionnés.
- **V5 préservé** (jamais déclassé/réélu/recalculé).
- **gamme-term-aware** : un keyword d'une autre pièce ne peut pas être champion d'une gamme (anti re-contamination, #882).
- type_id valide = **`type_display='1'`** + modèle + marque + alias → URL `/pieces/{gamme}/{marque}/{modele}/{type}.html` constructible.
- **cylindrée du keyword** doit matcher le candidat (sinon REVIEW, pas apply).

## 2. La méthode — 5 étapes par gamme, READ-ONLY d'abord

| # | Étape | Quand | Outil (READ-ONLY) | Apply |
|---|---|---|---|---|
| 0 | **Triage** | toujours | `auto-plan --family F` + `blocked-plan --family F` | — |
| 1 | **Décontamination** | gamme polluée cross-gamme | `decontaminate-pack --pg-id N` | déclasse v_level→NULL (keywords autre pièce) |
| 2 | **Réélection** | gamme sous-élue / 100% V4 | `reelection-pack --pg-id N` | V2/V3/V4 miroir canonique, terme-gamme scopé |
| 3 | **Type_id diesel-default** | champions modèle-seul | `generics-pack --pg-id N` | re-cible modèle-seul → rep diesel |
| 4 | **Blocked-resolve** | champions cassés | `blocked-plan` → `blocked-apply-pack --family F` | champions cassés → rendables (cas clairs only) |

Chaque pack génère un **package SQL gardé** (snapshot embarqué + rollback). Le script **n'écrit JAMAIS** en DB.

## 3. Policy de classification (auto-triage)

| Décision | Critère | Sort |
|---|---|---|
| **AUTO_APPLY_SAFE** | conf ≥ 80 · rendable · pas cross/review/defer · cylindrée OK (ou déjà-cible) | seul **auto-applicable** |
| **OWNER_REVIEW** | conf 60-79 · essence/diesel ambigu · cylindrée ≠ keyword · multi-génération | owner tranche |
| **DEFER** | sous-modèle suspect (Aircross/Allroad/Décapotable/Be Bop) · catalogue absent | investigation séparée |
| **BLOCKED** | type_id NULL · /pieces non-rendable · TecDoc orphelin · cross-gamme | corriger via blocked-plan |

## 4. Garde-fous (NON-NÉGOCIABLES)

- **Read-only d'abord, toujours.** Aucun apply sans dry-run relu.
- **Apply = DO-block gardé MCP** : `BEGIN` → UPDATE set-based depuis VALUES → `GET DIAGNOSTICS ROW_COUNT` →
  `IF n <> attendu RAISE EXCEPTION` (rollback atomique) → checks (display=1, exclus inchangés, cible conforme) →
  COMMIT seulement si tout vert. **Réversible** (snapshot/rollback embarqués).
- **JAMAIS auto-appliqué** : V5 · cross-gamme/WRONG_GAMME · QUARANTINE · DEFER_CATALOG · cylindrée-approx ·
  le **recalc admin global** (`recalculateVLevel`) sur une gamme polluée (il re-contamine — n'est sûr que post-#882).
- **Contrôles par ligne avant apply** : pg_id · keyword exact · v_level exact · old_type_id · new_type_id ·
  `type_display=1` · URL /pieces constructible · `rows_matched=1` · cylindrée cohérente.
- **Owner-gated** : tout apply data = **GO nommé** explicite. Toute mutation runtime (service) = PR séparée gouvernée.
- Ne **pas** mélanger les packages : décontamination ≠ réélection ≠ type_id ≠ blocked. Un package = une transformation.

## 5. Inputs par gamme (à fournir/étendre)

- **`GAMME_PART_TERMS`** (`@repo/seo-roles`, terme distinctif pour l'anti-recontamination). Freinage partage
  « frein » → discrimine par la pièce ; filtration partage « filtre » → discrimine par le médium. **Proposé** (à
  valider via le dry-run de `decontaminate-pack` avant tout apply) :

| pg_id | gamme | terme regex proposé |
|---|---|---|
| 82 | disque | `/disque/i` ✅ actif |
| 402 | plaquette | `/plaquette/i` ✅ actif |
| 124 | cable-frein-à-main | `/cable\|câble/i` ✅ actif |
| 7 | filtre-à-huile | `/huile/i` |
| 424 | filtre-habitacle | `/habitacle\|pollen\|clim/i` ⚠ synonymes multiples (charbon-actif) — valider |
| 9 | filtre-à-carburant | `/carburant\|gasoil\|gazole/i` |
| 8 | filtre-à-air | `/\bair\b/i` |
| 416 | filtre-boîte-auto | `/bo[iî]te/i` |
| 78 | étrier | `/[eé]trier/i` |
| 258 | maître-cylindre | `/ma[iî]tre/i` |
| 277 | cylindre-de-roue | `/cylindre.{0,5}roue/i` |
| 123 | tambour | `/tambour/i` |
| 70 | mâchoires | `/m[aâ]choire/i` |
| 73 | répartiteur | `/r[eé]partiteur/i` |
| 83 | flexible | `/flexible/i` |
| 387 | pompe-à-vide | `/pompe.{0,4}vide/i` |
| 806 | interrupteur-feux | `/interrupteur/i` |
| 407 | témoin-usure | `/t[eé]moin/i` |
| 3859 | kit-freins-arrière | `/\bkit\b/i` |

  **Discipline de validation du terme (obligatoire avant décontamination)** : un terme n'est figé pour une
  gamme que si **≥ ~95 % des keywords de la gamme le matchent** (sinon ajouter les synonymes). Requête de
  contrôle (read-only) : `SELECT count(*), count(*) FILTER (WHERE keyword ~* '<terme>') FROM __seo_keywords WHERE pg_id=N`.
  Mesuré 2026-06-07 : huile 99.8 %, carburant 99.9 %, air 100 %, boîte 100 % (figés) ; **habitacle 90 %** avec
  `habitacle|pollen` (synonymes clim/charbon à compléter avant son apply). Les termes freinage non-actifs (étrier,
  tambour…) restent à valider de même à leur tour.

- **seed `vlevel-v3-web-evidence.json`** (`diesel_default_by_modele`) : **model-keyed → réutilisable cross-gamme**
  (les mêmes modèles apparaissent dans toutes les gammes). À **étendre** aux modèles des nouvelles gammes (preuve
  web curée, jamais inventée). Manque rep = `OWNER_REVIEW`, jamais devinette.

## 6. Ordre d'application (par priorité = champions cassés / sous-élection)

1. **filtre-à-huile (7)** — 117 V3, **19 cassés (16%)**, le pire. PROCHAIN.
2. plaquette (402) ✅ · disque (82) ✅ · cable (124) ✅ (faits).
3. **10 gammes 100% V4** (zéro V3 élu) : filtre-air/carburant/habitacle/boîte, étrier, tambour, interrupteur,
   flexible, cylindre-de-roue, témoin → **besoin réélection** (étape 2) d'abord, puis 3-4.
4. gammes V3 partielles : maître-cylindre (25 V3), kit-freins-arrière (39 V3), répartiteur (9), mâchoires (4),
   pompe-à-vide (3) → triage + blocked-resolve.

## 7. État (2026-06-07)

- **Fait** : disque + plaquette + cable (décontam / réélection / type_id) + 8 champions cassés résolus.
- **Outils mergés** : #882 (anti-recontam runtime), #883 (parser modelMatchKey). **En revue** : #878 (orchestrateur
  + blocked-plan + blocked-apply-pack).
- **Gate RPC auto-apply** : backlog, NO-GO jusqu'à preuve sur ≥ 2-3 familles.

## 8. Commandes (npm, READ-ONLY sauf apply gardé owner-gated)

```bash
npm run vlevel:auto:plan           -- --family freinage   # triage AUTO/REVIEW/DEFER/BLOCKED
npm run vlevel:blocked:plan        -- --family freinage   # diagnostic champions cassés + candidats
npm run vlevel:blocked:apply-pack  -- --family freinage   # package gardé cas clairs (read-only)
npm run vlevel:v3:decontaminate-pack -- --pg-id 402        # déclassement cross-gamme (read-only)
npm run vlevel:v3:reelection-pack    -- --pg-id 402        # réélection V2/V3/V4 (read-only)
npm run vlevel:v3:generics-pack      -- --pg-id 402        # type_id diesel-default (read-only)
# apply = DO-block gardé MCP, jamais le script, jamais sans GO owner nommé.
```

---
_Runbook opérationnel — pointe vers la doctrine canon (vault/mémoire), ne la duplique pas. Toute évolution de
règle V (seuils, gates) passe par sa source (vault ADR / `@repo/seo-roles`), pas par ce fichier._
