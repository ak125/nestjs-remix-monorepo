#!/usr/bin/env python3
import json, os, re, sys, glob
from datetime import datetime
from collections import defaultdict, Counter
from statistics import median
CACHE = sys.argv[1]
ts = lambda s: datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ") if s else None
runs = []
for f in sorted(glob.glob(os.path.join(CACHE, "runs-day-*.json"))): runs += json.load(open(f))
jobs = lambda rid: json.load(open(os.path.join(CACHE, f"jobs-{rid}.json"))) if os.path.exists(os.path.join(CACHE, f"jobs-{rid}.json")) else []
# 1. train du 15 : décomposition
print("## Train du 2026-11-15 (journal de l'hôte DEV) — décomposition")
for pr, sha, start, end in (("2085", "1e907b1f5", "2026-11-15T19:51:29Z", "2026-11-15T20:00:44Z"), ("2083", "0458280eb", "2026-11-15T20:00:45Z", "2026-11-15T20:08:34Z"),
                            ("2084", "3017e8d1d", "2026-11-15T18:29:27Z", "2026-11-15T18:31:30Z"), ("2086", "e044beb4b", "2026-11-15T19:49:15Z", "2026-11-15T19:51:28Z")):
    rr = [r for r in runs if r["head_sha"].startswith(sha) and r["event"] in ("pull_request", "pull_request_target")]
    first = min(ts(r["created_at"]) for r in rr); last = max(ts(r["updated_at"]) for r in rr)
    lastr = max(rr, key=lambda r: ts(r["updated_at"]))
    print(f"   #{pr} {sha}: script {start[11:19]}→{end[11:19]} = {(ts(end)-ts(start)).total_seconds()/60:.1f} min ; 1er run créé {first.time()} ; dernier run fini {last.time()} ({os.path.basename(lastr['path'])}) ; "
          f"début→push {(first-ts(start)).total_seconds()/60:.1f} ; push→dernier check {(last-first).total_seconds()/60:.1f} ; dernier check→fusion {(ts(end)-last).total_seconds()/60:.1f}")
# 2. Runs dépassés : une tête plus récente existe sur la même branche avant la fin du run
print("\n## Runs de PR dépassés par une tête plus récente (4 jours) — minutes-job dépensées APRÈS l'arrivée de la nouvelle tête")
pr_runs = [r for r in runs if r["event"] in ("pull_request", "pull_request_target") and r["head_branch"]]
heads = defaultdict(dict)
for r in pr_runs:
    h = heads[r["head_branch"]]
    t = ts(r["created_at"])
    if r["path"].endswith("/ci.yml"):
        h[r["head_sha"]] = min(h.get(r["head_sha"], t), t)
order = {b: sorted(h.items(), key=lambda kv: kv[1]) for b, h in heads.items()}
nxt = {}
for b, lst in order.items():
    for (sha, t), (sha2, t2) in zip(lst, lst[1:]):
        nxt[(b, sha)] = t2
for day in ("2026-11-16",):
    waste = defaultdict(lambda: [0, 0.0, 0]); tot = 0.0
    for r in pr_runs:
        if not r["created_at"].startswith(day): continue
        k = (r["head_branch"], r["head_sha"])
        if k not in nxt: continue
        t2 = nxt[k]
        wf = os.path.basename(r["path"])
        for j in jobs(r["id"]):
            if j["conclusion"] in ("skipped",) or not j["started_at"] or not j["completed_at"]: continue
            s, e = ts(j["started_at"]), ts(j["completed_at"])
            if e <= t2: continue
            w = (e - max(s, t2)).total_seconds() / 60
            if w <= 0: continue
            waste[wf][0] += 1; waste[wf][1] += w; tot += w
            if j["conclusion"] == "cancelled": waste[wf][2] += 1
    print(f"   {day}: total {tot:.0f} min-job après dépassement")
    for wf, (n, w, c) in sorted(waste.items(), key=lambda kv: -kv[1][1])[:14]:
        print(f"      {wf[:44]:44s} jobs={n:3d} (dont annulés {c:2d}) min-job={w:6.1f}")
    sup = sum(1 for k in nxt if any(r["created_at"].startswith(day) for r in pr_runs if (r["head_branch"], r["head_sha"]) == k))
    print(f"      têtes dépassées ce jour : {sup}")
# 3. Délai entre deux têtes successives d'une même branche (16) : combien de têtes dépassées en moins de 8 min ?
d = [ (t2 - dict(order[b])[sha]).total_seconds()/60 for (b, sha), t2 in nxt.items() if dict(order[b])[sha].strftime("%Y-%m-%d") == "2026-11-16"]
print(f"   délai tête→tête suivante le 16 : n={len(d)} ; < 8 min : {sum(x < 8 for x in d)} ; méd={median(d):.0f} min")
# 4. Backend Tests : étapes
print("\n## 🧪 Backend Tests — étapes (60 runs PR ci.yml, jobs en succès)")
idx = json.load(open(os.path.join(CACHE, "index.json")))
st = defaultdict(list)
for rid in idx["sets"]["ci.yml-pull_request"]:
    for j in jobs(rid):
        if j["name"] != "🧪 Backend Tests" or j["conclusion"] != "success": continue
        for s in j["steps"]:
            if s["started_at"] and s["completed_at"]:
                st[s["name"]].append((ts(s["completed_at"]) - ts(s["started_at"])).total_seconds())
for n, v in sorted(st.items(), key=lambda kv: -median(kv[1])):
    if median(v) >= 3: print(f"   {median(v):6.0f} s  {n}")
