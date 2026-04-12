#!/usr/bin/env python3
"""
RAG Linter — Scan 232 gamme .md files for anglicismes + out-of-scope terms.

Detects:
  - English technical terms (spin-on, OEM, OES, longlife, etc.)
  - Out-of-scope R1 voiture terms (centrifuge, briggs stratton, tracteur, etc.)
  - Ambiguous terms that may need review (hydraulique in variants context)

Output:
  - JSON report per file with detected pollutions (path, line, match)
  - Human-readable summary grouped by pollution type
  - Optional markdown report for commit

Usage:
    python3 scripts/seo/rag-lint.py
    python3 scripts/seo/rag-lint.py --json --output .spec/reports/rag-lint-2026-04-13.json
    python3 scripts/seo/rag-lint.py --markdown --output .spec/reports/rag-lint-2026-04-13.md
    python3 scripts/seo/rag-lint.py --gamme filtre-a-huile
    python3 scripts/seo/rag-lint.py --critical-only
"""
from __future__ import annotations
import os
import re
import sys
import json
import argparse
from collections import defaultdict, Counter
from pathlib import Path
from typing import Optional

RAG_DIR = Path('/opt/automecanik/rag/knowledge/gammes')

# ─── RULES DEFINITION ──────────────────────────────────────────────────

# Severity: 'critical' = must be cleaned, 'warning' = review manually
#
# JARGON ACCEPTE (non flagge) : OEM, OES, longlife, aftermarket, by-pass
# Ces termes sont du vocabulaire technique auto FR accepte par les pros.
# Les nettoyer casserait la semantique sans gain SEO reel.
#
# by-pass: utilise en contexte technique auto (clapet by-pass filtration,
# by-pass ralenti injection, by-pass thermostat refroidissement, vanne IAC).
#
RULES: list[dict] = [
    # --- Anglicismes techniques critical (vrais anglicismes gratuits) ---
    {
        'id': 'EN_SPIN_ON',
        'severity': 'critical',
        'category': 'anglicisme',
        'pattern': r'\bspin[- ]on\b',
        'suggestion': 'vissable | filtre a visser',
        'description': 'Anglicisme pour filtre a visser',
    },
    {
        'id': 'EN_MULTI_PASS',
        'severity': 'critical',
        'category': 'anglicisme',
        'pattern': r'\bmulti[- ]pass\b',
        'suggestion': 'multi-passage',
        'description': 'Anglicisme pour filtration multi-passage',
    },
    # EN_BY_PASS supprime : by-pass est un terme technique auto accepte (meme
    # statut que OEM/OES). Utilise dans : clapet by-pass filtration,
    # by-pass ralenti injection, by-pass thermostat refroidissement, vanne IAC.
    {
        'id': 'EN_ANTI_DRAIN',
        'severity': 'critical',
        'category': 'anglicisme',
        'pattern': r'\banti[- ]?drain[- ]?back\b',
        'suggestion': 'anti-retour | clapet anti-retour',
        'description': 'Anglicisme anti-drain-back',
    },
    {
        'id': 'EN_INSERT_FILTRATION',
        'severity': 'warning',
        'category': 'anglicisme',
        # Only flag 'insert' when it appears near 'filtre' context
        'pattern': r'\binsert\b(?=.{0,60}filtr)',
        'suggestion': 'cartouche | element filtrant',
        'description': 'Anglicisme insert en contexte filtration',
    },
    {
        'id': 'EN_BOOSTER',
        'severity': 'warning',
        'category': 'anglicisme',
        'pattern': r'\bbooster\b',
        'suggestion': 'amplificateur | renforcement',
        'description': 'Anglicisme booster',
    },

    # --- Out of scope R1 voiture (critical) ---
    {
        'id': 'SCOPE_CENTRIFUGE',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\bcentrifuge\b',
        'excluded_contexts': ['force centrifuge'],  # Physics term, legitimate
        'suggestion': 'SUPPRIMER (industriel/poids lourd, pas voiture)',
        'description': 'Filtre centrifuge = usage industriel/poids lourd',
    },
    {
        'id': 'SCOPE_BRIGGS',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\bbriggs[- ]?stratton\b',
        'suggestion': 'SUPPRIMER (tondeuse/generator, pas voiture)',
        'description': 'Briggs Stratton = moteurs de tondeuses/generators',
    },
    {
        'id': 'SCOPE_TRACTEUR',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\btracteur\b',
        'excluded_contexts': ['véhicule tracteur', 'vehicule tracteur'],  # Tracting vehicle for trailer
        'suggestion': 'SUPPRIMER (engin agricole, pas voiture)',
        'description': 'Tracteur = engin agricole hors scope R1',
    },
    {
        'id': 'SCOPE_POIDS_LOURD',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\bpoids[- ]lourd(s)?\b',
        'excluded_contexts': ['12 V', '24 V', '12V', '24V', 'vehicules legers', 'véhicules légers', 'voitures'],
        'suggestion': 'SUPPRIMER (camions, pas voiture)',
        'description': 'Poids lourds hors scope R1 voiture particuliere',
    },
    {
        'id': 'SCOPE_ENGIN_AGRICOLE',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\bengin(s)?\s+agricole(s)?\b',
        'suggestion': 'SUPPRIMER',
        'description': 'Engins agricoles hors scope',
    },
    {
        'id': 'SCOPE_TONDEUSE',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\btondeuse(s)?\b',
        'suggestion': 'SUPPRIMER',
        'description': 'Tondeuse hors scope R1 voiture',
    },
    {
        'id': 'SCOPE_INDUSTRIEL',
        'severity': 'warning',
        'category': 'hors_scope',
        # Only flag 'industriel' as adjective (e.g., "filtre industriel")
        'pattern': r'\bindustriel(le)?s?\b',
        'suggestion': 'Verifier contexte (peut etre OK si neutre)',
        'description': 'Usage industriel potentiellement hors scope',
    },
    {
        'id': 'SCOPE_MICRON',
        'severity': 'warning',
        'category': 'hors_scope',
        # Ignore technical specs like "20 micron", "4 microns", "val_X_micron", "X µm"
        # Only flag standalone 'micron' without a preceding number
        'pattern': r'(?<!\d\s)(?<!\d)(?<!val_\d_)(?<!val_\d\d_)\bmicronique\b|\bmicro[- ]filtration\b',
        'suggestion': 'Verifier contexte (filtration industrielle ?)',
        'description': 'Micron en contexte filtration micronique industrielle',
    },
    {
        'id': 'SCOPE_AQUARIUM',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\baquarium\b',
        'suggestion': 'SUPPRIMER',
        'description': 'Aquarium hors scope',
    },
    {
        'id': 'SCOPE_PISCINE',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\bpiscine(s)?\b',
        'suggestion': 'SUPPRIMER',
        'description': 'Piscine hors scope',
    },
    {
        'id': 'SCOPE_BATEAU',
        'severity': 'warning',
        'category': 'hors_scope',
        'pattern': r'\b(bateau|marin|nautique)\b',
        'suggestion': 'Verifier (moteur marin hors scope R1)',
        'description': 'Contexte nautique hors scope',
    },
    {
        'id': 'SCOPE_AVIATION',
        'severity': 'critical',
        'category': 'hors_scope',
        'pattern': r'\b(aviation|aeronautique|aéronautique|avion)\b',
        'excluded_contexts': ['aviation/tressé', 'aviation / tressé', 'aviation tressé', 'type aviation', 'aviation/tresse', 'aviation / tresse', 'renforcés (aviation'],
        'suggestion': 'SUPPRIMER',
        'description': 'Aviation hors scope',
    },
]


def compile_rules(rules: list[dict]) -> list[dict]:
    """Pre-compile regex patterns."""
    for rule in rules:
        rule['regex'] = re.compile(rule['pattern'], re.IGNORECASE)
    return rules


def scan_file(filepath: Path, rules: list[dict]) -> list[dict]:
    """Scan a single .md file for all rules, return list of matches.

    Honors `excluded_contexts` per rule: a match is skipped if any of the
    excluded substrings (case-insensitive) appears on the same line.
    """
    try:
        content = filepath.read_text(encoding='utf-8')
    except Exception as e:
        return [{'error': f'read failed: {e}', 'file': str(filepath)}]

    matches = []
    lines = content.split('\n')

    for rule in rules:
        excluded_contexts = rule.get('excluded_contexts', [])
        excluded_lower = [ctx.lower() for ctx in excluded_contexts]

        for line_idx, line in enumerate(lines, start=1):
            line_lower = line.lower()
            # Skip entire line if any excluded context is present
            if any(ctx in line_lower for ctx in excluded_lower):
                continue

            for m in rule['regex'].finditer(line):
                matches.append({
                    'rule_id': rule['id'],
                    'severity': rule['severity'],
                    'category': rule['category'],
                    'line': line_idx,
                    'match': m.group(0),
                    'context': line.strip()[:120],
                    'suggestion': rule['suggestion'],
                })

    return matches


def scan_rag_dir(rag_dir: Path, rules: list[dict], filter_slug: Optional[str] = None) -> dict:
    """Scan all .md files in rag_dir, return dict {filename: [matches]}."""
    results: dict[str, list[dict]] = {}

    md_files = sorted(rag_dir.glob('*.md'))
    if filter_slug:
        md_files = [f for f in md_files if f.stem == filter_slug]

    for md_file in md_files:
        matches = scan_file(md_file, rules)
        if matches:
            results[md_file.name] = matches

    return results


def print_summary(results: dict, critical_only: bool = False):
    """Print human-readable summary grouped by pollution type."""
    if not results:
        print("✓ No pollution detected. RAG files are clean.")
        return

    # Stats
    total_files = len(results)
    total_matches = sum(len(m) for m in results.values())
    critical = sum(1 for f in results.values() for m in f if m['severity'] == 'critical')
    warnings = sum(1 for f in results.values() for m in f if m['severity'] == 'warning')

    # Group by rule_id
    by_rule: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for fname, matches in results.items():
        for m in matches:
            by_rule[m['rule_id']].append((fname, m))

    # Header
    print(f"\n{'=' * 70}")
    print(f"  RAG LINT REPORT — {total_files} fichiers avec pollutions / {total_matches} matches")
    print(f"{'=' * 70}")
    print(f"  Critical : {critical}")
    print(f"  Warnings : {warnings}\n")

    # By category
    by_cat: dict[str, int] = Counter()
    for f in results.values():
        for m in f:
            by_cat[m['category']] += 1
    print("Par categorie :")
    for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {cat:<15} {count}")
    print()

    # By rule
    print("Par regle :")
    rules_severity = {r['id']: r['severity'] for r in RULES}
    for rule_id, matches in sorted(by_rule.items(), key=lambda x: -len(x[1])):
        sev = rules_severity.get(rule_id, '?')
        if critical_only and sev != 'critical':
            continue
        files_affected = len(set(f for f, _ in matches))
        print(f"  [{sev:<8}] {rule_id:<25} {len(matches):>4} matches in {files_affected:>3} files")

    # Top 20 files
    print(f"\nTop 20 fichiers avec le plus de pollution :")
    file_counts = sorted(results.items(), key=lambda x: -len(x[1]))[:20]
    for fname, matches in file_counts:
        crit_count = sum(1 for m in matches if m['severity'] == 'critical')
        warn_count = sum(1 for m in matches if m['severity'] == 'warning')
        print(f"  {fname:<55} critical={crit_count:>3} warn={warn_count:>3}")

    # Detailed matches for critical rules (top examples)
    if not critical_only:
        print(f"\n{'=' * 70}")
        print("Exemples de pollution critical (5 par regle)")
        print(f"{'=' * 70}")
    for rule_id, matches in sorted(by_rule.items()):
        sev = rules_severity.get(rule_id, '?')
        if sev != 'critical':
            continue
        print(f"\n[{rule_id}] {rule_id}")
        for fname, m in matches[:5]:
            print(f"  {fname}:{m['line']} | '{m['match']}' | {m['context']}")


def write_json_report(results: dict, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        'scanned_at': '2026-04-13',
        'total_files_with_pollution': len(results),
        'total_matches': sum(len(m) for m in results.values()),
        'files': results,
    }
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"\nJSON report saved to {output_path}")


def write_markdown_report(results: dict, output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        '# RAG Lint Report — 2026-04-13',
        '',
        f'**Files with pollution :** {len(results)}',
        f'**Total matches :** {sum(len(m) for m in results.values())}',
        '',
    ]

    # By category
    by_cat: dict[str, int] = Counter()
    for f in results.values():
        for m in f:
            by_cat[m['category']] += 1
    lines.append('## Par categorie\n')
    lines.append('| Categorie | Count |')
    lines.append('|---|---|')
    for cat, count in sorted(by_cat.items(), key=lambda x: -x[1]):
        lines.append(f'| {cat} | {count} |')
    lines.append('')

    # By rule
    by_rule: dict[str, list] = defaultdict(list)
    for fname, matches in results.items():
        for m in matches:
            by_rule[m['rule_id']].append((fname, m))

    rules_info = {r['id']: r for r in RULES}
    lines.append('## Regles declenchees\n')
    lines.append('| Rule | Severity | Category | Matches | Files | Suggestion |')
    lines.append('|---|---|---|---|---|---|')
    for rule_id, matches in sorted(by_rule.items(), key=lambda x: -len(x[1])):
        rule = rules_info.get(rule_id, {})
        files_count = len(set(f for f, _ in matches))
        sugg = rule.get('suggestion', '')
        lines.append(f'| {rule_id} | {rule.get("severity", "?")} | {rule.get("category", "?")} | {len(matches)} | {files_count} | {sugg} |')
    lines.append('')

    # Top files
    lines.append('## Top 30 fichiers a nettoyer\n')
    lines.append('| Fichier | Critical | Warning | Total |')
    lines.append('|---|---|---|---|')
    file_counts = sorted(results.items(), key=lambda x: -len(x[1]))[:30]
    for fname, matches in file_counts:
        crit = sum(1 for m in matches if m['severity'] == 'critical')
        warn = sum(1 for m in matches if m['severity'] == 'warning')
        lines.append(f'| {fname} | {crit} | {warn} | {len(matches)} |')

    output_path.write_text('\n'.join(lines))
    print(f"\nMarkdown report saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description='RAG Linter for gamme .md files')
    parser.add_argument('--json', action='store_true', help='Output JSON report')
    parser.add_argument('--markdown', action='store_true', help='Output markdown report')
    parser.add_argument('--output', type=str, help='Output file path (for --json or --markdown)')
    parser.add_argument('--gamme', type=str, help='Scan single gamme slug (e.g. filtre-a-huile)')
    parser.add_argument('--critical-only', action='store_true', help='Show only critical pollutions')
    args = parser.parse_args()

    if not RAG_DIR.exists():
        print(f"ERROR: RAG directory not found: {RAG_DIR}")
        sys.exit(1)

    print(f"Scanning {RAG_DIR}...")
    rules = compile_rules(RULES)
    results = scan_rag_dir(RAG_DIR, rules, filter_slug=args.gamme)

    print_summary(results, critical_only=args.critical_only)

    if args.json:
        output = Path(args.output) if args.output else Path('.spec/reports/rag-lint.json')
        write_json_report(results, output)

    if args.markdown:
        output = Path(args.output) if args.output else Path('.spec/reports/rag-lint.md')
        write_markdown_report(results, output)

    # Exit code : 1 if any critical, 0 otherwise
    has_critical = any(
        m['severity'] == 'critical' for matches in results.values() for m in matches
    )
    sys.exit(1 if has_critical else 0)


if __name__ == '__main__':
    main()
