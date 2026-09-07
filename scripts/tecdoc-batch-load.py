#!/usr/bin/env python3
"""
TecDoc batch loader — CSV → tecdoc_raw via Supabase REST API.

Usage:
  python3 tecdoc-batch-load.py --table 200 --csv /path/to/200.4330.csv
  python3 tecdoc-batch-load.py --table 200 --csv /path/to/200.4330.csv --chunk 200 --dry-run

Features:
  - Streaming: reads CSV in chunks, never loads full file in memory
  - Batch INSERT via Supabase postgrest RPC (execute_sql)
  - NULL marker '__PG_NULL__' → SQL NULL
  - Journal par chunk: rows_sent, status, duration
  - Dry-run mode: parse + validate without loading
"""

import csv
import sys
import os
import time
import json
import requests
import argparse

NULL_MARKER = '__PG_NULL__'

# Column definitions per table (must match tecdoc_raw schema)
TABLE_COLUMNS = {
    '200': ['artnr', 'dlnr', 'sa', 'beznr', 'kzsb', 'kzmat', 'kzat', 'kzzub',
            'losgr1', 'losgr2', 'losch_flag',
            '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'],
    '207': ['artnr', 'dlnr', 'sa', 'lkz', 'gebrnr', 'exclude', 'anzsofort', 'sortnr',
            'losch_flag',
            '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'],
    '100': ['dlnr', 'haession', 'marke', 'losch_flag',
            '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'],
    '209': ['artnr', 'dlnr', 'ean', 'losch_flag',
            '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'],
    '210': ['artnr', 'dlnr', 'sa', 'reserviert', 'lkz', 'sortnr', 'kritnr', 'kritwert',
            'anzsofort1', 'exclude', 'losch_flag',
            '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'],
    '211': ['artnr', 'dlnr', 'sa', 'genartnr', 'losch_flag',
            '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'],
    '001': ['tab', 'beession', 'bez', 'sprach_id', 'losch_flag',
            '_source_filename', '_batch_id', '_loaded_at', '_source_row_no', '_raw_hash'],
}


def escape_sql_value(val):
    """Escape a value for SQL INSERT."""
    if val == NULL_MARKER or val == '':
        return 'NULL'
    # Escape single quotes
    escaped = val.replace("'", "''")
    return f"'{escaped}'"


def build_insert_sql(table_id, columns, rows):
    """Build a multi-row INSERT statement."""
    col_list = ','.join(columns)
    value_rows = []
    for row in rows:
        vals = [escape_sql_value(v) for v in row]
        value_rows.append(f"({','.join(vals)})")
    values_str = ','.join(value_rows)
    return f"INSERT INTO tecdoc_raw.t{table_id} ({col_list}) VALUES {values_str};"


def execute_sql(supabase_url, service_key, sql):
    """Execute SQL via Supabase Management API."""
    # Use the postgrest RPC or direct SQL endpoint
    # For raw SQL, use the pg-meta endpoint
    url = f"{supabase_url}/rest/v1/rpc/__exec_sql"

    # Actually, Supabase doesn't expose raw SQL via REST.
    # We need to use the database connection directly.
    # Alternative: use supabase-py with a custom RPC function.

    # Best approach: use the Supabase project ID to call the management API
    # But that requires the management API key, not the service role key.

    # Simplest reliable approach: use psycopg2 or pg8000 for direct connection
    try:
        import psycopg2
        return execute_via_psycopg2(sql)
    except ImportError:
        pass

    try:
        import pg8000
        return execute_via_pg8000(sql)
    except ImportError:
        pass

    # Fallback: use subprocess with psql
    return execute_via_psql(sql)


def get_db_connection_string():
    """Build connection string from env vars."""
    host = os.environ.get('SUPABASE_DB_HOST', 'aws-0-eu-west-3.pooler.supabase.com')
    password = os.environ.get('SUPABASE_DB_PASSWORD', '')
    port = os.environ.get('SUPABASE_DB_PORT', '6543')
    user = os.environ.get('SUPABASE_DB_USER', 'postgres.cxpojprgwgubzjyqzmoq')
    dbname = os.environ.get('SUPABASE_DB_NAME', 'postgres')

    if not password:
        # Try to read from .env file
        env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith('SUPABASE_DB_PASSWORD='):
                        password = line.strip().split('=', 1)[1]
                    elif line.startswith('SUPABASE_DB_HOST='):
                        host = line.strip().split('=', 1)[1]
    return host, port, user, password, dbname


def execute_via_psycopg2(sql):
    """Execute SQL via psycopg2."""
    import psycopg2
    host, port, user, password, dbname = get_db_connection_string()
    conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    affected = cur.rowcount
    cur.close()
    conn.close()
    return affected


def execute_via_pg8000(sql):
    """Execute SQL via pg8000."""
    import pg8000
    host, port, user, password, dbname = get_db_connection_string()
    conn = pg8000.connect(host=host, port=int(port), user=user, password=password, database=dbname)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    affected = cur.rowcount
    cur.close()
    conn.close()
    return affected


def execute_via_psql(sql):
    """Execute SQL via psql subprocess."""
    import subprocess
    host, port, user, password, dbname = get_db_connection_string()
    env = os.environ.copy()
    env['PGPASSWORD'] = password
    result = subprocess.run(
        ['psql', '-h', host, '-p', port, '-U', user, '-d', dbname, '-c', sql],
        capture_output=True, text=True, env=env, timeout=120
    )
    if result.returncode != 0:
        raise RuntimeError(f"psql error: {result.stderr}")
    return 0


def stream_csv_chunks(csv_path, chunk_size):
    """Generator that yields chunks of rows from CSV."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        chunk = []
        for row in reader:
            chunk.append(row)
            if len(chunk) >= chunk_size:
                yield chunk
                chunk = []
        if chunk:
            yield chunk


def main():
    parser = argparse.ArgumentParser(description='TecDoc batch loader')
    parser.add_argument('--table', required=True, help='Table ID (e.g. 200)')
    parser.add_argument('--csv', required=True, help='Path to CSV file')
    parser.add_argument('--chunk', type=int, default=100, help='Rows per INSERT batch (default: 100)')
    parser.add_argument('--dry-run', action='store_true', help='Parse and validate without loading')
    parser.add_argument('--output-sql', help='Directory to write SQL chunks (for MCP execution)')
    args = parser.parse_args()

    if args.table not in TABLE_COLUMNS:
        print(f"ERROR: Unknown table {args.table}. Known: {list(TABLE_COLUMNS.keys())}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.csv):
        print(f"ERROR: CSV file not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    columns = TABLE_COLUMNS[args.table]
    supabase_url = os.environ.get('SUPABASE_URL', 'https://cxpojprgwgubzjyqzmoq.supabase.co')
    service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

    total_rows = 0
    total_chunks = 0
    total_errors = 0
    start_time = time.monotonic()

    print(f"Loading {args.csv} → tecdoc_raw.t{args.table} (chunk={args.chunk})", file=sys.stderr)

    for chunk in stream_csv_chunks(args.csv, args.chunk):
        total_chunks += 1
        chunk_start = time.monotonic()

        # Validate column count
        for i, row in enumerate(chunk):
            if len(row) != len(columns):
                print(f"ERROR chunk {total_chunks} row {i}: expected {len(columns)} cols, got {len(row)}", file=sys.stderr)
                total_errors += 1
                continue

        if args.dry_run:
            total_rows += len(chunk)
            duration_ms = int((time.monotonic() - chunk_start) * 1000)
            print(f"DRY-RUN chunk {total_chunks}: {len(chunk)} rows ({duration_ms}ms)", file=sys.stderr)
            continue

        # Build and execute INSERT
        sql = build_insert_sql(args.table, columns, chunk)

        try:
            if args.output_sql:
                # Write SQL to file for MCP execution
                sql_path = os.path.join(args.output_sql, f'chunk_{total_chunks:04d}.sql')
                with open(sql_path, 'w', encoding='utf-8') as sf:
                    sf.write(sql)
                total_rows += len(chunk)
                duration_ms = int((time.monotonic() - chunk_start) * 1000)
                print(f"WRITTEN chunk {total_chunks}: {len(chunk)} rows → {sql_path} ({duration_ms}ms)", file=sys.stderr)
            else:
                execute_sql(supabase_url, service_key, sql)
                total_rows += len(chunk)
                duration_ms = int((time.monotonic() - chunk_start) * 1000)
                print(f"OK chunk {total_chunks}: {len(chunk)} rows ({duration_ms}ms)", file=sys.stderr)
        except Exception as e:
            total_errors += 1
            print(f"ERROR chunk {total_chunks}: {e}", file=sys.stderr)

    total_duration = int((time.monotonic() - start_time) * 1000)

    # Summary
    summary = {
        'table': f't{args.table}',
        'csv': args.csv,
        'total_rows': total_rows,
        'total_chunks': total_chunks,
        'total_errors': total_errors,
        'chunk_size': args.chunk,
        'duration_ms': total_duration,
        'dry_run': args.dry_run
    }
    print(json.dumps(summary), file=sys.stderr)

    # Also print summary line for easy parsing
    mode = "DRY-RUN" if args.dry_run else "LOADED"
    print(f"SUMMARY|{mode}|t{args.table}|rows={total_rows}|chunks={total_chunks}|errors={total_errors}|{total_duration}ms")

    sys.exit(1 if total_errors > 0 else 0)


if __name__ == '__main__':
    main()
