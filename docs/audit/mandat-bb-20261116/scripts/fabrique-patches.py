#!/usr/bin/env python3
"""Mandat BB — fabrique les patches .github à partir des workflows du checkout (aucune écriture dans le dépôt).
Usage : python3 -I make.py <racine-dépôt> <dossier-travail>"""
import os, re, shutil, subprocess, sys
ROOT, W = sys.argv[1], sys.argv[2]
SRC = os.path.join(ROOT, ".github/workflows")
PMC = "package-manager-cache: false"

def rd(n): return open(os.path.join(SRC, n), encoding="utf8").read()

def sub1(text, old, new, count=1):
    assert text.count(old) >= count, (old[:60], text.count(old))
    return text.replace(old, new, count)

def add_pmc_after(text, anchor_regex, expect):
    """Ajoute `package-manager-cache: false` après la ligne node-version des blocs setup-node repérés."""
    n = 0
    def rep(m):
        nonlocal n; n += 1
        return f"{m.group(0)}\n{m.group('ind')}{PMC}"
    out = re.sub(anchor_regex, rep, text)
    assert n == expect, (anchor_regex, n, expect)
    return out

NODE = r"(?P<head>uses: actions/setup-node@v7\n\s+with:\n)(?P<ind>\s+)node-version: [\"']?24[\"']?"
patches = {}

# 01 — jobs hébergés qui n'installent rien : ne plus restaurer ni enregistrer le cache npm
p = {}
for n in ("dependency-registry-freshness.yml", "pr-dod-gate.yml", "pilote-file.yml", "rag-proposals-validate.yml"):
    p[n] = add_pmc_after(rd(n), NODE, 1)
patches["01-cache-npm-jobs-heberges-sans-installation.patch"] = p

# 02 — jobs du runner self-hosted (chaîne PREPROD, contrôle visuel, santé PROD) : plus de cache npm Actions
ci = rd("ci.yml")
blk = '        uses: actions/setup-node@v7\n        with:\n          node-version: 24\n          cache: "npm"\n'
new = f'        uses: actions/setup-node@v7\n        with:\n          node-version: 24\n          {PMC}\n'
def in_job(text, job, fn):
    """Applique fn à la seule section du job `job` (clé de premier niveau sous jobs:)."""
    start = text.index(f"\n  {job}:\n") + 1
    m = re.search(r"\n  [a-z0-9_-]+:\n", text[start + 1:])
    end = start + 1 + m.start() + 1 if m else len(text)
    return text[:start] + fn(text[start:end]) + text[end:]
for job in ("deploy", "e2e-smoke"):
    ci = in_job(ci, job, lambda sec: (sub1(sec, blk, new)))
lh = "        uses: actions/setup-node@v7\n        with:\n          node-version: 24\n"
ci = in_job(ci, "lighthouse", lambda sec: sub1(sec, lh, lh + f"          {PMC}\n"))
vg = rd("visual-gate.yml"); vg = sub1(vg, blk, new)
ps = add_pmc_after(rd("prod-smoke-tests.yml"), NODE, 2)
patches["02-cache-npm-jobs-self-hosted.patch"] = {"ci.yml": ci, "visual-gate.yml": vg, "prod-smoke-tests.yml": ps}

# 02b — même réglage pour le job de mise en PROD (zone réservée : décision nominative de l'owner)
patches["02b-cache-npm-release-prod.patch"] = {"release-prod.yml": add_pmc_after(rd("release-prod.yml"), NODE, 1)}

# 03 — jest : deux workers (runner public standard : 4 cœurs, 16 Go)
patches["03-backend-tests-deux-workers.patch"] = {"ci.yml": sub1(rd("ci.yml"), "npx jest --ci --verbose --maxWorkers=1 --forceExit", "npx jest --ci --verbose --maxWorkers=2 --forceExit")}

# 04 — annulation des runs dépassés sur 8 workflows de PR non requis
CONC = ("concurrency:\n  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}\n"
        "  cancel-in-progress: true\n\n")
p = {}
for n in ("registry-new-file-gate.yml", "dependency-graph-validate.yml", "governance-checks.yml", "spec-validation.yml",
          "registry-fresh.yml", "registry-build.yml", "perf-gates.yml", "skills-canon-gate.yml"):
    t = rd(n)
    assert "\nconcurrency:" not in t and t.count("\njobs:\n") == 1, n
    p[n] = t.replace("\njobs:\n", "\n" + CONC + "jobs:\n")
patches["04-annulation-runs-depasses.patch"] = p

# 05 — la porte des fichiers nouveaux écrit les fichiers refusés dans le journal du job
old = ("          set -e\n          node scripts/registry/check-new-files.js --base origin/main --json > /tmp/gate-report.json\n")
new5 = ("          set -e\n          rc=0\n"
        "          node scripts/registry/check-new-files.js --base origin/main --json > /tmp/gate-report.json || rc=$?\n"
        "          if [ \"$rc\" -ne 0 ]; then\n"
        "            # Verdict inchangé : le code de sortie du script est repris tel quel. Les fichiers refusés\n"
        "            # sont écrits dans le journal du job (ils n'étaient lisibles que dans le résumé du run).\n"
        "            jq -r '.results[] | select(.verdict != \"ok\") | \"::error file=\\(.path)::\\(.verdict) : \\(.path) (aucun glob de ownership.yaml ne donne owner et domaine)\"' /tmp/gate-report.json || true\n"
        "            exit \"$rc\"\n"
        "          fi\n")
patches["05-porte-fichiers-nouveaux-journal.patch"] = {"registry-new-file-gate.yml": sub1(rd("registry-new-file-gate.yml"), old, new5)}

out = os.path.join(W, "out"); shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
for name, files in patches.items():
    a, b = os.path.join(W, "t", "a/.github/workflows"), os.path.join(W, "t", "b/.github/workflows")
    shutil.rmtree(os.path.join(W, "t"), ignore_errors=True); os.makedirs(a); os.makedirs(b)
    chunks = []
    for n, txt in sorted(files.items()):
        shutil.copy(os.path.join(SRC, n), os.path.join(a, n))
        open(os.path.join(b, n), "w", encoding="utf8").write(txt)
        r = subprocess.run(["diff", "-u", "--label", f"a/.github/workflows/{n}", "--label", f"b/.github/workflows/{n}",
                            os.path.join(a, n), os.path.join(b, n)], capture_output=True, text=True)
        assert r.returncode == 1, (n, r.returncode)
        chunks.append(r.stdout)
    open(os.path.join(out, name), "w", encoding="utf8").write("".join(chunks))
    print(name, len(files), "fichier(s)")
shutil.rmtree(os.path.join(W, "t"), ignore_errors=True)
