#!/usr/bin/env python3
"""
Activate pieces Vague 1 — controlled activation with full logging.

Activates pieces from v_tecdoc_activation_candidates by gamme (pg_alias).
Logs every batch to tecdoc_map.activation_log.

Usage:
  python3 activate-pieces-v1.py --dry-run                          # Count all gammes
  python3 activate-pieces-v1.py --dry-run --gammes amortisseur     # Count specific gammes
  python3 activate-pieces-v1.py --execute --gammes amortisseur filtre-a-huile
  python3 activate-pieces-v1.py --execute --all                    # All gammes (USE WITH CAUTION)
"""
import psycopg2, time, sys, argparse, json, uuid

def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')

PW = get_pw()

def get_conn():
    """Direct connection port 5432 for writes."""
    conn = psycopg2.connect(
        host='db.cxpojprgwgubzjyqzmoq.supabase.co', port=5432,
        user='postgres', password=PW, dbname='postgres')
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SET statement_timeout = '300s'")
    cur.close()
    return conn

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{ts}] {msg}", flush=True)


def get_gamme_candidates(cur, pg_alias=None):
    """Get activation candidates grouped by gamme."""
    if pg_alias:
        cur.execute("""
        SELECT pg_alias, count(*) as nb,
          count(*) FILTER (WHERE has_image) as with_image,
          round(avg(nb_linkages)) as avg_link
        FROM v_tecdoc_activation_candidates
        WHERE pg_alias = ANY(%s)
        GROUP BY pg_alias ORDER BY nb DESC
        """, (pg_alias,))
    else:
        cur.execute("""
        SELECT pg_alias, count(*) as nb,
          count(*) FILTER (WHERE has_image) as with_image,
          round(avg(nb_linkages)) as avg_link
        FROM v_tecdoc_activation_candidates
        GROUP BY pg_alias ORDER BY nb DESC
        """)
    return cur.fetchall()


def activate_gamme(cur, pg_alias, wave=1, dry_run=True):
    """Activate all candidate pieces for a given gamme."""
    batch_id = str(uuid.uuid4())

    # Get candidate piece_ids
    cur.execute("""
    SELECT piece_id FROM v_tecdoc_activation_candidates
    WHERE pg_alias = %s
    """, (pg_alias,))
    candidates = [r[0] for r in cur.fetchall()]
    candidates_count = len(candidates)

    if candidates_count == 0:
        log(f"  {pg_alias}: 0 candidates, skipping")
        return 0

    if dry_run:
        # Count by supplier
        cur.execute("""
        SELECT pm_name, count(*) as nb
        FROM v_tecdoc_activation_candidates
        WHERE pg_alias = %s
        GROUP BY pm_name ORDER BY nb DESC LIMIT 5
        """, (pg_alias,))
        top_suppliers = cur.fetchall()
        suppliers_str = ', '.join(f"{s[0]}({s[1]})" for s in top_suppliers)
        log(f"  DRY-RUN {pg_alias}: {candidates_count} candidates — {suppliers_str}")
        return candidates_count

    # Execute activation in chunks
    activated = 0
    chunk_size = 1000
    rejection_reasons = {}

    for i in range(0, len(candidates), chunk_size):
        chunk = candidates[i:i+chunk_size]
        cur.execute("""
        UPDATE pieces SET piece_display = true
        WHERE piece_id = ANY(%s)
          AND piece_display = false
          AND piece_year = 2025
        """, (chunk,))
        activated += cur.rowcount

    rejected = candidates_count - activated
    if rejected > 0:
        rejection_reasons['already_active_or_wrong_year'] = rejected

    # Log to activation_log
    cur.execute("""
    INSERT INTO tecdoc_map.activation_log
      (batch_id, wave, pg_alias, candidates_count, activated_count, rejected_count, rejection_reasons)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (batch_id, wave, pg_alias, candidates_count, activated, rejected,
          json.dumps(rejection_reasons)))

    log(f"  ACTIVATED {pg_alias}: {activated}/{candidates_count} (rejected: {rejected})")
    return activated


def post_activation_report(cur):
    """Generate post-activation mini-report."""
    cur.execute("""
    SELECT pg_alias, candidates_count, activated_count, rejected_count, rejection_reasons
    FROM tecdoc_map.activation_log
    WHERE wave = 1
    ORDER BY created_at DESC
    LIMIT 20
    """)
    rows = cur.fetchall()
    if not rows:
        log("  No activation records found")
        return

    total_candidates = sum(r[1] for r in rows)
    total_activated = sum(r[2] for r in rows)
    total_rejected = sum(r[3] for r in rows)

    log(f"\n=== POST-ACTIVATION REPORT (Vague 1) ===")
    log(f"  Gammes: {len(rows)}")
    log(f"  Candidates: {total_candidates}")
    log(f"  Activated: {total_activated}")
    log(f"  Rejected: {total_rejected}")
    log(f"  Success rate: {total_activated/total_candidates*100:.1f}%" if total_candidates > 0 else "  N/A")

    for pg, cand, act, rej, reasons in rows:
        status = '✅' if rej == 0 else f'⚠️ {rej} rejected'
        log(f"    {pg}: {act}/{cand} {status}")


def main():
    parser = argparse.ArgumentParser(description='Activate pieces Vague 1')
    parser.add_argument('--dry-run', action='store_true', help='Count only, no writes')
    parser.add_argument('--execute', action='store_true', help='Activate pieces')
    parser.add_argument('--gammes', nargs='+', help='Specific gammes to activate')
    parser.add_argument('--all', action='store_true', help='All gammes (use with caution)')
    parser.add_argument('--analyze', action='store_true', help='Run ANALYZE + refresh after activation')
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        parser.print_help()
        sys.exit(1)

    if args.execute and not args.gammes and not args.all:
        log("ERROR: --execute requires --gammes or --all")
        sys.exit(1)

    conn = get_conn()
    cur = conn.cursor()

    log("=== Activate Pieces Vague 1 ===")
    log(f"  Mode: {'DRY-RUN' if args.dry_run else 'EXECUTE'}")

    # Get candidates
    gamme_filter = args.gammes if args.gammes else None
    gammes = get_gamme_candidates(cur, gamme_filter)

    log(f"  Gammes: {len(gammes)}, Total candidates: {sum(g[1] for g in gammes)}")
    log("")

    if args.dry_run:
        for pg_alias, nb, with_img, avg_link in gammes:
            img_pct = f"{with_img/nb*100:.0f}%" if nb > 0 else "0%"
            log(f"  {pg_alias}: {nb} pieces, {img_pct} with image, avg {avg_link} linkages")
        log(f"\n  TOTAL: {sum(g[1] for g in gammes)} candidates across {len(gammes)} gammes")
        cur.close()
        conn.close()
        return

    # Execute activation
    total_activated = 0
    for pg_alias, nb, with_img, avg_link in gammes:
        activated = activate_gamme(cur, pg_alias, wave=1, dry_run=False)
        total_activated += activated

    log(f"\n  TOTAL ACTIVATED: {total_activated}")

    # Post-activation report
    post_activation_report(cur)

    # Optional ANALYZE + refresh
    if args.analyze:
        log("\n--- Post-activation: ANALYZE + refresh ---")
        cur.execute("ANALYZE pieces")
        log("  ANALYZE pieces ✓")
        cur.execute("SELECT refresh_gamme_aggregates(NULL)")
        log("  refresh_gamme_aggregates ✓")

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
