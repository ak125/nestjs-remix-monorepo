# ROADMAP V3.16 — Integration TecDoc vers AutoMecanik

> Date : 2026-03-27 | Revision : V3.19 — Canonique. Remplace V3.18
> Statut : APPROVED — Pipeline operationnel, enrichissement termine, backlog clair
> Archive V3.15 : `.spec/.archive/tecdoc-integration-roadmap-v3.15-archive.md` (1727 lignes, historique complet)

---

## 1. Etat courant valide

### Chiffres canoniques (2026-03-27)

| Metrique | Valeur |
|----------|--------|
| Tables tecdoc_raw | 52 / 122 |
| t400 (linkages raw) | 138.8M lignes (110 DLNR) |
| source_linkages | ~262M lignes (93.6M + 168M GENARTNR v3) |
| Pieces year=2025 total | 119,702 |
| Pieces actives (display=true) | **84,525** (70.6%) |
| Pieces inactives | 35,177 (29.4%) |
| — dont avec linkage (vehicule cache) | ~6,500 (marques inactives) |
| — dont sans linkage | ~35,269 (non recuperables PKW) |
| Modeles crees (is_new=1) | 7,088 (5,346 actifs) |
| Types caches post-2010 | 2,023 (1,785 P4a + 238 anciens) |
| OEM refs projetees | +1,771,052 |
| Search refs projetees | +82,840 |
| Images projetees | +33,442 |
| Criteres projetes | +385,098 |
| **Total enrichissement** | **+2,272,432** |
| Couverture OEM (echantillon 44K) | 89% |
| Couverture criteres (echantillon 44K) | 84% |
| Couverture images (echantillon 44K) | **51%** ⚠️ |
| Couverture search refs (echantillon 44K) | 66% |
| VALEO (DLNR=21) | **2,538 actives / 6,079 creees** — enrichi+active 2026-03-28 |

### Vagues executees

| Vague | Date | Resultat |
|-------|------|---------|
| Vague 1 | 2026-03-24 | 44,237 pieces activees, 154 gammes, 0 rejet |
| Vague 2a (fix registry) | 2026-03-24 | 32,610 registry fixes |
| Vague 3 pilote (5 marques FR) | 2026-03-24 | 658 modeles + 2,168 types actives, 1,934 pieces |
| Enrichissement P1-P4 | 2026-03-25 | +2.27M lignes (scope selectif 76K pieces) |
| GENARTNR heritage | 2026-03-25 | +51.2M linkages projetes, +7,744 pieces activees |
| Vague 3 elargie (15 marques) | 2026-03-25 | +587 pieces activees, modeles+types actives |
| Rename source_genartnr | 2026-03-26 | 3 colonnes + 4 indexes renommes pg_id_source (tecdoc_map) |
| Merge doublon 3942→817 | 2026-03-26 | 442 pieces fusionnees, gamme_aggregates 243→241 |
| Fix naming vehicules | 2026-03-26 | 5,932 types + 595 modeles: energie massdoc, accents, NULL name_url |
| Remap type_id | 2026-03-26 | 23,457 types KTYPNR→sequentiel (60000-83456), ~79M lignes enfants |
| SEO Protection | 2026-03-27 | noindex 60000-83456, 301 redirect >=100K, 535 orphelins archives+supprimes |

### Scripts livres

| Script | Role |
|--------|------|
| `load-t400-active.py` | Charge t400 DLNR actifs (streaming+chunks+workers) |
| `populate-source-linkages.py` | Peuple source_linkages depuis t400 |
| `project-linkages-v3.py` | Projete source_linkages → pieces_relation_type |
| `create-vehicles-p4a.py` | Cree modeles + vehicules (conventions massdoc) |
| `register-and-create-pieces.py` | Phase 1-3 (pieces + registry) |
| `activate-pieces-v1.py` | Activation par gamme avec journalisation |
| `project-enrichment.py` | Projection selective OEM/refs/images/criteres |
| `populate-linkages-genartnr.py` | Heritage GENARTNR pour pieces sans t400 direct |
| `fix-vehicles-massdoc.py` | Fix naming + remap type_id (KTYPNR→massdoc 60000+) |

---

## 2. Invariants non negociables

1. **109 DLNR actifs** — `__tecdoc_supplier_mapping` + `pm_display='1'` + `dlnr IS NOT NULL`
2. **Pas d'injection globale** — projection selective uniquement sur perimetre catalogue construit
3. **Pas de vehicules avant 2010** — `BJVON >= 201001`
4. **Pas de changement des alias/URLs existants** — ON CONFLICT DO NOTHING
5. **Activation manuelle et par vagues** — jamais tout d'un coup
6. **Pas de psql direct** — Python chunks/streaming/workers + connexion directe port 5432
7. **Pas de gammes hors les 242 actives** — `gamme_aggregates`
8. **Pas de DELETE** de pieces/vehicules/modeles existants
9. **Conventions massdoc** — modele_id=marque_id*1000+seq, type_id=sequentiel global 60000+ (remappe depuis KTYPNR TecDoc via `tecdoc_map.type_id_remap`), colonnes doubles (name/name_url/name_meta/alias)
10. **Scope enrichissement** = pieces avec linkage uniquement (76K), JAMAIS les 43K sans linkage

---

## 3. Backlog ouvert reel

### P0 — Heritage GENARTNR : TERMINE ✅ (2026-03-25)

**Resultat** : +51.2M linkages projetes, +7,744 pieces activees. 33,794 articles traites.

### P0.5 — SEO Protection vehicules TecDoc : TERMINE ✅ (2026-03-27)

**Probleme** : Apres remap type_id (KTYPNR 100K+ → massdoc 60000-83456), les anciennes URLs TecDoc retournaient 410 au lieu de 301 → perte SEO potentielle. Les nouveaux vehicules n'etaient pas proteges contre l'indexation prematuree.

**Actions executees** :
1. **noindex nofollow** sur type_id 60000-83456 dans le loader frontend (jusqu'a validation SEO)
2. **301 redirect** anciennes URLs (type_id >= 100K) via RPC `resolve_type_id_remap` + endpoint dedie + guard frontend
3. **Orphelins archives** : 535 lignes (55 tnc + 480 cgc) dans `_archive.orphan_*_20260327` puis supprimees
4. **Legacy intacte** : 30,502 types < 60000, 0 collision, 0 orphelin FK, 100% verifiee

**Fichiers modifies** :
- `backend/src/modules/vehicles/vehicles.controller.ts` — endpoint `resolve-remap` (SEPARE de page-data-rpc)
- `backend/src/modules/vehicles/services/vehicle-rpc.service.ts` — methode `resolveRemappedTypeId()` (cache Redis 24h)
- `frontend/app/routes/constructeurs.$brand.$model.$type.tsx` — noindex guard + 301 redirect guard
- Migrations : `20260327_resolve_type_id_remap.sql`, `20260327_cleanup_orphan_tecdoc.sql`

**Tests E2E DEV** :
- Legacy `14908.html` → 200 ✅
- Nouveau `60044.html` → 200 ✅
- Ancien TecDoc `144071.html` → 301 → `60044.html` ✅
- Inconnu `999999` → `{found: false}` → 410 ✅

### P1 — Vague 3 elargie : TERMINEE ✅ (2026-03-25)

**Resultat** : 15 marques actives, +587 pieces activees. Total actives : 77,933 (65%).

### P2 — Combler le gap images (51% couverture)

**Probleme** : 49% des pieces actives n'ont pas d'image dans pieces_media_img.

**Diagnostic (2026-03-27)** : Les images sont RECUPERABLES via heritage GENARTNR cross-DLNR. Un article sans t232 direct partage un GENARTNR avec d'autres articles d'autres DLNR qui ONT des images.
- Prouve : FTE 2120119 (GENARTNR=234) → BILDNR=483200344 via DLNR=4832
- Ce n'est PAS une limitation source TecDoc

**Action** : REPORTE. Mecanisme valide (30,536/30,584 recuperables via meme gamme) mais bloqueur : les images TecDoc portent souvent la marque fournisseur → copier image BOSCH sur fiche VALEO = concurrent visible. A reprendre quand solution image neutre identifiee.

### P3 — VALEO : TERMINE ✅ (2026-03-28)

**Resultat** : **2,538 pieces VALEO activees** sur 6,079 creees. Pipeline complet :
1. GENARTNR v3 chunked → 50.7M source_linkages DLNR=21
2. Projection prt avec remap KTYPNR→massdoc → 5,368 pieces avec linkage
3. Enrichissement piece_name depuis pieces_gamme → 5,753 nommees
4. Recalcul piece_has_img depuis pieces_media_img → 2,718 avec image
5. Activation (nom + image + vehicule visible) → **2,226 activees**

Pieces restantes (3,853 inactives) : 3,361 sans image + 326 sans nom + 711 sans vehicule.

### P3b — 8,582 pieces 2023 activables hors gamme_aggregates (BLOQUE VOLONTAIREMENT)

**Contexte** : La CMD 5 (activation 2023 avec prix) avait active 23,872 pieces, dont 15,282 dans des gammes hors `gamme_aggregates`. Rollback execute le 2026-03-28 car ces gammes ne sont pas dans le perimetre commercial actif.

**8,582 pieces restantes** (apres rollback + filtre strict) sont dans des gammes comme :
kit-d-accessoires-etrier-de-frein (973), gaine-de-chauffage (923), tuyau-ventilation-carter (408), bague-etancheite-moyeu (240), tuyau-carburant (228), conduite-huile-compresseur (209), segments-pistons (207), coussinets-vilebrequin (190), coussinets-bielle (188)...

**Conditions d'activation** : ces pieces ne doivent etre activees QUE si leur gamme est ajoutee dans `gamme_aggregates`.

**SQL pour activer (quand les gammes seront actives)** :
```sql
-- NE PAS EXECUTER SANS VALIDATION — gammes a ajouter dans gamme_aggregates d'abord
UPDATE pieces p SET piece_display = true
WHERE p.piece_year = 2023 AND p.piece_display = false
  AND p.piece_name IS NOT NULL AND p.piece_name != ''
  AND p.piece_has_img = true
  AND EXISTS (SELECT 1 FROM pieces_price pp WHERE pp.pri_piece_id_i = p.piece_id)
  AND EXISTS (SELECT 1 FROM pieces_relation_type rt WHERE rt.rtp_piece_id = p.piece_id)
  AND EXISTS (SELECT 1 FROM gamme_aggregates ga WHERE ga.ga_pg_id = p.piece_pg_id);
```

### P4 — Classification persistante (~35K non recuperables)

**Apres** Vague 3 elargie. Flag `compatibility_status` :

| Flag | Signification |
|------|---------------|
| `recoverable_hidden_vehicle` | Sera activable apres ouverture vehicule |
| `recoverable_missing_vehicle` | Necessite P4a etendu |
| `not_recoverable_no_tecdoc_t400` | Aucun linkage vehicule dans TecDoc |
| `not_recoverable_non_pkw` | Linkage camion/moteur/essieu uniquement |

---

## 4. Metriques canoniques

### Vue "activation ceiling"

| Categorie | Volume | % | Statut |
|-----------|--------|---|--------|
| Total pieces year=2025 | 119,702 | 100% | — |
| Actives | **84,525** | **70.6%** | ✅ Visible sur le site |
| Inactives avec linkage (marques inactives) | ~6,500 | 5% | Hors scope (marques display!=1) |
| Inactives sans linkage | ~35,269 | 30% | Non recuperables PKW |
| GENARTNR execute | +7,744 | — | ✅ TERMINE |
| Vague 3 elargie executee | +587 | — | ✅ TERMINE |

### Conventions massdoc (verifie en DB 2026-03-27)

**auto_modele** :
- `modele_name` = brut TecDoc, `modele_name_url` = sans codes chassis, `modele_alias` = slugify(name_url), `modele_ful_name` = MARQUE + name
- `modele_id` = marque_id * 1000 + seq (ex: VW 173 → 173000-173331)
- VARCHAR 40 partout sauf ful_name (255)

**auto_type** :
- `type_name` = brut TecDoc, `type_name_url` = reecriture editoriale (NON automatisable), `type_alias` = slugify(name_url)
- `type_id` = sequentiel global. Legacy : 1-59,999 (30,502 types). Remappe TecDoc : 60,000-83,456 (23,457 types)
- `type_liter` = col13 direct (centilitres), `type_power_ps` = CH, colonnes shadow `_i` INTEGER
- Mapping KTYPNR → massdoc : `tecdoc_map.type_id_remap` (old_id PK → new_id UNIQUE)

### Doctrine de projection selective

> On n'injecte pas tout TecDoc. On enrichit seulement le perimetre catalogue deja construit.

Scope : `tecdoc_map.v_projection_scope_pieces` (76,658 pieces avec linkage + fournisseur actif).
Chaque script de projection JOIN sur ce scope. Les 43K pieces sans linkage sont exclues.
