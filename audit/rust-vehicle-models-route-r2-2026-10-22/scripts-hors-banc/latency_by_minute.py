"""Latence et statuts par minute d'une passe, lus dans les journaux de requêtes Caddy archivés.

Usage : python3 -I latency_by_minute.py <répertoire de passe> <sortie.json>
Observation seulement : ne sert à aucune décision du protocole v3.
"""
import datetime
import glob
import gzip
import json
import os
import sys


def lines(run_dir):
    files = sorted(glob.glob(os.path.join(run_dir, "caddy-requests-*.log.gz")))
    for f in files:
        with gzip.open(f, "rt") as fh:
            yield from fh
    plain = os.path.join(run_dir, "caddy-requests.log")
    if os.path.exists(plain):
        with open(plain) as fh:
            yield from fh


def pct(sorted_vals, p):
    if not sorted_vals:
        return None
    i = min(len(sorted_vals) - 1, max(0, int(round(p / 100 * len(sorted_vals) + 0.5)) - 1))
    return sorted_vals[i]


def main():
    run_dir, out = sys.argv[1], sys.argv[2]
    buckets = {}
    first = last = None
    firsts = []
    for line in lines(run_dir):
        try:
            j = json.loads(line)
        except ValueError:
            continue
        if j.get("msg") != "handled request":
            continue
        ts = datetime.datetime.fromisoformat(j["ts"]).timestamp()
        if first is None:
            first = ts
        if len(firsts) < 3:
            firsts.append({"ts": j["ts"], "path": j.get("request", {}).get("uri", "").split("?")[0],
                           "status": j.get("status"), "upstream": j.get("upstream")})
        last = ts
        m = int((ts - first) // 60)
        b = buckets.setdefault(m, {"n": 0, "status": {}, "d": []})
        b["n"] += 1
        b["status"][str(j.get("status"))] = b["status"].get(str(j.get("status")), 0) + 1
        b["d"].append(j.get("duration", 0) * 1000)
    rows = []
    for m in sorted(buckets):
        d = sorted(buckets[m]["d"])
        rows.append({"minute": m, "n": buckets[m]["n"], "status": buckets[m]["status"],
                     "p50_ms": round(pct(d, 50), 1), "p99_ms": round(pct(d, 99), 1),
                     "max_ms": round(d[-1], 1)})
    res = {"run": os.path.basename(run_dir.rstrip("/")), "first_ts": firsts[0]["ts"] if firsts else None,
           "span_s": round(last - first, 3) if first is not None else None, "first_requests": firsts,
           "minutes": rows}
    with open(out, "w") as fh:
        json.dump(res, fh, indent=1)
    print(res["run"], "minutes", len(rows), "span_s", res["span_s"])
    for r in rows[:2] + rows[-4:]:
        print(r)


if __name__ == "__main__":
    main()
