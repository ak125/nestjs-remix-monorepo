#!/usr/bin/env python3
import json, os, re, sys, glob, subprocess
from datetime import datetime
from collections import defaultdict, Counter
from statistics import median
CACHE = sys.argv[1]
RESYNC = re.compile(r"^(Merge (origin/main|branch 'main'|remote-tracking branch 'origin/main')|chore\(audit\): (régénérer l'inventaire après fusion de main|refresh PR-8 inventory fingerprint)|chore\(ownership\): couvrir la migration)")
ts = lambda s: datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ") if s else None
runs = []
for f in sorted(glob.glob(os.path.join(CACHE, "runs-day-*.json"))): runs += json.load(open(f))
prs = json.load(open(os.path.join(CACHE, "merged-prs.json")))
merged_heads = {p["headRefOid"] for p in prs}
print("## ci.yml PR, 4 jours : passes par nature et utilité (tête = tête fusionnée d'une PR)")
for d in ("2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-1"):
    ci = [r for r in runs if r["path"].endswith("/ci.yml") and r["event"] == "pull_request" and r["created_at"].startswith(d)]
    res = [r for r in ci if RESYNC.search(r["msg"])]
    con = [r for r in ci if not RESYNC.search(r["msg"])]
    ru = [r for r in res if r["head_sha"] in merged_heads]
    cu = [r for r in con if r["head_sha"] in merged_heads]
    lab = d if len(d) == 10 else "total 4 j"
    print(f"   {lab}: {len(ci):3d} passes ; contenu {len(con):3d} (dont tête fusionnée {len(cu):2d}) ; resync {len(res):3d} = {100*len(res)/max(1,len(ci)):.0f} % (dont tête fusionnée {len(ru):2d}, sans suite {len(res)-len(ru):2d})")
# jobs par push PR (16 nov.)
d16 = [r for r in runs if r["created_at"].startswith("2026-11-16")]
jobs = lambda rid: json.load(open(os.path.join(CACHE, f"jobs-{rid}.json"))) if os.path.exists(os.path.join(CACHE, f"jobs-{rid}.json")) else []
per_sha = defaultdict(lambda: [0, 0, 0.0])
for r in d16:
    if r["event"] not in ("pull_request", "pull_request_target"): continue
    for j in jobs(r["id"]):
        if j["conclusion"] == "skipped" or not j["started_at"]: continue
        per_sha[r["head_sha"]][0] += 1
        if j["started_at"] and j["completed_at"]:
            per_sha[r["head_sha"]][2] += (ts(j["completed_at"]) - ts(j["started_at"])).total_seconds() / 60
    per_sha[r["head_sha"]][1] += 1
v = [x for x in per_sha.values() if x[0] >= 15]
print(f"\n## 16 nov. — par tête de PR (n={len(v)}) : workflows lancés méd={median(x[1] for x in v)} ; jobs exécutés méd={median(x[0] for x in v)} max={max(x[0] for x in v)} ; minutes-job méd={median(x[2] for x in v):.1f} max={max(x[2] for x in v):.1f}")
# profil de concurrence (jobs hébergés GitHub) le 16
ev = []
qs = []
for r in d16:
    for j in jobs(r["id"]):
        if j["conclusion"] == "skipped" or not j["started_at"] or not j["completed_at"]: continue
        if "self-hosted" in (j.get("labels") or []): continue
        s, e = ts(j["started_at"]), ts(j["completed_at"])
        if e <= s: continue
        ev.append((s, 1)); ev.append((e, -1))
        if j["created_at"]:
            qs.append(((s - ts(j["created_at"])).total_seconds() / 60, s, r["event"]))
ev.sort()
cur = mx = 0; prev = None; hist = Counter()
for t, dlt in ev:
    if prev is not None: hist[cur] += (t - prev).total_seconds() / 60
    cur += dlt; mx = max(mx, cur); prev = t
print(f"\n## 16 nov. — jobs hébergés simultanés : max={mx} ; minutes passées à ≥15 : {sum(v for k, v in hist.items() if k >= 15):.0f} ; à ≥19 : {sum(v for k, v in hist.items() if k >= 19):.0f} ; à ≥20 : {sum(v for k, v in hist.items() if k >= 20):.0f} ; à ≥21 : {sum(v for k, v in hist.items() if k >= 21):.0f}")
print("   répartition (jobs simultanés: minutes) :", {k: round(v) for k, v in sorted(hist.items()) if k >= 12})
q = sorted(x[0] for x in qs if x[0] >= 0)
print(f"   attente en file des jobs hébergés (n={len(q)}) : méd={median(q):.2f} p90={q[int(.9*len(q))]:.2f} p99={q[int(.99*len(q))]:.2f} max={q[-1]:.1f} min ; jobs attendus > 1 min : {sum(x > 1 for x in q)} ; > 3 min : {sum(x > 3 for x in q)}")
print(f"   somme des attentes en file : {sum(q):.0f} min-job")
# attente la plus longue par run ci.yml PR = retard ajouté au chemin critique
