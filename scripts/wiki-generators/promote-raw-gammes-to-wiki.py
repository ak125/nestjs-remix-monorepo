#!/usr/bin/env python3
"""
promote-raw-gammes-to-wiki.py — Promote RAW v5 SSOT gammes to WIKI v2.0.0 proposals.

Phase 1 WIKI bootstrap (multi-role : R1/R8/R2/R3 consumers downstream).
Mirror convention canon `gamme-from-web-corpus-generator.py` (single-file Python).

Canon doctrine 2026-05-27 :
  - RAG data is allowed as RAW candidate.
  - RAG data is forbidden only when silently promoted as confirmed WIKI/runtime truth.
  - candidate (from RAG) + confirmed (from OEM web) parallel, with cross_check_status.

Configurable via env :
  AUTOMECANIK_RAW_PATH  (default /opt/automecanik/automecanik-raw)
  AUTOMECANIK_WIKI_PATH (default /opt/automecanik/automecanik-wiki)
  SCHEMA_OPTION         (A | B | C — default C : dimensions in body+review_notes, schema unchanged)

Usage Phase A :
  python3 scripts/wiki-generators/promote-raw-gammes-to-wiki.py --gamme <slug> --dry-run [--verbose]

Refs :
  - Plan : ~/.claude/plans/verdict-verdict-oui-avec-cheeky-catmull.md
  - Schema : automecanik-wiki/_meta/schema/entity-data/gamme.schema.json (v2.0.0)
  - Canon mémoire : feedback_rag_to_raw_candidate_requalification
"""
import os
import re
import sys
import json
import uuid
import hashlib
import argparse
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
    import jsonschema
except ImportError:
    sys.stderr.write("Manque : pip install pyyaml jsonschema\n")
    sys.exit(1)

# === ENV CONFIG (mirror gamme-from-web-corpus-generator.py convention) ===
RAW_REPO = Path(os.getenv("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
WIKI_REPO = Path(os.getenv("AUTOMECANIK_WIKI_PATH", "/opt/automecanik/automecanik-wiki"))
GAMMES_DIR = RAW_REPO / "recycled" / "rag-knowledge" / "gammes"
WEB_DIR = RAW_REPO / "recycled" / "rag-knowledge" / "web"
PROPOSALS_DIR = WIKI_REPO / "proposals"
SCHEMA_PATH = WIKI_REPO / "_meta" / "schema" / "entity-data" / "gamme.schema.json"
RUN_LOG_DIR = Path("/opt/automecanik/app/audit/wiki-bootstrap-runs")

SCHEMA_OPTION_DEFAULT = "C"  # safe : dimensions in body + review_notes, schema unchanged

# === Task 3 + B1.1 : RAW reader + RAG candidate guard + tolerant frontmatter parser ===

# Taxonomic frontmatter fields toujours safe (structural metadata, pas prose RAG-generated)
TAXONOMIC_SAFE_FIELDS = {"slug", "title", "pg_id", "category", "intent_targets", "business_priority"}

# B1.1 : tolerant frontmatter regex — handles Convention A (indented 8 spaces) + B (non-indented).
# Convention A : 418 web files have "        ---" (8 spaces + ---) instead of "---".
FRONTMATTER_RE = re.compile(r'^([ \t]*)---\n(.*?)\n\1---\n(.*)$', re.DOTALL)


def parse_frontmatter(content):
    """Parse YAML frontmatter (Convention A indented OR B non-indented).

    Returns {"frontmatter": dict, "body": str, "indent": int} or None if no frontmatter.
    No silent fallback : if YAML invalid raises yaml.YAMLError.
    """
    m = FRONTMATTER_RE.match(content)
    if not m:
        return None
    indent = m.group(1)
    fm_text = m.group(2)
    body = m.group(3)
    # If indented, strip leading indent from each line of frontmatter
    if indent:
        fm_lines = [line[len(indent):] if line.startswith(indent) else line
                    for line in fm_text.split("\n")]
        fm_text = "\n".join(fm_lines)
        body_lines = [line[len(indent):] if line.startswith(indent) else line
                      for line in body.split("\n")]
        body = "\n".join(body_lines)
    fm = yaml.safe_load(fm_text)
    if not isinstance(fm, dict):
        return None
    return {"frontmatter": fm, "body": body.strip(), "indent": len(indent)}


def is_rag_recycled_candidate(frontmatter):
    """Detect RAG-enriched content for candidate requalification (canon doctrine 2026-05-27).

    Returns True if frontmatter signature indicates RAG-recycled auto-generated content.
    Per canon : RAG data is allowed as RAW candidate (statut rag_recycled_candidate,
    requires_review:true), forbidden only when silently promoted as confirmed WIKI/runtime.
    """
    if not isinstance(frontmatter, dict):
        return False
    lifecycle = frontmatter.get("lifecycle", {}) or {}
    enricher = (lifecycle.get("last_enriched_by") or "").lower()
    stage = (lifecycle.get("stage") or "").lower()
    return (
        "rag-enrich" in enricher
        or "rag_enrich" in enricher
        or stage == "auto_generated"
        or bool(lifecycle.get("v5_migrated_at"))
    )


def _build_safe_taxonomic_fields(fm):
    """Extract structural taxonomic metadata always safe (slug, pg_id, family, related_parts).

    These fields are not RAG-generated prose — they come from DB canonical (pg_alias)
    and are merely copied into rag-knowledge files. Always reliable.
    """
    safe = {k: v for k, v in fm.items() if k in TAXONOMIC_SAFE_FIELDS}
    dom = fm.get("domain", {}) or {}
    if "related_parts" in dom:
        safe["related_parts"] = dom["related_parts"]
    return safe


def read_raw_gamme(path):
    """Read RAW gamme file. Body conservé même si RAG-candidate (canon doctrine corrigée).

    Returns dict with:
      - frontmatter_full : full YAML frontmatter
      - safe_taxonomic_fields : structural metadata always safe
      - body : markdown body (preserved, marked candidate if RAG-recycled)
      - is_rag_candidate : True if RAG-enriched legacy detected
      - candidate_status : "rag_recycled_candidate" | "ssot_confirmed"
      - requires_review : True if RAG candidate
      - source_path : absolute path str
    """
    if not path.exists():
        raise FileNotFoundError(f"RAW gamme not found: {path}")
    content = path.read_text(encoding="utf-8")
    parsed = parse_frontmatter(content)
    if parsed is None:
        raise ValueError(f"No YAML frontmatter in {path}")
    fm_full = parsed["frontmatter"]
    is_cand = is_rag_recycled_candidate(fm_full)
    return {
        "frontmatter_full": fm_full,
        "safe_taxonomic_fields": _build_safe_taxonomic_fields(fm_full),
        "body": parsed["body"],
        "is_rag_candidate": is_cand,
        "candidate_status": "rag_recycled_candidate" if is_cand else "ssot_confirmed",
        "requires_review": is_cand,
        "source_path": str(path),
    }


def _web_file_matches_slug(fm, slug):
    """Check if a web file frontmatter matches the gamme slug.

    B1.2 : support 2 conventions :
      - Convention A (418 files) : slug_gamme scalar
      - Convention B (Hella/NGK) : mapped_gammes array
    """
    if fm.get("slug_gamme") == slug:
        return True
    mapped = fm.get("mapped_gammes")
    if isinstance(mapped, list) and slug in mapped:
        return True
    return False


def aggregate_web_corpus_by_slug(web_dir, slug):
    """Read web/*.md OEM-scraped corpus, return entries with slug_gamme==slug + source_uri.

    Tolerant parser supports Convention A (indented frontmatter) + B (non-indented + mapped_gammes).
    """
    results = []
    if not web_dir.exists():
        return results
    for f in sorted(web_dir.glob("*.md")):
        try:
            content = f.read_text(encoding="utf-8")
            parsed = parse_frontmatter(content)
            if parsed is None:
                continue
            fm = parsed["frontmatter"]
            if not _web_file_matches_slug(fm, slug):
                continue
            source_uri = fm.get("source_uri") or fm.get("source_url")
            if not source_uri:
                continue  # Guard : web source sans URL traçable = REFUS
            # B1.2 : detect mapped_gammes (Convention B) for matched_kind metadata
            matched_kind = "slug_gamme" if fm.get("slug_gamme") == slug else "mapped_gammes"
            all_mapped = fm.get("mapped_gammes") if isinstance(fm.get("mapped_gammes"), list) else None
            if not all_mapped and fm.get("slug_gamme"):
                all_mapped = [fm.get("slug_gamme")]
            results.append({
                "slug_gamme": slug,
                "matched_kind": matched_kind,
                "all_mapped_gammes": all_mapped or [],
                "source_uri": source_uri,
                "source_domain": fm.get("source_domain"),
                "title": fm.get("title"),
                "body": parsed["body"],
                "content_hash": fm.get("content_hash"),
                "truth_level": fm.get("truth_level"),
                "ingested_by": fm.get("ingested_by"),
                # B1.2 : capture vehicles from explicit frontmatter (NEVER body-inferred)
                "frontmatter_vehicles": fm.get("vehicles") if isinstance(fm.get("vehicles"), list) else None,
                "frontmatter_extra": {k: v for k, v in fm.items() if k in ("vehicles", "compatibility", "motorisations")},
                "path": str(f),
            })
        except (OSError, yaml.YAMLError):
            continue
    return results


# === B3 : compatibility-url-json ingest (PROD runtime proof source) ===

def read_compatibility_url_json(path):
    """B3+B5 — Read B2 audit JSON OR B4 cross-check JSON (auto-detect format).

    Returns dict with gamme_focus, pg_id, compatibility_proven_by_url (filtered status 200 + PASS_DB_ALIGNED).
    Canon :
      - non-200 entries are EXCLUDED (compatibility not proven by runtime URL)
      - STALE_URL_DB_MISSING entries are EXCLUDED from confirmed dimensions (B5)
    """
    if not path.exists():
        raise FileNotFoundError(f"Compatibility URL JSON not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))

    # B5 — Auto-detect B4 cross-check format (has 'results' array + 'classifications')
    is_b4_format = "results" in data and "classifications" in data
    if is_b4_format:
        # B4 JSON : filter to PASS_DB_ALIGNED only (STALE_URL_DB_MISSING excluded from confirmed)
        all_results = data.get("results", [])
        filtered = [e for e in all_results if e.get("classification") == "PASS_DB_ALIGNED"]
        stale = [e for e in all_results if e.get("classification") == "STALE_URL_DB_MISSING"]
        # Ensure status field (B4 entries don't have status from B2, defaults to 200 since they came from B2 proven set)
        for entry in filtered:
            if "status" not in entry:
                entry["status"] = 200
        return {
            "gamme_focus": data.get("gamme_focus", "multi-gammes"),
            "audit_id": data.get("audit_id"),
            "audit_date": data.get("audit_date"),
            "format": "b4_db_crosscheck",
            "compatibility_proven_by_url": filtered,
            "url_count": len(filtered),
            "stale_db_missing_count": len(stale),
            "stale_urls": [{"source_url": e.get("source_url"), "classification": e.get("classification"),
                            "issues": e.get("issues", [])} for e in stale],
            "url_count_total_input": len(all_results),
        }

    # B2 format : filter status 200 only
    filtered = filter_compatibility_status_200(data)
    return {
        "gamme_focus": data.get("gamme_focus"),
        "pg_id": data.get("pg_id"),
        "audit_id": data.get("audit_id"),
        "audit_date": data.get("audit_date"),
        "format": "b2_url_audit",
        "compatibility_proven_by_url": filtered,
        "url_count": len(filtered),
        "url_count_total_input": len(data.get("compatibility_proven_by_url", [])),
    }


def filter_compatibility_status_200(data):
    """Filter entries to keep only status 200 (compatibility proven by runtime URL)."""
    entries = data.get("compatibility_proven_by_url", []) if isinstance(data, dict) else data
    return [e for e in entries if e.get("status") == 200]


def summarize_compatibility_proof(compat_data):
    """Extract distinct brands + motorisations + model count from proven entries."""
    entries = compat_data.get("compatibility_proven_by_url", [])
    brands = sorted({e["brand"] for e in entries if e.get("brand")})
    motorisations = sorted({e["motorisation"] for e in entries if e.get("motorisation")})
    models = sorted({(e["brand"], e["model"]) for e in entries if e.get("model")})
    brand_moto = sorted({(e["brand"], e["motorisation"]) for e in entries})
    return {
        "brands": brands,
        "motorisations": motorisations,
        "model_count": len(models),
        "brand_motorisation_pairs": [{"brand": b, "motorisation": m} for b, m in brand_moto],
        "total_proven_urls": len(entries),
    }


def extract_web_relations(web_entry):
    """B1.2 — Extract relations (gammes + vehicles) from a web corpus entry.

    Canon doctrine 2026-05-27 :
    - gammes: from slug_gamme scalar OR mapped_gammes array (Convention A vs B)
    - vehicles: ONLY from EXPLICIT frontmatter `vehicles:` field (NEVER body-inferred)
    - relation_status: NO_VEHICLE_EVIDENCE explicit if no vehicles in frontmatter
    - source_uri: required (already filtered by aggregate)
    """
    gammes = list(web_entry.get("all_mapped_gammes") or [])
    if not gammes and web_entry.get("slug_gamme"):
        gammes = [web_entry["slug_gamme"]]
    # Vehicles : ONLY from explicit frontmatter, never inferred from body
    fm_vehicles = web_entry.get("frontmatter_vehicles") or (
        (web_entry.get("frontmatter_extra") or {}).get("vehicles")
    )
    if isinstance(fm_vehicles, list) and fm_vehicles:
        vehicles = [
            {
                "marque": (v.get("marque") or v.get("brand") or "").strip(),
                "modele": (v.get("modele") or v.get("model") or "").strip(),
                "motorisation": (v.get("motorisation") or v.get("engine") or "").strip(),
                "carburant": (v.get("carburant") or v.get("fuel") or "").strip(),
                "annees": v.get("annees") or v.get("years") or [],
            }
            for v in fm_vehicles
            if isinstance(v, dict)
        ]
        relation_status = "VEHICLE_EVIDENCE_PRESENT"
    else:
        vehicles = []
        relation_status = "NO_VEHICLE_EVIDENCE"
    return {
        "gammes": gammes,
        "vehicles": vehicles,
        "relation_status": relation_status,
        "matched_kind": web_entry.get("matched_kind"),
        "source_uri": web_entry.get("source_uri"),
        "source_domain": web_entry.get("source_domain"),
    }


# === Task 4 : source tier classifier + 9 dimensions extraction (candidate/confirmed parallel) ===

TIER1_OEM = {
    "bremboparts.com", "textar.com", "gates.com", "monroe.com", "bilstein.com",
    "valeo.com", "boschaftermarket.com", "bosch-mobility.com", "mahle-aftermarket.com",
    "sachs.de", "meyle.com", "zf.com", "aftermarket.zf.com",
    "continental-aftermarket.com", "kyb-europe.com", "ngkntk.com", "bosal.com",
}
TIER2 = {"fr.wikipedia.org", "en.wikipedia.org"}

SYMPTOMS_RE = re.compile(
    r'(?i)(symptôme|panne|dysfonctionnement|défaillance|encrassé|fumée|'
    r'perte de puissance|voyant|ralenti)'
)
SELECTION_RE = re.compile(
    r"(?i)(critère|vérifier|choisir|sélection|attention au|s'assurer|important de)"
)
KM_RE = re.compile(r'\b(\d{2,3})\s*000\s*km\b', re.IGNORECASE)
OEM_REF_RE = re.compile(r'\b[A-Z]?\d{5,10}[A-Z]?\b')
FUNCTION_HINT_RE = re.compile(
    r'(?i)^(.*?(?:permet|sert à|assure|régule|recycle|filtre|alimente|charge|protège|réduit|améliore).{20,200})'
)
# Issue 1 fix : preamble marketing rejection. The OEM web corpus often opens with
# generic catalog/marketing blurbs (cf. ngk-*.md "Notre catalogue 2025-2026...
# qui vous permet de trouver vos références") that match FUNCTION_HINT_RE on
# "permet" but describe the e-commerce experience, not the part function. Lines
# matching this blocklist are skipped when scanning for the function statement.
FUNCTION_MARKETING_BLOCKLIST_RE = re.compile(
    r'(?i)(catalogue|découvrez|promo|soldes|boutique|achat\s+en\s+ligne|'
    r'version\s+digitale|simplifier la vie|fonctionnalités conçues|en\s+ligne\.|'
    r'votre\s+sélection)'
)
# Issue 2 fix : RAW frontmatter slug-pattern enforcement. Some RAW files put
# free-text in related_parts (e.g. plaquette-de-frein has
# "Disques de frein (a controler systematiquement...)" instead of "disques-de-frein").
# The wiki schema requires `^[a-z0-9][a-z0-9-]*[a-z0-9]$`. Defensive filter.
SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$')


def classify_source_tier(domain, frontmatter=None):
    """Classify source tier. RAG-recycled-candidate acceptable but requires_review."""
    if frontmatter and is_rag_recycled_candidate(frontmatter):
        return "rag_recycled_candidate"
    if not domain:
        return "unknown"
    n = domain.lstrip("www.").lower()
    if n in TIER1_OEM or domain.lower() in TIER1_OEM:
        return "tier1"
    if n in TIER2 or domain.lower() in TIER2:
        return "tier2"
    return "unknown"


def _cross_check(candidate, confirmed):
    """Determine cross_check_status between RAG candidate and OEM-confirmed value."""
    cand_present = bool(candidate) and (str(candidate).strip() if not isinstance(candidate, list) else len(candidate) > 0)
    conf_present = bool(confirmed) and (str(confirmed).strip() if not isinstance(confirmed, list) else len(confirmed) > 0)
    if not cand_present and not conf_present:
        return "NEITHER"
    if not cand_present and conf_present:
        return "WEB_ONLY"
    if cand_present and not conf_present:
        return "RAG_ONLY"
    # Both present : substring overlap heuristic
    c_low = " ".join(map(str, candidate)).lower() if isinstance(candidate, list) else str(candidate).lower()
    w_low = " ".join(map(str, confirmed)).lower() if isinstance(confirmed, list) else str(confirmed).lower()
    overlap = len(set(c_low.split()) & set(w_low.split()))
    if overlap >= 3:
        return "WEB_CONFIRMS_RAG"
    return "WEB_DIFFERS_FROM_RAG"


def _dim_with_status(candidate_val, confirmed_val, is_rag_candidate, confirmed_source_uri=None):
    """Build a dimension dict with candidate/confirmed/cross_check_status structure."""
    return {
        "candidate_value": candidate_val,
        "candidate_source_kind": "rag_recycled_candidate" if is_rag_candidate else "ssot",
        "candidate_requires_review": is_rag_candidate and bool(candidate_val),
        "confirmed_value": confirmed_val,
        "confirmed_source_kind": "confirmed_by_web" if confirmed_val else None,
        "confirmed_source_uri": confirmed_source_uri,
        "cross_check_status": _cross_check(candidate_val, confirmed_val),
    }


def extract_dimensions(raw, web_corpus, compatibility_url_data=None):
    """Extract dimensions via candidate/confirmed parallel pattern (canon doctrine 2026-05-27).

    B3 : compatibility_url_data (optional, B2 JSON) = runtime URL proven tuples.
    When provided, enriches compatibility_factors with proven brands/motorisations
    (source_kind: compatibility_proven_by_runtime_url). NEVER body-inferred.
    """
    fm_full = raw["frontmatter_full"]
    safe_tax = raw["safe_taxonomic_fields"]
    dom = fm_full.get("domain", {}) or {}
    sel = fm_full.get("selection", {}) or {}
    is_cand = raw["is_rag_candidate"]
    today = datetime.now().date().isoformat()

    # source_refs : RAG file flagged candidate (requires_review), web sources tier-classified
    refs = []
    if is_cand:
        refs.append({
            "kind": "rag_recycled_candidate",
            "origin_repo": "automecanik-raw",
            "origin_path": raw["source_path"].replace(str(RAW_REPO) + "/", ""),
            "tier": "rag_recycled_candidate",
            "trust": "candidate",
            "requires_review": True,
            "allowed_for": ["proposal_review", "candidate_fact_extraction"],
            "forbidden_for": ["wiki_accepted_auto", "runtime_direct"],
        })
    else:
        refs.append({
            "kind": "recycled",
            "origin_repo": "automecanik-raw",
            "origin_path": raw["source_path"].replace(str(RAW_REPO) + "/", ""),
            "captured_at": fm_full.get("updated_at") or today,
            "tier": "ssot",
            "trust": "confirmed",
            "requires_review": False,
        })
    for w in web_corpus:
        refs.append({
            "kind": "oem_web",
            "source_uri": w.get("source_uri", ""),
            "source_domain": w.get("source_domain", ""),
            "content_hash": w.get("content_hash"),
            "tier": classify_source_tier(w.get("source_domain", "")),
            "trust": "confirmed",
            "requires_review": False,
        })

    all_web_body = "\n".join(w.get("body", "") for w in web_corpus)

    # function : candidate from RAG domain.role + confirmed from OEM web FUNCTION_HINT_RE.
    # Issue 1 fix (2026-05-28) : line-by-line scan with marketing-preamble rejection.
    # Some OEM corpus pages (e.g. ngk-*.md for vanne-egr) open with catalog blurbs that
    # match FUNCTION_HINT_RE on "permet" but describe e-commerce, not part function.
    # We now scan body line-by-line, skip lines matching FUNCTION_MARKETING_BLOCKLIST_RE,
    # and take the first non-marketing line that matches FUNCTION_HINT_RE.
    rag_function = (dom.get("role") or "").strip()
    web_function, web_function_uri = "", None
    for w in web_corpus:
        body = w.get("body", "")[:2000]
        for line in body.split("\n"):
            line = line.strip()
            if len(line) < 30:
                continue
            if FUNCTION_MARKETING_BLOCKLIST_RE.search(line):
                continue  # marketing preamble, skip
            m = FUNCTION_HINT_RE.search(line)
            if m:
                web_function = m.group(1).strip()[:280]
                web_function_uri = w.get("source_uri")
                break
        if web_function:
            break
    function = _dim_with_status(rag_function, web_function, is_cand, web_function_uri)

    # selection_criteria : candidate from RAG selection.criteria + confirmed from OEM web
    rag_sel = list(sel.get("criteria", []) or [])
    web_sel = []
    for line in all_web_body.split("\n"):
        if SELECTION_RE.search(line) and 30 < len(line) < 200 and line not in web_sel:
            web_sel.append(line.strip())
        if len(web_sel) >= 8:
            break
    selection_criteria = _dim_with_status(rag_sel, web_sel, is_cand)

    # symptoms : candidate from RAG diagnostic.symptoms[].label (real failure symptoms,
    # YAML-structured) + confirmed from OEM web SYMPTOMS_RE.
    # Task 8e (2026-05-29) — previously read domain.confusion_with which contains part-
    # confusion warnings ("Filtre à air = ... vs Filtre à huile = ..."), NOT failure symptoms.
    # diagnostic.symptoms[] is the canonical source per ADR-033 §C8.
    diag = fm_full.get("diagnostic", {}) or {}
    rag_sym = []
    for s in (diag.get("symptoms") or []):
        if isinstance(s, dict) and s.get("label"):
            rag_sym.append(s["label"].strip())
    # Fallback for legacy RAW without diagnostic.symptoms : confusion_with differences
    if not rag_sym:
        rag_sym = [c.get("difference", "") for c in (dom.get("confusion_with", []) or []) if c.get("difference")]
    web_sym = []
    for line in all_web_body.split("\n"):
        if SYMPTOMS_RE.search(line) and len(line) > 15 and line not in web_sym:
            web_sym.append(line.strip())
        if len(web_sym) >= 10:
            break
    symptoms = _dim_with_status(rag_sym, web_sym, is_cand)

    # related_parts : taxonomic, always safe (slugs only).
    # Issue 2 fix (2026-05-28) : defensive filter against RAW frontmatter quality issues.
    # Some RAW files put human-readable free-text (e.g. plaquette-de-frein has
    # "Disques de frein (a controler systematiquement...)") instead of slugs. The wiki
    # schema requires pattern `^[a-z0-9][a-z0-9-]*[a-z0-9]$`. We filter out non-slugs
    # to avoid schema validation failures downstream. Upstream RAW frontmatter should
    # be fixed separately (out of scope here).
    related_parts_raw = list(safe_tax.get("related_parts", []) or [])
    related_parts = [s for s in related_parts_raw if isinstance(s, str) and SLUG_RE.fullmatch(s)]
    related_parts_filtered_count = len(related_parts_raw) - len(related_parts)

    # compatibility_factors : web extraction (factuel motorisation) + B3 URL-proven enrichment
    compat = {}
    motos = sorted(set(re.findall(
        r'\b(\d\.\d\s*(?:dCi|HDi|TDI|TCe|HDI|JTDM|CRDi))\b', all_web_body, re.IGNORECASE
    )))
    if motos:
        compat["motorisation"] = motos[:20]
    eu = sorted(set(re.findall(r'(?i)\bEuro\s*(\d)\b', all_web_body)))
    if eu:
        compat["norme_euro"] = [f"Euro {e}" for e in eu]

    # B3+B5 enrichment : compatibility_proven_by_runtime_url (NEVER body-inferred)
    compatibility_proven_by_url = []
    motorisation_profiles = []
    if compatibility_url_data:
        compat_entries = compatibility_url_data.get("compatibility_proven_by_url", [])
        # Only status 200 proven entries (defensive — already filtered by read_compatibility_url_json)
        all_filtered = [e for e in compat_entries if e.get("status") == 200]
        # B5 : if multi-gamme JSON (B4 cross-check), filter by current gamme slug
        current_gamme_slug = safe_tax.get("slug")
        compatibility_proven_by_url = [e for e in all_filtered
                                       if e.get("gamme") == current_gamme_slug or not e.get("gamme")]
        # If filter yields none, use all (B2 single-gamme JSON)
        if not compatibility_proven_by_url and all_filtered:
            compatibility_proven_by_url = all_filtered

        if compatibility_proven_by_url:
            summary = summarize_compatibility_proof({"compatibility_proven_by_url": compatibility_proven_by_url})
            compat["marques"] = summary["brands"]
            compat["motorisations"] = summary["motorisations"]
            compat["brand_motorisation_pairs"] = summary["brand_motorisation_pairs"]
            compat["model_count_distinct"] = summary["model_count"]
            compat["proven_url_count"] = summary["total_proven_urls"]

            # B5 — detect DB-rich enrichment (presence of db_type_name/db_type_fuel)
            is_db_rich = any("db_type_name" in e or "db_type_fuel" in e
                             for e in compatibility_proven_by_url)
            if is_db_rich:
                # B5 enriched dimensions from DB labels
                fuels = sorted({(e.get("db_type_fuel") or "").strip()
                                for e in compatibility_proven_by_url
                                if e.get("db_type_fuel")})
                power_ps_values = [int(e["db_type_power_ps"]) for e in compatibility_proven_by_url
                                   if e.get("db_type_power_ps") and str(e["db_type_power_ps"]).isdigit()]
                year_from_values = [e["db_type_year_from"] for e in compatibility_proven_by_url
                                    if isinstance(e.get("db_type_year_from"), int)]
                year_to_values = [e["db_type_year_to"] for e in compatibility_proven_by_url
                                  if isinstance(e.get("db_type_year_to"), int)]
                compat["fuels"] = list(fuels)
                if power_ps_values:
                    compat["power_ps_range"] = {"min": min(power_ps_values),
                                                "max": max(power_ps_values),
                                                "count": len(power_ps_values)}
                if year_from_values and year_to_values:
                    compat["year_range"] = {"min": min(year_from_values),
                                            "max": max(y for y in year_to_values if y)}
                compat["type_ids"] = sorted({e.get("type_id") for e in compatibility_proven_by_url
                                              if e.get("type_id")})
                compat["db_aligned_count"] = len(compatibility_proven_by_url)
                compat["stale_count"] = compatibility_url_data.get("stale_db_missing_count", 0)
                compat["source_kind"] = "compatibility_proven_by_runtime_url_and_db"

                # Build motorisation_profiles[] (rich tuples per vehicle-motorisation)
                for e in compatibility_proven_by_url:
                    motorisation_profiles.append({
                        "brand": e.get("brand"),
                        "model": e.get("model"),
                        "type_id": e.get("type_id"),
                        "type_name": e.get("db_type_name"),
                        "fuel": e.get("db_type_fuel"),
                        "power_ps": e.get("db_type_power_ps"),
                        "year_from": e.get("db_type_year_from"),
                        "year_to": e.get("db_type_year_to"),
                        "model_name": e.get("db_model_name"),
                        "brand_name": e.get("db_brand_name"),
                        "source_url": e.get("source_url"),
                        "db_status": "PASS_DB_ALIGNED",
                    })
            else:
                # B3 only (no DB enrichment)
                compat["source_kind"] = "compatibility_proven_by_runtime_url"

    # maintenance_context : YAML-structured frontmatter (canonical) + web body fallback.
    # Task 8e (2026-05-29) — prefer fm.maintenance.* over body-regex (YAML is structured,
    # source-of-truth ; regex is fragile and noisy). Body regex stays as fallback.
    maint = {}
    maint_yaml = fm_full.get("maintenance", {}) or {}
    interval_yaml = maint_yaml.get("interval", {}) or {}
    interval_val = interval_yaml.get("value")
    # Parse YAML interval (can be int or "20000-40000" range string)
    if interval_val is not None:
        if isinstance(interval_val, str) and "-" in interval_val:
            try:
                # Use the lower bound for periodicite_km (conservative)
                maint["periodicite_km"] = int(interval_val.split("-")[0].strip())
            except ValueError:
                pass
        elif isinstance(interval_val, int):
            maint["periodicite_km"] = interval_val
        if interval_yaml.get("note"):
            maint["periodicite_note"] = interval_yaml.get("note")
        if interval_yaml.get("source"):
            maint["periodicite_source"] = interval_yaml.get("source")
    # Fallback : body-regex extraction (legacy path)
    if "periodicite_km" not in maint:
        km_matches = KM_RE.findall(all_web_body)
        if km_matches:
            kms = sorted(int(k) for k in km_matches)
            maint["periodicite_km"] = kms[len(kms) // 2] * 1000
    # Wear signs (YAML-structured failure indicators)
    wear_signs = maint_yaml.get("wear_signs") or []
    if wear_signs and isinstance(wear_signs, list):
        maint["wear_signs"] = [s for s in wear_signs if isinstance(s, str)][:5]
    # Good practices (YAML-structured do/don't)
    good_practices = maint_yaml.get("good_practices") or []
    if good_practices and isinstance(good_practices, list):
        maint["good_practices"] = [s for s in good_practices if isinstance(s, str)][:5]
    # Anti-pattern warnings (kept for backward compat — domain.must_not_contain)
    must_not = dom.get("must_not_contain", []) or []
    if must_not:
        maint["risques_erreur"] = list(must_not)[:5]
        maint["risques_erreur_source"] = "rag_recycled_candidate" if is_cand else "ssot"

    # oem_references : web body extraction only
    oem_refs = []
    seen = set()
    for ref in OEM_REF_RE.findall(all_web_body)[:50]:
        if ref not in seen and len(ref) >= 6:
            oem_refs.append({"ref": ref})
            seen.add(ref)
        if len(oem_refs) >= 20:
            break

    # fuel_engine_differences : web body detection
    fuel_diff = {}
    if re.search(r'(?i)diesel', all_web_body) and re.search(r'(?i)essence', all_web_body):
        fuel_diff["note"] = (
            "diesel et essence mentionnés dans sources OEM — "
            "vérification humaine de la différence technique requise"
        )

    # B1.2 : extract web_relations per source (gammes + vehicles + relation_status)
    web_relations = [extract_web_relations(w) for w in web_corpus]

    # Task 8e (2026-05-29) — equipementier_brands : OEM/équipementier reference list
    # from sel.brands YAML (premium / standard / budget tiers). Helps the reviewer see
    # which brands are canon-attested in the RAW without re-reading the source.
    brands_yaml = sel.get("brands", {}) or {}
    equipementier_brands = {}
    for tier in ("premium", "standard", "budget"):
        tier_list = brands_yaml.get(tier)
        if isinstance(tier_list, list) and tier_list:
            equipementier_brands[tier] = [b for b in tier_list if isinstance(b, str)][:8]

    # Task 8e (2026-05-29) — variants_summary : product variants (e.g. filter media types
    # papier/mousse/sport for filtre-a-air) from variants[] YAML. Short name + 1-3
    # functional differences per variant.
    variants_yaml = fm_full.get("variants", []) or []
    variants_summary = []
    for v in variants_yaml:
        if isinstance(v, dict) and v.get("name"):
            entry = {"name": v["name"]}
            fd = v.get("functional_differences")
            if isinstance(fd, list) and fd:
                entry["functional_differences"] = [d for d in fd if isinstance(d, str)][:3]
            variants_summary.append(entry)

    return {
        "function": function,
        "source_refs": refs,
        "related_parts": related_parts,
        "selection_criteria": selection_criteria,
        "symptoms": symptoms,
        "compatibility_factors": compat,
        "maintenance_context": maint,
        "oem_references": oem_refs,
        "fuel_engine_differences": fuel_diff,
        "rag_candidate_present": is_cand,
        "web_relations": web_relations,
        "compatibility_proven_by_url": compatibility_proven_by_url,
        "motorisation_profiles": motorisation_profiles,
        # Issue 2 trace : count of related_parts entries filtered out as non-slug
        "related_parts_filtered_count": related_parts_filtered_count,
        # Task 8e (2026-05-29) : new dimensions from YAML frontmatter
        "equipementier_brands": equipementier_brands,
        "variants_summary": variants_summary,
    }
# === Task 8c (2026-05-28, additive) : decision_brief projection (post-extraction) ===

# Cross-check status priority (mirrors _cross_check return values, descending confidence).
# Used to compute min(input statuses) for the derived decision_brief.
_CROSS_CHECK_PRIORITY = {
    "WEB_CONFIRMS_RAG": 4,
    "WEB_ONLY": 3,
    "RAG_ONLY": 2,
    "WEB_DIFFERS_FROM_RAG": 1,
    "NEITHER": 0,
}

# Task 8d (2026-05-28) — Technical verbs for definitional-phrase function extraction.
# When a function source starts with "Le/La X est ..." (definitional pattern), the actual
# technical verb may appear later in the sentence ("...pour ralentir le véhicule..."). This
# regex helps find it anywhere in the source before deciding the 140-char truncation.
DECISION_BRIEF_VERB_RE = re.compile(
    r'(?i)\b(filtre|filtrer|r[eé]gule|r[eé]guler|entra[iî]ne|entra[iî]ner|recycle|recycler|'
    r'transmet|transmettre|refroidit|refroidir|freine|freiner|ralentit|ralentir|'
    r'maintient|maintenir|alimente|alimenter|charge|charger|prot[eè]ge|prot[eé]ger|'
    r'assure|assurer|r[eé]duit|r[eé]duire|am[eé]liore|am[eé]liorer|stocke|stocker|'
    r'capte|capter|d[eé]tecte|d[eé]tecter|amortit|amortir|guide|guider|relie|relier|'
    r'isole|isoler|presse|presser|permet|sert)\b'
)


def _ascii_fold(s):
    """Normalize string for near-duplicate detection.

    Pipeline :
      1. NFKD decomposition + drop combining diacritics (é → e)
      2. Drop French elision apostrophes (l', d', s', n', c', j', m', t', qu')
         that artificially differentiate "l'équivalence" from "equivalence".
      3. Collapse internal whitespace + trim + lowercase.

    This is purposefully NOT a fuzzy matcher (no Levenshtein, no Jaccard) — just
    a stronger normalizer so substring-containment dedup catches RAW-doubled entries.
    """
    if not isinstance(s, str):
        return ""
    normalized = unicodedata.normalize('NFKD', s)
    no_diacritics = ''.join(c for c in normalized if not unicodedata.combining(c))
    # Drop French elision apostrophes: l'/d'/s'/n'/c'/j'/m'/t'/qu' before a vowel/h.
    no_elision = re.sub(r"(?i)\b(l|d|s|n|c|j|m|t|qu)['’]", "", no_diacritics)
    return re.sub(r'\s+', ' ', no_elision).strip().lower()


def _dedup_selection_criteria(items):
    """Dedup ASCII-fold-similar selection_criteria entries, keeping the longest version.

    Two items are considered duplicates if one's ASCII-fold form is contained in the
    other's. The longer (more informative) entry is kept. Conservative algorithm :
    preserves order of first occurrence, only removes strictly-redundant repetitions.

    Catches both :
    - exact ASCII-fold equality ("référence OE" vs "reference OE")
    - substring containment ("référence OE" vs "reference OE pour le vehicule")

    Limitation : does NOT do fuzzy matching (Levenshtein, Jaccard) — out of scope.
    """
    if not items:
        return items
    keep = []
    for new_item in items:
        if not isinstance(new_item, str):
            continue
        new_norm = _ascii_fold(new_item)
        if not new_norm:
            continue
        replaced = False
        for i, existing in enumerate(keep):
            ex_norm = _ascii_fold(existing)
            if new_norm == ex_norm or new_norm in ex_norm or ex_norm in new_norm:
                if len(new_item) > len(existing):
                    keep[i] = new_item
                replaced = True
                break
        if not replaced:
            keep.append(new_item)
    return keep


def _extract_function_oneliner(text, max_chars=140):
    """Extract a function_oneliner with a technical verb when possible.

    Strategy :
    1. Normalize whitespace.
    2. If first max_chars window already contains a technical verb → use it.
    3. Else search the FULL text for a verb. If found, extract a sentence-bounded
       clause (~max_chars) around the verb.
    4. Else fallback to the first max_chars window (current behaviour).

    This handles definitional phrases like
    "La plaquette de frein est la garniture ... pour ralentir le véhicule..."
    where the verb appears past the 140-char cutoff. The current text remains
    deterministically derived — no LLM, no rewriting, just selecting a different
    window of the existing source.
    """
    if not text:
        return ""
    text = " ".join(text.split())

    # Strategy 1 : first window already contains a verb → keep it.
    first_window = _shorten_at_word(text, max_chars)
    if DECISION_BRIEF_VERB_RE.search(first_window):
        return first_window

    # Strategy 2 : search full text for a verb, extract sentence-bounded clause.
    m = DECISION_BRIEF_VERB_RE.search(text)
    if m:
        verb_pos = m.start()
        # Anchor at the start of the sentence containing the verb (after last '. ').
        prev_sentence_end = text.rfind(". ", 0, verb_pos)
        start = prev_sentence_end + 2 if prev_sentence_end >= 0 else 0
        # Take a slightly larger raw window then word-truncate to max_chars.
        clause_raw = text[start:start + max_chars + 60]
        clause = _shorten_at_word(clause_raw, max_chars)
        if DECISION_BRIEF_VERB_RE.search(clause):
            return clause

    # Strategy 3 : no verb anywhere — fallback to first window (current behaviour).
    return first_window


def _min_cross_check_status(statuses):
    """Return the cross_check_status with lowest confidence (worst case) among inputs."""
    valid = [s for s in statuses if s in _CROSS_CHECK_PRIORITY]
    if not valid:
        return "NEITHER"
    return min(valid, key=lambda s: _CROSS_CHECK_PRIORITY[s])


def _shorten_at_word(text, max_chars):
    """Truncate text at max_chars, respecting word boundary, with ellipsis if truncated."""
    if not text:
        return text
    text = " ".join(text.split())  # normalize whitespace
    if len(text) <= max_chars:
        return text
    cut = text[: max_chars - 1].rsplit(" ", 1)[0]
    return cut + "…"


def _compose_compatibility_summary(compat):
    """Compose a deterministic FR phrase from compatibility_factors structured fields.

    No technical separators (no pipe, no slash). Future-renderable côté R2/R8 telle quelle.
    Fallback générique si données structurées absentes.
    """
    base = "Vérifier la compatibilité"
    fragments = []

    fuels = compat.get("fuels") or []
    if fuels:
        fuels_phrase = " et ".join(f.lower() for f in fuels[:4])
        fragments.append(f" selon le carburant ({fuels_phrase})")

    motos_count = compat.get("model_count_distinct")
    if isinstance(motos_count, int) and motos_count > 0:
        plural = "s" if motos_count > 1 else ""
        unit = "motorisation" + plural
        fragments.append(f", {motos_count} {unit} référencée{plural}")

    marques = compat.get("marques") or []
    if marques:
        top = marques[:3]
        if len(top) == 1:
            mq_phrase = top[0]
        elif len(top) == 2:
            mq_phrase = f"{top[0]} et {top[1]}"
        else:
            mq_phrase = f"{', '.join(top[:-1])} et {top[-1]}"
        fragments.append(f", marques principales {mq_phrase}")

    if not fragments:
        return "Vérifier la compatibilité véhicule, motorisation et référence OEM."

    summary = base + "".join(fragments) + "."
    return _shorten_at_word(summary, max_chars=160)


def derive_decision_brief(dimensions):
    """Project structured decision facets from already-extracted dimensions (post-processor).

    Aucun texte généré stocké : juste des projections déterministes des champs déjà
    sourcés (function, selection_criteria, compatibility_factors). Anti-templated par
    construction. Capte les signaux Google AI Mode Decide/Summarize sans toucher
    R2/R8 runtime pendant la fenêtre OBSERVE.

    Returns dict matching gamme.schema.json v2.2.0 entity_data.decision_brief, or
    None si minimal inputs (function + selection_criteria) absents → no-op silencieux.
    """
    func_dim = dimensions.get("function") or {}
    sel_dim = dimensions.get("selection_criteria") or {}
    compat = dimensions.get("compatibility_factors") or {}

    # function_oneliner : confirmed preferred, candidate fallback ; min 20 / max 140.
    # Task 8d (2026-05-28) : use _extract_function_oneliner so definitional phrases
    # like "La plaquette de frein est la garniture ... pour ralentir le véhicule"
    # find the verb past the first 140-char window.
    func_value = (func_dim.get("confirmed_value") or func_dim.get("candidate_value") or "").strip()
    function_oneliner = _extract_function_oneliner(func_value, max_chars=140)
    if len(function_oneliner) < 20:
        return None  # too short to be meaningful → no decision_brief emitted

    # selection_criteria_top : confirmed preferred, candidate fallback ; 1..3 items, 5..80 chars each.
    # Task 8d (2026-05-28) : dedup ASCII-fold-similar entries upstream (e.g.
    # "Utiliser la référence OE" vs "Utiliser la reference OE pour le vehicule").
    sel_raw = sel_dim.get("confirmed_value") or sel_dim.get("candidate_value") or []
    if not isinstance(sel_raw, list):
        sel_raw = []
    deduped_raw = _dedup_selection_criteria(sel_raw)
    selection_criteria_top = []
    for s in deduped_raw:
        if not isinstance(s, str):
            continue
        item = _shorten_at_word(s.strip(), max_chars=80)
        if len(item) >= 5:
            selection_criteria_top.append(item)
        if len(selection_criteria_top) >= 3:
            break
    if not selection_criteria_top:
        return None  # no usable selection criteria → no decision_brief emitted

    # compatibility_summary : deterministic FR phrase from structured fields ; max 160
    compatibility_summary = _compose_compatibility_summary(compat)

    # cross_check_status : min priority of input dimension statuses
    func_status = func_dim.get("cross_check_status")
    sel_status = sel_dim.get("cross_check_status")
    # compatibility_factors doesn't expose cross_check_status directly ; infer from presence/source_kind
    compat_kind = compat.get("source_kind") or ""
    if compat_kind:  # URL-proven (with or without DB) → OEM web confirmed
        compat_status = "WEB_ONLY"
    elif compat:  # has structured data without explicit source_kind → at least body-confirmed
        compat_status = "WEB_ONLY"
    else:
        compat_status = "NEITHER"

    cross_check_status = _min_cross_check_status([func_status, sel_status, compat_status])

    # source_kind : deterministic_transform iff all non-None input statuses ∈ {WEB_CONFIRMS_RAG, WEB_ONLY}
    GOOD = {"WEB_CONFIRMS_RAG", "WEB_ONLY"}
    input_statuses = [s for s in (func_status, sel_status, compat_status) if s]
    if input_statuses and all(s in GOOD for s in input_statuses):
        source_kind = "deterministic_transform"
    else:
        source_kind = "rag_candidate"

    return {
        "function_oneliner": function_oneliner,
        "selection_criteria_top": selection_criteria_top,
        "compatibility_summary": compatibility_summary,
        "source_kind": source_kind,
        "cross_check_status": cross_check_status,
    }


# === Task 5 : variant-readiness gate + anti-filler + content_hash ===

# DIMENSION_KEYS exclut source_refs (metadata provenance, pas dimension de contenu)
DIMENSION_KEYS = [
    "function", "symptoms", "selection_criteria",
    "compatibility_factors", "related_parts", "maintenance_context",
    "oem_references", "fuel_engine_differences",
]


def _dim_is_populated(v):
    """True if dimension has value (handles candidate/confirmed dict and raw types)."""
    if v in (None, [], {}, ""):
        return False
    if isinstance(v, dict):
        if "candidate_value" in v or "confirmed_value" in v:
            return bool(v.get("candidate_value") or v.get("confirmed_value"))
        return bool(v)
    return True


def _dim_has_confirmed(v):
    """True if dimension has OEM-confirmed value (not just candidate)."""
    if not isinstance(v, dict):
        return bool(v)
    if "confirmed_value" in v:
        return bool(v.get("confirmed_value"))
    return bool(v)


def evaluate_variant_readiness(dimensions, is_r2_sensitive):
    """Evaluate variant-readiness per canon doctrine 2026-05-27 (candidate/confirmed pattern)."""
    present = [k for k in DIMENSION_KEYS if _dim_is_populated(dimensions.get(k))]
    confirmed = [k for k in DIMENSION_KEYS if _dim_has_confirmed(dimensions.get(k))]
    missing = [k for k in DIMENSION_KEYS if k not in present]
    count = len(present)
    count_confirmed = len(confirmed)
    compat_present = "compatibility_factors" in present
    refs = dimensions.get("source_refs", [])
    has_src = bool(refs)
    has_fn = _dim_is_populated(dimensions.get("function"))

    has_rag_candidate = any(r.get("tier") == "rag_recycled_candidate" for r in refs)
    has_oem_web = any(r.get("tier") in ("tier1", "tier2") for r in refs)

    rag_only_majority = has_rag_candidate and count > 0 and (count_confirmed < count / 2)

    if not has_src or not has_fn:
        status = "FAIL_NOT_VARIANT_READY"
    elif count < 3:
        status = "FAIL_NOT_VARIANT_READY"
    elif rag_only_majority and not has_oem_web:
        status = "RAG_CANDIDATE_REQUIRES_REVIEW"
    elif count >= 5 and is_r2_sensitive and not compat_present:
        status = "PASS_PARTIAL_R2_BLOCKED"
    elif count >= 5:
        status = "PASS_VARIANT_READY"
    else:
        status = "PASS_PARTIAL"

    return {
        "status": status,
        "dimensions_present": present,
        "dimensions_missing": missing,
        "dimensions_count": count,
        "dimensions_confirmed_count": count_confirmed,
        "is_r2_sensitive": is_r2_sensitive,
        "compatibility_factors_present": compat_present,
        "has_rag_candidate_source": has_rag_candidate,
        "has_oem_web_source": has_oem_web,
        "requires_human_review": status == "RAG_CANDIDATE_REQUIRES_REVIEW" or has_rag_candidate,
    }


PLACEHOLDER_RE = re.compile(r'\b(TODO|TBD|FIXME)\b|<%|\{\{')


def validate_anti_filler(body):
    """Anti-filler gate : detect placeholders + stamp generation_mode metadata."""
    m = PLACEHOLDER_RE.search(body)
    if m:
        return {
            "pass": False,
            "reason": f"placeholder found: {m.group()}",
            "generation_mode": "deterministic_transform_only",
            "llm_used": False,
            "paraphrase_used": False,
        }
    return {
        "pass": True,
        "reason": "deterministic_transform_only",
        "generation_mode": "deterministic_transform_only",
        "llm_used": False,
        "paraphrase_used": False,
        "sources_only": True,
    }


def compute_content_hash(body):
    """SHA256 hex of body for idempotence content_hash check."""
    return hashlib.sha256(body.encode("utf-8")).hexdigest()
# === Task 6 : proposal builder v2.0.0 + schema validator ===

VALID_INTENTS = {"diagnostic", "achat", "comparatif", "compatibilite", "remplacement", "entretien", "guide"}


def _build_review_notes(raw, dimensions, vr_result, schema_option):
    """Build review_notes YAML block flagging rag_recycled_candidate items requires_review."""
    parts = []
    parts.append(f"Generated by script:promote-raw-gammes-to-wiki@v0.1 ({datetime.now(timezone.utc).isoformat()}).")
    parts.append(f"Schema option: {schema_option}. Mode: deterministic_transform_only, llm_used: false, paraphrase_used: false.")
    parts.append(f"Dimensions count: {vr_result['dimensions_count']} populated, "
                 f"{vr_result['dimensions_confirmed_count']} confirmed via OEM web.")
    parts.append(f"Variant-readiness status: {vr_result['status']}.")

    if raw["is_rag_candidate"]:
        parts.append("")
        parts.append("⚠️ RAG-RECYCLED-CANDIDATE SOURCE — requires_review:")
        parts.append(f"  Origin: {raw['source_path']}")
        parts.append(f"  Per canon doctrine 2026-05-27 (feedback_rag_to_raw_candidate_requalification):")
        parts.append("  RAG data is allowed as RAW candidate, forbidden only when silently promoted as confirmed WIKI/runtime.")
        parts.append("  Each candidate_value below MUST be reviewed by human before WIKI accepted promotion.")

    # Per-dimension cross_check_status report
    parts.append("")
    parts.append("Cross-check status per dimension:")
    for dim_key in ("function", "selection_criteria", "symptoms"):
        dim = dimensions.get(dim_key)
        if isinstance(dim, dict) and "cross_check_status" in dim:
            parts.append(f"  - {dim_key}: {dim['cross_check_status']}")
    # Task 8c — decision_brief projection trace
    db_block = dimensions.get("decision_brief")
    if db_block:
        parts.append(f"  - decision_brief (projected): {db_block['cross_check_status']} "
                     f"({db_block['source_kind']})")
    else:
        parts.append("  - decision_brief: NOT_PROJECTED (insufficient function or selection_criteria inputs)")

    # Symptoms guard rails (canon repo)
    parts.append("")
    parts.append("⚠️ Symptoms guard rails per role (canon repo):")
    parts.append("  R1: short FAQ-routage only (no diagnostic)")
    parts.append("  R8: known_issues only if vehicle-specific (no generic)")
    parts.append("  R2: anti_mistakes + faq_product only (R2 never diagnostic)")
    parts.append("  R3: full pedagogical usage (canonical owner)")

    return "\n".join(parts)


def _build_body_markdown(raw, dimensions):
    """Build body markdown with H2 sections, marked [CANDIDATE] if RAG_ONLY."""
    parts = []
    is_cand = raw["is_rag_candidate"]

    func = dimensions.get("function") or {}
    if func.get("confirmed_value"):
        parts.append(f"## Rôle technique\n\n{func['confirmed_value']}")
    elif func.get("candidate_value"):
        prefix = "[CANDIDATE — requires_review] " if is_cand else ""
        parts.append(f"## Rôle technique\n\n{prefix}{func['candidate_value']}")

    # Task 8c (2026-05-28) — En bref (facettes décisionnelles) : présent si derive_decision_brief()
    # a renvoyé un dict. Aucun texte généré stocké : juste les facettes structurées rendues en
    # markdown lisible pour review humain. Capte les signaux Google AI Mode Decide/Summarize.
    db_block = dimensions.get("decision_brief")
    if db_block:
        db_lines = ["## En bref (facettes décisionnelles)", ""]
        db_lines.append(f"- **Fonction** : {db_block['function_oneliner']}")
        db_lines.append("- **Critères de choix prioritaires** :")
        for c in db_block["selection_criteria_top"]:
            db_lines.append(f"  - {c}")
        db_lines.append(f"- **Compatibilité** : {db_block['compatibility_summary']}")
        db_lines.append(
            f"- _Status : `{db_block['cross_check_status']}` ; "
            f"source : `{db_block['source_kind']}` "
            f"(anti-templated, aucun texte généré stocké, projection déterministe depuis dimensions)_"
        )
        parts.append("\n".join(db_lines))

    sel = dimensions.get("selection_criteria") or {}
    sel_items = sel.get("confirmed_value") or sel.get("candidate_value") or []
    if sel_items:
        status = sel.get("cross_check_status", "")
        prefix = "[CANDIDATE — requires_review] " if (status == "RAG_ONLY" and is_cand) else ""
        parts.append("## Critères de sélection véhicule\n\n" + prefix + "\n".join(f"- {s}" for s in sel_items))

    sym = dimensions.get("symptoms") or {}
    sym_items = sym.get("confirmed_value") or sym.get("candidate_value") or []
    if sym_items:
        status = sym.get("cross_check_status", "")
        prefix = "[CANDIDATE — requires_review] " if (status == "RAG_ONLY" and is_cand) else ""
        parts.append("## Symptômes (source brute — usage filtré par rôle, voir review_notes)\n\n"
                     + prefix + "\n".join(f"- {s}" for s in sym_items))

    compat = dimensions.get("compatibility_factors") or {}
    if compat:
        parts.append("## Compatibilité véhicule × motorisation\n\n```yaml\n"
                     + yaml.dump(compat, allow_unicode=True).strip() + "\n```")

    maint = dimensions.get("maintenance_context") or {}
    if maint:
        parts.append("## Entretien associé\n\n```yaml\n"
                     + yaml.dump(maint, allow_unicode=True).strip() + "\n```")

    oem_refs = dimensions.get("oem_references") or []
    if oem_refs:
        parts.append("## Références OEM / équipementiers (candidates, à valider humainement)\n\n"
                     + "\n".join(f"- {r['ref']}" for r in oem_refs[:10]))

    # Task 8e (2026-05-29) — equipementier_brands section (premium / standard / budget)
    brands = dimensions.get("equipementier_brands") or {}
    if brands:
        lines = ["## Marques équipementiers attestées (YAML frontmatter)"]
        for tier_label, key in (("Premium / OEM", "premium"),
                                 ("Standard", "standard"),
                                 ("Budget / aftermarket", "budget")):
            tier_items = brands.get(key) or []
            if tier_items:
                lines.append(f"- **{tier_label}** : {', '.join(tier_items)}")
        if len(lines) > 1:
            parts.append("\n".join(lines))

    # Task 8e (2026-05-29) — variants_summary section (papier / mousse / sport, etc.)
    variants = dimensions.get("variants_summary") or []
    if variants:
        lines = ["## Variantes produit (média filtrant / forme / etc.)"]
        for v in variants:
            lines.append(f"- **{v['name']}**")
            for fd in v.get("functional_differences") or []:
                lines.append(f"  - {fd}")
        parts.append("\n".join(lines))

    fuel = dimensions.get("fuel_engine_differences") or {}
    if fuel:
        parts.append("## Différences carburant / motorisation\n\n```yaml\n"
                     + yaml.dump(fuel, allow_unicode=True).strip() + "\n```")

    # Sources OEM trace section
    oem_web_refs = [r for r in dimensions.get("source_refs", []) if r.get("kind") == "oem_web"]
    if oem_web_refs:
        parts.append("## Sources OEM / Tier classification\n\n"
                     + "\n".join(f"- [{r.get('tier', 'unknown')}] {r.get('source_domain', '')} — {r.get('source_uri', '')}"
                                 for r in oem_web_refs[:10]))

    # B1.2 : Web relations section (gammes + vehicles + NO_VEHICLE_EVIDENCE explicit)
    web_relations = dimensions.get("web_relations") or []
    if web_relations:
        rel_lines = ["## Relations web (B1.2 — gammes + véhicules)\n"]
        for rel in web_relations:
            rel_lines.append(f"### Source : {rel['source_domain']}")
            rel_lines.append(f"- gammes liées : {', '.join(rel['gammes']) if rel['gammes'] else '(none)'}")
            rel_lines.append(f"- relation_status : `{rel['relation_status']}`")
            if rel["vehicles"]:
                rel_lines.append("- véhicules prouvés :")
                for v in rel["vehicles"]:
                    rel_lines.append(f"  - {v['marque']} {v['modele']} {v['motorisation']}".rstrip())
            else:
                rel_lines.append("- véhicules : **(NO_VEHICLE_EVIDENCE)** — aucune relation véhicule explicite dans frontmatter source. **Jamais inventée** (canon doctrine 2026-05-27).")
            rel_lines.append(f"- source_uri : {rel['source_uri']}")
            rel_lines.append("")
        parts.append("\n".join(rel_lines))

    # Provenance & cross-check summary
    rag_refs = [r for r in dimensions.get("source_refs", []) if r.get("tier") == "rag_recycled_candidate"]
    if rag_refs:
        parts.append("## Provenance & cross-check (RAG candidate)\n\n"
                     "⚠️ Cette proposal contient des données dérivées d'un fichier RAG-recycled-legacy "
                     "(`automecanik-raw/recycled/rag-knowledge/gammes/<slug>.md`).\n\n"
                     "Per canon doctrine 2026-05-27 : ces données sont **acceptables comme candidate** "
                     "mais **requires_review** humaine avant promotion WIKI accepted. "
                     "Voir `review_notes` pour le détail cross_check_status par dimension.")

    return "\n\n".join(parts) + "\n"


def build_proposal_v2(raw, web_corpus, dimensions, schema_option):
    """Build WIKI v2.0.0 proposal text (frontmatter YAML + body markdown).

    Phase A Option C (default) : dimensions dans body + review_notes, pas entity_data.dimensions.
    """
    fm_full = raw["frontmatter_full"]
    safe_tax = raw["safe_taxonomic_fields"]
    today = datetime.now().date().isoformat()

    # Compute variant-readiness for review_notes
    vr = evaluate_variant_readiness(dimensions, is_r2_sensitive=True)  # vanne-egr is R2-sensitive

    # source_refs : canonical wiki schema kinds only (raw/external_url/manual/recycled)
    # with unevaluatedProperties: false. Custom kind=rag_recycled_candidate mapped to
    # canon kind=recycled. Candidate metadata (trust, requires_review) lives in review_notes
    # per canon doctrine (feedback_rag_to_raw_candidate_requalification).
    src_refs = []
    for r in dimensions.get("source_refs", []):
        if r.get("kind") in ("recycled", "rag_recycled_candidate"):
            ref = {
                "kind": "recycled",
                "origin_repo": r.get("origin_repo"),
                "origin_path": r.get("origin_path"),
            }
            captured = r.get("captured_at") or today
            if captured:
                ref["captured_at"] = captured
            src_refs.append(ref)

    intents_raw = fm_full.get("intent_targets", []) or []
    intents = [i for i in intents_raw if i in VALID_INTENTS]

    entity_data = {
        "pg_id": safe_tax.get("pg_id"),
        "family": safe_tax.get("category"),
        "related_parts": dimensions.get("related_parts", []),
        "intents": intents,
        "vlevel": "V4",
        "kw_top": [],
        "references": [],
    }

    # Task 8a/8b — Option A : inject entity_data.dimensions when schema v2.1.0 accepts it
    if schema_option in ("A", "B"):
        ed_dimensions = {}
        cf = dimensions.get("compatibility_factors") or {}
        if cf:
            # Filter only schema-allowed keys (v2.1.0 additive set)
            allowed_cf_keys = {"source_kind", "marques", "motorisations", "fuels",
                               "norme_euro", "motorisation", "brand_motorisation_pairs",
                               "model_count_distinct", "type_ids", "power_ps_range",
                               "year_range", "proven_url_count", "db_aligned_count", "stale_count"}
            ed_dimensions["compatibility_factors"] = {k: v for k, v in cf.items() if k in allowed_cf_keys}
        mp = dimensions.get("motorisation_profiles") or []
        if mp:
            # Schema requires brand, model, type_id, source_url, db_status (all per-entry)
            ed_dimensions["motorisation_profiles"] = mp
        if ed_dimensions:
            entity_data["dimensions"] = ed_dimensions

    # Task 8c (2026-05-28, additive) — Option A/B : inject entity_data.decision_brief when schema v2.2.0 accepts it
    if schema_option in ("A", "B"):
        db_block = dimensions.get("decision_brief")
        if db_block:
            entity_data["decision_brief"] = db_block

    proposal_fm = {
        "schema_version": "2.0.0",
        "id": f"gamme:{safe_tax['slug']}",
        "entity_type": "gamme",
        "slug": safe_tax["slug"],
        "title": safe_tax.get("title", safe_tax["slug"].replace("-", " ").title()),
        "aliases": [],
        "lang": "fr",
        "created_at": today,
        "updated_at": today,
        "truth_level": "L2",
        "source_refs": src_refs,
        "provenance": {
            "ingested_by": "script:promote-raw-gammes-to-wiki@v0.1",
            "promoted_from": None,
        },
        "review_status": "proposed",
        "reviewed_by": None,
        "reviewed_at": None,
        "review_notes": _build_review_notes(raw, dimensions, vr, schema_option),
        "no_disputed_claims": True,
        "exportable": {"rag": False, "seo": False, "support": False},
        "target_classes": ["KB_Knowledge", "KB_Catalog"],
        "diagnostic_relations": [],
        "entity_data": entity_data,
    }

    body = _build_body_markdown(raw, dimensions)
    fm_yaml = yaml.dump(proposal_fm, sort_keys=False, allow_unicode=True, default_flow_style=False)
    return "---\n" + fm_yaml + "---\n\n" + body


def validate_schema(frontmatter, schema_option):
    """Validate entity_data subtree vs gamme.schema.json.

    Option C (legacy default) : strips `dimensions` key before validation (schema v2.0.0).
    Option A/B (Task 8a additive) : keeps `dimensions` key, validates against schema v2.1.0.
    """
    try:
        with open(SCHEMA_PATH) as f:
            schema = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        return {"valid": False, "errors": [f"schema_load_failed: {e}"]}
    ed = frontmatter.get("entity_data", {}) or {}
    if schema_option == "C":
        # Strip dimensions + decision_brief from entity_data before validation (v2.0.0 baseline path)
        ed_to_validate = {k: v for k, v in ed.items() if k not in ("dimensions", "decision_brief")}
    else:
        # Option A/B : v2.2.0 schema accepts both dimensions (v2.1.0) and decision_brief (v2.2.0) natively
        ed_to_validate = ed
    try:
        jsonschema.validate(ed_to_validate, schema)
        return {"valid": True, "errors": []}
    except jsonschema.ValidationError as e:
        return {"valid": False, "errors": [str(e.message)]}
# === Task 7 : structured run log writer ===

def write_run_log(run_data):
    """Write structured JSON run log to audit/wiki-bootstrap-runs/<run_id>.json."""
    RUN_LOG_DIR.mkdir(parents=True, exist_ok=True)
    run_id = run_data.get("run_id") or str(uuid.uuid4())
    path = RUN_LOG_DIR / f"{run_id}.json"
    path.write_text(json.dumps(run_data, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def main():
    """Phase A CLI : --gamme <slug> --dry-run --verbose only (refuse autres flags)."""
    parser = argparse.ArgumentParser(
        description="Promote RAW v5 SSOT gamme to WIKI v2.0.0 proposal (Phase A single-gamme).",
    )
    parser.add_argument("--gamme", required=True, help="Single gamme slug (Phase A LOCKED)")
    parser.add_argument("--dry-run", action="store_true", help="No writes, stdout report only")
    parser.add_argument("--verbose", action="store_true", help="Per-step trace")
    parser.add_argument("--owner-go", action="store_true",
                        help="Explicit owner unlock for non-dry-run write (Task 8 only)")
    parser.add_argument("--compatibility-url-json", type=str, default=None,
                        help="B3 — Path to B2 audit JSON with compatibility_proven_by_url entries")
    args = parser.parse_args()

    schema_option = os.getenv("SCHEMA_OPTION", SCHEMA_OPTION_DEFAULT)
    raw_path = GAMMES_DIR / f"{args.gamme}.md"

    if args.verbose:
        sys.stderr.write(f"[promote] gamme={args.gamme} dry_run={args.dry_run} "
                         f"schema_option={schema_option}\n")
        sys.stderr.write(f"[promote] RAW={raw_path}\n")

    # Read RAW + aggregate web corpus
    raw = read_raw_gamme(raw_path)
    web = aggregate_web_corpus_by_slug(WEB_DIR, args.gamme)

    # B3 : optional compatibility-url-json ingest (PROD runtime proof)
    compat_data = None
    if args.compatibility_url_json:
        compat_path = Path(args.compatibility_url_json)
        compat_data = read_compatibility_url_json(compat_path)
        if args.verbose:
            sys.stderr.write(f"[promote] compatibility_url_json loaded: "
                             f"{compat_data['url_count']} proven URLs "
                             f"(filtered status 200 from {compat_data['url_count_total_input']})\n")

    if args.verbose:
        sys.stderr.write(f"[promote] is_rag_candidate={raw['is_rag_candidate']} "
                         f"web_corpus_files={len(web)}\n")

    # Extract dimensions + post-extraction projection (decision_brief facets) + evaluate gates
    dims = extract_dimensions(raw, web, compatibility_url_data=compat_data)
    # Task 8c (2026-05-28, additive) — project decision_brief from extracted dimensions.
    # Post-processor : reads from already-extracted dimensions, does NOT touch RAW. None-safe.
    dims["decision_brief"] = derive_decision_brief(dims)
    vr = evaluate_variant_readiness(dims, is_r2_sensitive=True)
    if args.verbose:
        sys.stderr.write(f"[promote] variant_readiness={vr['status']} "
                         f"({vr['dimensions_count']} dim, {vr['dimensions_confirmed_count']} confirmed)\n")

    # Build proposal + anti-filler + schema validation
    proposal = build_proposal_v2(raw, web, dims, schema_option=schema_option)
    body_only = proposal.split("---\n", 2)[2] if proposal.count("---\n") >= 2 else proposal
    af = validate_anti_filler(body_only)
    fm = yaml.safe_load(proposal.split("---\n")[1])
    sv = validate_schema(fm, schema_option=schema_option)
    chash = compute_content_hash(body_only)
    run_id = str(uuid.uuid4())

    if args.verbose:
        sys.stderr.write(f"[promote] anti_filler={af['pass']} schema_valid={sv['valid']} "
                         f"content_hash={chash[:16]}...\n")

    # Print proposal to stdout (always — for verbose review)
    print("=" * 70)
    print(proposal)
    print("=" * 70)

    # Print run log JSON (always — for traceability)
    run_data = {
        "run_id": run_id,
        "script_version": "v0.1",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "scope": "gamme",
        "scope_input": args.gamme,
        "dry_run": args.dry_run,
        "schema_option": schema_option,
        "generation_mode": "deterministic_transform_only",
        "llm_used": False,
        "paraphrase_used": False,
        "sources_only": True,
        "gammes_processed": [{
            "slug": args.gamme,
            "status": vr["status"],
            "raw_source": str(raw_path),
            "raw_is_rag_candidate": raw["is_rag_candidate"],
            "oem_sources_count": sum(1 for r in dims["source_refs"] if r.get("kind") == "oem_web"),
            "tier1_sources_count": sum(1 for r in dims["source_refs"] if r.get("tier") == "tier1"),
            "tier2_sources_count": sum(1 for r in dims["source_refs"] if r.get("tier") == "tier2"),
            "rag_candidate_sources_count": sum(1 for r in dims["source_refs"]
                                               if r.get("tier") == "rag_recycled_candidate"),
            "content_hash": chash,
            "schema_valid": sv["valid"],
            "schema_errors": sv.get("errors", []),
            "anti_filler": af,
            "variant_readiness": vr,
            "web_relations": dims.get("web_relations", []),
            "web_with_vehicle_evidence": sum(1 for rel in dims.get("web_relations", [])
                                             if rel.get("relation_status") == "VEHICLE_EVIDENCE_PRESENT"),
            "web_no_vehicle_evidence": sum(1 for rel in dims.get("web_relations", [])
                                           if rel.get("relation_status") == "NO_VEHICLE_EVIDENCE"),
            "compatibility_proven_by_url_count": len(dims.get("compatibility_proven_by_url", [])),
            "compatibility_factors_source_kind": dims.get("compatibility_factors", {}).get("source_kind"),
            "decision_brief_present": bool(dims.get("decision_brief")),
            "decision_brief_source_kind": (dims.get("decision_brief") or {}).get("source_kind"),
            "decision_brief_cross_check_status": (dims.get("decision_brief") or {}).get("cross_check_status"),
            # Issue 3 fix (2026-05-28) : explicit quality verdict for downstream consumers
            # (wiki sas reviewers + future batch aggregators). Maps source_kind 1:1 :
            #   deterministic_transform -> STRONG (all facets from CONFIRMED dimensions)
            #   rag_candidate           -> DATA_WEAK (requires_review humain, NOT a FAIL)
            #   no decision_brief       -> NOT_APPLICABLE (insufficient inputs)
            "decision_brief_quality_verdict": (
                "STRONG" if (dims.get("decision_brief") or {}).get("source_kind") == "deterministic_transform"
                else "DATA_WEAK" if (dims.get("decision_brief") or {}).get("source_kind") == "rag_candidate"
                else "NOT_APPLICABLE"
            ),
            "related_parts_filtered_count": dims.get("related_parts_filtered_count", 0),
        }],
    }
    print("\nRUN LOG:")
    print(json.dumps(run_data, indent=2, ensure_ascii=False))

    # Write run log (always — even dry-run, for traceability)
    if write_run_log is not None:
        try:
            log_path = write_run_log(run_data)
            if args.verbose:
                sys.stderr.write(f"[promote] run_log_written={log_path}\n")
        except NotImplementedError:
            sys.stderr.write("[promote] WARN: write_run_log not implemented (Task 7 pending)\n")

    # Non-dry-run write guard (Phase A : require --owner-go + Option A/B)
    if not args.dry_run:
        if not args.owner_go:
            sys.stderr.write("⚠️  Non-dry-run mode requires --owner-go flag (Task 8 owner gate). "
                             "Aborting safely.\n")
            return 2
        if schema_option == "C":
            sys.stderr.write("⚠️  SCHEMA_OPTION=C : Phase A stays dry-run only "
                             "(schema unchanged, dimensions in body only). Set SCHEMA_OPTION=A or B "
                             "to enable real write.\n")
            return 2
        if vr["status"] in ("FAIL_NOT_VARIANT_READY", "FAIL_UNTRACED_RAG_PROMOTION"):
            sys.stderr.write(f"⚠️  Variant-readiness {vr['status']} blocks write. Aborting.\n")
            return 3
        # Owner GO + Option A/B + readiness OK → write to wiki/proposals/<slug>.md
        PROPOSALS_DIR.mkdir(parents=True, exist_ok=True)
        proposal_path = PROPOSALS_DIR / f"{args.gamme}.md"
        # Idempotence check
        if proposal_path.exists():
            existing = proposal_path.read_text(encoding="utf-8")
            existing_body = existing.split("---\n", 2)[2] if existing.count("---\n") >= 2 else existing
            if compute_content_hash(existing_body) == chash:
                sys.stderr.write(f"[promote] SKIP_UNCHANGED (content_hash identical) {proposal_path}\n")
                return 0
        proposal_path.write_text(proposal, encoding="utf-8")
        sys.stderr.write(f"✅ Written {proposal_path}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
