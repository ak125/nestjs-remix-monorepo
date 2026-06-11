# Agent method patterns — pointers AutoMecanik-native

> `NON-CANON · ADVISORY · POINTER-ONLY · NO AUTHORITY · NO NEW CONTROL PLANE · NO EXTERNAL DEPENDENCY`
>
> Idées gstack traduites en **pointers** vers les mécanismes AutoMecanik **déjà existants**.
> Ce fichier n'autorise aucune action, ne remplace aucun gate et ne peut jamais assouplir un
> guard existant. La vérité reste **vault / registry / DB / RAW→WIKI**.

## 1. Phases — `DISCOVER → DECIDE → PLAN → PATCH → VERIFY → HANDOFF`

Vocabulaire de lecture/sortie — **PAS** un orchestrateur, PAS un gate CI, PAS une pipeline.

| Phase | Mécanisme autoritaire (déjà là) |
|---|---|
| **DISCOVER** | [CLAUDE.md](../../CLAUDE.md) « analyser AVANT muter » → `canonical.json → REPO_MAP → knowledge → ADR vault → grep` |
| **DECIDE** | [continuous-improvement-global](../skills/continuous-improvement-global/SKILL.md) + CLAUDE.md « Prefer extension over creation » |
| **PLAN** | CLAUDE.md « Discipline de périmètre » + worktree dédié ([deployment.md](deployment.md)) |
| **PATCH** | CLAUDE.md « périmètre minimal » |
| **VERIFY** | champ *Test* de continuous-improvement + vérification runtime PRE-PR / POST-MERGE |
| **HANDOFF** | [agent-exit-contract.md](../canon-mirrors/agent-exit-contract.md) (coverage manifest, anti-overclaim) |

## 2. Danger-zone — POINTE vers les guards (ne réécrit rien)

Sources autoritaires : [pretool-bash-guard.sh](../../scripts/claude-hooks/pretool-bash-guard.sh),
[pretool-supabase-guard.sh](../../scripts/claude-hooks/pretool-supabase-guard.sh),
[pretool-file-guard.sh](../../scripts/claude-hooks/pretool-file-guard.sh),
[.ast-grep/rules/](../../.ast-grep/rules/), [.husky/pre-commit](../../.husky/pre-commit).
Niveaux : **BLOCK** (refusé, guard local) · **WARN** (averti, autorisé) · **GATED (CI)** (branch protection GitHub).

| Trigger | Niveau | Mécanisme |
|---|---|---|
| `git push origin main` / `--force` / `reset --hard` / `npm install` | **BLOCK** | bash-guard G1/G3/G4/G5 |
| `docker down/stop/rm` (prod) | **BLOCK** | bash-guard G2 |
| `DROP` / `TRUNCATE` / `DISABLE RLS` | **BLOCK** | supabase-guard G1-G3 |
| `.env` / `.github` / docker / lock / build config | **BLOCK** | file-guard G1-G4 |
| `backend/src/modules/rm/` | **BLOCK** | file-guard G5 |
| `supabase.rpc` direct (commerce) / order-cart status writes | **BLOCK** *(code)* | ast-grep `commerce-*` |
| `ALTER TABLE DROP COLUMN` / `CREATE TABLE` sans RLS | **WARN** | supabase-guard G4-G5 |
| `payments/` edits | **WARN** | file-guard G3 + [payments.md](payments.md) |
| `gh pr merge` → main | **GATED (CI)** | branch protection (merge = PREPROD ; PROD reste tag-gated) |
| `git tag v*` / `push --tags` / deploy-prod | **BLOCK** | bash-guard G6 (#879) — tag = décision opérateur ([deployment.md](deployment.md)) |
| `UPDATE`/`DELETE` `pieces` / `pieces_price` / `__seo_*` via execute_sql | **BLOCK** | supabase-guard G6 (#879) — passer par module/RPC gouverné |

## 3. Freeze scope — rituel par tâche

Discipline : CLAUDE.md « Discipline de périmètre » + [ownership.yaml](../../.spec/00-canon/repository-registry/ownership.yaml) + worktree.

```
Allowed:   <chemins du bounded-context concerné>
Forbidden: <tout le reste — ex. payments/, orders/, migrations non demandées>
Hors scope trouvé → report only, jamais de patch.
```

## 4. QA = report-only par défaut

**La QA produit d'abord un rapport, jamais un patch auto. Tout fix = GO explicite.**
Autorité = code runtime + [prod-smoke-tests.yml](../../.github/workflows/prod-smoke-tests.yml) +
Playwright E2E + Lighthouse CI + skills `responsive-audit` / `web-vitals-audit` / `runtime-truth-audit`.
Non-couvert par un test existant → **candidat signalé**, pas de nouveau skill (V1-first).

## 5. Second avis = advisory only

[code-review](../skills/code-review/SKILL.md) + CodeRabbit *si disponible* + éventuel avis
multi-modèle — **jamais autoritaire** ; owner = décision finale. 5 questions standard :
architecture parallèle inventée ? hors scope touché ? rollback oublié ? invariant métier
cassé ? `DONE` sur-déclaré alors que `PARTIAL` ?

## 6. Mémoire & routing — pointers

- Mémoire = aide au rappel, **jamais** source de vérité — couches `MEMORY.md` / `CLAUDE.md` /
  vault / WIKI / DB / RAG : voir [agent-doc-search.md](agent-doc-search.md).
- Routing autoritaire = [agent-operating-map.yaml](../../.spec/00-canon/ai-registry/agent-operating-map.yaml)
  + [role-matrix.md](../../.spec/00-canon/role-matrix.md) + [departments-map](../../audit/automecanik-departments-map.md).

## 7. Refusés (de gstack)

`/ship` / `/land-and-deploy` auto (PROD owner-gated, tag `v*` = opérateur) · team-required mode ·
mémoire externe comme canon · browser agent mutant sans garde-fou · continuous checkpoint push
(le push est une action gouvernée).

---

_Non-canon. Pour toute règle qui fait foi, voir la source pointée (vault · `.spec/00-canon/` ·
guards · skills). Ce fichier ne crée aucune autorité._
