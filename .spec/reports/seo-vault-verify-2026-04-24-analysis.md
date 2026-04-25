---
title: "SEO Vault Verify — Analyse classification des findings"
status: current
version: "1.0"
date: 2026-04-24
skill: seo-vault-verify
---

# SEO Vault Verify — Analyse des findings 2026-04-24

**Skill** : `.claude/skills/seo-vault-verify/` v1.0
**ZIP audité** : `automecanik-seo-vault.zip` (SHA256 `368d0746636b6f804fd58106e6b0c689f308752af5076b57bc107df7549b6d0b`)

Ce document analyse les findings du rapport `seo-vault-verify-2026-04-24.md` (manifest v1) et propose la suite actionable, conforme aux règles `agent-exit-contract.md` (zero auto-fix).

---

## Synthèse

| Source | Findings | Classification |
|--------|----------|----------------|
| Content checks déterministes (v1) | 6 | **False positive** (wording drift manifest v1 ≠ vault réel) |
| Cross-refs ADR-002 | 0 | OK (13 fichiers dans [5,27]) |
| Intégrité Obsidian | 0 | OK (0 erreur frontmatter/dataview) |
| Subagent SEO judgment | 2 | **True positive** (recommandations vault owner) |

**Action livrée** : `expected-changes-v2.yaml` — manifest calibré sur terminologie réelle du vault, audit relancé :

| Métrique | v1 | v2 |
|----------|----|----|
| Content checks passants | 3/9 | **9/9** |
| Cross-ref in_range | ✅ | ✅ |
| Obsidian errors | 0 | 0 |
| Unchanged pass | 18/18 | 18/18 |
| Verdict déterministe | REVIEW_REQUIRED | **SCOPE_SCANNED** (si subagent OK) |
| Verdict final (avec subagent FLAG) | REVIEW_REQUIRED | REVIEW_REQUIRED (reste dû au subagent) |

---

## Findings déterministes (v1 → v2)

### F1 — README.md : `pilier/maillage`

- **Manifest v1** : `must_contain: pilier/maillage`
- **Evidence vault** : `- `maillage-interne` — graphe, PageRank interne, orphelines, puits (pilier primaire)` (00-Meta/README.md)
- **Classification** : False positive — le vault utilise le tag `maillage-interne` (avec dash) et la mention "pilier primaire" séparément, pas le composite `pilier/maillage`.
- **Patch v2** : pattern `maillage-interne` + `pilier primaire` (séparés).

### F2 — Glossary.md : 0/11 et 0/6 termes

- **Manifest v1** : `term_markers: ["**", ":"]` (attendu `**terme** :`)
- **Evidence vault** : `**PageRank interne** — Score d'autorité d'une URL…` (em-dash `—`, pas colon)
- **Classification** : False positive — le vault utilise em-dash, pas colon. Le count trouvait 0 car regex trop strict.
- **Patch v2** : `term_markers: ["**", "—"]` + généralisation de `_count_terms` dans `check_content.py` pour accepter tout marker.

### F3 — Dataview-queries.md : 3 patterns + 1 section

- **Manifest v1** : `gammes orphelines`, section `Autorité externe opportuniste`, `drafts near 14 jours`.
- **Evidence vault** :
  - `### Gammes marquées comme orphelines` (pas "gammes orphelines")
  - `## Autorité externe (opportuniste — ADR-002)` (pas "Autorité externe opportuniste")
  - `### Notes en draft depuis > 14 jours` (pas "drafts")
- **Classification** : False positive — wording drift.
- **Patch v2** : `orphelines` (seul), section `Autorité externe` (plus court), `draft` near `14`.

### F4 — _template-gamme.md : `hubs sources` / `money pages alimentées`

- **Manifest v1** : `hubs sources`, `money pages alimentées`.
- **Evidence vault** : `### Hubs qui alimentent cette gamme` et `### Money pages que cette gamme alimente (top N)`.
- **Classification** : False positive — wording vault différent de la description utilisateur.
- **Patch v2** : `Hubs near alimentent` (window 100) + `Money pages near alimente` (window 300).

### F5 — _template-linkable-asset.md : `p3` near `priorité`

- **Manifest v1** : `p3` attendu près de `priorité` (FR).
- **Evidence vault** : `priority: p3` dans frontmatter YAML (clé anglaise).
- **Classification** : False positive — mismatch FR/EN.
- **Patch v2** : `p3 near priority` (EN, cohérent avec frontmatter).

### F6 — _template-gsc-report.md : `PageRank médian`

- **Manifest v1** : `PageRank médian`.
- **Evidence vault** : `| PageRank interne médian money pages |`.
- **Classification** : False positive — mot `interne` manquant dans le pattern.
- **Patch v2** : `PageRank interne médian` (exact).

---

## Findings subagent SEO (true positives)

Ces findings restent `FLAG` avec manifest v2 — ils concernent des améliorations éditoriales du vault lui-même, **hors scope du skill** (zero auto-fix sur vault).

### anti_sur_optimisation : FLAG

- **Evidence** : ADR-002:292-293 nomme le risque de sur-optimisation anchor text, Pillars.md:218 mentionne "diversité des anchor text".
- **Gap** : aucun exemple concret d'anchor text à éviter / à privilégier, aucune règle chiffrée (ex. "max 20% anchor exact-match par page").
- **Recommandation au vault owner** : ajouter dans `_template-gamme-brief.md` ou `02-ADR/ADR-002` un exemple opérationnel (ratio max, exemples à ne pas faire).

### kpis_mesurables : FLAG

- **Evidence** : `_template-gsc-report.md` liste 5 KPIs maillage dont "PageRank interne médian money pages".
- **Gap** : "PageRank interne médian" n'est pas un KPI standard GSC. Nécessite un outil custom (Screaming Frog Link Score, script). Sans méthode de calcul explicite, la mesure n'est pas reproductible.
- **Recommandation au vault owner** : ajouter dans `_template-gsc-report.md` ou `04-Audits/_playbook-audit-maillage-interne.md` la méthode de calcul (outil + formule + seuil).

---

## Verdict final

**Avec manifest v2 + subagent FLAG** : `REVIEW_REQUIRED`.

Rationale :
- Les 6 findings déterministes v1 étaient des **calibrations manifest** (false positives), tous résolus en v2.
- Les 2 FLAG subagent sont des **recommandations éditoriales** adressées au propriétaire du vault — le skill ne peut ni les corriger ni les ignorer.
- Si le vault owner corrige les 2 FLAG et relance l'audit, verdict attendu `SCOPE_SCANNED`.

---

## Coverage Manifest

```
scope_requested         : audit vault SEO ADR-002 + proposition d'actions
scope_actually_scanned  : 27 fichiers (9 régénérés + 18 inchangés), v1 + v2 audits
files_read_count        : 27
excluded_paths          : aucun
unscanned_zones         : aucune (tous les fichiers du ZIP traités)
corrections_proposed    : manifest v2 (commit sur cette branche), 2 recommandations vault (hors skill)
validation_executed     : true (selftest 6/6, pytest 33/33, audit v1 + v2)
remaining_unknowns      : décision humaine sur les 2 recommandations SEO (anti-sur-opt + PageRank méthode)
final_status            : REVIEW_REQUIRED (subagent FLAG sur 2 dimensions éditoriales)
```

## Exit Conditions

- [x] Audit one-shot exécuté, rapport produit
- [x] Findings classés (6 false positive + 2 true positive)
- [x] Manifest v2 calibré, committé, re-testé
- [x] Verdict déterministe = pass (9/9 content checks)
- [x] Subagent FLAG documenté comme recommandation vault owner
- [ ] Vault owner (Fafa) décide si les 2 recommandations sont à intégrer (hors session courante)
