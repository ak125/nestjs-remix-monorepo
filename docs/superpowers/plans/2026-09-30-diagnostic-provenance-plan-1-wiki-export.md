# Provenance diagnostic — Plan 1 : export WIKI `exports/diagnostic/` et transport vers l'image

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** publier sur `main` du WIKI une vue dérivée déterministe `exports/diagnostic/` des `diagnostic_relations` des fiches approuvées (sources résolues, prédicat `raw_proven` G1), puis l'embarquer dans l'image Docker du monorepo — sans aucune écriture DB.

**Architecture:** un builder Python du WIKI (filtre + transformation, 0 LLM, 0 DB) écrit un export par gamme et un index haché ; un schéma draft 2020-12 le contraint par `$ref` vers les deux schémas canoniques, sans rien recopier. Un workflow nocturne du monorepo, calqué sur `wiki-exports-seo-generate.yml`, régénère les exports et les pousse sur `main` du WIKI ; le pin du sous-module suit par Dependabot (fusion humaine) ; le `Dockerfile` copie `exports/diagnostic` à côté d'`exports/seo`. La garde d'activation du WIKI est corrigée d'abord, parce qu'elle est aujourd'hui vacante sur push.

**Tech Stack:** Python 3.12, click 8, PyYAML 6, jsonschema ≥ 4.18 (`referencing`), pytest ; ajv-cli 5 + ajv-formats (draft 2020-12) ; GitHub Actions (actionlint) ; Dockerfile multi-stage.

**Spec:** `docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md` — §4.2 (contrat d'export, transport), §4.3 (garde d'activation), §4.8 (registre), §7 (tests), §9 étapes 2 (partie pipeline), 3 et 4.

**Plans frères :** Plan 2 — DB + writer (`2026-09-30-diagnostic-provenance-plan-2-db-writer.md`), qui consomme ce que produisent les tâches 4 et 5 ; Plan 3 — moteur + frontend (`2026-09-30-diagnostic-provenance-plan-3-engine.md`), différé. Le plan `2026-09-26-diagnostic-integrity.md` (moteur actuel) est indépendant et n'est pas modifié.

**Résultat attendu au lancement** (canon WIKI `6e3a043`) : 3 exports (`filtre-a-air`, `filtre-a-carburant`, `filtre-d-habitacle`), toutes leurs sources en `raw_proven: false`. Côté DB (Plan 2) : 0 relation projetée, 3 conflits `source_not_raw_proven`. Ce n'est pas un échec : c'est l'état réel de la preuve RAW, rendu visible.

## Global Constraints

- Aucune fiche `wiki/**` n'est modifiée. Le builder lit `wiki/gamme/*.md` et `_meta/source-catalog.yaml`, et n'écrit que sous `exports/diagnostic/` (refus codé et testé).
- Builder : 0 LLM, 0 DB, 0 réseau, 0 enrichissement. Aucun horodatage ni HEAD dans les octets produits : `source_wiki_commit` = `git log -1 -- <fiche>`, `source_catalog_commit` = `git log -1 -- _meta/source-catalog.yaml`.
- Formats : hash `sha256:<64 hex minuscules>` ; commit = 40 hex minuscules ; JSON `indent=2`, `ensure_ascii=False`, newline final.
- `raw_proven` = prédicat G1 `gen_coverage_map.is_page_proven` (status `active` ET `raw_ref.manifest_id`), calculé par le builder seul ; tout consommateur le recopie et ne le recalcule jamais.
- Catalogue strict : `status` explicite, slug unique, suffixe `_pNN` normalisé, slug inconnu = échec ; le `slug` du frontmatter doit égaler le nom du fichier.
- Export sans fiche éligible = `UNRECONCILED` : conservé, rien n'est écrit, exit 1. Le retrait est une PR WIKI qui supprime l'export.
- Le bot `automecanik-bot` (secret existant `WIKI_REPO_TOKEN`) est l'unique writer de `exports/diagnostic/`. Aucun nouveau secret, aucun accès au dépôt RAW.
- Checkout principal WIKI `/opt/automecanik/automecanik-wiki` : lecture seule (`fetch`, `ls-tree`, `show`, `worktree add`). Travail WIKI dans `/opt/automecanik/automecanik-wiki-wt-<nom>` ; travail monorepo dans `/opt/automecanik/app/.claude/worktrees/<nom>` ; le checkout principal monorepo reste sur `main`.
- `.spec/00-canon/**` est réservé à l'owner : la Tâche 6 fournit des diffs vérifiés, elle ne les commite pas.
- Toute action sortante (push, PR, commentaire, `workflow_dispatch`, réglage GitHub) attend une confirmation explicite de l'utilisateur. L'agent ne fusionne rien.
- Commits : trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Corps de PR : dernière ligne `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Dépôts publics : la prose de PR ne décrit aucun secret.
- Vocabulaire : une fusion sur `main` du monorepo produit le tag `:preprod` et redéploie le container PREPROD, rien de plus. PROD = tag `v*`, hors de ce plan.
- Interdits : `git stash` nu, `--force`, `--no-verify`, rebase automatique dans un workflow, édition à la main d'un fichier sous `exports/diagnostic/`.

## Préparation (une fois par session, depuis n'importe quel répertoire)

- [ ] Créer le venv et ajv dans un répertoire de travail hors dépôt. Le venv reçoit exactement les dépendances du job CI de la Tâche 3, plus actionlint. N'utiliser ni le `ajv` global de la machine (il n'a pas `ajv-formats`) ni le checkout principal du WIKI.

```bash
export SCRATCH="${SCRATCH:-$(mktemp -d)}"
test -x "$SCRATCH/venv/bin/python" || {
  python3 -m venv "$SCRATCH/venv"
  "$SCRATCH/venv/bin/pip" install -q "click>=8.1,<9" "pyyaml>=6.0,<7" "jsonschema>=4.20,<5" "pytest>=7.4,<9" actionlint-py
}
test -x "$SCRATCH/ajv/node_modules/.bin/ajv" || npm install --prefix "$SCRATCH/ajv" --silent ajv-cli@5 ajv-formats
export PATH="$SCRATCH/venv/bin:$SCRATCH/ajv/node_modules/.bin:$PATH"
python3 -c "import click, yaml, jsonschema, referencing, pytest" && actionlint -version >/dev/null && command -v ajv | grep -q "^$SCRATCH/" && echo "ENV_OK SCRATCH=$SCRATCH"
```

Attendu : dernière ligne `ENV_OK SCRATCH=<chemin>`. Chaque tâche suppose `SCRATCH` et `PATH` exportés : dans une nouvelle session, relancer ce bloc avec `SCRATCH=<chemin>` pour réutiliser l'environnement.

## Review Focus

1. **Export publié dont la fiche perd son éligibilité** (dé-approbation, relations retirées) : un builder qui purge le supprimerait en silence. Attendu : export conservé, `UNRECONCILED`, run rouge. Tests : `test_export_without_eligible_fiche_is_preserved_and_fails` (Tâche 2), scénarios 3 et 4 de la simulation (Tâche 4).
2. **Push sur `main` du WIKI avec un `github.event.before` nul (création de branche) ou injoignable (force-push)** : attendu, garde en exit 2, jamais PASS. Tests : `test_main_fails_loud_on_null_push_base` et `test_main_fails_loud_on_unknown_full_sha_base` (Tâche 1).
3. **Ligne `COPY … exports/diagnostic` fusionnée avant que le pin du sous-module contienne `exports/diagnostic`** : le build Docker ne tourne que sur push `main`, donc rien ne l'attrape avant fusion et `:preprod` casse pour tout le monde. Attendu : la PR n'est ouverte qu'après la gate `ls-tree` (Tâche 5, Étape 1).
4. **Catalogue de sources modifié après la fiche** (une source passe `active` avec `raw_ref`) : attendu, `source_catalog_commit` change et l'export est régénéré. Tests : `test_commits_are_the_last_ones_touching_fiche_and_catalog` (Tâche 2), scénario 5 de la simulation (Tâche 4).
5. **Deux bots poussent sur `main` du WIKI dans la même minute** (02:00, 02:15, 02:30) : attendu, `git push` refusé en non fast-forward, run rouge, commit concurrent préservé, run suivant qui rattrape. Tests : scénario 5 de la simulation + mutation `--force` tuée (Tâche 4).

## Carte des fichiers

| Dépôt | Fichier | Tâche | Responsabilité |
|---|---|---|---|
| WIKI | `_scripts/check-activation-guard.py` | 1 | Base vérifiée avec `^{commit}` ; exit 2 sur base invalide |
| WIKI | `_scripts/tests/test_activation_guard.py` | 1 | 4 tests de `main()` sur un vrai dépôt git jetable |
| WIKI | `.github/workflows/wiki-quality-gates.yml` | 1, 3 | `GUARD_BASE` (T1) ; chemins `exports/diagnostic/**` + job `validate-exports-diagnostic` (T3) |
| WIKI | `_scripts/test_build_exports_diagnostic.py` | 2 | 42 tests du builder et du schéma |
| WIKI | `_meta/schema/exports-diagnostic.schema.json` | 2 | Contrat d'export v1.0.0 (`$ref` vers les schémas canoniques) |
| WIKI | `_scripts/build_exports_diagnostic.py` | 2 | Builder déterministe |
| Monorepo | `.github/workflows/wiki-exports-diagnostic-generate.yml` | 4 | Génération nocturne 02:30 UTC + commit bot sur `main` du WIKI |
| Monorepo | `Dockerfile` | 5 | Copie `exports/diagnostic` dans l'image |
| Monorepo (owner) | `.spec/00-canon/repository-registry/automation-reality.yaml` | 6 | Entrée `wiki-exports-diagnostic-generate` |
| Monorepo (owner) | `.spec/00-canon/repository-registry/pipelines.registry.json` | 6 | Entrée `wiki_to_exports_diagnostic` |

Aucun fichier `exports/diagnostic/**` n'est commité par une PR : seul le bot les écrit (Tâche 4). Les scripts de vérification (`sim_generate.py`) restent dans `$SCRATCH`, jamais dans un dépôt.

## Ordre et dépendances

```text
Tâche 1 (PR WIKI « garde »)              ─┐ fusion de préférence avant la Tâche 4 (non bloquant)
Tâche 2 → Tâche 3 (une seule PR WIKI)    ─┴→ fusion humaine
  → Tâche 4 (PR monorepo, workflow) → fusion humaine → workflow_dispatch → commit bot sur main du WIKI
  → bump Dependabot gitsubmodule → fusion humaine
  → Tâche 5 (PR monorepo, Dockerfile ; gate ls-tree avant tout)
Tâche 6 (diffs owner) : automation-reality après fusion de la Tâche 4 ; pipelines après fusion des Tâches 2 et 4.
```

La Tâche 1 est préférable avant la Tâche 4 : le premier commit bot déclenche `wiki-quality-gates` sur push, et c'est ce run qui prouve la garde corrigée sur un vrai push (`base=<sha>`).

---

### Tâche 1 : garde d'activation WIKI — comparer au commit d'avant le push

La garde compare aujourd'hui `origin/main` à HEAD. Sur un push `main`, les deux sont égaux : la comparaison est vide et la garde passe à tort (vacante par construction, cf. `.claude/rules/guardrails.md` passe 3). De plus `rev-parse --verify` accepte tout SHA complet bien formé sans vérifier que l'objet existe : le SHA nul d'un push passerait.

**Files:**
- Modify: `_scripts/check-activation-guard.py` (docstring d'usage l.16, `_load_base_entries` l.67)
- Modify: `_scripts/tests/test_activation_guard.py` (imports + 4 tests)
- Modify: `.github/workflows/wiki-quality-gates.yml` (step activation guard, commentaire et `run:` l.75-76)

**Interfaces:**
- Consumes : rien.
- Produces : `check-activation-guard.py --base <ref>` → exit 0 (PASS), 1 (activation illicite), 2 (base introuvable ou non-commit) ; ligne de succès `PASS activation-guard: aucune activation par édition directe (base=<base>, N entrées)` ; variable d'environnement `GUARD_BASE` du step CI.

- [ ] **Étape 1 : créer le worktree et l'environnement**

```bash
git -C /opt/automecanik/automecanik-wiki fetch origin
git -C /opt/automecanik/automecanik-wiki worktree add -b fix/activation-guard-push-base /opt/automecanik/automecanik-wiki-wt-guard-push-base origin/main
cd /opt/automecanik/automecanik-wiki-wt-guard-push-base
```

Puis lancer le bloc **Préparation** ci-dessus (attendu : `ENV_OK …`), et ajouter les dépendances de la suite WIKI complète (dont `markdown-it-py`, via `requirements-scoring.txt`) :

```bash
pip install -q -r _scripts/tests/requirements-dev.txt && python3 -c "import markdown_it" && echo SUITE_DEPS_OK
```

Attendu : `SUITE_DEPS_OK`.

- [ ] **Étape 2 : écrire les tests qui échouent**

Écrire ce diff dans `$SCRATCH/guard-tests.diff`, puis `git apply "$SCRATCH/guard-tests.diff"` :

```diff
diff --git a/_scripts/tests/test_activation_guard.py b/_scripts/tests/test_activation_guard.py
index cd1cd98..22d27cb 100644
--- a/_scripts/tests/test_activation_guard.py
+++ b/_scripts/tests/test_activation_guard.py
@@ -11,8 +11,13 @@ Exécution : cd _scripts/tests && python3 -m pytest test_activation_guard.py -v
 from __future__ import annotations
 
 import importlib.util
+import subprocess
+import sys
 from pathlib import Path
 
+import pytest
+import yaml
+
 SCRIPTS_DIR = Path(__file__).resolve().parent.parent
 _spec = importlib.util.spec_from_file_location(
     "activation_guard", SCRIPTS_DIR / "check-activation-guard.py"
@@ -79,3 +84,62 @@ def test_missing_status_defaults_active_so_new_entry_flagged():
     base: dict = {}
     head = {"s": _e("s")}
     assert guard.find_illicit_activations(base, head), "status omis = active → nouvelle entrée signalée"
+
+
+# --- main() sur un vrai dépôt git : la base doit désigner un commit existant ---------
+
+
+def _git(root: Path, *args: str) -> str:
+    return subprocess.run(
+        ["git", "-c", "user.name=t", "-c", "user.email=t@t", *args],
+        cwd=root, check=True, capture_output=True, text=True,
+    ).stdout.strip()
+
+
+def _commit_catalog(root: Path, entries: list[dict]) -> str:
+    path = root / guard.CATALOG_REL
+    path.parent.mkdir(parents=True, exist_ok=True)
+    path.write_text(yaml.safe_dump({"sources": entries}), encoding="utf-8")
+    _git(root, "add", "-A")
+    _git(root, "commit", "-qm", "catalog")
+    return _git(root, "rev-parse", "HEAD")
+
+
+@pytest.fixture
+def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
+    _git(tmp_path, "init", "-q")
+    monkeypatch.setattr(guard, "REPO_ROOT", tmp_path)
+    monkeypatch.setattr(guard, "CATALOG", tmp_path / guard.CATALOG_REL)
+    return tmp_path
+
+
+def _main(monkeypatch: pytest.MonkeyPatch, base: str) -> int:
+    monkeypatch.setattr(sys, "argv", ["check-activation-guard.py", "--base", base])
+    return guard.main()
+
+
+def test_main_flags_activation_pushed_between_two_commits(repo, monkeypatch):
+    before = _commit_catalog(repo, [_e("s", "to_capture")])
+    _commit_catalog(repo, [_e("s", "active")])
+    assert _main(monkeypatch, before) == 1
+
+
+def test_main_passes_when_catalog_unchanged(repo, monkeypatch):
+    before = _commit_catalog(repo, [_e("s", "to_capture")])
+    assert _main(monkeypatch, before) == 0
+
+
+def test_main_fails_loud_on_null_push_base(repo, monkeypatch):
+    _commit_catalog(repo, [_e("s", "to_capture")])
+    with pytest.raises(SystemExit) as exc:
+        _main(monkeypatch, "0" * 40)
+    assert exc.value.code == 2
+
+
+def test_main_fails_loud_on_unknown_full_sha_base(repo, monkeypatch):
+    # `rev-parse --verify` accepte un SHA complet sans vérifier que l'objet existe ;
+    # sans `^{commit}` la base vaut « catalogue vide » et le guard passe à tort.
+    _commit_catalog(repo, [_e("s", "to_capture")])
+    with pytest.raises(SystemExit) as exc:
+        _main(monkeypatch, "1" * 40)
+    assert exc.value.code == 2
```

- [ ] **Étape 3 : vérifier l'échec**

Run : `cd _scripts/tests && python3 -m pytest test_activation_guard.py -q; cd ../..`
Attendu : `2 failed, 10 passed`, les deux échecs étant `test_main_fails_loud_on_null_push_base` et `test_main_fails_loud_on_unknown_full_sha_base` avec `Failed: DID NOT RAISE <class 'SystemExit'>`. Les deux autres nouveaux tests passent déjà : ils fixent le comportement à préserver.

- [ ] **Étape 4 : corriger la garde**

Écrire ce diff dans `$SCRATCH/guard-fix.diff`, puis `git apply "$SCRATCH/guard-fix.diff"` :

```diff
diff --git a/_scripts/check-activation-guard.py b/_scripts/check-activation-guard.py
index 59f46ea..2bdd4df 100755
--- a/_scripts/check-activation-guard.py
+++ b/_scripts/check-activation-guard.py
@@ -13,7 +13,8 @@ DIRECTE. Il ne nécessite AUCUN accès au repo RAW : il compare seulement l'éta
 entre une base git et le head.
 
 Usage :
-  check-activation-guard.py --base origin/main   # CI wiki (fetch-depth: 0)
+  check-activation-guard.py --base origin/main   # CI wiki, pull_request (fetch-depth: 0)
+  check-activation-guard.py --base <before-sha>  # CI wiki, push main (github.event.before)
   check-activation-guard.py --base HEAD          # pre-commit (HEAD vs working tree)
 """
 from __future__ import annotations
@@ -64,7 +65,9 @@ def _git(args: list[str]) -> subprocess.CompletedProcess:
 
 def _load_base_entries(base: str) -> dict[str, dict]:
     # Ref invalide = CI/hook mal configuré → fail-loud (jamais un skip silencieux).
-    if _git(["rev-parse", "--verify", "--quiet", base]).returncode != 0:
+    # `^{commit}` : sans lui, `rev-parse --verify` accepte tout SHA complet bien formé
+    # (y compris le SHA nul d'un push) sans vérifier que l'objet existe.
+    if _git(["rev-parse", "--verify", "--quiet", f"{base}^{{commit}}"]).returncode != 0:
         print(
             f"FAIL activation-guard: base_ref_introuvable: '{base}' — CI/hook mal configuré "
             "(fetch-depth insuffisant ?). Fail-loud, pas de skip silencieux."
```

- [ ] **Étape 5 : vérifier que tout passe**

Run : `cd _scripts/tests && python3 -m pytest test_activation_guard.py -q && python3 -m pytest -q | tail -1; cd ../..`
Attendu : `12 passed`, puis pour la suite complète `291 passed` sur la base `6e3a043` (287 + 4). Sur une base plus récente : le total de `origin/main` + 4, `0 failed`.

- [ ] **Étape 6 : brancher la base de push dans la CI**

Écrire ce diff dans `$SCRATCH/wqg-guard.diff`, puis `git apply "$SCRATCH/wqg-guard.diff"` (l'en-tête de hunk s'applique avec décalage, que la Tâche 3 soit déjà fusionnée ou non ; vérifié dans les deux ordres) :

```diff
diff --git a/.github/workflows/wiki-quality-gates.yml b/.github/workflows/wiki-quality-gates.yml
index d665b03..cf1a5d0 100644
--- a/.github/workflows/wiki-quality-gates.yml
+++ b/.github/workflows/wiki-quality-gates.yml
@@ -72,8 +72,14 @@ jobs:
         # cross-repo (`quality-gates.py --cross-repo`, 2 repos frais), non lançable en CI wiki
         # (pas de credential cross-repo secretless). Ce guard fail-closed bloque toute activation
         # par édition directe ; l'activation légitime passe par le flux gouverné (hors CI) qui
-        # exécute --cross-repo. fetch-depth: 0 (checkout ci-dessus) → origin/main résout.
-        run: python3 _scripts/check-activation-guard.py --base origin/main
+        # exécute --cross-repo. fetch-depth: 0 (checkout ci-dessus) → la base résout.
+        # Base : sur pull_request, origin/main (état avant fusion). Sur push main,
+        # origin/main == HEAD : la comparaison serait vide et le guard passerait à tort ;
+        # on compare donc au commit d'avant le push (github.event.before). Un before
+        # nul ou injoignable (force-push) fait sortir le guard en 2, jamais en PASS.
+        env:
+          GUARD_BASE: ${{ github.event_name == 'push' && github.event.before || 'origin/main' }}
+        run: python3 _scripts/check-activation-guard.py --base "$GUARD_BASE"
 
       - name: pytest fixtures (gates ADR-033 + ADR-032)
         run: cd _scripts/tests && python3 -m pytest -v
```

Run : `actionlint .github/workflows/wiki-quality-gates.yml && echo ACTIONLINT_OK`
Attendu : `ACTIONLINT_OK`, aucune autre sortie.

- [ ] **Étape 7 : commit**

```bash
git add _scripts/check-activation-guard.py _scripts/tests/test_activation_guard.py .github/workflows/wiki-quality-gates.yml
git commit -F - <<'EOF'
fix(ci): la garde d'activation compare au commit d'avant le push sur main

Sur push main, origin/main == HEAD : la comparaison était vide et la garde
passait à tort. Le step passe désormais github.event.before sur push et
origin/main sur pull_request. La base est vérifiée avec ^{commit} : un SHA
nul ou injoignable fait sortir la garde en 2, jamais en PASS.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git show --stat --format='%h %s' HEAD
```

Attendu : 3 fichiers modifiés.

- [ ] **Étape 8 : PR (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin fix/activation-guard-push-base
gh pr create --repo ak125/automecanik-wiki --base main --head fix/activation-guard-push-base \
  --title "fix(ci): la garde d'activation compare au commit d'avant le push sur main" \
  --body-file - <<'EOF'
## Constat
Sur un push `main`, la garde comparait `origin/main` à HEAD, qui sont égaux : elle
passait sans rien comparer. `rev-parse --verify` acceptait aussi un SHA complet dont
l'objet n'existe pas (SHA nul d'un push).

## Correction
- step CI : `GUARD_BASE` = `github.event.before` sur push, `origin/main` sur PR ;
- garde : base vérifiée avec `^{commit}`, exit 2 sinon.

## Preuve
- avant correctif : 2 tests échouent (`DID NOT RAISE`) ;
- après : 12 tests de la garde, suite `_scripts/tests` complète verte ;
- après fusion : le run push de `wiki-quality-gates` doit afficher `base=<sha de 40 hex>`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Étape 9 : preuve après fusion humaine**

```bash
SHA=$(gh pr view fix/activation-guard-push-base --repo ak125/automecanik-wiki --json mergeCommit -q .mergeCommit.oid)
RUN=$(gh run list --repo ak125/automecanik-wiki --workflow wiki-quality-gates.yml --commit "$SHA" --event push --json databaseId -q '.[0].databaseId')
gh run view "$RUN" --repo ak125/automecanik-wiki --log | grep -o 'PASS activation-guard: .*'
```

Attendu : `PASS activation-guard: aucune activation par édition directe (base=<40 hex>, N entrées)`. Une ligne avec `base=origin/main` sur ce run push signifie que le step n'a pas pris la branche push : ne pas conclure.

---

### Tâche 2 : contrat d'export `exports/diagnostic/` (tests, schéma, builder)

**Files:**
- Create: `_scripts/test_build_exports_diagnostic.py`
- Create: `_meta/schema/exports-diagnostic.schema.json`
- Create: `_scripts/build_exports_diagnostic.py`

**Interfaces:**
- Consumes (existant sur `main` du WIKI) : `build_exports_seo._assert_full_clone(wiki_root)`, `build_exports_seo._parse_markdown(path) -> (frontmatter: dict, body: str)`, `gen_coverage_map.is_page_proven(entry: dict) -> bool`, `compute-symptom-confidence.py: compute_score(sources: list[str], catalog: dict) -> <valeur de evidence.confidence_score_computed>` ; schémas `_meta/schema/frontmatter.schema.json` et `_meta/schema/source-catalog-entry.schema.json`.
- Produces (lu par la Tâche 4 et par le writer du Plan 2) :
  - CLI `build_exports_diagnostic.py --wiki-root <dir> [--format text|json]` → exit 0 / 1 (erreur ou `UNRECONCILED`) / 2 (schéma d'export absent) ; en `--format json`, stdout = `{"status": "OK"|"UNRECONCILED", "written": int, "observations": [{"export_path": str, "withdrawal_authorized": false}]}` ;
  - `exports/diagnostic/gamme/<slug>.json` : `schema_version`, `builder_version`, `export_kind: "diagnostic_gamme"`, `gamme_slug`, `wiki_path`, `source_wiki_commit`, `source_catalog_commit`, `content_hash`, `relations[]` (`relation_index`, `relation_sha256`, `symptom_slug`, `system_slug`, `relation_to_part`, `part_role`, `evidence{confidence, source_policy, reviewed, diagnostic_safe}`, `confidence_score_computed`, `sources[]{slug, catalog_slug, type, status, raw_ref, raw_proven}`) ;
  - `exports/diagnostic/_index.json` : `schema_version`, `builder_version`, `export_kind: "diagnostic_index"`, `source_catalog_commit`, `files[]{path, sha256, source_wiki_commit, relation_count}` ;
  - fonctions `is_eligible(fm) -> bool`, `build_gamme_export(fm, source_path, wiki_root, catalog, commit_sha, catalog_commit) -> dict`.

- [ ] **Étape 1 : créer le worktree**

```bash
git -C /opt/automecanik/automecanik-wiki fetch origin
git -C /opt/automecanik/automecanik-wiki worktree add -b feat/diagnostic-exports /opt/automecanik/automecanik-wiki-wt-diag-exports origin/main
cd /opt/automecanik/automecanik-wiki-wt-diag-exports
```

Puis lancer le bloc **Préparation**. Attendu : `ENV_OK`.

- [ ] **Étape 2 : écrire les tests**

Créer `_scripts/test_build_exports_diagnostic.py` :

```python
"""Tests build_exports_diagnostic — vue dérivée des diagnostic_relations (ADR-033).

Chaque test construit un dépôt git jetable (fiches + catalogue + schéma) et lance le
builder comme la CI : `main` via CliRunner. Exécution :
    cd _scripts && python3 -m pytest test_build_exports_diagnostic.py -v
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import click
import jsonschema
import pytest
import yaml
from click.testing import CliRunner
from referencing import Registry, Resource

import build_exports_diagnostic as builder

SCHEMA_DIR = Path(__file__).resolve().parent.parent / "_meta" / "schema"
SCHEMA_PATH = SCHEMA_DIR / "exports-diagnostic.schema.json"
SCRIPT_PATH = Path(__file__).resolve().parent / "build_exports_diagnostic.py"

CATALOG = [
    {"slug": "oem_doc", "title": "OEM", "type": "oem_manual", "license": "x", "status": "active",
     "raw_ref": {"repo": "automecanik-raw", "manifest_id": "rec-oem-doc",
                 "expected_sha256": "sha256:" + "a" * 64}},
    {"slug": "brochure_doc", "title": "Brochure", "type": "brochure", "license": "x",
     "status": "to_capture",
     "raw_ref": {"repo": "automecanik-raw", "manifest_id": "brochure_doc", "expected_sha256": None}},
    {"slug": "blog_doc", "title": "Blog", "type": "blog_pro", "license": "x", "status": "to_capture"},
]


def _relation(sources: list[str], part_role: str = "filtre colmaté réduisant le débit d'air") -> dict:
    return {
        "symptom_slug": "perte_puissance_filtration",
        "system_slug": "filtration",
        "relation_to_part": "possible_cause",
        "part_role": part_role,
        "evidence": {"confidence": "medium", "source_policy": "2_medium_concordant",
                     "reviewed": False, "diagnostic_safe": False},
        "sources": sources,
    }


def _git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@t", *args],
        cwd=root, check=True, capture_output=True, text=True,
    ).stdout.strip()


def _write_fiche(root: Path, slug: str, *, review_status: str = "approved",
                 relations: list[dict] | None = None, fm_slug: str | None = None) -> None:
    fm = {"schema_version": "2.0.0", "id": f"gamme:{slug}", "entity_type": "gamme",
          "slug": fm_slug or slug, "title": slug, "lang": "fr", "review_status": review_status}
    if relations is not None:
        fm["diagnostic_relations"] = relations
    path = root / "wiki" / "gamme" / f"{slug}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("---\n" + yaml.safe_dump(fm, allow_unicode=True, sort_keys=False)
                    + "---\n\n# " + slug + "\n", encoding="utf-8")


def _write_catalog(root: Path, entries: list[dict]) -> None:
    path = root / "_meta" / "source-catalog.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump({"sources": entries}, sort_keys=False), encoding="utf-8")


@pytest.fixture
def wiki(tmp_path: Path) -> Path:
    root = tmp_path / "wiki-repo"
    (root / "_meta" / "schema").mkdir(parents=True)
    shutil.copy(SCHEMA_PATH, root / "_meta" / "schema" / SCHEMA_PATH.name)
    _write_catalog(root, CATALOG)
    _write_fiche(root, "filtre-a-air", relations=[_relation(["oem_doc", "brochure_doc"])])
    _git(root, "init", "-q")
    _git(root, "add", "-A")
    _git(root, "commit", "-qm", "base")
    return root


def _run(root: Path, *extra: str):
    return CliRunner().invoke(builder.main, ["--wiki-root", str(root), *extra])


def _commit_all(root: Path, message: str) -> str:
    _git(root, "add", "-A")
    _git(root, "commit", "-qm", message)
    return _git(root, "rev-parse", "HEAD")


def _read(root: Path, rel: str) -> dict:
    return json.loads((root / "exports" / "diagnostic" / rel).read_text(encoding="utf-8"))


def _validator() -> jsonschema.Draft202012Validator:
    registry = Registry()
    for name in ("frontmatter.schema.json", "source-catalog-entry.schema.json"):
        schema = json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))
        registry = registry.with_resource(schema["$id"], Resource.from_contents(schema))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return jsonschema.Draft202012Validator(schema, registry=registry)


# --- éligibilité et sortie --------------------------------------------------------


def test_only_approved_fiches_with_relations_are_exported(wiki: Path):
    _write_fiche(wiki, "filtre-a-huile", review_status="draft",
                 relations=[_relation(["oem_doc"])])
    _write_fiche(wiki, "bougie", relations=[])
    _write_fiche(wiki, "courroie")
    _commit_all(wiki, "more fiches")

    result = _run(wiki)

    assert result.exit_code == 0, result.output
    gamme_files = sorted(p.name for p in (wiki / "exports" / "diagnostic" / "gamme").glob("*.json"))
    assert gamme_files == ["filtre-a-air.json"]
    assert [f["path"] for f in _read(wiki, "_index.json")["files"]] == ["gamme/filtre-a-air.json"]


def test_outputs_validate_against_schema(wiki: Path):
    assert _run(wiki).exit_code == 0
    validator = _validator()
    validator.validate(_read(wiki, "gamme/filtre-a-air.json"))
    validator.validate(_read(wiki, "_index.json"))


def test_rerun_produces_identical_bytes(wiki: Path):
    assert _run(wiki).exit_code == 0
    out = wiki / "exports" / "diagnostic"
    first = {p: p.read_bytes() for p in out.rglob("*.json")}
    assert _run(wiki).exit_code == 0
    assert {p: p.read_bytes() for p in out.rglob("*.json")} == first


def test_written_files_end_with_newline(wiki: Path):
    assert _run(wiki).exit_code == 0
    for path in (wiki / "exports" / "diagnostic").rglob("*.json"):
        assert path.read_bytes().endswith(b"}\n"), path


def test_index_hashes_the_written_bytes(wiki: Path):
    assert _run(wiki).exit_code == 0
    entry = _read(wiki, "_index.json")["files"][0]
    data = (wiki / "exports" / "diagnostic" / entry["path"]).read_bytes()
    assert entry["sha256"] == builder._sha256_prefixed(data)
    assert entry["relation_count"] == 1


def test_zero_eligible_fiche_gives_empty_valid_index(wiki: Path):
    _write_fiche(wiki, "filtre-a-air", review_status="draft", relations=[_relation(["oem_doc"])])
    _commit_all(wiki, "unapprove")

    result = _run(wiki)

    assert result.exit_code == 0, result.output
    index = _read(wiki, "_index.json")
    assert index["files"] == []
    _validator().validate(index)


# --- provenance git ---------------------------------------------------------------


def test_commits_are_the_last_ones_touching_fiche_and_catalog(wiki: Path):
    fiche_commit = _git(wiki, "rev-parse", "HEAD")
    _write_catalog(wiki, CATALOG + [{"slug": "other_doc", "title": "o", "type": "forum",
                                     "license": "x", "status": "to_capture"}])
    catalog_commit = _commit_all(wiki, "catalog change")
    (wiki / "unrelated.txt").write_text("x", encoding="utf-8")
    _commit_all(wiki, "unrelated")

    assert _run(wiki).exit_code == 0
    export = _read(wiki, "gamme/filtre-a-air.json")
    assert export["source_wiki_commit"] == fiche_commit
    assert export["source_catalog_commit"] == catalog_commit
    assert _read(wiki, "_index.json")["source_catalog_commit"] == catalog_commit


def test_no_git_repository_fails(tmp_path: Path):
    root = tmp_path / "plain"
    (root / "_meta" / "schema").mkdir(parents=True)
    shutil.copy(SCHEMA_PATH, root / "_meta" / "schema" / SCHEMA_PATH.name)
    _write_catalog(root, CATALOG)
    _write_fiche(root, "filtre-a-air", relations=[_relation(["oem_doc"])])

    result = _run(root)

    assert result.exit_code == 1
    assert "no commit found" in result.output
    assert not (root / "exports").exists()


def test_shallow_clone_fails(wiki: Path, tmp_path: Path):
    (wiki / "unrelated.txt").write_text("x", encoding="utf-8")
    _commit_all(wiki, "second")
    clone = tmp_path / "shallow"
    subprocess.run(["git", "clone", "-q", "--depth", "1", f"file://{wiki}", str(clone)], check=True)

    result = _run(clone)

    assert result.exit_code == 1
    assert "SHALLOW" in result.output


def test_missing_export_schema_exits_2(wiki: Path):
    (wiki / "_meta" / "schema" / SCHEMA_PATH.name).unlink()
    assert _run(wiki).exit_code == 2


# --- retrait gouverné ---------------------------------------------------------------


def test_export_without_eligible_fiche_is_preserved_and_fails(wiki: Path):
    assert _run(wiki).exit_code == 0
    _write_fiche(wiki, "filtre-a-air", review_status="draft", relations=[_relation(["oem_doc"])])
    _commit_all(wiki, "unapprove")
    export = wiki / "exports" / "diagnostic" / "gamme" / "filtre-a-air.json"
    before = export.read_bytes()

    result = _run(wiki, "--format", "json")

    assert result.exit_code == 1
    assert export.read_bytes() == before
    report = json.loads(result.stdout[: result.stdout.rindex("}") + 1])
    assert report["status"] == "UNRECONCILED"
    assert report["observations"] == [
        {"export_path": "exports/diagnostic/gamme/filtre-a-air.json", "withdrawal_authorized": False}
    ]


def test_governed_withdrawal_regenerates_index(wiki: Path):
    assert _run(wiki).exit_code == 0
    _write_fiche(wiki, "filtre-a-air", review_status="draft", relations=[_relation(["oem_doc"])])
    (wiki / "exports" / "diagnostic" / "gamme" / "filtre-a-air.json").unlink()
    _commit_all(wiki, "withdraw")

    result = _run(wiki)

    assert result.exit_code == 0, result.output
    assert _read(wiki, "_index.json")["files"] == []


# --- sources -----------------------------------------------------------------------


def test_part_suffix_is_normalised_to_catalog_slug(wiki: Path):
    _write_fiche(wiki, "filtre-a-air", relations=[_relation(["oem_doc_p3"])])
    _commit_all(wiki, "part suffix")

    assert _run(wiki).exit_code == 0
    source = _read(wiki, "gamme/filtre-a-air.json")["relations"][0]["sources"][0]
    assert source["slug"] == "oem_doc_p3"
    assert source["catalog_slug"] == "oem_doc"


def test_unknown_source_slug_fails(wiki: Path):
    _write_fiche(wiki, "filtre-a-air", relations=[_relation(["ghost_doc_p2"])])
    _commit_all(wiki, "unknown source")

    result = _run(wiki)

    assert result.exit_code == 1
    assert "source slug unknown to the catalog" in result.output


def test_catalog_entry_without_status_fails(wiki: Path):
    entries = [dict(e) for e in CATALOG]
    del entries[1]["status"]
    _write_catalog(wiki, entries)
    _commit_all(wiki, "implicit status")

    result = _run(wiki)

    assert result.exit_code == 1
    assert "without explicit status: brochure_doc" in result.output


def test_duplicate_catalog_slug_fails(wiki: Path):
    _write_catalog(wiki, CATALOG + [dict(CATALOG[0])])
    _commit_all(wiki, "duplicate")

    result = _run(wiki)

    assert result.exit_code == 1
    assert "duplicate source catalog slug: oem_doc" in result.output


def test_status_type_and_raw_ref_are_copied_from_catalog(wiki: Path):
    _write_fiche(wiki, "filtre-a-air", relations=[_relation(["oem_doc", "brochure_doc", "blog_doc"])])
    _commit_all(wiki, "three sources")

    assert _run(wiki).exit_code == 0
    sources = _read(wiki, "gamme/filtre-a-air.json")["relations"][0]["sources"]
    assert [(s["type"], s["status"]) for s in sources] == [
        ("oem_manual", "active"), ("brochure", "to_capture"), ("blog_pro", "to_capture")]
    assert sources[0]["raw_ref"] == CATALOG[0]["raw_ref"]
    assert sources[1]["raw_ref"] == CATALOG[1]["raw_ref"]
    assert sources[2]["raw_ref"] is None


def test_raw_proven_is_the_g1_predicate():
    from gen_coverage_map import is_page_proven

    catalog = {e["slug"]: e for e in CATALOG}
    catalog["active_no_ref"] = {"slug": "active_no_ref", "type": "forum", "status": "active"}
    for slug, entry in catalog.items():
        assert builder._export_source(slug, catalog)["raw_proven"] is is_page_proven(entry)
    assert builder._export_source("oem_doc", catalog)["raw_proven"] is True
    assert builder._export_source("brochure_doc", catalog)["raw_proven"] is False
    assert builder._export_source("active_no_ref", catalog)["raw_proven"] is False


def test_confidence_score_is_the_canonical_formula(wiki: Path):
    assert _run(wiki).exit_code == 0
    relation = _read(wiki, "gamme/filtre-a-air.json")["relations"][0]
    catalog = {e["slug"]: e for e in CATALOG}
    assert relation["confidence_score_computed"] == builder.compute_score(
        ["oem_doc", "brochure_doc"], catalog)
    assert relation["confidence_score_computed"] == 1.0
    assert "confidence_score_computed" not in relation["evidence"]


# --- identité des relations ----------------------------------------------------------


def test_relation_sha256_is_stable_and_content_sensitive():
    catalog = {e["slug"]: e for e in CATALOG}
    item = _relation(["oem_doc"])
    first = builder._export_relation(0, item, catalog)["relation_sha256"]
    assert builder._export_relation(0, json.loads(json.dumps(item)), catalog)["relation_sha256"] == first
    changed = builder._export_relation(0, _relation(["oem_doc"], part_role="autre rôle de la pièce"),
                                       catalog)["relation_sha256"]
    assert changed != first
    assert first.startswith("sha256:") and len(first) == len("sha256:") + 64


def test_frontmatter_slug_must_match_file_name(wiki: Path):
    _write_fiche(wiki, "filtre-a-air", relations=[_relation(["oem_doc"])], fm_slug="filtre-air")
    _commit_all(wiki, "slug mismatch")

    result = _run(wiki)

    assert result.exit_code == 1
    assert "differs from file name" in result.output


def test_writes_are_refused_outside_exports_diagnostic(wiki: Path):
    with pytest.raises(click.ClickException, match="outside"):
        builder._write_strict(wiki / "exports" / "seo" / "x.json", b"{}\n", wiki)


# --- schéma --------------------------------------------------------------------------


def _valid_export(wiki: Path) -> dict:
    assert _run(wiki).exit_code == 0
    return _read(wiki, "gamme/filtre-a-air.json")


def test_schema_rejects_raw_proven_source_without_expected_sha256(wiki: Path):
    export = _valid_export(wiki)
    source = export["relations"][0]["sources"][1]  # brochure_doc : to_capture, sha null
    source["raw_proven"] = True
    with pytest.raises(jsonschema.ValidationError):
        _validator().validate(export)
    source["status"] = "active"
    with pytest.raises(jsonschema.ValidationError):
        _validator().validate(export)
    source["raw_ref"]["expected_sha256"] = "sha256:" + "b" * 64
    _validator().validate(export)


def test_schema_rejects_score_inside_evidence(wiki: Path):
    export = _valid_export(wiki)
    export["relations"][0]["evidence"]["confidence_score_computed"] = 1.0
    with pytest.raises(jsonschema.ValidationError):
        _validator().validate(export)


def test_schema_rejects_unprefixed_hash(wiki: Path):
    export = _valid_export(wiki)
    export["content_hash"] = export["content_hash"].removeprefix("sha256:")
    with pytest.raises(jsonschema.ValidationError):
        _validator().validate(export)


# --- garde-fous statiques ------------------------------------------------------------


def _source_text() -> str:
    return SCRIPT_PATH.read_text(encoding="utf-8")


@pytest.mark.parametrize("module", ["anthropic", "openai", "groq", "cohere", "mistralai",
                                    "google.generativeai"])
def test_no_llm_import(module: str):
    assert f"import {module}" not in _source_text()
    assert f"from {module}" not in _source_text()


@pytest.mark.parametrize("module", ["psycopg", "asyncpg", "supabase", "sqlalchemy", "django"])
def test_no_db_import(module: str):
    assert f"import {module}" not in _source_text()
    assert f"from {module}" not in _source_text()


@pytest.mark.parametrize("token", ["datetime.now", "datetime.utcnow", "time.time(", "date.today",
                                   '"HEAD"', "rev-parse"])
def test_no_wall_clock_nor_head(token: str):
    assert token not in _source_text()
```

- [ ] **Étape 3 : vérifier l'échec**

Run : `cd _scripts && python3 -m pytest test_build_exports_diagnostic.py -q; cd ..`
Attendu : erreur de collecte `ModuleNotFoundError: No module named 'build_exports_diagnostic'`.

- [ ] **Étape 4 : écrire le schéma d'export**

Créer `_meta/schema/exports-diagnostic.schema.json` :

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/ak125/automecanik-wiki/_meta/schema/exports-diagnostic.schema.json",
  "title": "automecanik-wiki exports/diagnostic/ contract v1.0.0",
  "description": "Vue dérivée déterministe des diagnostic_relations (ADR-033) des fiches wiki/gamme/*.md approuvées, produite par _scripts/build_exports_diagnostic.py. Deux formes : un export par gamme (exports/diagnostic/gamme/<slug>.json) et l'index (exports/diagnostic/_index.json). Les champs de relation et de source sont des $ref vers frontmatter.schema.json et source-catalog-entry.schema.json : ce schéma ne duplique aucun contrat canonique.",
  "oneOf": [
    { "$ref": "#/$defs/gamme_export" },
    { "$ref": "#/$defs/index" }
  ],
  "$defs": {
    "sha256_prefixed": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" },
    "commit_sha": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
    "semver": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": ["slug", "catalog_slug", "type", "status", "raw_ref", "raw_proven"],
      "properties": {
        "slug": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/sources/items" },
        "catalog_slug": { "$ref": "source-catalog-entry.schema.json#/properties/slug" },
        "type": { "$ref": "source-catalog-entry.schema.json#/properties/type" },
        "status": { "$ref": "source-catalog-entry.schema.json#/properties/status" },
        "raw_ref": {
          "anyOf": [
            { "type": "null" },
            { "$ref": "source-catalog-entry.schema.json#/properties/raw_ref" }
          ]
        },
        "raw_proven": {
          "description": "Prédicat G1 gen_coverage_map.is_page_proven (status active ET raw_ref.manifest_id). Calculé par le builder, jamais par le consommateur.",
          "type": "boolean"
        }
      },
      "if": { "properties": { "raw_proven": { "const": true } }, "required": ["raw_proven"] },
      "then": {
        "properties": {
          "status": { "const": "active" },
          "raw_ref": {
            "type": "object",
            "required": ["expected_sha256"],
            "properties": { "expected_sha256": { "type": "string" } }
          }
        }
      }
    },
    "relation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "relation_index", "relation_sha256", "symptom_slug", "system_slug", "relation_to_part",
        "part_role", "evidence", "confidence_score_computed", "sources"
      ],
      "properties": {
        "relation_index": { "type": "integer", "minimum": 0 },
        "relation_sha256": { "$ref": "#/$defs/sha256_prefixed" },
        "symptom_slug": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/symptom_slug" },
        "system_slug": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/system_slug" },
        "relation_to_part": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/relation_to_part" },
        "part_role": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/part_role" },
        "evidence": {
          "type": "object",
          "additionalProperties": false,
          "required": ["confidence", "source_policy", "reviewed", "diagnostic_safe"],
          "properties": {
            "confidence": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/evidence/properties/confidence" },
            "source_policy": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/evidence/properties/source_policy" },
            "reviewed": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/evidence/properties/reviewed" },
            "diagnostic_safe": { "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/evidence/properties/diagnostic_safe" }
          }
        },
        "confidence_score_computed": {
          "$ref": "frontmatter.schema.json#/properties/diagnostic_relations/items/properties/evidence/properties/confidence_score_computed"
        },
        "sources": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/source" } }
      }
    },
    "gamme_export": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "schema_version", "builder_version", "export_kind", "gamme_slug", "wiki_path",
        "source_wiki_commit", "source_catalog_commit", "content_hash", "relations"
      ],
      "properties": {
        "schema_version": { "const": "1.0.0" },
        "builder_version": { "$ref": "#/$defs/semver" },
        "export_kind": { "const": "diagnostic_gamme" },
        "gamme_slug": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*[a-z0-9]$" },
        "wiki_path": { "type": "string", "pattern": "^wiki/gamme/[a-z0-9][a-z0-9-]*[a-z0-9]\\.md$" },
        "source_wiki_commit": { "$ref": "#/$defs/commit_sha" },
        "source_catalog_commit": { "$ref": "#/$defs/commit_sha" },
        "content_hash": { "$ref": "#/$defs/sha256_prefixed" },
        "relations": { "type": "array", "minItems": 1, "items": { "$ref": "#/$defs/relation" } }
      }
    },
    "index": {
      "type": "object",
      "additionalProperties": false,
      "required": ["schema_version", "builder_version", "export_kind", "source_catalog_commit", "files"],
      "properties": {
        "schema_version": { "const": "1.0.0" },
        "builder_version": { "$ref": "#/$defs/semver" },
        "export_kind": { "const": "diagnostic_index" },
        "source_catalog_commit": { "$ref": "#/$defs/commit_sha" },
        "files": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["path", "sha256", "source_wiki_commit", "relation_count"],
            "properties": {
              "path": { "type": "string", "pattern": "^gamme/[a-z0-9][a-z0-9-]*[a-z0-9]\\.json$" },
              "sha256": { "$ref": "#/$defs/sha256_prefixed" },
              "source_wiki_commit": { "$ref": "#/$defs/commit_sha" },
              "relation_count": { "type": "integer", "minimum": 1 }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Étape 5 : écrire le builder**

Créer `_scripts/build_exports_diagnostic.py` :

```python
#!/usr/bin/env python3
"""build_exports_diagnostic.py — vue dérivée des diagnostic_relations (ADR-033).

Filtre + transforme les fiches `wiki/gamme/*.md` approuvées qui portent des
`diagnostic_relations` vers :

    exports/diagnostic/gamme/<slug>.json   (une relation par entrée, sources résolues)
    exports/diagnostic/_index.json         (liste triée des exports + sha256)

Consommateur : writer de projection diagnostic du monorepo (spec
`docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md`, §4.2).

Contrat :
- AUCUN LLM, AUCUNE DB, AUCUN enrichissement : chaque champ est copié de la fiche ou
  du catalogue de sources, ou calculé par une fonction canonique existante
  (`compute-symptom-confidence.compute_score`, `gen_coverage_map.is_page_proven`).
- Déterministe : aucun horodatage, aucun HEAD. `source_wiki_commit` = dernier commit
  touchant la fiche ; `source_catalog_commit` = dernier commit touchant le catalogue.
  Deux runs sur le même canon produisent les mêmes octets.
- Retrait : un export existant sans fiche éligible est rapporté UNRECONCILED, conservé,
  et le build échoue. Le retrait est une PR WIKI qui supprime
  `exports/diagnostic/gamme/<slug>.json` puis relance ce builder (l'index est régénéré).

Exit : 0 OK · 1 erreur de build ou UNRECONCILED · 2 schéma d'export introuvable.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import click
import yaml

from build_exports_seo import _assert_full_clone, _parse_markdown
from gen_coverage_map import is_page_proven

SCHEMA_VERSION = "1.0.0"
BUILDER_VERSION = "1.0.0"
CATALOG_REL = "_meta/source-catalog.yaml"
EXPORT_SCHEMA_REL = Path("_meta") / "schema" / "exports-diagnostic.schema.json"
EXPORTS_REL = Path("exports") / "diagnostic"
_PART_SUFFIX = re.compile(r"_p\d+$")
_SCRIPTS_DIR = Path(__file__).resolve().parent


def _load_compute_score():
    """`compute_score` du script canonique (nom à tirets → import par chemin)."""
    spec = importlib.util.spec_from_file_location(
        "compute_symptom_confidence", _SCRIPTS_DIR / "compute-symptom-confidence.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.compute_score


compute_score = _load_compute_score()


def _sha256_prefixed(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _load_catalog(wiki_root: Path) -> dict[str, dict]:
    """Catalogue de sources strict : slug unique, `status` explicite, aucun repli."""
    path = wiki_root / CATALOG_REL
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise click.ClickException(f"source catalog unreadable: {path}: {exc}") from exc
    sources = data.get("sources") if isinstance(data, dict) else None
    if not isinstance(sources, list):
        raise click.ClickException(f"source catalog has no 'sources' list: {path}")
    catalog: dict[str, dict] = {}
    for entry in sources:
        if not isinstance(entry, dict) or not isinstance(entry.get("slug"), str):
            raise click.ClickException(f"source catalog entry without slug: {entry!r}")
        # Le schéma défaut `active`, le guard aussi, G1 lit « non prouvé » : un statut
        # implicite n'a pas de sens unique. On exige qu'il soit écrit.
        if "status" not in entry:
            raise click.ClickException(
                f"source catalog entry without explicit status: {entry['slug']}"
            )
        if entry["slug"] in catalog:
            raise click.ClickException(f"duplicate source catalog slug: {entry['slug']}")
        catalog[entry["slug"]] = entry
    return catalog


def _last_commit(wiki_root: Path, rel_path: str) -> str:
    """SHA du dernier commit touchant `rel_path`. Pas de sentinelle : échoue fort."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%H", "--", rel_path],
            cwd=wiki_root,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        raise click.ClickException(f"git unavailable for {rel_path}: {exc}") from exc
    sha = out.stdout.strip()
    if out.returncode != 0 or not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise click.ClickException(
            f"no commit found for {rel_path} (git repository with the file committed "
            f"is required): {out.stderr.strip()}"
        )
    return sha


def _export_source(slug: str, catalog: dict[str, dict]) -> dict:
    """Source résolue ; `_pNN` normalisé comme `quality-gates.gate_diagnostic_relations`."""
    catalog_slug = _PART_SUFFIX.sub("", slug)
    entry = catalog.get(catalog_slug)
    if entry is None:
        raise click.ClickException(
            f"source slug unknown to the catalog: {slug!r} (normalised {catalog_slug!r})"
        )
    raw_ref = entry.get("raw_ref")
    return {
        "slug": slug,
        "catalog_slug": catalog_slug,
        "type": entry.get("type"),
        "status": entry["status"],
        "raw_ref": raw_ref if raw_ref else None,
        "raw_proven": is_page_proven(entry),
    }


def _export_relation(index: int, item: dict, catalog: dict[str, dict]) -> dict:
    evidence = item["evidence"]
    return {
        "relation_index": index,
        "relation_sha256": _sha256_prefixed(_canonical_json(item)),
        "symptom_slug": item["symptom_slug"],
        "system_slug": item["system_slug"],
        "relation_to_part": item["relation_to_part"],
        "part_role": item["part_role"],
        "evidence": {
            "confidence": evidence["confidence"],
            "source_policy": evidence["source_policy"],
            "reviewed": evidence["reviewed"],
            "diagnostic_safe": evidence["diagnostic_safe"],
        },
        # La cohérence valeur écrite ↔ formule est portée par
        # `compute-symptom-confidence.py --check --all` (CI wiki) : on appelle la même
        # formule, on ne re-vérifie pas la fiche.
        "confidence_score_computed": compute_score(item["sources"], catalog),
        "sources": [_export_source(slug, catalog) for slug in item["sources"]],
    }


def is_eligible(fm: dict) -> bool:
    """Fiche approuvée portant au moins une diagnostic_relation."""
    return fm.get("review_status") == "approved" and bool(fm.get("diagnostic_relations"))


def build_gamme_export(
    fm: dict,
    source_path: Path,
    wiki_root: Path,
    catalog: dict[str, dict],
    commit_sha: str,
    catalog_commit: str,
) -> dict:
    """Export d'une fiche éligible (`is_eligible(fm)` vrai)."""
    slug = fm.get("slug")
    if slug != source_path.stem:
        raise click.ClickException(
            f"frontmatter slug {slug!r} differs from file name {source_path.name}"
        )
    exported = [
        _export_relation(i, item, catalog) for i, item in enumerate(fm["diagnostic_relations"])
    ]
    return {
        "schema_version": SCHEMA_VERSION,
        "builder_version": BUILDER_VERSION,
        "export_kind": "diagnostic_gamme",
        "gamme_slug": slug,
        "wiki_path": source_path.resolve().relative_to(wiki_root.resolve()).as_posix(),
        "source_wiki_commit": commit_sha,
        "source_catalog_commit": catalog_commit,
        "content_hash": _sha256_prefixed(_canonical_json(exported)),
        "relations": exported,
    }


def _serialise(payload: dict) -> bytes:
    # Newline final : le WIKI lint via end-of-file-fixer.
    return (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _write_strict(out_path: Path, data: bytes, wiki_root: Path) -> None:
    """Refuse toute écriture hors `exports/diagnostic/`."""
    try:
        rel = out_path.resolve().relative_to((wiki_root / EXPORTS_REL).resolve())
    except ValueError as exc:
        raise click.ClickException(f"refused: {out_path} is outside {EXPORTS_REL}/") from exc
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(data)
    click.echo(f"OK {EXPORTS_REL / rel}", err=True)


@click.command()
@click.option(
    "--wiki-root",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("/opt/automecanik/automecanik-wiki"),
    show_default=True,
)
@click.option("--format", "output_format", type=click.Choice(["text", "json"]), default="text")
def main(wiki_root: Path, output_format: str) -> None:
    """wiki/gamme/*.md approuvées avec diagnostic_relations → exports/diagnostic/."""
    if not (wiki_root / EXPORT_SCHEMA_REL).exists():
        click.echo(f"export schema not found: {wiki_root / EXPORT_SCHEMA_REL}", err=True)
        sys.exit(2)
    _assert_full_clone(wiki_root)

    catalog = _load_catalog(wiki_root)
    catalog_commit = _last_commit(wiki_root, CATALOG_REL)

    payloads: list[dict] = []
    gamme_dir = wiki_root / "wiki" / "gamme"
    for src in sorted(gamme_dir.glob("*.md")) if gamme_dir.is_dir() else []:
        fm, _body = _parse_markdown(src)
        if not is_eligible(fm):
            continue
        rel = src.resolve().relative_to(wiki_root.resolve()).as_posix()
        payloads.append(
            build_gamme_export(fm, src, wiki_root, catalog, _last_commit(wiki_root, rel), catalog_commit)
        )

    exports_root = wiki_root / EXPORTS_REL
    expected = {exports_root / "gamme" / f"{p['gamme_slug']}.json" for p in payloads}
    existing = {p for p in (exports_root / "gamme").glob("*.json") if p.is_file()}
    unreconciled = sorted(existing - expected)
    if unreconciled:
        observations = [
            {"export_path": p.relative_to(wiki_root).as_posix(), "withdrawal_authorized": False}
            for p in unreconciled
        ]
        if output_format == "json":
            click.echo(json.dumps(
                {"status": "UNRECONCILED", "written": 0, "observations": observations},
                ensure_ascii=False, indent=2, sort_keys=True,
            ))
        for obs in observations:
            click.echo(f"UNRECONCILED {obs['export_path']} (preserved)", err=True)
        raise click.ClickException(
            "Retained diagnostic exports have no eligible fiche; governed withdrawal "
            "(WIKI PR deleting the export) required before publication."
        )

    files = []
    for payload in sorted(payloads, key=lambda p: p["gamme_slug"]):
        data = _serialise(payload)
        _write_strict(exports_root / "gamme" / f"{payload['gamme_slug']}.json", data, wiki_root)
        files.append({
            "path": f"gamme/{payload['gamme_slug']}.json",
            "sha256": _sha256_prefixed(data),
            "source_wiki_commit": payload["source_wiki_commit"],
            "relation_count": len(payload["relations"]),
        })
    index = {
        "schema_version": SCHEMA_VERSION,
        "builder_version": BUILDER_VERSION,
        "export_kind": "diagnostic_index",
        "source_catalog_commit": catalog_commit,
        "files": files,
    }
    _write_strict(exports_root / "_index.json", _serialise(index), wiki_root)

    if output_format == "json":
        click.echo(json.dumps(
            {"status": "OK", "written": len(files), "observations": []},
            ensure_ascii=False, indent=2, sort_keys=True,
        ))
    else:
        click.echo(f"total: exported={len(files)}")
    sys.exit(0)


if __name__ == "__main__":
    main()
```

Puis `chmod +x _scripts/build_exports_diagnostic.py`.

- [ ] **Étape 6 : vérifier que tout passe, puis avec l'environnement minimal de la CI**

```bash
cd _scripts && python3 -m pytest test_build_exports_diagnostic.py -q; cd ..
python3 -m venv "$SCRATCH/venv-ci"
"$SCRATCH/venv-ci/bin/pip" install -q "click>=8.1,<9" "pyyaml>=6.0,<7" "jsonschema>=4.20,<5" "pytest>=7.4,<9"
(cd _scripts && "$SCRATCH/venv-ci/bin/python" -m pytest test_build_exports_diagnostic.py -q | tail -1)
```

Attendu : `42 passed` deux fois. Le second venv reproduit exactement l'installation du job CI de la Tâche 3.

- [ ] **Étape 7 : commit**

```bash
git add _scripts/test_build_exports_diagnostic.py _meta/schema/exports-diagnostic.schema.json _scripts/build_exports_diagnostic.py
git commit -F - <<'EOF'
feat(exports): vue dérivée exports/diagnostic/ des diagnostic_relations approuvées

Builder déterministe (0 LLM, 0 DB) : un export par gamme approuvée portant des
diagnostic_relations, sources résolues contre le catalogue strict, raw_proven =
prédicat G1 is_page_proven. Commits dérivés de git log -1 par fichier, jamais
de HEAD ni d'horodatage. Export sans fiche éligible = UNRECONCILED, conservé,
exit 1. Schéma draft 2020-12 par $ref vers les schémas canoniques.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Étape 8 : mutations — chaque garde du builder doit avoir un test qui la tue**

```bash
B=_scripts/build_exports_diagnostic.py
mutate() {
  echo "=== mutation : $1"
  sed -i "$1" "$B"
  git diff --quiet -- "$B" && { echo "SED SANS EFFET — mutation non appliquée"; return 1; }
  (cd _scripts && python3 -m pytest test_build_exports_diagnostic.py -q 2>&1 | grep -E '^FAILED|passed|failed')
  git checkout -- "$B"
}
mutate 's/"raw_proven": is_page_proven(entry),/"raw_proven": entry["status"] == "active",/'
mutate 's/\["git", "log", "-1", "--format=%H", "--", rel_path\]/["git", "rev-parse", "HEAD"]/'
mutate 's/    if unreconciled:/    if False and unreconciled:/'
mutate 's/indent=2) + "\\n")/indent=2))/'
git status --short -- "$B"
```

Attendu :
- M1 (`raw_proven` = status seul) → `1 failed` : `test_raw_proven_is_the_g1_predicate` ;
- M2 (HEAD au lieu du dernier commit du fichier) → `3 failed` : `test_commits_are_the_last_ones_touching_fiche_and_catalog`, `test_no_wall_clock_nor_head["HEAD"]`, `test_no_wall_clock_nor_head[rev-parse]` ;
- M3 (UNRECONCILED désactivé) → `1 failed` : `test_export_without_eligible_fiche_is_preserved_and_fails` ;
- M4 (sans newline final) → `1 failed` : `test_written_files_end_with_newline` ;
- `git status` final vide (fichier restauré). Une mutation qui survit (`42 passed`) est un trou de test : l'ajouter avant de continuer.

- [ ] **Étape 9 : contrôle sur le canon réel**

```bash
rm -rf "$SCRATCH/wiki-real"
git clone -q --no-local --branch feat/diagnostic-exports /opt/automecanik/automecanik-wiki "$SCRATCH/wiki-real"
cd "$SCRATCH/wiki-real"
grep -l '^review_status: approved' $(grep -l '^diagnostic_relations:' wiki/gamme/*.md) | wc -l
python3 _scripts/build_exports_diagnostic.py --wiki-root .
sha256sum exports/diagnostic/_index.json exports/diagnostic/gamme/*.json > "$SCRATCH/real.sha256"
python3 _scripts/build_exports_diagnostic.py --wiki-root . > /dev/null 2>&1
sha256sum -c "$SCRATCH/real.sha256"
for f in exports/diagnostic/gamme/*.json exports/diagnostic/_index.json; do
  ajv validate --spec=draft2020 -c ajv-formats --strict=false \
    -s _meta/schema/exports-diagnostic.schema.json \
    -r _meta/schema/frontmatter.schema.json \
    -r _meta/schema/source-catalog-entry.schema.json -d "$f"
done
jq -c '[.relations[].sources[].raw_proven] | unique' exports/diagnostic/gamme/*.json
jq -r '.files[].path' exports/diagnostic/_index.json
cd /opt/automecanik/automecanik-wiki-wt-diag-exports
```

Attendu sur la base `6e3a043` : le comptage `grep` affiche `3` ; le builder affiche `total: exported=3` ; `sha256sum -c` donne 4 × `OK` (re-run octet pour octet) ; ajv donne 4 × `valid` ; `jq` affiche `[false]` trois fois ; l'index liste `gamme/filtre-a-air.json`, `gamme/filtre-a-carburant.json`, `gamme/filtre-d-habitacle.json`. Sur une base plus récente, le nombre d'exports doit égaler le comptage `grep`. Ce clone reste dans `$SCRATCH` : rien n'est commité sous `exports/`.

---

### Tâche 3 : CI WIKI — valider `exports/diagnostic/` (même branche et même PR que la Tâche 2)

**Files:**
- Modify: `.github/workflows/wiki-quality-gates.yml` (chemins push et pull_request ; nouveau job en fin de fichier)

**Interfaces:**
- Consumes : `_scripts/test_build_exports_diagnostic.py`, `_meta/schema/exports-diagnostic.schema.json` (Tâche 2).
- Produces : job `validate-exports-diagnostic` (pytest du builder + ajv des exports commités) ; `wiki-quality-gates` se déclenche aussi sur `exports/diagnostic/**`, donc sur chaque commit du bot (Tâche 4).

- [ ] **Étape 1 : appliquer le diff**

Depuis `/opt/automecanik/automecanik-wiki-wt-diag-exports`, écrire ce diff dans `$SCRATCH/task3.diff`, puis `git apply "$SCRATCH/task3.diff"` :

```diff
diff --git a/.github/workflows/wiki-quality-gates.yml b/.github/workflows/wiki-quality-gates.yml
index d665b03..40d7033 100644
--- a/.github/workflows/wiki-quality-gates.yml
+++ b/.github/workflows/wiki-quality-gates.yml
@@ -14,6 +14,7 @@ on:
       - '_scripts/tests/**'
       - '_meta/schema/**'
       - '_meta/source-catalog.yaml'
+      - 'exports/diagnostic/**'
   pull_request:
     paths:
       - 'proposals/**/*.md'
@@ -22,6 +23,7 @@ on:
       - '_scripts/tests/**'
       - '_meta/schema/**'
       - '_meta/source-catalog.yaml'
+      - 'exports/diagnostic/**'
   workflow_dispatch:
 
 permissions:
@@ -167,3 +169,43 @@ jobs:
               -s _meta/schema/exports-seo.schema.json -d "$f"
           done
         shell: bash
+
+  validate-exports-diagnostic:
+    name: Validate exports/diagnostic/ (ajv + builder pytest)
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "20"
+      - uses: actions/setup-python@v5
+        with:
+          python-version: "3.12"
+      - name: Install Python deps
+        run: pip install --quiet "click>=8.1,<9" "pyyaml>=6.0,<7" "jsonschema>=4.20,<5" "pytest>=7.4,<9"
+      - name: Install ajv-cli + ajv-formats
+        run: npm install -g ajv-cli@5 ajv-formats
+      - name: Pytest builder + schema
+        run: cd _scripts && python3 -m pytest test_build_exports_diagnostic.py -v
+      - name: ajv-validate existing exports/diagnostic/*.json (no-op if empty)
+        # Schéma draft 2020-12 dont les champs sont des $ref vers les deux schémas
+        # canoniques : ils sont chargés avec -r, rien n'est recopié.
+        run: |
+          set -e
+          if [[ ! -d exports/diagnostic ]]; then
+            echo "no exports/diagnostic/ yet — skipping ajv validation"
+            exit 0
+          fi
+          # Dès que le répertoire existe, l'index est exigé : un index absent fait échouer
+          # ajv (le nom reste dans la liste, nullglob ne retire que les motifs).
+          shopt -s nullglob
+          files=(exports/diagnostic/_index.json exports/diagnostic/gamme/*.json)
+          for f in "${files[@]}"; do
+            echo "=== ajv $f ==="
+            ajv validate --spec=draft2020 -c ajv-formats --strict=false \
+              -s _meta/schema/exports-diagnostic.schema.json \
+              -r _meta/schema/frontmatter.schema.json \
+              -r _meta/schema/source-catalog-entry.schema.json \
+              -d "$f"
+          done
+        shell: bash
```

Run : `actionlint .github/workflows/wiki-quality-gates.yml && echo ACTIONLINT_OK`
Attendu : `ACTIONLINT_OK`.

- [ ] **Étape 2 : rejouer localement les deux steps du nouveau job, dans les trois états possibles**

Le step ajv est lu dans le YAML (rien n'est recopié), puis exécuté sur la branche (aucun export), sur le clone `$SCRATCH/wiki-real` de la Tâche 2 Étape 9 (exports générés), puis sur ce même clone sans index.

```bash
(cd _scripts && python3 -m pytest test_build_exports_diagnostic.py -q | tail -1)
STEP="$(python3 -c 'import yaml; s=yaml.safe_load(open(".github/workflows/wiki-quality-gates.yml"))["jobs"]["validate-exports-diagnostic"]["steps"]; print(next(x["run"] for x in s if x.get("name","").startswith("ajv-validate existing")))')"
echo "--- branche"; bash -eo pipefail -c "$STEP"; echo "exit=$?"
echo "--- exports générés"; (cd "$SCRATCH/wiki-real" && bash -eo pipefail -c "$STEP") > "$SCRATCH/ajv-real.log" 2>&1; echo "exit=$?"; grep -v '^===' "$SCRATCH/ajv-real.log"
rm -f "$SCRATCH/wiki-real/exports/diagnostic/_index.json"
echo "--- index absent"; (cd "$SCRATCH/wiki-real" && bash -eo pipefail -c "$STEP") > "$SCRATCH/ajv-noindex.log" 2>&1; echo "exit=$?"; grep -m1 'Cannot find data file' "$SCRATCH/ajv-noindex.log"
```

Attendu :
- `42 passed` ;
- branche : `no exports/diagnostic/ yet — skipping ajv validation`, `exit=0` ;
- exports générés : `exit=0`, puis `exports/diagnostic/_index.json valid` et les 3 exports de gamme `valid` ;
- index absent : un `exit=` non nul, puis la ligne `error:  Cannot find data file exports/diagnostic/_index.json …`. L'Étape 9 de la Tâche 2 régénère ce clone si l'on doit rejouer. Dès que `exports/diagnostic/` existe, l'index est exigé : `nullglob` ne retire que les motifs, pas un nom littéral.

- [ ] **Étape 3 : commit**

```bash
git add .github/workflows/wiki-quality-gates.yml
git commit -F - <<'EOF'
ci(wiki): valider exports/diagnostic/ (pytest du builder + ajv)

wiki-quality-gates se déclenche aussi sur exports/diagnostic/** ; le job
validate-exports-diagnostic lance les 42 tests du builder et valide chaque
export commité contre exports-diagnostic.schema.json (+ les deux schémas
canoniques en -r). Dès que exports/diagnostic/ existe, l'index est exigé :
un _index.json absent fait échouer le job.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Étape 4 : PR des Tâches 2 et 3 (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin feat/diagnostic-exports
gh pr create --repo ak125/automecanik-wiki --base main --head feat/diagnostic-exports \
  --title "feat(exports): vue dérivée exports/diagnostic/ des diagnostic_relations approuvées" \
  --body-file - <<'EOF'
## Quoi
Builder `_scripts/build_exports_diagnostic.py` + schéma `exports-diagnostic.schema.json` +
job CI `validate-exports-diagnostic`. Aucune fiche modifiée, aucun export commité ici :
les exports seront écrits par le bot du monorepo.

## Contrat
- fiches `wiki/gamme/*.md` approuvées avec `diagnostic_relations` non vide ;
- sources résolues contre le catalogue strict ; `raw_proven` = prédicat G1 `is_page_proven` ;
- déterministe : commits dérivés de `git log -1` par fichier, ni HEAD ni horodatage ;
- export sans fiche éligible = `UNRECONCILED`, conservé, exit 1.

## Preuve
- 42 tests ; 4 mutations du builder toutes tuées ;
- canon réel : 3 exports, re-run octet pour octet identique, ajv valide, toutes les
  sources `raw_proven: false` ;
- step ajv rejoué dans les 3 états : aucun export (skip, exit 0), exports générés
  (4 fichiers valides), index supprimé (échec explicite).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Attendu sur la PR : `validate-exports-diagnostic` vert, avec `42 passed` et le message de skip ajv dans le log ; les autres jobs de `wiki-quality-gates` verts.

---

### Tâche 4 : workflow monorepo `wiki-exports-diagnostic-generate.yml`

**Files:**
- Create: `.github/workflows/wiki-exports-diagnostic-generate.yml`

**Interfaces:**
- Consumes : CLI `build_exports_diagnostic.py --wiki-root <dir> --format json` et schéma `exports-diagnostic.schema.json` sur `main` du WIKI (Tâches 2-3 fusionnées) ; secret existant `WIKI_REPO_TOKEN`.
- Produces : commit `chore(exports-diagnostic): projection <date>` de `automecanik-bot` sur `main` du WIKI, qui ne touche que `exports/diagnostic/` ; artefacts `exports-diagnostic-<run_id>` et `exports-diagnostic-build-report-<run_id>` ; no-op quand le canon n'a pas bougé.

- [ ] **Étape 1 : précondition — le builder est sur `main` du WIKI**

```bash
git -C /opt/automecanik/automecanik-wiki fetch origin
git -C /opt/automecanik/automecanik-wiki ls-tree --name-only origin/main _scripts/build_exports_diagnostic.py _meta/schema/exports-diagnostic.schema.json
```

Attendu : les deux chemins. Sinon STOP : la PR des Tâches 2-3 n'est pas fusionnée.

- [ ] **Étape 2 : créer le worktree monorepo**

```bash
git -C /opt/automecanik/app fetch origin
git -C /opt/automecanik/app worktree add -b feat/wiki-exports-diagnostic-generate /opt/automecanik/app/.claude/worktrees/diag-exports-generate origin/main
cd /opt/automecanik/app/.claude/worktrees/diag-exports-generate
```

Puis lancer le bloc **Préparation** (attendu : `ENV_OK …`). La simulation de l'Étape 6 prend `python3` et `ajv` dans ce `PATH`.

- [ ] **Étape 3 : écrire le workflow**

Créer `.github/workflows/wiki-exports-diagnostic-generate.yml` :

```yaml
name: wiki-exports-diagnostic-generate

# Provenance WIKI des relations diagnostic (spec
# docs/superpowers/specs/2026-09-30-diagnostic-wiki-provenance-design.md §4.2) —
# génération périodique de la vue dérivée diagnostic depuis le wiki canon approuvé
# vers automecanik-wiki/exports/diagnostic/.
#
# Pipeline gouverné (RAW → WIKI → exports → consumers) :
#   wiki/gamme/<slug>.md (review_status: approved, diagnostic_relations non vide)
#     ↓ _scripts/build_exports_diagnostic.py  (filtre + transforme, 0 LLM / 0 DB / 0 enrichissement)
#   exports/diagnostic/gamme/<slug>.json + exports/diagnostic/_index.json  (commit, Pattern B)
#
# Le writer de projection diagnostic (côté backend, spec §4.4-4.5) consommera ensuite
# exports/diagnostic/ vers la DB. CE job ne fait QUE produire + committer les exports.
#
# Idempotent par construction : le builder n'écrit aucun horodatage ; il dérive
# source_wiki_commit du DERNIER commit touchant chaque fiche et source_catalog_commit
# du dernier commit touchant _meta/source-catalog.yaml (jamais du HEAD). Un run sur un
# canon inchangé reproduit des octets identiques → le diff gate est un no-op.
#
# Modèle : wiki-exports-seo-generate.yml (même secret WIKI_REPO_TOKEN, même identité
# bot, même diff-idempotent-puis-commit, même push direct sur wiki main).
# DELTA : chemins exports/diagnostic ; le schéma d'export est en draft 2020-12 et
# référence frontmatter.schema.json + source-catalog-entry.schema.json (chargés en -r).
#
# OÙ ÇA TOURNE : `runs-on: ubuntu-latest` = runner GitHub CLOUD, PAS la machine DEV.
# Le seul runner self-hosted du repo n'a PAS le label `ubuntu-latest`.
#
# AVAL (hors scope ici) : le writer de projection tourne dans le backend NestJS du
# conteneur PROD, sous GO owner (migration + GRANT + drapeau). Jamais sur DEV.
#
# Course de push : diag-canon (02:00) et exports-seo (02:15) poussent aussi sur wiki
# main. Un push concurrent fait échouer `git push` en non-fast-forward (rouge, visible) ;
# le job étant idempotent, le run suivant rattrape. Aucun rebase automatique.
#
# Secrets requis (monorepo Settings → Secrets and variables → Actions) :
#   - WIKI_REPO_TOKEN : PAT / GitHub App token avec contents:write sur
#                       ak125/automecanik-wiki (commit des exports/).

on:
  schedule:
    # Quotidien 02:30 UTC — après diag-canon-slugs-export (02:00) et
    # wiki-exports-seo-generate (02:15). No-op si le canon n'a pas bougé.
    - cron: '30 2 * * *'
  workflow_dispatch:
  # Pas de trigger sur PR ni sur push : le job écrit dans un autre repo (wiki).

permissions:
  contents: read

jobs:
  generate-and-commit:
    name: 🌙 Generate exports/diagnostic/ from wiki canon and commit back
    runs-on: ubuntu-latest
    steps:
      - name: Checkout automecanik-wiki (SOURCE canon AND commit target)
        uses: actions/checkout@v7
        with:
          repository: ak125/automecanik-wiki
          path: automecanik-wiki
          token: ${{ secrets.WIKI_REPO_TOKEN }}
          ref: main
          # fetch-depth: 0 — le builder fait `git log -1 -- <fichier>` pour la fiche
          # et le catalogue, et refuse un shallow clone (_assert_full_clone).
          fetch-depth: 0

      - name: Setup Python
        uses: actions/setup-python@v7
        with:
          python-version: '3.12'

      - name: Install builder deps (pure Python — pas de DB, pas de LLM)
        run: pip install --quiet "click>=8.1,<9" "pyyaml>=6.0,<7"

      - name: Run builder — filter + transform only (0 LLM / 0 DB / 0 enrichment)
        run: |
          set -eo pipefail
          # AUCUNE purge préalable : un export existant sans fiche éligible est
          # rapporté UNRECONCILED → exit 1, rien n'est écrit, l'export publié est
          # conservé. Le retrait est une PR WIKI qui supprime l'export (spec §4.2).
          python3 automecanik-wiki/_scripts/build_exports_diagnostic.py \
            --wiki-root "$GITHUB_WORKSPACE/automecanik-wiki" \
            --format json | tee "$GITHUB_WORKSPACE/exports-diagnostic-build-report.json"
          echo "---exports/diagnostic/ produits---"
          find automecanik-wiki/exports/diagnostic -name '*.json' -printf '%p (%s bytes)\n' | sort

      - name: Assert exports/diagnostic not gitignored (fail LOUD)
        run: |
          cd automecanik-wiki
          # _index.json est toujours écrit (même à 0 export) : c'est l'échantillon.
          # S'il est gitignored, `git add` l'ignorerait → no-op invisible.
          if git check-ignore -q exports/diagnostic/_index.json; then
            echo "FATAL: exports/diagnostic/ est gitignored sur wiki main."
            echo "       (git add -f NON utilisé : masquerait le vrai problème.)"
            exit 1
          fi

      - name: ajv-validate exports/diagnostic/*.json (fail-fast avant commit)
        run: |
          npm install -g ajv-cli@5 ajv-formats
          set -e
          shopt -s nullglob
          files=(automecanik-wiki/exports/diagnostic/gamme/*.json automecanik-wiki/exports/diagnostic/_index.json)
          for f in "${files[@]}"; do
            echo "=== ajv $f ==="
            ajv validate --spec=draft2020 -c ajv-formats --strict=false \
              -s automecanik-wiki/_meta/schema/exports-diagnostic.schema.json \
              -r automecanik-wiki/_meta/schema/frontmatter.schema.json \
              -r automecanik-wiki/_meta/schema/source-catalog-entry.schema.json \
              -d "$f"
          done

      - name: Stage + diff gate (catches new files AND deletions)
        id: diff
        run: |
          cd automecanik-wiki
          # --cached voit les fichiers NEUFS ; -A capture les suppressions (qui ne
          # peuvent venir que d'un retrait gouverné déjà commité côté wiki).
          git add -A exports/diagnostic/
          if git diff --cached --quiet -- exports/diagnostic/; then
            echo "[diff] exports/diagnostic/ identical — idempotent no-op"
            echo "diff_status=identical" >> "$GITHUB_OUTPUT"
          else
            echo "[diff] exports/diagnostic/ changed:"
            git --no-pager diff --cached --stat -- exports/diagnostic/
            echo "diff_status=changed" >> "$GITHUB_OUTPUT"
          fi

      - name: Commit and push to wiki repo
        if: steps.diff.outputs.diff_status != 'identical'
        run: |
          cd automecanik-wiki
          git config user.name "automecanik-bot"
          git config user.email "automecanik-bot@users.noreply.github.com"
          DATE=$(date -u +%Y-%m-%d)
          git commit -m "chore(exports-diagnostic): projection ${DATE}" \
            -m "Auto-generated by nestjs-remix-monorepo .github/workflows/wiki-exports-diagnostic-generate.yml" \
            -m "Source : wiki/gamme/*.md (review_status=approved, diagnostic_relations non vide) via _scripts/build_exports_diagnostic.py" \
            -m "DO NOT EDIT manually — re-run the workflow to refresh."
          git push origin main

      - name: Upload exports/diagnostic as artifact
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: exports-diagnostic-${{ github.run_id }}
          path: automecanik-wiki/exports/diagnostic/
          retention-days: 30

      - name: Upload builder report (observations UNRECONCILED incluses)
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: exports-diagnostic-build-report-${{ github.run_id }}
          path: exports-diagnostic-build-report.json
          if-no-files-found: warn
          retention-days: 30
```

- [ ] **Étape 4 : lint et gate de propriété**

```bash
actionlint .github/workflows/wiki-exports-diagnostic-generate.yml && echo ACTIONLINT_OK
git add .github/workflows/wiki-exports-diagnostic-generate.yml
node scripts/registry/check-new-files.js --base origin/main; echo "exit=$?"
```

Attendu : `ACTIONLINT_OK` ; puis `new files: 1 (1 ok, 0 failures)`, `✓ All new files pass owner+domain gate`, `exit=0`.

- [ ] **Étape 5 : les dépendances installées par le workflow suffisent au builder**

```bash
DEPS=$(sed -n 's/^ *run: pip install --quiet //p' .github/workflows/wiki-exports-diagnostic-generate.yml)
rm -rf "$SCRATCH/venv-wf" "$SCRATCH/wf-real"
python3 -m venv "$SCRATCH/venv-wf" && eval "\"$SCRATCH/venv-wf/bin/pip\" install -q $DEPS"
gh repo clone ak125/automecanik-wiki "$SCRATCH/wf-real" -- -q
"$SCRATCH/venv-wf/bin/python" "$SCRATCH/wf-real/_scripts/build_exports_diagnostic.py" --wiki-root "$SCRATCH/wf-real" --format json; echo "exit=$?"
```

Attendu : `"status": "OK"`, `"written": 3` (sur le canon `6e3a043` ; sinon le comptage `grep` de la Tâche 2 Étape 9), `exit=0`. Un `ModuleNotFoundError` signifie que le step `Install builder deps` est incomplet : le corriger dans le workflow, pas dans le venv.

- [ ] **Étape 6 : simulation des steps du workflow (5 scénarios)**

Écrire ce script dans `$SCRATCH/sim_generate.py` (il n'est commité nulle part). Il lit les blocs `run:` dans le YAML — rien n'est recopié — et les exécute contre un dépôt « distant » nu local : aucun push ne quitte la machine.

```python
#!/usr/bin/env python3
"""Rejoue localement les steps shell de wiki-exports-diagnostic-generate.yml.

Les blocs `run:` sont lus dans le YAML du workflow, jamais recopiés, et exécutés
contre un dépôt « distant » nu local : aucun push ne quitte la machine. Deux
adaptations seulement : `npm install -g ajv-cli…` est neutralisé (ajv est déjà dans
PATH) et `$GITHUB_OUTPUT` / `$GITHUB_WORKSPACE` sont fournis. Le shell est celui
d'Actions (`bash --noprofile --norc -eo pipefail`).

Usage : sim_generate.py <workflow.yml> <seed-wiki-clone> <sim-dir>
Le seed doit être sur `main` et ne pas contenir exports/diagnostic/.

Scénarios :
  1. premier run                → commit bot, fichiers sous exports/diagnostic/ seulement
  2. re-run, canon inchangé     → no-op (diff_status=identical), aucun commit
  3. export orphelin sur main   → builder exit 1, rapport UNRECONCILED, aucun commit
  4. retrait gouverné (PR WIKI) → re-run no-op : l'orphelin supprimé, rien à republier
  5. course au push             → push refusé (non fast-forward), run rouge, rien d'écrasé ;
                                   le run suivant rattrape
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

import yaml

STEPS = [
    "Run builder — filter + transform only (0 LLM / 0 DB / 0 enrichment)",
    "Assert exports/diagnostic not gitignored (fail LOUD)",
    "ajv-validate exports/diagnostic/*.json (fail-fast avant commit)",
    "Stage + diff gate (catches new files AND deletions)",
    "Commit and push to wiki repo",
]
PUSH_STEP = STEPS[-1]
INSTALL_LINE = "npm install -g ajv-cli@5 ajv-formats"


def sh(cmd: list[str], cwd: Path) -> str:
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def load_steps(workflow: Path) -> dict[str, str]:
    job = yaml.safe_load(workflow.read_text(encoding="utf-8"))["jobs"]["generate-and-commit"]
    runs = {s["name"]: s["run"] for s in job["steps"] if "run" in s}
    missing = [n for n in STEPS if n not in runs]
    if missing:
        raise SystemExit(f"steps absents du workflow : {missing}")
    if INSTALL_LINE not in runs[STEPS[2]]:
        raise SystemExit(f"ligne d'installation ajv introuvable : {INSTALL_LINE!r}")
    return runs


def run_workflow(
    runs: dict[str, str], sim: Path, before_push: Callable[[], None] | None = None
) -> tuple[int, str]:
    """Rejoue les steps dans l'ordre ; s'arrête au premier échec, comme Actions."""
    work = sim / "run"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir()
    sh(["git", "clone", "--quiet", str(sim / "remote.git"), "automecanik-wiki"], work)
    output = work / "github_output"
    output.write_text("")
    env = {**os.environ, "GITHUB_WORKSPACE": str(work), "GITHUB_OUTPUT": str(output)}
    for name in STEPS:
        if name == PUSH_STEP:
            if "diff_status=identical" in output.read_text():
                print(f"  skip: {name} (diff_status=identical)")
                continue
            if before_push:
                before_push()
        script = runs[name].replace(INSTALL_LINE, ": ajv déjà dans PATH")
        proc = subprocess.run(
            ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", script],
            cwd=work, capture_output=True, text=True, env=env,
        )
        print(f"  step: {name} → exit {proc.returncode}")
        if proc.returncode != 0:
            return proc.returncode, proc.stdout + proc.stderr
    return 0, output.read_text()


def remote_head(sim: Path) -> str:
    return sh(["git", "rev-parse", "main"], sim / "remote.git")


def changed_files(sim: Path, old: str, new: str) -> list[str]:
    return sh(["git", "diff", "--name-only", old, new], sim / "remote.git").splitlines()


def commit_on_remote(sim: Path, message: str, mutate: Callable[[Path], None]) -> str:
    """Commit « humain » (PR WIKI fusionnée, ou autre bot) poussé sur le distant."""
    clone = sim / "other"
    shutil.rmtree(clone, ignore_errors=True)
    sh(["git", "clone", "--quiet", str(sim / "remote.git"), str(clone)], sim)
    mutate(clone)
    sh(["git", "add", "-A"], clone)
    sh(["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", message], clone)
    sh(["git", "push", "-q", "origin", "main"], clone)
    return remote_head(sim)


def main() -> int:
    workflow, seed, sim = (Path(a).resolve() for a in sys.argv[1:4])
    runs = load_steps(workflow)
    if sh(["git", "branch", "--show-current"], seed) != "main":
        raise SystemExit("le seed doit être sur la branche main")
    if sh(["git", "ls-tree", "--name-only", "HEAD", "exports/diagnostic"], seed):
        raise SystemExit("le seed contient déjà exports/diagnostic/ : le workflow a déjà tourné")
    shutil.rmtree(sim, ignore_errors=True)
    sim.mkdir(parents=True)
    sh(["git", "clone", "--quiet", "--bare", str(seed), str(sim / "remote.git")], sim)
    verdict: dict[str, bool] = {}

    print("scénario 1 : premier run")
    before = remote_head(sim)
    code, _ = run_workflow(runs, sim)
    after = remote_head(sim)
    files = changed_files(sim, before, after) if after != before else []
    print(f"  exit={code} commit={'oui' if after != before else 'non'} fichiers={files}")
    verdict["1-commit"] = (
        code == 0 and after != before and bool(files)
        and all(f.startswith("exports/diagnostic/") for f in files)
    )

    print("scénario 2 : re-run sur canon inchangé")
    code, out = run_workflow(runs, sim)
    verdict["2-no-op"] = code == 0 and remote_head(sim) == after and "diff_status=identical" in out
    print(f"  exit={code} nouveau commit={'non' if remote_head(sim) == after else 'oui'}")

    print("scénario 3 : export orphelin sur main")
    orphan = Path("exports/diagnostic/gamme/zz-orphelin.json")

    def add_orphan(clone: Path) -> None:
        first = sorted((clone / "exports/diagnostic/gamme").glob("*.json"))[0]
        shutil.copy(first, clone / orphan)

    injected = commit_on_remote(sim, "orphan", add_orphan)
    code, _ = run_workflow(runs, sim)
    report = (sim / "run" / "exports-diagnostic-build-report.json").read_text()
    flagged = '"UNRECONCILED"' in report and orphan.as_posix() in report
    print(f"  exit={code} nouveau commit={'non' if remote_head(sim) == injected else 'oui'} "
          f"rapport UNRECONCILED={'oui' if flagged else 'non'}")
    verdict["3-orphelin-bloque"] = code != 0 and remote_head(sim) == injected and flagged

    print("scénario 4 : retrait gouverné (PR WIKI qui supprime l'export)")
    withdrawn = commit_on_remote(sim, "withdraw orphan", lambda c: (c / orphan).unlink())
    code, out = run_workflow(runs, sim)
    verdict["4-retrait-no-op"] = (
        code == 0 and remote_head(sim) == withdrawn and "diff_status=identical" in out
    )
    print(f"  exit={code} nouveau commit={'non' if remote_head(sim) == withdrawn else 'oui'}")

    print("scénario 5 : course au push avec un autre bot")

    def touch_catalog(clone: Path) -> None:
        with (clone / "_meta/source-catalog.yaml").open("a", encoding="utf-8") as fh:
            fh.write("# sim: catalogue modifié\n")

    catalog_head = commit_on_remote(sim, "catalog edit", touch_catalog)
    concurrent: list[str] = []

    def other_bot() -> None:
        def touch_seo(clone: Path) -> None:
            (clone / "exports/seo").mkdir(parents=True, exist_ok=True)
            (clone / "exports/seo/zz-sim.txt").write_text("autre bot\n", encoding="utf-8")
        concurrent.append(commit_on_remote(sim, "other bot", touch_seo))

    code, _ = run_workflow(runs, sim, before_push=other_bot)
    lost = remote_head(sim) != concurrent[0]
    print(f"  run en course : exit={code} commit concurrent préservé={'non' if lost else 'oui'}")
    raced_ok = code != 0 and not lost and concurrent[0] != catalog_head
    code, _ = run_workflow(runs, sim)
    caught_up = remote_head(sim)
    files = changed_files(sim, concurrent[0], caught_up) if caught_up != concurrent[0] else []
    print(f"  run suivant : exit={code} fichiers={files}")
    verdict["5-course-rattrapee"] = (
        raced_ok and code == 0 and bool(files)
        and all(f.startswith("exports/diagnostic/") for f in files)
    )

    print(f"verdict : {verdict}")
    return 0 if all(verdict.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
```

Puis :

```bash
rm -rf "$SCRATCH/gensim" && mkdir -p "$SCRATCH/gensim"
gh repo clone ak125/automecanik-wiki "$SCRATCH/gensim/seed" -- -q
test ! -e "$SCRATCH/gensim/seed/exports/diagnostic" && echo SEED_OK
python3 "$SCRATCH/sim_generate.py" .github/workflows/wiki-exports-diagnostic-generate.yml "$SCRATCH/gensim/seed" "$SCRATCH/gensim/run"; echo "exit=$?"
```

Attendu : `SEED_OK` ; le scénario 1 commite `exports/diagnostic/_index.json` et les 3 exports de gamme ; dernière ligne `verdict : {'1-commit': True, '2-no-op': True, '3-orphelin-bloque': True, '4-retrait-no-op': True, '5-course-rattrapee': True}` ; `exit=0`. Si le seed contient déjà `exports/diagnostic/` (premier dispatch déjà fait), supprimer ce dossier dans le seed et commiter localement avant de lancer.

- [ ] **Étape 7 : mutation — un push forcé doit être détecté**

```bash
sed 's/git push origin main/git push --force origin main/' .github/workflows/wiki-exports-diagnostic-generate.yml > "$SCRATCH/wf-force.yml"
grep -c 'git push --force origin main' "$SCRATCH/wf-force.yml"
python3 "$SCRATCH/sim_generate.py" "$SCRATCH/wf-force.yml" "$SCRATCH/gensim/seed" "$SCRATCH/gensim/run-force"; echo "exit=$?"
```

Attendu : `1`, puis `run en course : exit=0 commit concurrent préservé=non`, `'5-course-rattrapee': False`, `exit=1`.

- [ ] **Étape 8 : commit**

```bash
git commit -F - <<'EOF'
feat(ci): génération nocturne de exports/diagnostic/ du WIKI

Calqué sur wiki-exports-seo-generate.yml : checkout complet du WIKI, builder
build_exports_diagnostic.py (0 LLM, 0 DB), ajv, diff gate idempotent, commit
bot sur main du WIKI. 02:30 UTC, après diag-canon (02:00) et exports-seo
(02:15). Un push concurrent échoue en non fast-forward ; aucun rebase
automatique, le run suivant rattrape.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Étape 9 : PR (après confirmation explicite de l'utilisateur)**

```bash
git push -u origin feat/wiki-exports-diagnostic-generate
gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/wiki-exports-diagnostic-generate \
  --title "feat(ci): génération nocturne de exports/diagnostic/ du WIKI" \
  --body-file - <<'EOF'
## Quoi
Workflow `wiki-exports-diagnostic-generate.yml` : produit `exports/diagnostic/` sur `main`
du WIKI à partir des fiches approuvées, par le builder du WIKI. Aucun nouveau secret
(`WIKI_REPO_TOKEN` existant), aucune écriture DB, aucun changement runtime.

## Preuve
- actionlint vert ; gate de propriété des nouveaux fichiers verte ;
- builder lancé avec les seules dépendances installées par le workflow : 3 exports ;
- simulation locale des steps (5 scénarios : premier run, no-op, orphelin bloqué,
  retrait gouverné, course au push) toute verte ; une mutation `--force` du push est détectée.

## Après fusion
`workflow_dispatch` manuel, puis vérification du commit bot et de la CI du WIKI.
L'entrée `automation-reality` (owner) suit, puis le bump du sous-module et la ligne `COPY`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Étape 10 : premier run réel (après fusion humaine ET confirmation explicite de l'utilisateur)**

Le run est identifié par un id strictement supérieur au dernier dispatch connu avant le déclenchement : un `--limit 1` lu juste après `gh workflow run` peut renvoyer le run précédent (l'API met quelques secondes à lister le nouveau).

```bash
W=wiki-exports-diagnostic-generate.yml R=ak125/nestjs-remix-monorepo
PREV=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId // 0')
gh workflow run "$W" --repo "$R" --ref main
RUN=; for _ in $(seq 1 30); do
  RUN=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q ".[0].databaseId // empty | select(. > $PREV)")
  test -n "$RUN" && break; sleep 10
done
test -n "$RUN" || { echo "aucun nouveau run en 5 min : s'arrêter"; false; }
gh run watch "$RUN" --repo "$R" --exit-status
git -C /opt/automecanik/automecanik-wiki fetch origin
BOT=$(git -C /opt/automecanik/automecanik-wiki log -1 --format=%H origin/main -- exports/diagnostic)
git -C /opt/automecanik/automecanik-wiki show --format='%an | %s' --name-only "$BOT"
gh run list --repo ak125/automecanik-wiki --workflow wiki-quality-gates.yml --commit "$BOT" --json conclusion,event -q '.[] | "\(.event) \(.conclusion)"'
```

Attendu : run `success` ; commit de `automecanik-bot`, sujet `chore(exports-diagnostic): projection <date>`, exactement 4 fichiers sous `exports/diagnostic/` ; `push success` pour `wiki-quality-gates` sur ce commit (job `validate-exports-diagnostic` inclus). Si la Tâche 1 est fusionnée, le log de ce run contient `PASS activation-guard: … (base=<40 hex>, …)`.

- [ ] **Étape 11 : idempotence en réel (après confirmation explicite de l'utilisateur)**

```bash
W=wiki-exports-diagnostic-generate.yml R=ak125/nestjs-remix-monorepo
PREV=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q '.[0].databaseId // 0')
gh workflow run "$W" --repo "$R" --ref main
RUN=; for _ in $(seq 1 30); do
  RUN=$(gh run list --repo "$R" --workflow "$W" --event workflow_dispatch --limit 1 --json databaseId -q ".[0].databaseId // empty | select(. > $PREV)")
  test -n "$RUN" && break; sleep 10
done
test -n "$RUN" || { echo "aucun nouveau run en 5 min : s'arrêter"; false; }
gh run watch "$RUN" --repo "$R" --exit-status
gh run view "$RUN" --repo ak125/nestjs-remix-monorepo --log | grep -o '\[diff\] exports/diagnostic/ identical — idempotent no-op'
git -C /opt/automecanik/automecanik-wiki fetch origin && git -C /opt/automecanik/automecanik-wiki log -1 --format=%H origin/main -- exports/diagnostic
```

Attendu : run `success`, la ligne `identical — idempotent no-op`, et le même SHA que `$BOT` à l'étape 10.

---

### Tâche 5 : embarquer `exports/diagnostic` dans l'image Docker

Le build Docker (`build.yml`, appelé par le job `🐳 build` de `ci.yml`) ne tourne que sur push `main` : aucune CI de PR ne l'attrape. Une ligne `COPY` dont la source manque fait échouer le build (`--from=builder` sur un chemin absent), donc un build vert prouve que le dossier est dans l'image — et un build rouge casse `:preprod` pour tout le monde. D'où la gate avant la PR.

**Files:**
- Modify: `Dockerfile` (commentaire l.101-107, `COPY` après l.108)

**Interfaces:**
- Consumes : pin du sous-module `backend/content/automecanik-wiki` sur `origin/main` du monorepo contenant `exports/diagnostic/` (commit bot de la Tâche 4 + bump Dependabot fusionné).
- Produces : `/app/backend/content/automecanik-wiki/exports/diagnostic/` dans l'image, lu par le writer du Plan 2 depuis `cwd=/app/backend` (défaut `content/automecanik-wiki/exports/diagnostic`).

- [ ] **Étape 1 : gate — le pin contient `exports/diagnostic`**

```bash
git -C /opt/automecanik/app fetch origin
PIN=$(git -C /opt/automecanik/app ls-tree origin/main backend/content/automecanik-wiki | awk '{print $3}')
git -C /opt/automecanik/automecanik-wiki fetch origin
git -C /opt/automecanik/automecanik-wiki ls-tree --name-only "$PIN" exports/diagnostic
git -C /opt/automecanik/automecanik-wiki ls-tree -r --name-only "$PIN" exports/diagnostic
```

Attendu : `exports/diagnostic`, puis `_index.json` et les exports de gamme. Sortie vide : STOP, le bump du sous-module n'est pas fusionné. La PR Dependabot `gitsubmodule` est quotidienne et limitée à 1 PR ouverte ; si aucune n'apparaît sous 48 h, proposer à l'utilisateur une PR normale de bump du pin (jamais un push direct sur `main`).

- [ ] **Étape 2 : créer le worktree et appliquer le diff**

```bash
git -C /opt/automecanik/app worktree add -b feat/docker-exports-diagnostic /opt/automecanik/app/.claude/worktrees/diag-exports-docker origin/main
cd /opt/automecanik/app/.claude/worktrees/diag-exports-docker
```

Écrire ce diff dans `$SCRATCH/dockerfile.diff`, puis `git apply "$SCRATCH/dockerfile.diff"` :

```diff
diff --git a/Dockerfile b/Dockerfile
--- a/Dockerfile
+++ b/Dockerfile
@@ -98,14 +98,17 @@
 COPY --chown=remix-api:nodejs --from=builder /app/audit/registry ./audit/registry
 ENV REGISTRY_DIR=/app/audit/registry
 
-# 📚 Wiki SEO exports read by the SEO Projection feeder/writer (ADR-099 D2).
+# 📚 Wiki exports read by the SEO Projection feeder/writer (ADR-099 D2) and by the
+# diagnostic projection writer (`exports/diagnostic`, spec 2026-09-30 §4.2).
 # The embedded version is the submodule pin of the commit being built (build.yml
-# checks out with `submodules: true`); only `exports/seo` is copied, not the rest
-# of the wiki. Destination = the code default `content/automecanik-wiki/exports/seo`
-# resolved from cwd=/app/backend (start.sh "cd backend"). An uninitialised submodule
+# checks out with `submodules: true`); only `exports/seo` and `exports/diagnostic`
+# are copied, not the rest of the wiki. Destinations = the code defaults
+# `content/automecanik-wiki/exports/{seo,diagnostic}` resolved from cwd=/app/backend
+# (start.sh "cd backend"). An uninitialised submodule
 # leaves the source missing and FAILS the build: an image never ships an unknown
 # exports version. Copied from the builder stage (full source), like audit/registry.
 COPY --chown=remix-api:nodejs --from=builder /app/backend/content/automecanik-wiki/exports/seo ./backend/content/automecanik-wiki/exports/seo
+COPY --chown=remix-api:nodejs --from=builder /app/backend/content/automecanik-wiki/exports/diagnostic ./backend/content/automecanik-wiki/exports/diagnostic
 
 COPY --chown=remix-api:nodejs --from=builder /app/backend/start.sh ./backend/start.sh
 RUN chmod +x ./backend/start.sh
```

Run : `grep -n 'automecanik-wiki/exports' Dockerfile`
Attendu : deux lignes `COPY`, `exports/seo` puis `exports/diagnostic`, consécutives.

- [ ] **Étape 3 : commit**

```bash
git add Dockerfile
git commit -F - <<'EOF'
feat(docker): embarquer exports/diagnostic du WIKI dans l'image

Même mécanisme qu'exports/seo : copie depuis l'étage builder, version = pin
du sous-module du commit construit. Le pin contient exports/diagnostic
(vérifié par ls-tree avant cette PR) ; une source absente fait échouer le
build, jamais une image avec un export inconnu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Étape 4 : PR (après confirmation explicite de l'utilisateur)**

Relancer d'abord l'Étape 1 : le pin de `origin/main` doit toujours contenir `exports/diagnostic`.

```bash
git push -u origin feat/docker-exports-diagnostic
gh pr create --repo ak125/nestjs-remix-monorepo --base main --head feat/docker-exports-diagnostic \
  --title "feat(docker): embarquer exports/diagnostic du WIKI dans l'image" \
  --body-file - <<'EOF'
## Quoi
Une ligne `COPY` à côté de celle d'`exports/seo`, et le commentaire mis à jour.

## Gate
Le pin du sous-module sur `main` contient `exports/diagnostic` (`git ls-tree <pin>
exports/diagnostic`). Le build Docker ne tourne que sur push `main` : cette gate est la
seule protection avant fusion.

## Après fusion
Le job `🐳 build` de `ci.yml` pour le SHA de fusion doit être vert (une source absente
ferait échouer le `COPY`). Aucun changement de comportement : aucun code ne lit encore
ce dossier.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- [ ] **Étape 5 : preuve après fusion humaine**

```bash
SHA=$(gh pr view feat/docker-exports-diagnostic --repo ak125/nestjs-remix-monorepo --json mergeCommit -q .mergeCommit.oid)
RUN=$(gh run list --repo ak125/nestjs-remix-monorepo --workflow ci.yml --commit "$SHA" --event push --json databaseId -q '.[0].databaseId')
gh run view "$RUN" --repo ak125/nestjs-remix-monorepo --json jobs -q '.jobs[] | select(.name | test("build|Deploy PREPROD")) | "\(.name) \(.conclusion)"'
```

Attendu : les jobs `🐳 build` (et son sous-job `🐳 Build`) et `🧪 Deploy PREPROD` en `success`. Un run absent pour ce SHA n'est pas un succès (gate filtré par chemins ou run annulé par une fusion suivante) : le signaler, ne pas conclure. En cas de build rouge : PR de revert, jamais de push direct.

---

### Tâche 6 : diffs du registre L2 pour l'owner (`.spec/00-canon/**`, non commités par l'agent)

L'agent vérifie les deux diffs dans un worktree jetable, puis les remet à l'owner. Précédent de procédure : #1622 (`soft-404-events-retention`), où la modification de `automation-reality.yaml` a été suivie du patch de l'artefact `registry-recovery-<run_id>` du job « Registry freshness », appliqué tel quel (il régénère `audit/registry/canonical.json`, `REPO_MAP.md` et l'inventaire PR-8b, qui en dépendent).

**Files (owner):**
- Modify: `.spec/00-canon/repository-registry/automation-reality.yaml` (nouvelle entrée après l.404)
- Modify: `.spec/00-canon/repository-registry/pipelines.registry.json` (nouvelle entrée après l.53)

**Interfaces:**
- Consumes : `.github/workflows/wiki-exports-diagnostic-generate.yml` sur `main` (Tâche 4 ; le validateur exige que `evidence.path` soit dans `git ls-files` et que `excerpt` soit à la ligne 44) ; builder sur `main` du WIKI (Tâche 2).
- Produces : entrée `wiki-exports-diagnostic-generate` (DRAFTED, puis ACTIVE après un run prouvé) ; entrée pipeline `wiki_to_exports_diagnostic` (READY), dont le Plan 2 référencera l'aval `exports_diagnostic_to_db_projection`.

- [ ] **Étape 1 : diff automation-reality (après fusion de la Tâche 4)**

```diff
diff --git a/.spec/00-canon/repository-registry/automation-reality.yaml b/.spec/00-canon/repository-registry/automation-reality.yaml
index d786ce3ff..a74bf722e 100644
--- a/.spec/00-canon/repository-registry/automation-reality.yaml
+++ b/.spec/00-canon/repository-registry/automation-reality.yaml
@@ -402,3 +402,24 @@ entries:
     risk: "medium"
     related_pr: [1620]
     drift_note: "Purge = borne de stockage, sans lecteur aval : aucun code ne lit __soft_404_events ni v_soft_404_demand_30d (git grep main 2026-09-30). Runbook vault encore sur seo-routines."
+
+  # ──────────────────────────────────────────────────────────────────────────
+  # DRAFTED — export WIKI des diagnostic_relations (ADR-033) vers
+  # exports/diagnostic/, commit sur main du WIKI par le bot. Passe ACTIVE
+  # quand un run est prouvé : commit bot exports/diagnostic + CI WIKI verte.
+  # ──────────────────────────────────────────────────────────────────────────
+  - automation_id: "wiki-exports-diagnostic-generate"
+    domain: "D4"
+    intended_mode: "ACTIVE"
+    actual_mode: "DRAFTED"
+    executor: "github-actions-schedule"
+    evidence:
+      - path: ".github/workflows/wiki-exports-diagnostic-generate.yml"
+        line: 44
+        excerpt: "- cron: '30 2 * * *'"
+        note: "build_exports_diagnostic.py + ajv puis commit bot sur main du WIKI ; no-op si aucun diff"
+    last_verified_at: "2026-09-30"
+    last_verified_by: "@ak125"
+    last_verified_method: "manual-inspection"
+    missing_step: "fusion de la PR du workflow, puis un run workflow_dispatch prouvé : commit bot exports/diagnostic + wiki-quality-gates vert sur ce push"
+    risk: "low"
```

Vérification dans un worktree jetable à jour de `origin/main` :

```bash
git -C /opt/automecanik/app worktree add --detach "$SCRATCH/l2chk" origin/main
cd "$SCRATCH/l2chk"
git apply "$SCRATCH/l2-automation.diff"
npm run -s registry:validate:automation
```

Attendu : `[validate-automation-overlay] ✓ all N entries valid (evidence paths exist, excerpts match, seed markers consistent)` avec N = entrées de `main` + 1 (18 au 2026-09-30). Remplacer `last_verified_at` par la date d'application.

- [ ] **Étape 2 : diff pipelines (après fusion des Tâches 2 et 4)**

```diff
diff --git a/.spec/00-canon/repository-registry/pipelines.registry.json b/.spec/00-canon/repository-registry/pipelines.registry.json
index 0c2830e..a5a8a9b 100644
--- a/.spec/00-canon/repository-registry/pipelines.registry.json
+++ b/.spec/00-canon/repository-registry/pipelines.registry.json
@@ -51,6 +51,20 @@
       "owner_pr": "followup-task (hors PR-0..7)",
       "adr": "ADR-058"
     },
+    {
+      "id": "wiki_to_exports_diagnostic",
+      "from": "automecanik-wiki/wiki/gamme/",
+      "to": "automecanik-wiki/exports/diagnostic/{gamme/*.json,_index.json}",
+      "kind": "filtered_view",
+      "status": "READY",
+      "scripts": [
+        "automecanik-wiki/_scripts/build_exports_diagnostic.py",
+        "app/.github/workflows/wiki-exports-diagnostic-generate.yml"
+      ],
+      "entity_types_supported": ["gamme"],
+      "rule": "review_status approved ET diagnostic_relations non vide ; aucune fiche modifiée ; 0 LLM / 0 DB ; export UNRECONCILED conservé, retrait par PR WIKI",
+      "adr": "ADR-033"
+    },
     {
       "id": "exports_seo_to_db_projection",
       "from": "automecanik-wiki/exports/seo/",
```

```bash
cd "$SCRATCH/l2chk"
git apply "$SCRATCH/l2-pipeline.diff"
"$SCRATCH/ajv/node_modules/.bin/ajv" validate \
  -s .spec/00-canon/repository-registry/_schema/pipelines.registry.schema.json \
  -d .spec/00-canon/repository-registry/pipelines.registry.json
python3 scripts/canon/validate-cross-references.py
```

Attendu : `… pipelines.registry.json valid`, puis `OK: 7 pipelines + 1 projections, cross-references bidirectionnels coherents.` (au 2026-09-30).

- [ ] **Étape 3 : remise à l'owner et nettoyage**

```bash
cd /opt/automecanik/app
git -C /opt/automecanik/app worktree remove --force "$SCRATCH/l2chk"
```

Remettre à l'owner les deux diffs, les sorties des validateurs et la procédure #1622 : commit de la modification L2 sur une branche, push, puis application sans édition du patch `generated-projections.patch` de l'artefact `registry-recovery-<run_id>` (`gh run download <run_id> -n registry-recovery-<run_id>`). Signaler la dérive observée sans la corriger : l'entrée `wiki_to_exports_seo` du même registre est `MISSING` avec `scripts: []` alors que son workflow existe.

- [ ] **Étape 4 : passage ACTIVE (owner, après les Étapes 10-11 de la Tâche 4)**

L'owner passe `actual_mode` à `ACTIVE`, retire `missing_step`, ajoute `runtime_evidence` (run du `workflow_dispatch`, SHA du commit bot, run `wiki-quality-gates` vert) et remplace `last_verified_method` par la méthode de preuve du run, selon le précédent #1622.

---

## Couverture spec → tâches

| Spec | Exigence | Tâche |
|---|---|---|
| §4.2 | Fiches éligibles, sources résolues, `raw_proven` G1, catalogue strict, slug = nom du fichier | 2 |
| §4.2 | Déterminisme (commits par fichier, ni HEAD ni horodatage), formats de hash | 2 |
| §4.2 | Export orphelin `UNRECONCILED`, retrait par PR WIKI | 2, 4 (scénarios 3-4) |
| §4.2 | Transport : workflow nocturne, bot unique writer, course au push | 4 |
| §4.2 | Transport : pin Dependabot, `COPY` sous gate `ls-tree` | 5 |
| §4.3 | Garde d'activation : `GUARD_BASE`, `^{commit}`, exit 2 | 1 |
| §4.3 | Protection de `main` du WIKI (rulesets, PAT admin, checks filtrés) | hors plan : SP2 |
| §4.8 | automation-reality + pipelines L2 | 6 |
| §7 | 42 tests WIKI + 4 tests de garde ; simulation 5 scénarios + mutation ; mutations du builder | 1, 2, 4 |
| §9 étapes 2 (partie pipeline), 3, 4 | Découpage | 1-6 |
| §4.4, §4.5, §4.9, §9 étapes 1, 5, 6 | DB, writer, drapeau de projection, révision d'ADR-035 | Plan 2 |
| §4.6, §4.7, §9 étapes 7, 8 | Moteur, frontend, script d'environnement PROD | Plan 3 |
