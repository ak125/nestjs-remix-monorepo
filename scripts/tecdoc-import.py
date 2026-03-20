#!/usr/bin/env python3
"""
TecDoc Import Pipeline — Script autonome complet.

Usage:
  python3 tecdoc-import.py --all                    # Tous les fournisseurs mappes
  python3 tecdoc-import.py --supplier 2040           # Un seul fournisseur (PM_ID)
  python3 tecdoc-import.py --top 50                  # Top 50 fournisseurs par volume
  python3 tecdoc-import.py --dry-run --top 10        # Simulation sans ecriture
  python3 tecdoc-import.py --create-missing-gammes   # Creer les gammes manquantes depuis t320

Pipeline par fournisseur:
  1. Extraire t200 + t211 du 7z
  2. Parser MySQL INSERT → listes Python
  3. Resoudre ga_id via t211 + pieces_gamme
  4. Filtrer : existants (skip), nouveaux avec ga_id valide (INSERT), sans ga_id (REVIEW)
  5. INSERT batch (500 rows) avec ON CONFLICT DO NOTHING
  6. Journaliser
  7. Purger fichiers temporaires
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import time

import psycopg2

# === CONFIG ===
ARCHIVE = '/opt/automecanik/app/.github/SQL-CONVERTED.7z'
WORKDIR = '/opt/automecanik/data/tecdoc/workdir'
LOGDIR = '/opt/automecanik/data/tecdoc/logs'
PARSER = '/opt/automecanik/app/scripts/tecdoc-mysql-to-csv.py'

BATCH_SIZE = 500  # rows per INSERT


def get_conn():
    """Get DB connection from .env."""
    host = 'aws-0-eu-west-3.pooler.supabase.com'
    port = '6543'
    user = 'postgres.cxpojprgwgubzjyqzmoq'
    password = ''
    env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('SUPABASE_DB_PASSWORD='):
                    password = line.strip().split('=', 1)[1]
    conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname='postgres')
    conn.autocommit = True
    return conn


def extract_file(filename):
    """Extract a file from the 7z archive."""
    path = os.path.join(WORKDIR, filename)
    if os.path.exists(path):
        return path
    result = subprocess.run(
        ['7z', 'e', ARCHIVE, filename, f'-o{WORKDIR}/', '-y'],
        capture_output=True, timeout=300
    )
    return path if os.path.exists(path) else None


def parse_sql_file(sql_path):
    """Parse a MySQL SQL file to CSV and return CSV path."""
    csv_path = sql_path.replace('.sql', '.csv')
    subprocess.run(
        ['python3', PARSER, sql_path, '-o', csv_path],
        capture_output=True, timeout=600
    )
    return csv_path if os.path.exists(csv_path) else None


def read_t200_artnr(csv_path):
    """Read active ARTNR from t200 CSV."""
    artnr_set = set()
    with open(csv_path) as f:
        for row in csv.reader(f):
            artnr = row[0]
            losch = row[10] if len(row) > 10 else '0'
            if losch != '1' and artnr and artnr != '__PG_NULL__':
                artnr_set.add(artnr)
    return artnr_set


def read_t211_mapping(csv_path):
    """Read ARTNR → GenArtNr mapping from t211 CSV."""
    mapping = {}
    if not csv_path or not os.path.exists(csv_path):
        return mapping
    with open(csv_path) as f:
        for row in csv.reader(f):
            artnr = row[0]
            genartnr = row[3] if len(row) > 3 else ''
            if genartnr and genartnr != '__PG_NULL__' and genartnr.isdigit():
                mapping[artnr] = int(genartnr)
    return mapping


def cleanup_files(*paths):
    """Remove temporary files."""
    for p in paths:
        if p and os.path.exists(p):
            os.remove(p)
        # Also remove .meta
        if p and os.path.exists(p.replace('.csv', '.meta')):
            os.remove(p.replace('.csv', '.meta'))


def get_suppliers(conn, pm_ids=None, top=None):
    """Get supplier list from __tecdoc_supplier_mapping."""
    cur = conn.cursor()
    if pm_ids:
        placeholders = ','.join(str(int(p)) for p in pm_ids)
        cur.execute(f"""
            SELECT sup_pm_id, sup_name, dlnr FROM __tecdoc_supplier_mapping
            WHERE sup_pm_id IN ({placeholders}) AND dlnr IS NOT NULL AND mapping_confidence = 'high'
        """)
    else:
        cur.execute("""
            SELECT sm.sup_pm_id, sm.sup_name, sm.dlnr
            FROM __tecdoc_supplier_mapping sm
            JOIN (SELECT piece_pm_id, count(*) as cnt FROM pieces GROUP BY piece_pm_id) p
              ON p.piece_pm_id = sm.sup_pm_id
            WHERE sm.dlnr IS NOT NULL AND sm.mapping_confidence = 'high'
            ORDER BY p.cnt DESC
        """)
    rows = cur.fetchall()
    cur.close()
    if top:
        rows = rows[:top]
    return rows


def get_valid_gammes(conn):
    """Get all valid pg_id from pieces_gamme."""
    cur = conn.cursor()
    cur.execute("SELECT pg_id FROM pieces_gamme")
    gammes = set(r[0] for r in cur.fetchall())
    cur.close()
    return gammes


def get_existing_refs(conn, pm_id):
    """Get existing piece_ref for a supplier."""
    cur = conn.cursor()
    cur.execute(f"SELECT piece_ref FROM pieces WHERE piece_pm_id = {pm_id}")
    refs = set(r[0] for r in cur.fetchall())
    cur.close()
    return refs


def fix_sequence(conn):
    """Ensure pieces_piece_id_seq is above max(piece_id)."""
    cur = conn.cursor()
    cur.execute("SELECT max(piece_id) FROM pieces")
    max_id = cur.fetchone()[0] or 0
    cur.execute("SELECT last_value FROM pieces_piece_id_seq")
    seq_val = cur.fetchone()[0]
    if seq_val <= max_id:
        cur.execute(f"SELECT setval('pieces_piece_id_seq', {max_id + 1})")
    cur.close()


def insert_articles(conn, pm_id, articles, valid_gammes, ga_mapping):
    """Insert new articles in batches. Returns (inserted, skipped_no_gamme)."""
    cur = conn.cursor()
    inserted = 0
    skipped = 0

    for i in range(0, len(articles), BATCH_SIZE):
        chunk = articles[i:i + BATCH_SIZE]
        values = []
        for artnr in chunk:
            ref_clean = re.sub(r'[^A-Za-z0-9]', '', artnr)
            ga_id = ga_mapping.get(artnr, 0)

            # Validate ga_id exists in pieces_gamme
            if ga_id != 0 and ga_id not in valid_gammes:
                ga_id = 0

            # ga_id=0 doesn't exist in pieces_gamme → skip this article
            if ga_id == 0:
                skipped += 1
                continue

            escaped_ref = artnr.replace("'", "''")
            escaped_clean = ref_clean.replace("'", "''")
            values.append(
                f"('{escaped_ref}','{escaped_clean}',{pm_id},0,{ga_id},"
                f"1,1,1,0.000,false,false,2025,true,1,false,0,9999)"
            )

        if not values:
            continue

        sql = (
            "INSERT INTO pieces (piece_ref,piece_ref_clean,piece_pm_id,piece_pg_id,piece_ga_id,"
            "piece_fil_id,piece_qty_sale,piece_qty_pack,piece_weight_kgm,"
            "piece_has_oem,piece_has_img,piece_year,piece_display,piece_sort,"
            "piece_update,piece_pg_pid,piece_psf_id) VALUES "
            + ','.join(values)
            + " ON CONFLICT (piece_ref, piece_pm_id) DO NOTHING"
        )

        try:
            cur.execute(sql)
            inserted += cur.rowcount
        except Exception as e:
            print(f"    ERROR batch {i}: {str(e)[:120]}", file=sys.stderr)

    cur.close()
    return inserted, skipped


def create_missing_gammes(conn):
    """Create missing gammes from TecDoc t320."""
    cur = conn.cursor()

    # Get existing gammes
    cur.execute("SELECT pg_id FROM pieces_gamme")
    existing = set(r[0] for r in cur.fetchall())

    # Get all GenArtNr used in t211 staging
    cur.execute("""
        SELECT DISTINCT genartnr::int FROM tecdoc_raw.t211
        WHERE genartnr IS NOT NULL AND genartnr != '__PG_NULL__' AND genartnr ~ '^[0-9]+$'
    """)
    used_ga = set(r[0] for r in cur.fetchall())

    missing = used_ga - existing
    if not missing:
        print("No missing gammes to create.")
        cur.close()
        return 0

    print(f"Missing gammes to create: {len(missing)}")

    # Extract and parse t320
    t320_path = extract_file('320.dat.sql')
    if not t320_path:
        print("ERROR: Cannot extract 320.dat.sql", file=sys.stderr)
        cur.close()
        return 0

    t320_csv = parse_sql_file(t320_path)
    if not t320_csv:
        print("ERROR: Cannot parse 320.dat.sql", file=sys.stderr)
        cur.close()
        return 0

    # Read t320: DLNR, SA, GENARTNR, NARTNR, BGNR, VERWNR, BEZNR, ...
    t320_data = {}
    with open(t320_csv) as f:
        for row in csv.reader(f):
            if len(row) > 2 and row[2].isdigit():
                ga_id = int(row[2])
                if ga_id in missing:
                    t320_data[ga_id] = row

    # Insert missing gammes with minimal data
    created = 0
    for ga_id in sorted(missing):
        if ga_id in t320_data:
            name = f"Gamme TecDoc {ga_id}"
            alias = f"gamme-tecdoc-{ga_id}"
            try:
                cur.execute(
                    "INSERT INTO pieces_gamme (pg_id, pg_parent, pg_ppa_id, pg_alias, pg_name, pg_name_url) "
                    "VALUES (%s, '0', '0', %s, %s, %s) ON CONFLICT (pg_id) DO NOTHING",
                    (ga_id, alias, name, alias)
                )
                if cur.rowcount > 0:
                    created += 1
            except Exception as e:
                print(f"  ERROR creating gamme {ga_id}: {e}", file=sys.stderr)

    cleanup_files(t320_path, t320_csv)
    cur.close()
    print(f"Created {created} gammes.")
    return created


def process_supplier(conn, pm_id, name, dlnr, valid_gammes, dry_run=False):
    """Full pipeline for one supplier."""
    start = time.monotonic()
    dlnr_pad = str(dlnr).zfill(4)

    # Count before
    cur = conn.cursor()
    cur.execute(f"SELECT count(*) FROM pieces WHERE piece_pm_id = {pm_id}")
    before = cur.fetchone()[0]
    cur.close()

    # Extract t200 + t211
    t200_file = f"200.{dlnr_pad}.sql"
    t211_file = f"211.{dlnr_pad}.sql"

    t200_path = extract_file(t200_file)
    t211_path = extract_file(t211_file)

    if not t200_path:
        return {'name': name, 'pm_id': pm_id, 'status': 'SKIP', 'reason': f'no file {t200_file}'}

    # Parse
    t200_csv = parse_sql_file(t200_path)
    t211_csv = parse_sql_file(t211_path) if t211_path else None

    if not t200_csv:
        cleanup_files(t200_path, t211_path)
        return {'name': name, 'pm_id': pm_id, 'status': 'SKIP', 'reason': 'parse failed'}

    # Read data
    tecdoc_artnr = read_t200_artnr(t200_csv)
    ga_mapping = read_t211_mapping(t211_csv)

    # Get existing refs
    existing_refs = get_existing_refs(conn, pm_id)

    # Filter new articles
    new_artnr = sorted(tecdoc_artnr - existing_refs)

    if not new_artnr:
        cleanup_files(t200_path, t200_csv, t211_path, t211_csv)
        duration = int((time.monotonic() - start) * 1000)
        return {
            'name': name, 'pm_id': pm_id, 'dlnr': dlnr,
            'status': 'OK', 'tecdoc': len(tecdoc_artnr), 'existing': len(existing_refs),
            'matched': len(tecdoc_artnr & existing_refs), 'new': 0, 'inserted': 0,
            'skipped_no_gamme': 0, 'duration_ms': duration
        }

    if dry_run:
        # Count how many have valid ga_id
        with_gamme = sum(1 for a in new_artnr if ga_mapping.get(a, 0) in valid_gammes)
        without_gamme = len(new_artnr) - with_gamme
        cleanup_files(t200_path, t200_csv, t211_path, t211_csv)
        duration = int((time.monotonic() - start) * 1000)
        return {
            'name': name, 'pm_id': pm_id, 'dlnr': dlnr,
            'status': 'DRY_RUN', 'tecdoc': len(tecdoc_artnr), 'existing': len(existing_refs),
            'matched': len(tecdoc_artnr & existing_refs), 'new': len(new_artnr),
            'insertable': with_gamme, 'skipped_no_gamme': without_gamme,
            'duration_ms': duration
        }

    # INSERT
    inserted, skipped = insert_articles(conn, pm_id, new_artnr, valid_gammes, ga_mapping)

    # Count after
    cur = conn.cursor()
    cur.execute(f"SELECT count(*) FROM pieces WHERE piece_pm_id = {pm_id}")
    after = cur.fetchone()[0]
    cur.close()

    # Cleanup
    cleanup_files(t200_path, t200_csv, t211_path, t211_csv)

    duration = int((time.monotonic() - start) * 1000)
    return {
        'name': name, 'pm_id': pm_id, 'dlnr': dlnr,
        'status': 'OK', 'tecdoc': len(tecdoc_artnr), 'existing': before,
        'matched': len(tecdoc_artnr & existing_refs), 'new': len(new_artnr),
        'inserted': inserted, 'skipped_no_gamme': skipped,
        'before': before, 'after': after, 'duration_ms': duration
    }


def main():
    parser = argparse.ArgumentParser(description='TecDoc Import Pipeline')
    parser.add_argument('--all', action='store_true', help='Process all mapped suppliers')
    parser.add_argument('--top', type=int, help='Process top N suppliers by volume')
    parser.add_argument('--supplier', type=int, nargs='+', help='Process specific PM_ID(s)')
    parser.add_argument('--dry-run', action='store_true', help='Simulate without writing')
    parser.add_argument('--create-missing-gammes', action='store_true', help='Create missing gammes from t320')
    args = parser.parse_args()

    os.makedirs(WORKDIR, exist_ok=True)
    os.makedirs(LOGDIR, exist_ok=True)

    conn = get_conn()
    print(f"Connected to DB.", file=sys.stderr)

    # Create missing gammes if requested
    if args.create_missing_gammes:
        created = create_missing_gammes(conn)
        print(f"Gammes created: {created}")
        conn.close()
        return

    # Get supplier list
    if args.supplier:
        suppliers = get_suppliers(conn, pm_ids=args.supplier)
    elif args.top:
        suppliers = get_suppliers(conn, top=args.top)
    elif args.all:
        suppliers = get_suppliers(conn)
    else:
        print("ERROR: specify --all, --top N, or --supplier PM_ID", file=sys.stderr)
        sys.exit(1)

    print(f"Suppliers to process: {len(suppliers)}", file=sys.stderr)

    # Fix sequence before inserting
    if not args.dry_run:
        fix_sequence(conn)

    # Get valid gammes once
    valid_gammes = get_valid_gammes(conn)

    # Process each supplier
    results = []
    total_inserted = 0
    start_all = time.monotonic()

    for pm_id, name, dlnr in suppliers:
        result = process_supplier(conn, pm_id, name, dlnr, valid_gammes, args.dry_run)
        results.append(result)

        ins = result.get('inserted', 0)
        total_inserted += ins
        skip = result.get('skipped_no_gamme', 0)
        new = result.get('new', 0)
        dur = result.get('duration_ms', 0)

        if new > 0:
            print(f"  {name:25} PM={pm_id:>5} +{ins:>6} inserted, {skip:>4} skipped (no gamme), {new:>6} new total  ({dur}ms)")
        else:
            print(f"  {name:25} PM={pm_id:>5} (all exist, {result.get('tecdoc', 0)} TecDoc / {result.get('existing', 0)} massdoc)  ({dur}ms)")

    # ANALYZE
    if not args.dry_run and total_inserted > 0:
        cur = conn.cursor()
        cur.execute("ANALYZE pieces")
        cur.close()
        print("ANALYZE done.", file=sys.stderr)

    # Final summary
    total_duration = int((time.monotonic() - start_all) * 1000)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM pieces")
    grand_total = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM pieces WHERE piece_year = 2025")
    total_2025 = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM (SELECT piece_ref, piece_pm_id FROM pieces GROUP BY piece_ref, piece_pm_id HAVING count(*) > 1) d")
    dupes = cur.fetchone()[0]
    cur.close()

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"  Suppliers processed : {len(results)}")
    print(f"  Total inserted      : {total_inserted:,}")
    print(f"  Grand total pieces  : {grand_total:,}")
    print(f"  Total 2025          : {total_2025:,}")
    print(f"  Doublons            : {dupes}")
    print(f"  Duration            : {total_duration:,}ms")
    print(f"{'='*60}")

    # Write log
    log_path = os.path.join(LOGDIR, f"import_{time.strftime('%Y%m%d_%H%M%S')}.json")
    with open(log_path, 'w') as f:
        json.dump({
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'suppliers': len(results),
            'total_inserted': total_inserted,
            'grand_total': grand_total,
            'total_2025': total_2025,
            'dupes': dupes,
            'duration_ms': total_duration,
            'dry_run': args.dry_run,
            'results': results,
        }, f, indent=2)
    print(f"Log: {log_path}")

    # Write import log to DB for freshness auditing
    if not args.dry_run:
        try:
            total_relations = sum(r.get('inserted', 0) for r in results)
            total_skipped = sum(r.get('skipped_no_gamme', 0) for r in results)
            total_errors = sum(1 for r in results if r.get('error'))
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO __tecdoc_import_log
                  (import_type, articles_inserted, relations_inserted, relations_skipped,
                   errors, duration_seconds, source_file, notes, completed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                'batch',
                total_inserted,
                total_relations,
                total_skipped,
                total_errors,
                round(total_duration / 1000, 1),
                ARCHIVE,
                f"{len(results)} suppliers, grand_total={grand_total}",
            ))
            conn.commit()
            cur.close()
            print("Import logged to __tecdoc_import_log.")
        except Exception as log_err:
            print(f"Warning: failed to log import to DB: {log_err}", file=sys.stderr)

    conn.close()


if __name__ == '__main__':
    main()
