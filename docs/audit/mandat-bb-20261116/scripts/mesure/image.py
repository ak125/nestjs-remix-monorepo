#!/usr/bin/env python3
"""Mandat BB — par jour : image du runner et durées des étapes de « 🧪 Backend Tests » (ci.yml, PR, succès).
Usage : python3 -I image.py <cache> <jour-début> <jour-fin>"""
import json, os, re, subprocess, sys
from datetime import datetime, timedelta
from statistics import median
CACHE, D0, D1 = sys.argv[1], sys.argv[2], sys.argv[3]
REPO = "ak125/nestjs-remix-monorepo"
ts = lambda s: datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")
def gh(p): return json.loads(subprocess.run(["gh", "api", p], capture_output=True, text=True, check=True).stdout)
d = datetime.strptime(D0, "%Y-%m-%d")
while d <= datetime.strptime(D1, "%Y-%m-%d"):
    day = d.strftime("%Y-%m-%d"); d += timedelta(days=1)
    fn = os.path.join(CACHE, f"image-{day}.json")
    if os.path.exists(fn): row = json.load(open(fn))
    else:
        runs = gh(f"repos/{REPO}/actions/workflows/ci.yml/runs?event=pull_request&status=success&created={day}T00:00:00Z..{day}T23:59:59Z&per_page=6")["workflow_runs"]
        row = {"day": day, "n": 0, "install": [], "build": [], "tests": [], "image": None}
        for r in runs:
            j = next((j for j in gh(f"repos/{REPO}/actions/runs/{r['id']}/jobs?per_page=100")["jobs"] if j["name"] == "🧪 Backend Tests"), None)
            if not j: continue
            st = {s["name"]: (ts(s["completed_at"]) - ts(s["started_at"])).total_seconds() for s in j["steps"] if s.get("started_at") and s.get("completed_at")}
            row["n"] += 1; row["install"].append(st.get("Install dependencies")); row["build"].append(st.get("Build packages")); row["tests"].append(st.get("🧪 Run backend tests"))
            if row["image"] is None:
                log = subprocess.run(["gh", "api", "--allow-escape-sequences", f"repos/{REPO}/actions/jobs/{j['id']}/logs"], capture_output=True).stdout.decode("utf-8", "replace")
                m = re.search(r"Image: (ubuntu-[0-9.]+)", log); c = re.search(r"Cache Size: ~\d+ MB \((\d+) B\)", log); t = re.search(r"Cached:\s+(\d+) cached", log); s = re.search(r"Test Suites:[^\n]*?(\d+) of (\d+) total|Test Suites:[^\n]*?(\d+) total", log)
                row["image"] = m.group(1) if m else "?"; row["npm_cache_bytes"] = int(c.group(1)) if c else None; row["turbo_cached"] = t.group(1) if t else None; row["suites"] = (s.group(2) or s.group(3)) if s else None
        json.dump(row, open(fn, "w"))
    med = lambda v: f"{median([x for x in v if x is not None]):4.0f}" if any(x is not None for x in v) else "   -"
    print(f"{row['day']} n={row['n']} image={row.get('image')} cache npm={row.get('npm_cache_bytes')} o turbo en cache={row.get('turbo_cached')}/11 suites={row.get('suites')} | install {med(row['install'])} s  build {med(row['build'])} s  tests {med(row['tests'])} s")
