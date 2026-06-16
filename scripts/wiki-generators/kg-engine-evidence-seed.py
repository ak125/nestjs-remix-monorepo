#!/usr/bin/env python3
"""
kg-engine-evidence-seed.py — Seed DB-FIRST de l'éditorial moteur depuis la
connaissance INTERNE déjà curée (`kg_engine_families.common_issues`), AVANT tout
scraping. SELECT-only (RAW n'écrit jamais en DB).

Doctrine « Internal DB first, editorial RAW second » (owner) : le diagnostic
engine (kg) est PAUSED en tant que moteur, mais sa DONNÉE est une source
autoritaire de 1er rang. On l'extrait en évidence engine-keyed (source_type:
internal_kg, Tier A) → consommée par engine-issues-from-evidence.py → RAW
known_issues_by_engine. L'éditorial enrichi (symptômes/sources externes ajoutés
par le scraping d'augmentation) repart ALIMENTER le kg via le flux gouverné
RAW→WIKI→export (jamais d'INSERT direct depuis ici).

Chaque `common_issue` {topic: description} devient un fait DB-first :
  - issue slug = normalisé depuis le topic,
  - label/symptoms = description curée (terse mais AUTORITAIRE),
  - source = internal_kg (high),
  - related_gammes / related_diagnostic = mappés déterministiquement par topic
    (validés ensuite contre les entités RAW par l'injecteur).
Le scraping complète ensuite symptômes détaillés + corroboration externe.

Usage :
  python3 scripts/wiki-generators/kg-engine-evidence-seed.py --out-dir audit/content/prc-evidence/seed [--family K9K]

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
RAW_REPO = Path(os.environ.get("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
VEHICLES_SUBDIR = Path("recycled") / "rag-knowledge" / "vehicles"
DISPLACEMENT_TOL_L = 0.15  # tolérance match cylindrée (litres)

# Groupe constructeur (kg.manufacturer) → marques membres (slug). CONSERVATEUR :
# on n'inclut que les rattachements moteur sûrs (évite la mis-attribution ; la
# sanity-carburant + le match cylindrée de l'injecteur sont le backstop final).
GROUP_BRANDS = {
    "renault-nissan": ["renault", "nissan", "dacia"],
    "renault": ["renault", "dacia"],
    "psa": ["peugeot", "citroen", "ds"],
    "psa-bmw": ["peugeot", "citroen", "ds", "mini"],
    "vag": ["volkswagen", "audi", "skoda", "seat"],
    "ford": ["ford"],
}

# Mapping déterministe topic kg → gamme RAW (pièce vendable) + système diagnostic.
# Validé ensuite contre les entités RAW réelles par l'injecteur (lien mort → retiré).
TOPIC_MAP = {
    "egr":          {"gammes": ["vanne-egr"],                                  "diag": ["injection", "refroidissement"]},
    "turbo":        {"gammes": ["turbocompresseur"],                           "diag": ["injection"]},
    "injecteurs":   {"gammes": ["injecteurs", "porte-injecteur"],              "diag": ["injection", "injecteurs-pompe"]},
    "fap":          {"gammes": ["filtre-a-particules"],                        "diag": ["echappement", "injection"]},
    "distribution": {"gammes": ["kit-de-distribution", "courroie-de-distribution", "kit-de-chaine-de-distribution"], "diag": ["distribution-courroie"]},
    "chaine_distribution": {"gammes": ["kit-de-chaine-de-distribution", "chaine-de-distribution"], "diag": ["distribution-courroie"]},
    "courroie_distribution": {"gammes": ["kit-de-distribution", "courroie-de-distribution"], "diag": ["distribution-courroie"]},
    "bobines":      {"gammes": ["bobine-d-allumage"],                          "diag": ["injection"]},
    "joints_spi":   {"gammes": ["joint-spi"],                                  "diag": []},
    "pompe_huile":  {"gammes": ["pompe-a-huile"],                              "diag": ["filtre-a-huile"]},
    "pompe_hp":     {"gammes": ["pompe-d-injection"],                          "diag": ["injection"]},
    "pompe_eau":    {"gammes": ["pompe-a-eau"],                                "diag": ["refroidissement"]},
    "volant_moteur":{"gammes": ["volant-moteur"],                              "diag": ["embrayage", "transmission"]},
    "adblue":       {"gammes": [],                                             "diag": ["echappement"]},
}


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
    if not SERVICE_ROLE_KEY:
        sys.stderr.write("ERREUR : SUPABASE_SERVICE_ROLE_KEY absent\n")
        sys.exit(2)
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table}?{query}",
        headers={"apikey": SERVICE_ROLE_KEY, "Authorization": f"Bearer {SERVICE_ROLE_KEY}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.stderr.write(f"ERREUR REST {table}: HTTP {e.code} — {e.read()[:300]!r}\n")
        sys.exit(2)


def _extract_block(text: str, key: str):
    pat = re.compile(
        rf"^# >>> DB-MANAGED BLOCK: {re.escape(key)} .*?\n(.*?)^# <<< END DB-MANAGED BLOCK: {re.escape(key)}\n",
        re.DOTALL | re.MULTILINE,
    )
    m = pat.search(text)
    if not m:
        return None
    try:
        return (yaml.safe_load(m.group(1)) or {}).get(key)
    except yaml.YAMLError:
        return None


def load_raw_vehicles() -> list[dict]:
    """Fiches RAW véhicule → {slug, brand, specs:[(fuel, displacement_liter)]} (filesystem)."""
    d = RAW_REPO / VEHICLES_SUBDIR
    out: list[dict] = []
    if not d.is_dir():
        return out
    for p in sorted(d.glob("*.md")):
        motos = _extract_block(p.read_text(encoding="utf-8"), "motorizations") or []
        # champ DB réel = displacement_l (fallbacks tolérants)
        def _disp(m):
            for k in ("displacement_l", "displacement_liter", "displacement_bucket"):
                v = m.get(k)
                if v is not None:
                    try:
                        return float(v)
                    except (TypeError, ValueError):
                        pass
            return None
        specs = [(str(m.get("fuel", "")).strip().lower(), _disp(m)) for m in motos]
        out.append({"slug": p.stem, "brand": p.stem.split("-", 1)[0], "specs": specs})
    return out


def resolve_vehicles(ev: dict, raw_vehicles: list[dict]) -> tuple[list[str], list[str]]:
    """Matche une famille moteur → fiches RAW : marque∈groupe + carburant + cylindrée (±tol).

    Déterministe + audité (basis). La sanity-carburant de l'injecteur reste le backstop.
    """
    group = (ev.get("manufacturer") or "").strip().lower()
    brands = GROUP_BRANDS.get(group, [])
    fuel = (ev.get("fuel") or "").lower()
    disp = ev.get("displacement_liter")
    matched, basis = [], []
    for v in raw_vehicles:
        if v["brand"] not in brands:
            continue
        for mf, md in v["specs"]:
            if fuel and fuel in mf and md is not None and disp is not None and abs(float(md) - float(disp)) <= DISPLACEMENT_TOL_L:
                matched.append(v["slug"])
                basis.append(f"{v['slug']}: marque∈{group} + {fuel} ~{disp}L (mot. {md}L)")
                break
    return matched, basis


def slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


FUEL_NORM = {"diesel": "diesel", "essence": "essence", "hybride": "hybride",
             "electrique": "electrique", "électrique": "electrique", "gpl": "gpl"}


def family_to_evidence(fam: dict) -> dict | None:
    code = (fam.get("family_code") or "").strip().lower()
    if not code:
        return None
    issues_raw = fam.get("common_issues") or {}
    if isinstance(issues_raw, str):
        try:
            issues_raw = json.loads(issues_raw)
        except json.JSONDecodeError:
            issues_raw = {}
    fuel = FUEL_NORM.get((fam.get("fuel_type") or "").strip().lower(), (fam.get("fuel_type") or "").strip().lower())
    disp = fam.get("displacement_cc")
    faults = []
    for topic, desc in (issues_raw.items() if isinstance(issues_raw, dict) else []):
        tkey = slugify(topic)
        mapping = TOPIC_MAP.get(tkey, {"gammes": [], "diag": []})
        faults.append({
            "issue": tkey,
            "label": f"{topic.replace('_', ' ').capitalize()} — {desc} (connu sur la famille {fam.get('family_code')})",
            "symptoms": [str(desc)],   # terse mais DB-autoritaire ; détaillé au scraping d'augmentation
            "severity": "medium",
            "diagnostic_safe": True,
            "needs_augmentation": True,  # le scraping ajoutera symptômes détaillés + sources externes
            "related_gammes": mapping["gammes"],
            "related_diagnostic": mapping["diag"],
            "sources": [{
                "url": f"internal://kg_engine_families/{fam.get('family_code')}",
                "source_type": "internal_kg",
                "source_market": "FR",
                "lang_original": "fr",
                "confidence": "high",
            }],
        })
    if not faults:
        return None
    return {
        "engine_family": code,
        "fuel": fuel or "unknown",
        "displacement_liter": round(disp / 1000, 1) if isinstance(disp, (int, float)) else None,
        "manufacturer": fam.get("manufacturer"),
        "market": "FR",
        # applies_to_vehicles : à RÉSOUDRE (matching marque+cylindrée+fuel → fiches RAW).
        # Laissé vide ici → l'injecteur ne fan-out pas tant que non résolu (pas de mis-attribution).
        "applies_to_vehicles": [],
        "_seed_provenance": "kg_engine_families (Internal DB first) — augmenter par scraping",
        "faults": faults,
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Seed DB-first de l'éditorial moteur depuis kg_engine_families (SELECT-only).")
    p.add_argument("--out-dir", required=True)
    p.add_argument("--family", default=None, help="Filtrer un family_code (ex. K9K)")
    args = p.parse_args()

    rows = sb_select("kg_engine_families", {"select": "*", "is_active": "eq.true"})
    if args.family:
        rows = [r for r in rows if (r.get("family_code") or "").lower() == args.family.lower()]
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_vehicles = load_raw_vehicles()

    written = skipped = total_matched = 0
    for fam in rows:
        ev = family_to_evidence(fam)
        if ev is None:
            skipped += 1
            continue
        matched, basis = resolve_vehicles(ev, raw_vehicles)
        ev["applies_to_vehicles"] = matched
        if basis:
            ev["_match_basis"] = basis
        total_matched += len(matched)
        path = out_dir / f"engine-{ev['engine_family']}.seed.yml"
        header = (f"# Seed DB-first — famille {fam.get('family_code')} ({fam.get('family_name')}, "
                  f"{fam.get('manufacturer')}). Source : kg_engine_families (Internal DB first).\n"
                  f"# applies_to_vehicles à résoudre (matching) ; scraping = augmentation symptômes/sources.\n")
        path.write_text(header + yaml.safe_dump(ev, sort_keys=False, allow_unicode=True, width=110), encoding="utf-8")
        written += 1
        print(f"[seed] {path.name} — {len(ev['faults'])} panne(s) · {len(ev['applies_to_vehicles'])} véhicule(s) RAW matché(s)"
              + (f" → {', '.join(ev['applies_to_vehicles'][:4])}{'…' if len(ev['applies_to_vehicles'])>4 else ''}" if ev['applies_to_vehicles'] else ""))

    print(f"\n== {written} famille(s) seedée(s) depuis le kg (0 scraping) · {skipped} sans common_issues "
          f"· {total_matched} rattachement(s) famille→véhicule RAW ==")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
