#!/usr/bin/env python3
"""
Populate source_linkages par héritage GENARTNR.

Mécanisme TecDoc : un article sans linkage direct dans t400 hérite
les linkages d'autres articles du même fournisseur qui partagent le même GENARTNR.

Exemple : VALEO 032801 (GENARTNR=106) n'a pas de t400, mais VALEO 032000
(même GENARTNR=106) en a → 032801 hérite les véhicules compatibles.

Pipeline :
  1. Identifier les pièces year=2025, display=false, sans source_linkage
  2. Résoudre leur GENARTNR via t211
  3. Trouver les linkages existants dans source_linkages pour ce GENARTNR+DLNR
  4. Créer les source_linkages manquants (ARTNR article, linkages du GENARTNR)
  5. Projeter vers pieces_relation_type

Sécurité :
  - ON CONFLICT DO NOTHING
  - Connexion directe port 5432
  - Workers par DLNR
  - Dry-run obligatoire

Usage:
  python3 populate-linkages-genartnr.py --dry-run
  python3 populate-linkages-genartnr.py --execute --workers 6
"""
import psycopg2, time, sys, argparse, hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed

LOGFILE = '/opt/automecanik/data/tecdoc/logs/populate-linkages-genartnr.log'


def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')


PW = get_pw()


def get_conn(timeout_s=600):
    """Direct connection port 5432."""
    conn = psycopg2.connect(
        host='db.cxpojprgwgubzjyqzmoq.supabase.co', port=5432,
        user='postgres', password=PW, dbname='postgres')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f"SET statement_timeout = '{timeout_s}s'")
    cur.close()
    return conn


def get_conn_pooler(timeout_ms=300000):
    """Pooler connection for light queries."""
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com', port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq', password=PW, dbname='postgres',
        options=f'-c statement_timeout={timeout_ms}')
    conn.autocommit = True
    return conn


def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')


def get_dlnr_with_missing_articles():
    """Get DLNR that have articles without source_linkages."""
    conn = get_conn(timeout_s=600)
    cur = conn.cursor()
    cur.execute("""
    SELECT ar.source_dlnr, pm.pm_name, count(*) as nb
    FROM pieces p
    JOIN tecdoc_map.article_registry ar ON ar.piece_id = p.piece_id
    JOIN __tecdoc_supplier_mapping sm ON sm.dlnr = ar.source_dlnr
    JOIN pieces_marque pm ON pm.pm_id = sm.sup_pm_id AND pm.pm_display = '1'
    WHERE p.piece_year = 2025 AND p.piece_display = false
      AND NOT EXISTS (SELECT 1 FROM pieces_relation_type prt WHERE prt.rtp_piece_id = p.piece_id)
      AND NOT EXISTS (
        SELECT 1 FROM tecdoc_map.source_linkages sl
        WHERE sl.source_artnr = ar.source_artnr AND sl.source_dlnr = ar.source_dlnr
      )
    GROUP BY ar.source_dlnr, pm.pm_name
    HAVING count(*) > 0
    ORDER BY count(*) DESC
    """)
    result = cur.fetchall()
    cur.close()
    conn.close()
    return result


def process_dlnr(dlnr, pm_name, dry_run=True):
    """Process one DLNR: find missing articles, inherit linkages via GENARTNR.

    Chunked approach: 3 small queries instead of 1 massive JOIN.
    Step 1: Get missing ARTNR (light query on article_registry)
    Step 2: Get GENARTNR for each missing ARTNR (light query on t211)
    Step 3: For each GENARTNR, INSERT linkages one at a time (small targeted INSERT)
    """
    conn = get_conn(timeout_s=300)
    cur = conn.cursor()
    t0 = time.time()

    try:
        # Step 1: Get missing article ARTNR for this DLNR
        cur.execute("""
        SELECT DISTINCT ar.source_artnr
        FROM tecdoc_map.article_registry ar
        JOIN pieces p ON p.piece_id = ar.piece_id
        WHERE ar.source_dlnr = %s AND p.piece_year = 2025 AND p.piece_display = false
          AND NOT EXISTS (SELECT 1 FROM tecdoc_map.source_linkages sl
            WHERE sl.source_artnr = ar.source_artnr AND sl.source_dlnr = %s)
        """, (dlnr, dlnr))
        missing_artnrs = [r[0] for r in cur.fetchall()]

        if not missing_artnrs:
            return ('ok', dlnr, pm_name, 0, 0, 0, time.time() - t0)

        # Step 2: Get GENARTNR for each missing ARTNR via t211
        ga_to_artnrs = {}
        for i in range(0, len(missing_artnrs), 500):
            batch = missing_artnrs[i:i+500]
            cur.execute("""
            SELECT artnr, genartnr::int FROM tecdoc_raw.t211
            WHERE dlnr = %s AND artnr = ANY(%s) AND losch_flag != '1'
            """, (str(dlnr), batch))
            for artnr, ga in cur.fetchall():
                if ga not in ga_to_artnrs:
                    ga_to_artnrs[ga] = []
                if artnr not in ga_to_artnrs[ga]:
                    ga_to_artnrs[ga].append(artnr)

        if dry_run:
            # Count how many GENARTNR have donors in source_linkages
            recoverable_ga = 0
            for ga in ga_to_artnrs:
                cur.execute("""
                SELECT 1 FROM tecdoc_map.source_linkages
                WHERE source_genartnr = %s AND source_dlnr = %s AND source_vknzielart = 2
                LIMIT 1
                """, (ga, dlnr))
                if cur.fetchone():
                    recoverable_ga += 1
            recoverable_artnrs = sum(len(v) for ga, v in ga_to_artnrs.items()
                                     if ga in [g for g in ga_to_artnrs])
            return ('dry-run', dlnr, pm_name, len(missing_artnrs), recoverable_ga, 0, time.time() - t0)

        # Step 3: For each GENARTNR, INSERT linkages for missing articles
        total_inserted = 0
        for ga, artnrs in ga_to_artnrs.items():
            for artnr in artnrs:
                try:
                    cur.execute("""
                    INSERT INTO tecdoc_map.source_linkages (
                        source_artnr, source_dlnr, source_genartnr,
                        source_vknzielart, source_vknzielnr_raw, source_vknzielnr,
                        target_internal_id, rtp_target_kind,
                        deduplicated, source_business_key
                    )
                    SELECT DISTINCT
                        %s,
                        sl.source_dlnr,
                        sl.source_genartnr,
                        sl.source_vknzielart,
                        sl.source_vknzielnr_raw,
                        sl.source_vknzielnr,
                        sl.target_internal_id,
                        sl.rtp_target_kind,
                        true,
                        encode(digest(concat_ws('|', %s, sl.source_dlnr::text,
                            sl.source_vknzielart::text, sl.source_vknzielnr::text
                        ), 'sha256'), 'hex')
                    FROM tecdoc_map.source_linkages sl
                    WHERE sl.source_genartnr = %s
                      AND sl.source_dlnr = %s
                      AND sl.source_vknzielart = 2
                    ON CONFLICT DO NOTHING
                    """, (artnr, artnr, ga, dlnr))
                    total_inserted += cur.rowcount
                except Exception:
                    pass  # skip individual failures

        return ('ok', dlnr, pm_name, len(missing_artnrs), len(ga_to_artnrs), total_inserted, time.time() - t0)

    except Exception as e:
        elapsed = time.time() - t0
        return ('error', dlnr, pm_name, 0, 0, str(e)[:200], elapsed)
    finally:
        cur.close()
        conn.close()


def project_new_linkages(dlnr):
    """Project newly created source_linkages to pieces_relation_type."""
    conn = get_conn(timeout_s=600)
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_relation_type (rtp_type_id, rtp_piece_id, rtp_pm_id,
          rtp_pg_id, rtp_pg_pid, rtp_ga_id, rtp_psf_id, rtp_inside, rtp_target_kind)
        SELECT DISTINCT
            sl.source_vknzielnr,
            ar.piece_id,
            p.piece_pm_id,
            p.piece_pg_id,
            p.piece_pg_pid,
            p.piece_ga_id,
            0, '0', 'vehicle_type'
        FROM tecdoc_map.source_linkages sl
        JOIN tecdoc_map.article_registry ar
          ON ar.source_artnr = sl.source_artnr AND ar.source_dlnr = sl.source_dlnr
        JOIN pieces p ON p.piece_id = ar.piece_id
          AND p.piece_year = 2025 AND p.piece_display = false
        JOIN auto_type at2 ON at2.type_id_i = sl.source_vknzielnr
        WHERE sl.source_dlnr = %s
          AND sl.source_vknzielart = 2
          AND sl.deduplicated = true  -- only inherited linkages
          AND NOT EXISTS (
            SELECT 1 FROM pieces_relation_type prt
            WHERE prt.rtp_piece_id = p.piece_id AND prt.rtp_type_id = sl.source_vknzielnr
          )
        ON CONFLICT DO NOTHING
        """, (dlnr,))
        return cur.rowcount
    except Exception as e:
        log(f"  Projection error DLNR={dlnr}: {str(e)[:100]}")
        return 0
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Populate linkages by GENARTNR inheritance')
    parser.add_argument('--dry-run', action='store_true', help='Count only')
    parser.add_argument('--execute', action='store_true', help='Create linkages')
    parser.add_argument('--workers', type=int, default=4, help='Parallel workers')
    parser.add_argument('--project', action='store_true', help='Also project to pieces_relation_type')
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        parser.print_help()
        sys.exit(1)

    log("=== Populate linkages by GENARTNR inheritance ===")
    log(f"  Mode: {'DRY-RUN' if args.dry_run else 'EXECUTE'}")

    # Get DLNR with missing articles
    dlnr_list = get_dlnr_with_missing_articles()
    total_missing = sum(r[2] for r in dlnr_list)
    log(f"  DLNR with missing articles: {len(dlnr_list)}")
    log(f"  Total missing articles: {total_missing}")

    # Process
    t0 = time.time()
    total_recoverable = 0
    total_inserted = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_dlnr, dlnr, pm_name, args.dry_run): (dlnr, pm_name, nb)
            for dlnr, pm_name, nb in dlnr_list
        }

        completed = 0
        for future in as_completed(futures):
            result = future.result()
            completed += 1

            if result[0] == 'dry-run':
                _, dlnr, pm_name, total, recoverable, _, elapsed = result
                pct = 100 * recoverable // max(total, 1)
                log(f"  {pm_name} (DLNR={dlnr}): {recoverable}/{total} récupérables ({pct}%) ({elapsed:.0f}s)")
                total_recoverable += recoverable

            elif result[0] == 'ok':
                _, dlnr, pm_name, _, _, inserted, elapsed = result
                log(f"  {pm_name} (DLNR={dlnr}): +{inserted:,} linkages ({elapsed:.0f}s)")
                total_inserted += inserted

            elif result[0] == 'error':
                _, dlnr, pm_name, _, _, err, elapsed = result
                log(f"  ERROR {pm_name} (DLNR={dlnr}): {err} ({elapsed:.0f}s)")
                errors += 1

            if completed % 10 == 0:
                log(f"  Progress: {completed}/{len(dlnr_list)}")

    elapsed_total = time.time() - t0

    # Summary
    log(f"\n=== BILAN ===")
    log(f"  DLNR traités: {len(dlnr_list)}")
    if args.dry_run:
        log(f"  Récupérables via GENARTNR: {total_recoverable}")
    else:
        log(f"  Linkages insérés: {total_inserted:,}")
    log(f"  Erreurs: {errors}")
    log(f"  Temps: {elapsed_total:.0f}s ({elapsed_total/60:.1f}min)")

    # Project to pieces_relation_type if requested
    if args.execute and args.project and total_inserted > 0:
        log(f"\n--- Projection vers pieces_relation_type ---")
        total_projected = 0
        for dlnr, pm_name, nb in dlnr_list:
            projected = project_new_linkages(dlnr)
            if projected > 0:
                log(f"  {pm_name} (DLNR={dlnr}): +{projected:,} prt rows")
                total_projected += projected
        log(f"  Total projeté: {total_projected:,}")

        # Activate newly linked pieces
        log(f"\n--- Activation des pièces débloquées ---")
        conn = get_conn(timeout_s=300)
        cur = conn.cursor()
        cur.execute("""
        UPDATE pieces p SET piece_display = true
        FROM pieces_marque pm, gamme_aggregates ga
        WHERE pm.pm_id = p.piece_pm_id AND pm.pm_display = '1'
          AND ga.ga_pg_id = p.piece_pg_id
          AND p.piece_year = 2025 AND p.piece_display = false
          AND EXISTS (
            SELECT 1 FROM pieces_relation_type prt
            JOIN auto_type at2 ON at2.type_id_i = prt.rtp_type_id AND at2.type_display = '1'
            WHERE prt.rtp_piece_id = p.piece_id
          )
        """)
        activated = cur.rowcount
        log(f"  Pièces activées: {activated}")

        cur.execute("ANALYZE pieces")
        log(f"  ANALYZE pieces ✓")
        try:
            cur.execute("SELECT refresh_gamme_aggregates(NULL)")
            log(f"  refresh_gamme_aggregates ✓")
        except:
            log(f"  refresh_gamme_aggregates: non-blocking error")

        cur.close()
        conn.close()


if __name__ == '__main__':
    main()
