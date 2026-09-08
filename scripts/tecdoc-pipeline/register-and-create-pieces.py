#!/usr/bin/env python3
"""
Register new t200 articles + create missing pieces.
Phase 1: INSERT into article_registry (match existing pieces or NULL)
Phase 2: INSERT into pieces for unmatched articles with valid gamme
Phase 3: UPDATE article_registry.piece_id for newly created pieces

Usage:
  python3 register-and-create-pieces.py --phase1 --workers 6   # Register articles
  python3 register-and-create-pieces.py --phase2 --workers 6   # Create pieces
  python3 register-and-create-pieces.py --phase3 --workers 6   # Update registry
  python3 register-and-create-pieces.py --all --workers 6       # All phases
"""
import psycopg2, time, sys, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

LOGFILE = '/opt/automecanik/data/tecdoc/logs/register-create-pieces.log'
ERRFILE = '/opt/automecanik/data/tecdoc/logs/register-create-pieces-errors.log'


def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')


PW = get_pw()


def get_conn(timeout_ms=300000):
    return psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com',
        port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq',
        password=PW,
        dbname='postgres',
        options=f'-c statement_timeout={timeout_ms}'
    )


def get_conn_direct():
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


def log_error(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    with open(ERRFILE, 'a') as f:
        f.write(f"[{ts}] {msg}\n")


def get_active_dlnrs():
    """109 fournisseurs principaux : pm_display = '1' + mapping TecDoc."""
    conn = get_conn(30000)
    cur = conn.cursor()
    cur.execute("""
    SELECT DISTINCT sm.dlnr
    FROM __tecdoc_supplier_mapping sm
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    WHERE sm.dlnr IS NOT NULL
    ORDER BY sm.dlnr
    """)
    result = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return result


# ============ Phase 1: Register articles in article_registry ============

def register_chunk(dlnr):
    """Insert new t200 articles into article_registry, matching existing pieces."""
    conn = get_conn(600000)  # 10 min per chunk
    conn.autocommit = True
    cur = conn.cursor()
    try:
        # Insert with ARTNR direct match to existing pieces
        cur.execute("""
        INSERT INTO tecdoc_map.article_registry (source_artnr, source_dlnr, piece_id, source_business_key, mapping_confidence)
        SELECT DISTINCT ON (t.artnr, t.dlnr::int)
          t.artnr,
          t.dlnr::int,
          p.piece_id,
          encode(digest(concat_ws('|', t.artnr, t.dlnr), 'sha256'), 'hex'),
          CASE WHEN p.piece_id IS NOT NULL THEN 'high' ELSE 'low' END
        FROM tecdoc_raw.t200 t
        JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = t.dlnr::int
        JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
        JOIN tecdoc_raw.t211 t211 ON t211.artnr = t.artnr AND t211.dlnr = t.dlnr AND t211.losch_flag != '1'
        JOIN gamme_aggregates ga ON ga.ga_pg_id = t211.genartnr::int
        LEFT JOIN pieces p ON p.piece_ref = t.artnr AND p.piece_pm_id = sm.sup_pm_id
        WHERE t.losch_flag != '1'
          AND t.dlnr::int = %s
          AND NOT EXISTS (
            SELECT 1 FROM tecdoc_map.article_registry ar
            WHERE ar.source_artnr = t.artnr AND ar.source_dlnr = t.dlnr::int
          )
        ON CONFLICT (source_artnr, source_dlnr) DO NOTHING
        """, (dlnr,))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        log_error(f"REGISTER DLNR={dlnr}: {err}")
        return ('error', dlnr, err)
    finally:
        cur.close()
        conn.close()


def run_phase1(workers):
    log("=== Phase 1: Register new articles in article_registry ===")
    dlnrs = get_active_dlnrs()
    log(f"  {len(dlnrs)} DLNR to process")

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(register_chunk, d): d for d in dlnrs}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total += result[2]
                if result[2] > 5000:
                    log(f"  DLNR={result[1]}: +{result[2]:,}")
            else:
                errors += 1
                if errors <= 5:
                    log(f"  ERROR DLNR={result[1]}: {result[2][:80]}")
            if done % 50 == 0:
                log(f"  Progress: {done}/{len(dlnrs)} (+{total:,} registered, {errors} errors)")

    dur = int(time.monotonic() - start)
    log(f"  Phase 1 DONE: +{total:,} articles registered, {errors} errors ({dur}s / {dur//60}min)")
    return total


# ============ Phase 2: Create missing pieces ============

CHUNK_THRESHOLD = 3000  # DLNR with more articles than this get chunked by prefix


def create_pieces_chunk(dlnr, prefix=None):
    """Create pieces for articles with valid gamme that don't have a piece yet.
    Uses pooler (6543) with 10 min timeout. Large DLNR are chunked by ARTNR prefix."""
    conn = get_conn(600000)  # 10 min timeout via pooler
    conn.autocommit = True
    cur = conn.cursor()
    try:
        prefix_filter = ""
        params = (dlnr,)
        if prefix is not None:
            prefix_filter = "AND left(ar.source_artnr, 3) = %s"
            params = (dlnr, prefix)

        cur.execute(f"""
        INSERT INTO pieces (
          piece_ref, piece_ref_clean, piece_pm_id, piece_pg_id, piece_ga_id,
          piece_pg_pid, piece_fil_id, piece_qty_sale, piece_qty_pack,
          piece_weight_kgm, piece_has_oem, piece_has_img, piece_year,
          piece_display, piece_sort, piece_update, piece_psf_id
        )
        SELECT DISTINCT ON (t.artnr, sm.sup_pm_id)
          t.artnr,
          regexp_replace(t.artnr, '[^A-Za-z0-9]', '', 'g'),
          sm.sup_pm_id,
          t211.genartnr::int,
          t211.genartnr::int,
          COALESCE(pg.pg_parent::int, 0),
          1, 1, 1, 0.000,
          false, false, 2025, false, 1, false, 9999
        FROM tecdoc_map.article_registry ar
        JOIN tecdoc_raw.t200 t ON t.artnr = ar.source_artnr AND t.dlnr::int = ar.source_dlnr
        JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = ar.source_dlnr
        JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
        JOIN tecdoc_raw.t211 t211 ON t211.artnr = ar.source_artnr AND t211.dlnr::int = ar.source_dlnr AND t211.losch_flag != '1'
        JOIN gamme_aggregates ga ON ga.ga_pg_id = t211.genartnr::int
        JOIN pieces_gamme pg ON pg.pg_id = t211.genartnr::int
        WHERE ar.piece_id IS NULL
          AND ar.source_dlnr = %s
          AND t.losch_flag != '1'
          {prefix_filter}
        ON CONFLICT (piece_ref, piece_pm_id) DO NOTHING
        """, params)
        label = f"DLNR={dlnr}" + (f"/prefix={prefix}" if prefix else "")
        return ('ok', label, cur.rowcount)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        label = f"DLNR={dlnr}" + (f"/prefix={prefix}" if prefix else "")
        log_error(f"CREATE {label}: {err}")
        return ('error', label, err)
    finally:
        cur.close()
        conn.close()


def get_phase2_chunks():
    """Build work units: small DLNR as-is, big DLNR split by ARTNR prefix."""
    conn = get_conn(60000)
    cur = conn.cursor()
    cur.execute("""
    SELECT ar.source_dlnr, count(*) as cnt
    FROM tecdoc_map.article_registry ar
    JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = ar.source_dlnr
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    WHERE ar.piece_id IS NULL
    GROUP BY ar.source_dlnr
    ORDER BY count(*) DESC
    """)
    dlnr_counts = cur.fetchall()
    total_articles = sum(r[1] for r in dlnr_counts)

    # Split big DLNR into prefix chunks
    big_dlnrs = [r[0] for r in dlnr_counts if r[1] >= CHUNK_THRESHOLD]
    chunks = []
    if big_dlnrs:
        cur.execute("""
        SELECT ar.source_dlnr, left(ar.source_artnr, 3) as prefix, count(*)
        FROM tecdoc_map.article_registry ar
        JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = ar.source_dlnr
        JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
        WHERE ar.piece_id IS NULL AND ar.source_dlnr = ANY(%s)
        GROUP BY ar.source_dlnr, left(ar.source_artnr, 3)
        ORDER BY count(*) ASC
        """, (big_dlnrs,))
        for dlnr, prefix, cnt in cur.fetchall():
            chunks.append((dlnr, prefix))

    # Small DLNR as single chunks
    for dlnr, cnt in dlnr_counts:
        if cnt < CHUNK_THRESHOLD:
            chunks.append((dlnr, None))

    cur.close()
    conn.close()
    return chunks, len(dlnr_counts), total_articles


def run_phase2(workers):
    log("\n=== Phase 2: Create missing pieces ===")

    chunks, dlnr_count, total_articles = get_phase2_chunks()
    big_count = sum(1 for _, p in chunks if p is not None)
    small_count = sum(1 for _, p in chunks if p is None)
    log(f"  {dlnr_count} DLNR pm_display='1' ({total_articles:,} articles)")
    log(f"  {len(chunks)} work units ({big_count} prefix chunks + {small_count} whole DLNR)")

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(create_pieces_chunk, dlnr, prefix): (dlnr, prefix)
            for dlnr, prefix in chunks
        }
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total += result[2]
                if result[2] > 500:
                    log(f"  {result[1]}: +{result[2]:,} pieces")
            else:
                errors += 1
                if errors <= 10:
                    log(f"  ERROR {result[1]}: {result[2][:80]}")
            if done % 50 == 0 or done == len(chunks):
                elapsed = int(time.monotonic() - start)
                log(f"  Progress: {done}/{len(chunks)} (+{total:,} pieces, {errors} errors, {elapsed}s)")

    dur = int(time.monotonic() - start)
    log(f"  Phase 2 DONE: +{total:,} pieces created, {errors} errors ({dur}s / {dur//60}min)")
    return total


# ============ Phase 3: Update article_registry with new piece_ids ============

def update_registry_chunk(dlnr):
    """Set piece_id in article_registry for newly created pieces."""
    conn = get_conn(600000)  # 10 min timeout via pooler
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        UPDATE tecdoc_map.article_registry ar
        SET piece_id = p.piece_id,
            mapping_confidence = 'high',
            updated_at = now()
        FROM pieces p
        JOIN __tecdoc_supplier_mapping sm ON sm.sup_pm_id = p.piece_pm_id AND sm.dlnr = %s
        WHERE ar.source_artnr = p.piece_ref
          AND ar.piece_id IS NULL
          AND ar.source_dlnr = %s
        """, (dlnr, dlnr))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        err = str(e).replace('\n', ' ')[:200]
        log_error(f"UPDATE DLNR={dlnr}: {err}")
        return ('error', dlnr, err)
    finally:
        cur.close()
        conn.close()


def run_phase3(workers):
    log("\n=== Phase 3: Update article_registry with new piece_ids ===")

    # Only pm_display='1' DLNR
    conn = get_conn(60000)
    cur = conn.cursor()
    cur.execute("""
    SELECT ar.source_dlnr, count(*) as cnt
    FROM tecdoc_map.article_registry ar
    JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = ar.source_dlnr
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    WHERE ar.piece_id IS NULL
    GROUP BY ar.source_dlnr
    ORDER BY count(*) DESC
    """)
    dlnr_counts = cur.fetchall()
    cur.close()
    conn.close()

    dlnrs = [r[0] for r in dlnr_counts]
    log(f"  {len(dlnrs)} DLNR pm_display='1' with NULL piece_id ({sum(r[1] for r in dlnr_counts):,} total)")

    total = 0
    errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(update_registry_chunk, d): d for d in dlnrs}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total += result[2]
            else:
                errors += 1
            if done % 50 == 0:
                log(f"  Progress: {done}/{len(dlnrs)} (+{total:,} updated, {errors} errors)")

    dur = int(time.monotonic() - start)
    log(f"  Phase 3 DONE: +{total:,} registry entries updated, {errors} errors ({dur}s / {dur//60}min)")
    return total


def run_fix_sequence():
    """Fix pieces_piece_id_seq after bulk insert."""
    log("\n=== Fix sequence ===")
    conn = get_conn(60000)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT setval('pieces_piece_id_seq', (SELECT max(piece_id) + 1 FROM pieces))")
    val = cur.fetchone()[0]
    log(f"  Sequence reset to {val}")
    cur.close()
    conn.close()


def main():
    parser = argparse.ArgumentParser(description='Register & Create Pieces from TecDoc')
    parser.add_argument('--phase1', action='store_true', help='Register articles in article_registry')
    parser.add_argument('--phase2', action='store_true', help='Create missing pieces')
    parser.add_argument('--phase3', action='store_true', help='Update registry with new piece_ids')
    parser.add_argument('--all', action='store_true', help='All phases')
    parser.add_argument('--workers', type=int, default=6, help='Parallel workers (default: 6)')
    args = parser.parse_args()

    if not any([args.phase1, args.phase2, args.phase3, args.all]):
        parser.print_help()
        sys.exit(1)

    results = {}

    if args.all or args.phase1:
        results['registered'] = run_phase1(args.workers)

    if args.all or args.phase2:
        results['pieces_created'] = run_phase2(args.workers)
        run_fix_sequence()

    if args.all or args.phase3:
        results['registry_updated'] = run_phase3(args.workers)

    log("\n=== BILAN FINAL ===")
    for k, v in results.items():
        log(f"  {k}: +{v:,}")
    log("Done.")


if __name__ == '__main__':
    main()
