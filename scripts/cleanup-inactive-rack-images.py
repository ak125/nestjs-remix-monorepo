#!/usr/bin/env python3
"""
Cleanup rack-images from inactive suppliers.

Deletes files in rack-images bucket for folders NOT associated
with any displayed product (piece_display = '1').

Usage:
  python3 cleanup-inactive-rack-images.py --dry-run   # Preview only
  python3 cleanup-inactive-rack-images.py --commit     # Actually delete

Safety:
  - Queries DB to determine active folders at runtime
  - Processes one folder at a time
  - Batch delete of 500 files per API call
  - Logs every deletion
  - Dry-run by default
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    print("pip install supabase required")
    sys.exit(1)

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "rack-images"
BATCH_SIZE = 500
LOG_DIR = Path(__file__).parent / "logs"

if not SUPABASE_KEY:
    # Try loading from backend/.env
    env_path = Path(__file__).parent.parent / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                SUPABASE_KEY = line.split("=", 1)[1].strip()

if not SUPABASE_KEY:
    print("ERROR: SUPABASE_SERVICE_ROLE_KEY not found")
    sys.exit(1)

# --- Logging ---
LOG_DIR.mkdir(exist_ok=True)
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = LOG_DIR / f"cleanup-rack-images-{timestamp}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def get_active_folders(supabase) -> set:
    """Get folders that have at least 1 displayed product."""
    result = supabase.rpc("get_active_image_folders", {}).execute()
    if result.data:
        return {str(row["folder"]) for row in result.data}

    # Fallback: direct query
    logger.warning("RPC not found, using direct query (slower)")
    result = supabase.from_("pieces_media_img").select(
        "pmi_folder"
    ).neq("pmi_folder", None).execute()

    # This won't work well for large tables, so use SQL via postgrest
    # Instead, hardcode the active folders from our audit
    return None


def get_active_folders_sql(supabase) -> set:
    """Get active folders via raw SQL through postgrest."""
    import requests
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    # Use the RPC endpoint to run a query
    url = f"{SUPABASE_URL}/rest/v1/rpc/get_active_image_folders"
    resp = requests.post(url, headers=headers, json={})
    if resp.status_code == 200:
        return {str(row["folder"]) for row in resp.json()}
    return None


def list_folder_files(supabase, folder: str, offset: int = 0) -> list:
    """List files in a specific folder of the bucket."""
    result = supabase.storage.from_(BUCKET).list(
        folder,
        {"limit": 1000, "offset": offset}
    )
    return result


def delete_files(supabase, paths: list) -> dict:
    """Delete a batch of files from the bucket."""
    result = supabase.storage.from_(BUCKET).remove(paths)
    return result


def process_folder(supabase, folder: str, dry_run: bool) -> dict:
    """Process a single folder: list all files and delete them."""
    stats = {"files_found": 0, "files_deleted": 0, "errors": 0}
    offset = 0

    while True:
        files = list_folder_files(supabase, folder, offset)
        if not files:
            break

        stats["files_found"] += len(files)
        paths = [f"{folder}/{f['name']}" for f in files]

        if dry_run:
            logger.info(f"  [DRY-RUN] Would delete {len(paths)} files from {folder}/ (offset {offset})")
        else:
            # Delete in sub-batches
            for i in range(0, len(paths), BATCH_SIZE):
                batch = paths[i:i + BATCH_SIZE]
                try:
                    delete_files(supabase, batch)
                    stats["files_deleted"] += len(batch)
                    logger.info(f"  Deleted {len(batch)} files from {folder}/ (total: {stats['files_deleted']})")
                except Exception as e:
                    stats["errors"] += 1
                    logger.error(f"  Error deleting batch in {folder}/: {e}")
                time.sleep(0.2)  # Rate limit protection

        if len(files) < 1000:
            break
        offset += 1000
        time.sleep(0.1)

    return stats


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Cleanup inactive rack-images")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Preview only (default)")
    parser.add_argument("--commit", action="store_true", help="Actually delete files")
    args = parser.parse_args()

    dry_run = not args.commit
    mode = "DRY-RUN" if dry_run else "COMMIT"

    logger.info(f"=== Cleanup inactive rack-images [{mode}] ===")
    logger.info(f"Log file: {log_file}")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Step 1: Get active folders from DB
    logger.info("Fetching active folders from DB...")
    active_folders = get_active_folders_sql(supabase)

    if not active_folders:
        # Hardcoded from our audit (2026-03-28)
        logger.warning("Using hardcoded active folders from audit")
        active_folders = {
            "10", "101", "123", "13", "134", "140", "159", "16", "161",
            "162", "205", "239", "249", "25", "260", "263", "267", "27",
            "28", "292", "3", "30", "33", "350", "36", "38", "387",
            "39", "393", "40", "408", "42", "43", "440", "449", "47",
            "48", "492", "499", "51", "52", "56", "57", "58", "6",
            "60", "62", "65", "7", "73", "76", "8", "83", "85",
            "86", "87", "88", "89", "9", "92", "99"
        }

    logger.info(f"Active folders: {len(active_folders)}")

    # Step 2: List all folders in storage
    logger.info("Listing storage folders...")
    all_items = supabase.storage.from_(BUCKET).list("", {"limit": 1000})
    all_folders = [item["name"] for item in all_items if item.get("id") is None or item.get("metadata") is None]

    # Filter to inactive folders
    inactive_folders = [f for f in all_folders if f not in active_folders]
    logger.info(f"Total folders: {len(all_folders)}, Inactive: {len(inactive_folders)}")

    if not inactive_folders:
        logger.info("No inactive folders found. Nothing to do.")
        return

    # Step 3: Process each inactive folder
    total_stats = {"files_found": 0, "files_deleted": 0, "errors": 0, "folders_processed": 0}

    for i, folder in enumerate(sorted(inactive_folders), 1):
        logger.info(f"[{i}/{len(inactive_folders)}] Processing folder {folder}/...")
        stats = process_folder(supabase, folder, dry_run)

        total_stats["files_found"] += stats["files_found"]
        total_stats["files_deleted"] += stats["files_deleted"]
        total_stats["errors"] += stats["errors"]
        total_stats["folders_processed"] += 1

        logger.info(f"  Folder {folder}: {stats['files_found']} files found, {stats['files_deleted']} deleted, {stats['errors']} errors")

    # Summary
    logger.info("=" * 60)
    logger.info(f"=== SUMMARY [{mode}] ===")
    logger.info(f"Folders processed: {total_stats['folders_processed']}")
    logger.info(f"Files found: {total_stats['files_found']}")
    logger.info(f"Files deleted: {total_stats['files_deleted']}")
    logger.info(f"Errors: {total_stats['errors']}")
    logger.info(f"Log: {log_file}")

    # Save summary JSON
    summary_file = LOG_DIR / f"cleanup-rack-images-{timestamp}-summary.json"
    with open(summary_file, "w") as f:
        json.dump({
            "mode": mode,
            "timestamp": timestamp,
            "active_folders": sorted(active_folders),
            "inactive_folders": sorted(inactive_folders),
            "stats": total_stats
        }, f, indent=2)
    logger.info(f"Summary: {summary_file}")


if __name__ == "__main__":
    main()
