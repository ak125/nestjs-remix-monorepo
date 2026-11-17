#!/usr/bin/env python3
"""Mandat BB — analyse du cache produit par fetch.py. Usage : python3 -I analyze.py <cache>"""
import json, os, re, sys, glob
from datetime import datetime
from collections import defaultdict, Counter
from statistics import median

CACHE = sys.argv[1]
REQUIRED = ["⬣ ESLint", "ʦ TypeScript", "🧪 Backend Tests", "🧪 Frontend Tests", "🔒 Security Audit",
            "🔒 Core Build Only", "🛡️ Import Firewall", "🛡️ RPC Safety Gate", "🛡️ ADR-010 Governance",
            "🔐 Secrets Detection", "🗄️ Migration Safety", "🔬 CodeQL Scan (javascript-typescript)",
            "🔒 DEV Safety (Blocking)", "🧾 DoD self-evaluation present"]
RESYNC = re.compile(r"^(Merge (origin/main|branch 'main'|remote-tracking branch 'origin/main')"
                    r"|chore\(audit\): (régénérer l'inventaire après fusion de main|refresh PR-8 inventory fingerprint)"
                    r"|chore\(ownership\): couvrir la migration)")


def ts(s):
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ") if s else None


def mins(a, b):
    return (ts(b) - ts(a)).total_seconds() / 60 if a and b else None


def load(tag):
    return json.load(open(os.path.join(CACHE, f"runs-{tag}.json")))


def jobs(rid):
    fn = os.path.join(CACHE, f"jobs-{rid}.json")
    return json.load(open(fn)) if os.path.exists(fn) else []


def pct(v, p):
    v = sorted(v)
    return v[min(len(v) - 1, int(round(p * (len(v) - 1))))] if v else float("nan")


def stat(v):
    return f"n={len(v):3d} méd={median(v):5.1f} p90={pct(v, .9):5.1f} max={max(v):5.1f}" if v else "n=0"


idx = json.load(open(os.path.join(CACHE, "index.json")))
print(f"# Collecte horodatée {idx['stamp']}\n")

# ---------- 1. Échantillons de 60 runs
for tag in ("ci.yml-pull_request", "ci.yml-push-main", "codeql.yml-pull_request", "codeql.yml-push-main",
            "validator-dev-safety-observe.yml-pull_request", "pr-dod-gate.yml-pull_request",
            "pr-dod-gate.yml-pull_request_review", "merge-circuits.yml-pull_request_target", "audit.yml-pull_request"):
    runs = load(tag)
    concl = Counter(r["conclusion"] or r["status"] for r in runs)
    span = f"{runs[-1]['created_at']} → {runs[0]['created_at']}"
    print(f"## {tag} — {len(runs)} runs, {span}")
    print(f"   conclusions: {dict(concl)} ; relancés (run_attempt>1): {sum(1 for r in runs if (r['run_attempt'] or 1) > 1)}")
    per_job = defaultdict(lambda: {"dur": [], "queue": [], "concl": Counter()})
    wall, crit, jobmin = [], Counter(), []
    for r in runs:
        js = jobs(r["id"])
        tot = 0
        longest = (None, -1)
        for j in js:
            pj = per_job[j["name"]]
            pj["concl"][j["conclusion"] or j["status"]] += 1
            d = mins(j["started_at"], j["completed_at"])
            q = mins(j["created_at"], j["started_at"])
            if j["conclusion"] in ("success", "failure") and d is not None:
                pj["dur"].append(d)
                tot += d
                if q is not None and q >= 0:
                    pj["queue"].append(q)
                if d > longest[1]:
                    longest = (j["name"], d)
            elif j["conclusion"] == "cancelled" and d is not None and d > 0:
                tot += d
        if r["conclusion"] in ("success", "failure"):
            w = mins(r["run_started_at"], r["updated_at"])
            if w is not None:
                wall.append(w)
            if longest[0]:
                crit[longest[0]] += 1
        jobmin.append(tot)
    print(f"   durée mur du run (terminés) : {stat(wall)}")
    print(f"   minutes-job par run (tous)  : {stat(jobmin)}  total={sum(jobmin):.0f}")
    print(f"   job le plus long par run    : {dict(crit.most_common(4))}")
    for name, pj in sorted(per_job.items(), key=lambda kv: -(median(kv[1]['dur']) if kv[1]['dur'] else 0)):
        if not pj["dur"]:
            print(f"   - {name[:44]:44s} (jamais exécuté) {dict(pj['concl'])}")
            continue
        req = "R" if name in REQUIRED else " "
        print(f"   {req} {name[:44]:44s} durée {stat(pj['dur'])} | file méd={median(pj['queue']):.2f} p90={pct(pj['queue'], .9):.2f} max={max(pj['queue']):.1f} | {dict(pj['concl'])}")
    print()

# ---------- 2. Étapes du job le plus long (PR)
for tag, jobname in (("ci.yml-pull_request", None),):
    runs = load(tag)
    steps = defaultdict(lambda: defaultdict(list))
    for r in runs:
        for j in jobs(r["id"]):
            if j["conclusion"] != "success":
                continue
            for s in j["steps"]:
                d = mins(s["started_at"], s["completed_at"])
                if d is not None:
                    steps[j["name"]][s["name"]].append(d)
    print("## Étapes ≥ 0,3 min (médiane) des jobs ci.yml sur PR (jobs en succès)")
    for jn, st in steps.items():
        rows = [(median(v), n, len(v)) for n, v in st.items() if median(v) >= 0.3]
        if rows:
            print(f"   {jn}")
            for m, n, c in sorted(rows, reverse=True):
                print(f"      {m:5.2f} min  {n[:70]} (n={c})")
    print()

# ---------- 3. Relances « branche en retard » sur les 60 runs PR de ci.yml
runs = load("ci.yml-pull_request")
cls = Counter()
for r in runs:
    k = "resync main (fusion de main / régénération)" if RESYNC.search(r["msg"]) else "contenu de la PR"
    cls[(k, r["conclusion"] or r["status"])] += 1
print("## ci.yml PR — tête du run : resync vs contenu (60 derniers)")
for k, v in sorted(cls.items()):
    print(f"   {k[0]:46s} {k[1]:10s} {v}")
rs = sum(v for k, v in cls.items() if k[0].startswith("resync"))
print(f"   part des runs dont la tête est un resync : {rs}/{len(runs)} = {100 * rs / len(runs):.0f} %\n")

# ---------- 4. Journées : volume, annulations, minutes-job
days = {}
for d in ("2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"):
    allr = []
    for f in sorted(glob.glob(os.path.join(CACHE, f"runs-day-{d}-*.json"))):
        allr += json.load(open(f))
    days[d] = allr
print("## Volume par jour (UTC)")
for d, allr in days.items():
    c = Counter(r["conclusion"] or r["status"] for r in allr)
    ev = Counter(r["event"] for r in allr)
    print(f"   {d}: {len(allr)} runs ; conclusions {dict(c.most_common(6))} ; événements {dict(ev.most_common(6))}")
print()

d16 = days["2026-11-16"]
agg = defaultdict(lambda: {"runs": 0, "jobmin": 0.0, "cancel": 0, "hosted": 0.0, "self": 0.0, "skipped": 0})
for r in d16:
    key = (os.path.basename(r["path"] or r["name"]), r["event"])
    a = agg[key]
    a["runs"] += 1
    if r["conclusion"] == "cancelled":
        a["cancel"] += 1
    if r["conclusion"] == "skipped":
        a["skipped"] += 1
    for j in jobs(r["id"]):
        dd = mins(j["started_at"], j["completed_at"])
        if dd is None or dd <= 0 or j["conclusion"] == "skipped":
            continue
        a["jobmin"] += dd
        if "self-hosted" in (j.get("labels") or []):
            a["self"] += dd
        else:
            a["hosted"] += dd
tot = sum(a["jobmin"] for a in agg.values())
print(f"## 2026-11-16 (00:00 → collecte) : {len(d16)} runs, {tot:.0f} minutes-job "
      f"(hébergé GitHub {sum(a['hosted'] for a in agg.values()):.0f}, self-hosted {sum(a['self'] for a in agg.values()):.0f}), "
      f"annulés {sum(a['cancel'] for a in agg.values())}")
print("   workflow / événement                                   runs  annulés  min-job  min/run")
for key, a in sorted(agg.items(), key=lambda kv: -kv[1]["jobmin"])[:28]:
    print(f"   {key[0][:40]:40s} {key[1][:20]:20s} {a['runs']:4d} {a['cancel']:6d} {a['jobmin']:8.0f} {a['jobmin'] / a['runs']:7.1f}")
rest = sorted(agg.items(), key=lambda kv: -kv[1]["jobmin"])[28:]
print(f"   (autres : {len(rest)} couples, {sum(a['runs'] for _, a in rest)} runs, {sum(a['jobmin'] for _, a in rest):.0f} min-job)")
# extrapolation des autres jours au prorata des moyennes du 16
per = {k: a["jobmin"] / a["runs"] for k, a in agg.items()}
for d in ("2026-11-13", "2026-11-14", "2026-11-15"):
    est, unk = 0.0, 0
    for r in days[d]:
        k = (os.path.basename(r["path"] or r["name"]), r["event"])
        if k in per:
            est += per[k]
        else:
            unk += 1
    print(f"   estimation {d} (moyennes du 16 × volumes) : {est:.0f} min-job ({unk} runs sans moyenne)")
print()

# ---------- 5. Annulations du 16 : minutes perdues
lost = defaultdict(float)
n = Counter()
for r in d16:
    if r["conclusion"] != "cancelled":
        continue
    k = (os.path.basename(r["path"]), r["event"])
    n[k] += 1
    for j in jobs(r["id"]):
        dd = mins(j["started_at"], j["completed_at"])
        if dd and dd > 0 and j["conclusion"] != "skipped":
            lost[k] += dd
print("## 2026-11-16 — runs annulés et minutes-job déjà dépensées avant annulation")
for k, v in sorted(lost.items(), key=lambda kv: -kv[1])[:12]:
    print(f"   {k[0][:40]:40s} {k[1][:22]:22s} annulés={n[k]:3d} min-job perdues={v:6.0f}")
print(f"   total annulés={sum(n.values())} ; min-job perdues={sum(lost.values()):.0f}")
json.dump({"d16_total_jobmin": tot}, open(os.path.join(CACHE, "summary.json"), "w"))
