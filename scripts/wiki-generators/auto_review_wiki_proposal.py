#!/usr/bin/env python3
"""auto_review_wiki_proposal.py — read-only quality reviewer for WIKI sas proposals.

Strict READ_ONLY by design :
  - Does NOT modify the proposal file.
  - Does NOT promote `exportable.seo: true`.
  - Does NOT move anything to `wiki/accepted/`.
  - Does NOT touch R2/R8 runtime.
  - Does NOT call any LLM.

Role : help the human wiki-sas reviewer prioritize their queue.
Output a verdict triaging proposals into 4 bands :

  REVIEWABLE             — humain can promote (eventually) ; minor or no fixes needed
  REVIEWABLE_WITH_FIXES  — humain needs to correct/clarify before considering promotion
  NOT_REVIEWABLE         — proposal is broken or filler-tainted, must be fixed upstream
                           (RAW/script) before re-emission
  NOT_APPLICABLE         — no decision_brief in proposal (e.g. low-coverage gamme)

The FINAL decision (acceptance, exportable.seo=true, promotion to wiki/accepted/)
stays HUMAN. This tool only reduces triage time.

CLI :
  python3 scripts/wiki-generators/auto_review_wiki_proposal.py \\
      --proposal /path/to/proposals/<slug>.md \\
      [--write-audit]   # writes audit/wiki-auto-review/<slug>.review.{json,md}

Refs :
  - Companion to scripts/wiki-generators/promote-raw-gammes-to-wiki.py
  - Plan : ~/.claude/plans/utiliser-superpower-ai-quiet-bear.md
  - Doctrine canon 2026-05-27 (rag_recycled_candidate guard + cross_check_status)
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("Manque : pip install pyyaml\n")
    sys.exit(1)


def _ascii_fold(s):
    """Normalize string for near-duplicate detection : NFKD + remove diacritics + lowercase + collapse whitespace.

    Used to detect cases where the same criterion appears twice with different
    diacritics (e.g. "Utiliser la référence OE" vs "Utiliser la reference OE")
    or whitespace.
    """
    if not isinstance(s, str):
        return ""
    normalized = unicodedata.normalize('NFKD', s)
    no_diacritics = ''.join(c for c in normalized if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', no_diacritics).strip().lower()


# === Verdict states (single source of truth) ===

VERDICT_REVIEWABLE = "REVIEWABLE"
VERDICT_REVIEWABLE_WITH_FIXES = "REVIEWABLE_WITH_FIXES"
VERDICT_NOT_REVIEWABLE = "NOT_REVIEWABLE"
VERDICT_NOT_APPLICABLE = "NOT_APPLICABLE"

ALL_VERDICTS = {
    VERDICT_REVIEWABLE,
    VERDICT_REVIEWABLE_WITH_FIXES,
    VERDICT_NOT_REVIEWABLE,
    VERDICT_NOT_APPLICABLE,
}


# === Task 8f (2026-05-29) : auto_promotion eligibility ===
# Doctrine evolution : replace "human review obligatoire" with
# "human review only on uncertainty, safety risk, or publication boundary".
#
# next_action enum — machine-actionable triage label :
NEXT_AUTO_ACCEPT_WIKI_ALLOWED = "AUTO_ACCEPT_WIKI_ALLOWED"   # STRONG + checks + not safety
NEXT_HUMAN_SPOT_CHECK = "HUMAN_SPOT_CHECK"                   # STRONG + safety (brakes/etc.)
NEXT_ENRICH_RAW_SOURCE = "ENRICH_RAW_SOURCE"                 # DATA_WEAK + clear
NEXT_FIX_PRODUCER = "FIX_PRODUCER"                           # STRONG but check failed
NEXT_REJECTED_UPSTREAM_FIX = "REJECTED_UPSTREAM_FIX"         # NOT_REVIEWABLE
NEXT_NOT_APPLICABLE = "NOT_APPLICABLE"                       # no decision_brief

# Safety-critical part categories — even STRONG briefs need human spot-check.
# Mapping from regex (slug or family) to category label. Conservative coverage :
# brake system, steering, airbag, suspension. Extend deliberately, not speculatively.
SAFETY_CATEGORIES = {
    "freinage": re.compile(
        r'(?i)(\bfrein|plaquette|disque-de-frein|etrier|ma[iî]tre-cylindre|'
        r'\babs\b|liquide-de-frein|flexible-de-frein|capteur-d-usure)'
    ),
    "direction": re.compile(
        r'(?i)(\bdirection|cremaillere|rotule|biellette|colonne-de-direction|'
        r'\btransmission\b)'
    ),
    "airbag": re.compile(r'(?i)\bairbag'),
    "suspension": re.compile(
        r'(?i)(amortisseur|ressort-de-suspension|\bressort\b|triangle-de-suspension|'
        r'\bbras-(?:oscillant|de-suspension)|silentbloc-de-triangle)'
    ),
}


def detect_safety_category(slug, family=""):
    """Return safety category label if slug or family matches a safety-critical pattern, else None.

    Order: slug match takes precedence over family match. Returns the first matching
    category name (deterministic iteration over SAFETY_CATEGORIES dict).
    """
    slug = (slug or "").lower()
    family = (family or "").lower()
    for category, pattern in SAFETY_CATEGORIES.items():
        if pattern.search(slug) or pattern.search(family):
            return category
    return None


# === Pattern constants ===

# Anti-filler markers (any presence → NOT_REVIEWABLE).
ANTI_FILLER_PLACEHOLDER_RE = re.compile(r'\b(TODO|TBD|FIXME|XXX|lorem|ipsum)\b', re.IGNORECASE)
ANTI_FILLER_TEMPLATE_RE = re.compile(r'\{\{|<%')

# Generic / non-actionable phrases that should not appear in decision_brief facets.
GENERIC_FILLER_PATTERNS = [
    re.compile(r'(?i)cette\s+pi[eè]ce\s+est\s+importante'),
    re.compile(r'(?i)choisissez\s+une\s+pi[eè]ce\s+de\s+qualit[eé]'),
    re.compile(r'(?i)compatible\s+avec\s+plusieurs\s+mod[eè]les'),
    re.compile(r'(?i)d[eé]couvrez\s+notre\s+catalogue'),
    re.compile(r'(?i)meilleur(s)?\s+choix\s+pour\s+votre\s+v[eé]hicule'),
]

# Marketing contamination patterns for function_oneliner (rejects catalog blurbs).
# Mirrors FUNCTION_MARKETING_BLOCKLIST_RE in promote-raw-gammes-to-wiki.py.
MARKETING_BLOCKLIST_RE = re.compile(
    r'(?i)(catalogue|d[eé]couvrez|promo|soldes|boutique|achat\s+en\s+ligne|'
    r'version\s+digitale|simplifier\s+la\s+vie|fonctionnalit[eé]s\s+con[cç]ues|'
    r'en\s+ligne\.|votre\s+s[eé]lection)'
)

# Technical verbs that signal a real function description (vs marketing).
# Both word boundaries (start AND end) required, otherwise "freinage" would match "freine".
# Must stay in sync with DECISION_BRIEF_VERB_RE in promote-raw-gammes-to-wiki.py.
TECHNICAL_VERB_RE = re.compile(
    r'(?i)\b(filtre|filtrer|r[eé]gule|r[eé]guler|entra[iî]ne|entra[iî]ner|recycle|recycler|'
    r'transmet|transmettre|refroidit|refroidir|freine|freiner|ralentit|ralentir|'
    r'maintient|maintenir|alimente|alimenter|charge|charger|prot[eè]ge|prot[eé]ger|'
    r'assure|assurer|r[eé]duit|r[eé]duire|am[eé]liore|am[eé]liorer|stocke|stocker|'
    r'capte|capter|d[eé]tecte|d[eé]tecter|amortit|amortir|guide|guider|relie|relier|'
    r'isole|isoler|presse|presser|permet|sert)\b'
)

# Non-actionable selection criteria words (warn but not block).
NON_ACTIONABLE_SELECTION_RE = re.compile(
    r'(?i)^(qualit[eé]|prix|performance|meilleur\s+choix|fiabilit[eé]|durabilit[eé]|excellence|robustesse)\.?$'
)

# Technical/actionable selection criteria signals (any of these → counts as actionable).
ACTIONABLE_SELECTION_HINT_RE = re.compile(
    r'(?i)\b(r[eé]f[eé]rence|oem|motorisation|dimension|montage|[eé]quipementier|marque|'
    r'ann[eé]e\s+v[eé]hicule|carburant|puissance|mod[eè]le|cylindr[eé]e|essieu|'
    r'mat[eé]riau|c[eé]ramique|m[eé]tallique|technologie|capteur|usure)'
)

# Technical-separator detection in compatibility_summary (rejects debug-style "a | b | c").
DEBUG_SEPARATOR_RE = re.compile(r'\s+\|\s+|\s+/\s+(?!ou\b)')

# FR contextual linking words that signal natural-language compatibility phrase.
COMPAT_CONTEXT_RE = re.compile(
    r'(?i)\b(selon|avec|et|pour|par|à\s+v[eé]rifier|d[eé]pend|li[eé]e?\s+aux?)\b'
)


# === Pure functions (testable) ===

def parse_proposal_file(path):
    """Parse a wiki proposal markdown file → (frontmatter_dict, body_str).

    Tolerant to Convention A (indented frontmatter) but proposals from
    promote-raw-gammes-to-wiki.py use Convention B (non-indented). No fallback.
    """
    text = Path(path).read_text(encoding="utf-8")
    return parse_proposal_text(text)


def parse_proposal_text(text):
    """Parse proposal markdown text → (frontmatter_dict, body_str)."""
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', text, re.DOTALL)
    if not m:
        raise ValueError("proposal markdown is missing --- frontmatter delimiters")
    fm = yaml.safe_load(m.group(1)) or {}
    body = m.group(2)
    return fm, body


def check_structural(fm, body):
    """Check 1 : structural validity. Hard blockers → NOT_REVIEWABLE/NOT_APPLICABLE."""
    ed = fm.get("entity_data") or {}
    db = ed.get("decision_brief")
    if db is None:
        return {"pass": False, "reason": "decision_brief_missing", "details": ""}
    if not isinstance(db, dict):
        return {"pass": False, "reason": "decision_brief_not_object", "details": str(type(db))}
    required = ["function_oneliner", "selection_criteria_top", "compatibility_summary",
                "source_kind", "cross_check_status"]
    missing = [k for k in required if not db.get(k)]
    if missing:
        return {"pass": False, "reason": "decision_brief_missing_fields", "details": missing}
    sct = db.get("selection_criteria_top") or []
    if not isinstance(sct, list) or len(sct) < 1:
        return {"pass": False, "reason": "selection_criteria_top_empty", "details": ""}
    return {"pass": True, "reason": "ok", "details": ""}


def check_anti_filler(fm, body):
    """Check 2 : anti-filler. Hard blocker if placeholder or generic-filler phrase detected."""
    ed = fm.get("entity_data") or {}
    db = ed.get("decision_brief") or {}
    facets_text = " ".join([
        str(db.get("function_oneliner") or ""),
        str(db.get("compatibility_summary") or ""),
        " ".join(db.get("selection_criteria_top") or []),
    ])
    if not facets_text.strip():
        # Already caught by structural check ; defer.
        return {"pass": True, "reason": "no_facets_text", "violations": []}
    violations = []
    if ANTI_FILLER_PLACEHOLDER_RE.search(facets_text):
        violations.append("placeholder_token")
    if ANTI_FILLER_TEMPLATE_RE.search(facets_text):
        violations.append("template_tag")
    for pat in GENERIC_FILLER_PATTERNS:
        if pat.search(facets_text):
            violations.append(f"generic_phrase:{pat.pattern[:40]}")
            break
    return {"pass": not violations, "reason": "ok" if not violations else "filler_detected",
            "violations": violations}


def check_function_clarity(fm, body):
    """Check 3 : function_oneliner clarity. Marketing contamination → hard block (caller decides)."""
    ed = fm.get("entity_data") or {}
    db = ed.get("decision_brief") or {}
    func = str(db.get("function_oneliner") or "")
    if not func:
        return {"pass": False, "marketing_detected": False, "has_technical_verb": False,
                "reason": "function_oneliner_empty"}
    marketing = bool(MARKETING_BLOCKLIST_RE.search(func))
    has_verb = bool(TECHNICAL_VERB_RE.search(func))
    ok = (not marketing) and has_verb
    return {"pass": ok, "marketing_detected": marketing, "has_technical_verb": has_verb,
            "reason": "ok" if ok else ("marketing_contamination" if marketing else "no_technical_verb")}


def check_selection_actionability(fm, body):
    """Check 4 : selection_criteria_top actionability + near-duplicate detection (warn but not block).

    Near-duplicate detection (ASCII-fold normalization) catches cases where the
    same criterion appears twice with different diacritics or whitespace
    (e.g. "Utiliser la référence OE" vs "Utiliser la reference OE"). These are
    upstream RAW frontmatter quality issues that the human reviewer should be
    alerted to.
    """
    ed = fm.get("entity_data") or {}
    db = ed.get("decision_brief") or {}
    items = db.get("selection_criteria_top") or []
    if not items:
        return {"pass": False, "actionable_count": 0, "total": 0,
                "non_actionable_items": [], "near_duplicates": []}
    non_actionable = []
    actionable_count = 0
    folded = [_ascii_fold(str(it)) for it in items]
    near_duplicates = []
    for i, f in enumerate(folded):
        if f and folded.count(f) > 1 and folded.index(f) < i:
            near_duplicates.append(str(items[i]))
    for it in items:
        s = str(it).strip()
        if NON_ACTIONABLE_SELECTION_RE.match(s):
            non_actionable.append(s)
        elif ACTIONABLE_SELECTION_HINT_RE.search(s):
            actionable_count += 1
        # else : neutral (neither flagged actionable nor non-actionable) — borderline
    return {
        "pass": actionable_count >= 1 and len(non_actionable) == 0 and len(near_duplicates) == 0,
        "actionable_count": actionable_count,
        "total": len(items),
        "non_actionable_items": non_actionable,
        "near_duplicates": near_duplicates,
    }


def check_compatibility_readability(fm, body):
    """Check 5 : compatibility_summary readability (FR natural language, no debug separators)."""
    ed = fm.get("entity_data") or {}
    db = ed.get("decision_brief") or {}
    cs = str(db.get("compatibility_summary") or "")
    if not cs:
        return {"pass": False, "reason": "compatibility_summary_empty",
                "has_debug_separator": False, "has_context": False}
    has_sep = bool(DEBUG_SEPARATOR_RE.search(cs))
    has_ctx = bool(COMPAT_CONTEXT_RE.search(cs))
    ok = (not has_sep) and has_ctx
    reason = "ok" if ok else ("debug_separator" if has_sep else "no_natural_context")
    return {"pass": ok, "reason": reason, "has_debug_separator": has_sep, "has_context": has_ctx}


def check_source_quality(fm, body):
    """Check 6 : source quality (STRONG / DATA_WEAK / NOT_APPLICABLE).

    Mirrors decision_brief_quality_verdict computed by promote-raw-gammes-to-wiki.py.
    """
    ed = fm.get("entity_data") or {}
    db = ed.get("decision_brief") or {}
    source_kind = db.get("source_kind")
    if source_kind == "deterministic_transform":
        return {"pass": True, "verdict": "STRONG"}
    if source_kind in ("rag_candidate", "web_research_oe"):
        # web_research_oe : fiches reconstruites depuis des sources OE/normatives web
        # (ex. disque-de-frein). Reconnu comme source VALIDE — sinon drop silencieux en
        # NOT_APPLICABLE -> NOT_REVIEWABLE pour les meilleures fiches OE. DATA_WEAK =
        # revue humaine, JAMAIS auto-promu (cf. compute_auto_promotion). Le tiering STRONG
        # de l'OE web relève d'ADR-091 (source_type -> confidence), pas de ce fix.
        return {"pass": True, "verdict": "DATA_WEAK"}
    return {"pass": False, "verdict": "NOT_APPLICABLE"}


# === Verdict aggregator ===

def compute_verdict(checks):
    """Aggregate the 6 checks into a final verdict per the canon matrix.

    Matrix (per user spec) :
      schema invalid / decision_brief missing  → NOT_REVIEWABLE or NOT_APPLICABLE
      filler detected                          → NOT_REVIEWABLE
      marketing contamination in function      → NOT_REVIEWABLE
      DATA_WEAK + clear                        → REVIEWABLE_WITH_FIXES
      STRONG + clear                           → REVIEWABLE
      Champs présents mais trop génériques     → REVIEWABLE_WITH_FIXES
    """
    structural = checks["structural"]
    if not structural["pass"]:
        if structural["reason"] == "decision_brief_missing":
            return VERDICT_NOT_APPLICABLE
        return VERDICT_NOT_REVIEWABLE

    if not checks["anti_filler"]["pass"]:
        return VERDICT_NOT_REVIEWABLE

    if checks["function_clarity"]["marketing_detected"]:
        return VERDICT_NOT_REVIEWABLE

    # At this point, structural OK, no filler, no marketing.
    has_fixes_needed = (
        not checks["function_clarity"]["pass"]
        or not checks["selection_actionability"]["pass"]
        or not checks["compatibility_readability"]["pass"]
    )

    source = checks["source_quality"]["verdict"]
    if source == "STRONG":
        return VERDICT_REVIEWABLE if not has_fixes_needed else VERDICT_REVIEWABLE_WITH_FIXES
    if source == "DATA_WEAK":
        return VERDICT_REVIEWABLE_WITH_FIXES
    # NOT_APPLICABLE source_quality (no decision_brief.source_kind) — already caught by structural
    return VERDICT_NOT_REVIEWABLE


def compute_scores(checks):
    """Compute 5 scores 1-5 for the reviewer dashboard.

    Derived deterministically from the 6 checks. Anti-bricolage : no LLM, no
    heuristic outside the checks already run.
    """
    def s(b):
        return 5 if b else 1

    function_ok = checks["function_clarity"]["pass"]
    selection_ok = checks["selection_actionability"]["pass"]
    compat_ok = checks["compatibility_readability"]["pass"]
    structural_ok = checks["structural"]["pass"]
    anti_filler_ok = checks["anti_filler"]["pass"]
    source_verdict = checks["source_quality"]["verdict"]

    clarity_signals = [function_ok, compat_ok, structural_ok]
    clarity = 1 + sum(2 if x else 0 for x in clarity_signals[:2]) + (1 if structural_ok else 0)
    clarity = min(5, max(1, clarity))

    source_traceability = 5 if source_verdict == "STRONG" else (3 if source_verdict == "DATA_WEAK" else 1)

    anti_filler_score = s(anti_filler_ok)

    technical_relevance = 5 if (function_ok and selection_ok) else (3 if function_ok or selection_ok else 1)

    reviewability_signals = [structural_ok, anti_filler_ok, not checks["function_clarity"]["marketing_detected"]]
    reviewability = 1 + 2 * sum(1 for x in reviewability_signals if x) // max(1, len(reviewability_signals))
    if all(reviewability_signals):
        reviewability = 4 + (1 if function_ok and selection_ok and compat_ok else 0)
    else:
        reviewability = 1

    return {
        "clarity": int(clarity),
        "source_traceability": int(source_traceability),
        "anti_filler": int(anti_filler_score),
        "technical_relevance": int(technical_relevance),
        "reviewability": int(reviewability),
    }


def derive_fix_suggestions(checks):
    """Produce structured fix_suggestions for the reviewer (minor/major severity).

    Only includes suggestions where the corresponding check failed.
    """
    suggestions = []
    fc = checks["function_clarity"]
    if not fc["pass"]:
        sev = "major" if fc["marketing_detected"] else "minor"
        msg = (
            "function_oneliner contient un préambule marketing/catalogue — corriger la source web ou tightener la regex"
            if fc["marketing_detected"]
            else "function_oneliner manque d'un verbe technique (filtre/régule/entraîne/etc.) — vérifier la source"
        )
        suggestions.append({
            "field": "decision_brief.function_oneliner",
            "severity": sev,
            "message": msg,
        })
    sa = checks["selection_actionability"]
    if not sa["pass"]:
        if sa["non_actionable_items"]:
            suggestions.append({
                "field": "decision_brief.selection_criteria_top",
                "severity": "minor",
                "message": f"Critères non-actionnables détectés ({sa['non_actionable_items']}). Préférer : référence OEM, motorisation, dimensions, marque équipementier, année véhicule.",
            })
        elif sa["actionable_count"] == 0:
            suggestions.append({
                "field": "decision_brief.selection_criteria_top",
                "severity": "minor",
                "message": "Aucun critère actionnable (OEM, motorisation, dimension, marque, etc.) détecté. À enrichir.",
            })
        if sa.get("near_duplicates"):
            suggestions.append({
                "field": "decision_brief.selection_criteria_top",
                "severity": "minor",
                "message": f"Doublons quasi-identiques détectés (ASCII-fold) : {sa['near_duplicates']}. Corriger la source RAW pour dédoublonner ; symptôme typique d'entrées doublées avec/sans accents.",
            })
    cr = checks["compatibility_readability"]
    if not cr["pass"]:
        if cr["has_debug_separator"]:
            suggestions.append({
                "field": "decision_brief.compatibility_summary",
                "severity": "minor",
                "message": "compatibility_summary utilise des séparateurs debug (pipe/slash). Reformuler en phrase naturelle (selon/avec/et).",
            })
        elif not cr["has_context"]:
            suggestions.append({
                "field": "decision_brief.compatibility_summary",
                "severity": "minor",
                "message": "compatibility_summary manque de mots de liaison FR (selon, avec, pour). Reformuler pour la lisibilité humaine.",
            })
    af = checks["anti_filler"]
    if not af["pass"]:
        suggestions.append({
            "field": "decision_brief",
            "severity": "blocking",
            "message": f"Filler détecté ({', '.join(af['violations'])}). Corriger upstream RAW ou script avant relecture.",
        })
    sq = checks["source_quality"]
    if sq["verdict"] == "DATA_WEAK":
        suggestions.append({
            "field": "decision_brief.source_kind",
            "severity": "info",
            "message": "source_kind=rag_candidate (DATA_WEAK). Review obligatoire avant exportable.seo=true.",
        })
    return suggestions


# === Public API ===

def compute_auto_promotion(verdict, checks, frontmatter):
    """Compute machine-actionable auto-promotion eligibility per the 2026-05-29 doctrine.

    Doctrine : "human review only on uncertainty, safety risk, or publication boundary".
    Pure verdict — does NOT actually promote anything (no file move, no schema flip).

    Returns dict :
      auto_promotion_eligible (bool)  — True only for STRONG + all checks + not safety
      auto_promotion_reason  (str)    — explains the verdict
      next_action            (str)    — machine-actionable triage label (see NEXT_* enum)
      safety_critical        (bool)
      safety_category        (str|None) — freinage / direction / airbag / suspension

    Invariant : NEVER returns auto_promotion_eligible=True if the part is safety-critical.
    """
    slug = (frontmatter.get("slug") or "").lower()
    ed = frontmatter.get("entity_data") or {}
    family = (ed.get("family") or "").lower()
    safety_category = detect_safety_category(slug, family)
    is_safety = safety_category is not None

    base = {
        "safety_critical": is_safety,
        "safety_category": safety_category,
    }

    # NOT_REVIEWABLE : blocked (filler / marketing / schema invalid)
    if verdict == VERDICT_NOT_REVIEWABLE:
        return {**base,
                "auto_promotion_eligible": False,
                "auto_promotion_reason": "BLOCKING_ISSUES",
                "next_action": NEXT_REJECTED_UPSTREAM_FIX}

    # NOT_APPLICABLE : no decision_brief
    if verdict == VERDICT_NOT_APPLICABLE:
        return {**base,
                "auto_promotion_eligible": False,
                "auto_promotion_reason": "NO_DECISION_BRIEF",
                "next_action": NEXT_NOT_APPLICABLE}

    source = checks["source_quality"]["verdict"]
    all_checks_pass = all(c.get("pass") for c in checks.values() if isinstance(c, dict))

    # DATA_WEAK path : never auto-promote, ENRICH_RAW is the next action
    if source == "DATA_WEAK":
        return {**base,
                "auto_promotion_eligible": False,
                "auto_promotion_reason": "DATA_WEAK_SOURCE",
                "next_action": NEXT_ENRICH_RAW_SOURCE}

    # STRONG path
    if source == "STRONG" and all_checks_pass:
        if is_safety:
            # STRONG + safety : keep human spot-check (per doctrine matrix)
            return {**base,
                    "auto_promotion_eligible": False,
                    "auto_promotion_reason": "STRONG_BUT_SAFETY_CRITICAL",
                    "next_action": NEXT_HUMAN_SPOT_CHECK}
        # STRONG + not safety + all checks → eligible for auto-accept
        return {**base,
                "auto_promotion_eligible": True,
                "auto_promotion_reason": "STRONG_SOURCE_AND_ALL_CHECKS_PASS",
                "next_action": NEXT_AUTO_ACCEPT_WIKI_ALLOWED}

    # STRONG but with check failures → producer fix needed
    return {**base,
            "auto_promotion_eligible": False,
            "auto_promotion_reason": "STRONG_BUT_NEEDS_FIXES",
            "next_action": NEXT_HUMAN_SPOT_CHECK if is_safety else NEXT_FIX_PRODUCER}


def review_proposal_data(frontmatter, body):
    """Run all 6 checks + compute verdict + scores + fix_suggestions for a parsed proposal."""
    checks = {
        "structural": check_structural(frontmatter, body),
        "anti_filler": check_anti_filler(frontmatter, body),
        "function_clarity": check_function_clarity(frontmatter, body),
        "selection_actionability": check_selection_actionability(frontmatter, body),
        "compatibility_readability": check_compatibility_readability(frontmatter, body),
        "source_quality": check_source_quality(frontmatter, body),
    }
    verdict = compute_verdict(checks)
    scores = compute_scores(checks)
    suggestions = derive_fix_suggestions(checks)
    auto_promotion = compute_auto_promotion(verdict, checks, frontmatter)

    slug = frontmatter.get("slug") or "(unknown)"
    ed = frontmatter.get("entity_data") or {}
    db = ed.get("decision_brief") or {}
    source_kind = db.get("source_kind")
    db_quality = (
        "STRONG" if source_kind == "deterministic_transform"
        else "DATA_WEAK" if source_kind in ("rag_candidate", "web_research_oe")
        else "NOT_APPLICABLE"
    )

    return {
        "slug": slug,
        "review_verdict": verdict,
        "decision_brief_quality": db_quality,
        "human_review_required": verdict != VERDICT_NOT_APPLICABLE,
        "exportable_seo_allowed": False,  # ALWAYS false — human review obligatory per ADR-033
        # Task 8f (2026-05-29) — machine-actionable triage : auto-promotion eligibility.
        # NEVER causes file mutation or schema flip — just a verdict for downstream tooling.
        "auto_promotion_eligible": auto_promotion["auto_promotion_eligible"],
        "auto_promotion_reason": auto_promotion["auto_promotion_reason"],
        "next_action": auto_promotion["next_action"],
        "safety_critical": auto_promotion["safety_critical"],
        "safety_category": auto_promotion["safety_category"],
        "blocking_issues": [
            s for s in suggestions if s["severity"] in ("blocking", "major")
        ],
        "fix_suggestions": suggestions,
        "scores": scores,
        "checks": checks,
    }


def review_proposal_file(path):
    """Top-level wrapper : read a proposal file from disk and run the review.

    Returns (report, frontmatter). Frontmatter is returned so callers (CLI
    --write-audit) can render the "Brief actuel" section inline.
    """
    fm, body = parse_proposal_file(path)
    report = review_proposal_data(fm, body)
    return report, fm


# === Markdown formatter (audit output) ===

# FR labels for each check (replaces raw Python dict dump).
_CHECK_LABELS_FR = {
    "structural": "Validité structurelle",
    "anti_filler": "Anti-filler",
    "function_clarity": "Clarté de la fonction",
    "selection_actionability": "Critères de choix actionnables",
    "compatibility_readability": "Lisibilité de la compatibilité",
    "source_quality": "Qualité de la source",
}


def _format_check_line(name, result):
    """Render a single check result as a FR human-readable line (no dict dump)."""
    symbol = "✅" if result.get("pass") else "⚠️"
    label = _CHECK_LABELS_FR.get(name, name)
    summary = ""
    if name == "structural":
        if result.get("pass"):
            summary = "tous les champs requis présents"
        else:
            reason = result.get("reason", "?")
            details = result.get("details") or ""
            if details:
                summary = f"{reason} ({details})"
            else:
                summary = reason
    elif name == "anti_filler":
        if result.get("pass"):
            summary = "aucun placeholder ni phrase générique"
        else:
            v = result.get("violations") or []
            summary = f"filler détecté : {', '.join(v)}"
    elif name == "function_clarity":
        bits = []
        if result.get("has_technical_verb"):
            bits.append("verbe technique présent")
        else:
            bits.append("**pas de verbe technique** (filtre/régule/entraîne/etc.)")
        if result.get("marketing_detected"):
            bits.append("**marketing détecté**")
        else:
            bits.append("pas de marketing")
        summary = " ; ".join(bits)
    elif name == "selection_actionability":
        ac = result.get("actionable_count", 0)
        tot = result.get("total", 0)
        bits = [f"{ac}/{tot} critères actionnables"]
        if result.get("non_actionable_items"):
            bits.append(f"non-actionnables : {result['non_actionable_items']}")
        if result.get("near_duplicates"):
            bits.append(f"doublons (ASCII-fold) : {result['near_duplicates']}")
        summary = " ; ".join(bits)
    elif name == "compatibility_readability":
        bits = []
        if result.get("has_debug_separator"):
            bits.append("**séparateurs debug détectés (pipe/slash)**")
        else:
            bits.append("pas de séparateurs debug")
        if result.get("has_context"):
            bits.append("phrase FR naturelle (selon/avec/et)")
        else:
            bits.append("**manque mots de liaison FR**")
        summary = " ; ".join(bits)
    elif name == "source_quality":
        summary = f"verdict source = `{result.get('verdict', '?')}`"
    else:
        summary = str(result)
    return f"- {symbol} **{label}** : {summary}"


def _format_brief_section(frontmatter):
    """Render the actual decision_brief facets inline in the review markdown.

    Avoids the reviewer having to open the proposal file separately.
    """
    ed = frontmatter.get("entity_data") or {}
    db = ed.get("decision_brief")
    if not db:
        return ["## Brief actuel", "", "_(aucun decision_brief dans cette proposal)_"]
    lines = ["## Brief actuel (facettes extraites de la proposal)"]
    lines.append("")
    lines.append(f"- **Fonction** : {db.get('function_oneliner', '_(absent)_')}")
    lines.append("- **Critères de choix prioritaires** :")
    for c in db.get("selection_criteria_top") or []:
        lines.append(f"  - {c}")
    if not db.get("selection_criteria_top"):
        lines.append("  - _(aucun)_")
    lines.append(f"- **Compatibilité** : {db.get('compatibility_summary', '_(absent)_')}")
    lines.append(
        f"- **Sourcing** : `source_kind={db.get('source_kind', '?')}` ; "
        f"`cross_check_status={db.get('cross_check_status', '?')}`"
    )
    return lines


def render_review_markdown(report, frontmatter=None):
    """Render a human-readable Markdown summary of the review JSON.

    If `frontmatter` is provided, include a "## Brief actuel" section showing
    the decision_brief facets inline (avoids the reviewer juggling 2 files).
    """
    lines = []
    lines.append(f"# Auto-review WIKI proposal — {report['slug']}")
    lines.append("")
    lines.append(f"- **Verdict** : `{report['review_verdict']}`")
    lines.append(f"- **decision_brief_quality** : `{report['decision_brief_quality']}`")
    lines.append(f"- **human_review_required** : {report['human_review_required']}")
    lines.append(f"- **exportable_seo_allowed** : {report['exportable_seo_allowed']} (toujours false : ADR-033)")
    lines.append("")
    # Task 8f (2026-05-29) — auto_promotion eligibility section.
    lines.append("## Auto-promotion eligibility (machine verdict)")
    lines.append("")
    lines.append(f"- **auto_promotion_eligible** : `{report.get('auto_promotion_eligible', False)}`")
    lines.append(f"- **next_action** : `{report.get('next_action', 'N/A')}`")
    lines.append(f"- **reason** : `{report.get('auto_promotion_reason', 'N/A')}`")
    if report.get("safety_critical"):
        lines.append(f"- **safety_critical** : `True` ; category : `{report.get('safety_category')}`  ← human spot-check required even if STRONG")
    else:
        lines.append(f"- **safety_critical** : `False`")
    lines.append("")

    if frontmatter is not None:
        lines.extend(_format_brief_section(frontmatter))
        lines.append("")

    lines.append("## Scores (1-5)")
    for k, v in report["scores"].items():
        lines.append(f"- **{k}** : {v}")
    lines.append("")
    lines.append("## Checks")
    for k, c in report["checks"].items():
        lines.append(_format_check_line(k, c))
    if report["fix_suggestions"]:
        lines.append("")
        lines.append("## Fix suggestions")
        for s in report["fix_suggestions"]:
            lines.append(f"- [{s['severity']}] `{s['field']}` — {s['message']}")
    lines.append("")
    lines.append("## Required human action")
    lines.append("")
    if report["review_verdict"] == VERDICT_REVIEWABLE:
        lines.append("Reviewer can consider promotion. **Do NOT set `exportable.seo: true` without manual verification of source traceability.**")
    elif report["review_verdict"] == VERDICT_REVIEWABLE_WITH_FIXES:
        lines.append("Reviewer can work on this proposal. Apply the suggested fixes before considering promotion. **Do not set `exportable.seo: true` yet.**")
    elif report["review_verdict"] == VERDICT_NOT_REVIEWABLE:
        lines.append("Proposal is not yet reviewable. Fix upstream (RAW frontmatter or script) and re-emit. **Do not promote.**")
    else:
        lines.append("No `decision_brief` block in this proposal. Either out of scope for this review tool, or the gamme has insufficient inputs for projection.")
    lines.append("")
    return "\n".join(lines)


# === CLI ===

def main():
    parser = argparse.ArgumentParser(
        description="Read-only auto-review for WIKI sas proposals. Outputs a triage verdict, "
                    "scores, and fix suggestions. NEVER modifies the proposal or promotes anything.",
    )
    parser.add_argument("--proposal", required=True,
                        help="Path to wiki proposal markdown file (e.g. automecanik-wiki/proposals/<slug>.md)")
    parser.add_argument("--write-audit", action="store_true",
                        help="Also write audit/wiki-auto-review/<slug>.review.{json,md}")
    parser.add_argument("--audit-dir", default="/opt/automecanik/app/audit/wiki-auto-review",
                        help="Audit directory for --write-audit (default: audit/wiki-auto-review)")
    parser.add_argument("--quiet", action="store_true", help="Only print the verdict (one word)")
    args = parser.parse_args()

    proposal_path = Path(args.proposal)
    if not proposal_path.exists():
        sys.stderr.write(f"⚠️  proposal not found: {proposal_path}\n")
        return 2

    try:
        report, frontmatter = review_proposal_file(proposal_path)
    except (ValueError, yaml.YAMLError) as e:
        sys.stderr.write(f"⚠️  cannot parse proposal: {e}\n")
        return 3

    if args.quiet:
        print(report["review_verdict"])
    else:
        print(json.dumps(report, indent=2, ensure_ascii=False))

    if args.write_audit:
        audit_dir = Path(args.audit_dir)
        audit_dir.mkdir(parents=True, exist_ok=True)
        slug = report["slug"]
        (audit_dir / f"{slug}.review.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        (audit_dir / f"{slug}.review.md").write_text(
            render_review_markdown(report, frontmatter=frontmatter), encoding="utf-8"
        )
        sys.stderr.write(f"✅ Audit written : {audit_dir}/{slug}.review.{{json,md}}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
