#!/usr/bin/env python3
"""
TecDoc MySQL INSERT → CSV PostgreSQL-safe converter.

Usage:
  python3 tecdoc-mysql-to-csv.py input.sql > output.csv
  python3 tecdoc-mysql-to-csv.py input.sql -o output.csv
  cat input.sql | python3 tecdoc-mysql-to-csv.py - > output.csv

Rules:
  - NULL MySQL → __PG_NULL__ (distingue de chaine vide)
  - Chaines vides → chaines vides
  - 0000-00-00 → conserve tel quel (nettoyage dans norm, pas raw)
  - Backticks MySQL → supprimes
  - Echappements \\' → '
  - Sortie CSV PostgreSQL-safe (double-quote, RFC 4180)
  - Calcule _raw_hash (MD5 des colonnes metier)
  - Renseigne _source_row_no (compteur incremental)
"""

import sys
import csv
import hashlib
import io
import os
import re
from enum import Enum, auto

NULL_MARKER = '__PG_NULL__'


class ParserState(Enum):
    SCANNING = auto()
    IN_VALUES = auto()


def parse_mysql_value(text: str, pos: int) -> tuple[str, int]:
    """Parse a single MySQL value starting at pos. Returns (value, new_pos)."""
    if pos >= len(text):
        return ('', pos)

    # NULL
    if text[pos:pos+4].upper() == 'NULL':
        return (NULL_MARKER, pos + 4)

    # Quoted string
    if text[pos] == "'":
        pos += 1  # skip opening quote
        result = []
        while pos < len(text):
            ch = text[pos]
            if ch == '\\' and pos + 1 < len(text):
                next_ch = text[pos + 1]
                if next_ch == "'":
                    result.append("'")
                elif next_ch == '\\':
                    result.append('\\')
                elif next_ch == 'n':
                    result.append('\n')
                elif next_ch == 'r':
                    result.append('\r')
                elif next_ch == 't':
                    result.append('\t')
                elif next_ch == '0':
                    result.append('\0')
                else:
                    result.append(next_ch)
                pos += 2
            elif ch == "'" and pos + 1 < len(text) and text[pos + 1] == "'":
                # MySQL double-quote escape
                result.append("'")
                pos += 2
            elif ch == "'":
                pos += 1  # skip closing quote
                return (''.join(result), pos)
            else:
                result.append(ch)
                pos += 1
        return (''.join(result), pos)

    # Numeric value (unquoted)
    start = pos
    while pos < len(text) and text[pos] not in (',', ')', ' ', '\t', '\n', '\r'):
        pos += 1
    return (text[start:pos], pos)


def parse_values_row(text: str, pos: int) -> tuple[list[str], int]:
    """Parse one (val1, val2, ...) row. Returns (values_list, new_pos)."""
    # Find opening paren
    while pos < len(text) and text[pos] != '(':
        pos += 1
    if pos >= len(text):
        return ([], pos)
    pos += 1  # skip '('

    values = []
    while pos < len(text):
        # Skip whitespace
        while pos < len(text) and text[pos] in (' ', '\t', '\n', '\r'):
            pos += 1
        if pos >= len(text) or text[pos] == ')':
            pos += 1  # skip ')'
            break

        value, pos = parse_mysql_value(text, pos)
        values.append(value)

        # Skip comma or closing paren
        while pos < len(text) and text[pos] in (' ', '\t', '\n', '\r'):
            pos += 1
        if pos < len(text) and text[pos] == ',':
            pos += 1
        elif pos < len(text) and text[pos] == ')':
            pos += 1
            break

    return (values, pos)


def compute_raw_hash(values: list[str]) -> str:
    """MD5 hash of business columns (all values joined)."""
    content = '|'.join(values)
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def process_file(input_path: str, output_file, source_filename: str):
    """Process a MySQL INSERT SQL file and write CSV output."""
    writer = csv.writer(output_file, quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
    row_no = 0
    lines_parsed = 0
    errors = 0

    if input_path == '-':
        f = sys.stdin
    else:
        f = open(input_path, 'r', encoding='utf-8', errors='replace')

    try:
        # Read entire file (MySQL INSERTs can span multiple lines)
        content = f.read()
    finally:
        if input_path != '-':
            f.close()

    # Find all INSERT statements
    # Pattern: INSERT INTO `tablename` VALUES (...),...;
    insert_pattern = re.compile(
        r'INSERT\s+(?:IGNORE\s+)?INTO\s+`?\w+`?\s*(?:\([^)]+\)\s*)?VALUES\s*',
        re.IGNORECASE
    )

    for match in insert_pattern.finditer(content):
        pos = match.end()

        # Parse all value rows until semicolon
        while pos < len(content):
            # Skip whitespace
            while pos < len(content) and content[pos] in (' ', '\t', '\n', '\r'):
                pos += 1

            if pos >= len(content) or content[pos] == ';':
                break

            if content[pos] == ',':
                pos += 1
                continue

            if content[pos] == '(':
                try:
                    values, pos = parse_values_row(content, pos)
                    if values:
                        row_no += 1
                        raw_hash = compute_raw_hash(values)
                        # Append traceability columns: _source_filename, _batch_id, _loaded_at, _source_row_no, _raw_hash
                        # _loaded_at is handled by DB default
                        row = values + [source_filename, '', '', str(row_no), raw_hash]
                        writer.writerow(row)
                        lines_parsed += 1
                except Exception as e:
                    errors += 1
                    print(f"ERROR line ~{row_no}: {e}", file=sys.stderr)
                    # Try to skip to next row
                    next_paren = content.find('(', pos)
                    next_semi = content.find(';', pos)
                    if next_semi != -1 and (next_paren == -1 or next_semi < next_paren):
                        pos = next_semi
                    elif next_paren != -1:
                        pos = next_paren
                    else:
                        break
            else:
                pos += 1

    # Summary to stderr
    print(f"SUMMARY|{source_filename}|rows={lines_parsed}|errors={errors}", file=sys.stderr)
    return lines_parsed, errors


def main():
    if len(sys.argv) < 2:
        print("Usage: tecdoc-mysql-to-csv.py <input.sql|-> [-o output.csv]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    source_filename = os.path.basename(input_path) if input_path != '-' else 'stdin'

    output_file = sys.stdout
    if '-o' in sys.argv:
        idx = sys.argv.index('-o')
        if idx + 1 < len(sys.argv):
            output_file = open(sys.argv[idx + 1], 'w', encoding='utf-8', newline='')

    import time
    start_time = time.monotonic()

    try:
        lines, errors = process_file(input_path, output_file, source_filename)
    finally:
        if output_file != sys.stdout:
            output_file.close()

    duration_ms = int((time.monotonic() - start_time) * 1000)

    # Write .meta file
    meta_path = None
    if '-o' in sys.argv:
        idx = sys.argv.index('-o')
        if idx + 1 < len(sys.argv):
            csv_path = sys.argv[idx + 1]
            meta_path = csv_path.rsplit('.', 1)[0] + '.meta'
    elif input_path != '-':
        meta_path = input_path.rsplit('.', 1)[0] + '.meta'

    if meta_path:
        with open(meta_path, 'w') as mf:
            mf.write(f"rows_parsed={lines + errors}\n")
            mf.write(f"rows_emitted={lines}\n")
            mf.write(f"rows_rejected={errors}\n")
            mf.write(f"duration_ms={duration_ms}\n")

    sys.exit(1 if errors > 0 else 0)


if __name__ == '__main__':
    main()
