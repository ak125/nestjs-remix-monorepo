#!/usr/bin/env python3
"""Load t012, t140, t143, t144, t145, t146, t147 from CSV into tecdoc_raw.
CSV format from tecdoc-mysql-to-csv.py output."""
import csv, psycopg2, time, sys, os

def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')

PW = get_pw()
EXTRACT = '/opt/automecanik/data/tecdoc/extract'
BATCH_SIZE = 500

def get_conn():
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com', port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq', password=PW, dbname='postgres',
        options='-c statement_timeout=300000')
    conn.autocommit = True
    return conn

# Table configs: db_columns, csv_column_indices, csv_file
# CSV column indices based on verified tecdoc-mysql-to-csv.py output
TABLES = {
    't012': {
        'db_cols': ['lbeznr', 'lkz', 'sprachnr', 'bez'],
        # CSV: RESERVIERT(0), DLNR(1), SA(2), LBEZNR(3), LKZ(4), SPRACHNR(5), BEZ(6), _src(7), _batch(8), _loaded(9), _row(10), _hash(11)
        'csv_idx': [3, 4, 5, 6],
        'csv_file': f'{EXTRACT}/012.csv',
    },
    't140': {
        'db_cols': ['kmodnr', 'lbeznr1', 'lbeznr2'],
        # CSV: DLNR(0), SA(1), KMODNR(2), LBEZNR1(3), LBEZNR2(4), _src(5), ..., _row(8), _hash(9)
        'csv_idx': [2, 3, 4],
        'csv_file': f'{EXTRACT}/140.csv',
    },
    't143': {
        'db_cols': ['kmodnr', 'lkz', 'sortnr', 'muster'],
        # CSV: DLNR(0), SA(1), KMODNR(2), LKZ(3), SORTNR(4), MUSTER(5), _src(6), ..., _row(9), _hash(10)
        'csv_idx': [2, 3, 4, 5],
        'csv_file': f'{EXTRACT}/143.csv',
    },
    't144': {
        'db_cols': ['ktypnr', 'lbeznr1', 'lbeznr2'],
        # CSV: RESERVIERT(0), DLNR(1), SA(2), KTYPNR(3), LBEZNR1(4), LBEZNR2(5), _src(6), ..., _row(9), _hash(10)
        'csv_idx': [3, 4, 5],
        'csv_file': f'{EXTRACT}/144.csv',
    },
    't145': {
        'db_cols': ['ktypnr', 'lkz', 'sortnr', 'muster'],
        # CSV: RESERVIERT(0), DLNR(1), SA(2), KTYPNR(3), LKZ(4), SORTNR(5), MUSTER(6), _src(7), ..., _row(10), _hash(11)
        'csv_idx': [3, 4, 5, 6],
        'csv_file': f'{EXTRACT}/145.csv',
    },
    't146': {
        'db_cols': ['sprachnr', 'lbeznr', 'muster'],
        # CSV: DLNR(0), SA(1), SPRACHNR(2), LBEZNR(3), encoded(4), _src(5), ..., _row(8), _hash(9)
        'csv_idx': [2, 3, 4],
        'csv_file': f'{EXTRACT}/146.csv',
    },
    't147': {
        'db_cols': ['sprachnr', 'lbeznr', 'muster'],
        # CSV: RESERVIERT(0), DLNR(1), SA(2), SPRACHNR(3), LBEZNR(4), encoded(5), _src(6), ..., _row(9), _hash(10)
        'csv_idx': [3, 4, 5],
        'csv_file': f'{EXTRACT}/147.csv',
    },
}


def esc(v):
    if v is None or v == '':
        return 'NULL'
    return "'" + v.replace("'", "''") + "'"


def load_table(name, cfg):
    path = cfg['csv_file']
    if not os.path.exists(path):
        print(f"  SKIP {name}: {path} not found")
        return 0

    db_cols = cfg['db_cols']
    col_list = ','.join(db_cols)
    idx = cfg['csv_idx']

    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"DELETE FROM tecdoc_raw.{name}")
    print(f"  Cleared tecdoc_raw.{name}")

    total = 0
    errors = 0
    batch = []
    start = time.monotonic()

    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        for row_no, row in enumerate(reader, 1):
            try:
                vals = []
                for i in idx:
                    v = row[i] if i < len(row) else ''
                    vals.append(esc(v))
                batch.append('(' + ','.join(vals) + ')')

                if len(batch) >= BATCH_SIZE:
                    sql = f"INSERT INTO tecdoc_raw.{name} ({col_list}) VALUES {','.join(batch)}"
                    cur.execute(sql)
                    total += len(batch)
                    batch = []
                    if total % 100000 == 0:
                        elapsed = int(time.monotonic() - start)
                        print(f"  {name}: {total:,} rows ({elapsed}s)", flush=True)
            except Exception as e:
                errors += 1
                batch = []
                if errors <= 3:
                    print(f"  Error row {row_no}: {str(e)[:120]}")

    if batch:
        sql = f"INSERT INTO tecdoc_raw.{name} ({col_list}) VALUES {','.join(batch)}"
        cur.execute(sql)
        total += len(batch)

    cur.close()
    conn.close()
    elapsed = int(time.monotonic() - start)
    print(f"  {name}: DONE {total:,} rows, {errors} errors ({elapsed}s)")
    return total


def main():
    tables = sys.argv[1:] if len(sys.argv) > 1 else ['t140', 't143', 't144', 't145', 't146', 't147']
    # t012 excluded by default (large, run separately)
    print(f"Loading: {', '.join(tables)}")
    for t in tables:
        if t not in TABLES:
            print(f"  Unknown: {t}")
            continue
        print(f"\n=== {t} ===")
        load_table(t, TABLES[t])
    print("\nDone.")


if __name__ == '__main__':
    main()
