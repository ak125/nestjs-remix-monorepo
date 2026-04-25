# Log — Timeline des sessions Claude Code

> **But** : trace append-only des sessions Claude Code "importantes"
> (commits / PRs créés). Lu au début de chaque nouvelle session pour
> donner du contexte récent au LLM. Complémentaire à `MEMORY.md`
> (apprentissages) et aux PR descriptions GitHub (détails techniques).

## Délimitation

| Quoi | Où |
|---|---|
| Timeline session : date, sujet, branche, sortie | **`log.md`** (ce fichier) |
| Règles persistantes, gotchas, feedback utilisateur | `~/.claude/projects/.../memory/MEMORY.md` |
| Détails techniques d'un changement | PR description GitHub |
| Décision architecturale canon | `governance-vault/ledger/decisions/adr/` |
| Transcripts session bruts | `.remember/logs/memory-*.log` (gitignored) |

## Format strict (imposé par le skill `/log-session`)

```markdown
## YYYY-MM-DD — sujet bref (≤ 60 chars)

- **Branche** : `feat/<sujet>`
- **Décision** : 1 ligne en français, l'essentiel
- **Sortie** : PRs #XXX | commits abc1234 | fichiers `path/X`, `path/Y`

```

Une entrée = 3 à 4 lignes. Heading H2 par session = greppable + naviguable.

## Règles

1. **Append-only.** Jamais éditer une entrée passée. Une correction = nouvelle entrée datée.
2. **Pas de secrets.** Pas de tokens, IPs internes, credentials. `gitleaks` actif en pre-commit.
3. **Filtre auto.** Hook `Stop` détecte commits/PRs créés et déclenche le skill. Sessions de simple lecture ne loguent pas.
4. **Curated.** Seul Claude Code (via skill `/log-session`) écrit. Les autres agents n'écrivent pas ici.
5. **Lu au démarrage.** `CLAUDE.md` instruit de lire les ~100 dernières lignes en début de session.

---

# Timeline

## 2026-04-25 — bootstrap log.md timeline

- **Branche** : `chore/log-md-session-timeline-1777110107`
- **Décision** : Adoption d'un `log.md` append-only à la racine, complémentaire à `MEMORY.md` (apprentissages) et aux PR descriptions (détails). Hook `Stop` auto-déclenche le skill `/log-session` si commits ou PRs créés. Format strict 3-4 lignes par entrée.
- **Sortie** : nouvelle PR (numéro à venir) | fichiers `log.md`, `.claude/skills/session-log/SKILL.md`, `scripts/claude-hooks/stop-log-session-suggest.sh`, `.claude/settings.json`, `CLAUDE.md`, `.claude/knowledge/README.md`

## 2026-04-25 — vague cleanup batches 1-3 (rétroactif)

- **Branche** : multiples — `chore/cleanup-backend-root-js-...`, `chore/cleanup-dead-components-search-...`, `chore/cleanup-dead-components-forms-...`
- **Décision** : Lancement vague cleanup post-Phase-0. Pattern adopté : worktree isolé + branches timestamp uniques + sequence atomique (rm + commit + push + PR sans typecheck local) pour zero collision avec IDE actif. Validation par CI uniquement.
- **Sortie** : PR #157 mergée (62 scripts `.js` backend root, 5991 lignes) | PRs #158 + #160 ouvertes (3 + 4 composants `frontend/app/components/{search,forms}/`, ~3500 lignes) | git worktree à `/tmp/claude-cleanup-worktree`

## 2026-04-24 — infrastructure Phase 0 cleanup tooling

- **Branche** : `feat/claude-knowledge-base`, `feat/audit-ci-integration`, `feat/cleanup-tooling-prep`
- **Décision** : Adoption knip + madge + dependency-cruiser + ast-grep en gates déterministes (warning-mode Phase 0). Création `.claude/knowledge/` (42 modules + 4 db + 4 integrations). CI workflow `audit.yml` blockant ast-grep. Safe-delete script + baseline JSON regression gate + 3 runbooks ops.
- **Sortie** : PRs #149, #152, #155 mergées | knip 6.6.2 (avec nested zod@4 override) + madge 8 + dep-cruiser 17.3 + @ast-grep/cli 0.42 installés | baseline 362 unused / 17 cycles / 148 violations / 0 ast-errors capturée

## 2026-04-25 — feat/vehicle-rag-web-enrichment-stage1 (auto)

- **Branche** : `feat/vehicle-rag-web-enrichment-stage1`
- **Décision** : feat(rag): vehicle motor corpus scraper + auto-verify enricher (stage 1) (+3 other commits)
- **Sortie** : PR #172 | commits 9f28833a 9dc8f71b 26d3cea0 26812832

## 2026-04-25 — feat/vehicle-rag-web-enrichment-stage1 (auto)

- **Branche** : `feat/vehicle-rag-web-enrichment-stage1`
- **Décision** : feat(rag): elargir sources web vehicule + curated URL CSV (stage 1+) (+5 other commits)
- **Sortie** : PR #172 | commits 8e17940d b1926420 9f28833a 9dc8f71b 26d3cea0 26812832

## 2026-04-25 — feat/vehicle-rag-web-enrichment-stage1 (auto)

- **Branche** : `feat/vehicle-rag-web-enrichment-stage1`
- **Décision** : chore(log): auto session entry for feat/vehicle-rag-web-enrichment-stage1 (+6 other commits)
- **Sortie** : PR #172 | commits 8b1751af 8e17940d b1926420 9f28833a 9dc8f71b 26d3cea0 26812832
