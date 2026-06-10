#!/usr/bin/env python3
"""
Rack-images metadata rebuild (GO-3 staged insert + GO-4 flip) for any brand.
INC-2026-015. Reads the ingester manifest (scripts/logs/recover-manifest-pm<pm>.csv),
rebuilds pieces_media_img. Parametré : --pm-id / --folder / --date.

Steps (idempotent, transactional, reversible):
  --stage           : staging table from manifest CSV + INSERT new rows (pmi_display='0').
  --flip            : 1 tx — soft-hide legacy rows (no storage object) + turn new rows on.
  --sellable-rescope: hide new images of NON-sellable pieces (cardinal rule 0 ; one-off if
                      the ingester ran without --sellable-only).

Backup table must already exist (created separately, GO-3 5a).
Scope is ALWAYS via JOIN pieces (p.piece_pm_id=<pm>), never m.pmi_pm_id (inconsistent).
Worked instance: MECAFILTER pm 3040 / folder 218 / 2026-06-10.
"""
import argparse
import csv
import os
import sys

import psycopg2
from psycopg2.extras import execute_values

# Populated by main() from CLI args.
PM_ID = None
FOLDER = None
STAGING = None
FLIPS = None
BACKUP = None
MANIFEST = None


def conn():
    pw = os.environ.get("SUPABASE_DB_PASSWORD")
    if not pw:
        for cand in ("../../backend/.env", "/opt/automecanik/app/backend/.env"):
            p = os.path.join(os.path.dirname(__file__), cand) if cand.startswith("..") else cand
            if os.path.exists(p):
                for line in open(p):
                    if line.startswith("SUPABASE_DB_PASSWORD="):
                        pw = line.strip().split("=", 1)[1]
                break
    if not pw:
        sys.exit("ABORT: SUPABASE_DB_PASSWORD introuvable (env ou backend/.env).")
    return psycopg2.connect(
        host="aws-0-eu-west-3.pooler.supabase.com", port="6543",
        user="postgres.cxpojprgwgubzjyqzmoq", password=pw, dbname="postgres",
    )


def stage(c):
    rows = []
    seen = set()
    for r in csv.DictReader(open(MANIFEST)):
        if r["status"] in ("uploaded", "uploaded_dup") and r["image_name"] and r["piece_id"]:
            key = (r["piece_id"], r["image_name"])
            if key in seen:
                continue
            seen.add(key)
            rows.append((int(r["piece_id"]), r["image_name"]))
    cur = c.cursor()
    cur.execute(f"DROP TABLE IF EXISTS {STAGING}")
    cur.execute(f"CREATE TABLE {STAGING} (piece_id bigint, image_name text, PRIMARY KEY (piece_id, image_name))")
    execute_values(cur, f"INSERT INTO {STAGING} (piece_id, image_name) VALUES %s ON CONFLICT DO NOTHING", rows)
    c.commit()
    cur.execute(f"SELECT count(*), count(DISTINCT piece_id), count(DISTINCT image_name) FROM {STAGING}")
    n, npiece, nimg = cur.fetchone()
    print(f"[stage] manifest chargé: {n} liens · {npiece} pièces · {nimg} images uniques")

    # guard: backup must exist before any pieces_media_img write
    cur.execute("SELECT to_regclass(%s)", (BACKUP,))
    if cur.fetchone()[0] is None:
        sys.exit(f"ABORT: backup {BACKUP} absent — créer le backup avant l'INSERT.")

    # staged insert: display='0' (invisible), only where the storage object actually exists
    cur.execute(f"""
        INSERT INTO pieces_media_img
          (pmi_piece_id, pmi_pm_id, pmi_folder, pmi_name, pmi_sort, pmi_display, pmi_piece_id_i)
        SELECT s.piece_id::text, '{PM_ID}', '{FOLDER}', s.image_name,
               (row_number() OVER (PARTITION BY s.piece_id ORDER BY s.image_name))::text,
               '0', s.piece_id
        FROM {STAGING} s
        JOIN storage.objects o
          ON o.bucket_id='rack-images' AND o.name = '{FOLDER}/' || s.image_name
        ON CONFLICT (pmi_piece_id, pmi_name) DO NOTHING
    """)
    inserted = cur.rowcount
    c.commit()
    cur.execute(f"""
        SELECT count(*) FROM pieces_media_img m
        JOIN {STAGING} s ON m.pmi_piece_id = s.piece_id::text AND m.pmi_name = s.image_name
        WHERE m.pmi_pm_id='{PM_ID}'
    """)
    present = cur.fetchone()[0]
    print(f"[stage] INSERT pieces_media_img (display=0): +{inserted} ; lignes nouvelles présentes: {present}")
    print("[stage] OK — rien n'est visible (display=0). Vérifier puis --flip.")


def flip(c):
    cur = c.cursor()
    cur.execute(f"SELECT to_regclass(%s)", (STAGING,))
    if cur.fetchone()[0] is None:
        sys.exit("ABORT: staging absent — lancer --stage d'abord.")
    cur.execute("BEGIN")
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {FLIPS}
          (pmi_piece_id text, pmi_name text, direction text,
           flipped_at timestamptz DEFAULT now(), PRIMARY KEY (pmi_piece_id, pmi_name))
    """)
    # (1) legacy soft-hide: displayed rows whose storage object does NOT exist (both tranches)
    cur.execute(f"""
        WITH legacy AS (
          SELECT m.pmi_piece_id, m.pmi_name
          FROM pieces_media_img m
          JOIN pieces p ON p.piece_id = m.pmi_piece_id_i AND p.piece_pm_id = {PM_ID}
          WHERE m.pmi_display='1'
            AND NOT EXISTS (SELECT 1 FROM storage.objects o
                            WHERE o.bucket_id='rack-images'
                              AND o.name = m.pmi_folder || '/' || m.pmi_name)
        )
        INSERT INTO {FLIPS} (pmi_piece_id, pmi_name, direction)
        SELECT pmi_piece_id, pmi_name, 'legacy_1_to_0' FROM legacy
        ON CONFLICT DO NOTHING
    """)
    cur.execute(f"""
        UPDATE pieces_media_img m SET pmi_display='0'
        FROM {FLIPS} f
        WHERE f.direction='legacy_1_to_0' AND m.pmi_piece_id=f.pmi_piece_id
          AND m.pmi_name=f.pmi_name AND m.pmi_display='1'
    """)
    hidden = cur.rowcount
    # (2) new rows visible
    cur.execute(f"""
        UPDATE pieces_media_img m SET pmi_display='1'
        FROM {STAGING} s
        WHERE m.pmi_piece_id=s.piece_id::text AND m.pmi_name=s.image_name
          AND m.pmi_pm_id='{PM_ID}' AND m.pmi_display='0'
    """)
    shown = cur.rowcount
    c.commit()
    print(f"[flip] legacy soft-hidden: {hidden} ; nouvelles lignes visibles: {shown}")


def sellable_rescope(c):
    """Hide new images of NON-sellable pieces (runbook cardinal rule 0).

    Used once for MECAFILTER because the first run predated --sellable-only.
    Going forward, run the ingester with --sellable-only and this is unnecessary."""
    cur = c.cursor()
    cur.execute(f"""
        WITH nonsellable_new AS (
          SELECT m.pmi_piece_id, m.pmi_name
          FROM pieces_media_img m
          JOIN pieces p ON p.piece_id = m.pmi_piece_id_i AND p.piece_pm_id = {PM_ID}
          WHERE m.pmi_display='1' AND m.pmi_pm_id='{PM_ID}' AND m.pmi_name ~ '\\.jpg$'
            AND NOT EXISTS (SELECT 1 FROM pieces_price pr
                            WHERE pr.pri_piece_id_i = p.piece_id AND pr.pri_dispo IN ('1','2','3'))
        )
        INSERT INTO {FLIPS} (pmi_piece_id, pmi_name, direction)
        SELECT pmi_piece_id, pmi_name, 'nonsellable_1_to_0' FROM nonsellable_new
        ON CONFLICT DO NOTHING
    """)
    cur.execute(f"""
        UPDATE pieces_media_img m SET pmi_display='0'
        FROM {FLIPS} f
        WHERE f.direction='nonsellable_1_to_0' AND m.pmi_piece_id=f.pmi_piece_id
          AND m.pmi_name=f.pmi_name AND m.pmi_display='1'
    """)
    hidden = cur.rowcount
    c.commit()
    print(f"[rescope] images non-vendables masquées: {hidden}")


def main():
    global PM_ID, FOLDER, STAGING, FLIPS, BACKUP, MANIFEST
    ap = argparse.ArgumentParser()
    ap.add_argument("--pm-id", type=int, required=True)
    ap.add_argument("--folder", required=True)
    ap.add_argument("--date", required=True, help="suffixe table, ex. 20260610")
    ap.add_argument("--stage", action="store_true")
    ap.add_argument("--flip", action="store_true")
    ap.add_argument("--sellable-rescope", action="store_true",
                    help="masque les images des pièces non vendables (one-off si ingester sans --sellable-only)")
    a = ap.parse_args()
    if not (a.stage or a.flip or a.sellable_rescope):
        sys.exit("préciser --stage, --flip ou --sellable-rescope")
    PM_ID = a.pm_id
    FOLDER = a.folder
    STAGING = f"pieces_media_img_recover_manifest_pm{PM_ID}_{a.date}"
    FLIPS = f"pieces_media_img_recover_flips_pm{PM_ID}_{a.date}"
    BACKUP = f"pieces_media_img_backup_pm{PM_ID}_{a.date}"
    MANIFEST = os.path.join(os.path.dirname(__file__), "..", "logs", f"recover-manifest-pm{PM_ID}.csv")
    c = conn()
    try:
        if a.stage:
            stage(c)
        if a.flip:
            flip(c)
        if a.sellable_rescope:
            sellable_rescope(c)
    finally:
        c.close()


if __name__ == "__main__":
    main()
