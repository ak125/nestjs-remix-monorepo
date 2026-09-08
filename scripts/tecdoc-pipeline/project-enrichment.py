#!/usr/bin/env python3
"""
Projection sélective — enrichir UNIQUEMENT le périmètre catalogue établi.

Doctrine : on n'injecte pas tout TecDoc, on enrichit seulement :
  - fournisseurs actifs (v_projection_scope_suppliers)
  - pièces déjà créées (v_projection_scope_pieces)
  - véhicules/linkages déjà établis (v_projection_scope_linkages)

Phases :
  P1: t203 → pieces_ref_oem (refs OEM/constructeur)
  P2: t207/t209 → pieces_ref_search (refs recherche)
  P3: t232 → pieces_media_img (images)
  P4: t210 → pieces_criteria (critères techniques)
  P5: t410 → pieces_relation_criteria (critères par linkage véhicule)

Usage:
  python3 project-enrichment.py --dry-run                    # Compter tout
  python3 project-enrichment.py --oem --workers 6            # P1 seulement
  python3 project-enrichment.py --refs --workers 6           # P2 seulement
  python3 project-enrichment.py --images --workers 6         # P3 seulement
  python3 project-enrichment.py --criteria --workers 6       # P4 seulement
  python3 project-enrichment.py --all --workers 6            # Tout
"""
import psycopg2, time, sys, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

LOGFILE = '/opt/automecanik/data/tecdoc/logs/project-enrichment.log'

def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')

PW = get_pw()

def get_conn(timeout_s=300):
    """Direct connection port 5432."""
    conn = psycopg2.connect(
        host='db.cxpojprgwgubzjyqzmoq.supabase.co', port=5432,
        user='postgres', password=PW, dbname='postgres')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f"SET statement_timeout = '{timeout_s}s'")
    cur.close()
    return conn

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOGFILE, 'a') as f:
        f.write(line + '\n')

def get_active_dlnrs():
    conn = get_conn(60)
    cur = conn.cursor()
    cur.execute("SELECT dlnr FROM tecdoc_map.v_projection_scope_suppliers ORDER BY dlnr")
    result = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return result


def get_image_projection_dlnrs():
    """
    DLNR needed for canonical image projection : tous les DLNR qui ont des
    pieces actives mappees via article_registry + supplier_registry.

    Plus large que v_projection_scope_suppliers (qui est trop etroit et couvre
    seulement ~76K pieces au lieu des ~417K actives mappees en article_registry).
    """
    conn = get_conn(60)
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT sr.source_dlnr
        FROM pieces p
        JOIN tecdoc_map.article_registry ar ON ar.piece_id = p.piece_id
        JOIN tecdoc_map.supplier_registry sr
          ON sr.source_dlnr = ar.source_dlnr
         AND sr.pm_id = p.piece_pm_id
         AND sr.mapping_confidence = 'high'
        WHERE p.piece_display = true
        ORDER BY sr.source_dlnr
    """)
    result = [r[0] for r in cur.fetchall()]
    cur.close()
    conn.close()
    return result


# ============ P1: OEM References (t203 → pieces_ref_oem) ============

def project_oem_dlnr(dlnr):
    """Project OEM references for one DLNR — scope-limited to existing pieces."""
    conn = get_conn(600)
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_ref_oem (pro_piece_id, pro_prb_id, pro_oem, pro_oem_serach)
        SELECT DISTINCT ON (sp.piece_id, t203.khernr, regexp_replace(t203.refnr, '[^A-Za-z0-9]', '', 'g'))
          sp.piece_id::text,
          COALESCE(t203.khernr::text, '0'),
          t203.refnr,
          regexp_replace(t203.refnr, '[^A-Za-z0-9]', '', 'g')
        FROM tecdoc_map.v_projection_scope_pieces sp
        JOIN tecdoc_raw.t203 t203 ON t203.artnr = sp.source_artnr AND t203.dlnr = sp.source_dlnr::smallint
        WHERE sp.source_dlnr = %s
          AND t203.losch_flag != 1
          AND t203.refnr IS NOT NULL AND t203.refnr != ''
        ON CONFLICT (pro_piece_id, pro_prb_id, pro_oem_serach) DO NOTHING
        """, (dlnr,))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        return ('error', dlnr, str(e)[:200])
    finally:
        cur.close()
        conn.close()


# ============ P2: Search References (t207/t209 → pieces_ref_search) ============

def project_refs_dlnr(dlnr):
    """Project search references for one DLNR — scope-limited."""
    conn = get_conn(600)
    cur = conn.cursor()
    try:
        # t207 = trade/usage numbers (gebrnr)
        cur.execute("""
        INSERT INTO pieces_ref_search (prs_piece_id, prs_piece_id_i, prs_search, prs_kind, prs_ref)
        SELECT DISTINCT ON (sp.piece_id, regexp_replace(t207.gebrnr, '[^A-Za-z0-9]', '', 'g'))
          sp.piece_id::text,
          sp.piece_id,
          regexp_replace(t207.gebrnr, '[^A-Za-z0-9]', '', 'g'),
          'trade',
          t207.gebrnr
        FROM tecdoc_map.v_projection_scope_pieces sp
        JOIN tecdoc_raw.t207 t207 ON t207.artnr = sp.source_artnr AND t207.dlnr = sp.source_dlnr::text
        WHERE sp.source_dlnr = %s
          AND t207.losch_flag != '1'
          AND t207.gebrnr IS NOT NULL AND t207.gebrnr != ''
        ON CONFLICT (prs_piece_id, prs_search, prs_kind) DO NOTHING
        """, (dlnr,))
        trade_count = cur.rowcount

        # t209 = EAN barcodes (eannr)
        cur.execute("""
        INSERT INTO pieces_ref_search (prs_piece_id, prs_piece_id_i, prs_search, prs_kind, prs_ref)
        SELECT DISTINCT ON (sp.piece_id, regexp_replace(t209.eannr, '[^A-Za-z0-9]', '', 'g'))
          sp.piece_id::text,
          sp.piece_id,
          regexp_replace(t209.eannr, '[^A-Za-z0-9]', '', 'g'),
          'ean',
          t209.eannr
        FROM tecdoc_map.v_projection_scope_pieces sp
        JOIN tecdoc_raw.t209 t209 ON t209.artnr = sp.source_artnr AND t209.dlnr = sp.source_dlnr::text
        WHERE sp.source_dlnr = %s
          AND t209.losch_flag != '1'
          AND t209.eannr IS NOT NULL AND t209.eannr != ''
        ON CONFLICT (prs_piece_id, prs_search, prs_kind) DO NOTHING
        """, (dlnr,))
        ean_count = cur.rowcount

        return ('ok', dlnr, trade_count + ean_count)
    except Exception as e:
        return ('error', dlnr, str(e)[:200])
    finally:
        cur.close()
        conn.close()


# ============ P3: Images (t232 → pieces_media_img) ============
#
# Projection canonique via IDs internes uniquement.
# - Source de verite : tecdoc_map.article_registry (pas v_projection_scope_pieces, trop etroit)
# - Bridge brand : tecdoc_map.supplier_registry (pm_id interne ↔ source_dlnr externe)
# - Resolution fichier : tecdoc_doc.graphics_registry (bildnr → bildname)
# - pmi_pm_id = sr.pm_id (interne), pmi_folder = sr.source_dlnr (chemin Storage),
#   pmi_name = bildname || '.JPG' (nom fichier reel)
#
# Reparation du bug historique : l'ancienne version ecrivait pmi_pm_id=source_dlnr,
# pmi_folder='' et pmi_name=bildnr brut, ce qui a casse ~1.1M rows actives en mars 2026.

def project_images_dlnr(dlnr):
    """Project images for one DLNR — canonical via internal IDs."""
    conn = get_conn(600)
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_media_img (pmi_piece_id, pmi_piece_id_i, pmi_pm_id, pmi_folder, pmi_name, pmi_sort, pmi_display)
        SELECT DISTINCT ON (p.piece_id, gr.source_bildnr)
          p.piece_id::text,
          p.piece_id,
          sr.pm_id::text,
          sr.source_dlnr::text,
          gr.bildname || '.JPG',
          COALESCE(t232.sortnr, '1'),
          '1'
        FROM pieces p
        JOIN tecdoc_map.article_registry ar
          ON ar.piece_id = p.piece_id
        JOIN tecdoc_map.supplier_registry sr
          ON sr.source_dlnr = ar.source_dlnr
         AND sr.pm_id = p.piece_pm_id
         AND sr.mapping_confidence = 'high'
        JOIN tecdoc_raw.t232 t232
          ON t232.artnr = ar.source_artnr
         AND t232.dlnr::int = ar.source_dlnr
         AND t232.losch_flag != '1'
        JOIN tecdoc_doc.graphics_registry gr
          ON gr.source_bildnr = t232.bildnr::int
         AND gr.source_dlnr = t232.dlnr::int
        WHERE p.piece_display = true
          AND sr.source_dlnr = %s
          AND t232.bildnr IS NOT NULL AND t232.bildnr != ''
          AND gr.bildname IS NOT NULL AND gr.bildname != ''
        ON CONFLICT DO NOTHING
        """, (dlnr,))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        return ('error', dlnr, str(e)[:200])
    finally:
        cur.close()
        conn.close()


# ============ P4: Article Criteria (t210 → pieces_criteria) ============

def project_criteria_dlnr(dlnr):
    """Project technical criteria for one DLNR — scope-limited."""
    conn = get_conn(600)
    cur = conn.cursor()
    try:
        cur.execute("""
        INSERT INTO pieces_criteria (pc_piece_id, pc_piece_id_i, pc_pg_pid, pc_pg_id, pc_ga_id, pc_cri_id, pc_cri_value, pc_has_txt, pc_display, pc_sort)
        SELECT DISTINCT ON (sp.piece_id, sp.piece_pg_id, t210.kritnr, t210.kritwert)
          sp.piece_id::text,
          sp.piece_id,
          sp.piece_pg_id::text,
          sp.piece_pg_id::text,
          '0',
          t210.kritnr,
          COALESCE(t210.kritwert, ''),
          '0',
          '1',
          COALESCE(t210.sortnr, '1')
        FROM tecdoc_map.v_projection_scope_pieces sp
        JOIN tecdoc_raw.t210 t210 ON t210.artnr = sp.source_artnr AND t210.dlnr = sp.source_dlnr::text
        WHERE sp.source_dlnr = %s
          AND t210.losch_flag != '1'
          AND t210.kritnr IS NOT NULL
        ON CONFLICT (pc_piece_id, pc_pg_pid, pc_cri_id, pc_cri_value) DO NOTHING
        """, (dlnr,))
        return ('ok', dlnr, cur.rowcount)
    except Exception as e:
        return ('error', dlnr, str(e)[:200])
    finally:
        cur.close()
        conn.close()


# ============ Runner ============

def run_phase(name, func, dlnrs, workers, dry_run=False):
    """Run a projection phase across all DLNR."""
    log(f"\n--- {name} ({len(dlnrs)} DLNR, {workers} workers) ---")

    if dry_run:
        log(f"  DRY-RUN: would project {name} for {len(dlnrs)} DLNR")
        return 0

    t0 = time.time()
    total = 0
    errors = 0

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(func, dlnr): dlnr for dlnr in dlnrs}

        completed = 0
        for future in as_completed(futures):
            result = future.result()
            completed += 1
            if result[0] == 'ok':
                total += result[2]
                if completed % 20 == 0 or completed == len(dlnrs):
                    elapsed = time.time() - t0
                    log(f"  Progress: {completed}/{len(dlnrs)} "
                        f"(+{total:,} rows, {errors} errors, {elapsed:.0f}s)")
            else:
                errors += 1
                log(f"  ERROR DLNR={result[1]}: {result[2]}")

    elapsed = time.time() - t0
    log(f"  DONE {name}: +{total:,} rows, {errors} errors ({elapsed:.0f}s)")
    return total


def main():
    parser = argparse.ArgumentParser(description='Projection sélective — enrichissement catalogue')
    parser.add_argument('--dry-run', action='store_true', help='Compter seulement')
    parser.add_argument('--oem', action='store_true', help='P1: OEM references')
    parser.add_argument('--refs', action='store_true', help='P2: Search references')
    parser.add_argument('--images', action='store_true', help='P3: Images')
    parser.add_argument('--criteria', action='store_true', help='P4: Article criteria')
    parser.add_argument('--all', action='store_true', help='Toutes les phases')
    parser.add_argument('--workers', type=int, default=4, help='Workers parallèles')
    args = parser.parse_args()

    if not any([args.oem, args.refs, args.images, args.criteria, args.all, args.dry_run]):
        parser.print_help()
        sys.exit(1)

    log("=== Projection sélective — enrichissement catalogue ===")
    log(f"  Mode: {'DRY-RUN' if args.dry_run else 'EXECUTE'}")
    log(f"  Scope: fournisseurs actifs + pièces year=2025 + linkages établis")

    dlnrs = get_active_dlnrs()
    log(f"  DLNR actifs: {len(dlnrs)}")

    results = {}

    if args.oem or args.all:
        results['oem'] = run_phase('P1: OEM refs (t203→pieces_ref_oem)',
                                    project_oem_dlnr, dlnrs, args.workers, args.dry_run)

    if args.refs or args.all:
        results['refs'] = run_phase('P2: Search refs (t207/t209→pieces_ref_search)',
                                    project_refs_dlnr, dlnrs, args.workers, args.dry_run)

    if args.images or args.all:
        # Canonique : scope elargi via article_registry (109 DLNR au lieu de 105)
        image_dlnrs = get_image_projection_dlnrs()
        log(f"  DLNR images (article_registry scope): {len(image_dlnrs)}")
        results['images'] = run_phase('P3: Images (t232→pieces_media_img)',
                                      project_images_dlnr, image_dlnrs, args.workers, args.dry_run)

    if args.criteria or args.all:
        results['criteria'] = run_phase('P4: Criteria (t210→pieces_criteria)',
                                        project_criteria_dlnr, dlnrs, args.workers, args.dry_run)

    log(f"\n=== BILAN ===")
    for phase, count in results.items():
        log(f"  {phase}: +{count:,}")
    log(f"  Total: +{sum(results.values()):,}")


if __name__ == '__main__':
    main()
