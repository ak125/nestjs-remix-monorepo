#!/usr/bin/env python3
"""
vehicle-issues-from-evidence.py — Injecte l'ÉDITORIAL multi-source (pannes connues
par moteur) dans le bloc DB-MANAGED `known_issues_by_engine` des fiches RAW
véhicule, à partir d'un fichier d'ÉVIDENCE corroborée et déjà reformulée FR.

Position dans le pipeline (PR-C) :

    harvest multi-source (recall/OEM/équipementier/base technique/forum)
      → reformulation FR non-verbatim + provenance par fait        [HARVEST]
      → corroboration croisée (≥2 sources indépendantes)           [HARVEST]
      → evidence YAML (revue-able)                                 ← INTERFACE
      → CE SCRIPT : route + dédup + confidence déterministe + inject [INJECT]
      → RAW issues[] remplis → RAW→WIKI→ADR-083                    [GOUVERNÉ]

Le HARVEST (recherche web) produit l'évidence ; CE SCRIPT est la partie
DÉTERMINISTE, testable, réversible (zéro réseau, zéro DB, zéro invention) :
il ne fait QUE placer des faits déjà sourcés au bon endroit du squelette
`known_issues_by_engine`, en respectant les invariants.

Invariants appliqués (refus = le fait part en validation_notes, jamais exporté) :
  - MULTI-SOURCE : chaque issue porte sa LISTE `sources[]` (≥1) avec
    source_type/source_market/lang_original/confidence par source.
  - CORROBORATION : `confidence_effective` calculée déterministiquement —
    monte d'un cran si ≥2 sources INDÉPENDANTES dont au moins une de tier
    haute (constructeur/equipementier/recall/base_technique). Forum seul → low.
  - STRUCTURE-FOLLOWS-EVIDENCE : la clé fine `engine_family:<code>` /
    `fuel_displacement:<classe>:<bucket>` est CRÉÉE à la demande quand le fait
    est propre à ce niveau ; sinon il reste sur `fuel:<classe>`.
  - FAIL-CLOSED : un fait portant une VALEUR PRESCRIPTIVE à risque physique
    (couple N·m, pression bar, type/quantité fluide, jeu, valeur électrique)
    SANS source constructeur/OEM + périmètre exact → refusé dans issues[],
    consigné en validation_notes (jamais d'éditorial dangereux exporté).
  - FR-ONLY : `label`/`symptoms` doivent être présents et non-vides ;
    `lang_original` conservé en provenance (le harvest traduit AVANT).
  - ADDITIF : merge byte-à-byte hors blocs managed ; dédup par slug d'issue.

Usage :
  python3 scripts/wiki-generators/vehicle-issues-from-evidence.py \
      --evidence audit/content/prc-evidence/bmw-serie-3-coupe-e92.yml \
      --dry-run --out-dir /tmp/prc
  python3 scripts/wiki-generators/vehicle-issues-from-evidence.py \
      --evidence <file.yml> --merge        # écrit dans le RAW

Config env :
  AUTOMECANIK_RAW_PATH (default /opt/automecanik/automecanik-raw)
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import yaml

SCRIPT_ID = "script:vehicle-issues-from-evidence@v1"
RAW_REPO = Path(os.environ.get("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
VEHICLES_SUBDIR = Path("recycled") / "rag-knowledge" / "vehicles"

# Blocs que CE script met à jour (les autres — db_profile, motorizations — intacts).
MANAGED_KEYS = ("known_issues_by_engine", "maintenance_by_engine", "validation_notes")

# Tiers de source = pondération de confiance (PAS exclusion). Owner 2026-06-13.
HIGH_TRUST_TYPES = {"constructeur", "equipementier", "recall", "base_technique"}
VALID_SOURCE_TYPES = HIGH_TRUST_TYPES | {"presse", "forum", "fournisseur"}
CONF_ORDER = ("low", "medium", "high")

# Fail-closed : motifs de VALEUR PRESCRIPTIVE à risque physique (couple, pression,
# fluide, jeu, électrique). Détectés dans label/symptoms → refus si pas OEM-sourcé.
PRESCRIPTIVE_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s?(?:N\.?m|Nm|newton.?m[eè]tres?|bars?|psi|"
    r"litres?|\bl\b|ml|cl|°|degr[eé]s?|mm|microns?|volts?|\bV\b|amp[eè]res?|\bA\b)\b",
    re.IGNORECASE,
)


def dump_yaml(data) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=110, default_flow_style=False)


# ==========================================================================
# CONFIDENCE DÉTERMINISTE (corroboration croisée)
# ==========================================================================


def _bump(conf: str, steps: int = 1) -> str:
    i = CONF_ORDER.index(conf) if conf in CONF_ORDER else 0
    return CONF_ORDER[min(i + steps, len(CONF_ORDER) - 1)]


def compute_corroboration(sources: list[dict]) -> dict:
    """confidence_effective déterministe à partir des sources[].

    Base = meilleure confidence parmi les sources. Bump +1 cran SI ≥2 sources
    de DOMAINES distincts (corroboration indépendante) dont au moins une de
    tier haute. Forum unique reste 'low' (pas de promotion mono-source).
    """
    if not sources:
        return {"independent_sources": 0, "confidence_effective": "low"}
    confs = [s.get("confidence", "low") for s in sources]
    base = max(confs, key=lambda c: CONF_ORDER.index(c) if c in CONF_ORDER else 0)
    domains = {_domain_of(s.get("url", "")) for s in sources if s.get("url")}
    independent = len(domains) if domains else len(sources)
    has_high_tier = any(s.get("source_type") in HIGH_TRUST_TYPES for s in sources)
    effective = base
    if independent >= 2 and has_high_tier:
        effective = _bump(base, 1)
    return {"independent_sources": independent, "confidence_effective": effective}


def _domain_of(url: str) -> str:
    m = re.search(r"https?://([^/]+)/?", url)
    host = m.group(1).lower() if m else url.lower()
    return re.sub(r"^www\.", "", host)


# ==========================================================================
# VALIDATION / FAIL-CLOSED
# ==========================================================================


def validate_fault(fault: dict, notes: list[str]) -> dict | None:
    """Retourne l'issue normalisée prête à injecter, ou None (refus → notes)."""
    slug = fault.get("issue")
    label = (fault.get("label") or "").strip()
    symptoms = [s.strip() for s in (fault.get("symptoms") or []) if s and s.strip()]
    sources = fault.get("sources") or []

    if not slug or not re.fullmatch(r"[a-z0-9_]+", str(slug)):
        notes.append(f"fait rejeté : slug d'issue absent/invalide ({slug!r}).")
        return None
    if not label or not symptoms:
        notes.append(f"fait '{slug}' rejeté : label/symptoms FR vides (FR-only, no silent fallback).")
        return None
    if not sources:
        notes.append(f"fait '{slug}' rejeté : aucune source (multi-source obligatoire).")
        return None
    for s in sources:
        st = s.get("source_type")
        if st not in VALID_SOURCE_TYPES:
            notes.append(f"fait '{slug}' : source_type '{st}' inconnu — rejeté.")
            return None

    # FAIL-CLOSED : valeur prescriptive à risque dans le texte exporté ?
    blob = label + " " + " ".join(symptoms)
    if PRESCRIPTIVE_RE.search(blob):
        oem_scoped = any(s.get("source_type") in {"constructeur", "equipementier"} for s in sources)
        if not oem_scoped:
            notes.append(
                f"fait '{slug}' : valeur prescriptive à risque détectée dans le texte sans source "
                "constructeur/OEM → FAIL-CLOSED (consigné, non exporté). Reformuler sans la valeur "
                "ou fournir source OEM + périmètre exact."
            )
            return None

    corro = compute_corroboration(sources)
    issue: dict = {
        "issue": slug,
        "label": label,
        "symptoms": symptoms,
    }
    if fault.get("typical_onset_km") is not None:
        issue["typical_onset_km"] = fault["typical_onset_km"]
    if fault.get("severity") in ("low", "medium", "high"):
        issue["severity"] = fault["severity"]
    issue["sources"] = [{
        "url": s.get("url"),
        "source_type": s.get("source_type"),
        "source_market": s.get("source_market", "unknown"),
        "lang_original": s.get("lang_original", "unknown"),
        "confidence": s.get("confidence", "low"),
    } for s in sources]
    issue["corroboration"] = corro
    issue["reviewed"] = False
    issue["diagnostic_safe"] = bool(fault.get("diagnostic_safe", False))
    return issue


# ==========================================================================
# ROUTAGE (clé d'axe motorisation) + structure-follows-evidence
# ==========================================================================


def axis_key_for(fault: dict, notes: list[str]) -> tuple[str, str, dict] | None:
    """(key, axis_key_type, applies_to_base) pour le fait. None si invalide."""
    axis = fault.get("axis")
    fuel = (fault.get("fuel") or "").strip().lower()
    if not fuel:
        notes.append(f"fait '{fault.get('issue')}' : carburant absent — non routable.")
        return None
    if axis == "fuel":
        return f"fuel:{fuel}", "fuel", {"fuel": fuel}
    if axis == "fuel_displacement":
        bucket = fault.get("displacement_liter")
        if bucket is None:
            notes.append(f"fait '{fault.get('issue')}' : axis fuel_displacement sans displacement_liter.")
            return None
        return f"fuel_displacement:{fuel}:{bucket}", "fuel_displacement", {"fuel": fuel, "displacement_liter": float(bucket)}
    if axis == "engine_family":
        code = (fault.get("engine_family") or "").strip().lower()
        if not re.fullmatch(r"[a-z0-9]+", code):
            notes.append(f"fait '{fault.get('issue')}' : engine_family '{code}' invalide.")
            return None
        return f"engine_family:{code}", "engine_family", {"fuel": fuel, "engine_family": code}
    notes.append(f"fait '{fault.get('issue')}' : axis '{axis}' inconnu (fuel|fuel_displacement|engine_family).")
    return None


# ==========================================================================
# BLOCS MANAGED — extraction + ré-injection additive
# ==========================================================================


def extract_block_value(text: str, key: str):
    """Récupère la valeur YAML d'un bloc DB-MANAGED existant, ou None."""
    pat = re.compile(
        rf"^# >>> DB-MANAGED BLOCK: {re.escape(key)} .*?\n(.*?)^# <<< END DB-MANAGED BLOCK: {re.escape(key)}\n",
        re.DOTALL | re.MULTILINE,
    )
    m = pat.search(text)
    if not m:
        return None
    try:
        loaded = yaml.safe_load(m.group(1))
    except yaml.YAMLError:
        return None
    return (loaded or {}).get(key)


def render_managed_block(key: str, value) -> str:
    return (
        f"# >>> DB-MANAGED BLOCK: {key} — {SCRIPT_ID} (ne pas éditer à la main)\n"
        + dump_yaml({key: value})
        + f"# <<< END DB-MANAGED BLOCK: {key}\n"
    )


def merge_managed_blocks(existing: str, updated: dict) -> str:
    """Remplace UNIQUEMENT les blocs de `updated` ; tout le reste byte-à-byte."""
    if not existing.startswith("---\n") or existing.find("\n---", 4) == -1:
        raise ValueError("fiche sans frontmatter fermé — merge refusé (pas d'écrasement aveugle)")
    content = existing
    for key, value in updated.items():
        new_block = render_managed_block(key, value)
        pat = re.compile(
            rf"^# >>> DB-MANAGED BLOCK: {re.escape(key)} .*?\n.*?^# <<< END DB-MANAGED BLOCK: {re.escape(key)}\n",
            re.DOTALL | re.MULTILINE,
        )
        if pat.search(content):
            content = pat.sub(lambda _m: new_block, content, count=1)
        else:
            fm_end = content.find("\n---", 4)
            content = content[: fm_end + 1] + new_block + content[fm_end + 1 :]
    return content


def inject(existing: str, evidence: dict) -> tuple[str, dict]:
    """Injecte les faits d'évidence dans known_issues_by_engine. Retourne (contenu, stats)."""
    kibe = extract_block_value(existing, "known_issues_by_engine")
    if kibe is None:
        raise ValueError("bloc known_issues_by_engine absent — fiche non générée par vehicle-from-db ?")
    notes_existing = extract_block_value(existing, "validation_notes") or []
    new_notes: list[str] = []

    injected, rejected, created_keys = 0, 0, 0
    for fault in evidence.get("faults", []):
        issue = validate_fault(fault, new_notes)
        if issue is None:
            rejected += 1
            continue
        routed = axis_key_for(fault, new_notes)
        if routed is None:
            rejected += 1
            continue
        key, axis_key_type, applies_extra = routed

        if key not in kibe:
            # structure-follows-evidence : créer la clé fine à la demande
            applies_to = {
                "make": evidence.get("make"),
                "model_generation": evidence.get("model_generation"),
                **applies_extra,
                "market": fault.get("market", "unknown"),
            }
            kibe[key] = {
                "axis_key_type": axis_key_type,
                "applies_to": applies_to,
                "source": {"type": "editorial", "origin": "scraping PR-C (multi-source)",
                           "note": "clé créée à la demande (structure-follows-evidence)."},
                "issues": [],
            }
            created_keys += 1

        existing_slugs = {i.get("issue") for i in kibe[key].get("issues", [])}
        if issue["issue"] in existing_slugs:
            new_notes.append(f"fait '{issue['issue']}' déjà présent sous {key} — dédupliqué (skip).")
            continue
        kibe[key].setdefault("issues", []).append(issue)
        injected += 1

    updated = {"known_issues_by_engine": kibe}
    merged_notes = list(notes_existing) + new_notes
    if merged_notes:
        updated["validation_notes"] = merged_notes
    content = merge_managed_blocks(existing, updated)
    return content, {"injected": injected, "rejected": rejected, "created_keys": created_keys,
                     "notes": len(new_notes)}


# ==========================================================================
# MAIN
# ==========================================================================


def main() -> int:
    p = argparse.ArgumentParser(description="Injecte l'éditorial multi-source (issues par moteur) dans une fiche RAW véhicule.")
    p.add_argument("--evidence", required=True, help="Fichier evidence YAML (faits corroborés reformulés FR)")
    p.add_argument("--merge", action="store_true", help="Écrit dans le RAW (sinon dry-run requis)")
    p.add_argument("--dry-run", action="store_true", help="Écrit dans --out-dir au lieu du RAW")
    p.add_argument("--out-dir", default=None)
    args = p.parse_args()

    if args.dry_run and not args.out_dir:
        p.error("--dry-run requiert --out-dir")
    if not args.dry_run and not args.merge:
        p.error("mode requis : --merge (RAW) ou --dry-run --out-dir (preview)")

    evidence = yaml.safe_load(Path(args.evidence).read_text(encoding="utf-8"))
    slug = evidence.get("vehicle_slug")
    if not slug:
        sys.stderr.write("ERREUR : evidence.vehicle_slug absent\n")
        return 2

    fiche = RAW_REPO / VEHICLES_SUBDIR / f"{slug}.md"
    if not fiche.is_file():
        sys.stderr.write(f"ERREUR : fiche introuvable : {fiche}\n")
        return 2

    content, stats = inject(fiche.read_text(encoding="utf-8"), evidence)

    out_dir = Path(args.out_dir) / "vehicles" if args.dry_run else (RAW_REPO / VEHICLES_SUBDIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{slug}.md"
    target.write_text(content, encoding="utf-8")

    mode = "dry-run" if args.dry_run else "merge"
    print(f"[{mode}] {target}")
    print(f"  injectés: {stats['injected']} · clés créées: {stats['created_keys']} · "
          f"rejetés (fail-closed/invalides): {stats['rejected']} · notes: {stats['notes']}")
    if args.dry_run:
        print(f"[dry-run] aucune écriture dans le RAW ni en DB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
