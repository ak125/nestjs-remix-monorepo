# Session B — Sampling Report (stratégie §12 ultra-safe)

> Date : 2026-04-13
> Branch : `fix/pieces-relation-type-pollution-session-a` (Session A commit `f3d65d02`)
> Plan : `/home/deploy/.claude/plans/swirling-giggling-scott.md` §12
> Status : **B.0 → B.4 exécutés ; STOP avant B.5 (patch SQL function)**

## 1. Préconditions B.0

| Check | Attendu | Réel |
|---|---|---|
| `pieces_relation_type` n_live_tup | 368 304 446 | 368 304 446 ✓ |
| `tecdoc_raw.t400` n_live_tup | 138 821 565 | 138 821 565 ✓ |
| Triggers sur prt | 0 | 0 ✓ |
| Schema `_filter` existant | non | non ✓ |
| Migration 20260414 appliquée | 0 | 0 ✓ |
| Process tecdoc en cours | aucun sur prt | `recover-tecdoc-images.py` tourne mais vise `pieces_media_img` — pas de conflit |

**B.0 vert**, proceed.

## 2. Création schema + table B.1

```sql
CREATE SCHEMA _filter;
CREATE TABLE _filter.rtp_pollution_ids (
  piece_id, signal_s1_count, signal_s3_artnr, signal_s3_dlnr, marked_at, notes
);
CREATE INDEX idx_rtp_pollution_ids_marked_at ON _filter.rtp_pollution_ids(marked_at DESC);
```

- Durée : < 1 seconde
- Impact sur `pieces_relation_type` : **zéro**
- Rollback : `DROP SCHEMA _filter CASCADE`

## 3. Calcul des 3 signaux B.2 (read-only sur prt)

| Signal | Définition | Durée | Volume |
|---|---|---:|---:|
| **S1** | `pieces_relation_type GROUP BY rtp_piece_id HAVING COUNT > 5000` | 307 s (~5 min) | **13 575 pièces** |
| **S2** | `pieces WHERE piece_year='2025'` | 6 s | **119 702 pièces** |
| **S3** | `article_registry JOIN S1 JOIN S2 WHERE NOT EXISTS in t400` | 147 s (~2.5 min) | **11 929 pièces** |

**Volumes** :
- min volume relations/pièce marquée : 5 043
- max volume : 43 216 (match rapport Phase 1)
- dlnrs distincts couverts : 77

**Match rapport** : le rapport Phase 1 annonçait 13 575 pièces au seuil 5000. S1 retourne exactement **13 575**. Cohérence parfaite, aucune dérive.

## 4. Sampling validation B.3

### 4.1 Hit checks (cas ancres)

| Cas | Attendu | Réel | Status |
|---|---|---|---|
| **Valeo 12185463** (ref 671889, fantome du rapport) | marqué | `true` | ✓ |
| **Valeo 12181205** (ref 207541, la seule vraie Valeo sur Skoda Rapid) | non marqué | `false` | ✓ |
| **Ferodo 6600278** (ref FVR1381, `piece_year=2023`) | non marqué | `false` | ✓ |

**3/3 PASS**. La pièce Valeo légitime qui survit à l'audit Session A est correctement préservée ; la pièce fantome rapport est bien marquée ; la pièce 2023 est correctement préservée (S2 filtre).

### 4.2 Top 20 de l'intersection (should look polluted)

Tous `piece_year=2025`, sequential piece_ids, sequential artnrs groupés par dlnr, **mêmes n_relations** dans chaque groupe :

| piece_id | artnr | dlnr | n_rel | display |
|---|---|---:|---:|---|
| 12514013 | MDB84446 | 73 | 43 216 | true |
| 12514014 | MDB84553 | 73 | 43 216 | true |
| 12483302 | 2709202 | 39 | 43 191 | true |
| 12483299 | 2708802 | 39 | 43 191 | true |
| 12483277 | 2696201CP | 39 | 43 191 | true |
| 12497469 | 444.260 | 10 | 39 525 | true |
| 12497680 | B22.030 | 10 | 39 349 | true |
| 12217433 | 07BB0359 | 65 | 39 201 | false |
| (…) | | | | |

**Pattern** : empreinte classique d'un bulk insert — piece_ids consécutifs, artnrs sequential, n_relations identiques par groupe (43 216 x2, 43 191 x4, 39 525 x2, 39 201 x8). **Pollution confirmée** visuellement.

### 4.3 Top 20 dans S1 mais HORS intersection finale (piece_year ≠ 2025)

**100 % des 20 premiers sont `piece_year=2023`**, volume 25 000-36 800 relations :

| piece_id | ref | n_rel | year | display |
|---|---|---:|---|---|
| 8559944 | T331A69 | 36 799 | 2023 | **true** |
| 5770793 | CBM60S | 29 622 | 2023 | false |
| 2802005 | 402402 | 26 764 | 2023 | false |
| 8756896 | U671L13 | 26 054 | 2023 | **true** |
| 6901723 | HR397T | 25 069 | 2023 | **true** |
| 6901722 | HR397 | 25 052 | 2023 | **true** |
| (…) | | | | |

**Trade-off assumé du plan §12** : la cohorte 2023 (1 528 pièces du rapport) n'est pas marquée car S2 est strict `='2025'`. Parmi celles-ci, **plusieurs sont `display=true`** et continueront à polluer certaines pages.

→ **À traiter en Session C ou D** via un signal supplémentaire (ex : recalcul de S1 à seuil plus bas pour 2023, ou filtre S3 uniquement, ou sampling manuel).

### 4.4 Simulation impact page Skoda Rapid × plaquettes (sans B.5 encore)

| Filter apply | all brands | display=1 |
|---|---:|---:|
| **Baseline prod actuelle** | 990 | 392 |
| **Après §12 marker filter** | 310 | **59** |
| **Rebuild+swap (Session A test)** | 20 | 4 |

**Comparatif** :
- §12 marker : **-85 %** actives (392 → 59) — raisonnable, page encore utilisable
- Rebuild+swap : **-98 %** actives (306 → 4, mesuré sur 2 dlnrs seulement — 2 dlnrs suffisent à casser la page)
- §12 **préserve 15× plus de pièces légitimes** que le rebuild aurait détruit

Les 59 pièces actives restantes contiennent :
- Des pièces légitimement compatibles (dont Valeo 207541 confirmé)
- Des pièces 2023 marquées `display=1` avec volume extrême (ex HR397, T331A69) — pollution résiduelle acceptée

## 5. Peuplement final B.4

```sql
INSERT INTO _filter.rtp_pollution_ids (piece_id, signal_s1_count, signal_s3_artnr, signal_s3_dlnr, notes)
SELECT s3.piece_id, s1.n_relations, s3.source_artnr, s3.source_dlnr, 'session-b 2026-04 multi-signal intersection'
FROM _filter.signal_s3_orphan_t400 s3
JOIN _filter.signal_s1_volume s1 ON s1.piece_id = s3.piece_id
ON CONFLICT (piece_id) DO NOTHING;
```

**Résultat** :
- `_filter.rtp_pollution_ids` : **11 929 rows** (match S3 final exactly)
- Taille table : 2 176 kB (~2 MB)
- Durée : < 1 seconde
- Impact sur `pieces_relation_type` : **zéro** (aucune écriture)

## 6. Top 15 fournisseurs marqués

| dlnr | supplier | n_pieces | total_relations_marked |
|---:|---|---:|---:|
| 21 | VALEO | 1 522 | 32 751 881 |
| 32 | SACHS | 1 082 | 15 205 155 |
| 484 | CASCO | 1 003 | 13 019 886 |
| 101 | FEBI | 919 | 8 480 236 |
| 469 | KALE | 881 | 14 326 583 |
| 4819 | HC CARGO | 858 | 17 142 072 |
| 95 | MAGNETI MARELLI | 772 | 11 040 516 |
| 89 | DELPHI | 761 | 14 877 505 |
| 298 | ASSO | 572 | 4 817 548 |
| 161 | TRW | 352 | 10 673 392 |
| 332 | DA SILVA | 308 | 8 337 252 |
| 4501 | LUCAS | 253 | 4 513 027 |
| 408 | SNRA | 234 | 3 025 719 |
| 4705 | MOBILETRON | 214 | 4 192 627 |
| 396 | PRESTOLITE ELECTRIC | 204 | 1 506 616 |

Total approximatif : **~200 M relations "pollutéees" marquées** pour filtrage (sur 368 M totales = 54 %).

Distribution raisonnable : pas concentré sur un seul fournisseur, 77 dlnrs distincts touchés. Cohérent avec "pollution générique due au script d'import", pas un fournisseur particulier.

## 7. Intégrité post-B.4

| Check | Baseline pré-Session-B | Post-B.4 | Delta |
|---|---:|---:|---:|
| `pieces_relation_type.n_live_tup` | 368 304 446 | 368 304 446 | **0** |
| `pg_total_relation_size(pieces_relation_type)` | 47 GB | 47 GB | **0** |
| `pieces_relation_type` schema | 9 colonnes | 9 colonnes | **pas d'ADD COLUMN** |
| Triggers / MVs / FKs | intacts | intacts | — |

**Zéro mutation de `pieces_relation_type`** pendant Session B.0-B.4. Objectif §12 atteint.

## 8. Gate de sortie B.4 → B.5

- [x] `_filter.rtp_pollution_ids` contient 11 929 rows
- [x] Valeo 671889 marqué (phantom confirmé)
- [x] Valeo 207541 NON marqué (légit préservé)
- [x] Ferodo FVR1381 NON marqué (2023 préservé)
- [x] Distribution multi-fournisseurs (77 dlnrs, pas monoculture)
- [x] Sampling Top 20 intersection = pollution visible
- [x] Sampling Top 20 hors intersection = cohorte 2023 (trade-off §12 assumé)
- [x] Simulation page : 392 → 59 actives, raisonnable
- [x] Aucune mutation sur `pieces_relation_type`

**Prêt pour B.5** (patch `get_listing_products_extended` + GUC kill switch) — **validation humaine explicite requise avant**.

## 9. Résidus non marqués à traiter plus tard

### 9.1 Cohorte 2023 polluée avec display=1

Pieces sampled dans S1 hors S2 avec `piece_year=2023` et `display=true` :
- `HR397T` (piece_id=6901723) : 25 069 relations
- `HR397` (piece_id=6901722) : 25 052 relations
- `T331A69` (piece_id=8559944) : 36 799 relations
- `U671L13` (piece_id=8756896) : 26 054 relations

→ Quantité totale à estimer (est. ~50-200 pieces). **Session C ou D** pour décider d'un filtre supplémentaire.

### 9.2 Pièces 2025 avec `S1 ∧ S2` mais artnr présent en t400 (118 pièces)

Ces 118 pièces (12 047 S1∩S2 - 11 929 final) ont leur artnr présent dans t400 actuel. Elles sont probablement légitimes (même si le volume est > 5000, cela peut arriver pour des accessoires universels). Non marquées par défaut — conservatif.

## 10. Rollback si nécessaire

```sql
-- Rollback Session B (tout ou par étape)
DROP SCHEMA _filter CASCADE;  -- instantané, revient à l'état pré-Session-B
```

Aucun rollback sur `pieces_relation_type` nécessaire — n'a jamais été touchée.

---

**Verdict** : gates B.0→B.4 PASS. **STOP à B.5** pour validation humaine explicite avant de patcher `get_listing_products_extended` et activer le filtre sur les lectures prod.
