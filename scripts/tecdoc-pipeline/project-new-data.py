#!/usr/bin/env python3
"""Project newly loaded data to core tables — t203→pieces_ref_oem, t232→pieces_media_img, linkages."""
import psycopg2, time, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

LOGFILE = '/opt/automecanik/data/tecdoc/logs/project-new-data.log'

def get_conn(timeout=300000):
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                pw = line.strip().split('=',1)[1]
    return psycopg2.connect(
        f'postgresql://postgres.cxpojprgwgubzjyqzmoq:{pw}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres',
        options=f'-c statement_timeout={timeout}'
    )

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')

# ============ t203 → pieces_ref_oem ============
def project_oem_chunk(dlnr):
    conn = get_conn(180000)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_ref_oem (pro_piece_id, pro_prb_id, pro_oem, pro_oem_serach)
        SELECT DISTINCT ON (ar.piece_id, t203.refnr)
          ar.piece_id::text, t203.khernr, t203.refnr, regexp_replace(t203.refnr, '[^A-Za-z0-9]', '', 'g')
        FROM tecdoc_raw.t203 t203
        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = t203.artnr AND ar.source_dlnr = t203.dlnr::int
        WHERE ar.piece_id IS NOT NULL AND t203.losch_flag != '1' AND t203.dlnr = %s
        ON CONFLICT (pro_piece_id, pro_oem) DO NOTHING
        """, (str(dlnr),))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        return ('error', dlnr, str(e)[:100])
    finally:
        cur.close()
        conn.close()

# ============ t232 → pieces_media_img ============
def project_img_chunk(dlnr):
    conn = get_conn(180000)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_media_img (pmi_piece_id, pmi_pm_id, pmi_folder, pmi_name, pmi_sort, pmi_display, pmi_piece_id_i)
        SELECT ar.piece_id::text, %s, '', gr.bildname, t232.sortnr, '1', ar.piece_id
        FROM tecdoc_raw.t232 t232
        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = t232.artnr AND ar.source_dlnr = t232.dlnr::int
        JOIN tecdoc_doc.graphics_registry gr ON gr.source_bildnr = t232.bildnr::int AND gr.source_dlnr = t232.dlnr::int
        WHERE ar.piece_id IS NOT NULL AND t232.losch_flag != '1' AND gr.bildname IS NOT NULL AND t232.dlnr = %s
        ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING
        """, (str(dlnr), str(dlnr)))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        return ('error', dlnr, str(e)[:100])
    finally:
        cur.close()
        conn.close()

# ============ linkages source → core ============
def project_linkage_chunk(dlnr, prefix):
    conn = get_conn(300000)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_relation_type (rtp_piece_id, rtp_type_id, rtp_target_kind, rtp_pg_id, rtp_ga_id, rtp_pm_id)
        SELECT DISTINCT ON (ar.piece_id, sl.target_internal_id)
          ar.piece_id, sl.target_internal_id, sl.rtp_target_kind,
          COALESCE(pg.pg_id, 0), sl.source_genartnr, sl.source_dlnr
        FROM tecdoc_map.source_linkages sl
        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = sl.source_artnr AND ar.source_dlnr = sl.source_dlnr
        LEFT JOIN pieces_gamme pg ON pg.pg_id = sl.source_genartnr
        WHERE ar.piece_id IS NOT NULL AND sl.source_dlnr = %s AND left(sl.source_artnr, 3) = %s
        ON CONFLICT (rtp_type_id, rtp_piece_id) DO NOTHING
        """, (dlnr, prefix))
        return ('ok', dlnr, prefix, cur.rowcount)
    except Exception as e:
        return ('error', dlnr, prefix, str(e)[:100])
    finally:
        cur.close()
        conn.close()

def main():
    # === Phase 1: t203 → pieces_ref_oem ===
    log("=== Phase 1: t203 → pieces_ref_oem ===")
    conn = get_conn(120000)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT dlnr FROM __tecdoc_supplier_mapping WHERE dlnr IS NOT NULL ORDER BY dlnr")
    oem_dlnrs = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    log(f"  {len(oem_dlnrs)} DLNR to project")

    total_oem = 0
    errors_oem = 0
    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(project_oem_chunk, dlnr): dlnr for dlnr in oem_dlnrs}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total_oem += result[2]
            else:
                errors_oem += 1
            if done % 50 == 0:
                log(f"  OEM progress: {done}/{len(oem_dlnrs)} (+{total_oem:,} rows, {errors_oem} errors)")
    log(f"  OEM DONE: +{total_oem:,} rows, {errors_oem} errors ({int((time.monotonic()-start)/60)}min)")

    # === Phase 2: t232 → pieces_media_img ===
    log("\n=== Phase 2: t232 → pieces_media_img ===")
    conn = get_conn(120000)
    cur = conn.cursor()

    # First update graphics_registry with new t231 data
    log("  Updating graphics_registry...")
    conn2 = get_conn(300000)
    conn2.autocommit = True
    cur2 = conn2.cursor()
    cur2.execute("""
    INSERT INTO tecdoc_doc.graphics_registry (source_bildnr, source_dlnr, bildname, bildtype, dokumentenart, width, height, source_business_key)
    SELECT DISTINCT ON (bildnr::int, dlnr::int)
      bildnr::int, dlnr::int, bildname, bildtype::smallint, dokumentenart::smallint,
      CASE WHEN breit ~ '^\d+$' THEN breit::smallint ELSE NULL END,
      CASE WHEN hoch ~ '^\d+$' THEN hoch::smallint ELSE NULL END,
      encode(digest(concat_ws('|', bildnr, dlnr), 'sha256'), 'hex')
    FROM tecdoc_raw.t231
    WHERE losch_flag != '1'
    ON CONFLICT (source_bildnr, source_dlnr) DO NOTHING
    """)
    log(f"  Graphics registry: +{cur2.rowcount:,}")
    cur2.close()
    conn2.close()

    cur.execute("SELECT DISTINCT dlnr FROM __tecdoc_supplier_mapping WHERE dlnr IS NOT NULL ORDER BY dlnr")
    img_dlnrs = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    log(f"  {len(img_dlnrs)} DLNR to project images")

    total_img = 0
    errors_img = 0
    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(project_img_chunk, dlnr): dlnr for dlnr in img_dlnrs}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total_img += result[2]
            else:
                errors_img += 1
            if done % 50 == 0:
                log(f"  IMG progress: {done}/{len(img_dlnrs)} (+{total_img:,} rows, {errors_img} errors)")
    log(f"  IMG DONE: +{total_img:,} rows, {errors_img} errors ({int((time.monotonic()-start)/60)}min)")

    # === Phase 3: linkages source → core ===
    log("\n=== Phase 3: source_linkages → pieces_relation_type ===")
    conn = get_conn(120000)
    cur = conn.cursor()
    cur.execute("""
    SELECT source_dlnr, left(source_artnr, 3) as prefix, count(*)
    FROM tecdoc_map.source_linkages
    GROUP BY source_dlnr, left(source_artnr, 3)
    ORDER BY count(*) ASC
    """)
    linkage_chunks = cur.fetchall()
    cur.close()
    conn.close()
    log(f"  {len(linkage_chunks)} chunks to project")

    total_link = 0
    errors_link = 0
    start = time.monotonic()
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(project_linkage_chunk, dlnr, prefix): (dlnr, prefix) for dlnr, prefix, _ in linkage_chunks}
        done = 0
        for future in as_completed(futures):
            result = future.result()
            done += 1
            if result[0] == 'ok':
                total_link += result[3]
            else:
                errors_link += 1
            if done % 100 == 0:
                log(f"  LINK progress: {done}/{len(linkage_chunks)} (+{total_link:,} rows, {errors_link} errors)")
    log(f"  LINK DONE: +{total_link:,} rows, {errors_link} errors ({int((time.monotonic()-start)/60)}min)")

    # === ANALYZE ===
    log("\n=== ANALYZE ===")
    conn = get_conn(300000)
    conn.autocommit = True
    cur = conn.cursor()
    for t in ['pieces_ref_oem', 'pieces_media_img', 'pieces_relation_type']:
        s = time.monotonic()
        cur.execute(f"ANALYZE {t}")
        log(f"  ANALYZE {t} ({int((time.monotonic()-s)*1000)}ms)")
    cur.close()
    conn.close()

    log(f"\n=== BILAN FINAL ===")
    log(f"  OEM refs: +{total_oem:,} ({errors_oem} errors)")
    log(f"  Images: +{total_img:,} ({errors_img} errors)")
    log(f"  Linkages: +{total_link:,} ({errors_link} errors)")
    log("Done.")

if __name__ == '__main__':
    main()
