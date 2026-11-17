#!/usr/bin/env python3
"""Mandat BB — étape « Install dependencies » avant/après le passage à setup-node v7 (#1575, 2026-09-24)."""
import json, os, subprocess, sys
from datetime import datetime
from statistics import median
from collections import defaultdict
CACHE = sys.argv[1]; REPO = "ak125/nestjs-remix-monorepo"
ts = lambda s: datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
def gh(p): return json.loads(subprocess.run(["gh", "api", p], capture_output=True, text=True, check=True).stdout)
def window(tag, w):
    fn = os.path.join(CACHE, f"before-{tag}.json")
    if os.path.exists(fn): return json.load(open(fn))
    runs = gh(f"repos/{REPO}/actions/workflows/ci.yml/runs?event=pull_request&status=success&created={w}&per_page=30")["workflow_runs"]
    out = []
    for r in runs:
        js = gh(f"repos/{REPO}/actions/runs/{r['id']}/jobs?per_page=100")["jobs"]
        out.append({"id": r["id"], "created_at": r["created_at"], "jobs": [{"name": j["name"], "id": j["id"], "started_at": j["started_at"], "completed_at": j["completed_at"],
                    "steps": [{"name": s["name"], "started_at": s.get("started_at"), "completed_at": s.get("completed_at")} for s in j.get("steps") or []]} for j in js]})
    json.dump(out, open(fn, "w")); return out
for tag, w in (("j-1-cache", "2026-10-23T00:00:00Z..2026-10-25T08:00:00Z"), ("j+1-cache", "2026-10-25T09:30:00Z..2026-10-27T00:00:00Z")):
    runs = window(tag, w)
    st = defaultdict(list); jd = defaultdict(list)
    for r in runs:
        for j in r["jobs"]:
            if j["started_at"] and j["completed_at"]: jd[j["name"]].append((ts(j["completed_at"]) - ts(j["started_at"])).total_seconds())
            for s in j["steps"]:
                if s["name"] in ("Install dependencies", "Setup Node.js", "Set up Node.js", "Setup Node", "Build packages") and s["started_at"] and s["completed_at"]:
                    st[(j["name"], s["name"])].append((ts(s["completed_at"]) - ts(s["started_at"])).total_seconds())
    print(f"## {tag} : {len(runs)} runs ci.yml PR en succès, {runs[-1]['created_at']} → {runs[0]['created_at']}")
    for k, v in sorted(st.items()):
        if "Tests" in k[0] or "ESLint" in k[0] or "TypeScript" in k[0]: print(f"   {k[0][:22]:22s} {k[1]:22s} n={len(v):2d} méd={median(v):5.0f} s min={min(v):4.0f} max={max(v):4.0f}")
    for k in ("🧪 Backend Tests", "🧪 Frontend Tests", "⬣ ESLint", "ʦ TypeScript"):
        if jd[k]: print(f"   job {k[:20]:20s} méd={median(jd[k])/60:4.1f} min")
    print("   job Backend Tests d'exemple :", next((j["id"] for j in runs[len(runs)//2]["jobs"] if "Backend Tests" in j["name"]), None))
