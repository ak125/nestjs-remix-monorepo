#!/usr/bin/env python3
"""
Retry failed linkage chunks with direct connection (no timeout) + sub-chunking.
Chunks > 200K rows are split by 4th char of ARTNR.
"""
import psycopg2, time, sys, string
from concurrent.futures import ThreadPoolExecutor, as_completed

LOGFILE = '/opt/automecanik/data/tecdoc/logs/project-linkages-retry.log'

FAILED_CHUNKS = [
    (21, '032'), (253, 'LID'), (95, '000'), (95, '350'), (95, '359'),
    (95, '363'), (95, '360'), (161, 'GDB'), (95, '154'), (95, '069'),
    (95, '301'), (95, '341'), (95, '361'), (161, 'DF4'), (253, '121'),
    (95, '064'), (95, '430'),
]

# Chunks > 200K — need sub-chunking by 4th char
BIG_CHUNKS = {(21, '032'), (253, 'LID'), (95, '000'), (95, '350'),
              (95, '359'), (95, '363'), (95, '360')}

SUB_CHARS = list(string.digits + string.ascii_uppercase + string.ascii_lowercase) + [None]


def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')


PW = get_pw()


def get_conn_direct():
    """Direct connection port 5432, no timeout."""
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com',
        port=5432,
        user='postgres.cxpojprgwgubzjyqzmoq',
        password=PW,
        dbname='postgres'
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute('SET statement_timeout = 0')
    cur.close()
    return conn


def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')


def project_linkage(dlnr, prefix, sub_char=None):
    """Project one chunk (or sub-chunk if sub_char given)."""
    conn = get_conn_direct()
    cur = conn.cursor()
    try:
        if sub_char is not None:
            where_extra = "AND substring(sl.source_artnr, 4, 1) = %s"
            params = (dlnr, prefix, sub_char)
        else:
            where_extra = ""
            params = (dlnr, prefix)

        cur.execute(f"""
        INSERT INTO pieces_relation_type
          (rtp_piece_id, rtp_type_id, rtp_target_kind, rtp_pg_id, rtp_ga_id, rtp_pm_id)
        SELECT DISTINCT ON (ar.piece_id, sl.target_internal_id)
          ar.piece_id, sl.target_internal_id, sl.rtp_target_kind,
          COALESCE(pg.pg_id, 0), sl.source_genartnr, sl.source_dlnr
        FROM tecdoc_map.source_linkages sl
        JOIN tecdoc_map.article_registry ar
          ON ar.source_artnr = sl.source_artnr AND ar.source_dlnr = sl.source_dlnr
        LEFT JOIN pieces_gamme pg ON pg.pg_id = sl.source_genartnr
        WHERE ar.piece_id IS NOT NULL
          AND sl.source_dlnr = %s
          AND left(sl.source_artnr, 3) = %s
          {where_extra}
        ON CONFLICT (rtp_type_id, rtp_piece_id) DO NOTHING
        """, params)
        return ('ok', dlnr, prefix, sub_char, cur.rowcount)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        return ('error', dlnr, prefix, sub_char, err)
    finally:
        cur.close()
        conn.close()


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 4
    log(f"=== Retry {len(FAILED_CHUNKS)} failed linkage chunks, {workers} workers ===")

    # Build task list: big chunks get sub-chunked, small ones run as-is
    tasks = []
    for dlnr, prefix in FAILED_CHUNKS:
        if (dlnr, prefix) in BIG_CHUNKS:
            for sc in SUB_CHARS:
                tasks.append((dlnr, prefix, sc))
        else:
            tasks.append((dlnr, prefix, None))

    log(f"  {len(tasks)} tasks total ({len(BIG_CHUNKS)} big chunks sub-divided)")

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(project_linkage, d, p, s): (d, p, s)
            for d, p, s in tasks
        }
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            dlnr, prefix, sub_char, = result[1], result[2], result[3]
            label = f"DLNR={dlnr} prefix={prefix}" + (f"/{sub_char}" if sub_char else "")
            if result[0] == 'ok':
                rows = result[4]
                total += rows
                if rows > 100:
                    log(f"  {label}: +{rows:,}")
            else:
                errors += 1
                log(f"  ERROR {label}: {result[4][:100]}")
            if done % 50 == 0 or done == len(tasks):
                log(f"  Progress: {done}/{len(tasks)} (+{total:,} rows, {errors} errors)")

    dur = int(time.monotonic() - start)
    log(f"  RETRY DONE: +{total:,} rows, {errors} errors ({dur}s / {dur // 60}min)")


if __name__ == '__main__':
    main()
