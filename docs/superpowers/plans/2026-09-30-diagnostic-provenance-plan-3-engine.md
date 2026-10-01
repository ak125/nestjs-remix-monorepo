# Provenance diagnostic — Plan 3 : script d'environnement PROD, moteur et frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** lire, dans le moteur de diagnostic, la provenance WIKI projetée par le Plan 2 (`__diag_link_provenance`), l'exposer dans le pack de preuves puis, sous drapeau, s'en servir pour classer les hypothèses ; afficher au client le rang et la provenance, sans aucun score.

**Architecture:** trois PR indépendantes. PR-C ajoute un script qui écrit les trois drapeaux de diagnostic dans le `.env` PROD depuis des variables GitHub, appelé par `deploy-prod.yml` avant le point de non-retour (Tâche 1). PR-D (Tâches 2 à 7) ajoute la lecture à compte exact des provenances vivantes, l'état par hypothèse (`sourced` / `partial` / `unsourced`) et le résumé du pack, le service `DiagnosticProvenanceService` (drapeaux `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` puis `…_PRIMARY_ENABLED`, OFF par défaut, PRIMARY sans effet sans EXPOSE) et un compteur Prometheus à labels bornés. PR-E (Tâche 8) retire le score des cartes d'hypothèses et affiche un badge de provenance. L'activation PROD (Tâche 9) se fait étape par étape, sur GO nominatif de l'owner, par variables GitHub et tags `v*`.

**Tech Stack:** NestJS 11, Zod 4, `@nestjs/event-emitter` 3, prom-client 15, jest + ts-jest ; React Router 8, Vitest 4 + Testing Library ; bash + `node:test` + ShellCheck 0.11 (`shellcheck-py`, installé hors dépôt) ; Python 3 (mutants).

**Spec:** `docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md` — §4.6 (moteur), §4.7 (frontend), §4.8 (registre, partie drapeaux), §6 (erreurs), §7 (tests), §8 étapes 2 (partie PROD) à 5, §9 étapes 6 (script PROD) à 8. Les écarts de ce plan par rapport à la première rédaction de la spec y sont reportés en §14 (« Révisions lors de la planification »).

**Plans frères :** Plan 1 — export WIKI + transport (`2026-09-30-diagnostic-provenance-plan-1-wiki-export.md`) : produit `exports/diagnostic/` dans le pin du sous-module et la copie dans l'image, et répare la garde d'activation du WIKI (Tâche 1), précondition de la Tâche 9. Plan 2 — tables, RPC et writer (`2026-09-30-diagnostic-provenance-plan-2-db-writer.md`) : PR-A (migration) et PR-B (writer, drapeau `DIAGNOSTIC_PROJECTION_ENABLED`) sont des préconditions de PR-D ; le contexte des diffs de la Tâche 2 (`data-service`) et de la Tâche 4 (`feature-flags`) est le code de PR-B.

**Résultat attendu au lancement** (drapeaux OFF) : le pack de preuves produit par le backend est identique à celui d'aujourd'hui, aucune provenance n'est lue, aucun événement n'est émis. Seul le frontend change, au tag qui embarque PR-E : les cartes montrent le rang, plus le score. En PROD, à l'état du canon WIKI `6e3a043`, aucune provenance n'est encore projetée (Plan 2 : 3 conflits `source_not_raw_proven`) : sous EXPOSE, toutes les hypothèses seraient `unsourced`, et PRIMARY reste OFF tant qu'aucun lien n'est `diagnostic_safe`.

**Hors tâche :** le retrait de `relative_score` du contrat du pack (le frontend ne l'affiche plus, le pack le garde) ; les pages SEO de diagnostic (`diagnostic-auto.$slug.tsx`) ; l'ajout de ShellCheck à la CI (la CI ne le lance aujourd'hui que sur le validateur d'`AGENTS.md`) ; l'exécution des tests `scripts/ci/prod-*-env.test.mjs` en CI de PR (comme ses voisins SEO, le nouveau test ne tourne que dans `deploy-prod.yml`).

## Global Constraints

- Drapeaux OFF par défaut : `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` et `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED` sont lus par `FeatureFlagsService` (`bool(…, false)` : tout ce qui n'est pas `true` vaut `false`), surchargeables à chaud par l'admin, relus à chaque analyse. Drapeaux OFF ⇒ aucune lecture de provenance, aucun événement, pack identique.
- PRIMARY n'agit qu'avec EXPOSE : PRIMARY seul est ignoré, avec un avertissement une fois par processus. Le script PROD refuse `PRIMARY=true` sans `EXPOSE=true`.
- Une provenance illisible (erreur, compte inexact, ligne d'un lien non demandé, ligne invalide, rôle `anon` du container PREPROD) donne `provenance_summary: {status: "unavailable"}`, aucun état par hypothèse et le classement de référence. Jamais `unsourced` : `unsourced` veut dire « lu, et aucune fiche ne documente ce lien ».
- Le moteur ne fait que lire `__diag_link_provenance` : il ne bascule jamais `diagnostic_safe`, `reviewed` ni `raw_proven`, ne crée ni ne modifie aucun lien, et ne lit jamais `raw` ni le RAG.
- Les champs ajoutés au pack (`provenance` par hypothèse, `provenance_summary`) sont optionnels : une session enregistrée avant ce plan se relit telle quelle.
- Labels Prometheus bornés : `mode`, `status`, `top_state`, `rank_changed`, valeurs `none` / `unknown` hors ensemble ; jamais un slug, un id de lien, de fiche ou de session.
- Frontend : aucun nombre de score affiché, sous aucune forme ; aucun `part_role` (absent du pack par construction) ; shadcn/ui, Tailwind et lucide-react uniquement, pas d'import de `React`, pas de style inline. Aucune URL, meta, H1 ni JSON-LD n'est touché ; `diagnostic-auto.$slug.tsx` est hors périmètre.
- `deploy-prod.yml` : insertions uniquement, relues par l'owner. Le script ne lit que des variables GitHub (`vars.*`), jamais un secret.
- Un `git apply` en échec n'a rien modifié : s'arrêter et le signaler. Jamais `--reject`, `--3way` ni retouche à la main d'un diff ; un test existant qui rougit hors de ce que le plan annonce : s'arrêter et le signaler, ne jamais l'affaiblir.
- Travail monorepo dans `/opt/automecanik/app/.claude/worktrees/<nom>` ; le checkout principal `/opt/automecanik/app` reste sur `main` et ne sert qu'à `git -C … fetch`/`worktree add|remove`/`tag` ; aucun `cd` dedans. Les `node_modules` du worktree sont des liens symboliques vers ceux du checkout principal ; ne jamais lancer `npm ci` ni `npm install` dans un worktree de ce plan. Frontend : jamais `npm run lint` (ESLint par fichiers, voir Tâche 8). Pas de Prettier sur `.mjs` ni `.yml`.
- Base Supabase partagée par DEV, PREPROD et PROD : **lecture seule** via `sweep-psql.sh` (Tâche 9).
- PROD : aucun SSH. Tout passe par les variables GitHub, les tags `v*`, l'endpoint de métriques et l'API admin des drapeaux. Un tag `v*`, un `gh variable set|delete` et une surcharge de drapeau en PROD exigent chacun un GO nominatif de l'owner.
- Toute action sortante (push, PR, commentaire, `gh variable`, tag, requête d'écriture sur une API) attend une confirmation explicite de l'utilisateur. L'agent ne fusionne rien.
- Commits : trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Corps de PR : dernière ligne `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Dépôt public : aucun identifiant, cookie, clé, mot de passe ni adresse d'hôte dans un fichier, un commit ou une PR (l'origine PROD est exportée par l'opérateur dans `PROD_ORIGIN`).
- Vocabulaire : une fusion sur `main` produit le tag `:preprod` et redéploie le container PREPROD, rien de plus. Jamais « déployé en PROD » avant un tag `v*` dont le run `deploy-prod.yml` est vert.
- Interdits : `git stash` nu, `--force` (hors `worktree remove` après inspection), `--no-verify`, édition à la main de `audit/registry/*.json`, `REPO_MAP.md` ou d'un bloc `<!-- AUTO-GENERATED -->` (seul le patch de l'artefact `registry-recovery-<run_id>` les modifie).

## Préparation (une fois par session, depuis n'importe quel répertoire)

- [ ] Installer ShellCheck et le script de mutants dans un répertoire de travail hors dépôt.

```bash
export SCRATCH="${SCRATCH:-$(mktemp -d)}"
git -C /opt/automecanik/app fetch -q origin
test "$("$SCRATCH/venv/bin/shellcheck" --version 2>/dev/null | sed -n 's/^version: //p')" = 0.11.0 || {
  python3 -m venv "$SCRATCH/venv"
  "$SCRATCH/venv/bin/pip" install -q shellcheck-py==0.11.0.1
}
cat > "$SCRATCH/mut_p3.py" <<'EOF'
#!/usr/bin/env python3
"""Mutants du plan 3 : chacun doit faire échouer le test qui le garde.

Lancer depuis la racine du worktree : python3 "$SCRATCH/mut_p3.py" <script|backend|frontend>
Chaque mutant remplace des ancres UNIQUES, lance les seuls tests concernés, puis
restaure le fichier. Un mutant n'est tué que par un test rouge (une erreur de
compilation seule ne compte pas).
"""
import re
import subprocess
import sys
from pathlib import Path

SH = "scripts/ci/prod-diagnostic-provenance-env.sh"
SH_T = "scripts/ci/prod-diagnostic-provenance-env.test.mjs"
D = "backend/src/modules/diagnostic-engine/"
O = "backend/src/modules/observability/"
DS = D + "diagnostic-engine.data-service.ts"
READER_T = D + "diagnostic-link-provenance-reader.test.ts"
SVC = D + "services/diagnostic-provenance.service.ts"
SVC_T = D + "services/diagnostic-provenance.service.test.ts"
PIPE_T = D + "diagnostic-provenance-pipeline.test.ts"
PACK = D + "types/evidence-pack.schema.ts"
PACK_T = D + "evidence-pack-provenance.schema.test.ts"
ORCH = D + "diagnostic-engine.orchestrator.ts"
LST = O + "diagnostic-provenance-metrics.listener.ts"
LST_T = O + "diagnostic-provenance-metrics.listener.test.ts"
FE = "frontend/app/components/diagnostic-wizard/"
FE_T = "tests/unit/diagnostic-hypothesis-provenance.test.tsx"

GROUPS = {
    "script": [
        ("primary-without-expose-accepted", SH,
         [('if [ "$PRIMARY" = true ] && [ "$EXPOSE" != true ]; then', "if false; then")]),
        ("any-value-accepted", SH,
         [("    '' | true | false) ;;", "    *) ;;")]),
        ("false-not-written", SH,
         [('set_kv DIAGNOSTIC_PROJECTION_ENABLED "$PROJECTION"',
           '[ "$PROJECTION" = false ] || set_kv DIAGNOSTIC_PROJECTION_ENABLED "$PROJECTION"')]),
    ],
    "backend": [
        ("reader-count-check-removed", DS,
         [("    if (count !== data.length) {", "    if (count !== data.length && false) {")],
         [READER_T]),
        ("reader-unrequested-link-accepted", DS,
         [("    if (parsed.data.some((row) => !requested.has(row.link_id))) {",
           "    if (parsed.data.some((row) => !requested.has(row.link_id) && false)) {")],
         [READER_T]),
        ("primary-without-expose", SVC,
         [("    if (!expose) return { hypotheses: reference, provenance: null };",
           "    if (!expose && !primaryRequested)\n"
           "      return { hypotheses: reference, provenance: null };")],
         [SVC_T]),
        ("unavailable-read-as-undocumented", SVC,
         [("      rows = await this.dataService.getLiveLinkProvenance(\n"
           "        links.flatMap((link) => link.contributions.map((c) => c.link_id)),\n"
           "      );",
           "      rows = await this.dataService\n"
           "        .getLiveLinkProvenance(\n"
           "          links.flatMap((link) => link.contributions.map((c) => c.link_id)),\n"
           "        )\n"
           "        .catch(() => []);")],
         [SVC_T]),
        ("primary-weighs-documented-not-safe", SVC,
         [("(refsOf(c.link_id).some((r) => r.diagnostic_safe) ? 100 : 0),",
           "(refsOf(c.link_id).length > 0 ? 100 : 0),")],
         [SVC_T]),
        ("pack-consistency-refine-neutralised", PACK,
         [("  const summary = pack.provenance_summary;\n",
           "  if (ctx) return;\n  const summary = pack.provenance_summary;\n")],
         [PACK_T]),
        ("hypothesis-provenance-dropped", ORCH,
         [("      ...provenanceOf(h.hypothesis_id),\n", "")],
         [PIPE_T]),
        ("pack-summary-dropped", ORCH,
         [("        ...(provenance ? { provenance_summary: provenance.summary } : {}),\n", "")],
         [PIPE_T]),
        ("downstream-reads-reference-ranking", ORCH,
         [("    const { hypotheses, provenance } = await this.provenance.rank(\n"
           "      scoredLinks,\n"
           "      (links) => this.scoringEngine.score(links, input.vehicle_context),\n"
           "    );\n",
           "    const { provenance } = await this.provenance.rank(\n"
           "      scoredLinks,\n"
           "      (links) => this.scoringEngine.score(links, input.vehicle_context),\n"
           "    );\n"
           "    const hypotheses = this.scoringEngine.score(\n"
           "      scoredLinks,\n"
           "      input.vehicle_context,\n"
           "    );\n")],
         [PIPE_T]),
        ("listener-event-renamed", LST,
         [("  @OnEvent('diagnostic_provenance_evaluated')",
           "  @OnEvent('diagnostic_provenance_evaluation')")],
         [LST_T]),
        ("listener-partial-state-unknown", LST,
         [("const STATES = ['sourced', 'partial', 'unsourced'];",
           "const STATES = ['sourced', 'unsourced'];")],
         [LST_T]),
    ],
    "frontend": [
        ("badge-shown-when-unavailable", FE + "results/ResultHypotheses.tsx",
         [('  const showProvenance = provenanceSummary?.status === "available";',
           "  const showProvenance = true;")]),
        ("summary-not-passed-to-cards", FE + "results/DiagnosticResults.tsx",
         [("          provenanceSummary={ep.provenance_summary}\n", "")]),
    ],
}

ANSI = re.compile(r"\x1b\[[0-9;]*m")


def run(group: str, tests: list) -> tuple:
    if group == "script":
        cmd, cwd, mark = ["node", "--test", SH_T], ".", "✖"
    elif group == "backend":
        cmd, cwd, mark = ["npm", "--prefix", "backend", "test", "--", *tests], ".", "✕"
    else:
        cmd, cwd, mark = ["npx", "vitest", "run", "--root", ".", FE_T], "frontend", "×"
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=900)
    lines = [ANSI.sub("", l).strip() for l in (r.stdout + r.stderr).splitlines()]
    failing = [l for l in lines if l.startswith(mark) and "failing tests" not in l]
    return r.returncode, failing


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in GROUPS:
        print("usage: mut_p3.py <script|backend|frontend>")
        return 2
    group = sys.argv[1]
    survivors = []
    for name, rel, edits, *tests in GROUPS[group]:
        path = Path(rel)
        original = path.read_text(encoding="utf-8")
        mutated = original
        for old, new in edits:
            if mutated.count(old) != 1:
                print(f"SETUP-ERROR {name}: ancre trouvée {mutated.count(old)} fois")
                return 2
            mutated = mutated.replace(old, new)
        try:
            path.write_text(mutated, encoding="utf-8")
            rc, failing = run(group, tests[0] if tests else [])
        finally:
            path.write_text(original, encoding="utf-8")
        verdict = "KILLED" if rc != 0 and failing else "SURVIVED"
        if verdict == "SURVIVED":
            survivors.append(name)
        print(f"{verdict:8} {name}  ({len(failing)} test(s) rouges) {failing[:1]}")
    print("survivors:", survivors)
    return 1 if survivors else 0


sys.exit(main())
EOF
export PATH="$SCRATCH/venv/bin:$PATH"
export SWEEP=/opt/automecanik/app/.claude/worktrees/skill-live-evidence/.claude/skills/live-evidence-sweep/scripts/sweep-psql.sh
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' && gh auth status >/dev/null 2>&1 \
  && test "$(shellcheck --version | sed -n 's/^version: //p')" = 0.11.0 && python3 -c 'import ast,sys; ast.parse(open(sys.argv[1]).read())' "$SCRATCH/mut_p3.py" \
  && echo "ENV_OK SCRATCH=$SCRATCH shellcheck=0.11.0"
```

Attendu : dernière ligne `ENV_OK SCRATCH=<chemin> shellcheck=0.11.0`. Chaque tâche suppose `SCRATCH`, `PATH` et `SWEEP` exportés : dans une nouvelle session, relancer ce bloc avec `SCRATCH=<chemin>`. `SWEEP` n'est utilisé qu'à la Tâche 9 ; s'il n'est pas exécutable à ce moment-là, s'arrêter et le signaler (ne jamais écrire un autre client SQL).

## Review Focus

1. **Lecture partielle ou plafonnée, ou ligne d'un lien non demandé** (plafond PostgREST de 1000 lignes, compte absent, réponse d'une autre requête) : une hypothèse documentée serait affichée `unsourced` et pèserait 0 sous PRIMARY. Attendu : le lecteur lève, le service rend `unavailable` et le classement de référence. Tests : lecteur `throws on fewer rows than the exact count`, `throws on an unknown count`, `throws on a row for a link that was not requested` (Tâche 2) ; mutants `reader-count-check-removed` et `reader-unrequested-link-accepted` tués (Tâche 7).
2. **Container PREPROD en `anon`, lecture refusée** (`READ_ONLY=true`, table `service_role` seul) : attendu, `unavailable`, aucun état, aucun badge — jamais `unsourced`. Tests : service `an unreadable provenance is unavailable — never unsourced — and the reference ranking is kept` (Tâche 4), pipeline `unreadable provenance: the reference pack, marked unavailable, no state` (Tâche 5), frontend `show no provenance badge with an unavailable provenance` (Tâche 8) ; mutants `unavailable-read-as-undocumented` (Tâche 7) et `badge-shown-when-unavailable` (Tâche 8) tués.
3. **PRIMARY sans EXPOSE** (surcharge admin ou variable PROD) : attendu, le script PROD refuse avant toute mutation ; à l'exécution, PRIMARY est ignoré avec un avertissement par processus. Tests : script `PRIMARY true with EXPOSE false/unset` (Tâche 1), service `PRIMARY without EXPOSE is ignored, with one warning per process` (Tâche 4) ; mutants `primary-without-expose-accepted` (Tâche 1) et `primary-without-expose` (Tâche 7) tués.
4. **Session enregistrée avant ce plan, ou pack incohérent** (état sans résumé, résumé dont les compteurs ne tombent pas juste) : attendu, l'ancienne session se relit et s'affiche sans badge ; un pack incohérent est refusé au parse. Tests : schéma `still parses a pack stored before the provenance existed`, `rejects a state without a summary`, `rejects counts that do not tally the states` (Tâche 3), frontend `show no provenance badge with no summary (flag OFF, stored session)` (Tâche 8) ; mutant `pack-consistency-refine-neutralised` tué (Tâche 7).
5. **Variable PROD mal orthographiée** (`True`, `yes`, `1`, espace, guillemets) : `bool()` la lirait `false` sans bruit. Attendu : le déploiement échoue avant le point de non-retour, `.env` octet-identique, container en place. Tests : script `refusals leave the .env byte-identical` (Tâche 1) ; mutant `any-value-accepted` tué (Tâche 1).

## Carte des fichiers

| Dépôt | Fichier | Tâche | Responsabilité |
|---|---|---|---|
| Monorepo | `scripts/ci/prod-diagnostic-provenance-env.sh` | 1 | Écrit les 3 drapeaux dans le `.env` PROD ; refuse toute autre valeur que `true`/`false` |
| Monorepo | `scripts/ci/prod-diagnostic-provenance-env.test.mjs` | 1 | Contrat du script et câblage de `deploy-prod.yml` (36 tests) |
| Monorepo | `.github/workflows/deploy-prod.yml` | 1 | Test avant toute mutation PROD, 3 variables, appel du script |
| Monorepo | `…/types/diagnostic-reference.schema.ts` | 2 | `DiagLinkProvenanceRowSchema`, `DiagLinkProvenanceRowsSchema` |
| Monorepo | `…/diagnostic-engine.data-service.ts` | 2 | `contributions[]` par cause fusionnée ; `getLiveLinkProvenance()` à compte exact |
| Monorepo | `…/diagnostic-link-provenance-reader.test.ts` | 2 | Lecteur (11 tests) |
| Monorepo | `…/diagnostic-integrity.test.ts` | 2, 5 | Contributions conservées (T2) ; construction avec le 8ᵉ paramètre (T5) |
| Monorepo | `…/types/evidence-pack.schema.ts` | 3 | `provenance` par hypothèse, `provenance_summary`, cohérence |
| Monorepo | `…/evidence-pack-provenance.schema.test.ts` | 3 | Schéma (17 tests) |
| Monorepo | `backend/src/config/feature-flags.service.ts` | 4 | 2 getters + `ALLOWED_KEYS` |
| Monorepo | `…/services/diagnostic-provenance.service.ts` (+ `.test.ts`) | 4 | États, EXPOSE / PRIMARY, événement (9 tests) |
| Monorepo | `…/diagnostic-engine.orchestrator.ts` | 5 | 8ᵉ paramètre, `rank(links, score)`, champs du pack |
| Monorepo | `…/diagnostic-engine.module.ts` | 5 | Provider `DiagnosticProvenanceService` |
| Monorepo | `…/diagnostic-provenance-pipeline.test.ts` | 5 | Pack de bout en bout (4 tests) |
| Monorepo | `…/diagnostic-engine.orchestrator.test.ts`, `…/diagnostic-source-integrity.test.ts`, `…/maintenance-flow.test.ts` | 5 | Construction avec le 8ᵉ paramètre |
| Monorepo | `backend/src/modules/observability/observability.tokens.ts` | 6 | `DIAGNOSTIC_PROVENANCE_COUNTER` |
| Monorepo | `backend/src/modules/observability/diagnostic-provenance.metrics.ts` | 6 | Compteur `diagnostic_provenance_evaluated_total` |
| Monorepo | `backend/src/modules/observability/diagnostic-provenance-metrics.listener.ts` (+ `.test.ts`) | 6 | Événement → compteur, labels bornés (5 tests) |
| Monorepo | `backend/src/modules/observability/observability.module.ts` | 6 | Provider, listener, export |
| Monorepo | `frontend/app/components/diagnostic-wizard/types.ts` | 8 | Types de provenance ; retrait de `ScoringBreakdown` |
| Monorepo | `frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx` | 8 | Rang sans score, badge à 3 libellés |
| Monorepo | `frontend/app/components/diagnostic-wizard/results/DiagnosticResults.tsx` | 8 | Transmet `provenance_summary` aux cartes |
| Monorepo | `frontend/tests/unit/diagnostic-hypothesis-provenance.test.tsx` | 8 | Cartes et page de résultats (5 tests) |

`…/` = `backend/src/modules/diagnostic-engine/`. Le script de mutants (`mut_p3.py`) reste dans `$SCRATCH`, jamais dans un dépôt.

## Ordre et dépendances

```text
Tâche 1 (PR-C : script PROD, 3 drapeaux écrits false) → fusion humaine — indépendante ; dans un tag v* avant toute activation (Tâche 9)
Tâches 2 → 3 → 4 → 5 → 6 → 7 (PR-D : moteur + métriques) — après fusion de #1607, #1624, #1626, #1608, #1618 et des PR-A, PR-B du Plan 2
Tâche 8 (PR-E : frontend) — après fusion de #1592 et acceptation d'ADR-035 ; indépendante de PR-D
Tâche 9 (activation PROD, GO owner à chaque étape) : (a) préconditions → (b) projection ON → (c) EXPOSE ON → (d) PR-E dans un tag → (e) PRIMARY, seulement si un lien est diagnostic_safe
```

PR-C et PR-D se fusionnent sans effet runtime : à son premier tag, le script écrit les trois clés à `false` (variables non définies), et le moteur ne lit rien drapeaux OFF. PR-E change l'affichage dès le tag qui l'embarque (rang sans score) ; le badge n'apparaît qu'avec EXPOSE ON et une provenance lue. Les diffs des Tâches 2 à 6 ont pour contexte `main` après fusion des cinq PR backend et de PR-B : si l'une d'elles change avant sa fusion, un `git apply` échoue et la tâche s'arrête.

---

### Tâche 1 : drapeaux de diagnostic dans le `.env` PROD (PR-C)

`deploy-prod.yml` écrit déjà les drapeaux SEO dans le `.env` PROD par des scripts testés avant toute mutation (`prod-seo-projection-env.sh`). Le nouveau script suit le même contrat pour les trois drapeaux de diagnostic : variable non définie → `false` écrit explicitement (supprimer la variable puis redéployer = rollback) ; `true`/`false` écrits tels quels ; toute autre valeur, ou PRIMARY sans EXPOSE → échec avant le point de non-retour, `.env` octet-identique. Le test est écrit d'abord.

**Files:**
- Create: `scripts/ci/prod-diagnostic-provenance-env.sh` (mode 644, comme `prod-seo-projection-env.sh` : appelé par `bash`)
- Create: `scripts/ci/prod-diagnostic-provenance-env.test.mjs`
- Modify: `.github/workflows/deploy-prod.yml` (3 insertions)

**Interfaces:**
- Consumes : variables GitHub de dépôt `PROD_DIAGNOSTIC_PROJECTION_ENABLED`, `PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED`, `PROD_DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED` (non définies au 2026-10-01).
- Produces : lignes `DIAGNOSTIC_PROJECTION_ENABLED=…`, `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED=…`, `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED=…` dans le `.env` PROD ; ligne de log `✅ Diagnostic provenance flags written to .env:` suivie des trois `   KEY=valeur` (lue à la Tâche 9).

- [ ] **Étape 1 : créer le worktree et mesurer la référence**

```bash
git -C /opt/automecanik/app fetch origin
git -C /opt/automecanik/app worktree add -b feat/diag-provenance-prod-env /opt/automecanik/app/.claude/worktrees/diag-provenance-prod-env origin/main
cd /opt/automecanik/app/.claude/worktrees/diag-provenance-prod-env
ln -s /opt/automecanik/app/node_modules node_modules
git status --porcelain
node --test scripts/ci/*.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail) ' | tee "$SCRATCH/p3-ci-ref.txt"
```

Attendu : `git status` vide (le lien est ignoré par le motif `node_modules` de `.gitignore`) ; référence sans échec, `ℹ tests 224` / `ℹ pass 224` / `ℹ fail 0` sur `main` au 2026-10-01. Noter le total : il sert de référence aux Étapes 6 et 7.

- [ ] **Étape 2 : écrire le test qui échoue**

Créer `scripts/ci/prod-diagnostic-provenance-env.test.mjs` avec exactement ce contenu :

```javascript
/**
 * Behavioural proof of the PROD diagnostic provenance flags writer (2026-09-30).
 *
 * `prod-diagnostic-provenance-env.sh` writes the three diagnostic provenance
 * rollout flags into ~/production/.env during the PROD deploy. The code never
 * fails on a bad value (`bool()` reads anything but `true` as false), so a wrong
 * value must stop the deploy BEFORE the running container is touched. These
 * tests EXECUTE the script against scratch .env files and assert:
 *
 *   1. unset config writes the three keys explicitly OFF (rollback path);
 *   2. true/false are written as is, existing lines are replaced (never
 *      duplicated), absent keys appended, every other line kept byte-for-byte;
 *   3. a boolean spelling the code would read as false FAILS and leaves the
 *      .env byte-identical;
 *   4. PRIMARY true with EXPOSE not true FAILS (the primary mode would weigh
 *      the ranking by an information nobody sees);
 *   5. re-running is idempotent and the file mode is kept;
 *   6. deploy-prod.yml maps each input from a variable, verifies this test and
 *      runs the script BEFORE the point of no return.
 *
 * Run: node --test scripts/ci/prod-diagnostic-provenance-env.test.mjs
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  chmodSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPT_DIR, "prod-diagnostic-provenance-env.sh");
const DEPLOY_WORKFLOW = join(SCRIPT_DIR, "..", "..", ".github", "workflows", "deploy-prod.yml");

const PROJECTION = "DIAGNOSTIC_PROJECTION_ENABLED";
const EXPOSE = "DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED";
const PRIMARY = "DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED";
const KEYS = [PROJECTION, EXPOSE, PRIMARY];

// A PROD-like .env: unrelated lines that must survive byte-for-byte (including
// the neighbouring KG flags), plus stale provenance lines (hand-edit style,
// unquoted) that must be replaced, not duplicated. PROJECTION is absent on
// purpose: it must be appended.
const UNRELATED = [
  "SUPABASE_URL=https://example.supabase.co",
  "SESSION_SECRET=keepme",
  "# a comment line",
  "DIAGNOSTIC_KG_SHADOW_ENABLED=true",
  "DIAGNOSTIC_KG_PRIMARY_ENABLED='false'",
];
const BASE_ENV = [
  UNRELATED[0],
  `${EXPOSE}=true`,
  UNRELATED[1],
  UNRELATED[2],
  `${PRIMARY}=false`,
  UNRELATED[3],
  UNRELATED[4],
  "",
].join("\n");

function scratch(content = BASE_ENV, mode = 0o600) {
  const dir = mkdtempSync(join(tmpdir(), "diagnostic-provenance-env-"));
  const file = join(dir, ".env");
  writeFileSync(file, content);
  chmodSync(file, mode);
  return { dir, file };
}

function run(file, overrides = {}) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, ...overrides };
  const r = spawnSync("bash", [SCRIPT, file], { env, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** Parse the file the way the deploy step does: `set -a; . .env`. */
function bashRead(file, keys) {
  const script = `set -a; . "$1"; set +a; for k in ${keys.join(" ")}; do printf '%s\\0' "\${!k-}"; done`;
  const r = spawnSync("bash", ["-c", script, "_", file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const values = r.stdout.split("\0").slice(0, keys.length);
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

function linesStartingWith(file, key) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.startsWith(`${key}=`));
}

/** Every line that is not one of the three keys, in order. */
function otherLines(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l && !KEYS.some((k) => l.startsWith(`${k}=`)));
}

function assertUntouched({ dir, file }, before) {
  assert.equal(readFileSync(file, "utf8"), before, ".env must be byte-identical");
  assert.deepEqual(readdirSync(dir), [".env"], "no temp file may be left behind");
}

const override = (key) => `${key}_OVERRIDE`;

describe("unset config", () => {
  test("writes the three keys explicitly OFF and keeps every other line", () => {
    const s = scratch();
    const r = run(s.file);
    assert.equal(r.code, 0, r.out);
    for (const k of KEYS) {
      assert.deepEqual(linesStartingWith(s.file, k), [`${k}='false'`]);
    }
    assert.deepEqual(otherLines(s.file), UNRELATED, "other lines must be kept, in order");
    assert.deepEqual(bashRead(s.file, KEYS), {
      [PROJECTION]: "false",
      [EXPOSE]: "false",
      [PRIMARY]: "false",
    });
  });

  test("empty strings (GitHub renders an unset variable as '') behave as unset", () => {
    const s = scratch();
    const r = run(s.file, {
      [override(PROJECTION)]: "",
      [override(EXPOSE)]: "",
      [override(PRIMARY)]: "",
    });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(bashRead(s.file, KEYS), {
      [PROJECTION]: "false",
      [EXPOSE]: "false",
      [PRIMARY]: "false",
    });
  });
});

describe("values written", () => {
  test("true/false are written as is; existing lines replaced, absent key appended", () => {
    const s = scratch();
    const r = run(s.file, {
      [override(PROJECTION)]: "true",
      [override(EXPOSE)]: "true",
      [override(PRIMARY)]: "false",
    });
    assert.equal(r.code, 0, r.out);
    for (const k of KEYS) {
      assert.equal(linesStartingWith(s.file, k).length, 1, `${k} must appear exactly once`);
    }
    assert.deepEqual(bashRead(s.file, [...KEYS, "SESSION_SECRET"]), {
      [PROJECTION]: "true",
      [EXPOSE]: "true",
      [PRIMARY]: "false",
      SESSION_SECRET: "keepme",
    });
    assert.deepEqual(otherLines(s.file), UNRELATED);
    assert.match(r.out, new RegExp(`${EXPOSE}=true`));
  });

  test("PRIMARY true is written when EXPOSE is true", () => {
    const s = scratch();
    const r = run(s.file, { [override(EXPOSE)]: "true", [override(PRIMARY)]: "true" });
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(bashRead(s.file, KEYS), {
      [PROJECTION]: "false",
      [EXPOSE]: "true",
      [PRIMARY]: "true",
    });
  });

  test("appends to a .env that has none of the keys and no final newline", () => {
    const body = UNRELATED.join("\n"); // no trailing newline
    const s = scratch(body);
    const r = run(s.file, { [override(PROJECTION)]: "true" });
    assert.equal(r.code, 0, r.out);
    assert.ok(readFileSync(s.file, "utf8").startsWith(`${body}\n`), "existing content kept");
    assert.deepEqual(otherLines(s.file), UNRELATED);
    assert.equal(bashRead(s.file, KEYS)[PROJECTION], "true");
  });

  test("re-running is idempotent and keeps the file mode", () => {
    const overrides = { [override(EXPOSE)]: "true", [override(PRIMARY)]: "true" };
    const s = scratch(BASE_ENV, 0o600);
    assert.equal(run(s.file, overrides).code, 0);
    const first = readFileSync(s.file, "utf8");
    assert.equal(run(s.file, overrides).code, 0);
    assert.equal(readFileSync(s.file, "utf8"), first);
    assert.equal(statSync(s.file).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(s.dir), [".env"]);
  });
});

describe("refusals leave the .env byte-identical", () => {
  // Every spelling below is read as false by the code — silently.
  const spellings = ["True", "TRUE", "yes", "1", " true", "true\n", "'true'", "off"];
  for (const key of KEYS) {
    for (const value of spellings) {
      test(`${key} ${JSON.stringify(value)}`, () => {
        const s = scratch();
        const r = run(s.file, { [override(key)]: value });
        assert.equal(r.code, 1, r.out);
        assert.match(r.out, new RegExp(`::error::Diagnostic provenance: ${key} is`));
        assert.doesNotMatch(r.out, /✅/);
        assertUntouched(s, BASE_ENV);
      });
    }
  }

  for (const [name, expose] of [
    ["EXPOSE false", "false"],
    ["EXPOSE unset", undefined],
  ]) {
    test(`PRIMARY true with ${name}`, () => {
      const s = scratch();
      const overrides = { [override(PRIMARY)]: "true" };
      if (expose !== undefined) overrides[override(EXPOSE)] = expose;
      const r = run(s.file, overrides);
      assert.equal(r.code, 1, r.out);
      assert.match(r.out, new RegExp(`::error::Diagnostic provenance: ${PRIMARY}=true requires ${EXPOSE}=true`));
      assertUntouched(s, BASE_ENV);
    });
  }

  test("missing .env fails", () => {
    const r = run(join(tmpdir(), "does-not-exist", ".env"), { [override(EXPOSE)]: "true" });
    assert.equal(r.code, 1);
    assert.match(r.out, /::error::Diagnostic provenance: .* not found/);
  });
});

describe("deploy-prod.yml wiring", () => {
  const wf = readFileSync(DEPLOY_WORKFLOW, "utf8");

  test("the script runs on .env before the point of no return", () => {
    const call = wf.indexOf('scripts/ci/prod-diagnostic-provenance-env.sh" .env');
    const noReturn = wf.indexOf('echo "DEPLOY_STARTED=1" >> "$GITHUB_ENV"');
    assert.ok(call > 0, "deploy step must call prod-diagnostic-provenance-env.sh on .env");
    assert.ok(noReturn > 0, "point-of-no-return marker not found");
    assert.ok(call < noReturn, "provenance flags must be written BEFORE DEPLOY_STARTED=1");
  });

  test("this test is verified before any PROD mutation", () => {
    const verify = wf.indexOf("scripts/ci/prod-diagnostic-provenance-env.test.mjs");
    const firstMutation = wf.indexOf("docker/login-action");
    assert.ok(verify > 0, "deploy-prod.yml must run prod-diagnostic-provenance-env.test.mjs");
    assert.ok(verify < firstMutation, "the test must run before the first PROD-facing step");
  });

  test("every contract input is mapped from a GitHub variable, never a secret", () => {
    for (const name of KEYS) {
      const mapping = `${name}_OVERRIDE: \${{ vars.PROD_${name} }}`;
      assert.ok(wf.includes(mapping), `${mapping} missing`);
      assert.ok(
        !wf.includes(`${name}_OVERRIDE: \${{ secrets.`),
        `${name} must be a variable (not a credential, readable with gh variable list)`,
      );
    }
  });
});
```

- [ ] **Étape 3 : vérifier l'échec**

Run : `node --test scripts/ci/prod-diagnostic-provenance-env.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail) '`
Attendu : `ℹ tests 36`, `ℹ pass 0`, `ℹ fail 36` (le script n'existe pas, `deploy-prod.yml` ne l'appelle pas).

- [ ] **Étape 4 : écrire le script**

Créer `scripts/ci/prod-diagnostic-provenance-env.sh` avec exactement ce contenu (mode 644, ne pas le rendre exécutable) :

```bash
#!/usr/bin/env bash
#
# PROD diagnostic provenance flags — write the three diagnostic provenance
# rollout flags from GitHub into ~/production/.env as ONE decision, BEFORE any
# PROD mutation.
#
# WHY THIS EXISTS (2026-09-30)
# ----------------------------
# The WIKI → diagnostic provenance chain is rolled out on PROD by three flags the
# backend reads from its environment (feature-flags.service.ts): the projection
# writer (diagnostic-projection-scheduler.service.ts / .processor.ts), the
# exposure of the provenance in the evidence pack, and the primary mode that
# lets `diagnostic_safe` weigh the ranking (diagnostic-provenance.service.ts).
# Outside this pipeline the PROD host is reachable only through an owner root
# session: a hand edit there is unvalidated and untracked. The deploy job is the
# existing writer of ~/production/.env (prod-seo-projection-env.sh is the sibling
# this script follows); this script is that writer for these flags.
#
# WHY THIS IS A SCRIPT (not inline YAML)
# --------------------------------------
# The code never fails on a bad value: `bool()` reads anything but the literal
# `true` as false. A wrong value would be a silent OFF. This script refuses it at
# deploy time, and it can be executed against a test .env — see
# `prod-diagnostic-provenance-env.test.mjs`.
#
# CONTRACT
# --------
#   DIAGNOSTIC_PROJECTION_ENABLED_OVERRIDE          variable PROD_DIAGNOSTIC_PROJECTION_ENABLED
#   DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED_OVERRIDE   variable PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED
#   DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED_OVERRIDE  variable PROD_DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED
#   Variables, not secrets: none is a credential, and `gh variable list` shows
#   what PROD will run with.
#
#   unset/empty          → KEY=false, written explicitly: deleting the variable
#                          and redeploying IS the rollback, nothing lingers on
#   true|false           → written as is
#   any other spelling (True, yes, 1, " true")
#                        → exit 1: the code would read it as false, silently
#   PRIMARY true while EXPOSE is not true
#                        → exit 1: the primary mode would weigh the ranking by
#                          an information the evidence pack does not show (the
#                          runtime also ignores it, with a warning — this makes
#                          the refusal visible at deploy time instead)
#   any refusal          → exit 1 and the .env is left byte-identical (the step
#                          aborts before the point of no return; the running
#                          container is kept)
#
# FORMAT: values are written single-quoted, as in prod-seo-projection-env.sh:
# literal for bash `.` and for compose `env_file` alike. Values ARE printed —
# they are not secrets, and the log is the record of what PROD was given.
#
# Usage: prod-diagnostic-provenance-env.sh <path/to/.env>
set -euo pipefail

export LC_ALL=C

ENV_FILE="${1:?usage: prod-diagnostic-provenance-env.sh <path/to/.env>}"
if [ ! -f "$ENV_FILE" ]; then
  echo "::error::Diagnostic provenance: $ENV_FILE not found"
  exit 1
fi

PROJECTION="${DIAGNOSTIC_PROJECTION_ENABLED_OVERRIDE:-}"
EXPOSE="${DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED_OVERRIDE:-}"
PRIMARY="${DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED_OVERRIDE:-}"

# Messages quote the offending value with its line breaks visible: a stray
# space or newline is the usual cause of a refusal.
show() {
  local v="${1//$'\r'/\\r}"
  printf "'%s'" "${v//$'\n'/\\n}"
}

ERRORS=0
reject() { # $1 = message
  echo "::error::Diagnostic provenance: $1 — .env left untouched"
  ERRORS=$((ERRORS + 1))
}

# Only the literal `true` is true for the code (feature-flags.service.ts bool()):
# any other spelling would be a silent OFF, so it is refused instead of written.
check_bool() { # $1 = key name, $2 = value
  case "$2" in
    '' | true | false) ;;
    *) reject "$1 is $(show "$2") — only true or false (unset = false); the code would read it as false" ;;
  esac
}
check_bool DIAGNOSTIC_PROJECTION_ENABLED "$PROJECTION"
check_bool DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED "$EXPOSE"
check_bool DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED "$PRIMARY"
PROJECTION="${PROJECTION:-false}"
EXPOSE="${EXPOSE:-false}"
PRIMARY="${PRIMARY:-false}"

if [ "$PRIMARY" = true ] && [ "$EXPOSE" != true ]; then
  reject "DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED=true requires DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED=true (is $EXPOSE)"
fi

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi

# Edit a same-directory copy (same filesystem → atomic mv, `cp -p` keeps mode and
# owner), and replace the real file only once every write has read back intact.
TMP="$(mktemp "${ENV_FILE}.diagnostic-provenance.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
cp -p "$ENV_FILE" "$TMP"
# A last line without its newline would be glued to the first appended key.
if [ -s "$TMP" ] && [ -n "$(tail -c 1 "$TMP")" ]; then
  echo >> "$TMP"
fi

declare -A EXPECTED=()
set_kv() { # $1 = key, $2 = value (already checked: true or false)
  sed -i "/^$1=/d" "$TMP"
  printf "%s='%s'\n" "$1" "$2" >> "$TMP"
  EXPECTED["$1"]="$2"
}

set_kv DIAGNOSTIC_PROJECTION_ENABLED "$PROJECTION"
set_kv DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED "$EXPOSE"
set_kv DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED "$PRIMARY"

# Read-back through the same parser the deploy step uses (`set -a; . .env`).
if ! (
  set +u
  set -a
  # shellcheck disable=SC1090
  . "$TMP"
  set +a
  for k in "${!EXPECTED[@]}"; do
    if [ "${!k-}" != "${EXPECTED[$k]}" ]; then
      echo "::error::Diagnostic provenance: $k does not read back identically from .env — .env left untouched"
      exit 1
    fi
  done
); then
  echo "::error::Diagnostic provenance: .env does not read back cleanly after the write — .env left untouched"
  exit 1
fi

mv "$TMP" "$ENV_FILE"
trap - EXIT

echo "✅ Diagnostic provenance flags written to .env:"
echo "   DIAGNOSTIC_PROJECTION_ENABLED=$PROJECTION"
echo "   DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED=$EXPOSE"
echo "   DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED=$PRIMARY"
```

Run : même commande qu'à l'Étape 3.
Attendu : `ℹ tests 36`, `ℹ pass 33`, `ℹ fail 3` ; les 3 échecs sont ceux du bloc `deploy-prod.yml wiring` (`node --test … 2>&1 | grep '^✖'` hors ligne `failing tests`).

- [ ] **Étape 5 : câbler `deploy-prod.yml`**

Trois insertions, aucune ligne retirée : le test parmi les vérifications qui précèdent toute mutation PROD, les trois variables dans l'environnement du step de déploiement, l'appel du script juste après celui de `prod-seo-projection-env.sh`, avant `docker network create`. Écrire ce diff dans `$SCRATCH/deploy-prod.diff`, puis `git apply "$SCRATCH/deploy-prod.diff"` :

```diff
diff --git a/.github/workflows/deploy-prod.yml b/.github/workflows/deploy-prod.yml
index 44197c06f..6360560af 100644
--- a/.github/workflows/deploy-prod.yml
+++ b/.github/workflows/deploy-prod.yml
@@ -52,6 +52,9 @@ jobs:
       - name: Verify SEO env writers (collector, projection flags) before any PROD mutation
         run: node --test scripts/ci/prod-seo-collector-env.test.mjs scripts/ci/prod-seo-projection-env.test.mjs
 
+      - name: Verify diagnostic provenance flags writer before any PROD mutation
+        run: node --test scripts/ci/prod-diagnostic-provenance-env.test.mjs
+
       - name: Verify PREPROD evidence gate before any PROD mutation
         run: node --test scripts/ci/prod-preprod-evidence.test.mjs
 
@@ -246,6 +249,15 @@ jobs:
           SEO_PROJECTION_R1_FEED_ENABLED_OVERRIDE: ${{ vars.PROD_SEO_PROJECTION_R1_FEED_ENABLED }}
           SEO_PROJECTION_READ_V1_OVERRIDE: ${{ vars.PROD_SEO_PROJECTION_READ_V1 }}
           SEO_PROJECTION_READ_CANARY_OVERRIDE: ${{ vars.PROD_SEO_PROJECTION_READ_CANARY }}
+          # Diagnostic provenance rollout flags (WIKI → __diag_link_provenance →
+          # evidence pack). Written by scripts/ci/prod-diagnostic-provenance-env.sh
+          # (contract in its header): unset → OFF, written explicitly (deleting the
+          # variable and redeploying IS the rollback); a spelling the code would
+          # read as false, or PRIMARY true without EXPOSE true → deploy aborts
+          # before any PROD mutation. Variables, not secrets.
+          DIAGNOSTIC_PROJECTION_ENABLED_OVERRIDE: ${{ vars.PROD_DIAGNOSTIC_PROJECTION_ENABLED }}
+          DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED_OVERRIDE: ${{ vars.PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED }}
+          DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED_OVERRIDE: ${{ vars.PROD_DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED }}
         run: |
           docker pull massdoc/nestjs-remix-monorepo:production
 
@@ -350,6 +362,10 @@ jobs:
           # every input is validated before any write, and a refusal fails the
           # deploy before the point of no return, running container untouched.
           bash "$GITHUB_WORKSPACE/scripts/ci/prod-seo-projection-env.sh" .env
+          # Diagnostic provenance rollout flags (see the env block above). Same
+          # contract: validated before any write, refusal before the point of no
+          # return, running container untouched.
+          bash "$GITHUB_WORKSPACE/scripts/ci/prod-diagnostic-provenance-env.sh" .env
 
           docker network create automecanik-prod 2>/dev/null || true
 
```

- [ ] **Étape 6 : vérifier que tout passe**

```bash
node --test scripts/ci/prod-diagnostic-provenance-env.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail) '
node --test scripts/ci/*.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail) '
git diff --numstat .github/workflows/deploy-prod.yml
```

Attendu : `ℹ tests 36` / `ℹ pass 36` / `ℹ fail 0` ; tous les tests `scripts/ci` : référence + 36, `ℹ fail 0` (260 / 260 / 0 au 2026-10-01) ; `15	0	.github/workflows/deploy-prod.yml`.

- [ ] **Étape 7 : ShellCheck, et verdict de la directive d'exemption**

Le script relit le `.env` candidat par `. "$TMP"` pour vérifier qu'il se charge ; ce chemin est un `mktemp`, donc non constant par construction. La directive `# shellcheck disable=SC1090` qui le précède est la seule exemption du script ; la règle est d'abord lancée sans elle (`.claude/rules/guardrails.md`, passes 5 et 6) :

```bash
shellcheck scripts/ci/prod-diagnostic-provenance-env.sh; echo "exit=$?"
sed '/# shellcheck disable=SC1090/d' scripts/ci/prod-diagnostic-provenance-env.sh > "$SCRATCH/no-directive.sh"
shellcheck "$SCRATCH/no-directive.sh"; echo "exit=$?"
git show origin/main:scripts/ci/prod-seo-projection-env.sh | grep -n -A1 'shellcheck disable=SC1090'
```

Attendu : `exit=0` avec la directive ; sans elle, un seul avertissement, `SC1090 (warning): ShellCheck can't follow non-constant source. Use a directive to specify location.` sur la ligne `. "$TMP"`, puis `exit=1` ; le script voisin de `main` porte la même directive au-dessus de la même instruction. Verdict : l'avertissement décrit le chemin temporaire voulu, pas un défaut ; la directive est vivante (la retirer fait lever la règle) et reste. Citer ce verdict dans la PR.

- [ ] **Étape 8 : mutants du script — chaque garde doit avoir un test qui la tue**

```bash
git status --porcelain > "$SCRATCH/p3-status-before.txt"
python3 "$SCRATCH/mut_p3.py" script
git status --porcelain | diff "$SCRATCH/p3-status-before.txt" - && echo STATUS_UNCHANGED
```

Attendu : 3 lignes `KILLED` (`primary-without-expose-accepted`, `any-value-accepted`, `false-not-written`), `survivors: []`, puis `STATUS_UNCHANGED`.

- [ ] **Étape 9 : commit**

```bash
git add scripts/ci/prod-diagnostic-provenance-env.sh scripts/ci/prod-diagnostic-provenance-env.test.mjs .github/workflows/deploy-prod.yml
git commit -F - <<'EOF'
feat(ci): écrire les drapeaux de provenance diagnostic dans le .env PROD

scripts/ci/prod-diagnostic-provenance-env.sh écrit DIAGNOSTIC_PROJECTION_ENABLED,
DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED et DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED
depuis les variables GitHub PROD_* : variable non définie → false écrit
explicitement ; toute autre valeur que true/false, ou PRIMARY sans EXPOSE →
échec avant le point de non-retour, .env octet-identique. deploy-prod.yml
lance son test (36 cas) avant toute mutation PROD.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git show --stat --format='%h %s' HEAD
git ls-files -s scripts/ci/prod-diagnostic-provenance-env.sh
```

Attendu : 3 fichiers ; mode `100644`.

- [ ] **Étape 10 : gate de propriété des nouveaux fichiers**

Run : `node scripts/registry/check-new-files.js --base origin/main; echo "exit=$?"`
Attendu : `new files: 2 (2 ok, 0 failures)`, `✓ All new files pass owner+domain gate`, `exit=0`.

- [ ] **Étape 11 : PR-C (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin feat/diag-provenance-prod-env
gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/diag-provenance-prod-env \
  --title "feat(ci): écrire les drapeaux de provenance diagnostic dans le .env PROD" \
  --body-file - <<'EOF'
## Quoi
`scripts/ci/prod-diagnostic-provenance-env.sh`, appelé par `deploy-prod.yml` juste après
`prod-seo-projection-env.sh` et sur le même contrat : les trois drapeaux de diagnostic
(`DIAGNOSTIC_PROJECTION_ENABLED`, `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED`,
`DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED`) sont écrits depuis des variables GitHub, jamais des
secrets. Variable non définie → `false` écrit explicitement ; toute autre valeur que
`true`/`false`, ou PRIMARY sans EXPOSE → échec avant le point de non-retour, `.env` intact.

`deploy-prod.yml` : 3 insertions, aucune ligne retirée — relecture de l'owner demandée.

## Preuve
- `scripts/ci/prod-diagnostic-provenance-env.test.mjs` : 36 tests verts (refus octet-identiques,
  idempotence, mode du fichier conservé, câblage du workflow avant toute mutation PROD) ;
  tous les tests `scripts/ci` : 0 échec ;
- 3 mutants du script tués ;
- ShellCheck 0.11 : 0 avertissement. Seule exemption : `SC1090` sur `. "$TMP"` (relecture du
  `.env` candidat, chemin `mktemp`) ; sans la directive, ShellCheck lève exactement cet
  avertissement, que le script voisin `prod-seo-projection-env.sh` exempte de la même façon.

## Après fusion
Aucun effet avant le prochain tag `v*`. À ce tag, les trois clés sont écrites `false`
(variables non définies) : comportement identique à aujourd'hui. L'activation se fait plus
tard, variable par variable, sur décision de l'owner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr checks feat/diag-provenance-prod-env --repo ak125/nestjs-remix-monorepo --watch
```

Si le job « Registry freshness » échoue (projections régénérées depuis les nouveaux fichiers), appliquer tel quel le patch de son artefact, sans l'éditer (précédents #1622, #1639, #1641) :

```bash
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --branch feat/diag-provenance-prod-env --workflow registry-fresh.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run download "$RUN" --repo ak125/nestjs-remix-monorepo -n "registry-recovery-$RUN" -D "$SCRATCH/recovery-$RUN"
git apply --numstat "$SCRATCH/recovery-$RUN/generated-projections.patch"
git apply --index "$SCRATCH/recovery-$RUN/generated-projections.patch"
git status --porcelain
```

`--index` indexe exactement les fichiers du patch ; commiter ceux-là seulement (`chore(registry): régénérer les projections après le script de drapeaux diagnostic`, même trailer), puis pousser après confirmation. Attendu final : tous les checks requis verts.

- [ ] **Étape 12 : preuve après fusion humaine**

```bash
SHA=$(gh pr view feat/diag-provenance-prod-env --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --commit "$SHA" --event push --json databaseId -q '.[0].databaseId')
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
```

Attendu : un run existe pour ce SHA et il est vert (un run absent n'est pas un succès). Le script ne s'exécute qu'au déploiement PROD : sa première exécution réelle est lue à la Tâche 9.

---

### Tâche 2 : lecture des provenances vivantes, à compte exact

Le moteur fusionne aujourd'hui les liens d'une même cause sur plusieurs symptômes et ne garde que le premier. La provenance est portée par lien : la cause fusionnée garde donc la liste de ses contributions (un lien par symptôme). La lecture des provenances vivantes est faite pour les seuls liens demandés, triée, et comparée à un compte exact : une réponse tronquée ou étrangère lève.

**Files:**
- Modify: `backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts` (`DiagLinkProvenanceRowSchema`, `DiagLinkProvenanceRowsSchema`)
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts` (`DiagCauseContribution`, `DiagMergedCauseLink`, `DiagLinkProvenance`, `getScoredCausesForSymptoms()`, `getLiveLinkProvenance()`)
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts` (assertion des contributions)
- Create: `backend/src/modules/diagnostic-engine/diagnostic-link-provenance-reader.test.ts`

**Interfaces:**
- Consumes : table `public.__diag_link_provenance` (Plan 2, PR-A) : `link_id`, `wiki_path`, `gamme_slug`, `relation_to_part`, `diagnostic_safe`, `retired_at` ; type existant `DiagSymptomCauseLink`.
- Produces : `export interface DiagCauseContribution { link_id: number; symptom_slug: string; relative_score: number }` ; `export interface DiagMergedCauseLink extends DiagSymptomCauseLink { contributions: DiagCauseContribution[] }` ; `export type DiagLinkProvenance = z.infer<typeof DiagLinkProvenanceRowSchema>` (`{link_id, wiki_path, gamme_slug, relation_to_part, diagnostic_safe}`) ; `getScoredCausesForSymptoms(symptomSlugs: string[]): Promise<DiagMergedCauseLink[]>` ; `getLiveLinkProvenance(linkIds: number[]): Promise<DiagLinkProvenance[]>` (ids dédupliqués et triés, `[]` sans requête pour une liste vide ; lève sur erreur, absence de tableau, `count !== data.length`, ligne invalide, deux lignes vivantes pour un même couple lien / fiche, ou ligne d'un lien non demandé).

- [ ] **Étape 1 : préconditions**

```bash
git -C /opt/automecanik/app fetch -q origin
for pr in 1607 1624 1626 1608 1618 feat/diag-provenance-db feat/diag-provenance-writer; do
  printf '%s %s\n' "$pr" "$(gh pr view "$pr" --repo ak125/nestjs-remix-monorepo --json state -q .state)"
done
```

Attendu : 7 lignes `MERGED`. Sinon s'arrêter : les diffs des Tâches 2 à 6 ont ces PR pour contexte.

- [ ] **Étape 2 : créer le worktree de PR-D et mesurer la référence**

```bash
git -C /opt/automecanik/app worktree add -b feat/diag-provenance-engine /opt/automecanik/app/.claude/worktrees/diag-provenance-engine origin/main
cd /opt/automecanik/app/.claude/worktrees/diag-provenance-engine
ln -s /opt/automecanik/app/node_modules node_modules
ln -s /opt/automecanik/app/backend/node_modules backend/node_modules
git status --porcelain
npm --prefix backend test -- src/modules/diagnostic-engine src/modules/observability src/config 2>&1 | grep -E '^(Test Suites|Tests):' | tee "$SCRATCH/p3-backend-ref.txt"
```

Attendu : `git status` vide ; référence sans échec (`Test Suites: N passed, N total`, `Tests: M passed, M total` ; 33 / 644 sur la base combinée vérifiée le 2026-10-01). N et M servent aux Tâches 5 et 6. Toutes les Tâches 2 à 7 travaillent dans ce worktree.

- [ ] **Étape 3 : écrire les tests qui échouent**

Créer `backend/src/modules/diagnostic-engine/diagnostic-link-provenance-reader.test.ts` avec exactement ce contenu :

```typescript
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

type Reply = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

const row = (linkId: number, wikiPath: string, diagnosticSafe = false) => ({
  link_id: linkId,
  wiki_path: wikiPath,
  gamme_slug: 'plaquette-de-frein',
  relation_to_part: 'direct_cause',
  diagnostic_safe: diagnosticSafe,
});

function makeService(reply: Reply) {
  const calls: Array<{ table: string; chain: unknown[][] }> = [];
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  Object.assign(service, {
    logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
    supabase: {
      from: (table: string) => {
        const trace = { table, chain: [] as unknown[][] };
        calls.push(trace);
        const step =
          (name: string) =>
          (...args: unknown[]) => {
            trace.chain.push([name, ...args]);
            return query;
          };
        const query = {
          select: step('select'),
          in: step('in'),
          is: step('is'),
          order: step('order'),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({
              data: reply.data,
              error: reply.error,
              count:
                reply.count !== undefined
                  ? reply.count
                  : Array.isArray(reply.data)
                    ? reply.data.length
                    : null,
            }).then(resolve),
        };
        return query;
      },
    },
  });
  return { service, calls };
}

describe('DiagnosticEngineDataService.getLiveLinkProvenance', () => {
  it('reads live rows only, for the unique requested links, with an exact count', async () => {
    const rows = [
      row(1, 'gammes/a.md', true),
      row(1, 'gammes/b.md'),
      row(3, 'gammes/a.md'),
    ];
    const { service, calls } = makeService({ data: rows, error: null });

    await expect(service.getLiveLinkProvenance([3, 1, 3])).resolves.toEqual(
      rows,
    );
    expect(calls).toEqual([
      {
        table: '__diag_link_provenance',
        chain: [
          [
            'select',
            'link_id, wiki_path, gamme_slug, relation_to_part, diagnostic_safe',
            { count: 'exact' },
          ],
          ['in', 'link_id', [1, 3]],
          ['is', 'retired_at', null],
          ['order', 'link_id', { ascending: true }],
          ['order', 'wiki_path', { ascending: true }],
        ],
      },
    ]);
  });

  it('does not query for an empty request', async () => {
    const { service, calls } = makeService({ data: [], error: null });
    await expect(service.getLiveLinkProvenance([])).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it('returns no row for links nobody documented (absence is not an error)', async () => {
    const { service } = makeService({ data: [], error: null });
    await expect(service.getLiveLinkProvenance([7])).resolves.toEqual([]);
  });

  const failures: Array<[string, Reply]> = [
    ['a query error', { data: null, error: { message: 'permission denied' } }],
    ['no data array', { data: null, error: null }],
    // A capped reply must never read as "these links are undocumented".
    [
      'fewer rows than the exact count',
      { data: [row(1, 'gammes/a.md')], error: null, count: 2 },
    ],
    [
      'an unknown count',
      { data: [row(1, 'gammes/a.md')], error: null, count: null },
    ],
    [
      'a malformed row',
      {
        data: [{ ...row(1, 'gammes/a.md'), diagnostic_safe: 'true' }],
        error: null,
      },
    ],
    ['an empty wiki path', { data: [row(1, ' ')], error: null }],
    [
      'two live rows for one (link, fiche) pair',
      { data: [row(1, 'gammes/a.md'), row(1, 'gammes/a.md')], error: null },
    ],
    [
      'a row for a link that was not requested',
      { data: [row(2, 'gammes/a.md')], error: null },
    ],
  ];
  it.each(failures)('throws on %s', async (_name, reply) => {
    const { service } = makeService(reply);
    await expect(service.getLiveLinkProvenance([1])).rejects.toThrow(
      /__diag_link_provenance/,
    );
  });
});
```

Écrire ce diff dans `$SCRATCH/integrity-contributions.diff`, puis `git apply "$SCRATCH/integrity-contributions.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts b/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
index 581818b99..f26e54788 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
@@ -342,6 +342,12 @@ describe('diagnostic safety and deterministic scoring regressions', () => {
     expect(b).toEqual(a);
     expect(a[0].requires_verification).toBe(true);
     expect(values.primary.relative_score).toBe(90);
+    // Every symptom's link is kept, not only the first: provenance is read per link.
+    expect(a[0].contributions).toEqual([
+      { link_id: 1, symptom_slug: 'primary', relative_score: 90 },
+      { link_id: 2, symptom_slug: 'second', relative_score: 50 },
+      { link_id: 3, symptom_slug: 'third', relative_score: 10 },
+    ]);
   });
   test('brake fluid maps to the verified fluid family, not clutch kit', () => {
     expect(CAUSE_GAMME_MAP.brake_fluid_low).toEqual([
```

- [ ] **Étape 4 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/diagnostic-link-provenance-reader.test.ts src/modules/diagnostic-engine/diagnostic-integrity.test.ts`
Attendu : les deux suites échouent à la compilation, `TS2339: Property 'getLiveLinkProvenance' does not exist on type 'DiagnosticEngineDataService'.` et `TS2339: Property 'contributions' does not exist on type …`.

- [ ] **Étape 5 : implémenter**

Écrire ce diff dans `$SCRATCH/ref-schema.diff`, puis `git apply "$SCRATCH/ref-schema.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts b/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts
index 878f45eb0..efbaa7490 100644
--- a/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts
+++ b/backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts
@@ -88,3 +88,19 @@ export const DiagProjectionLinksSchema = z
 export const DiagSafetyRulesSchema = z
   .array(DiagSafetyRuleRowSchema)
   .refine((rows) => unique(rows, 'id') && unique(rows, 'rule_slug'));
+// Provenance WIKI vivante lue par le moteur : une ligne par couple (lien, fiche),
+// l'index unique partiel de la migration, revérifié à la lecture.
+export const DiagLinkProvenanceRowSchema = z.object({
+  link_id: identity,
+  wiki_path: text,
+  gamme_slug: text,
+  relation_to_part: text,
+  diagnostic_safe: z.boolean(),
+});
+export const DiagLinkProvenanceRowsSchema = z
+  .array(DiagLinkProvenanceRowSchema)
+  .refine(
+    (rows) =>
+      new Set(rows.map((row) => `${row.link_id}:${row.wiki_path}`)).size ===
+      rows.length,
+  );
```

Écrire ce diff dans `$SCRATCH/data-service.diff`, puis `git apply "$SCRATCH/data-service.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts b/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
index 147202af6..85e8735c5 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts
@@ -20,6 +20,8 @@ import {
   DiagCausesSchema,
   DiagProjectionLinksSchema,
   DiagSafetyRulesSchema,
+  DiagLinkProvenanceRowsSchema,
+  type DiagLinkProvenanceRowSchema,
 } from './types/diagnostic-reference.schema';
 
 // ── DB Row types (aligned on migration schema) ──────────
@@ -69,6 +71,21 @@ export interface DiagSymptomCauseLink {
   cause?: DiagCause;
 }
 
+/** Contribution d'un symptôme à une cause fusionnée : un lien par symptôme. */
+export interface DiagCauseContribution {
+  link_id: number;
+  symptom_slug: string;
+  relative_score: number;
+}
+
+/** Cause fusionnée multi-symptômes : score moyen et toutes ses contributions. */
+export interface DiagMergedCauseLink extends DiagSymptomCauseLink {
+  contributions: DiagCauseContribution[];
+}
+
+/** Ligne vivante (`retired_at IS NULL`) de `__diag_link_provenance`. */
+export type DiagLinkProvenance = z.infer<typeof DiagLinkProvenanceRowSchema>;
+
 export interface DiagSafetyRule {
   id: number;
   system_id: number;
@@ -269,24 +286,34 @@ export class DiagnosticEngineDataService extends SupabaseBaseService {
    */
   async getScoredCausesForSymptoms(
     symptomSlugs: string[],
-  ): Promise<DiagSymptomCauseLink[]> {
+  ): Promise<DiagMergedCauseLink[]> {
     if (!symptomSlugs.length) return [];
 
     // Equal-weight arithmetic mean of unique symptom contributions. Sort input
     // and evidence for deterministic results; round once after aggregation.
+    // Every contribution is kept: provenance is read per link, not per cause.
     const merged = new Map<
       number,
-      { link: DiagSymptomCauseLink; sum: number; count: number }
+      {
+        link: DiagSymptomCauseLink;
+        sum: number;
+        contributions: DiagCauseContribution[];
+      }
     >();
     for (const slug of [...new Set(symptomSlugs)].sort()) {
       const links = await this.getScoredCausesForSymptom(slug);
       if (!links.length)
         throw new Error('Diagnostic cause coverage incomplete');
       for (const link of links) {
+        const contribution = {
+          link_id: link.id,
+          symptom_slug: slug,
+          relative_score: link.relative_score,
+        };
         const existing = merged.get(link.cause_id);
         if (existing) {
           existing.sum += link.relative_score;
-          existing.count += 1;
+          existing.contributions.push(contribution);
           existing.link.evidence_for = [
             ...new Set([...existing.link.evidence_for, ...link.evidence_for]),
           ].sort();
@@ -305,15 +332,16 @@ export class DiagnosticEngineDataService extends SupabaseBaseService {
               evidence_against: [...new Set(link.evidence_against)].sort(),
             },
             sum: link.relative_score,
-            count: 1,
+            contributions: [contribution],
           });
         }
       }
     }
     return [...merged.values()]
-      .map(({ link, sum, count }) => ({
+      .map(({ link, sum, contributions }) => ({
         ...link,
-        relative_score: Math.round(sum / count),
+        relative_score: Math.round(sum / contributions.length),
+        contributions,
       }))
       .sort(
         (a, b) =>
@@ -477,6 +505,49 @@ export class DiagnosticEngineDataService extends SupabaseBaseService {
     };
   }
 
+  /**
+   * Provenance WIKI vivante des liens demandés. Une lecture partielle ferait
+   * passer des liens documentés pour non documentés : `count` exact contrôlé,
+   * et toute anomalie lève (le moteur rend alors la provenance `unavailable`,
+   * jamais `unsourced`). Une réponse au-delà du plafond PostgREST de 1000 lignes
+   * lève aussi : un diagnostic porte sur quelques dizaines de liens.
+   */
+  async getLiveLinkProvenance(
+    linkIds: number[],
+  ): Promise<DiagLinkProvenance[]> {
+    const ids = [...new Set(linkIds)].sort((a, b) => a - b);
+    if (!ids.length) return [];
+    const { data, error, count } = await this.supabase
+      .from('__diag_link_provenance')
+      .select(
+        'link_id, wiki_path, gamme_slug, relation_to_part, diagnostic_safe',
+        { count: 'exact' },
+      )
+      .in('link_id', ids)
+      .is('retired_at', null)
+      .order('link_id', { ascending: true })
+      .order('wiki_path', { ascending: true });
+    if (error || !Array.isArray(data)) {
+      throw new Error(
+        `__diag_link_provenance unavailable: ${error?.message ?? 'no rows'}`,
+      );
+    }
+    if (count !== data.length) {
+      throw new Error(
+        `__diag_link_provenance incomplete: ${data.length} row(s) read, ${count} live`,
+      );
+    }
+    const parsed = DiagLinkProvenanceRowsSchema.safeParse(data);
+    if (!parsed.success) {
+      throw new Error('__diag_link_provenance rows invalid');
+    }
+    const requested = new Set(ids);
+    if (parsed.data.some((row) => !requested.has(row.link_id))) {
+      throw new Error('__diag_link_provenance returned an unrequested link');
+    }
+    return parsed.data;
+  }
+
   /**
    * Toutes les lignes actives d'une table, par pages de 1000 (plafond PostgREST).
    * Le `count` exact de chaque page doit rester celui de la première et égaler
```

- [ ] **Étape 6 : vérifier que tout passe**

Run : même commande qu'à l'Étape 4.
Attendu : 2 suites vertes, dont les 11 tests du lecteur (68 tests au total sur la base combinée du 2026-10-01).

- [ ] **Étape 7 : commit**

```bash
git add backend/src/modules/diagnostic-engine/types/diagnostic-reference.schema.ts \
  backend/src/modules/diagnostic-engine/diagnostic-engine.data-service.ts \
  backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts \
  backend/src/modules/diagnostic-engine/diagnostic-link-provenance-reader.test.ts
git commit -F - <<'EOF'
feat(diagnostic): lire les provenances WIKI vivantes des liens, à compte exact

Une cause fusionnée sur plusieurs symptômes garde chacun de ses liens
(contributions[]). getLiveLinkProvenance() lit __diag_link_provenance pour les
seuls liens demandés (retired_at IS NULL), triée, et compare au compte exact :
réponse tronquée, ligne invalide ou lien non demandé → exception, jamais une
absence de provenance.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 3 : provenance dans le contrat du pack de preuves

Chaque hypothèse peut porter `provenance: {state, links[]}` et le pack un `provenance_summary` : `{status: "available", counts}` ou `{status: "unavailable"}`. Les deux champs sont optionnels (sessions enregistrées avant ce plan). Un `superRefine` refuse un pack incohérent : état sans résumé, état sous un résumé `unavailable`, compteurs qui ne tombent pas juste, hypothèse sans état sous un résumé `available`.

**Files:**
- Modify: `backend/src/modules/diagnostic-engine/types/evidence-pack.schema.ts`
- Create: `backend/src/modules/diagnostic-engine/evidence-pack-provenance.schema.test.ts`

**Interfaces:**
- Consumes : schéma existant du pack (`EvidencePackSchema`, hypothèses).
- Produces : `ProvenanceStateEnum = z.enum(['sourced', 'partial', 'unsourced'])` ; `WikiRefSchema {wiki_path, gamme_slug, relation_to_part, diagnostic_safe}` ; `ProvenanceLinkSchema {link_id, symptom_slug, documented, wiki_refs[]}` (`documented === wiki_refs.length > 0`) ; `provenanceStateOf(links)` (tous documentés → `sourced`, aucun → `unsourced`, sinon `partial`) ; `HypothesisProvenanceSchema {state, links (min 1)}` avec `state = provenanceStateOf(links)` ; `ProvenanceSummarySchema` (union discriminée stricte `available {counts {sourced, partial, unsourced}}` / `unavailable`) ; types `HypothesisProvenance`, `ProvenanceSummary`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `backend/src/modules/diagnostic-engine/evidence-pack-provenance.schema.test.ts` avec exactement ce contenu :

```typescript
import { EvidencePackSchema } from './types/evidence-pack.schema';

// A pack as persisted before the provenance existed: every stored session
// (__diag_session.result) must keep parsing once the fields are added.
function historicalPack() {
  return {
    evidence_pack: {
      factual_inputs_confirmed: ['Bruit au freinage'],
      factual_inputs_missing: [],
      system_suspects: ['freinage'],
      candidate_hypotheses: [
        {
          hypothesis_id: 'plaquettes-usees',
          label: 'Plaquettes usées',
          cause_type: 'wear_related',
          relative_score: 62,
          urgency: 'haute',
          evidence_for: ['Bruit au freinage'],
          evidence_against: [],
          requires_verification: true,
        },
      ],
      maintenance_links: [],
      risk_flags: [],
      catalog_guard: {
        ready_for_catalog: false,
        confidence_before_purchase: 'low',
        allowed_output_mode: 'none',
        reason: 'Vérification requise',
      },
      allowed_claims: [],
      ui_block_inputs: {},
    },
  };
}

const provenance = {
  state: 'partial',
  links: [
    {
      link_id: 11,
      symptom_slug: 'bruit-freinage',
      documented: true,
      wiki_refs: [
        {
          wiki_path: 'gammes/plaquette-de-frein.md',
          gamme_slug: 'plaquette-de-frein',
          relation_to_part: 'direct_cause',
          diagnostic_safe: false,
        },
      ],
    },
    {
      link_id: 12,
      symptom_slug: 'vibration-pedale',
      documented: false,
      wiki_refs: [],
    },
  ],
};

// `undefined` leaves the key out, as the orchestrator does when the provenance
// is not exposed or could not be read.
function withProvenance(summary: unknown, hypothesisProvenance: unknown) {
  const pack = historicalPack();
  const hypothesis = pack.evidence_pack.candidate_hypotheses[0];
  return {
    evidence_pack: {
      ...pack.evidence_pack,
      candidate_hypotheses: [
        hypothesisProvenance === undefined
          ? hypothesis
          : { ...hypothesis, provenance: hypothesisProvenance },
      ],
      ...(summary === undefined ? {} : { provenance_summary: summary }),
    },
  };
}

describe('EvidencePackSchema — WIKI provenance', () => {
  it('still parses a pack stored before the provenance existed', () => {
    const parsed = EvidencePackSchema.parse(historicalPack());
    expect(parsed.evidence_pack.provenance_summary).toBeUndefined();
    expect(
      parsed.evidence_pack.candidate_hypotheses[0].provenance,
    ).toBeUndefined();
  });

  it('keeps the provenance and an available summary through the parse', () => {
    const summary = {
      status: 'available',
      counts: { sourced: 0, partial: 1, unsourced: 0 },
    };
    const parsed = EvidencePackSchema.parse(
      withProvenance(summary, provenance),
    );
    // The schema strips unknown keys: a field missing from it would vanish from
    // the API response and from the stored session without any error.
    expect(parsed.evidence_pack.provenance_summary).toEqual(summary);
    expect(parsed.evidence_pack.candidate_hypotheses[0].provenance).toEqual(
      provenance,
    );
  });

  it('keeps an unavailable summary, which carries no counts', () => {
    const parsed = EvidencePackSchema.parse(
      withProvenance({ status: 'unavailable' }, undefined),
    );
    expect(parsed.evidence_pack.provenance_summary).toEqual({
      status: 'unavailable',
    });
  });

  const ref = provenance.links[0].wiki_refs[0];
  const available = (sourced: number, partial: number, unsourced: number) => ({
    status: 'available',
    counts: { sourced, partial, unsourced },
  });
  // Each case must fail for its own reason, not for a neighbouring one.
  const invalid: Array<[string, unknown, unknown, RegExp]> = [
    // One hypothesis
    [
      'an unknown state',
      available(0, 1, 0),
      { ...provenance, state: 'unknown' },
      /"invalid_value"[^}]*"state"/,
    ],
    [
      'a state that does not follow from the links',
      available(1, 0, 0),
      { ...provenance, state: 'sourced' },
      /state must follow from the documented links/,
    ],
    [
      'a provenance without any link',
      available(1, 0, 0),
      { state: 'sourced', links: [] },
      /too_small/,
    ],
    [
      'a documented link without a WIKI reference',
      available(1, 0, 0),
      {
        state: 'sourced',
        links: [
          {
            link_id: 11,
            symptom_slug: 'bruit-freinage',
            documented: true,
            wiki_refs: [],
          },
        ],
      },
      /documented must say/,
    ],
    [
      'an undocumented link carrying a WIKI reference',
      available(0, 0, 1),
      {
        state: 'unsourced',
        links: [
          {
            link_id: 11,
            symptom_slug: 'bruit-freinage',
            documented: false,
            wiki_refs: [ref],
          },
        ],
      },
      /documented must say/,
    ],
    [
      'a WIKI reference without its path',
      available(1, 0, 0),
      {
        state: 'sourced',
        links: [
          {
            link_id: 11,
            symptom_slug: 'bruit-freinage',
            documented: true,
            wiki_refs: [{ ...ref, wiki_path: '' }],
          },
        ],
      },
      /wiki_path/,
    ],
    // The summary
    [
      'an unknown summary status',
      { status: 'degraded' },
      undefined,
      /No matching discriminator/,
    ],
    [
      'counts on an unavailable summary',
      {
        status: 'unavailable',
        counts: { sourced: 1, partial: 0, unsourced: 0 },
      },
      undefined,
      /unrecognized_keys/,
    ],
    [
      'an available summary without counts',
      { status: 'available' },
      undefined,
      /counts/,
    ],
    ['a negative count', available(-1, 1, 0), provenance, /too_small/],
    // Summary and states together
    [
      'a state without a summary',
      undefined,
      provenance,
      /requires an available provenance_summary/,
    ],
    [
      'a state under an unavailable summary',
      { status: 'unavailable' },
      provenance,
      /requires an available provenance_summary/,
    ],
    [
      'an available summary with a hypothesis left without state',
      available(0, 0, 0),
      undefined,
      /requires a state on every hypothesis/,
    ],
    [
      'counts that do not tally the states',
      available(1, 0, 0),
      provenance,
      /counts must tally/,
    ],
  ];
  it.each(invalid)(
    'rejects %s',
    (_name, summary, hypothesisProvenance, reason) => {
      const result = EvidencePackSchema.safeParse(
        withProvenance(summary, hypothesisProvenance),
      );
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toMatch(reason);
    },
  );
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/evidence-pack-provenance.schema.test.ts`
Attendu : échec à la compilation, `TS2339` sur `'provenance_summary'` et sur `'provenance'`.

- [ ] **Étape 3 : implémenter**

Écrire ce diff dans `$SCRATCH/pack-schema.diff`, puis `git apply "$SCRATCH/pack-schema.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/types/evidence-pack.schema.ts b/backend/src/modules/diagnostic-engine/types/evidence-pack.schema.ts
index 5b81a824f..93c7368b9 100644
--- a/backend/src/modules/diagnostic-engine/types/evidence-pack.schema.ts
+++ b/backend/src/modules/diagnostic-engine/types/evidence-pack.schema.ts
@@ -46,6 +46,75 @@ export const CauseTypeEnum = z.enum([
 ]);
 export type CauseType = z.infer<typeof CauseTypeEnum>;
 
+// ── WIKI provenance ─────────────────────────────────────
+// What the WIKI documents behind each symptom → cause link of an hypothesis
+// (__diag_link_provenance, projected from validated WIKI fiches). Information
+// only: it never carries a score, and `part_role` stays out of the pack.
+
+export const ProvenanceStateEnum = z.enum(['sourced', 'partial', 'unsourced']);
+export type ProvenanceState = z.infer<typeof ProvenanceStateEnum>;
+
+export const WikiRefSchema = z.object({
+  wiki_path: z.string().min(1),
+  gamme_slug: z.string().min(1),
+  relation_to_part: z.string().min(1),
+  diagnostic_safe: z.boolean(),
+});
+
+export const ProvenanceLinkSchema = z
+  .object({
+    link_id: z.number().int().positive(),
+    symptom_slug: z.string().min(1),
+    documented: z.boolean(),
+    wiki_refs: z.array(WikiRefSchema),
+  })
+  .refine((link) => link.documented === link.wiki_refs.length > 0, {
+    message: 'documented must say whether the link has a WIKI reference',
+  });
+
+/** sourced = every link documented, partial = some, unsourced = none. */
+export function provenanceStateOf(
+  links: ReadonlyArray<{ documented: boolean }>,
+): ProvenanceState {
+  const documented = links.filter((link) => link.documented).length;
+  if (documented === links.length) return 'sourced';
+  return documented > 0 ? 'partial' : 'unsourced';
+}
+
+export const HypothesisProvenanceSchema = z
+  .object({
+    state: ProvenanceStateEnum,
+    links: z.array(ProvenanceLinkSchema).min(1),
+  })
+  .refine(
+    (provenance) => provenance.state === provenanceStateOf(provenance.links),
+    {
+      message: 'state must follow from the documented links',
+    },
+  );
+export type HypothesisProvenance = z.infer<typeof HypothesisProvenanceSchema>;
+
+const ProvenanceCount = z.number().int().min(0);
+
+// `unavailable` = the provenance could not be read: it says nothing about the
+// links, so it carries no count and no hypothesis carries a state.
+export const ProvenanceSummarySchema = z.discriminatedUnion('status', [
+  z
+    .object({
+      status: z.literal('available'),
+      counts: z
+        .object({
+          sourced: ProvenanceCount,
+          partial: ProvenanceCount,
+          unsourced: ProvenanceCount,
+        })
+        .strict(),
+    })
+    .strict(),
+  z.object({ status: z.literal('unavailable') }).strict(),
+]);
+export type ProvenanceSummary = z.infer<typeof ProvenanceSummarySchema>;
+
 export const CandidateHypothesisSchema = z.object({
   hypothesis_id: z.string().min(1),
   label: z.string().min(1),
@@ -61,6 +130,9 @@ export const CandidateHypothesisSchema = z.object({
   requires_verification: z.boolean(),
   // Mapping vers les gammes du catalogue
   related_gamme_slugs: z.array(z.string()).optional(),
+  // Absent from packs stored before the WIKI provenance, and when it is not
+  // exposed or could not be read (see provenance_summary).
+  provenance: HypothesisProvenanceSchema.optional(),
 });
 export type CandidateHypothesis = z.infer<typeof CandidateHypothesisSchema>;
 
@@ -94,34 +166,82 @@ export type CatalogGuard = z.infer<typeof CatalogGuardSchema>;
 
 // ── Evidence Pack ───────────────────────────────────────
 
+/**
+ * The summary and the per-hypothesis states tell one story: a state is shown
+ * only when the provenance was read (`available`), then every hypothesis has
+ * one and the counts are their tally.
+ */
+function checkProvenanceConsistency(
+  pack: {
+    candidate_hypotheses: Array<{ provenance?: HypothesisProvenance }>;
+    provenance_summary?: ProvenanceSummary;
+  },
+  ctx: z.RefinementCtx,
+): void {
+  const summary = pack.provenance_summary;
+  const states = pack.candidate_hypotheses.map((h) => h.provenance?.state);
+  if (summary?.status !== 'available') {
+    if (states.some((state) => state !== undefined)) {
+      ctx.addIssue({
+        code: 'custom',
+        path: ['candidate_hypotheses'],
+        message: 'a provenance state requires an available provenance_summary',
+      });
+    }
+    return;
+  }
+  if (states.some((state) => state === undefined)) {
+    ctx.addIssue({
+      code: 'custom',
+      path: ['candidate_hypotheses'],
+      message:
+        'an available provenance_summary requires a state on every hypothesis',
+    });
+    return;
+  }
+  for (const state of ProvenanceStateEnum.options) {
+    if (summary.counts[state] !== states.filter((s) => s === state).length) {
+      ctx.addIssue({
+        code: 'custom',
+        path: ['provenance_summary', 'counts', state],
+        message: 'counts must tally the hypothesis states',
+      });
+    }
+  }
+}
+
 export const EvidencePackSchema = z.object({
-  evidence_pack: z.object({
-    analysis_kind: z.enum(['diagnostic', 'maintenance']).optional(),
-    diagnostic_confidence: z.number().min(0).max(100).optional(),
-    factual_inputs_confirmed: z.array(z.string()),
-    factual_inputs_missing: z.array(z.string()),
-    system_suspects: z.array(z.string()),
-    candidate_hypotheses: z.array(CandidateHypothesisSchema),
-    maintenance_links: z.array(z.string()),
-    risk_flags: z.array(z.string()),
-    safety_alert: z.string().optional(),
-    risk_level: z.enum(['critical', 'high', 'moderate', 'low']).optional(),
-    signal_quality: z.enum(['high', 'medium', 'low']).optional(),
-    catalog_guard: CatalogGuardSchema,
-    maintenance_recommendations: z.array(z.unknown()).optional(),
-    preventive_schedule: z
-      .array(
-        z.object({
-          operation: z.string(),
-          next_at_km: z.string(),
-          status: z.enum(['overdue', 'approaching', 'ok', 'unknown']),
-        }),
-      )
-      .optional(),
-    allowed_claims: z.array(z.string()),
-    // v1: permissif. v2: union typee par bloc (VehicleContextCardInput, etc.)
-    ui_block_inputs: z.record(z.string(), z.unknown()),
-  }),
+  evidence_pack: z
+    .object({
+      analysis_kind: z.enum(['diagnostic', 'maintenance']).optional(),
+      diagnostic_confidence: z.number().min(0).max(100).optional(),
+      factual_inputs_confirmed: z.array(z.string()),
+      factual_inputs_missing: z.array(z.string()),
+      system_suspects: z.array(z.string()),
+      candidate_hypotheses: z.array(CandidateHypothesisSchema),
+      maintenance_links: z.array(z.string()),
+      risk_flags: z.array(z.string()),
+      safety_alert: z.string().optional(),
+      risk_level: z.enum(['critical', 'high', 'moderate', 'low']).optional(),
+      signal_quality: z.enum(['high', 'medium', 'low']).optional(),
+      catalog_guard: CatalogGuardSchema,
+      maintenance_recommendations: z.array(z.unknown()).optional(),
+      preventive_schedule: z
+        .array(
+          z.object({
+            operation: z.string(),
+            next_at_km: z.string(),
+            status: z.enum(['overdue', 'approaching', 'ok', 'unknown']),
+          }),
+        )
+        .optional(),
+      allowed_claims: z.array(z.string()),
+      // v1: permissif. v2: union typee par bloc (VehicleContextCardInput, etc.)
+      ui_block_inputs: z.record(z.string(), z.unknown()),
+      // Absent = provenance not exposed (flag OFF) or pack stored before it.
+      provenance_summary: ProvenanceSummarySchema.optional(),
+    })
+    .superRefine(checkProvenanceConsistency),
 });
 export type EvidencePack = z.infer<typeof EvidencePackSchema>;
 
```

- [ ] **Étape 4 : vérifier que tout passe**

Run : même commande qu'à l'Étape 2.
Attendu : 17 tests verts.

- [ ] **Étape 5 : commit**

```bash
git add backend/src/modules/diagnostic-engine/types/evidence-pack.schema.ts \
  backend/src/modules/diagnostic-engine/evidence-pack-provenance.schema.test.ts
git commit -F - <<'EOF'
feat(diagnostic): provenance par hypothèse et résumé dans le pack de preuves

Champs optionnels : une session enregistrée avant se relit telle quelle.
État sourced / partial / unsourced dérivé des liens, résumé available (compteurs)
ou unavailable (aucun compteur, aucun état). Un pack incohérent est refusé.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 4 : drapeaux EXPOSE / PRIMARY et service de provenance

`DiagnosticProvenanceService.rank(links, score)` relit les drapeaux à chaque appel. OFF : classement de référence, aucune lecture, aucun événement. EXPOSE : lit les provenances, calcule l'état de chaque hypothèse et le résumé, sans toucher au classement, et mesure ce que PRIMARY changerait (`rank_changed`). EXPOSE + PRIMARY : chaque contribution pèse 100 si son lien est `diagnostic_safe` vivant, 0 sinon, et la moyenne est arrondie une seule fois avant d'être passée à la fonction de score. Lecture illisible : `unavailable`, classement de référence, une erreur journalisée. Son `onModuleInit` est synchrone (règle backend : aucune I/O distante) : il ne fait qu'avertir si PRIMARY est demandé sans EXPOSE ; une surcharge admin qui crée ce cas plus tard avertit à la première analyse ; un seul avertissement par processus.

**Files:**
- Modify: `backend/src/config/feature-flags.service.ts` (2 getters + `ALLOWED_KEYS`)
- Create: `backend/src/modules/diagnostic-engine/services/diagnostic-provenance.service.ts`
- Create: `backend/src/modules/diagnostic-engine/services/diagnostic-provenance.service.test.ts`

**Interfaces:**
- Consumes : `DiagnosticEngineDataService.getLiveLinkProvenance()`, `DiagMergedCauseLink`, `DiagSymptomCauseLink` (Tâche 2) ; `HypothesisProvenance`, `ProvenanceSummary`, `provenanceStateOf` (Tâche 3) ; `FeatureFlagsService`, `EventEmitter2` existants.
- Produces : `FeatureFlagsService.diagnosticProvenanceExposeEnabled: boolean` (`DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED`) et `diagnosticProvenancePrimaryEnabled: boolean` (`DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED`), défaut `false` ; `DIAGNOSTIC_PROVENANCE_EVALUATED = 'diagnostic_provenance_evaluated'` ; `DiagnosticProvenanceEvaluated {mode: 'expose' | 'primary'; status: 'available' | 'unavailable'; top_state?; rank_changed?}` ; `RankedWithProvenance<H> {hypotheses: H[]; provenance: {byHypothesis: ReadonlyMap<string, HypothesisProvenance>; summary: ProvenanceSummary} | null}` ; classe `DiagnosticProvenanceService implements OnModuleInit`, constructeur `(dataService: DiagnosticEngineDataService, flags: FeatureFlagsService, events: EventEmitter2)`, méthode `rank<H extends {hypothesis_id: string}>(links: DiagMergedCauseLink[], score: (links: DiagSymptomCauseLink[]) => H[]): Promise<RankedWithProvenance<H>>`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `backend/src/modules/diagnostic-engine/services/diagnostic-provenance.service.test.ts` avec exactement ce contenu :

```typescript
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import type {
  DiagLinkProvenance,
  DiagMergedCauseLink,
  DiagnosticEngineDataService,
} from '../diagnostic-engine.data-service';
import { HypothesisScoringEngine } from '../engines/hypothesis-scoring.engine';
import {
  DIAGNOSTIC_PROVENANCE_EVALUATED,
  DiagnosticProvenanceService,
} from './diagnostic-provenance.service';

const EXPOSE = 'DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED';
const PRIMARY = 'DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED';

/** A merged cause as getScoredCausesForSymptoms returns it. */
function cause(
  slug: string,
  causeId: number,
  contributions: Array<[linkId: number, symptomSlug: string, score: number]>,
): DiagMergedCauseLink {
  const scores = contributions.map(([, , score]) => score);
  return {
    id: contributions[0][0],
    symptom_id: 1,
    cause_id: causeId,
    relative_score: Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
    ),
    evidence_for: ['Symptôme déclaré'],
    evidence_against: [],
    requires_verification: true,
    active: true,
    cause: {
      id: causeId,
      slug,
      system_id: 1,
      label: slug,
      cause_type: 'component_fault',
      description: null,
      verification_method: null,
      urgency: 'moyenne',
      active: true,
    },
    contributions: contributions.map(
      ([link_id, symptom_slug, relative_score]) => ({
        link_id,
        symptom_slug,
        relative_score,
      }),
    ),
  };
}

const row = (
  linkId: number,
  wikiPath: string,
  diagnosticSafe: boolean,
): DiagLinkProvenance => ({
  link_id: linkId,
  wiki_path: wikiPath,
  gamme_slug: wikiPath.replace(/^gammes\/|\.md$/g, ''),
  relation_to_part: 'direct_cause',
  diagnostic_safe: diagnosticSafe,
});

// alternateur: 2 symptoms, one documented but not safe, one undocumented.
// batterie: 1 symptom, documented and safe. The reference ranking puts the
// alternateur first (80 > 60); diagnostic_safe alone would put the batterie first.
const LINKS = [
  cause('alternateur-hs', 1, [
    [11, 'batterie-temoin-allume', 80],
    [12, 'demarrage-difficile', 80],
  ]),
  cause('batterie-dechargee', 2, [[21, 'demarrage-difficile', 60]]),
];
const ROWS = [
  row(11, 'gammes/alternateur.md', false),
  row(21, 'gammes/batterie.md', true),
  row(21, 'gammes/demarreur.md', false),
];

function setup(
  env: Record<string, string>,
  read?: (ids: number[]) => Promise<DiagLinkProvenance[]>,
) {
  const flags = new FeatureFlagsService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
  const getLiveLinkProvenance = jest.fn(
    read ??
      (async (ids: number[]) => ROWS.filter((r) => ids.includes(r.link_id))),
  );
  const events = new EventEmitter2();
  const emitted: unknown[] = [];
  events.on(DIAGNOSTIC_PROVENANCE_EVALUATED, (payload) =>
    emitted.push(payload),
  );
  const service = new DiagnosticProvenanceService(
    { getLiveLinkProvenance } as unknown as DiagnosticEngineDataService,
    flags,
    events,
  );
  const logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  Object.assign(service, { logger });
  const engine = new HypothesisScoringEngine();
  const rank = (links = LINKS) =>
    service.rank(links, (l) => engine.score(l, undefined));
  const reference = (links = LINKS) => engine.score(links, undefined);
  return {
    service,
    flags,
    rank,
    reference,
    getLiveLinkProvenance,
    emitted,
    logger,
  };
}

const ids = (hypotheses: Array<{ hypothesis_id: string }>) =>
  hypotheses.map((h) => h.hypothesis_id);

describe('DiagnosticProvenanceService', () => {
  it('flags OFF: the reference ranking, no read, no event', async () => {
    const t = setup({});
    const result = await t.rank();
    expect(result).toEqual({ hypotheses: t.reference(), provenance: null });
    expect(t.getLiveLinkProvenance).not.toHaveBeenCalled();
    expect(t.emitted).toEqual([]);
  });

  it('PRIMARY without EXPOSE is ignored, with one warning per process', async () => {
    const t = setup({ [PRIMARY]: 'true' });
    t.service.onModuleInit();
    const first = await t.rank();
    await t.rank();
    expect(first).toEqual({ hypotheses: t.reference(), provenance: null });
    expect(t.getLiveLinkProvenance).not.toHaveBeenCalled();
    expect(t.logger.warn).toHaveBeenCalledTimes(1);
    expect(t.logger.warn.mock.calls[0][0]).toMatch(
      new RegExp(`${PRIMARY}.*${EXPOSE}`),
    );
  });

  it('EXPOSE: shows the provenance without moving the ranking, and measures what PRIMARY would move', async () => {
    const t = setup({ [EXPOSE]: 'true' });
    const { hypotheses, provenance } = await t.rank();

    expect(hypotheses).toEqual(t.reference());
    expect(ids(hypotheses)).toEqual(['alternateur-hs', 'batterie-dechargee']);
    expect(t.getLiveLinkProvenance).toHaveBeenCalledTimes(1);
    expect([...t.getLiveLinkProvenance.mock.calls[0][0]].sort()).toEqual([
      11, 12, 21,
    ]);

    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
    expect(provenance?.byHypothesis.get('alternateur-hs')).toEqual({
      state: 'partial',
      links: [
        {
          link_id: 11,
          symptom_slug: 'batterie-temoin-allume',
          documented: true,
          wiki_refs: [
            {
              wiki_path: 'gammes/alternateur.md',
              gamme_slug: 'alternateur',
              relation_to_part: 'direct_cause',
              diagnostic_safe: false,
            },
          ],
        },
        {
          link_id: 12,
          symptom_slug: 'demarrage-difficile',
          documented: false,
          wiki_refs: [],
        },
      ],
    });
    expect(provenance?.byHypothesis.get('batterie-dechargee')?.state).toBe(
      'sourced',
    );
    expect(
      provenance?.byHypothesis.get('batterie-dechargee')?.links[0].wiki_refs,
    ).toHaveLength(2);

    expect(t.emitted).toEqual([
      {
        mode: 'expose',
        status: 'available',
        top_state: 'partial',
        rank_changed: true,
      },
    ]);
  });

  it('EXPOSE + PRIMARY: each contribution weighs 100 when its link is diagnostic_safe, else 0', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' });
    const { hypotheses, provenance } = await t.rank();

    expect(ids(hypotheses)).toEqual(['batterie-dechargee', 'alternateur-hs']);
    expect(hypotheses.map((h) => h.signal_match_score)).toEqual([30, 0]);
    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
    expect(t.emitted).toEqual([
      {
        mode: 'primary',
        status: 'available',
        top_state: 'sourced',
        rank_changed: true,
      },
    ]);
    expect(t.logger.warn).not.toHaveBeenCalled();
  });

  it('PRIMARY: 2 symptoms with 1 safe link weigh 50, rounded once (signal_match 15)', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => [
      row(31, 'gammes/pompe-a-eau.md', true),
    ]);
    const links = [
      cause('pompe-a-eau', 3, [
        [31, 'surchauffe', 10],
        [32, 'fuite-liquide', 10],
      ]),
    ];
    const { hypotheses, provenance } = await t.rank(links);
    expect(hypotheses[0].signal_match_score).toBe(15);
    expect(t.reference(links)[0].signal_match_score).toBe(3);
    expect(provenance?.byHypothesis.get('pompe-a-eau')?.state).toBe('partial');
  });

  it('a documented link that is not diagnostic_safe weighs 0 under PRIMARY but is still sourced', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => [
      row(41, 'gammes/courroie.md', false),
    ]);
    const links = [cause('courroie-usee', 4, [[41, 'bruit-moteur', 90]])];
    const { hypotheses, provenance } = await t.rank(links);
    expect(hypotheses[0].signal_match_score).toBe(0);
    expect(provenance?.byHypothesis.get('courroie-usee')?.state).toBe(
      'sourced',
    );
    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 0, unsourced: 0 },
    });
  });

  it('a link nobody documented is unsourced, and the ranking is unchanged under EXPOSE', async () => {
    const t = setup({ [EXPOSE]: 'true' }, async () => []);
    const { hypotheses, provenance } = await t.rank();
    expect(hypotheses).toEqual(t.reference());
    expect(provenance?.summary).toEqual({
      status: 'available',
      counts: { sourced: 0, partial: 0, unsourced: 2 },
    });
    expect(t.emitted).toEqual([
      {
        mode: 'expose',
        status: 'available',
        top_state: 'unsourced',
        rank_changed: false,
      },
    ]);
  });

  it('an unreadable provenance is unavailable — never unsourced — and the reference ranking is kept', async () => {
    const t = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => {
      throw new Error('__diag_link_provenance unavailable: permission denied');
    });
    const { hypotheses, provenance } = await t.rank();

    expect(hypotheses).toEqual(t.reference());
    expect(provenance?.summary).toEqual({ status: 'unavailable' });
    expect(provenance?.byHypothesis.size).toBe(0);
    expect(t.logger.error).toHaveBeenCalledTimes(1);
    expect(t.emitted).toEqual([{ mode: 'primary', status: 'unavailable' }]);
  });

  it('reads the flags on every call: a runtime override applies without restart', async () => {
    const t = setup({});
    expect((await t.rank()).provenance).toBeNull();
    t.flags.setOverride(EXPOSE, 'true');
    expect((await t.rank()).provenance?.summary.status).toBe('available');
    t.flags.setOverride(PRIMARY, 'true');
    expect(ids((await t.rank()).hypotheses)).toEqual([
      'batterie-dechargee',
      'alternateur-hs',
    ]);
    t.flags.setOverride(EXPOSE, 'false');
    const off = await t.rank();
    expect(off).toEqual({ hypotheses: t.reference(), provenance: null });
    expect(t.logger.warn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/services/diagnostic-provenance.service.test.ts`
Attendu : échec à la compilation, `TS2307: Cannot find module './diagnostic-provenance.service'`.

- [ ] **Étape 3 : les drapeaux**

Écrire ce diff dans `$SCRATCH/flags.diff`, puis `git apply "$SCRATCH/flags.diff"` :

```diff
diff --git a/backend/src/config/feature-flags.service.ts b/backend/src/config/feature-flags.service.ts
index 40af75f1d..8a0dd7948 100644
--- a/backend/src/config/feature-flags.service.ts
+++ b/backend/src/config/feature-flags.service.ts
@@ -381,6 +381,24 @@ export class FeatureFlagsService {
     return this.bool('DIAGNOSTIC_PROJECTION_ENABLED', false);
   }
 
+  /**
+   * Lit la provenance WIKI des liens et l'expose dans le pack de preuves
+   * (information, pas pondération : le classement ne change pas). Calcule
+   * l'écart de rang du mode primaire sans l'appliquer. Default `false`.
+   */
+  get diagnosticProvenanceExposeEnabled(): boolean {
+    return this.bool('DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED', false);
+  }
+
+  /**
+   * Classe par `diagnostic_safe` (100 par contribution sûre, 0 sinon). Effectif
+   * seulement avec `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` : sans exposition, le
+   * rang dépendrait d'une information invisible. Default `false`.
+   */
+  get diagnosticProvenancePrimaryEnabled(): boolean {
+    return this.bool('DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED', false);
+  }
+
   // ── Write Guard flags (P1.5) ──
 
   get writeGuardEnabled(): boolean {
@@ -459,6 +477,8 @@ export class FeatureFlagsService {
     'DIAGNOSTIC_KG_SHADOW_ENABLED',
     'DIAGNOSTIC_KG_PRIMARY_ENABLED',
     'DIAGNOSTIC_PROJECTION_ENABLED',
+    'DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED',
+    'DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED',
     'SHOW_ACCESSORY_BLOCKS_ON_R2',
   ]);
 
```

- [ ] **Étape 4 : le service**

Créer `backend/src/modules/diagnostic-engine/services/diagnostic-provenance.service.ts` avec exactement ce contenu :

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import {
  DiagnosticEngineDataService,
  type DiagLinkProvenance,
  type DiagMergedCauseLink,
  type DiagSymptomCauseLink,
} from '../diagnostic-engine.data-service';
import {
  provenanceStateOf,
  type HypothesisProvenance,
  type ProvenanceState,
  type ProvenanceSummary,
} from '../types/evidence-pack.schema';

/**
 * WIKI provenance of the diagnostic ranking.
 *
 * Reads, for every symptom → cause link behind the hypotheses, the live rows
 * projected from validated WIKI fiches (`__diag_link_provenance`) and decides
 * which ranking the orchestrator keeps:
 *
 *   - EXPOSE OFF: the reference ranking, nothing read (PRIMARY is ignored,
 *     with one warning per process — a ranking weighed by an information the
 *     pack does not show would be unexplainable).
 *   - EXPOSE ON: the reference ranking, plus each hypothesis's provenance and
 *     the rank change PRIMARY would make, measured and never applied.
 *   - EXPOSE + PRIMARY: each contribution weighs 100 when its link has a live
 *     `diagnostic_safe` row, else 0; the mean, rounded once, replaces the
 *     link's relative_score and the scoring engine runs unchanged.
 *
 * An unreadable provenance is `unavailable`: the reference ranking is kept
 * and no hypothesis carries a state — never `unsourced`, which would claim
 * the WIKI documents nothing. The flags are read on every call: the admin
 * dashboard can override them at runtime.
 */
export const DIAGNOSTIC_PROVENANCE_EVALUATED =
  'diagnostic_provenance_evaluated';

/** Event payload — bounded values only (it feeds Prometheus labels). */
export interface DiagnosticProvenanceEvaluated {
  mode: 'expose' | 'primary';
  status: ProvenanceSummary['status'];
  /** State of the hypothesis ranked first; absent when unavailable or empty. */
  top_state?: ProvenanceState;
  /** Whether PRIMARY orders the hypotheses differently; absent when unavailable. */
  rank_changed?: boolean;
}

export interface RankedWithProvenance<H> {
  hypotheses: H[];
  /** null = provenance not exposed (flag OFF). */
  provenance: {
    byHypothesis: ReadonlyMap<string, HypothesisProvenance>;
    summary: ProvenanceSummary;
  } | null;
}

@Injectable()
export class DiagnosticProvenanceService implements OnModuleInit {
  private readonly logger = new Logger(DiagnosticProvenanceService.name);
  private primaryIgnoredWarned = false;

  constructor(
    private readonly dataService: DiagnosticEngineDataService,
    private readonly flags: FeatureFlagsService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.warnIfPrimaryIgnored(
      this.flags.diagnosticProvenanceExposeEnabled,
      this.flags.diagnosticProvenancePrimaryEnabled,
    );
  }

  async rank<H extends { hypothesis_id: string }>(
    links: DiagMergedCauseLink[],
    score: (links: DiagSymptomCauseLink[]) => H[],
  ): Promise<RankedWithProvenance<H>> {
    const expose = this.flags.diagnosticProvenanceExposeEnabled;
    const primaryRequested = this.flags.diagnosticProvenancePrimaryEnabled;
    this.warnIfPrimaryIgnored(expose, primaryRequested);

    const reference = score(links);
    if (!expose) return { hypotheses: reference, provenance: null };
    const mode = primaryRequested ? 'primary' : 'expose';

    let rows: DiagLinkProvenance[];
    try {
      rows = await this.dataService.getLiveLinkProvenance(
        links.flatMap((link) => link.contributions.map((c) => c.link_id)),
      );
    } catch (error) {
      this.logger.error(
        'WIKI provenance unavailable — reference ranking kept, no state shown',
        error,
      );
      this.emit({ mode, status: 'unavailable' });
      return {
        hypotheses: reference,
        provenance: {
          byHypothesis: new Map(),
          summary: { status: 'unavailable' },
        },
      };
    }

    const refsByLink = new Map<number, DiagLinkProvenance[]>();
    for (const row of rows) {
      refsByLink.set(row.link_id, [
        ...(refsByLink.get(row.link_id) ?? []),
        row,
      ]);
    }
    const refsOf = (linkId: number) => refsByLink.get(linkId) ?? [];

    const byHypothesis = new Map<string, HypothesisProvenance>();
    for (const link of links) {
      if (!link.cause) continue;
      const provenanceLinks = link.contributions.map((c) => {
        const refs = refsOf(c.link_id);
        return {
          link_id: c.link_id,
          symptom_slug: c.symptom_slug,
          documented: refs.length > 0,
          wiki_refs: refs.map(
            ({ wiki_path, gamme_slug, relation_to_part, diagnostic_safe }) => ({
              wiki_path,
              gamme_slug,
              relation_to_part,
              diagnostic_safe,
            }),
          ),
        };
      });
      byHypothesis.set(link.cause.slug, {
        state: provenanceStateOf(provenanceLinks),
        links: provenanceLinks,
      });
    }

    const weighted = score(
      links.map((link) => ({
        ...link,
        relative_score: Math.round(
          link.contributions.reduce(
            (sum, c) =>
              sum +
              (refsOf(c.link_id).some((r) => r.diagnostic_safe) ? 100 : 0),
            0,
          ) / link.contributions.length,
        ),
      })),
    );
    const hypotheses = mode === 'primary' ? weighted : reference;

    const counts = { sourced: 0, partial: 0, unsourced: 0 };
    for (const h of hypotheses) {
      const state = byHypothesis.get(h.hypothesis_id)?.state;
      if (state) counts[state] += 1;
    }
    const top = hypotheses.at(0);
    this.emit({
      mode,
      status: 'available',
      top_state: top ? byHypothesis.get(top.hypothesis_id)?.state : undefined,
      rank_changed: weighted.some(
        (h, i) => h.hypothesis_id !== reference[i]?.hypothesis_id,
      ),
    });
    return {
      hypotheses,
      provenance: { byHypothesis, summary: { status: 'available', counts } },
    };
  }

  private warnIfPrimaryIgnored(
    expose: boolean,
    primaryRequested: boolean,
  ): void {
    if (!primaryRequested || expose || this.primaryIgnoredWarned) return;
    this.primaryIgnoredWarned = true;
    this.logger.warn(
      'DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED ignored: it requires DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED (the ranking would depend on a provenance the pack does not show)',
    );
  }

  private emit(payload: DiagnosticProvenanceEvaluated): void {
    this.events.emit(DIAGNOSTIC_PROVENANCE_EVALUATED, payload);
  }
}
```

- [ ] **Étape 5 : vérifier que tout passe**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/services/diagnostic-provenance.service.test.ts src/config/feature-flags`
Attendu : les 9 tests du service verts ; les suites existantes de `feature-flags` restent vertes.

- [ ] **Étape 6 : commit**

```bash
git add backend/src/config/feature-flags.service.ts \
  backend/src/modules/diagnostic-engine/services/diagnostic-provenance.service.ts \
  backend/src/modules/diagnostic-engine/services/diagnostic-provenance.service.test.ts
git commit -F - <<'EOF'
feat(diagnostic): service de provenance WIKI derrière EXPOSE / PRIMARY (OFF)

DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED montre la provenance sans toucher au
classement et mesure ce que PRIMARY changerait ; PRIMARY (ignoré sans EXPOSE,
avertissement une fois par processus) pondère chaque contribution 100 si son
lien est diagnostic_safe, 0 sinon. Provenance illisible → unavailable et
classement de référence, jamais unsourced. Drapeaux relus à chaque analyse.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 5 : branchement dans l'orchestrateur

L'orchestrateur reçoit le service en 8ᵉ paramètre et lui délègue le classement : `rank(scoredLinks, (links) => this.scoringEngine.score(links, input.vehicle_context))`. Tout ce qui suit (catalogue, risques, pack) lit les hypothèses rendues par `rank`. Chaque hypothèse reçoit sa provenance et le pack son résumé, seulement quand ils existent. L'ajout d'un paramètre au constructeur casse chaque `new DiagnosticEngineOrchestrator(` écrit à la main : l'injection NestJS masque cette casse, la liste des sites d'appel est donc vérifiée par grep.

**Files:**
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts`
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts`
- Create: `backend/src/modules/diagnostic-engine/diagnostic-provenance-pipeline.test.ts`
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts`
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-source-integrity.test.ts`
- Modify: `backend/src/modules/diagnostic-engine/maintenance-flow.test.ts`
- Modify: `backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts`

**Interfaces:**
- Consumes : `DiagnosticProvenanceService.rank()`, `RankedWithProvenance` (Tâche 4) ; champs `provenance` / `provenance_summary` du pack (Tâche 3).
- Produces : constructeur de `DiagnosticEngineOrchestrator` à 8 paramètres (le 8ᵉ : `private readonly provenance: DiagnosticProvenanceService`) ; `DiagnosticProvenanceService` fourni par `DiagnosticEngineModule` ; événement `diagnostic_provenance_evaluated` émis à chaque analyse sous EXPOSE (consommé à la Tâche 6).

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `backend/src/modules/diagnostic-engine/diagnostic-provenance-pipeline.test.ts` avec exactement ce contenu :

```typescript
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import type {
  DiagLinkProvenance,
  DiagMergedCauseLink,
  DiagSafetyRule,
  DiagnosticEngineDataService,
} from './diagnostic-engine.data-service';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { RiskSafetyEngine } from './engines/risk-safety.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
import { DiagnosticProvenanceService } from './services/diagnostic-provenance.service';
import {
  EvidencePackSchema,
  type EvidencePack,
} from './types/evidence-pack.schema';

const EXPOSE = 'DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED';
const PRIMARY = 'DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED';

const input = {
  intent_type: 'diagnostic_symptom',
  system_scope: 'electricite',
  vehicle_context: { brand: 'Test', model: 'Test', mileage_km: 120000 },
  signal_input: {
    signal_mode: 'symptom_slugs',
    primary_signal: 'batterie-temoin-allume',
  },
};

function cause(
  slug: string,
  causeId: number,
  contributions: Array<[linkId: number, symptomSlug: string, score: number]>,
): DiagMergedCauseLink {
  const scores = contributions.map(([, , score]) => score);
  return {
    id: contributions[0][0],
    symptom_id: 1,
    cause_id: causeId,
    relative_score: Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
    ),
    evidence_for: ['Symptôme déclaré'],
    evidence_against: [],
    requires_verification: true,
    active: true,
    cause: {
      id: causeId,
      slug,
      system_id: 1,
      label: slug,
      cause_type: 'component_fault',
      description: null,
      verification_method: null,
      urgency: 'moyenne',
      active: true,
    },
    contributions: contributions.map(
      ([link_id, symptom_slug, relative_score]) => ({
        link_id,
        symptom_slug,
        relative_score,
      }),
    ),
  };
}

// The alternator leads the reference ranking (90 > 50); only the battery link
// has a diagnostic_safe WIKI relation, so PRIMARY puts the battery first.
const LINKS = [
  cause('alternator_failing', 1, [
    [11, 'batterie-temoin-allume', 90],
    [12, 'demarrage-difficile', 90],
  ]),
  cause('battery_dead', 2, [[21, 'demarrage-difficile', 50]]),
];
const ROWS: DiagLinkProvenance[] = [
  {
    link_id: 11,
    wiki_path: 'gammes/alternateur.md',
    gamme_slug: 'alternateur',
    relation_to_part: 'direct_cause',
    diagnostic_safe: false,
  },
  {
    link_id: 21,
    wiki_path: 'gammes/batterie.md',
    gamme_slug: 'batterie',
    relation_to_part: 'direct_cause',
    diagnostic_safe: true,
  },
];
// Under PRIMARY each contribution weighs 100 when its link is diagnostic_safe,
// else 0: signal_match 30 for the battery, 0 for the alternator, on top of the
// 36 points the other five sub-scores give both (10 + 7 + 7 + 5 + 7).
const PRIMARY_TOP_SCORE = 66;
const PRIMARY_SECOND_SCORE = 36;
// diagnostic_confidence = top score × 1 (high signal quality) × (0.7 + 0.3 × 4
// confirmed facts / 5): 66 × 0.94, where the reference gives 63 × 0.94 → 59.
const PRIMARY_CONFIDENCE = 62;
// A 30-point lead: a dominant hypothesis, where the reference (63 vs 51) has none.
const PRIMARY_CATALOG = {
  ready_for_catalog: true,
  confidence_before_purchase: 'medium',
  allowed_output_mode: 'catalog_family_with_caution',
  suggested_gammes: [
    expect.objectContaining({ gamme_slug: 'batterie', confidence: 'medium' }),
    expect.objectContaining({ gamme_slug: 'alternateur', confidence: 'low' }),
  ],
};

// A non-blocking rule: the catalogue guard then follows the scores.
const rule: DiagSafetyRule = {
  id: 1,
  system_id: 1,
  rule_slug: 'electric_check',
  condition_description: 'Contrôle de charge',
  risk_flag: 'Charge à vérifier',
  urgency: 'moyenne',
  blocks_catalog: false,
  active: true,
};

function setup(
  env: Record<string, string>,
  read: () => Promise<DiagLinkProvenance[]> = async () => ROWS,
) {
  const getLiveLinkProvenance = jest.fn(read);
  const saveSession = jest.fn().mockResolvedValue('session-fixture');
  const data = {
    getScoredCausesForSymptoms: jest
      .fn()
      .mockResolvedValue(structuredClone(LINKS)),
    getSafetyRules: jest.fn().mockResolvedValue([rule]),
    getCostRanges: jest.fn().mockResolvedValue(new Map()),
    getLiveLinkProvenance,
    saveSession,
  } as unknown as DiagnosticEngineDataService;
  const signal = {
    interpret: jest.fn().mockResolvedValue({
      system_confirmed: true,
      system_slug: 'electricite',
      system_label: 'Électricité',
      resolved_symptom_slugs: ['batterie-temoin-allume', 'demarrage-difficile'],
      unresolved_signals: [],
      critical_symptom_labels: [],
      signal_quality: 'high',
    }),
  };
  const shadow = { shadowCompare: jest.fn() };
  const flags = new FeatureFlagsService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
  const engine = new DiagnosticEngineOrchestrator(
    data,
    signal as never,
    new HypothesisScoringEngine(),
    new RiskSafetyEngine(),
    new CatalogOrientationEngine(),
    {
      assess: jest.fn().mockResolvedValue({
        recommendations: [],
        maintenance_links: [],
        overdue_count: 0,
      }),
    } as never,
    shadow as never,
    new DiagnosticProvenanceService(data, flags, new EventEmitter2()),
  );
  return { engine, getLiveLinkProvenance, saveSession, shadow };
}

async function analyze(p: ReturnType<typeof setup>): Promise<EvidencePack> {
  const result = await p.engine.analyze(input);
  expect(result.success).toBe(true);
  const evidence = result.data!.evidence;
  // The pack is persisted as returned, and must re-read through the schema
  // the saved-session endpoint applies.
  expect(EvidencePackSchema.safeParse(evidence).success).toBe(true);
  expect(p.saveSession.mock.calls[0][0].result).toBe(evidence);
  return evidence;
}

/** The pack as it is without the provenance fields. */
function withoutProvenance(evidence: EvidencePack) {
  const { provenance_summary: _summary, ...pack } = structuredClone(
    evidence.evidence_pack,
  );
  const strip = (hypotheses: unknown) =>
    (hypotheses as Array<Record<string, unknown>>).map(
      ({ provenance: _p, ...h }) => h,
    );
  return {
    ...pack,
    candidate_hypotheses: strip(pack.candidate_hypotheses),
    ui_block_inputs: {
      ...pack.ui_block_inputs,
      HypothesisCards: strip(pack.ui_block_inputs.HypothesisCards),
    },
  };
}

const ids = (evidence: EvidencePack) =>
  evidence.evidence_pack.candidate_hypotheses.map((h) => h.hypothesis_id);

describe('diagnostic pipeline with the WIKI provenance', () => {
  test('EXPOSE OFF: the pack is today’s, and nothing is read', async () => {
    const p = setup({ [PRIMARY]: 'true' });
    const evidence = await analyze(p);
    expect(p.getLiveLinkProvenance).not.toHaveBeenCalled();
    expect(evidence.evidence_pack).not.toHaveProperty('provenance_summary');
    expect(
      evidence.evidence_pack.candidate_hypotheses.some(
        (h) => 'provenance' in h,
      ),
    ).toBe(false);
    expect(ids(evidence)).toEqual(['alternator_failing', 'battery_dead']);
  });

  test('EXPOSE: every hypothesis shows its provenance, nothing else moves', async () => {
    const off = await analyze(setup({}));
    const p = setup({ [EXPOSE]: 'true' });
    const evidence = await analyze(p);

    expect(p.getLiveLinkProvenance).toHaveBeenCalledWith([11, 12, 21]);
    expect(withoutProvenance(evidence)).toEqual(withoutProvenance(off));
    expect(evidence.evidence_pack.provenance_summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
    const [alternator, battery] = evidence.evidence_pack.candidate_hypotheses;
    expect(alternator.provenance).toMatchObject({
      state: 'partial',
      links: [
        { link_id: 11, documented: true },
        { link_id: 12, documented: false, wiki_refs: [] },
      ],
    });
    expect(battery.provenance).toEqual({
      state: 'sourced',
      links: [
        {
          link_id: 21,
          symptom_slug: 'demarrage-difficile',
          documented: true,
          wiki_refs: [
            {
              wiki_path: 'gammes/batterie.md',
              gamme_slug: 'batterie',
              relation_to_part: 'direct_cause',
              diagnostic_safe: true,
            },
          ],
        },
      ],
    });
    // The cards the UI reads are the same hypotheses.
    expect(evidence.evidence_pack.ui_block_inputs.HypothesisCards).toEqual(
      evidence.evidence_pack.candidate_hypotheses,
    );
  });

  test('EXPOSE + PRIMARY: the weighted ranking is the output, down to the catalogue', async () => {
    const off = await analyze(setup({}));
    const p = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' });
    const evidence = await analyze(p);
    const pack = evidence.evidence_pack;

    expect(ids(evidence)).toEqual(['battery_dead', 'alternator_failing']);
    expect(pack.candidate_hypotheses.map((h) => h.relative_score)).toEqual([
      PRIMARY_TOP_SCORE,
      PRIMARY_SECOND_SCORE,
    ]);
    // Everything downstream reads the same, weighted hypotheses.
    expect(off.evidence_pack.catalog_guard).toMatchObject({
      ready_for_catalog: false,
      confidence_before_purchase: 'low',
    });
    expect(pack.catalog_guard).toMatchObject(PRIMARY_CATALOG);
    expect(pack.diagnostic_confidence).toBe(PRIMARY_CONFIDENCE);
    expect(
      p.shadow.shadowCompare.mock.calls[0][0].canonical_hypotheses,
    ).toEqual([
      { cause_id: 'battery_dead', confidence: PRIMARY_TOP_SCORE / 100 },
      {
        cause_id: 'alternator_failing',
        confidence: PRIMARY_SECOND_SCORE / 100,
      },
    ]);
    // The safety assessment reads the set of causes, never their scores.
    expect({
      risk_level: pack.risk_level,
      risk_flags: pack.risk_flags,
      safety_alert: pack.safety_alert,
    }).toEqual({
      risk_level: off.evidence_pack.risk_level,
      risk_flags: off.evidence_pack.risk_flags,
      safety_alert: off.evidence_pack.safety_alert,
    });
    expect(pack.provenance_summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
  });

  test('unreadable provenance: the reference pack, marked unavailable, no state', async () => {
    const off = await analyze(setup({}));
    const p = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => {
      throw new Error('__diag_link_provenance: permission denied');
    });
    const evidence = await analyze(p);

    expect(evidence.evidence_pack.provenance_summary).toEqual({
      status: 'unavailable',
    });
    expect(
      evidence.evidence_pack.candidate_hypotheses.some(
        (h) => 'provenance' in h,
      ),
    ).toBe(false);
    expect(withoutProvenance(evidence)).toEqual(withoutProvenance(off));
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine/diagnostic-provenance-pipeline.test.ts`
Attendu : `diagnostic-provenance-pipeline.test.ts:171:5 - error TS2554: Expected 7 arguments, but got 8.`

- [ ] **Étape 3 : implémenter**

Écrire ce diff dans `$SCRATCH/orch.diff`, puis `git apply "$SCRATCH/orch.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts b/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts
index 8185fda9c..ae4790ec6 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts
@@ -25,6 +25,10 @@ import { RiskSafetyEngine } from './engines/risk-safety.engine';
 import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
 import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
 import { KgShadowService } from './services/kg-shadow.service';
+import {
+  DiagnosticProvenanceService,
+  type RankedWithProvenance,
+} from './services/diagnostic-provenance.service';
 
 @Injectable()
 export class DiagnosticEngineOrchestrator {
@@ -38,6 +42,7 @@ export class DiagnosticEngineOrchestrator {
     private readonly catalogEngine: CatalogOrientationEngine,
     private readonly maintenanceEngine: MaintenanceIntelligenceEngine,
     private readonly kgShadow: KgShadowService, // PR-E — fire-and-forget shadow
+    private readonly provenance: DiagnosticProvenanceService,
   ) {}
 
   /**
@@ -165,9 +170,13 @@ export class DiagnosticEngineOrchestrator {
     }
 
     // ── 4. Hypothesis Scoring Engine (multi-couches) ───
-    const hypotheses = this.scoringEngine.score(
+    // The provenance service returns THE ranking of this analysis: the
+    // reference one, or under PRIMARY the one weighed by diagnostic_safe.
+    // Everything below (risk, catalogue, confidence, KG shadow) reads it; the
+    // risk level depends on the set of causes, which no ranking changes.
+    const { hypotheses, provenance } = await this.provenance.rank(
       scoredLinks,
-      input.vehicle_context,
+      (links) => this.scoringEngine.score(links, input.vehicle_context),
     );
 
     if (!hypotheses.length) {
@@ -245,6 +254,7 @@ export class DiagnosticEngineOrchestrator {
       risk,
       catalog,
       maintenance,
+      provenance,
     );
 
     evidencePack.evidence_pack.factual_inputs_missing.push(...degraded);
@@ -390,6 +400,7 @@ export class DiagnosticEngineOrchestrator {
     risk: ReturnType<RiskSafetyEngine['assess']>,
     catalog: ReturnType<CatalogOrientationEngine['evaluate']>,
     maintenance: Awaited<ReturnType<MaintenanceIntelligenceEngine['assess']>>,
+    provenance: RankedWithProvenance<unknown>['provenance'],
   ): EvidencePack {
     // ── Factual inputs ─────────────────────────────────
     const confirmed: string[] = [];
@@ -462,6 +473,12 @@ export class DiagnosticEngineOrchestrator {
     };
 
     // ── Map hypotheses to contract format ──────────────
+    // The WIKI provenance of each hypothesis, when it was read (see
+    // DiagnosticProvenanceService): the same object for the pack and the cards.
+    const provenanceOf = (hypothesisId: string) => {
+      const p = provenance?.byHypothesis.get(hypothesisId);
+      return p ? { provenance: p } : {};
+    };
     const contractHypotheses = hypotheses.map((h) => ({
       hypothesis_id: h.hypothesis_id,
       label: h.label,
@@ -483,6 +500,7 @@ export class DiagnosticEngineOrchestrator {
         plausibility: h.plausibility_score,
         context: h.context_score,
       },
+      ...provenanceOf(h.hypothesis_id),
     }));
 
     // ── Claims ─────────────────────────────────────────
@@ -540,6 +558,7 @@ export class DiagnosticEngineOrchestrator {
         maintenance_recommendations: maintenance.recommendations,
         preventive_schedule: maintenance.preventive_schedule,
         allowed_claims: allowedClaims,
+        ...(provenance ? { provenance_summary: provenance.summary } : {}),
         ui_block_inputs: {
           VehicleContextCard: input.vehicle_context,
           SignalSummary: {
```

Écrire ce diff dans `$SCRATCH/engine-module.diff`, puis `git apply "$SCRATCH/engine-module.diff"` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts b/backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts
index be9411c0d..594988aa3 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts
@@ -24,6 +24,7 @@ import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligenc
 import { MaintenanceCalculatorService } from './services/maintenance-calculator.service';
 import { DiagnosticContentService } from './services/diagnostic-content.service';
 import { KgShadowService } from './services/kg-shadow.service';
+import { DiagnosticProvenanceService } from './services/diagnostic-provenance.service';
 // V1A.0 — Intent Resolution layer (composition pure)
 import { IntentClassifierService } from './services/intent-classifier.service';
 import { ActionRecommenderService } from './services/action-recommender.service';
@@ -49,6 +50,7 @@ import { DiagnosticResolutionPipelineService } from './services/diagnostic-resol
     MaintenanceCalculatorService,
     DiagnosticContentService,
     KgShadowService, // PR-E — shadow KG comparison (fire-and-forget)
+    DiagnosticProvenanceService, // WIKI provenance of the ranking (flags EXPOSE / PRIMARY)
     // V1A.0 — Intent Resolution layer
     IntentClassifierService,
     ActionRecommenderService,
```

- [ ] **Étape 4 : constater la casse des constructions existantes**

```bash
grep -rln "new DiagnosticEngineOrchestrator(" backend/src | sort
npm --prefix backend test -- src/modules/diagnostic-engine 2>&1 | grep -E "TS2554|can't resolve dependencies|^(Test Suites|Tests):"
```

Attendu : exactement 4 fichiers (`diagnostic-integrity.test.ts`, `diagnostic-provenance-pipeline.test.ts`, `diagnostic-source-integrity.test.ts`, `maintenance-flow.test.ts`) ; 3 suites en `TS2554: Expected 8 arguments, but got 7.` (`diagnostic-source-integrity.test.ts:154:18`, `maintenance-flow.test.ts:48:18`, `diagnostic-integrity.test.ts:94:18`) et, dans `diagnostic-engine.orchestrator.test.ts`, 3 tests rouges `Nest can't resolve dependencies of the DiagnosticEngineOrchestrator (…). Please make sure that the argument DiagnosticProvenanceService at index [7] is available …`. Toute autre suite rouge : s'arrêter et le signaler.

- [ ] **Étape 5 : construire le service partout où l'orchestrateur est construit**

Les trois tests à construction manuelle passent un service réel, drapeaux OFF (`ConfigService` qui ne rend rien) ; le test de module de l'orchestrateur le fournit avec `FeatureFlagsService` OFF et `EventEmitter2`. Écrire chacun de ces diffs dans `$SCRATCH/<nom>.diff`, puis `git apply` :

`$SCRATCH/orch-test.diff` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts b/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts
index b8e699021..d9975b449 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts
@@ -1,4 +1,6 @@
 import { Test } from '@nestjs/testing';
+import { EventEmitter2 } from '@nestjs/event-emitter';
+import { FeatureFlagsService } from '../../config/feature-flags.service';
 import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
 import {
   DiagnosticEngineDataService,
@@ -10,6 +12,7 @@ import { RiskSafetyEngine } from './engines/risk-safety.engine';
 import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
 import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
 import { KgShadowService } from './services/kg-shadow.service';
+import { DiagnosticProvenanceService } from './services/diagnostic-provenance.service';
 import { EvidencePackSchema } from './types/evidence-pack.schema';
 
 const input = {
@@ -113,6 +116,13 @@ describe('Diagnostic without RAG content authority', () => {
           },
         },
         { provide: KgShadowService, useValue: { shadowCompare: jest.fn() } },
+        // The real service, resolved by the container, with its flags OFF.
+        DiagnosticProvenanceService,
+        {
+          provide: FeatureFlagsService,
+          useValue: new FeatureFlagsService({ get: () => undefined } as never),
+        },
+        { provide: EventEmitter2, useValue: new EventEmitter2() },
       ],
     }).compile();
     orchestrator = module.get(DiagnosticEngineOrchestrator);
```

`$SCRATCH/source-integrity.diff` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-source-integrity.test.ts b/backend/src/modules/diagnostic-engine/diagnostic-source-integrity.test.ts
index 5fda758a4..922eadd8d 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-source-integrity.test.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-source-integrity.test.ts
@@ -1,6 +1,9 @@
+import { EventEmitter2 } from '@nestjs/event-emitter';
+import { FeatureFlagsService } from '../../config/feature-flags.service';
 import { EvidencePackSchema } from './types/evidence-pack.schema';
 import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
 import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
+import { DiagnosticProvenanceService } from './services/diagnostic-provenance.service';
 import { SignalInterpretationEngine } from './engines/signal-interpretation.engine';
 import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
 import { RiskSafetyEngine } from './engines/risk-safety.engine';
@@ -159,6 +162,12 @@ function pipeline(service: DiagnosticEngineDataService) {
     new CatalogOrientationEngine(),
     { assess: enriched } as never,
     { shadowCompare: jest.fn() } as never,
+    // Flags OFF: the reference ranking, as before the WIKI provenance.
+    new DiagnosticProvenanceService(
+      service,
+      new FeatureFlagsService({ get: () => undefined } as never),
+      new EventEmitter2(),
+    ),
   );
   return { engine, saved, enriched };
 }
```

`$SCRATCH/maintenance-flow.diff` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/maintenance-flow.test.ts b/backend/src/modules/diagnostic-engine/maintenance-flow.test.ts
index a92055e24..e96f9f2f3 100644
--- a/backend/src/modules/diagnostic-engine/maintenance-flow.test.ts
+++ b/backend/src/modules/diagnostic-engine/maintenance-flow.test.ts
@@ -1,4 +1,7 @@
+import { EventEmitter2 } from '@nestjs/event-emitter';
+import { FeatureFlagsService } from '../../config/feature-flags.service';
 import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
+import { DiagnosticProvenanceService } from './services/diagnostic-provenance.service';
 import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
 import { DiagnosticEngineController } from './diagnostic-engine.controller';
 import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
@@ -53,6 +56,12 @@ function fixture() {
     catalog as never,
     new MaintenanceIntelligenceEngine(data as never),
     shadow as never,
+    // Flags OFF: the reference ranking, as before the WIKI provenance.
+    new DiagnosticProvenanceService(
+      data as never,
+      new FeatureFlagsService({ get: () => undefined } as never),
+      new EventEmitter2(),
+    ),
   );
   return { engine, data, signal, score, risk, catalog, shadow };
 }
```

`$SCRATCH/integrity-construction.diff` :

```diff
diff --git a/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts b/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
index f26e54788..f31f2256e 100644
--- a/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
+++ b/backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
@@ -1,10 +1,13 @@
 import { Logger } from '@nestjs/common';
+import { EventEmitter2 } from '@nestjs/event-emitter';
+import { FeatureFlagsService } from '../../config/feature-flags.service';
 import {
   DiagnosticEngineDataService,
   type DiagSymptomCauseLink,
   type DiagSafetyRule,
 } from './diagnostic-engine.data-service';
 import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
+import { DiagnosticProvenanceService } from './services/diagnostic-provenance.service';
 import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
 import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
 import {
@@ -99,6 +102,12 @@ function orchestrator() {
     new CatalogOrientationEngine(),
     maintenance as never,
     shadow as never,
+    // Flags OFF: the reference ranking, as before the WIKI provenance.
+    new DiagnosticProvenanceService(
+      data as unknown as DiagnosticEngineDataService,
+      new FeatureFlagsService({ get: () => undefined } as never),
+      new EventEmitter2(),
+    ),
   );
   return { engine, data, signal, maintenance };
 }
```

- [ ] **Étape 6 : vérifier que tout passe**

Run : `npm --prefix backend test -- src/modules/diagnostic-engine src/modules/observability src/config 2>&1 | grep -E '^(Test Suites|Tests):'`
Attendu : aucune suite ni test en échec ; référence de la Tâche 2 (`$SCRATCH/p3-backend-ref.txt`) + 4 suites et + 41 tests (lecteur 11, schéma 17, service 9, pipeline 4) — 37 / 685 sur la base combinée du 2026-10-01.

- [ ] **Étape 7 : commit**

```bash
git add backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.ts \
  backend/src/modules/diagnostic-engine/diagnostic-engine.module.ts \
  backend/src/modules/diagnostic-engine/diagnostic-provenance-pipeline.test.ts \
  backend/src/modules/diagnostic-engine/diagnostic-engine.orchestrator.test.ts \
  backend/src/modules/diagnostic-engine/diagnostic-source-integrity.test.ts \
  backend/src/modules/diagnostic-engine/maintenance-flow.test.ts \
  backend/src/modules/diagnostic-engine/diagnostic-integrity.test.ts
git commit -F - <<'EOF'
feat(diagnostic): l'orchestrateur classe les hypothèses par le service de provenance

8e paramètre DiagnosticProvenanceService ; tout l'aval (catalogue, risques,
pack) lit les hypothèses rendues par rank(). Provenance par hypothèse et résumé
ajoutés au pack seulement quand ils existent : drapeaux OFF, pack identique.
Les 4 constructions manuelles de l'orchestrateur (grep exhaustif) passent le
service réel, drapeaux OFF.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 6 : compteur Prometheus de la provenance

Le service émet `diagnostic_provenance_evaluated` ; le module d'observabilité le compte, sur le modèle du compteur d'ombre KG : jeton `Symbol.for`, fabrique de compteur, listener sans dépendance au domaine diagnostic, charge utile mal formée comptée en `unknown`, jamais levée. Un test câble le vrai service au listener par le bus d'événements Nest : un événement ou une valeur de label renommés y échouent.

**Files:**
- Modify: `backend/src/modules/observability/observability.tokens.ts`
- Create: `backend/src/modules/observability/diagnostic-provenance.metrics.ts`
- Create: `backend/src/modules/observability/diagnostic-provenance-metrics.listener.ts`
- Create: `backend/src/modules/observability/diagnostic-provenance-metrics.listener.test.ts`
- Modify: `backend/src/modules/observability/observability.module.ts`

**Interfaces:**
- Consumes : `DIAGNOSTIC_PROVENANCE_EVALUATED`, `DiagnosticProvenanceService` (Tâche 4), `PROMETHEUS_REGISTRY` existant.
- Produces : `DIAGNOSTIC_PROVENANCE_COUNTER = Symbol.for('Observability.DiagnosticProvenanceCounter')` ; `DIAGNOSTIC_PROVENANCE_METRIC_NAME = 'diagnostic_provenance_evaluated_total'` ; `DiagnosticProvenanceCounter { evaluated: Counter<'mode' | 'status' | 'top_state' | 'rank_changed'> }` ; `buildDiagnosticProvenanceCounter(registry)` ; `DiagnosticProvenanceMetricsListener.onEvaluated(payload: unknown)` ; série servie par `GET api/observability/metrics`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `backend/src/modules/observability/diagnostic-provenance-metrics.listener.test.ts` avec exactement ce contenu :

```typescript
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { Registry } from 'prom-client';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import {
  DiagnosticEngineDataService,
  type DiagMergedCauseLink,
} from '../diagnostic-engine/diagnostic-engine.data-service';
import { DiagnosticProvenanceService } from '../diagnostic-engine/services/diagnostic-provenance.service';
import {
  buildDiagnosticProvenanceCounter,
  DIAGNOSTIC_PROVENANCE_METRIC_NAME,
} from './diagnostic-provenance.metrics';
import { DiagnosticProvenanceMetricsListener } from './diagnostic-provenance-metrics.listener';
import { DIAGNOSTIC_PROVENANCE_COUNTER } from './observability.tokens';

function setup(): {
  listener: DiagnosticProvenanceMetricsListener;
  registry: Registry;
} {
  const registry = new Registry();
  return {
    listener: new DiagnosticProvenanceMetricsListener(
      buildDiagnosticProvenanceCounter(registry),
    ),
    registry,
  };
}

async function count(registry: Registry, labels: string): Promise<number> {
  const text = await registry.metrics();
  const line = text
    .split('\n')
    .find((l) =>
      l.startsWith(`${DIAGNOSTIC_PROVENANCE_METRIC_NAME}{${labels}}`),
    );
  return line ? Number(line.trim().split(/\s+/).pop()) : 0;
}

describe('DiagnosticProvenanceMetricsListener', () => {
  test('counts an available evaluation under its four labels', async () => {
    const { listener, registry } = setup();
    const payload = {
      mode: 'expose',
      status: 'available',
      top_state: 'partial',
      rank_changed: true,
    };
    listener.onEvaluated(payload);
    listener.onEvaluated(payload);
    expect(
      await count(
        registry,
        'mode="expose",status="available",top_state="partial",rank_changed="true"',
      ),
    ).toBe(2);
  });

  test('labels the fields an unavailable provenance does not carry "none"', async () => {
    const { listener, registry } = setup();
    listener.onEvaluated({ mode: 'primary', status: 'unavailable' });
    expect(
      await count(
        registry,
        'mode="primary",status="unavailable",top_state="none",rank_changed="none"',
      ),
    ).toBe(1);
  });

  test('buckets any value outside the known sets as "unknown" (bounded cardinality, never throws)', async () => {
    const { listener, registry } = setup();
    listener.onEvaluated({
      mode: 'battery_dead',
      status: 'maybe',
      top_state: 'gammes/batterie.md',
      rank_changed: 'yes',
    });
    listener.onEvaluated(null);
    expect(
      await count(
        registry,
        'mode="unknown",status="unknown",top_state="unknown",rank_changed="unknown"',
      ),
    ).toBe(1);
    expect(
      await count(
        registry,
        'mode="unknown",status="unknown",top_state="none",rank_changed="none"',
      ),
    ).toBe(1);
  });

  test('metric name matches the canonical constant, with HELP and TYPE', async () => {
    const { listener, registry } = setup();
    expect(DIAGNOSTIC_PROVENANCE_METRIC_NAME).toBe(
      'diagnostic_provenance_evaluated_total',
    );
    listener.onEvaluated({ mode: 'expose', status: 'unavailable' });
    const text = await registry.metrics();
    expect(text).toContain(`# HELP ${DIAGNOSTIC_PROVENANCE_METRIC_NAME}`);
    expect(text).toContain(
      `# TYPE ${DIAGNOSTIC_PROVENANCE_METRIC_NAME} counter`,
    );
  });

  // The event name and the payload labels are the diagnostic engine's: this
  // wires the real service to the listener through the Nest event bus, so a
  // renamed event or label value fails here, not silently in production.
  test('counts what DiagnosticProvenanceService emits, through the event bus', async () => {
    const registry = new Registry();
    const link: DiagMergedCauseLink = {
      id: 11,
      symptom_id: 1,
      cause_id: 1,
      relative_score: 90,
      evidence_for: ['Symptôme déclaré'],
      evidence_against: [],
      requires_verification: true,
      active: true,
      cause: {
        id: 1,
        slug: 'battery_dead',
        system_id: 1,
        label: 'battery_dead',
        cause_type: 'component_fault',
        description: null,
        verification_method: null,
        urgency: 'moyenne',
        active: true,
      },
      contributions: [
        {
          link_id: 11,
          symptom_slug: 'demarrage-difficile',
          relative_score: 90,
        },
      ],
    };
    const env: Record<string, string> = {
      DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED: 'true',
    };
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        {
          provide: DIAGNOSTIC_PROVENANCE_COUNTER,
          useFactory: () => buildDiagnosticProvenanceCounter(registry),
        },
        DiagnosticProvenanceMetricsListener,
        DiagnosticProvenanceService,
        {
          provide: DiagnosticEngineDataService,
          useValue: {
            getLiveLinkProvenance: async () => [
              {
                link_id: 11,
                wiki_path: 'gammes/batterie.md',
                gamme_slug: 'batterie',
                relation_to_part: 'direct_cause',
                diagnostic_safe: true,
              },
            ],
          },
        },
        {
          provide: FeatureFlagsService,
          useValue: new FeatureFlagsService({
            get: (key: string) => env[key],
          } as unknown as ConfigService),
        },
      ],
    }).compile();
    await moduleRef.init();

    await moduleRef
      .get(DiagnosticProvenanceService)
      .rank([link], (links) =>
        links.map((l) => ({ hypothesis_id: l.cause!.slug })),
      );
    await moduleRef.close();

    expect(
      await count(
        registry,
        'mode="expose",status="available",top_state="sourced",rank_changed="false"',
      ),
    ).toBe(1);
  });
});
```

- [ ] **Étape 2 : vérifier l'échec**

Run : `npm --prefix backend test -- src/modules/observability/diagnostic-provenance-metrics.listener.test.ts`
Attendu : échec à la compilation, `TS2307` sur `./diagnostic-provenance.metrics` et `./diagnostic-provenance-metrics.listener`, `TS2305` sur `DIAGNOSTIC_PROVENANCE_COUNTER`.

- [ ] **Étape 3 : implémenter**

Écrire ce diff dans `$SCRATCH/obs-tokens.diff`, puis `git apply "$SCRATCH/obs-tokens.diff"` :

```diff
diff --git a/backend/src/modules/observability/observability.tokens.ts b/backend/src/modules/observability/observability.tokens.ts
index c58dd214b..33a2720a2 100644
--- a/backend/src/modules/observability/observability.tokens.ts
+++ b/backend/src/modules/observability/observability.tokens.ts
@@ -18,3 +18,9 @@ export const PROMETHEUS_REGISTRY = Symbol.for(
 export const DIAGNOSTIC_KG_SHADOW_COUNTER = Symbol.for(
   'Observability.DiagnosticKgShadowCounter',
 );
+
+// Diagnostic WIKI provenance counter, distinct for the same reason (flags
+// DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED, DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED).
+export const DIAGNOSTIC_PROVENANCE_COUNTER = Symbol.for(
+  'Observability.DiagnosticProvenanceCounter',
+);
```

Créer `backend/src/modules/observability/diagnostic-provenance.metrics.ts` avec exactement ce contenu :

```typescript
import { Counter, Registry } from 'prom-client';

/**
 * Diagnostic WIKI provenance counter.
 *
 * Emitted by `DiagnosticProvenanceService.rank()` once per analysis while
 * DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED is ON. Under EXPOSE alone it measures,
 * before PRIMARY is switched on, how often PRIMARY would reorder the
 * hypotheses (`rank_changed`) and how documented the leading one is
 * (`top_state`); `status="unavailable"` counts the analyses whose provenance
 * could not be read.
 *
 * Labels are bounded sets (label discipline of the other diagnostic counters):
 *   - `mode` ∈ { expose | primary }
 *   - `status` ∈ { available | unavailable }
 *   - `top_state` ∈ { sourced | partial | unsourced | none }
 *   - `rank_changed` ∈ { true | false | none }
 * `none` = not carried by the event (unavailable, or no hypothesis);
 * `unknown` = a value outside these sets.
 *
 * NEVER labelled with cause, link, fiche or session ids (cardinality explosion).
 */
export const DIAGNOSTIC_PROVENANCE_METRIC_NAME =
  'diagnostic_provenance_evaluated_total';

export interface DiagnosticProvenanceCounter {
  readonly evaluated: Counter<'mode' | 'status' | 'top_state' | 'rank_changed'>;
}

export function buildDiagnosticProvenanceCounter(
  registry: Registry,
): DiagnosticProvenanceCounter {
  return {
    evaluated: new Counter({
      name: DIAGNOSTIC_PROVENANCE_METRIC_NAME,
      help: 'Count of diagnostic analyses evaluated against the WIKI provenance, by mode, status, state of the leading hypothesis and whether PRIMARY reorders the hypotheses.',
      labelNames: ['mode', 'status', 'top_state', 'rank_changed'],
      registers: [registry],
    }),
  };
}
```

Créer `backend/src/modules/observability/diagnostic-provenance-metrics.listener.ts` avec exactement ce contenu :

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DiagnosticProvenanceCounter } from './diagnostic-provenance.metrics';
import { DIAGNOSTIC_PROVENANCE_COUNTER } from './observability.tokens';

const MODES = ['expose', 'primary'];
const STATUSES = ['available', 'unavailable'];
const STATES = ['sourced', 'partial', 'unsourced'];
const BOOLEANS = [true, false];

/**
 * DiagnosticProvenanceMetricsListener — wires the
 * `diagnostic_provenance_evaluated` event emitted by
 * `DiagnosticProvenanceService` into the Prometheus counter registered by
 * this module. Mirror of the KG shadow listener: no dependency on the
 * diagnostic domain, and a malformed payload is counted, never thrown.
 */
@Injectable()
export class DiagnosticProvenanceMetricsListener {
  constructor(
    @Inject(DIAGNOSTIC_PROVENANCE_COUNTER)
    private readonly counter: DiagnosticProvenanceCounter,
  ) {}

  @OnEvent('diagnostic_provenance_evaluated')
  onEvaluated(payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    this.counter.evaluated
      .labels({
        mode: label(p.mode, MODES),
        status: label(p.status, STATUSES),
        top_state: optionalLabel(p.top_state, STATES),
        rank_changed: optionalLabel(p.rank_changed, BOOLEANS),
      })
      .inc();
  }
}

/** The value when it belongs to its set, else `unknown`. */
function label(v: unknown, allowed: readonly unknown[]): string {
  return allowed.includes(v) ? String(v) : 'unknown';
}

/** As `label`, with `none` for a field the event does not carry. */
function optionalLabel(v: unknown, allowed: readonly unknown[]): string {
  return v === undefined ? 'none' : label(v, allowed);
}
```

Écrire ce diff dans `$SCRATCH/obs-module.diff`, puis `git apply "$SCRATCH/obs-module.diff"` :

```diff
diff --git a/backend/src/modules/observability/observability.module.ts b/backend/src/modules/observability/observability.module.ts
index 943725c6d..edd266686 100644
--- a/backend/src/modules/observability/observability.module.ts
+++ b/backend/src/modules/observability/observability.module.ts
@@ -5,11 +5,14 @@ import {
   PROMETHEUS_REGISTRY,
   VEHICLE_CONTEXT_COUNTERS,
   DIAGNOSTIC_KG_SHADOW_COUNTER,
+  DIAGNOSTIC_PROVENANCE_COUNTER,
 } from './observability.tokens';
 import { buildVehicleContextCounters } from './vehicle-context.metrics';
 import { VehicleContextMetricsListener } from './vehicle-context-metrics.listener';
 import { buildDiagnosticKgShadowCounter } from './diagnostic-kg-shadow.metrics';
 import { DiagnosticKgShadowMetricsListener } from './diagnostic-kg-shadow-metrics.listener';
+import { buildDiagnosticProvenanceCounter } from './diagnostic-provenance.metrics';
+import { DiagnosticProvenanceMetricsListener } from './diagnostic-provenance-metrics.listener';
 import { PrometheusController } from './prometheus.controller';
 
 /**
@@ -51,13 +54,21 @@ import { PrometheusController } from './prometheus.controller';
         buildDiagnosticKgShadowCounter(registry),
       inject: [PROMETHEUS_REGISTRY],
     },
+    {
+      provide: DIAGNOSTIC_PROVENANCE_COUNTER,
+      useFactory: (registry: Registry) =>
+        buildDiagnosticProvenanceCounter(registry),
+      inject: [PROMETHEUS_REGISTRY],
+    },
     VehicleContextMetricsListener,
     DiagnosticKgShadowMetricsListener, // PR-E — counts diagnostic_kg_shadow_diverged events
+    DiagnosticProvenanceMetricsListener, // counts diagnostic_provenance_evaluated events
   ],
   exports: [
     PROMETHEUS_REGISTRY,
     VEHICLE_CONTEXT_COUNTERS,
     DIAGNOSTIC_KG_SHADOW_COUNTER,
+    DIAGNOSTIC_PROVENANCE_COUNTER,
   ],
 })
 export class ObservabilityModule {}
```

- [ ] **Étape 4 : vérifier que tout passe**

Run : même commande qu'à l'Étape 2.
Attendu : 5 tests verts.

- [ ] **Étape 5 : contrôle complet**

```bash
npm --prefix backend test -- src/modules/diagnostic-engine src/modules/observability src/config 2>&1 | grep -E '^(Test Suites|Tests):'
(cd backend && NODE_OPTIONS='--max-old-space-size=4096' ../node_modules/.bin/tsc --noEmit -p tsconfig.json && echo TSC_OK)
CHANGED=$(git diff --name-only origin/main -- 'backend/src/**/*.ts'; git diff --name-only -- 'backend/src/**/*.ts'; git ls-files --others --exclude-standard -- 'backend/src/**/*.ts')
(cd backend && ../node_modules/.bin/eslint $(echo "$CHANGED" | sort -u | sed 's#^backend/##') && echo ESLINT_OK)
npx ast-grep scan --config sgconfig.yml backend/src/modules/diagnostic-engine backend/src/modules/observability backend/src/config && echo ASTGREP_OK
node_modules/.bin/prettier --check $(echo "$CHANGED" | sort -u) && echo PRETTIER_OK
```

Attendu : aucune suite ni test en échec, référence de la Tâche 2 + 5 suites et + 46 tests (38 / 690 sur la base combinée du 2026-10-01) ; `TSC_OK`, `ESLINT_OK`, `ASTGREP_OK`, `PRETTIER_OK`.

- [ ] **Étape 6 : commit**

```bash
git add backend/src/modules/observability/observability.tokens.ts \
  backend/src/modules/observability/diagnostic-provenance.metrics.ts \
  backend/src/modules/observability/diagnostic-provenance-metrics.listener.ts \
  backend/src/modules/observability/diagnostic-provenance-metrics.listener.test.ts \
  backend/src/modules/observability/observability.module.ts
git commit -F - <<'EOF'
feat(observability): compteur diagnostic_provenance_evaluated_total

Une analyse évaluée sous EXPOSE = +1, par mode, statut, état de l'hypothèse de
tête et changement de rang que PRIMARY produirait. Labels bornés (none /
unknown hors ensemble), jamais un slug ni un id. Test de câblage réel service →
bus d'événements → listener.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Tâche 7 : mutants backend, puis PR-D

**Files:** aucun fichier du dépôt (script dans `$SCRATCH`).

**Interfaces:**
- Consumes : tout le code des Tâches 2 à 6.
- Produces : PR-D `feat/diag-provenance-engine`.

- [ ] **Étape 1 : mutants — chaque garde du code doit avoir un test qui la tue**

Run : `python3 "$SCRATCH/mut_p3.py" backend; git status --porcelain` (depuis la racine du worktree)
Attendu : 11 lignes `KILLED` (`reader-count-check-removed`, `reader-unrequested-link-accepted`, `primary-without-expose`, `unavailable-read-as-undocumented`, `primary-weighs-documented-not-safe`, `pack-consistency-refine-neutralised`, `hypothesis-provenance-dropped`, `pack-summary-dropped`, `downstream-reads-reference-ranking`, `listener-event-renamed`, `listener-partial-state-unknown`), dernière ligne `survivors: []`, puis `git status --porcelain` vide (chaque mutant est restauré). Un `SETUP-ERROR` (ancre introuvable ou multiple) : s'arrêter et le signaler.

- [ ] **Étape 2 : gate de propriété**

Run : `node scripts/registry/check-new-files.js --base origin/main; echo "exit=$?"`
Attendu : `new files: 8 (8 ok, 0 failures)`, `✓ All new files pass owner+domain gate`, `exit=0`.

- [ ] **Étape 3 : PR-D (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin feat/diag-provenance-engine
gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/diag-provenance-engine \
  --title "feat(diagnostic): provenance WIKI des hypothèses (drapeaux EXPOSE / PRIMARY, OFF)" \
  --body-file - <<'EOF'
## Quoi
Le moteur de diagnostic lit la provenance WIKI projetée dans `__diag_link_provenance` :
lecture des seuls liens demandés, à compte exact ; état par hypothèse (`sourced` / `partial` /
`unsourced`) et résumé du pack. Deux drapeaux OFF par défaut, relus à chaque analyse :
- `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED` : montre la provenance sans toucher au classement ;
- `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED` : classe par la provenance (`diagnostic_safe` = 100,
  sinon 0) ; ignoré sans EXPOSE.
Provenance illisible → `unavailable` et classement de référence, jamais `unsourced`.
Compteur `diagnostic_provenance_evaluated_total` (labels bornés). Le moteur ne fait que lire.

Drapeaux OFF : pack identique, aucune lecture, aucun événement.

## Preuve
- 5 nouvelles suites (46 tests) : lecteur (compte exact, lien non demandé), contrat du pack
  (sessions anciennes, cohérence), service (OFF / EXPOSE / PRIMARY / illisible / surcharge à chaud),
  pack de bout en bout, câblage service → bus → compteur ;
- les 4 constructions manuelles de l'orchestrateur (grep exhaustif) passent le service réel ;
- 11 mutants tués ; tsc, ESLint, ast-grep, Prettier verts.

## Après fusion
Le container PREPROD démarre le service (drapeaux OFF ; s'ils étaient ON, le rôle `anon`
rendrait `unavailable`). Activation PROD hors de cette PR, sur décision de l'owner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr checks feat/diag-provenance-engine --repo ak125/nestjs-remix-monorepo --watch
```

Si le job « Registry freshness » échoue, appliquer tel quel le patch de son artefact, sans l'éditer (précédents #1622, #1639, #1641) :

```bash
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --branch feat/diag-provenance-engine --workflow registry-fresh.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run download "$RUN" --repo ak125/nestjs-remix-monorepo -n "registry-recovery-$RUN" -D "$SCRATCH/recovery-$RUN"
git apply --numstat "$SCRATCH/recovery-$RUN/generated-projections.patch"
git apply --index "$SCRATCH/recovery-$RUN/generated-projections.patch"
git status --porcelain
```

`--index` indexe exactement les fichiers du patch ; commiter ceux-là seulement (`chore(registry): régénérer les projections après la provenance du moteur`, même trailer), puis pousser après confirmation. Attendu final : tous les checks requis verts.

- [ ] **Étape 4 : preuve après fusion humaine**

```bash
SHA=$(gh pr view feat/diag-provenance-engine --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --commit "$SHA" --event push --json databaseId -q '.[0].databaseId')
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
```

Attendu : run présent et vert, jobs `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et `🔦 Lighthouse Performance Audit` en `success` : le container PREPROD démarre avec le service (premier démarrage réel de la composition DI hors test).

---

### Tâche 8 : rang sans score et badge de provenance (PR-E)

Les cartes d'hypothèses affichent aujourd'hui un score `/100`, une barre de progression et, pour la première, une grille de sous-scores. Elles montrent désormais le rang seul et, quand la provenance a été lue (`provenance_summary.status === "available"`), un badge à trois libellés. Pas de badge sans résumé (drapeau OFF, session enregistrée) ni avec un résumé `unavailable`. La page de résultats transmet le résumé du pack aux cartes.

**Files:**
- Modify: `frontend/app/components/diagnostic-wizard/types.ts` (`ProvenanceState`, `HypothesisProvenance`, `ProvenanceSummary`, `Hypothesis.provenance?`, `EvidencePack.provenance_summary?` ; retrait de `ScoringBreakdown`)
- Modify: `frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx`
- Modify: `frontend/app/components/diagnostic-wizard/results/DiagnosticResults.tsx`
- Create: `frontend/tests/unit/diagnostic-hypothesis-provenance.test.tsx`

**Interfaces:**
- Consumes : champs `provenance: {state}` des hypothèses et `provenance_summary` du pack, servis par PR-D (absents tant qu'EXPOSE est OFF) ; `Badge` de `~/components/ui/badge`.
- Produces : prop `provenanceSummary?: ProvenanceSummary` de `ResultHypotheses` ; libellés `sourced` « Relation documentée (sources techniques archivées) », `partial` « Relation partiellement documentée », `unsourced` « Relation non encore documentée — à confirmer par un contrôle ».

- [ ] **Étape 1 : préconditions**

```bash
gh pr view 1592 --repo ak125/nestjs-remix-monorepo --json state -q .state
gh api -H 'Accept: application/vnd.github.raw' 'repos/ak125/governance-vault/contents/ledger/decisions/adr/ADR-035-diagnostic-tool-source-trust-flag.md?ref=main' \
  | awk 'NR==1 && /^---$/ {f=1; next} f && /^---$/ {exit} f' | grep -E '^(status|superseded_by):'
```

Attendu : `MERGED` ; `status: accepted` et `superseded_by: []` (au 2026-10-01 : `status: proposed`). Sinon s'arrêter.

- [ ] **Étape 2 : créer le worktree et mesurer la référence**

```bash
git -C /opt/automecanik/app fetch origin
git -C /opt/automecanik/app worktree add -b feat/diag-provenance-ui /opt/automecanik/app/.claude/worktrees/diag-provenance-ui origin/main
cd /opt/automecanik/app/.claude/worktrees/diag-provenance-ui
ln -s /opt/automecanik/app/node_modules node_modules
ln -s /opt/automecanik/app/frontend/node_modules frontend/node_modules
git status --porcelain
(cd frontend && npx vitest run --root . 2>&1 | grep -E '^ *(Test Files|Tests) ' | tee "$SCRATCH/p3-fe-ref.txt")
```

Attendu : `git status` vide ; référence sans échec (`Test Files  F passed (F)`, `Tests  T passed (T)` ; 94 / 918 au 2026-10-01). Vitest se lance seul, jamais en parallèle d'une autre suite.

- [ ] **Étape 3 : écrire le test qui échoue**

Créer `frontend/tests/unit/diagnostic-hypothesis-provenance.test.tsx` avec exactement ce contenu :

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiagnosticResults } from "~/components/diagnostic-wizard/results/DiagnosticResults";
import { ResultHypotheses } from "~/components/diagnostic-wizard/results/ResultHypotheses";
import {
  type EvidencePack,
  type Hypothesis,
  type ProvenanceState,
  type ProvenanceSummary,
  type WizardState,
} from "~/components/diagnostic-wizard/types";

afterEach(cleanup);

const LABELS: Record<ProvenanceState, string> = {
  sourced: "Relation documentée (sources techniques archivées)",
  partial: "Relation partiellement documentée",
  unsourced: "Relation non encore documentée — à confirmer par un contrôle",
};

const hypothesis = (
  id: string,
  score: number,
  state?: ProvenanceState,
): Hypothesis => ({
  hypothesis_id: id,
  label: `Cause ${id}`,
  cause_type: "wear",
  relative_score: score,
  urgency: "moyenne",
  evidence_for: ["Symptôme déclaré"],
  evidence_against: [],
  requires_verification: true,
  ...(state ? { provenance: { state } } : {}),
});

const HYPOTHESES = [
  hypothesis("a", 73, "sourced"),
  hypothesis("b", 58, "partial"),
  hypothesis("c", 41, "unsourced"),
];
const AVAILABLE: ProvenanceSummary = {
  status: "available",
  counts: { sourced: 1, partial: 1, unsourced: 1 },
};

const badges = () =>
  Object.values(LABELS).filter((label) => screen.queryByText(label));

describe("hypothesis cards", () => {
  it("show the rank and no score, in any form", () => {
    const { container } = render(
      <ResultHypotheses
        hypotheses={HYPOTHESES}
        provenanceSummary={AVAILABLE}
      />,
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\/100/);
    for (const score of ["73", "58", "41"]) expect(text).not.toContain(score);
    // Neither the progress bar nor the sub-score grid of the first card.
    expect(container.querySelector("[style*='width']")).toBeNull();
    expect(screen.queryByText("Plausibilité")).toBeNull();
  });

  it("label each hypothesis with its provenance when it was read", () => {
    render(
      <ResultHypotheses
        hypotheses={HYPOTHESES}
        provenanceSummary={AVAILABLE}
      />,
    );
    for (const label of Object.values(LABELS)) {
      expect(screen.getAllByText(label)).toHaveLength(1);
    }
  });

  it.each([
    ["no summary (flag OFF, stored session)", undefined],
    ["an unavailable provenance", { status: "unavailable" } as const],
  ])("show no provenance badge with %s", (_name, summary) => {
    render(
      <ResultHypotheses hypotheses={HYPOTHESES} provenanceSummary={summary} />,
    );
    expect(badges()).toEqual([]);
  });

  it("receive the summary of the evidence pack from the results page", () => {
    const evidence: EvidencePack = {
      factual_inputs_confirmed: [],
      factual_inputs_missing: [],
      system_suspects: [],
      candidate_hypotheses: HYPOTHESES,
      maintenance_links: [],
      risk_flags: [],
      catalog_guard: {
        ready_for_catalog: false,
        confidence_before_purchase: "low",
        allowed_output_mode: "none",
        reason: "Test",
        suggested_gammes: [],
      },
      allowed_claims: [],
      ui_block_inputs: {},
      provenance_summary: AVAILABLE,
    };
    const state: WizardState = {
      step: 3,
      vehicle: { brand: "Test", model: "Test" },
      systemScope: "electricite",
      symptomSlugs: [],
      result: { success: true, evidence_pack: evidence },
      loading: false,
      error: null,
    };
    render(<DiagnosticResults state={state} dispatch={vi.fn()} />);
    expect(badges()).toEqual(Object.values(LABELS));
  });
});
```

- [ ] **Étape 4 : vérifier l'échec**

Run : `(cd frontend && npx vitest run --root . tests/unit/diagnostic-hypothesis-provenance.test.tsx)`
Attendu : 3 tests rouges (`show the rank and no score, in any form`, `label each hypothesis with its provenance when it was read`, `receive the summary of the evidence pack from the results page`) et 2 verts (les deux cas `show no provenance badge with …`, vrais aujourd'hui).

- [ ] **Étape 5 : implémenter**

Écrire ce diff dans `$SCRATCH/fe-types.diff`, puis `git apply "$SCRATCH/fe-types.diff"` :

```diff
diff --git a/frontend/app/components/diagnostic-wizard/types.ts b/frontend/app/components/diagnostic-wizard/types.ts
index b4446ba00..60541bd64 100644
--- a/frontend/app/components/diagnostic-wizard/types.ts
+++ b/frontend/app/components/diagnostic-wizard/types.ts
@@ -50,15 +50,22 @@ export type WizardAction =
 
 // ── API Response types (from backend EvidencePack) ──
 
-export interface ScoringBreakdown {
-  signal_match: number;
-  vehicle_fit: number;
-  lifecycle_fit: number;
-  maintenance_history: number;
-  plausibility: number;
-  context: number;
+/**
+ * What the WIKI documents behind a hypothesis: sourced = every symptom → cause
+ * link has a validated fiche, partial = some, unsourced = none. The pack also
+ * lists the links and fiches; the results page shows the state only.
+ */
+export type ProvenanceState = "sourced" | "partial" | "unsourced";
+
+export interface HypothesisProvenance {
+  state: ProvenanceState;
 }
 
+/** unavailable = the provenance could not be read: no state is shown. */
+export type ProvenanceSummary =
+  | { status: "available"; counts: Record<ProvenanceState, number> }
+  | { status: "unavailable" };
+
 export interface Hypothesis {
   hypothesis_id: string;
   label: string;
@@ -70,7 +77,8 @@ export interface Hypothesis {
   verification_method?: string;
   requires_verification: boolean;
   related_gamme_slugs?: string[];
-  scoring_breakdown?: ScoringBreakdown;
+  /** Absent when the provenance is not exposed or could not be read. */
+  provenance?: HypothesisProvenance;
 }
 
 export interface SuggestedGamme {
@@ -121,6 +129,8 @@ export interface EvidencePack {
   allowed_claims: string[];
   signal_quality?: string;
   ui_block_inputs: Record<string, unknown>;
+  /** Absent when the provenance is not exposed (flag OFF) or on older sessions. */
+  provenance_summary?: ProvenanceSummary;
 }
 
 export interface DiagnosticApiResponse {
```

Écrire ce diff dans `$SCRATCH/fe-hypotheses.diff`, puis `git apply "$SCRATCH/fe-hypotheses.diff"` :

```diff
diff --git a/frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx b/frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx
index 8a611ec3c..9c220ca5d 100644
--- a/frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx
+++ b/frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx
@@ -1,5 +1,9 @@
 /**
- * ResultHypotheses — Block 3: Scored hypotheses with evidence
+ * ResultHypotheses — Block 3: ranked hypotheses with evidence
+ *
+ * No score is shown (INC-2026-013): the rank orders the causes, and a neutral
+ * badge says what the WIKI documents behind each one — only when the
+ * provenance was read, never a guessed state.
  */
 import {
   ChevronDown,
@@ -12,11 +16,15 @@ import {
 import { useState } from "react";
 import { Badge } from "~/components/ui/badge";
 import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
-import { Progress } from "~/components/ui/progress";
-import { type Hypothesis } from "../types";
+import {
+  type Hypothesis,
+  type ProvenanceState,
+  type ProvenanceSummary,
+} from "../types";
 
 interface Props {
   hypotheses: Hypothesis[];
+  provenanceSummary?: ProvenanceSummary;
 }
 
 const URGENCY_BADGE: Record<Hypothesis["urgency"], string> = {
@@ -26,24 +34,18 @@ const URGENCY_BADGE: Record<Hypothesis["urgency"], string> = {
   basse: "bg-green-100 text-green-700 border-green-200",
 };
 
-const SCORE_COLOR = (score: number) => {
-  if (score >= 70) return "text-red-600";
-  if (score >= 45) return "text-orange-600";
-  if (score >= 25) return "text-amber-600";
-  return "text-gray-500";
-};
-
-const PROGRESS_COLOR = (score: number) => {
-  if (score >= 70) return "[&>div]:bg-red-500";
-  if (score >= 45) return "[&>div]:bg-orange-500";
-  if (score >= 25) return "[&>div]:bg-amber-500";
-  return "[&>div]:bg-gray-400";
+const PROVENANCE_LABEL: Record<ProvenanceState, string> = {
+  sourced: "Relation documentée (sources techniques archivées)",
+  partial: "Relation partiellement documentée",
+  unsourced: "Relation non encore documentée — à confirmer par un contrôle",
 };
 
-export function ResultHypotheses({ hypotheses }: Props) {
+export function ResultHypotheses({ hypotheses, provenanceSummary }: Props) {
   const [expandedId, setExpandedId] = useState<string | null>(
     hypotheses[0]?.hypothesis_id || null,
   );
+  // No badge rather than a false one: flag OFF, older session, unreadable.
+  const showProvenance = provenanceSummary?.status === "available";
 
   return (
     <Card>
@@ -82,7 +84,7 @@ export function ResultHypotheses({ hypotheses }: Props) {
                   {i + 1}
                 </span>
 
-                {/* Label + score */}
+                {/* Label + provenance */}
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 flex-wrap">
                     <span className="font-medium text-sm text-gray-900 truncate">
@@ -97,17 +99,15 @@ export function ResultHypotheses({ hypotheses }: Props) {
                       {h.urgency}
                     </Badge>
                   </div>
-                  <div className="flex items-center gap-2 mt-1">
-                    <Progress
-                      value={h.relative_score}
-                      className={`h-1.5 flex-1 max-w-[120px] ${PROGRESS_COLOR(h.relative_score)}`}
-                    />
-                    <span
-                      className={`text-xs font-semibold ${SCORE_COLOR(h.relative_score)}`}
+                  {showProvenance && h.provenance && (
+                    <Badge
+                      variant="outline"
+                      size="xs"
+                      className="mt-1 font-normal text-gray-600"
                     >
-                      {h.relative_score}/100
-                    </span>
-                  </div>
+                      {PROVENANCE_LABEL[h.provenance.state]}
+                    </Badge>
+                  )}
                 </div>
 
                 {expanded ? (
@@ -120,25 +120,6 @@ export function ResultHypotheses({ hypotheses }: Props) {
               {/* Expanded details */}
               {expanded && (
                 <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3 ml-10">
-                  {/* Scoring breakdown */}
-                  {h.scoring_breakdown && (
-                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
-                      {Object.entries(h.scoring_breakdown).map(([key, val]) => (
-                        <div
-                          key={key}
-                          className="text-center p-1.5 rounded bg-gray-50"
-                        >
-                          <p className="text-[10px] text-gray-500 uppercase">
-                            {SCORE_LABELS[key] || key}
-                          </p>
-                          <p className="text-sm font-semibold text-gray-900">
-                            {val as number}
-                          </p>
-                        </div>
-                      ))}
-                    </div>
-                  )}
-
                   {/* Evidence for */}
                   {h.evidence_for.length > 0 && (
                     <div className="space-y-1">
@@ -202,12 +183,3 @@ export function ResultHypotheses({ hypotheses }: Props) {
     </Card>
   );
 }
-
-const SCORE_LABELS: Record<string, string> = {
-  signal_match: "Signal",
-  vehicle_fit: "Véhicule",
-  lifecycle_fit: "Cycle vie",
-  maintenance_history: "Entretien",
-  plausibility: "Plausibilité",
-  context: "Contexte",
-};
```

Écrire ce diff dans `$SCRATCH/fe-results.diff`, puis `git apply "$SCRATCH/fe-results.diff"` :

```diff
diff --git a/frontend/app/components/diagnostic-wizard/results/DiagnosticResults.tsx b/frontend/app/components/diagnostic-wizard/results/DiagnosticResults.tsx
index ed4607dcd..fbf0a87a4 100644
--- a/frontend/app/components/diagnostic-wizard/results/DiagnosticResults.tsx
+++ b/frontend/app/components/diagnostic-wizard/results/DiagnosticResults.tsx
@@ -153,7 +153,10 @@ export function DiagnosticResults({
 
       {/* Block 3: Hypotheses */}
       {ep.candidate_hypotheses.length > 0 && (
-        <ResultHypotheses hypotheses={ep.candidate_hypotheses} />
+        <ResultHypotheses
+          hypotheses={ep.candidate_hypotheses}
+          provenanceSummary={ep.provenance_summary}
+        />
       )}
 
       {/* ADR-031: historical rag_facts are not diagnostic evidence. */}
```

- [ ] **Étape 6 : vérifier que tout passe**

```bash
(cd frontend && npx vitest run --root . tests/unit/diagnostic-hypothesis-provenance.test.tsx 2>&1 | grep -E '^ *Tests ')
(cd frontend && npx vitest run --root . 2>&1 | grep -E '^ *(Test Files|Tests) ')
```

Attendu : `Tests  5 passed (5)` ; suite complète sans échec, référence + 1 fichier et + 5 tests (95 / 923 au 2026-10-01).

- [ ] **Étape 7 : mutants frontend**

Run : `python3 "$SCRATCH/mut_p3.py" frontend; git status --porcelain` (depuis la racine du worktree)
Attendu : 2 lignes `KILLED` (`badge-shown-when-unavailable`, `summary-not-passed-to-cards`), `survivors: []`, puis `git status --porcelain` ne montre que les 3 fichiers modifiés et le test non suivi.

- [ ] **Étape 8 : contrôles**

```bash
(cd frontend && npx react-router typegen && NODE_OPTIONS='--max-old-space-size=4096' npx tsc && echo TSC_OK)
FE='app/components/diagnostic-wizard/types.ts app/components/diagnostic-wizard/results/ResultHypotheses.tsx app/components/diagnostic-wizard/results/DiagnosticResults.tsx tests/unit/diagnostic-hypothesis-provenance.test.tsx'
(cd frontend && ESLINT_USE_FLAT_CONFIG=true npx eslint $FE && echo ESLINT_OK)
node_modules/.bin/prettier --check $(printf 'frontend/%s ' $FE) && echo PRETTIER_OK
git status --porcelain
```

Attendu : `TSC_OK`, `ESLINT_OK`, `PRETTIER_OK` ; `status` inchangé (les types générés par `react-router typegen` sont ignorés).

- [ ] **Étape 9 : commit**

```bash
git add frontend/app/components/diagnostic-wizard/types.ts \
  frontend/app/components/diagnostic-wizard/results/ResultHypotheses.tsx \
  frontend/app/components/diagnostic-wizard/results/DiagnosticResults.tsx \
  frontend/tests/unit/diagnostic-hypothesis-provenance.test.tsx
git commit -F - <<'EOF'
feat(diagnostic-ui): rang sans score et badge de provenance WIKI des hypothèses

Les cartes n'affichent plus de score (ni /100, ni barre, ni sous-scores) : le
rang seul. Quand la provenance a été lue, un badge dit si la relation est
documentée, partiellement documentée ou à confirmer par un contrôle ; aucun
badge sans résumé (drapeau OFF, session enregistrée) ni si elle est illisible.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Étape 10 : gate de propriété**

Run : `node scripts/registry/check-new-files.js --base origin/main; echo "exit=$?"`
Attendu : `new files: 1 (1 ok, 0 failures)`, `✓ All new files pass owner+domain gate`, `exit=0`.

- [ ] **Étape 11 : PR-E (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin feat/diag-provenance-ui
gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/diag-provenance-ui \
  --title "feat(diagnostic-ui): rang sans score et badge de provenance WIKI" \
  --body-file - <<'EOF'
## Quoi
Cartes d'hypothèses du diagnostic : le rang seul, plus aucun score (ni `/100`, ni barre, ni
grille de sous-scores). Badge de provenance quand le pack la porte et qu'elle a été lue :
« Relation documentée (sources techniques archivées) », « Relation partiellement documentée »,
« Relation non encore documentée — à confirmer par un contrôle ». Aucun badge sans résumé
(drapeau OFF, session enregistrée) ni avec une provenance illisible.

Aucune URL, meta, H1 ni JSON-LD touché ; `diagnostic-auto.$slug.tsx` hors périmètre.

## Preuve
- `tests/unit/diagnostic-hypothesis-provenance.test.tsx` : 5 tests (aucun score sous aucune forme,
  3 libellés, aucun badge sans résumé ou illisible, résumé transmis par la page de résultats) ;
- 2 mutants tués ; tsc, ESLint, Prettier verts ; suite Vitest complète verte.

## Après fusion
Au tag qui l'embarque, le rang remplace le score. Le badge n'apparaît qu'avec EXPOSE ON en PROD.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr checks feat/diag-provenance-ui --repo ak125/nestjs-remix-monorepo --watch
```

Si « Registry freshness » échoue, appliquer le patch de l'artefact `registry-recovery-<run_id>` sans l'éditer, comme à l'Étape 11 de la Tâche 1, en remplaçant la branche par `feat/diag-provenance-ui`, puis commiter (`chore(registry): régénérer les projections après le badge de provenance`, même trailer) et pousser après confirmation.

- [ ] **Étape 12 : preuve après fusion humaine**

```bash
SHA=$(gh pr view feat/diag-provenance-ui --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --commit "$SHA" --event push --json databaseId -q '.[0].databaseId')
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
```

Attendu : run présent et vert, jobs `🧪 Deploy PREPROD`, `🎭 E2E Smoke Tests` et `🔦 Lighthouse Performance Audit` en `success`.

---

### Tâche 9 : activation PROD (GO owner nominatif à chaque étape)

Chaque étape change un drapeau PROD par une variable GitHub, puis un tag `v*` redéploie avec le `.env` réécrit par le script de la Tâche 1. Aucun SSH : la preuve se lit dans le log de `deploy-prod.yml`, dans la base partagée (lecture seule) et sur l'endpoint de métriques. L'opérateur exporte `PROD_ORIGIN` (origine publique du site) dans son shell ; elle n'est écrite dans aucun fichier. Un tag ne vise que le dernier commit de `main` dont le run `ci.yml` (push) a ses trois jobs PREPROD, E2E et Lighthouse verts : `deploy-prod.yml` refuse les autres.

**Files:** aucun.

**Interfaces:**
- Consumes : PR-C, PR-B, PR-D, PR-E fusionnées ; migration du Plan 2 appliquée ; export `exports/diagnostic/` dans le pin du sous-module et dans l'image (Plan 1).
- Produces : runs nocturnes de projection en PROD ; série `diagnostic_provenance_evaluated_total` ; badge de provenance servi.

- [ ] **Étape 1 : choisir le commit à taguer (fonction réutilisée aux Étapes 3 à 6)**

```bash
cat > "$SCRATCH/pin-sha.sh" <<'EOF'
# pin_sha <merge-sha requis>... : imprime le SHA de origin/main s'il est taguable, sinon échoue.
pin_sha() {
  local repo=ak125/nestjs-remix-monorepo sha run ok req
  git -C /opt/automecanik/app fetch -q origin --tags || return 1
  sha=$(git -C /opt/automecanik/app rev-parse origin/main) || return 1
  for req in "$@"; do
    git -C /opt/automecanik/app merge-base --is-ancestor "$req" "$sha" || { echo "absent de main : $req" >&2; return 1; }
  done
  run=$(gh run list --repo "$repo" --workflow ci.yml --commit "$sha" --event push --json databaseId -q '.[0].databaseId')
  test -n "$run" || { echo "aucun run ci.yml push pour $sha (fusion Dependabot ?) : attendre le prochain merge" >&2; return 1; }
  ok=$(gh run view "$run" --repo "$repo" --json jobs -q '[.jobs[] | select(.name | test("Deploy PREPROD|E2E Smoke|Lighthouse")) | select(.conclusion == "success")] | length')
  test "$ok" = 3 || { echo "jobs PREPROD / E2E / Lighthouse non verts pour $sha (run $run)" >&2; return 1; }
  echo "tags déjà sur $sha : $(git -C /opt/automecanik/app tag --points-at "$sha" | tr '\n' ' ')" >&2
  echo "$sha"
}
EOF
. "$SCRATCH/pin-sha.sh"
```

Attendu : aucune sortie. Usage : `SHA=$(pin_sha <merge-sha>...) && echo "SHA=$SHA"`. Si un tag pointe déjà sur ce SHA (une autre session a pu taguer), le signaler à l'owner avant de taguer à nouveau : un nouveau tag sur le même SHA redéploie avec les variables du moment. Nom de tag : `v<AAAA.MM.JJ>-diag-provenance-<étape>-<sha7>`.

- [ ] **Étape 2 : préconditions (lecture seule)**

```bash
gh api -H 'Accept: application/vnd.github.raw' 'repos/ak125/governance-vault/contents/ledger/decisions/adr/ADR-035-diagnostic-tool-source-trust-flag.md?ref=main' \
  | awk 'NR==1 && /^---$/ {f=1; next} f && /^---$/ {exit} f' | grep -E '^(status|superseded_by):'
test -x "$SWEEP" || { echo "SWEEP absent : s'arrêter"; false; }
"$SWEEP" -c "SELECT status FROM infra.schema_migrations WHERE id = '20261001_diag_link_provenance';"
gh pr view fix/activation-guard-push-base --repo ak125/automecanik-wiki --json state -q .state
gh api repos/ak125/automecanik-wiki/branches/main --jq .protected
PIN=$(git -C /opt/automecanik/app rev-parse origin/main:backend/content/automecanik-wiki)
gh api "repos/ak125/automecanik-wiki/contents/exports/diagnostic/_index.json?ref=$PIN" --jq .path
git -C /opt/automecanik/app show origin/main:Dockerfile | grep -c 'exports/diagnostic'
gh variable list --repo ak125/nestjs-remix-monorepo | grep '^PROD_DIAGNOSTIC_' || echo NO_DIAG_VARS
```

Attendu : `status: accepted`, `superseded_by: []` ; `applied` ; `MERGED` ; `true` ; `exports/diagnostic/_index.json` ; un nombre ≥ 1 ; `NO_DIAG_VARS`. Au 2026-10-01 : `status: proposed`, garde du WIKI non réparée, `main` du WIKI non protégée — aucune étape suivante n'est possible avant.

- [ ] **Étape 3 : projection ON (GO owner nominatif, puis confirmation explicite de l'utilisateur)**

```bash
SHA_B=$(gh pr view feat/diag-provenance-writer --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
SHA_C=$(gh pr view feat/diag-provenance-prod-env --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
SHA=$(pin_sha "$SHA_B" "$SHA_C") && echo "SHA=$SHA"
gh variable set PROD_DIAGNOSTIC_PROJECTION_ENABLED --repo ak125/nestjs-remix-monorepo --body true
TAG="v$(date -u +%Y.%m.%d)-diag-provenance-projection-${SHA:0:7}"
git -C /opt/automecanik/app tag "$TAG" "$SHA" && git -C /opt/automecanik/app push origin "$TAG"
RUN=; for _ in $(seq 1 30); do
  RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow deploy-prod.yml --branch "$TAG" --limit 1 --json databaseId -q '.[0].databaseId')
  test -n "$RUN" && break; sleep 10
done
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
gh run view "$RUN" --repo ak125/nestjs-remix-monorepo --log | grep -A3 'Diagnostic provenance flags written'
```

Attendu : run vert ; log `✅ Diagnostic provenance flags written to .env:`, puis `DIAGNOSTIC_PROJECTION_ENABLED=true`, `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED=false`, `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED=false`. Si le run échoue avant le point de non-retour, le container PROD n'a pas bougé : lire le message `::error::`, corriger la variable, retaguer.

Le lendemain, après 02:00 UTC :

```bash
"$SWEEP" -c "SELECT id, triggered_by, runtime_env, status, exported_count, projected_count, conflict_count, retired_count, error FROM public.__diag_projection_runs WHERE runtime_env = 'production' ORDER BY id DESC LIMIT 1;"
"$SWEEP" -c "SELECT count(*) AS live, count(*) FILTER (WHERE diagnostic_safe) AS safe FROM public.__diag_link_provenance WHERE retired_at IS NULL;"
```

Attendu à l'état du canon `6e3a043` : `repeatable | production | applied | 3 | 0 | 3 | 0 |` (erreur vide), puis `0 | 0`. Si le canon a bougé : `exported_count` = somme des `relation_count` de `_index.json` du pin, et `exported_count = projected_count + conflict_count`. Un run `failed` : lire `error`, corriger la cause dans une PR, jamais dans la base. Aucun run : la variable ou le tag n'ont pas pris ; relire le log de l'étape précédente.

- [ ] **Étape 4 : EXPOSE ON (GO owner nominatif, puis confirmation explicite de l'utilisateur)**

Précondition : au moins un run `applied` en `production` (Étape 3).

```bash
SHA_D=$(gh pr view feat/diag-provenance-engine --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
SHA=$(pin_sha "$SHA_D") && echo "SHA=$SHA"
gh variable set PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED --repo ak125/nestjs-remix-monorepo --body true
TAG="v$(date -u +%Y.%m.%d)-diag-provenance-expose-${SHA:0:7}"
git -C /opt/automecanik/app tag "$TAG" "$SHA" && git -C /opt/automecanik/app push origin "$TAG"
RUN=; for _ in $(seq 1 30); do
  RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow deploy-prod.yml --branch "$TAG" --limit 1 --json databaseId -q '.[0].databaseId')
  test -n "$RUN" && break; sleep 10
done
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
gh run view "$RUN" --repo ak125/nestjs-remix-monorepo --log | grep -A3 'Diagnostic provenance flags written'
```

Attendu : run vert ; `DIAGNOSTIC_PROJECTION_ENABLED=true`, `DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED=true`, `DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED=false`.

Mesure, sur plusieurs jours (le compteur repart de zéro à chaque redémarrage du container) :

```bash
test -n "$PROD_ORIGIN" || { echo "exporter PROD_ORIGIN"; false; }
curl -fsS "$PROD_ORIGIN/api/observability/metrics" | grep '^diagnostic_provenance_evaluated_total'
"$SWEEP" -c "SELECT count(*) AS safe FROM public.__diag_link_provenance WHERE retired_at IS NULL AND diagnostic_safe;"
```

Attendu : des lignes `mode="expose",status="available",…` dès les premières analyses ; `status="unavailable"` à 0 (sinon lire les logs d'erreur `WIKI provenance unavailable` et corriger la cause avant toute suite) ; à l'état de lancement, `top_state="unsourced"` et `rank_changed="false"` partout, `safe = 0`.

- [ ] **Étape 5 : frontend (GO owner nominatif, puis confirmation explicite de l'utilisateur)**

PR-E part avec le premier tag qui la contient : ce tag peut être celui d'une autre release, ou un tag dédié.

```bash
SHA_E=$(gh pr view feat/diag-provenance-ui --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
git -C /opt/automecanik/app fetch -q origin --tags
git -C /opt/automecanik/app tag --contains "$SHA_E" 'v*' || true
```

Si aucun tag ne la contient encore et que l'owner donne son GO : `SHA=$(pin_sha "$SHA_E")`, tag `v<AAAA.MM.JJ>-diag-provenance-ui-<sha7>` poussé comme à l'Étape 3, run `deploy-prod.yml` suivi jusqu'au vert. Attendu côté client (contrôle par l'owner dans son navigateur) : les cartes du diagnostic montrent le rang sans score ; avec EXPOSE ON, chaque carte porte un des trois libellés.

- [ ] **Étape 6 : PRIMARY (seulement si `safe > 0`, GO owner nominatif, puis confirmation explicite de l'utilisateur)**

PRIMARY reste OFF tant que la requête `safe` de l'Étape 4 rend `0` : il pèserait alors 0 pour toutes les contributions. Quand `safe > 0` et que la série `rank_changed="true"` a été lue avec l'owner :

```bash
SHA=$(pin_sha) && echo "SHA=$SHA"
gh variable set PROD_DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED --repo ak125/nestjs-remix-monorepo --body true
TAG="v$(date -u +%Y.%m.%d)-diag-provenance-primary-${SHA:0:7}"
git -C /opt/automecanik/app tag "$TAG" "$SHA" && git -C /opt/automecanik/app push origin "$TAG"
RUN=; for _ in $(seq 1 30); do
  RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow deploy-prod.yml --branch "$TAG" --limit 1 --json databaseId -q '.[0].databaseId')
  test -n "$RUN" && break; sleep 10
done
test -n "$RUN" && gh run watch "$RUN" --repo ak125/nestjs-remix-monorepo --exit-status
gh run view "$RUN" --repo ak125/nestjs-remix-monorepo --log | grep -A3 'Diagnostic provenance flags written'
curl -fsS "$PROD_ORIGIN/api/observability/metrics" | grep '^diagnostic_provenance_evaluated_total' | grep 'mode="primary"'
```

Attendu : les trois clés à `true` ; des lignes `mode="primary"` dès les premières analyses.

- [ ] **Étape 7 : kill-switch (à tout moment)**

Coupure immédiate, volatile (jusqu'au prochain redémarrage), par l'API admin avec le cookie d'une session admin PROD de l'opérateur (`ADMIN_COOKIE='connect.sid=<valeur>'`, écrit nulle part) ; couper EXPOSE coupe aussi PRIMARY :

```bash
curl -fsS -X PATCH -H "Cookie: $ADMIN_COOKIE" -H 'Content-Type: application/json' \
  -d '{"value":"false"}' "$PROD_ORIGIN/api/admin/feature-flags/DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED"
```

Attendu : une réponse `"success":true` dont `data` vaut `{"key":"DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED","value":"false","volatile":true}` (enveloppe de `AdminResponseInterceptor`) ; la série du compteur cesse d'augmenter. Coupure durable : `gh variable delete PROD_DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED --repo ak125/nestjs-remix-monorepo` (idem pour `…_PRIMARY_…` et `…_PROJECTION_…`), puis un tag de redéploiement (le script réécrit `false`) ; une fois ce tag en PROD, retirer la surcharge par `curl -fsS -X DELETE -H "Cookie: $ADMIN_COOKIE" "$PROD_ORIGIN/api/admin/feature-flags/DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED"`. Frontend : revert de PR-E par PR, puis tag. Projection : drapeau OFF suffit ; le `.down.sql` du Plan 2 reste réservé à une décision de l'owner.

## Couverture spec → tâches

| Spec | Exigence | Tâche |
|---|---|---|
| §4.6 | Fusion multi-symptômes : `contributions[]` conservées, `relative_score` fusionné inchangé, provenance lue pour tous les liens contributeurs | 2 |
| §4.6 | Lecture à compte exact des lignes vivantes ; lève sur erreur, compte inexact ou absent, ligne invalide, doublon lien / fiche, lien non demandé | 2 |
| §4.6 | Pack : `provenance` par hypothèse, `provenance_summary`, `superRefine` de cohérence, champs optionnels (sessions historiques) | 3 |
| §4.6 | Drapeaux EXPOSE / PRIMARY OFF par défaut ; PRIMARY binaire sur `diagnostic_safe` ; `unavailable`, jamais `unsourced` ; PRIMARY sans EXPOSE ignoré, avertissement une fois par processus | 4 |
| §4.6 | Branchement : 8ᵉ paramètre, `rank(links, score)`, tout l'aval lit `rank`, risque identique drapeaux ON / OFF, sites `new DiagnosticEngineOrchestrator(` | 5 |
| §4.6 | Télémétrie : événement → `diagnostic_provenance_evaluated_total`, labels bornés (`none` / `unknown`) | 6 |
| §4.7 | Rang sans score, retrait de `ScoringBreakdown`, 3 libellés de badge, aucun badge sans résumé ou `unavailable`, résumé transmis par `DiagnosticResults.tsx` | 8 |
| §4.7 | Aucun `part_role` : absent par construction (5 colonnes lues, `WikiRefSchema` à 4 champs) | 2, 3 |
| §4.8 | Script PROD à 3 drapeaux : `vars.*` seules, refus octet-identiques, PRIMARY sans EXPOSE refusé, exemption `SC1090` citée, insertions seules dans `deploy-prod.yml` | 1 |
| §4.8 | `ALLOWED_KEYS` des 2 drapeaux ; avertissement au boot par `onModuleInit` synchrone (ast-grep `backend-no-remote-io-in-onmoduleinit`) | 4 |
| §6 | Lecture échouée (avec et sans PRIMARY), PRIMARY sans EXPOSE, variable PROD mal orthographiée, backend `anon`, session historique | 1, 3, 4, 5, 8 |
| §7 | Script : 36 tests, 3 mutants ; backend : 46 tests (5 suites), 11 mutants ; frontend : 5 tests, 2 mutants | 1, 2-7, 8 |
| §7 | E2E : le container PREPROD (`anon`) ne couvre que l'état « aucun badge » ; jobs PREPROD, E2E et Lighthouse verts après fusion | 7, 8 (Après fusion) |
| §8 étapes 2 (partie PROD) à 5 | Variables GitHub et tags `v*`, GO owner nominatif par étape, préconditions d'EXPOSE, rollback par drapeau | 9 |
| §9 étape 7 | PR-C (script, dans un tag avant toute activation) ; PR-D empilée après #1607, #1624, #1626, #1608, #1618 et PR-A, PR-B | 1, 2-7 |
| §9 étape 8 | PR-E après #1592 et l'acceptation d'ADR-035 | 8 |
| §10 | Aucune hypothèse `unsourced` sur lecture échouée ; provenance de chaque lien contributeur ; plus aucun score affiché | 2, 4, 5, 8 |
| §4.1-§4.5, §4.8 (ratchet des sinks, registre L2), §4.9, §8 étapes 1 et 2 (DEV:3000), §9 étapes 1 à 6 | Export, garde, DB, writer, registres, révision d'ADR-035 | Plans 1 et 2 |
