#!/usr/bin/env python3
"""
TecDoc Core Projector — v2 (2026-04-13, fix pollution).

Projects source_linkages → pieces_relation_type
and t232 → pieces_media_img with parallel workers.

Changements v2 vs frozen :
  - Filtre défensif `sl.rtp_target_kind = 'vehicle_type'` ajouté dans l'INSERT
  - --source-schema / --target-schema pour pointer sur sibling (tests)
  - --dlnr-only N pour cibler un DLNR unique en mode test

Voir /home/deploy/.claude/plans/swirling-giggling-scott.md §5.A.2 et
.spec/reports/session-a-audit-20260413.md pour le rationnel.

Usage:
  python3 tecdoc-project-core.v2.py --linkages
  python3 tecdoc-project-core.v2.py --images
  python3 tecdoc-project-core.v2.py --all
  python3 tecdoc-project-core.v2.py --linkages --source-schema tecdoc_rebuild --target-schema tecdoc_rebuild --dlnr-only 21
"""

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg2


def get_conn_str():
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
    return f'postgresql://{user}:{password}@{host}:{port}/postgres'


CONN_STR = get_conn_str()

SOURCE_SCHEMA = 'tecdoc_map'
TARGET_SCHEMA = 'public'
TARGET_TABLE = 'pieces_relation_type'
DLNR_FILTER = None  # int or None


def get_linkage_chunks(chunk_size=5000):
    """Stream source_linkages as (DLNR, ARTNR prefix) chunks."""
    conn = psycopg2.connect(CONN_STR, options='-c statement_timeout=30000')
    cur = conn.cursor()
    where_dlnr = f"WHERE source_dlnr = {int(DLNR_FILTER)}" if DLNR_FILTER is not None else ""
    cur.execute(f"""
        SELECT source_dlnr, left(source_artnr, 3) as prefix, count(*)
        FROM {SOURCE_SCHEMA}.source_linkages
        {where_dlnr}
        GROUP BY source_dlnr, left(source_artnr, 3)
        ORDER BY count(*) ASC
    """)
    chunks = cur.fetchall()
    cur.close()
    conn.close()
    return chunks


def project_linkage_chunk(dlnr, prefix):
    """Project one (DLNR, prefix) chunk to <TARGET_SCHEMA>.<TARGET_TABLE>.
    Defensive filter: only rtp_target_kind = 'vehicle_type' is projected.
    """
    conn = psycopg2.connect(CONN_STR, options='-c statement_timeout=300000')
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute(f"""
        INSERT INTO {TARGET_SCHEMA}.{TARGET_TABLE} (rtp_piece_id, rtp_type_id, rtp_target_kind, rtp_pg_id, rtp_ga_id, rtp_pm_id)
        SELECT DISTINCT ON (ar.piece_id, sl.target_internal_id)
          ar.piece_id, sl.target_internal_id, sl.rtp_target_kind,
          COALESCE(pg.pg_id, 0), sl.pg_id_source, sm.sup_pm_id
        FROM {SOURCE_SCHEMA}.source_linkages sl
        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = sl.source_artnr AND ar.source_dlnr = sl.source_dlnr
        JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = sl.source_dlnr
        LEFT JOIN pieces_gamme pg ON pg.pg_id = sl.pg_id_source
        WHERE ar.piece_id IS NOT NULL
          AND sl.source_dlnr = %s
          AND left(sl.source_artnr, 3) = %s
          AND sl.rtp_target_kind = 'vehicle_type'
        ON CONFLICT (rtp_type_id, rtp_piece_id) DO NOTHING
        """, (dlnr, prefix))
        inserted = cur.rowcount
        return ('ok', dlnr, prefix, inserted)
    except Exception as e:
        return ('error', dlnr, prefix, str(e)[:100])
    finally:
        cur.close()
        conn.close()


def get_image_chunks():
    """Get DLNR list from supplier mapping (fast, no full table scan)."""
    conn = psycopg2.connect(CONN_STR, options='-c statement_timeout=30000')
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT dlnr::text FROM __tecdoc_supplier_mapping WHERE dlnr IS NOT NULL ORDER BY dlnr")
    dlnrs = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return dlnrs


def project_image_chunk(dlnr):
    """Project one DLNR chunk of t232 → pieces_media_img."""
    conn = psycopg2.connect(CONN_STR, options='-c statement_timeout=120000')
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_media_img (pmi_piece_id, pmi_pm_id, pmi_folder, pmi_name, pmi_sort, pmi_display, pmi_piece_id_i)
        SELECT
          ar.piece_id::text, %s, '', gr.bildname, t232.sortnr, '1', ar.piece_id
        FROM tecdoc_raw.t232 t232
        JOIN tecdoc_map.article_registry ar ON ar.source_artnr = t232.artnr AND ar.source_dlnr = t232.dlnr::int
        JOIN tecdoc_doc.graphics_registry gr ON gr.source_bildnr = t232.bildnr::int AND gr.source_dlnr = t232.dlnr::int
        WHERE ar.piece_id IS NOT NULL AND t232.losch_flag != '1' AND gr.bildname IS NOT NULL
          AND t232.dlnr = %s
        ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING
        """, (dlnr, dlnr))
        inserted = cur.rowcount
        return ('ok', dlnr, inserted)
    except Exception as e:
        return ('error', dlnr, str(e)[:100])
    finally:
        cur.close()
        conn.close()


def run_linkages(workers=4):
    """Project all source_linkages → pieces_relation_type with parallel workers."""
    print(f"=== Linkages projection ({workers} workers) ===")
    chunks = get_linkage_chunks()
    print(f"  {len(chunks)} chunks to process")

    total_inserted = 0
    total_errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(project_linkage_chunk, dlnr, prefix): (dlnr, prefix, cnt)
            for dlnr, prefix, cnt in chunks
        }

        for future in as_completed(futures):
            result = future.result()
            if result[0] == 'ok':
                _, dlnr, prefix, inserted = result
                total_inserted += inserted
                if inserted > 100:
                    print(f"  DLNR={dlnr} prefix={prefix}: +{inserted:,}")
            else:
                _, dlnr, prefix, err = result
                total_errors += 1
                print(f"  ERROR DLNR={dlnr} prefix={prefix}: {err}")

    duration = int((time.monotonic() - start) * 1000)
    print(f"\n  Total inserted: {total_inserted:,}")
    print(f"  Errors: {total_errors}")
    print(f"  Duration: {duration}ms")
    return total_inserted


def run_images(workers=4):
    """Project all t232 → pieces_media_img with parallel workers."""
    print(f"\n=== Images projection ({workers} workers) ===")
    dlnrs = get_image_chunks()
    print(f"  {len(dlnrs)} DLNR to process")

    total_inserted = 0
    total_errors = 0
    start = time.monotonic()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(project_image_chunk, dlnr): dlnr
            for dlnr in dlnrs
        }

        for future in as_completed(futures):
            result = future.result()
            if result[0] == 'ok':
                _, dlnr, inserted = result
                total_inserted += inserted
                if inserted > 0:
                    print(f"  DLNR={dlnr}: +{inserted:,} images")
            else:
                _, dlnr, err = result
                total_errors += 1
                print(f"  ERROR DLNR={dlnr}: {err}")

    duration = int((time.monotonic() - start) * 1000)
    print(f"\n  Total images: {total_inserted:,}")
    print(f"  Errors: {total_errors}")
    print(f"  Duration: {duration}ms")
    return total_inserted


def run_analyze():
    """ANALYZE modified tables."""
    print("\n=== ANALYZE ===")
    conn = psycopg2.connect(CONN_STR, options='-c statement_timeout=300000')
    conn.autocommit = True
    cur = conn.cursor()
    for table in ['pieces', 'pieces_ref_oem', 'pieces_relation_type', 'pieces_media_img']:
        start = time.monotonic()
        cur.execute(f"ANALYZE {table}")
        duration = int((time.monotonic() - start) * 1000)
        print(f"  ANALYZE {table} ({duration}ms)")
    cur.close()
    conn.close()


def main():
    global SOURCE_SCHEMA, TARGET_SCHEMA, TARGET_TABLE, DLNR_FILTER
    parser = argparse.ArgumentParser(description='TecDoc Core Projector (v2)')
    parser.add_argument('--linkages', action='store_true', help='Project linkages')
    parser.add_argument('--images', action='store_true', help='Project images')
    parser.add_argument('--analyze', action='store_true', help='ANALYZE tables after projection')
    parser.add_argument('--all', action='store_true', help='All projections + ANALYZE')
    parser.add_argument('--workers', type=int, default=4, help='Number of parallel workers')
    parser.add_argument('--source-schema', type=str, default='tecdoc_map',
                        help='Schema holding source_linkages (default tecdoc_map; use tecdoc_rebuild for sibling tests)')
    parser.add_argument('--target-schema', type=str, default='public',
                        help='Schema for target pieces_relation_type (default public; use tecdoc_rebuild for sibling tests)')
    parser.add_argument('--target-table', type=str, default='pieces_relation_type',
                        help='Table name in target schema (default pieces_relation_type)')
    parser.add_argument('--dlnr-only', type=int, default=None,
                        help='Project only this DLNR (test mode)')
    args = parser.parse_args()

    if not any([args.linkages, args.images, args.analyze, args.all]):
        parser.print_help()
        sys.exit(1)

    SOURCE_SCHEMA = args.source_schema
    TARGET_SCHEMA = args.target_schema
    TARGET_TABLE = args.target_table
    DLNR_FILTER = args.dlnr_only

    print(f"Projector config: source={SOURCE_SCHEMA}.source_linkages target={TARGET_SCHEMA}.{TARGET_TABLE} dlnr_filter={DLNR_FILTER}")

    if args.all or args.linkages:
        run_linkages(args.workers)

    if args.all or args.images:
        run_images(args.workers)

    if args.all or args.analyze:
        run_analyze()

    print("\nDone.")


if __name__ == '__main__':
    main()
