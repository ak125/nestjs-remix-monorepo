#!/usr/bin/env python3
"""
engine-issues-from-evidence.py — Injecte l'ÉDITORIAL multi-source par MOTORISATION
(pannes + maintenance connues d'une famille moteur) dans TOUTES les fiches RAW
véhicule qui portent ce moteur, à partir d'une ÉVIDENCE corroborée reformulée FR.

Axe TRANSVERSE motorisation (owner 2026-06-13) : le savoir se récolte UNE FOIS par
moteur (ex. N47) et se diffuse sur tous les véhicules qui l'embarquent — pas 20×
la même recherche. Construit le graphe `véhicule ↔ moteur ↔ panne ↔ pièce ↔ symptôme` :
chaque panne porte `related_gammes[]` (pièce vendable) + `related_diagnostic[]`
(système), VALIDÉS contre les entités RAW réelles (lien cassé → drop + note).

Position pipeline (PR-C) :

    harvest multi-tier PAR MOTEUR (FR/EU d'abord : Rappel Conso, forums/bases FR,
      équipementiers ; constructeur + US en complément)
      → reformulation FR non-verbatim + provenance + corroboration  [HARVEST]
      → evidence engine YAML (revue-able)                           ← INTERFACE
      → CE SCRIPT : fan-out + validation liens + confidence + inject [DÉTERMINISTE]
      → RAW known_issues_by_engine/maintenance_by_engine remplis    [GOUVERNÉ]
      → RAW→WIKI→ADR-083 (BRONZE→ARGENT)

DÉTERMINISTE : zéro réseau, zéro DB, zéro invention. Valide les liens contre le
FILESYSTEM RAW (slugs gammes + diagnostic existants). Invariants identiques v1
(multi-source, corroboration ADR-033 2_medium_concordant, structure-follows-
evidence, fail-closed prescriptif, FR-only, additif byte-à-byte) + :
  - FAN-OUT : applies_to_vehicles[] → chaque fiche RAW existante recevant ce moteur.
  - SANITY CARBURANT : refuse d'attacher un moteur diesel à une fiche sans
    motorisation diesel (lit le bloc motorizations DB ; no silent fallback → note).
  - CROSS-LINK VALIDÉ : related_gammes/related_diagnostic filtrés contre les
    entités RAW réelles (lien non résolu = retiré + validation_note, jamais de
    lien mort vers le WIKI).
  - MAINTENANCE : remplit aussi maintenance_by_engine (operations + intervalles).

Usage :
  python3 scripts/wiki-generators/engine-issues-from-evidence.py \
      --evidence audit/content/prc-evidence/engine-n47.yml --dry-run --out-dir /tmp/prc
  python3 scripts/wiki-generators/engine-issues-from-evidence.py --evidence <f.yml> --merge

Config env : AUTOMECANIK_RAW_PATH (default /opt/automecanik/automecanik-raw)
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import yaml

SCRIPT_ID = "script:engine-issues-from-evidence@v2"
RAW_REPO = Path(os.environ.get("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
VEHICLES_SUBDIR = Path("recycled") / "rag-knowledge" / "vehicles"
GAMMES_SUBDIR = Path("recycled") / "rag-knowledge" / "gammes"
DIAGNOSTIC_SUBDIR = Path("recycled") / "rag-knowledge" / "diagnostic"

MANAGED_KEYS = ("known_issues_by_engine", "maintenance_by_engine", "recalls", "validation_notes")

HIGH_TRUST_TYPES = {"constructeur", "equipementier", "recall", "base_technique"}
VALID_SOURCE_TYPES = HIGH_TRUST_TYPES | {"presse", "forum", "fournisseur"}
CONF_ORDER = ("low", "medium", "high")

# Fail-closed : VALEUR PRESCRIPTIVE à risque PHYSIQUE (couple, pression, fluide, jeu,
# électrique). PAS les intervalles d'entretien en km (orientation, pas risque).
PRESCRIPTIVE_RE = re.compile(
    r"\b\d+(?:[.,]\d+)?\s?(?:N\.?m|Nm|newton.?m[eè]tres?|bars?|psi|"
    r"litres?|\bl\b|ml|cl|°|degr[eé]s?|\bmm\b|microns?|volts?|\bV\b|amp[eè]res?|\bA\b)\b",
    re.IGNORECASE,
)


def dump_yaml(data) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=110, default_flow_style=False)


# ==========================================================================
# CORROBORATION DÉTERMINISTE
# ==========================================================================


def _bump(conf: str, steps: int = 1) -> str:
    i = CONF_ORDER.index(conf) if conf in CONF_ORDER else 0
    return CONF_ORDER[min(i + steps, len(CONF_ORDER) - 1)]


def _domain_of(url: str) -> str:
    m = re.search(r"https?://([^/]+)/?", url)
    host = m.group(1).lower() if m else url.lower()
    return re.sub(r"^www\.", "", host)


def compute_corroboration(sources: list[dict]) -> dict:
    if not sources:
        return {"independent_sources": 0, "confidence_effective": "low"}
    confs = [s.get("confidence", "low") for s in sources]
    base = max(confs, key=lambda c: CONF_ORDER.index(c) if c in CONF_ORDER else 0)
    domains = {_domain_of(s.get("url", "")) for s in sources if s.get("url")}
    independent = len(domains) if domains else len(sources)
    has_high_tier = any(s.get("source_type") in HIGH_TRUST_TYPES for s in sources)
    effective = _bump(base, 1) if (independent >= 2 and has_high_tier) else base
    return {"independent_sources": independent, "confidence_effective": effective}


# ==========================================================================
# RÉFÉRENTIELS RAW (validation des liens — filesystem, déterministe)
# ==========================================================================


def load_slugs(subdir: Path) -> set[str]:
    d = RAW_REPO / subdir
    return {p.stem for p in d.glob("*.md")} if d.is_dir() else set()


def validate_links(values, valid: set[str], kind: str, ctx: str, notes: list[str]) -> list[str]:
    """Filtre une liste de slugs contre les entités RAW réelles. Lien mort → note."""
    out = []
    for v in values or []:
        if v in valid:
            out.append(v)
        else:
            notes.append(f"{ctx} : {kind} '{v}' ne résout vers aucune entité RAW — lien retiré (pas de lien mort WIKI).")
    return out


# ==========================================================================
# VALIDATION / FAIL-CLOSED (fait → issue normalisée)
# ==========================================================================


def normalize_sources(sources: list[dict]) -> list[dict]:
    return [{
        "url": s.get("url"),
        "source_type": s.get("source_type"),
        "source_market": s.get("source_market", "unknown"),
        "lang_original": s.get("lang_original", "unknown"),
        "confidence": s.get("confidence", "low"),
    } for s in sources]


def validate_fault(fault: dict, engine_code: str, gammes: set[str], diags: set[str], notes: list[str]) -> dict | None:
    slug = fault.get("issue")
    label = (fault.get("label") or "").strip()
    symptoms = [s.strip() for s in (fault.get("symptoms") or []) if s and s.strip()]
    sources = fault.get("sources") or []

    if not slug or not re.fullmatch(r"[a-z0-9_]+", str(slug)):
        notes.append(f"fait rejeté : slug invalide ({slug!r}).")
        return None
    if not label or not symptoms:
        notes.append(f"fait '{slug}' rejeté : label/symptoms FR vides (FR-only).")
        return None
    if not sources:
        notes.append(f"fait '{slug}' rejeté : aucune source (multi-source obligatoire).")
        return None
    for s in sources:
        if s.get("source_type") not in VALID_SOURCE_TYPES:
            notes.append(f"fait '{slug}' : source_type '{s.get('source_type')}' inconnu — rejeté.")
            return None

    if PRESCRIPTIVE_RE.search(label + " " + " ".join(symptoms)):
        if not any(s.get("source_type") in {"constructeur", "equipementier"} for s in sources):
            notes.append(f"fait '{slug}' : valeur prescriptive à risque sans source OEM → FAIL-CLOSED (non exporté).")
            return None

    # engine_code résolu par le harvest (axe engine_family) — satisfait le profil ARGENT
    # `known_issues_by_engine.required_fields:[issue, engine_code, source]`. La DB le laisse
    # null (sparse) ; le scraping le résout — exactement le rôle de PR-C (owner 2026-06-13).
    issue: dict = {"issue": slug, "engine_code": engine_code, "label": label, "symptoms": symptoms}
    if fault.get("typical_onset_km") is not None:
        issue["typical_onset_km"] = fault["typical_onset_km"]
    if fault.get("severity") in ("low", "medium", "high"):
        issue["severity"] = fault["severity"]
    issue["related_gammes"] = validate_links(fault.get("related_gammes"), gammes, "related_gamme", f"fait '{slug}'", notes)
    issue["related_diagnostic"] = validate_links(fault.get("related_diagnostic"), diags, "related_diagnostic", f"fait '{slug}'", notes)
    issue["sources"] = normalize_sources(sources)
    issue["corroboration"] = compute_corroboration(sources)
    issue["reviewed"] = False
    issue["diagnostic_safe"] = bool(fault.get("diagnostic_safe", False))
    return issue


def validate_operation(op: dict, gammes: set[str], notes: list[str]) -> dict | None:
    slug = op.get("operation")
    label = (op.get("label") or "").strip()
    sources = op.get("sources") or []
    if not slug or not re.fullmatch(r"[a-z0-9_]+", str(slug)):
        notes.append(f"opération rejetée : slug invalide ({slug!r}).")
        return None
    if not label or not sources:
        notes.append(f"opération '{slug}' rejetée : label/sources manquants.")
        return None
    out: dict = {"operation": slug, "label": label}
    if op.get("interval_km") is not None:
        out["interval_km"] = op["interval_km"]   # intervalle = orientation, pas risque physique
    out["related_gammes"] = validate_links(op.get("related_gammes"), gammes, "related_gamme", f"opération '{slug}'", notes)
    out["sources"] = normalize_sources(sources)
    out["corroboration"] = compute_corroboration(sources)
    out["reviewed"] = False
    return out


# ==========================================================================
# BLOCS MANAGED
# ==========================================================================


def extract_block_value(text: str, key: str):
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


def render_managed_block(key: str, value) -> str:
    return (
        f"# >>> DB-MANAGED BLOCK: {key} — {SCRIPT_ID} (ne pas éditer à la main)\n"
        + dump_yaml({key: value})
        + f"# <<< END DB-MANAGED BLOCK: {key}\n"
    )


def merge_managed_blocks(existing: str, updated: dict) -> str:
    if not existing.startswith("---\n") or existing.find("\n---", 4) == -1:
        raise ValueError("fiche sans frontmatter fermé — merge refusé")
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


# ==========================================================================
# SANITY CARBURANT (le véhicule porte-t-il bien ce carburant ?)
# ==========================================================================


def vehicle_has_fuel(existing: str, fuel: str, notes: list[str], slug: str) -> bool:
    motos = extract_block_value(existing, "motorizations")
    if not motos:
        notes.append(f"{slug}: bloc motorizations absent — sanity carburant ignorée (à revérifier).")
        return True
    fuels = " ".join(str(m.get("fuel", "")).lower() for m in motos)
    if fuel.lower() in fuels:
        return True
    notes.append(f"{slug}: aucune motorisation '{fuel}' en DB — moteur NON attaché (anti mis-attribution).")
    return False


# ==========================================================================
# INJECTION (fan-out moteur → véhicules)
# ==========================================================================


def build_engine_entry(ev: dict, axis_key_type: str, vehicle_slug: str, issues: list[dict]) -> dict:
    return {
        "axis_key_type": axis_key_type,
        "applies_to": {
            "make": ev.get("manufacturer"),
            "model_generation": vehicle_slug.split("-", 1)[-1] if "-" in vehicle_slug else vehicle_slug,
            "fuel": ev.get("fuel"),
            "engine_family": ev.get("engine_family"),
            "displacement_liter": ev.get("displacement_liter"),
            "market": ev.get("market", "EU"),
        },
        "source": {"type": "editorial", "origin": "scraping PR-C (multi-source par moteur)",
                   "note": "clé créée à la demande (structure-follows-evidence) ; éditorial diffusé depuis l'évidence moteur."},
        "issues": issues,
    }


def build_recalls(ev: dict, valid_issues: list[dict]) -> list[dict]:
    """Extrait les RAPPELS OFFICIELS (source_type=recall, gouvernemental) en bloc dédié.

    Satisfait le composant ARGENT `recalls_official` (frontmatter:recalls). Le rappel
    reste AUSSI dans l'issue concernée ; ici on l'expose comme fait autoritaire distinct.
    """
    recalls = []
    for issue in valid_issues:
        for s in issue.get("sources", []):
            if s.get("source_type") == "recall":
                recalls.append({
                    "related_issue": issue["issue"],
                    "engine_code": ev.get("engine_family"),
                    "label": issue["label"],
                    "authority": _domain_of(s.get("url", "")),
                    "url": s.get("url"),
                    "source_market": s.get("source_market", "unknown"),
                })
    return recalls


def inject_vehicle(existing: str, ev: dict, valid_issues: list[dict], valid_ops: list[dict],
                   extra_notes: list[str]) -> tuple[str, int, int, int]:
    code = ev["engine_family"]
    key = f"engine_family:{code}"
    kibe = extract_block_value(existing, "known_issues_by_engine")
    mbe = extract_block_value(existing, "maintenance_by_engine") or {}
    if kibe is None:
        raise ValueError("bloc known_issues_by_engine absent — fiche non générée par vehicle-from-db ?")

    notes_existing = extract_block_value(existing, "validation_notes") or []
    new_notes = list(extra_notes)
    injected = created = ops_added = 0

    # known_issues_by_engine
    if key not in kibe:
        kibe[key] = build_engine_entry(ev, "engine_family", "x-" + ev.get("manufacturer", ""), [])
        # applies_to.model_generation corrigé ci-dessous au niveau véhicule
        created = 1
    kibe[key]["issues"] = kibe[key].get("issues", [])
    seen = {i.get("issue") for i in kibe[key]["issues"]}
    for issue in valid_issues:
        if issue["issue"] in seen:
            new_notes.append(f"fait '{issue['issue']}' déjà présent sous {key} — dédup.")
            continue
        kibe[key]["issues"].append(issue)
        seen.add(issue["issue"])
        injected += 1

    # maintenance_by_engine
    if valid_ops:
        if key not in mbe:
            mbe[key] = {"axis_key_type": "engine_family",
                        "applies_to": {"engine_family": code, "fuel": ev.get("fuel")},
                        "source": {"type": "editorial", "origin": "scraping PR-C (par moteur)"},
                        "operations": []}
        mbe[key]["operations"] = mbe[key].get("operations", [])
        seen_ops = {o.get("operation") for o in mbe[key]["operations"]}
        for op in valid_ops:
            if op["operation"] in seen_ops:
                continue
            mbe[key]["operations"].append(op)
            seen_ops.add(op["operation"])
            ops_added += 1

    updated = {"known_issues_by_engine": kibe}
    if valid_ops:
        updated["maintenance_by_engine"] = mbe
    # Rappels officiels — bloc dédié, fusionné avec l'existant (dédup par url)
    new_recalls = build_recalls(ev, valid_issues)
    if new_recalls:
        existing_recalls = extract_block_value(existing, "recalls") or []
        seen_urls = {r.get("url") for r in existing_recalls}
        merged_recalls = existing_recalls + [r for r in new_recalls if r.get("url") not in seen_urls]
        updated["recalls"] = merged_recalls
    merged_notes = list(notes_existing) + new_notes
    if merged_notes:
        updated["validation_notes"] = merged_notes
    return merge_managed_blocks(existing, updated), injected, created, ops_added


# ==========================================================================
# MAIN
# ==========================================================================


def main() -> int:
    p = argparse.ArgumentParser(description="Diffuse l'éditorial multi-source d'un MOTEUR sur toutes les fiches RAW véhicule concernées.")
    p.add_argument("--evidence", required=True)
    p.add_argument("--merge", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--out-dir", default=None)
    args = p.parse_args()
    if args.dry_run and not args.out_dir:
        p.error("--dry-run requiert --out-dir")
    if not args.dry_run and not args.merge:
        p.error("mode requis : --merge ou --dry-run --out-dir")

    ev = yaml.safe_load(Path(args.evidence).read_text(encoding="utf-8"))
    code, fuel = ev.get("engine_family"), ev.get("fuel")
    if not code or not fuel:
        sys.stderr.write("ERREUR : evidence.engine_family / fuel absents\n")
        return 2

    gammes = load_slugs(GAMMES_SUBDIR)
    diags = load_slugs(DIAGNOSTIC_SUBDIR)

    # Validation une fois (les faits sont identiques pour tous les véhicules du moteur).
    shared_notes: list[str] = []
    valid_issues = [i for i in (validate_fault(f, code, gammes, diags, shared_notes) for f in ev.get("faults", [])) if i]
    valid_ops = [o for o in (validate_operation(o, gammes, shared_notes) for o in ev.get("maintenance", [])) if o]
    rejected = (len(ev.get("faults", [])) - len(valid_issues)) + (len(ev.get("maintenance", [])) - len(valid_ops))

    out_base = Path(args.out_dir) / "vehicles" if args.dry_run else (RAW_REPO / VEHICLES_SUBDIR)
    out_base.mkdir(parents=True, exist_ok=True)

    targets = ev.get("applies_to_vehicles", [])
    done = absent = skipped = 0
    print(f"== moteur {code} ({fuel}) : {len(valid_issues)} panne(s) + {len(valid_ops)} entretien valides, "
          f"{rejected} rejetée(s) · fan-out {len(targets)} véhicule(s) ==")
    for vslug in targets:
        src = RAW_REPO / VEHICLES_SUBDIR / f"{vslug}.md"
        if not src.is_file():
            absent += 1
            print(f"[absent] {vslug} — pas de fiche RAW (ignoré)")
            continue
        existing = src.read_text(encoding="utf-8")
        per_notes: list[str] = []
        if not vehicle_has_fuel(existing, fuel, per_notes, vslug):
            skipped += 1
            print(f"[skip  ] {vslug} — sanity carburant: pas de '{fuel}' (mis-attribution évitée)")
            continue
        try:
            content, inj, cre, ops = inject_vehicle(existing, ev, valid_issues, valid_ops, shared_notes + per_notes)
        except ValueError as e:
            skipped += 1
            print(f"[skip  ] {vslug} — {e}")
            continue
        # corrige applies_to.model_generation au niveau du véhicule réel
        content = content.replace(f"model_generation: x-{ev.get('manufacturer','')}",
                                  f"model_generation: {vslug.split('-',1)[-1]}")
        tgt = out_base / f"{vslug}.md"
        tgt.write_text(content, encoding="utf-8")
        done += 1
        print(f"[{'dry' if args.dry_run else 'merge'}] {vslug} (issues +{inj}, clé {'créée' if cre else 'maj'}, entretien +{ops})")

    print(f"\n== {done} fiche(s) {'simulées' if args.dry_run else 'mergées'} · {absent} absente(s) · {skipped} skip carburant ==")
    if args.dry_run:
        print(f"[dry-run] sortie {out_base} — aucune écriture RAW/DB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
