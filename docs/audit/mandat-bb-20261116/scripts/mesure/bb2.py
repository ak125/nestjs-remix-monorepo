#!/usr/bin/env python3
"""Mandat BB-2 — charge par tête de PR et porte des fichiers nouveaux. Usage : python3 -I bb2.py <cache>"""
import json, os, sys, glob
from collections import defaultdict, Counter
from datetime import datetime
from statistics import median
CACHE = sys.argv[1]
ts = lambda s: datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")
runs = []
for f in sorted(glob.glob(os.path.join(CACHE, "runs-day-*.json"))):
    runs += json.load(open(f))
def jobs(rid):
    fn = os.path.join(CACHE, f"jobs-{rid}.json")
    return json.load(open(fn)) if os.path.exists(fn) else []
PR = ("pull_request", "pull_request_target", "pull_request_review")
for day in ("2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"):
    heads = defaultdict(list)
    for r in runs:
        if r["event"] in PR and r["created_at"].startswith(day):
            heads[(r["head_branch"], r["head_sha"])].append(r)
    nr = [len(v) for v in heads.values()]
    nw = [len({r["path"] for r in v}) for v in heads.values()]
    print(f"{day}: {len(heads)} têtes ; runs par tête méd={median(nr)} p90={sorted(nr)[int(.9*(len(nr)-1))]} max={max(nr)} ; workflows distincts par tête méd={median(nw)} max={max(nw)}")
# 16-11 : par workflow, part des têtes, durée et coût
day = "2026-11-16"
heads = defaultdict(list)
for r in runs:
    if r["event"] in PR and r["created_at"].startswith(day):
        heads[(r["head_branch"], r["head_sha"])].append(r)
agg = defaultdict(lambda: {"heads": set(), "runs": 0, "jm": 0.0, "dur": [], "jobs": 0, "concl": Counter()})
for h, v in heads.items():
    for r in v:
        a = agg[os.path.basename(r["path"])]
        a["heads"].add(h); a["runs"] += 1; a["concl"][r["conclusion"] or r["status"]] += 1
        for j in jobs(r["id"]):
            if j["conclusion"] == "skipped" or not j["started_at"] or not j["completed_at"]:
                continue
            d = (ts(j["completed_at"]) - ts(j["started_at"])).total_seconds() / 60
            if d > 0:
                a["jm"] += d; a["dur"].append(d); a["jobs"] += 1
print(f"\n16-11 : {len(heads)} têtes de PR. workflow | % des têtes | runs | jobs exécutés | durée méd. d'un job (min) | min-job | conclusions")
small = 0; smalljobs = 0
for k, a in sorted(agg.items(), key=lambda kv: -len(kv[1]["heads"])):
    md = median(a["dur"]) if a["dur"] else 0
    print(f"  {k[:44]:44s} {100*len(a['heads'])/len(heads):5.0f} % {a['runs']:4d} {a['jobs']:4d} {md:5.2f} {a['jm']:7.0f}  {dict(a['concl'].most_common(3))}")
    if md < 1.0 and k not in ("ci.yml",):
        small += a["jm"]; smalljobs += a["jobs"]
print(f"  jobs de moins d'une minute (hors ci.yml) : {smalljobs} jobs, {small:.0f} min-job le 16")
# porte des fichiers nouveaux, 4 jours
print("\nregistry-new-file-gate.yml sur 4 jours")
g = [r for r in runs if r["path"].endswith("registry-new-file-gate.yml")]
print("  runs", len(g), dict(Counter(r["conclusion"] or r["status"] for r in g)))
byb = defaultdict(list)
for r in sorted(g, key=lambda r: r["created_at"]):
    byb[r["head_branch"]].append(r)
fail = {b: v for b, v in byb.items() if any(r["conclusion"] == "failure" for r in v)}
print(f"  branches : {len(byb)} ; avec au moins un échec de la porte : {len(fail)}")
for b, v in fail.items():
    f0 = next(r for r in v if r["conclusion"] == "failure")
    ok = next((r for r in v if r["conclusion"] == "success" and r["created_at"] > f0["created_at"]), None)
    last = v[-1]
    print(f"   {b[:52]:52s} 1er échec {f0['created_at']} ; " + (f"vert {ok['created_at']} (+{(ts(ok['created_at'])-ts(f0['created_at'])).total_seconds()/3600:.1f} h)" if ok else f"toujours rouge (dernier run {last['created_at']} {last['conclusion']})"))
