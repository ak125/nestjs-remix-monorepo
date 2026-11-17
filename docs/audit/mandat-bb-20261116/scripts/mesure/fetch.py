#!/usr/bin/env python3
"""Mandat BB — collecte en lecture seule (API GitHub Actions) avec cache disque.

Usage : python3 -I fetch.py <dossier-cache>
Ne fait que des GET. Chaque réponse est mise en cache : relancer ne recompte pas le quota.
"""
import json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

REPO = "ak125/nestjs-remix-monorepo"
CACHE = sys.argv[1]
os.makedirs(CACHE, exist_ok=True)

RUN_KEYS = ("id", "name", "path", "event", "status", "conclusion", "created_at", "run_started_at",
            "updated_at", "head_sha", "head_branch", "run_attempt", "display_title")


def gh(path):
    for attempt in range(4):
        p = subprocess.run(["gh", "api", path], capture_output=True, text=True)
        if p.returncode == 0:
            return json.loads(p.stdout)
        if "rate limit" in p.stderr.lower() or "secondary" in p.stderr.lower():
            time.sleep(30 * (attempt + 1))
            continue
        time.sleep(2)
    raise RuntimeError(f"gh api {path}: {p.stderr[:300]}")


def slim_run(r):
    o = {k: r.get(k) for k in RUN_KEYS}
    o["prs"] = [p["number"] for p in (r.get("pull_requests") or [])]
    o["msg"] = ((r.get("head_commit") or {}).get("message") or "").split("\n")[0][:160]
    return o


def list_runs(query, cap=None, tag=None):
    """Liste paginée ; `query` = chaîne de requête sans per_page/page."""
    fn = os.path.join(CACHE, f"runs-{tag}.json")
    if os.path.exists(fn):
        return json.load(open(fn))
    out, page = [], 1
    while True:
        d = gh(f"repos/{REPO}/actions/{query}{'&' if '?' in query else '?'}per_page=100&page={page}")
        runs = d.get("workflow_runs", [])
        out += [slim_run(r) for r in runs]
        if len(runs) < 100 or (cap and len(out) >= cap) or page >= 10:
            break
        page += 1
    if cap:
        out = out[:cap]
    json.dump(out, open(fn, "w"))
    return out


def jobs(run_id):
    fn = os.path.join(CACHE, f"jobs-{run_id}.json")
    if os.path.exists(fn):
        return json.load(open(fn))
    out, page = [], 1
    while True:
        d = gh(f"repos/{REPO}/actions/runs/{run_id}/jobs?per_page=100&page={page}")
        for j in d.get("jobs", []):
            out.append({
                "name": j["name"], "status": j["status"], "conclusion": j["conclusion"],
                "created_at": j.get("created_at"), "started_at": j.get("started_at"),
                "completed_at": j.get("completed_at"), "labels": j.get("labels"),
                "steps": [{"name": s["name"], "conclusion": s.get("conclusion"),
                           "started_at": s.get("started_at"), "completed_at": s.get("completed_at")}
                          for s in (j.get("steps") or [])],
            })
        if len(d.get("jobs", [])) < 100:
            break
        page += 1
    json.dump(out, open(fn, "w"))
    return out


def main():
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    sets = {}
    # 1. Les 60 derniers runs PR et main des workflows qui portent les 14 contrôles requis.
    for wf, evs in {
        "ci.yml": ["pull_request", "push&branch=main"],
        "codeql.yml": ["pull_request", "push&branch=main"],
        "validator-dev-safety-observe.yml": ["pull_request"],
        "pr-dod-gate.yml": ["pull_request", "pull_request_review"],
        "merge-circuits.yml": ["pull_request_target", "pull_request_review"],
        "audit.yml": ["pull_request"],
    }.items():
        for ev in evs:
            tag = f"{wf}-{ev.replace('&branch=main', '-main')}"
            sets[tag] = list_runs(f"workflows/{wf}/runs?event={ev}", cap=60, tag=tag)
    # 2. Tous les runs par jour (fenêtres de 6 h : l'API plafonne une recherche à 1000 résultats).
    days = {}
    for d in ("2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"):
        allr = []
        for h in (0, 6, 12, 18):
            w = f"{d}T{h:02d}:00:00Z..{d}T{h + 5:02d}:59:59Z"
            allr += list_runs(f"runs?created={w}", tag=f"day-{d}-{h:02d}")
        days[d] = allr
    # 3. Jobs : échantillons (1) + tous les runs du 16.
    ids = {r["id"] for rs in sets.values() for r in rs} | {r["id"] for r in days["2026-11-16"]}
    todo = [i for i in ids if not os.path.exists(os.path.join(CACHE, f"jobs-{i}.json"))]
    print(f"{stamp} runs à lire: {len(ids)} (reste {len(todo)})", flush=True)
    with ThreadPoolExecutor(max_workers=6) as ex:
        for n, _ in enumerate(ex.map(jobs, todo), 1):
            if n % 200 == 0:
                print(f"  jobs {n}/{len(todo)}", flush=True)
    json.dump({"stamp": stamp, "sets": {k: [r["id"] for r in v] for k, v in sets.items()},
               "days": {k: len(v) for k, v in days.items()}}, open(os.path.join(CACHE, "index.json"), "w"))
    print("ok", {k: len(v) for k, v in sets.items()}, {k: len(v) for k, v in days.items()})


main()
