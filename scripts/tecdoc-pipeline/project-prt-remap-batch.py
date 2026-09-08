#!/usr/bin/env python3
"""
Project source_linkages → pieces_relation_type with KTYPNR→massdoc remap.
Batch optimized: fetches all articles first, then processes in chunks with remap JOIN.
"""
import psycopg2, time, sys, os

def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.split('=', 1)[1].strip()

def get_conn(timeout_s=600):
    return psycopg2.connect(
        host='db.cxpojprgwgubzjyqzmoq.supabase.co', port=5432,
        user='postgres', password=get_pw(), dbname='postgres',
        options=f'-c statement_timeout={timeout_s * 1000}'
    )

def log(msg):
    line = f'[{time.strftime("%Y-%m-%d %H:%M:%S")}] {msg}'
    print(line, flush=True)
    with open('/opt/automecanik/data/tecdoc/logs/project-prt-remap-batch.log', 'a') as f:
        f.write(line + '\n')

def main():
    conn = get_conn(timeout_s=300)
    conn.autocommit = True
    cur = conn.cursor()
    t0 = time.time()

    # Step 1: Get all articles without prt but with source_linkages
    log("Step 1: Fetching articles without prt...")
    cur.execute("""
    SELECT p.piece_id, ar.source_artnr, ar.source_dlnr,
           p.piece_pm_id, p.piece_pg_id,
           COALESCE(p.piece_pg_pid, p.piece_pg_id) as pg_pid,
           COALESCE(p.piece_ga_id, 0) as ga_id
    FROM pieces p
    JOIN tecdoc_map.article_registry ar ON ar.piece_id = p.piece_id
    WHERE p.piece_year = 2025 AND p.piece_display = false
      AND NOT EXISTS (SELECT 1 FROM pieces_relation_type prt WHERE prt.rtp_piece_id = p.piece_id)
      AND EXISTS (SELECT 1 FROM tecdoc_map.source_linkages sl
        WHERE sl.source_artnr = ar.source_artnr AND sl.source_dlnr = ar.source_dlnr
        AND sl.source_vknzielart = 2)
    """)
    articles = cur.fetchall()
    log(f"  {len(articles)} articles to project")

    if not articles:
        log("Nothing to do.")
        return

    # Step 2: Project per chunk of 50 articles
    CHUNK = 50
    total_prt = 0
    errors = 0

    for i in range(0, len(articles), CHUNK):
        chunk = articles[i:i+CHUNK]
        chunk_prt = 0

        for pid, artnr, dlnr, pm, pg, pgp, ga in chunk:
            try:
                cur.execute("""
                INSERT INTO pieces_relation_type
                  (rtp_type_id, rtp_piece_id, rtp_pm_id, rtp_pg_id, rtp_pg_pid, rtp_ga_id, rtp_psf_id, rtp_inside, rtp_target_kind)
                SELECT DISTINCT COALESCE(r.new_id, sl.source_vknzielnr),
                  %s, %s, %s, %s, %s, 0, 0, 'vehicle_type'
                FROM tecdoc_map.source_linkages sl
                LEFT JOIN tecdoc_map.type_id_remap r ON r.old_id = sl.source_vknzielnr
                JOIN auto_type at2 ON at2.type_id_i = COALESCE(r.new_id, sl.source_vknzielnr)
                WHERE sl.source_artnr = %s AND sl.source_dlnr = %s AND sl.source_vknzielart = 2
                ON CONFLICT DO NOTHING
                """, (pid, pm, pg, pgp, ga, artnr, dlnr))
                chunk_prt += cur.rowcount
            except Exception as e:
                errors += 1
                if errors <= 5:
                    log(f"  ERROR {artnr}/{dlnr}: {str(e)[:80]}")

        total_prt += chunk_prt
        done = min(i + CHUNK, len(articles))
        if done % 500 == 0 or done == len(articles):
            elapsed = time.time() - t0
            rate = done / elapsed if elapsed > 0 else 0
            eta = (len(articles) - done) / rate if rate > 0 else 0
            log(f"  {done}/{len(articles)} +{total_prt} prt {errors}e {elapsed:.0f}s (ETA {eta:.0f}s)")

    log(f"\nStep 2 done: +{total_prt} prt rows, {errors} errors, {time.time()-t0:.0f}s")

    # Step 3: Activate pieces with nom + image + prt visible
    log("\nStep 3: Activating pieces...")
    cur.execute("""
    UPDATE pieces p SET piece_display = true
    WHERE p.piece_year = 2025 AND p.piece_display = false
      AND p.piece_name IS NOT NULL AND p.piece_name != ''
      AND p.piece_has_img = true
      AND EXISTS (
        SELECT 1 FROM pieces_relation_type prt
        JOIN auto_type at2 ON at2.type_id_i = prt.rtp_type_id AND at2.type_display = '1'
        WHERE prt.rtp_piece_id = p.piece_id
      )
    """)
    activated = cur.rowcount
    log(f"  +{activated} pieces activated")

    # Step 4: ANALYZE + refresh
    log("\nStep 4: ANALYZE + refresh...")
    cur.execute("ANALYZE pieces")
    cur.execute("ANALYZE pieces_relation_type")
    try:
        cur.execute("SELECT refresh_gamme_aggregates(NULL)")
        cur.execute("SELECT refresh_equipementier_counts()")
    except:
        log("  refresh functions skipped (timeout or error)")

    elapsed = time.time() - t0
    log(f"\n=== DONE: +{total_prt} prt, +{activated} activated, {errors} errors, {elapsed:.0f}s ===")
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
