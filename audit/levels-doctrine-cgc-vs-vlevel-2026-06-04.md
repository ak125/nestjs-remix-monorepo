# Doctrine « levels » AutoMecanik — `v_level` vs `cgc_level` vs `L1–L5`

> **Statut : document DE RÉFÉRENCE** (pas canon). Le canon vit au vault
> (`governance-vault/ledger/rules/rules-seo-vlevel.md`) — voir §Canon & écarts.
> Vérifié 2026-06-04/05 (repo + DB live `cxpojprgwgubzjyqzmoq` + design-workflow jugée).
> Les règles V **évolueront** (owner) : ce document + les golden-tests rendent chaque
> ajustement explicite (test rouge→vert nommé), jamais une dérive silencieuse.

## 0. Pourquoi ce document

Un port antérieur des règles V (PHP → monorepo) a **échoué** car les règles n'étaient pas
comprises, et plusieurs systèmes « level » étaient **conflatés**. Ce document fixe la
compréhension partagée, distingue les 3 systèmes, et trace les écarts entre le shippé, le
canon et l'intention owner.

## 1. TROIS systèmes « level » distincts — NE JAMAIS CONFONDRE

| Système | Table / colonne | Sert à | Surface | Statut |
|---|---|---|---|---|
| **`v_level`** (V1–V6) | `__seo_keywords.v_level` | **Classer les véhicules les + recherchés (FR) pour piloter le MARKETING** (vidéo, réseaux sociaux, campagnes, contenu) | Admin + planification SEO ; **PAS le rendu public** | LIVE v5.0 (non encore canon) |
| **`cgc_level`** (1,2,3,5) | `__cross_gamme_car_new.cgc_level` | **Placement / maillage des pages PUBLIQUES** (quels véhicules/pièces pousser selon la page) | Pages publiques gamme/marque/motorisation | LIVE legacy, **sans producteur moderne** |
| **`L1–L5`** | `seo-generator` (var. `VLevel`) | **Budget de tokens** de génération de contenu (taille) | Génération de contenu SEO | LIVE, dérivé du volume |

### Règle canonique anti-conflation
- **`CGC_LEVEL` = signal de placement page / maillage** ; interprétable **uniquement** avec
  le couple **(colonne-filtre × level × page)**.
- **`v_level` = classement véhicule (`type_id`) par demande, pour le marketing.**
- **INTERDIT : mapper `CGC_LEVEL 1/2/3/5` → `V1/V2/V3/V5`.** Ce sont des ontologies différentes.

## 2. `v_level` — règles V (confirmées owner 2026-06-05)

**Unité : 1 véhicule = 1 `type_id` complet = 1 page R8** (ex. *Clio III 1.5 dCi 68 ch*).
Demande Google **FR**, par gamme. Groupe = **[modèle + énergie]** (gamme universelle → ignore l'énergie).

| Niveau | Règle | Création | DB (2026-06-05) |
|---|---|---|---|
| **V3** | Champion #1 du groupe (volume DESC, tie = keyword le + court). 1 par groupe, **volume 0 OK** | recalc service / import CLI | 330 |
| **V4** | Reste du groupe (**volume 0 OK**) | idem | 7 372 |
| **V2** | **Top 10** (cap nommé) des champions de la gamme, dedup **[modèle+énergie]** | promotion depuis V3 | 93 |
| **V5** | **Famille NON cherchée** du véhicule = **SIBLINGS + ENFANTS** (frères Clio 2/4 **et** déclinations Clio 3 break) | dynamique (service) / upsert (CLI) | 1 201 |
| **V6** | `type_id` **absent des recherches Google** (orphelin) | — | **0 (à construire)** |
| **V1** | Star multi-gammes (V2 dans beaucoup de gammes) | — | **0 (à construire)** |
| **(NULL)** | marque / générique / sans motorisation | mis à NULL | 1 348 |

**Précisions owner sur V5 :**
1. **V5 = union SIBLINGS + ENFANTS** (tranché 2026-06-05). Aujourd'hui aucune implémentation ne
   fait l'union (le script fait les frères, le service fait les enfants).
2. **Procédure par véhicule** : chaque véhicule **cherché** (V2/V3/V4) génère **sa propre** famille V5.
3. **Précédence** : un niveau cherché (V2/V3/V4) **gagne toujours** sur V5. **1 `type_id` = 1 seul
   niveau** ; V5 ne concerne que les membres de famille **non cherchés**.

**`propagate_vlevel_per_typeid`** (post-calcul) : pour chaque `type_id`, **remplit uniquement les
`v_level` NULL** avec le meilleur niveau du véhicule (V2>V3>V4>V5) et **préserve l'existant**
(backfill non destructif). ⚠️ Ce comportement **diverge du commentaire** `insert-missing-keywords.ts:1037-1039`
(« champion reste V2, autres→V3, tous héritent ») — le **commentaire est faux** (Dette).

## 3. `cgc_level` — dispatch maillage public (legacy, read-only)

Le chiffre seul n'a **pas** de sens fixe ; c'est le couple **(colonne-filtre × level × page)** :

| Page | Filtre | level | Sortie |
|---|---|---|---|
| Gamme | `cgc_pg_id` | 1 | véhicules vedettes |
| Marque | `cgc_marque_id` | 2 | véhicules populaires de la marque |
| Marque | `cgc_marque_id` | 1 | **pièces** les + vendues de la marque |
| Motorisation | `cgc_type_id` | 3 | gammes/pièces de la motorisation |
| Blog | `cgc_pg_id`/`cgc_marque_id` | 5 | maillage éditorial |

- **Aucun producteur moderne** : seul write = `DELETE` orphelins (`20260327_cleanup_orphan_tecdoc.sql`).
  Table peuplée par chargement legacy ; runtime = lecture seule.
- **Gloss imprécis** : `packages/database-types/src/constants.ts:269-278` étiquette
  `1=GAMME_PAGE / 2=BRAND_PAGE / 3=VEHICLE_PAGE` — incomplet (level 1 sert aussi la page marque pour
  les **pièces**). *Signalé, non corrigé (PR séparée après preuve d'usage).*
- `level 4` interrogé par la boucle blog `[1,2,3,4]` mais **jamais produit** (mort) ; omet le 5.

## 4. Objets DB-only NON versionnés (cause racine du port échoué)

Le repo ne contient **pas** le source SQL de ces objets — invisibles à tout port repo-only.
Capturés verbatim depuis la DB live (voir migration `20260605_vlevel_capture_db_only_functions.sql`).

| Objet | Type | État | Note |
|---|---|---|---|
| `propagate_vlevel_per_typeid(p_pg_id)` | fonction | actif | backfill-NULL-only ; **commentaire script faux** |
| `validate_vlevel_integrity()` | fonction trigger | **trigger DISABLED** (`tgenabled=D`) | 3 règles (V1-exclusif, V1-promotion, priorité même-gamme) ; **encode V1>V2>V3>V4>V5** — vérifier vs intention V5=union avant toute réactivation |
| `__seo_type_vlevel` (table, 9 col.) | table | aucune migration | projection peuplée par `rebuild-type-vlevel.py` |
| `count_vehicles_no_gamme` (V6) | fonction | **ABSENTE** | appelée par le script → tombe sur fallback (Dette) |
| `trg_write_scope___seo_type_vlevel` + autres triggers v-level-adjacents | triggers | actifs | `update_v2_repetitions_*`, `sync_keywords_aggregates`… (à versionner en follow-up) |

## 5. Implémentations & leurs divergences

| Surface | Rôle | V5 | Gate d'éligibilité | Persiste ? |
|---|---|---|---|---|
| `gamme-vlevel.service.ts` | recalc admin | **enfants** (parent→enfants) | `MOTOR_PATTERN` regex | non (éphémère) |
| `scripts/insert-missing-keywords.ts` | import CLI | **frères** (même parent, root-skip) | `type==='vehicle'` (modèle détecté) | oui (upsert) |
| `scripts/seo/rebuild-type-vlevel.py` | **projecteur** `__seo_keywords→__seo_type_vlevel` | — | — | oui (projection) |

- **V5 doit devenir l'UNION** (siblings + enfants) dans les deux calculateurs — convergence owner-gated.
- **Gate divergent** (MOTOR_PATTERN vs `type==='vehicle'`) à unifier — décision owner.
- **dedup V2 sensible à la casse** (clé V3 non-lowercase vs V2 lowercase) : **INERTE** aujourd'hui
  (198/198 modèles déjà en minuscules) → *code smell*, pas bug marketing-critique.

## 6. Données : baseline & non-conformité (2026-06-05)

- Distribution : V2=93 · V3=330 · V4=7 372 · V5=1 201 · NULL=1 348 · V1=0 · V6=0.
- **V5 : 513 `type_id` distincts, dont 268 sur modèles ROOT** (`modele_parent=0`, où la règle dit
  0 sibling) ; ~155 lignes V5 non joignables (`type_id` orphelin). ⇒ V5 actuel **incomplet** (manque
  les déclinations de l'union) **et** partiellement non conforme (root). Correction = **owner-gated,
  dry-run before/after** (jamais de mutation sans preuve).

## 7. Canon & écarts (stale)

| Surface canon | Dit | Réalité shippée |
|---|---|---|
| vault `rules-seo-vlevel.md` v3.0 CANON | V2 = **TOP 20** ; V5 = volume 0 ; `score_seo = volume×(1+nb_v4/5)` | V2 = **TOP 10** ; V5 = famille non cherchée ; **formule abandonnée** (colonne `score_seo` conservée = volume brut) |
| `automecanik-wiki/_meta/enums.yaml` | TOP 20 ; V5 = RAG_ONLY ; V6 deprecated | idem runtime v5.0 |
| `backend/sql/vlevel_health_checks.sql` | T4 « 0 NULL » ; T6 « V3 vol>0 » ; T8 « V4 vol0→V5 » ; T10 `vehicule_v1_dominant` | tous **contredisent** v5.0 (NULL légitime, V3/V4 vol 0 OK, table inexistante) |

Réconciliation = **owner + G3 vault + ADR** (jamais éditée depuis ce monorepo) ; réécriture des
health-checks depuis les invariants confirmés.

## 8. Dettes (follow-ups owner-gated)
1. Corriger le commentaire `insert-missing-keywords.ts:1037-1039` (≠ fonction réelle).
2. `count_vehicles_no_gamme` (V6) : créer ou retirer l'appel mort (V1-first).
3. V5 → **union** dans les 2 calculateurs + recalc data (before/after, journalisé `__seo_event_log`).
4. Unifier le gate d'éligibilité ; normaliser dedup V2 lowercase (inerte).
5. `score_seo` : figer-déprécié ou rebrancher — **jamais DROP**.
6. `validate_vlevel_integrity` (trigger DISABLED) : décider réactivation **après** alignement V5/union.

---
_Réf. plan : `.claude/plans/verifier-v-rification-faite-reflective-goblet.md`. Preuves : repo file:line + `pg_get_functiondef` live + design-workflow jugée (C=8.6)._
