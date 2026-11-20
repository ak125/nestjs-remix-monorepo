#!/usr/bin/env python3
"""Mandat BB — chronologie par PR fusionnée. Usage : python3 -I timeline.py <cache>"""
import json, os, re, sys, glob
from datetime import datetime
from collections import defaultdict, Counter
from statistics import median

CACHE = sys.argv[1]
RESYNC = re.compile(r"^(Merge (origin/main|branch 'main'|remote-tracking branch 'origin/main')"
                    r"|chore\(audit\): (régénérer l'inventaire après fusion de main|refresh PR-8 inventory fingerprint)"
                    r"|chore\(ownership\): couvrir la migration)")
DOC = re.compile(r"(\.md$|^docs/|^audit/[^/]+\.md$|^log\.md$)")
GEN = re.compile(r"^(audit/registry/[a-z-]+\.json|audit/(cycle-map|db-usage-map|dead-code-candidates|duplicate-map|dynamic-import-edges|module-boundaries|runtime-entrypoints)\.json|audit/cleanup/pr-8-(controlled-cleanup-candidates\.json|deletion-proof\.md)|\.claude/knowledge/REPO_MAP\.md)$")


def ts(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ") if s else None


def m(a, b):
    return (b - a).total_seconds() / 60


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(round(p * (len(v) - 1))))] if v else float("nan")


runs = []
for f in sorted(glob.glob(os.path.join(CACHE, "runs-day-*.json"))):
    runs += json.load(open(f))
by_branch = defaultdict(list)
for r in runs:
    if r["event"] in ("pull_request", "pull_request_target", "pull_request_review"):
        by_branch[r["head_branch"]].append(r)
by_sha = defaultdict(list)
for r in runs:
    by_sha[r["head_sha"]].append(r)

prs = json.load(open(os.path.join(CACHE, "merged-prs.json")))
prs = [p for p in prs if p["mergedAt"] >= "2026-11-13T12:00:00Z"]
prs.sort(key=lambda p: p["mergedAt"])
print(f"PR fusionnées depuis 2026-11-13T12:00Z : {len(prs)}")
print("jour  PR     fichiers  type   passes(contenu/resync)  créée→fusion  dern.contenu→fusion  dern.push→vert(tous)  vert→fusion  dern. à finir")
rows = []
prev_merge = None
for p in prs:
    files = json.load(open(os.path.join(CACHE, f"files-{p['number']}.json")))
    hand = [f for f in files if not GEN.search(f)]
    kind = "doc" if hand and all(DOC.search(f) for f in hand) else ("ci" if any(f.startswith(".github/") for f in hand) else "code")
    ci = sorted([r for r in by_branch.get(p["headRefName"], []) if r["path"].endswith("/ci.yml") and r["event"] == "pull_request"],
                key=lambda r: r["created_at"])
    merged = ts(p["mergedAt"])
    ci = [r for r in ci if ts(r["created_at"]) <= merged]
    if not ci:
        continue
    n_res = sum(1 for r in ci if RESYNC.search(r["msg"]))
    n_con = len(ci) - n_res
    last = ci[-1]
    content = [r for r in ci if not RESYNC.search(r["msg"])]
    last_content = ts(content[-1]["created_at"]) if content else ts(ci[0]["created_at"])
    # tous les checks de la dernière tête : dernier run terminé (hors DoD/circuit relancés par un geste)
    head_runs = [r for r in by_sha[last["head_sha"]] if r["event"] == "pull_request" and r["updated_at"] and ts(r["created_at"]) <= merged]
    core = [r for r in head_runs if not r["path"].endswith(("pr-dod-gate.yml", "merge-circuits.yml"))]
    green = max(ts(r["updated_at"]) for r in core)
    slowest = max(core, key=lambda r: ts(r["updated_at"]))
    push = min(ts(r["created_at"]) for r in head_runs)
    row = dict(n=p["number"], kind=kind, files=len(files), n_con=n_con, n_res=n_res,
               total=m(ts(p["createdAt"]), merged), since_content=m(last_content, merged),
               ci=m(push, green), post=m(green, merged), slow=os.path.basename(slowest["path"]),
               day=p["mergedAt"][:10], merged=merged, push=push, last_is_resync=bool(RESYNC.search(last["msg"])),
               by=p["mergedBy"]["login"] if p.get("mergedBy") else "?")
    row["after_prev"] = m(prev_merge, push) if prev_merge else None
    prev_merge = merged
    rows.append(row)
    print(f"{row['day'][5:]} #{row['n']} {row['files']:5d}   {kind:5s}  {n_con:2d}/{n_res:2d} {'(dern.=resync)' if row['last_is_resync'] else '              '}"
          f" {row['total']:9.0f}   {row['since_content']:10.0f}        {row['ci']:8.1f}        {row['post']:8.1f}     {row['slow']}  [{row['by']}]")

print()
for d in sorted({r["day"] for r in rows}):
    rr = [r for r in rows if r["day"] == d]
    print(f"## {d} : {len(rr)} PR fusionnées ; doc={sum(r['kind'] == 'doc' for r in rr)} code={sum(r['kind'] == 'code' for r in rr)} ci={sum(r['kind'] == 'ci' for r in rr)}")
    print(f"   passes CI par PR : contenu méd={median(r['n_con'] for r in rr)} total={sum(r['n_con'] for r in rr)} ; resync total={sum(r['n_res'] for r in rr)} "
          f"({sum(1 for r in rr if r['n_res'])} PR avec ≥1 resync)")
    print(f"   dernier push → tous checks finis : méd={median(r['ci'] for r in rr):.1f} p90={pct([r['ci'] for r in rr], .9):.1f} max={max(r['ci'] for r in rr):.1f} min")
    print(f"   checks finis → fusion           : méd={median(r['post'] for r in rr):.1f} p90={pct([r['post'] for r in rr], .9):.1f} max={max(r['post'] for r in rr):.1f} min")
    print(f"   dernier contenu → fusion        : méd={median(r['since_content'] for r in rr):.0f} p90={pct([r['since_content'] for r in rr], .9):.0f} max={max(r['since_content'] for r in rr):.0f} min")
    print(f"   création → fusion               : méd={median(r['total'] for r in rr):.0f} p90={pct([r['total'] for r in rr], .9):.0f} min")
    res = [r for r in rr if r["last_is_resync"] and r["after_prev"] is not None and 0 <= r["after_prev"] < 60]
    if res:
        print(f"   fusion précédente → push du resync (PR enchaînées, n={len(res)}) : méd={median(r['after_prev'] for r in res):.1f} max={max(r['after_prev'] for r in res):.1f} min")
    # cadence : intervalle entre fusions successives
    ms = sorted(r["merged"] for r in rr)
    gaps = [m(a, b) for a, b in zip(ms, ms[1:])]
    if gaps:
        print(f"   intervalle entre fusions : méd={median(gaps):.0f} min ; < 25 min : {sum(g < 25 for g in gaps)}/{len(gaps)}")

# ---------- DoD : relances par geste (16 nov.)
print("\n## pr-dod-gate.yml — 2026-11-16 : runs par PR et par tête")
dod = [r for r in runs if r["path"].endswith("pr-dod-gate.yml") and r["created_at"].startswith("2026-11-16")]
c = Counter(r["conclusion"] for r in dod)
print(f"   {len(dod)} runs ; conclusions {dict(c)} ; événements {dict(Counter(r['event'] for r in dod))}")
per_sha = Counter((r["head_branch"], r["head_sha"]) for r in dod)
multi = {k: v for k, v in per_sha.items() if v > 1}
print(f"   têtes distinctes : {len(per_sha)} ; têtes avec plus d'un run : {len(multi)} ; runs en surplus (au-delà du 1er par tête) : {sum(v - 1 for v in per_sha.values())}")
ci16 = [r for r in runs if r["path"].endswith("/ci.yml") and r["event"] == "pull_request" and r["created_at"].startswith("2026-11-16")]
print(f"   pour comparaison, ci.yml PR le 16 : {len(ci16)} runs sur {len({r['head_sha'] for r in ci16})} têtes")
# dernier état DoD par tête : une tête dont le dernier run est annulé ou en échec ?
last_by_sha = {}
for r in sorted(dod, key=lambda r: r["created_at"]):
    last_by_sha[(r["head_branch"], r["head_sha"])] = r
print(f"   dernier run DoD par tête : {dict(Counter(r['conclusion'] for r in last_by_sha.values()))}")
canc_last = [k for k, r in last_by_sha.items() if r["conclusion"] == "cancelled"]
print(f"   têtes dont le DERNIER run DoD est « cancelled » (contrôle requis laissé annulé) : {len(canc_last)} {[k[0][:40] for k in canc_last][:6]}")

# ---------- main : runs annulés (remplacés en attente) et commits non validés
print("\n## ci.yml push main — par jour")
for d in ("2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"):
    mm = [r for r in runs if r["path"].endswith("/ci.yml") and r["event"] == "push" and r["head_branch"] == "main" and r["created_at"].startswith(d)]
    c = Counter(r["conclusion"] or r["status"] for r in mm)
    print(f"   {d}: {len(mm)} pushes main ; {dict(c)}")
# docs : nombre de push main dont le commit est docs()
mm = [r for r in runs if r["path"].endswith("/ci.yml") and r["event"] == "push" and r["head_branch"] == "main"]
docs = [r for r in mm if re.match(r"^docs[(:]", r["msg"])]
print(f"   4 jours : {len(mm)} pushes main dont {len(docs)} au titre « docs… » ; conclusions des docs : {dict(Counter(r['conclusion'] or r['status'] for r in docs))}")
json.dump([{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in r.items()} for r in rows], open(os.path.join(CACHE, "timeline.json"), "w"))
