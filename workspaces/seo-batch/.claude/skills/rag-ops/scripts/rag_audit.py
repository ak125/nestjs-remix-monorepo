#!/usr/bin/env python3
"""
RAG Corpus Audit Tool v1.2 — AutoMecanik

Audits the knowledge corpus, checks coverage gaps, and reports RAG service health.

Usage:
  python3 rag_audit.py --corpus          # Scan knowledge files
  python3 rag_audit.py --coverage        # Check gamme coverage (needs curl)
  python3 rag_audit.py --health          # RAG service health check
  python3 rag_audit.py --intents         # Intent stats from API
  python3 rag_audit.py --score           # Health score /5 report
  python3 rag_audit.py --all             # Run all audits
  python3 rag_audit.py --score --format json   # JSON score output
  python3 rag_audit.py --corpus --verbose      # Verbose with file details
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict

# Configuration
KNOWLEDGE_ROOT = Path("/opt/automecanik/rag/knowledge")
RAG_API_BASE = "http://localhost:3000/api/rag"
CURL_TIMEOUT = 5  # seconds for curl -m
SUBPROCESS_TIMEOUT = 6  # seconds for subprocess (just above curl)

# Expected knowledge directories (authoritative names only)
EXPECTED_DIRS = [
    "canonical", "diagnostic", "gammes", "guides",
    "policies", "vehicle", "web"
]

# Directories to skip in scoring (not real knowledge domains)
SKIP_DIRS = {"_trash", "_raw", "seo-data", "media", "structured"}


# ─── Helpers ────────────────────────────────────────────────────────────────

def _curl_json(endpoint: str) -> dict:
    """Call a RAG API endpoint and return parsed JSON (or error dict)."""
    try:
        result = subprocess.run(
            ["curl", "-s", "-m", str(CURL_TIMEOUT), f"{RAG_API_BASE}/{endpoint}"],
            capture_output=True, text=True, timeout=SUBPROCESS_TIMEOUT,
        )
        if result.returncode != 0:
            return {"_error": True, "status": "unreachable", "error": result.stderr.strip()}
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as e:
            return {"_error": True, "status": "invalid_response", "error": str(e), "raw": result.stdout[:500]}
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return {"_error": True, "status": "timeout", "error": str(e)}


def _resolve_cb(data: dict) -> str:
    """Extract circuit breaker state from health data, with inference fallback."""
    cb = data.get("circuitBreaker", data.get("circuit_breaker", None))
    if cb is not None:
        return cb
    # External RAG API doesn't expose CB — infer from service status
    status = data.get("status", "unknown")
    return "closed" if status in ("ok", "healthy") else "unknown"


def _get_intent_field(intent: dict, *fields, default=None):
    """Get first matching field from intent dict (handles API naming variants)."""
    for field in fields:
        if field in intent:
            return intent[field]
    return default


# ─── Corpus Scan ────────────────────────────────────────────────────────────

def scan_corpus(format_mode: str = "table", verbose: bool = False) -> dict:
    """Scan the knowledge corpus and report statistics."""
    if not KNOWLEDGE_ROOT.exists():
        print(f"ERROR: Knowledge root not found: {KNOWLEDGE_ROOT}", file=sys.stderr)
        return {"error": "Knowledge root not found"}

    stats = {
        "root": str(KNOWLEDGE_ROOT),
        "directories": {},
        "total_files": 0,
        "total_size_bytes": 0,
        "issues": [],
    }

    for item in sorted(KNOWLEDGE_ROOT.iterdir()):
        if item.is_dir() and not item.name.startswith("."):
            dir_stats = scan_directory(item)
            stats["directories"][item.name] = dir_stats
            stats["total_files"] += dir_stats["file_count"]
            stats["total_size_bytes"] += dir_stats["total_size"]
            stats["issues"].extend(dir_stats["issues"])

    # Check for missing expected directories
    existing_dirs = set(stats["directories"].keys())
    for expected in EXPECTED_DIRS:
        if expected not in existing_dirs:
            stats["issues"].append({
                "type": "missing_directory",
                "path": str(KNOWLEDGE_ROOT / expected),
                "severity": "warning",
            })

    if format_mode == "json":
        print(json.dumps(stats, indent=2, ensure_ascii=False))
    else:
        print_corpus_table(stats, verbose=verbose)

    return stats


def scan_directory(dir_path: Path) -> dict:
    """Scan a single directory for knowledge files."""
    result = {
        "file_count": 0,
        "total_size": 0,
        "md_count": 0,
        "extensions": defaultdict(int),
        "issues": [],
    }

    for f in dir_path.rglob("*"):
        if f.is_file():
            result["file_count"] += 1
            size = f.stat().st_size
            result["total_size"] += size
            ext = f.suffix.lower()
            result["extensions"][ext] += 1

            if ext == ".md":
                result["md_count"] += 1

            # Check for issues
            if size == 0:
                result["issues"].append({
                    "type": "empty_file",
                    "path": str(f),
                    "severity": "error",
                })
            elif size > 50_000:
                result["issues"].append({
                    "type": "large_file",
                    "path": str(f),
                    "size_kb": round(size / 1024, 1),
                    "severity": "warning",
                })

            # Check for frontmatter in .md files
            if ext == ".md" and size > 0:
                try:
                    with open(f, "r", encoding="utf-8") as fh:
                        first_line = fh.readline().strip()
                        if first_line != "---":
                            result["issues"].append({
                                "type": "no_frontmatter",
                                "path": str(f),
                                "severity": "info",
                            })
                except (UnicodeDecodeError, OSError):
                    result["issues"].append({
                        "type": "unreadable_file",
                        "path": str(f),
                        "severity": "error",
                    })

    result["extensions"] = dict(result["extensions"])
    return result


def print_corpus_table(stats: dict, verbose: bool = False):
    """Print corpus stats as a formatted table."""
    print("=" * 60)
    print("  RAG CORPUS AUDIT")
    print("=" * 60)
    print(f"  Root: {stats['root']}")
    print(f"  Total files: {stats['total_files']}")
    print(f"  Total size: {stats['total_size_bytes'] / 1024:.0f} KB")
    print()

    # Directory table with .md count
    print(f"  {'Directory':<20} {'Files':>6} {'.md':>6} {'Size (KB)':>10}")
    print(f"  {'-'*20} {'-'*6} {'-'*6} {'-'*10}")
    for name, dir_stats in sorted(stats["directories"].items()):
        size_kb = dir_stats["total_size"] / 1024
        md = dir_stats.get("md_count", 0)
        marker = " *" if name in SKIP_DIRS else ""
        print(f"  {name:<20} {dir_stats['file_count']:>6} {md:>6} {size_kb:>9.0f}{marker}")

    if any(n in stats["directories"] for n in SKIP_DIRS):
        print(f"  (* = excluded from scoring)")

    # Issues
    if stats["issues"]:
        print()
        print(f"  ISSUES ({len(stats['issues'])})")
        print(f"  {'-'*56}")
        by_severity = defaultdict(list)
        for issue in stats["issues"]:
            by_severity[issue["severity"]].append(issue)

        max_per = 20 if verbose else 10
        for severity in ["error", "warning", "info"]:
            issues = by_severity.get(severity, [])
            if issues:
                label = {"error": "ERROR", "warning": "WARN", "info": "INFO"}[severity]
                for issue in issues[:max_per]:
                    path = issue["path"].replace(str(KNOWLEDGE_ROOT) + "/", "")
                    extra = f" ({issue.get('size_kb', '')} KB)" if "size_kb" in issue else ""
                    print(f"  [{label}] {issue['type']}: {path}{extra}")
                if len(issues) > max_per:
                    print(f"  ... and {len(issues) - max_per} more {severity} issues")
    else:
        print("\n  No issues found.")

    print()


# ─── Health Check ───────────────────────────────────────────────────────────

def check_health(format_mode: str = "table") -> dict:
    """Check RAG service health via API."""
    data = _curl_json("health")

    if format_mode == "json":
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print("=" * 60)
        print("  RAG SERVICE HEALTH")
        print("=" * 60)
        status = data.get("status", "unknown")
        cb = _resolve_cb(data)
        status_icon = {
            "ok": "OK", "healthy": "OK",
            "unreachable": "DOWN", "error": "ERROR", "timeout": "TIMEOUT"
        }.get(status, "??")
        print(f"  Status:          [{status_icon}] {status}")
        print(f"  Circuit Breaker: {cb}")

        # Show service details if available
        services = data.get("services", {})
        if services:
            print()
            for svc_name, svc_info in services.items():
                if isinstance(svc_info, dict):
                    svc_status = svc_info.get("status", "?")
                    print(f"  {svc_name:<18} {svc_status}")

        # Show corpus stats from health if available
        corpus = services.get("corpus", {})
        if corpus:
            total = corpus.get("total_documents", 0)
            by_level = corpus.get("by_truth_level", {})
            if by_level:
                print(f"\n  Corpus: {total} docs — " + ", ".join(f"{k}:{v}" for k, v in sorted(by_level.items())))

        if "error" in data:
            print(f"\n  Error: {data['error']}")
        print()

    return data


# ─── Intent Stats ───────────────────────────────────────────────────────────

def check_intents(format_mode: str = "table") -> dict:
    """Get intent stats from API."""
    data = _curl_json("intents/stats")

    if format_mode == "json":
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print("=" * 60)
        print("  RAG INTENT STATS")
        print("=" * 60)

        if data.get("_error"):
            print(f"  Error: {data.get('error', 'unknown')}")
        else:
            total_messages = data.get("totalMessages", 0)
            print(f"  Total messages: {total_messages}")
            print()

            intents = data.get("intents", data.get("stats", []))
            if isinstance(intents, list):
                intents_sorted = sorted(
                    intents,
                    key=lambda x: _get_intent_field(x, "volume", "count", default=0),
                    reverse=True,
                )
                print(f"  {'Intent':<15} {'Volume':>8} {'Avg Conf':>10} {'Last Seen':>20}")
                print(f"  {'-'*15} {'-'*8} {'-'*10} {'-'*20}")
                for intent in intents_sorted:
                    name = _get_intent_field(intent, "userIntent", "intent", "name", default="?")
                    volume = _get_intent_field(intent, "volume", "count", default=0)
                    conf = _get_intent_field(intent, "averageConfidence", "avgConfidence", "avg_confidence", default=0)
                    last = _get_intent_field(intent, "lastSeenAt", "last_seen_at", default="—")
                    if isinstance(last, str) and len(last) > 19:
                        last = last[:19]
                    if last is None:
                        last = "—"
                    print(f"  {name:<15} {volume:>8} {conf:>9.2f} {last:>20}")
            elif isinstance(intents, dict):
                print(f"  {'Intent':<15} {'Volume':>8} {'Avg Conf':>10}")
                print(f"  {'-'*15} {'-'*8} {'-'*10}")
                for name, info in sorted(intents.items(), key=lambda x: x[1].get("volume", x[1].get("count", 0)), reverse=True):
                    volume = info.get("volume", info.get("count", 0))
                    total_conf = info.get("confidenceSum", 0)
                    avg_conf = total_conf / volume if volume > 0 else 0
                    print(f"  {name:<15} {volume:>8} {avg_conf:>9.2f}")
            else:
                print(f"  No intent data available.")
        print()

    return data


# ─── Coverage ───────────────────────────────────────────────────────────────

def check_coverage(format_mode: str = "table") -> dict:
    """Compare gammes knowledge files with directory listing."""
    gammes_dir = KNOWLEDGE_ROOT / "gammes"
    if not gammes_dir.exists():
        print("ERROR: gammes directory not found", file=sys.stderr)
        return {"error": "gammes directory not found"}

    gamme_files = set()
    for f in gammes_dir.glob("*.md"):
        gamme_files.add(f.stem.lower())

    result = {
        "gamme_files_count": len(gamme_files),
        "gamme_files": sorted(gamme_files),
    }

    if format_mode == "json":
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print("=" * 60)
        print("  RAG COVERAGE — GAMMES")
        print("=" * 60)
        print(f"  Knowledge files in gammes/: {len(gamme_files)}")
        print()
        print("  To compare with DB, run via MCP Supabase:")
        print("  ┌──────────────────────────────────────────────────┐")
        print("  │ SELECT pg_alias, label                           │")
        print("  │ FROM pieces_gamme                                │")
        print("  │ WHERE NOT EXISTS (                               │")
        print("  │   SELECT 1 FROM __rag_knowledge                  │")
        print("  │   WHERE domain = 'gammes'                        │")
        print("  │     AND category = pieces_gamme.pg_alias          │")
        print("  │ )                                                │")
        print("  │ ORDER BY pg_alias;                               │")
        print("  └──────────────────────────────────────────────────┘")
        print()
        print(f"  Sample knowledge files (first 10):")
        for slug in sorted(gamme_files)[:10]:
            print(f"    - {slug}.md")
        if len(gamme_files) > 10:
            print(f"    ... and {len(gamme_files) - 10} more")
        print()

    return result


# ─── Score /5 ───────────────────────────────────────────────────────────────

def compute_score(format_mode: str = "table", verbose: bool = False) -> dict:
    """Compute RAG Health Score /5 based on 5 criteria."""
    scores = []
    details = []

    # --- Criterion 1: Service availability ---
    health = _curl_json("health")
    status = health.get("status", "unknown")
    cb = _resolve_cb(health)

    if status in ("ok", "healthy") and cb == "closed":
        scores.append(1)
        details.append({"criterion": "Service disponible", "score": "BON", "detail": f"UP + CB {cb}"})
    elif status in ("ok", "healthy") and cb == "half-open":
        scores.append(0.5)
        details.append({"criterion": "Service disponible", "score": "ACCEPTABLE", "detail": f"UP + CB {cb}"})
    else:
        scores.append(0)
        details.append({"criterion": "Service disponible", "score": "INSUFFISANT", "detail": f"status={status}, CB={cb}"})

    # --- Criterion 2: Corpus quality (L1+L2 ratio) ---
    # Prefer API data (faster, authoritative) with local scan fallback
    corpus_info = health.get("services", {}).get("corpus", {})
    by_level = corpus_info.get("by_truth_level", {})

    if by_level:
        # Use API data
        l1 = by_level.get("L1", 0)
        l2 = by_level.get("L2", 0)
        l3 = by_level.get("L3", 0)
        l4 = by_level.get("L4", 0)
        l1_l2_count = l1 + l2
        total_docs = l1 + l2 + l3 + l4
        source = "API"
    else:
        # Fallback: scan local .md files for frontmatter truth_level
        l1_l2_count = 0
        total_docs = 0
        if KNOWLEDGE_ROOT.exists():
            for f in KNOWLEDGE_ROOT.rglob("*.md"):
                if f.is_file() and f.stat().st_size > 0:
                    total_docs += 1
                    try:
                        with open(f, "r", encoding="utf-8") as fh:
                            lines = fh.readlines()
                        if lines and lines[0].strip() == "---":
                            for line in lines[1:]:
                                if line.strip() == "---":
                                    break
                                if line.strip().startswith("truth_level:"):
                                    level = line.split(":", 1)[1].strip().strip("'\"").upper()
                                    if level in ("L1", "L2"):
                                        l1_l2_count += 1
                                    break
                    except (UnicodeDecodeError, OSError):
                        pass
        source = "local"

    ratio = (l1_l2_count / total_docs * 100) if total_docs > 0 else 0

    if ratio > 70:
        scores.append(1)
        details.append({"criterion": "Qualite corpus (L1+L2)", "score": "BON", "detail": f"{ratio:.0f}% ({l1_l2_count}/{total_docs}) [{source}]"})
    elif ratio >= 50:
        scores.append(0.5)
        details.append({"criterion": "Qualite corpus (L1+L2)", "score": "ACCEPTABLE", "detail": f"{ratio:.0f}% ({l1_l2_count}/{total_docs}) [{source}]"})
    else:
        scores.append(0)
        details.append({"criterion": "Qualite corpus (L1+L2)", "score": "INSUFFISANT", "detail": f"{ratio:.0f}% ({l1_l2_count}/{total_docs}) [{source}]"})

    # --- Criterion 3: Coverage (knowledge domains with >= 5 .md files) ---
    weak_domains = []
    all_domains = []
    if KNOWLEDGE_ROOT.exists():
        for item in sorted(KNOWLEDGE_ROOT.iterdir()):
            if item.is_dir() and not item.name.startswith(".") and item.name not in SKIP_DIRS:
                md_count = sum(1 for f in item.rglob("*.md") if f.is_file())
                all_domains.append(item.name)
                if md_count < 5:
                    weak_domains.append(f"{item.name}({md_count})")

    total_domains = len(all_domains)
    if total_domains > 0:
        healthy_pct = (total_domains - len(weak_domains)) / total_domains * 100
    else:
        healthy_pct = 0

    if healthy_pct >= 80:
        scores.append(1)
        detail = f"{total_domains - len(weak_domains)}/{total_domains} domaines OK ({healthy_pct:.0f}%)"
        details.append({"criterion": "Couverture domaines", "score": "BON", "detail": detail})
    elif healthy_pct >= 60:
        scores.append(0.5)
        detail = f"{len(weak_domains)} faibles: {', '.join(weak_domains[:5])} ({healthy_pct:.0f}%)"
        details.append({"criterion": "Couverture domaines", "score": "ACCEPTABLE", "detail": detail})
    else:
        scores.append(0)
        detail = f"{len(weak_domains)} faibles: {', '.join(weak_domains[:5])} ({healthy_pct:.0f}%)"
        details.append({"criterion": "Couverture domaines", "score": "INSUFFISANT", "detail": detail})

    # --- Criterion 4: Sync health (needs MCP SQL) ---
    scores.append(None)
    details.append({
        "criterion": "Sync (0 erreurs)",
        "score": "N/A",
        "detail": "Requires MCP SQL — run query below",
        "sql": "SELECT COUNT(*) AS unresolved_errors FROM kg_rag_sync_log WHERE errors_count > 0 AND synced_at >= NOW() - INTERVAL '7 days';"
    })

    # --- Criterion 5: Intent confidence ---
    intent_data = _curl_json("intents/stats")
    intents = intent_data.get("intents", intent_data.get("stats", []))
    total_messages = intent_data.get("totalMessages", 0)

    if intents and not intent_data.get("_error"):
        if isinstance(intents, list):
            total_intents = len(intents)
            good_intents = sum(
                1 for i in intents
                if _get_intent_field(i, "averageConfidence", "avgConfidence", "avg_confidence", default=0) > 0.5
            )
            has_volume = sum(
                1 for i in intents
                if _get_intent_field(i, "volume", "count", default=0) > 0
            )
        elif isinstance(intents, dict):
            total_intents = len(intents)
            good_intents = 0
            has_volume = 0
            for name, info in intents.items():
                vol = info.get("volume", info.get("count", 0))
                if vol > 0:
                    has_volume += 1
                conf_sum = info.get("confidenceSum", 0)
                avg = conf_sum / vol if vol > 0 else 0
                if avg > 0.5:
                    good_intents += 1
        else:
            total_intents = 0
            good_intents = 0
            has_volume = 0

        # No traffic yet — intents registered but no volume
        if total_messages == 0 and has_volume == 0:
            scores.append(None)
            details.append({
                "criterion": "Intents (conf > 0.5)",
                "score": "N/A",
                "detail": f"{total_intents}/9 registered, 0 traffic — cannot evaluate"
            })
        elif total_intents >= 9 and good_intents >= 9:
            scores.append(1)
            details.append({"criterion": "Intents (conf > 0.5)", "score": "BON", "detail": f"{good_intents}/{total_intents} OK"})
        elif good_intents >= 7:
            scores.append(0.5)
            details.append({"criterion": "Intents (conf > 0.5)", "score": "ACCEPTABLE", "detail": f"{good_intents}/{total_intents} OK"})
        else:
            scores.append(0)
            details.append({"criterion": "Intents (conf > 0.5)", "score": "INSUFFISANT", "detail": f"{good_intents}/{total_intents} OK ({has_volume} with traffic)"})
    else:
        scores.append(None)
        details.append({
            "criterion": "Intents (conf > 0.5)",
            "score": "N/A",
            "detail": "Intent stats unavailable (API down or no data)"
        })

    # --- Compute total ---
    evaluable = [s for s in scores if s is not None]
    if evaluable:
        raw = sum(evaluable)
        normalized = raw / len(evaluable) * 5
    else:
        normalized = 0

    report = {
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "score": round(normalized, 1),
        "max": 5,
        "evaluated": len(evaluable),
        "total_criteria": len(scores),
        "details": details,
    }

    if format_mode == "json":
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print("=" * 64)
        print(f"  RAG HEALTH SCORE — {report['date']}")
        print("=" * 64)
        print()
        print(f"  Score: {report['score']}/5  ({len(evaluable)}/{len(scores)} criteres evalues)")
        print()
        print(f"  {'#':<3} {'Critere':<28} {'Status':<14} {'Detail'}")
        print(f"  {'-'*3} {'-'*28} {'-'*14} {'-'*30}")
        for i, d in enumerate(details, 1):
            marker = {"BON": "[+]", "ACCEPTABLE": "[~]", "INSUFFISANT": "[-]", "N/A": "[?]"}
            icon = marker.get(d["score"], "[?]")
            print(f"  {i:<3} {d['criterion']:<28} {icon} {d['score']:<9} {d['detail']}")
        print()

        # Verbose: show weak domains and files
        if verbose:
            if weak_domains:
                print(f"  DOMAINES FAIBLES (< 5 .md) :")
                print(f"  {'-'*40}")
                for wd in weak_domains:
                    print(f"    {wd}")
                print()

        # Print pending SQL queries if any
        pending_sql = [d for d in details if "sql" in d]
        if pending_sql:
            print("  QUERIES MCP (a executer manuellement) :")
            print(f"  {'-'*58}")
            for d in pending_sql:
                print(f"  [{d['criterion']}]")
                print(f"  {d['sql']}")
                print()

        # Severity summary
        insuffisant = sum(1 for d in details if d["score"] == "INSUFFISANT")
        acceptable = sum(1 for d in details if d["score"] == "ACCEPTABLE")
        if insuffisant > 0:
            print(f"  SEVERITE: {insuffisant} critere(s) INSUFFISANT — action requise")
        elif acceptable > 0:
            print(f"  SEVERITE: {acceptable} critere(s) ACCEPTABLE — a surveiller")
        else:
            print(f"  SEVERITE: Tous les criteres OK")
        print()

    return report


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="RAG Corpus Audit Tool v1.2 — AutoMecanik",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --corpus              Scan knowledge files
  %(prog)s --coverage            Check gamme coverage
  %(prog)s --health              RAG service health check
  %(prog)s --intents             Intent stats from API
  %(prog)s --score               Health score /5 report
  %(prog)s --all                 Run all audits
  %(prog)s --score --format json   JSON score output
  %(prog)s --corpus --verbose      Show all issues (not just first 10)
        """,
    )
    parser.add_argument("--corpus", action="store_true", help="Scan knowledge corpus")
    parser.add_argument("--coverage", action="store_true", help="Check gamme coverage")
    parser.add_argument("--health", action="store_true", help="RAG service health check")
    parser.add_argument("--intents", action="store_true", help="Intent stats from API")
    parser.add_argument("--score", action="store_true", help="Health score /5 report")
    parser.add_argument("--all", action="store_true", help="Run all audits")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    parser.add_argument(
        "--format", choices=["table", "json"], default="table",
        help="Output format (default: table)",
    )

    args = parser.parse_args()

    if not any([args.corpus, args.coverage, args.health, args.intents, args.score, args.all]):
        parser.print_help()
        sys.exit(1)

    run_all = args.all

    if args.score:
        compute_score(args.format, verbose=args.verbose)
        return

    if args.corpus or run_all:
        scan_corpus(args.format, verbose=args.verbose)

    if args.health or run_all:
        check_health(args.format)

    if args.intents or run_all:
        check_intents(args.format)

    if args.coverage or run_all:
        check_coverage(args.format)


if __name__ == "__main__":
    main()
