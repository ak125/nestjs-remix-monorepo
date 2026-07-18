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
| **PLAN** | CLAUDE.md « Discipline de périmètre » + worktree dédié ([deployment.md](../rules/deployment.md)) |
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
| `payments/` edits | **WARN** | file-guard G3 + [payments.md](../rules/payments.md) |
| `gh pr merge` → main | **GATED (CI)** | branch protection : checks stricts + `enforce_admins` (merge = PREPROD ; PROD tag-gated) |
| `git tag v*` / `push --tags` / deploy-prod | **BLOCK** | bash-guard G6 (#879) — tag = décision opérateur ([deployment.md](../rules/deployment.md)) |
| `UPDATE`/`DELETE` `pieces` / `pieces_price` / `__seo_*` via execute_sql | **BLOCK** | supabase-guard G6 (#879) — passer par module/RPC gouverné |

> #879 = durcissement owner-gated — **renforcer, jamais affaiblir** un guard.

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
[Playwright E2E](../../frontend/playwright.config.ts) + Lighthouse CI + skills `responsive-audit` /
`web-vitals-audit` / `runtime-truth-audit`.

Invariants commerce *(aide-mémoire — autorité = code runtime, pas cette liste)* : sélecteur
véhicule visible (R1) · lien R3 → R1 présent · bouton panier masqué si `can_sell=false` · prix
affiché seulement si `price_exists` · PREORDER vendable si `pri_dispo=3` · `noindex` sur 404/410
+ canonical propre · pas de contenu générique dupliqué visible.

Non-couvert par un test existant → **candidat signalé**, pas de nouveau skill (V1-first).

## 5. Second avis = advisory only

[code-review](../skills/code-review/SKILL.md) + CodeRabbit *si disponible* + éventuel avis
multi-modèle — **jamais autoritaire** ; owner = décision finale. 5 questions standard :
architecture parallèle inventée ? hors scope touché ? rollback oublié ? invariant métier
cassé ? `DONE` sur-déclaré alors que `PARTIAL` ?

## 6. Mémoire & routing — pointers

- Mémoire = aide au rappel, **jamais** source de vérité — couches `MEMORY.md` / `CLAUDE.md` /
  vault / WIKI / DB / RAG : voir [agent-doc-search.md](../rules/agent-doc-search.md).
- Routing autoritaire = [agent-operating-map.yaml](../../.spec/00-canon/ai-registry/agent-operating-map.yaml)
  + [role-matrix.md](../../.spec/00-canon/role-matrix.md) + [departments-map](../../audit/automecanik-departments-map.md).

## 7. Refusés (de gstack)

`/ship` / `/land-and-deploy` auto (PROD owner-gated, tag `v*` = opérateur) · team-required mode ·
mémoire externe comme canon · browser agent mutant sans garde-fou · continuous checkpoint push
(le push est une action gouvernée).

## 8. Boucle d'amélioration mesurée (keep/revert gouverné)

Pour une amélioration **pilotée par une métrique** (taille de bundle, temps de build/typecheck,
vitesse des tests). **PAS** un runner autonome, **PAS** un nouveau gate, **PAS** de `score-runner`
maison — réutilise l'existant. Décision = [continuous-improvement-global](../skills/continuous-improvement-global/SKILL.md) (§DECIDE).

| Étape | Mécanisme (déjà là) |
|---|---|
| Cible + métrique | 1 surface où la mesure est **rapide + déterministe + difficile à tricher** ; sinon → *advisory* |
| Juge = gate existant | [.size-limit.json](../../frontend/.size-limit.json) · `tsc` · ratchets [audit-compare-baseline.js](../../scripts/cleanup/audit-compare-baseline.js) / `*-ratchet.yml` |
| Isolation | worktree dédié ([deployment.md](../rules/deployment.md)) — jamais éditer `main` ni un chemin servi par DEV:3000 |
| Mesure | baseline → change → re-mesure (métrique bruitée → médiane de N + delta minimum) |
| Verdict | [improvement-report.schema.json](../../.spec/00-canon/improvement-report.schema.json) + [agent-exit-contract.md](../canon-mirrors/agent-exit-contract.md) |
| Promotion | **PR owner-gated** (branch protection §2) — **jamais d'auto-merge d'une boucle** |

**Garde-fou n°1 — anti-faux-vert : holdout LARGE + contrôle baseline.** Un test étroit vert ne
prouve RIEN. Rejouer l'ensemble pertinent **et** comparer à un run *baseline* (avant-change) sur le
**même** ensemble ; ne garder que si métrique↑ **ET** 0 régression vs baseline. *(2026-06-20 : un
holdout 8-fichiers vert aurait livré 73 tests cassés — détail dans `audit/karpathy-loop-pilot-*.verdict.json`.)*

**Règle d'autonomie (par qualité de métrique) :**

- **Auto** uniquement si métrique rapide + déterministe + intriquable : perf / build / typecheck / tests.
- **Advisory** (propose, ne publie jamais) : contenu R2/R8, SEO — métrique lente/triable → surapprentissage
  → contenu générique (interdit par CLAUDE.md « filler SEO générique » + invariant rank #1).
- **Owner GO** obligatoire : prix · panier/commande/paiement · auth/RLS · migration · publication/indexation
  SEO · promotion WIKI canon (cf. danger-zone §2).

> La boucle **garde** le gain réel et sûr, **rejette** le reste : améliorer le chiffre en cassant
> autre chose (SEO, tests, DI) = surapprentissage, refusé. Le « keep » exige score↑ **et** holdout vert.

## 9. Contrat de preuve runtime — routage VERIFY → vérificateur existant

Détaille la phase **VERIFY** (§1) : une modification à **surface runtime** n'est vérifiée que
lorsqu'on **exécute le flux touché et qu'on observe le comportement réel** — CI verte ≠ observé
(mémoire `feedback-runtime-verification-mandatory` : GATE 1 chemin prouvé *avant* PR, GATE 2
observation runtime *après* merge). Ce contrat **route** le diff vers un vérificateur **déjà
existant** ; il ne crée ni skill, ni script, ni schéma, ni gate.

**Routage — surface du diff → vérificateur (déjà là) → ce qu'on observe :**

| Surface | Piloter avec (existant) | Observer |
|---|---|---|
| frontend | skills `/run` ou `/verify` · [Playwright E2E](../../frontend/playwright.config.ts) · [responsive-audit](../skills/responsive-audit/SKILL.md) · [web-vitals-audit](../skills/web-vitals-audit/SKILL.md) *(INP/LCP/CLS uniquement)* | navigation, hydratation, console, réseau, responsive 375/768/1024/1440, CWV (INP/LCP/CLS) |
| backend | vraie requête HTTP (`curl http://localhost:3000/...`) · [prod-smoke-tests.yml](../../.github/workflows/prod-smoke-tests.yml) | status, corps, effet de bord observable |
| seo | `curl` de la page servie (`http://localhost:3000/<page>`) + extraction du champ HTML servi (`grep -oP`) — matrice « SEO HTML » de la mémoire `feedback-runtime-verification-mandatory` | status, canonical, robots, meta, H1, JSON-LD, duplication (HTML servi) |
| projection | [runtime-truth-audit](../skills/runtime-truth-audit/SKILL.md) — flags OFF/ON, allowlist, fallback, provenance | sortie servie selon l'état du flag |
| edge | `curl -I` **read-only** de l'URL servie · [config/caddy/Caddyfile](../../config/caddy/Caddyfile) · invariant `Cache-Control` single-owner (arbitre `entry.server`) | cache, confidentialité, `Cache-Control` des headers servis |
| pipeline | trace `RAW → WIKI → projection → consommateur` (jamais de writer RAG) — gates du contrat d'export WIKI (`quality-gates` / AEC-hash / slug-uniqueness) | lignage & provenance de la source |
| commerce | **sandbox + owner GO** — matrice « Panier » / « Paiement » de la mémoire `feedback-runtime-verification-mandatory` (sandbox paiement impératif) | flux réel en env sûr ; jamais de mutation PROD live |

**Verdict = axe d'observation runtime** (distinct de la décision §DECIDE et du GATE 1 chemin) :

| Verdict | Sens |
|---|---|
| `PASS` | comportement réellement observé, correct |
| `FAIL` | comportement observé incorrect |
| `BLOCKED` | environnement / prérequis indisponible — non observé |
| `SKIP` | aucune surface runtime à observer (doc / test-only) |

Ce verdict **alimente** le champ *Evidence after* de [continuous-improvement-global](../skills/continuous-improvement-global/SKILL.md) — il ne le remplace pas :
`PASS` = prérequis d'un `GO` / `GO_WITH_WATCH` · `FAIL` → `FIX_AND_RETEST` ou `ROLLBACK_REQUIRED` ·
`BLOCKED` → `OWNER_DECISION` ou prérequis manquant noté · `SKIP` seulement si rien à observer.

**Crosswalk avec la mémoire (une seule vérité runtime, pas un 2ᵉ vocabulaire)** : `PASS` ↔
`LIVE_CONFIRMED` · `FAIL` ↔ `LIVE_FAILED` **et** `LIVE_PARTIAL` (un effet seulement partiel = **pas**
`PASS` ; il reste `FAIL` → `FIX_AND_RETEST` — ne jamais surdéclarer un demi-fix, cf. incident PR #762) ·
`BLOCKED` ↔ `NOT_DEPLOYED` · `SKIP` = aucune surface runtime (pas d'équivalent GATE 2).

**Deux gates séparés** : un `PASS` obtenu en **pré-merge** ou **hors env-cible** (DEV:3000, Docker)
**ne clôt PAS** GATE 2. Une surface à cible PROD (SEO indexé, redirection, webhook, GA4, panier…) doit
une vérification LIVE **distincte** en env cible après tag `v*` — env & commande **par type** dans la
**matrice de la mémoire** `feedback-runtime-verification-mandatory` (pointer, ne pas la recopier ici).

**Preuve** : la conserver dans la PR / `audit/` / artefacts Playwright / logs smoke / trace `curl` —
**jamais** dans `.local/governance-vault/` (déprécié, `.gitignored`, refusé par pre-commit).

**Boucle bornée** : modifier → vérifier → corriger → re-vérifier, avec **nombre max de tentatives**
et **cause d'arrêt** (jamais de boucle infinie ; > 3 cycles sans convergence → `OWNER_DECISION`,
cf. anti-patterns continuous-improvement).

**Garde-fous (inchangés — restatés)** : paiement · prix runtime · stock · panier · commande · RLS ·
migration DB destructive · SEO indexé · PROD = mode **Full** (§ risk-modes continuous-improvement) +
environnement sûr (Docker isolé) ou vérification **read-only** + preuve complète + **décision owner
explicite**. Un agent *prépare et vérifie* ces changements ; il ne s'auto-autorise **jamais** une
mutation PROD, et le **même agent ne s'auto-approuve jamais** un changement critique (l'owner arbitre).

**Ce n'est PAS** : un nouveau skill `/verify` (les built-ins `/verify` + `/run` existent déjà) · un
script dupliqué · un nouveau schéma JSON / registry · Percy · une règle de plus dans `CLAUDE.md`.
Pointeur mince uniquement, zéro autorité.

---

_Non-canon. Pour toute règle qui fait foi, voir la source pointée (vault · `.spec/00-canon/` ·
guards · skills). Ce fichier ne crée aucune autorité._
