#!/usr/bin/env python3
"""
kg-feed-plan.py — PLAN d'alimentation du diagnostic engine (kg_engine_families)
depuis l'éditorial moteur encyclopédie. DRY-RUN STRICT : SELECT-only, ZÉRO write.

Owner 2026-06-13 : « il faut alimenter le diagnostic engine même si paused ». Le
diagnostic engine (r5) est paused en tant que MOTEUR — sa DONNÉE (kg) est à nourrir.
MAIS le writer gouverné (`KnowledgeGraphModule` / `kg-data.service`) est OFF dans
app.module.ts (experimental). Donc :
  - écrire kg via ce script en direct PostgREST = l'anti-pattern `__rag_knowledge` → INTERDIT.
  - activer le module paused = interdit (r5 DO-NOT-START).
→ Ce script ne fait QUE produire le PLAN d'upsert (diff éditorial ↔ kg actuel), revue-able.
  Le WRITE réel est une décision gouvernée (migration data owner-appliquée, OU endpoint
  d'ingestion quand r5 réactivé). Le plan est le contrat de feed.

Entrée : évidences moteur (seeds kg-first + scrapées, ex. N47). Lecture kg_engine_families.
Sortie : par famille → NOUVELLE (absente du kg) ou ENRICHIE (common_issues delta +
related_gammes/diagnostic que le kg n'a pas). Aucune écriture.

Usage :
  python3 scripts/wiki-generators/kg-feed-plan.py --evidence-dir audit/content/prc-evidence/seed [--evidence f.yml ...]
Config env : SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (ou BACKEND_ENV_FILE).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

TIMEOUT = 30


def load_backend_env() -> None:
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        return
    candidates = []
    if os.environ.get("BACKEND_ENV_FILE"):
        candidates.append(Path(os.environ["BACKEND_ENV_FILE"]))
    candidates.append(Path(__file__).resolve().parents[2] / "backend" / ".env")
    for env_file in candidates:
        if not env_file.is_file():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$", line.strip())
            if m and not os.environ.get(m.group(1)):
                os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")
        break


load_backend_env()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def sb_select(table: str, params: dict[str, str]) -> list[dict]:
    """GET only — JAMAIS de POST/PATCH (invariant : ce script ne WRITE pas)."""
    if not SERVICE_ROLE_KEY:
        sys.stderr.write("ERREUR : SUPABASE_SERVICE_ROLE_KEY absent\n")
        sys.exit(2)
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?{urllib.parse.urlencode(params)}",
        headers={"apikey": SERVICE_ROLE_KEY, "Authorization": f"Bearer {SERVICE_ROLE_KEY}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"ERREUR REST {table}: HTTP {e.code} — {e.read()[:200]!r}\n")
        sys.exit(2)


def load_evidence(args) -> list[dict]:
    files: list[Path] = []
    if args.evidence_dir:
        files += sorted(Path(args.evidence_dir).glob("*.yml")) + sorted(Path(args.evidence_dir).glob("*.yaml"))
    for f in args.evidence or []:
        files.append(Path(f))
    out = []
    for f in files:
        try:
            ev = yaml.safe_load(f.read_text(encoding="utf-8"))
            if isinstance(ev, dict) and ev.get("engine_family"):
                out.append(ev)
        except yaml.YAMLError:
            pass
    return out


def plan_family(ev: dict, kg_by_code: dict) -> dict:
    """Diff entre l'éditorial (evidence) et la ligne kg_engine_families existante."""
    code = (ev.get("engine_family") or "").upper()
    kg = kg_by_code.get(code) or kg_by_code.get(code.lower()) or kg_by_code.get(ev.get("engine_family"))
    cur_issues = {}
    if kg:
        ci = kg.get("common_issues") or {}
        if isinstance(ci, str):
            try:
                ci = json.loads(ci)
            except json.JSONDecodeError:
                ci = {}
        cur_issues = ci if isinstance(ci, dict) else {}

    ev_issues = {f.get("issue"): f for f in ev.get("faults", []) if f.get("issue")}
    new_topics = [t for t in ev_issues if t not in cur_issues]
    # enrichissements : related_gammes/diagnostic que le kg (terse {topic:str}) n'a pas
    enrich = []
    for t, f in ev_issues.items():
        rg = f.get("related_gammes") or []
        rd = f.get("related_diagnostic") or []
        if rg or rd:
            enrich.append({"topic": t, "related_gammes": rg, "related_diagnostic": rd})

    return {
        "family": code,
        "action": "NOUVELLE famille kg" if not kg else "ENRICHIR famille kg",
        "kg_present": bool(kg),
        "fuel": ev.get("fuel"),
        "manufacturer": ev.get("manufacturer"),
        "current_topics": sorted(cur_issues.keys()),
        "new_topics": new_topics,
        "enrichments": enrich,
        "applies_to_vehicles": len(ev.get("applies_to_vehicles", [])),
    }


def main() -> int:
    p = argparse.ArgumentParser(description="PLAN dry-run d'alimentation kg_engine_families depuis l'éditorial (0 write).")
    p.add_argument("--evidence-dir")
    p.add_argument("--evidence", action="append")
    args = p.parse_args()
    if not args.evidence_dir and not args.evidence:
        p.error("fournir --evidence-dir et/ou --evidence")

    evidences = load_evidence(args)
    if not evidences:
        sys.stderr.write("Aucune évidence moteur chargée.\n")
        return 1
    kg_rows = sb_select("kg_engine_families", {"select": "family_code,common_issues,is_active"})
    kg_by_code = {r.get("family_code"): r for r in kg_rows}

    print("== PLAN d'alimentation diagnostic engine (kg_engine_families) — DRY-RUN, 0 WRITE ==\n")
    new_fam = enrich_fam = 0
    for ev in evidences:
        pl = plan_family(ev, kg_by_code)
        if pl["kg_present"]:
            enrich_fam += 1
        else:
            new_fam += 1
        print(f"[{pl['action']}] {pl['family']} ({pl['fuel']}, {pl['manufacturer']}) "
              f"· {pl['applies_to_vehicles']} véhicule(s)")
        if pl["new_topics"]:
            print(f"    + topics absents du kg : {', '.join(pl['new_topics'])}")
        if pl["enrichments"]:
            links = sum(len(e["related_gammes"]) + len(e["related_diagnostic"]) for e in pl["enrichments"])
            print(f"    + {links} lien(s) gamme/diagnostic à ajouter (le kg actuel est terse {{topic:texte}})")
    print(f"\n== {new_fam} famille(s) NOUVELLE(s) pour le kg · {enrich_fam} à ENRICHIR ==")
    print("\n⚠ WRITE NON EFFECTUÉ. Le diagnostic engine (KnowledgeGraphModule) est OFF dans")
    print("  app.module.ts (r5 paused). Appliquer ce plan = décision gouvernée owner :")
    print("  (1) migration data owner-appliquée sur kg_engine_families, OU")
    print("  (2) endpoint d'ingestion gouverné quand r5 réactivé.")
    print("  JAMAIS de write-direct PostgREST depuis un script (anti-pattern __rag_knowledge).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
