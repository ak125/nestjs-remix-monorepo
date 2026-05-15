# H1 Recovery Forensic Audit — Report

> Run ID: `run_1778853879880_pzl6er`
> Role: `R1_ROUTER`
> Generated: 2026-05-15T14:04:58.883Z
> Plan: `/home/deploy/.claude/plans/lors-du-audite-seo-concurrent-swan.md` §4 Phase A1

> **Note on coverage** : "Total assets audited" reflects only gammes with a stored
> H1 in `__seo_r1_gamme_slots.r1s_h1_override` or fallback `__seo_gamme.sg_h1`.
> Gammes rendering H1 at runtime via template fallback (no stored value) are
> not in this audit scope. Total `__pg_gammes` corpus is ~232 G1/G2.

## Summary

| Metric | Value |
|---|---|
| Total assets audited (with stored H1) | **23** |
| Strong candidates (exact_match_* AND score_delta > 1) | **13** |
| Heuristic candidates | 0 |
| Unknown evidence | 7 |
| Business-critical (tier0 /pieces/*) within strong | 13 |
| Score delta avg (strong only) | 2.85 |

## Evidence tier distribution

| Tier | Count |
|---|---|
| exact_match_snapshot | 0 |
| exact_match_event_log | 0 |
| exact_match_blog_advice | 16 |
| exact_match_builder_template | 0 |
| heuristic_recent_change | 0 |
| unknown | 7 |

## Confidence distribution

| Confidence | Count |
|---|---|
| high | 16 |
| medium | 0 |
| low | 7 |

## Top 20 strong candidates (by score_delta DESC)

| pg_alias | tier | current_score | legacy_score | delta | current H1 | legacy H1 |
|---|---|---|---|---|---|---|
| `disque-de-frein` | exact_match_blog_advice | 4/8 | 8/8 | **4** | Bobine d'allumage — trouvez la référence compatib… | Changer un disque de frein : guide complet [2026] |
| `machoires-de-frein` | exact_match_blog_advice | 4/8 | 8/8 | **4** | Kit d'embrayage — trouvez la référence compatible… | Comment changer des mâchoires de frein |
| `pompe-de-direction-assistee` | exact_match_blog_advice | 5/8 | 8/8 | **3** | Butée d'embrayage — trouvez la référence compatib… | Changer une pompe de direction assistée |
| `alternateur` | exact_match_blog_advice | 4/8 | 7/8 | **3** | Filtre à huile — trouvez la référence compatible … | Comment changer votre alternateur |
| `filtre-a-huile` | exact_match_blog_advice | 4/8 | 7/8 | **3** | Courroie d'accessoire — trouvez la référence comp… | Comment changer un filtre à huile |
| `filtre-a-carburant` | exact_match_blog_advice | 5/8 | 8/8 | **3** | Cardan — trouvez la référence compatible avec vot… | Comment changer un filtre à carburant |
| `courroie-d-accessoire` | exact_match_blog_advice | 5/8 | 8/8 | **3** | Tube d'échappement — trouvez la référence compati… | Comment changer une courroie d'accessoires |
| `flexible-de-frein` | exact_match_blog_advice | 5/8 | 8/8 | **3** | Pressostat d'huile — trouvez la référence compati… | Comment changer un flexible de frein |
| `joint-de-collecteur` | exact_match_blog_advice | 5/8 | 8/8 | **3** | Courroie de distribution — trouvez la référence c… | Comment changer un joint de collecteur |
| `cardan` | exact_match_blog_advice | 5/8 | 7/8 | **2** | Rétroviseur extérieur — trouvez la référence comp… | Comment changer un cardan |
| `filtre-a-air` | exact_match_blog_advice | 5/8 | 7/8 | **2** | Pompe de direction assistée — trouvez la référenc… | Comment changer un filtre à air |
| `etrier-de-frein` | exact_match_blog_advice | 5/8 | 7/8 | **2** | Récepteur d'embrayage — trouvez la référence comp… | Comment changer un étrier de frein |
| `feu-clignotant` | exact_match_blog_advice | 5/8 | 7/8 | **2** | Pompe à carburant — trouvez la référence compatib… | Comment changer un feu clignotant |

## Decision gate A1 → A2

✅ **GO** — Condition (b) met: 13 strong candidates (>= 10) AND avg score_delta 2.85 (>= 2).

See `decision-gate.md` for full justification.

---

_PR-A1 (READ-ONLY) — no DB writes. Apply mode `--persist` requires PR-A2 merged._
