#!/usr/bin/env python3
"""
Recovery script: telecharge les images manquantes depuis le CDN TecAlliance public.

Etape 1: Via Playwright, recherche chaque article sur le catalogue TecDoc
         et capture les URLs d'images du CDN digital-assets.tecalliance.services
Etape 2: Telecharge les images depuis le CDN public (sans auth)
Etape 3: Re-uploade vers Supabase Storage

Usage:
  python3 recover-tecdoc-images.py --dlnr 86 --dry-run     # Test sur 1 fournisseur
  python3 recover-tecdoc-images.py --dlnr 86 --commit       # Execution reelle
  python3 recover-tecdoc-images.py --all --commit            # Tous les fournisseurs

Securite:
  - Rythme humain : 5-10 secondes entre chaque recherche
  - CDN public pour le telechargement (pas d'auth)
  - Progression sauvegardee pour reprise
"""

import asyncio
import os
import sys
import json
import time
import random
import logging
import hashlib
from datetime import datetime
from pathlib import Path
from io import BytesIO

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("pip install playwright required")
    sys.exit(1)

try:
    from supabase import create_client
    import requests
except ImportError:
    print("pip install supabase requests required")
    sys.exit(1)

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "rack-images"
# [EXPURGE 2026-09-07 a la recuperation] Le fichier d'origine portait ici les
# identifiants du portail TecDoc en clair. Ils sont retires : ce depot ne doit pas
# les recevoir. Meme idiome que SUPABASE_KEY ci-dessus (env, puis backend/.env).
# Le mot de passe d'origine DOIT etre considere comme compromis et tourne.
TECDOC_EMAIL = os.environ.get("TECDOC_EMAIL", "")
TECDOC_PASS = os.environ.get("TECDOC_PASS", "")
CDN_BASE = "https://digital-assets.tecalliance.services/images"
LOG_DIR = Path(__file__).parent / "logs"
PROGRESS_FILE = LOG_DIR / "recover-images-progress.json"

# Rate limits (secondes)
SEARCH_DELAY_MIN = 5
SEARCH_DELAY_MAX = 10
DOWNLOAD_DELAY = 0.5

if not SUPABASE_KEY:
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
log_file = LOG_DIR / f"recover-images-{timestamp}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)


def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"recovered": {}, "failed": {}, "cdn_mappings": {}}


def save_progress(progress):
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2))


def get_missing_images(dlnr: str) -> list:
    """Recupere la liste des images manquantes pour un DLNR depuis la DB."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }

    # Utiliser une RPC ou requete directe
    # On doit faire le cross-ref manuellement via PostgREST
    # D'abord recuperer tous les pmi_name actifs pour ce folder
    all_names = set()
    offset = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/pieces_media_img"
            f"?pmi_folder=eq.{dlnr}"
            f"&select=pmi_name,pmi_piece_id"
            f"&limit=1000&offset={offset}"
        )
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200 or not resp.json():
            break

        rows = resp.json()
        # Verifier quels pieces sont actifs
        piece_ids = list({r["pmi_piece_id"] for r in rows})
        active_ids = set()
        for i in range(0, len(piece_ids), 200):
            batch = piece_ids[i:i+200]
            ids_str = ",".join(str(pid) for pid in batch)
            p_url = f"{SUPABASE_URL}/rest/v1/pieces?piece_id=in.({ids_str})&piece_display=eq.true&select=piece_id"
            p_resp = requests.get(p_url, headers=headers)
            if p_resp.status_code == 200:
                for p in p_resp.json():
                    active_ids.add(str(p["piece_id"]))

        for r in rows:
            if str(r.get("pmi_piece_id", "")) in active_ids:
                all_names.add(r["pmi_name"])

        if len(rows) < 1000:
            break
        offset += 1000

    # Verifier lesquels manquent dans Storage
    missing = []
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Lister les fichiers existants dans le folder
    existing = set()
    list_offset = 0
    while True:
        files = supabase.storage.from_(BUCKET).list(dlnr, {"limit": 1000, "offset": list_offset})
        if not files:
            break
        for f in files:
            existing.add(f["name"])
        if len(files) < 1000:
            break
        list_offset += 1000

    # Recuperer aussi le piece_ref pour chaque pmi_name (la vraie ref TecDoc)
    name_to_ref = {}
    offset2 = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/pieces_media_img"
            f"?pmi_folder=eq.{dlnr}"
            f"&select=pmi_name,pmi_piece_id"
            f"&limit=1000&offset={offset2}"
        )
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200 or not resp.json():
            break
        rows = resp.json()
        piece_ids_batch = list({r["pmi_piece_id"] for r in rows})
        # Recuperer les piece_ref pour ces piece_ids
        for i in range(0, len(piece_ids_batch), 200):
            batch = piece_ids_batch[i:i+200]
            ids_str = ",".join(str(pid) for pid in batch)
            p_url = f"{SUPABASE_URL}/rest/v1/pieces?piece_id=in.({ids_str})&select=piece_id,piece_ref"
            p_resp = requests.get(p_url, headers=headers)
            if p_resp.status_code == 200:
                for p in p_resp.json():
                    for r in rows:
                        if str(r.get("pmi_piece_id","")) == str(p["piece_id"]):
                            name_to_ref[r["pmi_name"]] = p.get("piece_ref", "")
        if len(rows) < 1000:
            break
        offset2 += 1000

    for name in all_names:
        if name not in existing:
            # Utiliser piece_ref (la vraie reference TecDoc) pour la recherche
            artnr = name_to_ref.get(name, "")
            if not artnr:
                # Fallback: extraire depuis le nom de fichier
                artnr = name.rsplit("_", 1)[0] if "_" in name else name.rsplit(".", 1)[0]
            missing.append({"pmi_name": name, "artnr": artnr})

    return missing


async def login_tecdoc(page):
    """Se connecter au catalogue TecDoc."""
    await page.goto('https://web.tecalliance.net/tecdoc/fr/home', wait_until='networkidle', timeout=45000)

    if 'login' in page.url:
        await page.wait_for_selector('input[name="identifier"]', timeout=10000)
        await page.fill('input[name="identifier"]', TECDOC_EMAIL)
        await page.wait_for_timeout(500)
        await page.click('input[type="submit"]')
        await page.wait_for_timeout(3000)
        await page.wait_for_selector('input[name="credentials.passcode"]', timeout=10000)
        await page.fill('input[name="credentials.passcode"]', TECDOC_PASS)
        await page.wait_for_timeout(500)
        await page.click('input[type="submit"]')
        await page.wait_for_timeout(10000)

    return 'login' not in page.url


async def search_article_images(page, artnr: str, dlnr: str) -> list:
    """Recherche un article via API Pegasus et extrait le mapping fileName → CDN URL pour le bon DLNR.

    Retourne une liste de dicts: [{"fileName": "ZS177_1501700.JPG", "url": "https://...800/hash.jpg"}, ...]
    """
    matched = []

    async def on_response(response):
        url = response.url
        if 'pegasus' in url and 'TecdocToCat' in url:
            try:
                body = await response.json()
                if 'articles' in body:
                    for art in body['articles']:
                        if str(art.get('dataSupplierId', '')) == str(dlnr):
                            for img in art.get('images', []):
                                fn = img.get('fileName', '')
                                cdn_url = (img.get('imageURL1600') or img.get('imageURL800')
                                          or img.get('imageURL400') or img.get('imageURL200', ''))
                                if fn and cdn_url:
                                    matched.append({"fileName": fn, "url": cdn_url})
            except:
                pass

    page.on('response', on_response)

    try:
        search = page.locator('input[placeholder="Recherche par numéro quelconque"]')
        await search.clear()
        await search.fill(artnr.strip())
        await page.wait_for_timeout(300)
        await search.press('Enter')
        await page.wait_for_timeout(6000)
    except Exception as e:
        logger.warning(f"  Search error for {artnr}: {e}")
    finally:
        page.remove_listener('response', on_response)

    return matched


def download_from_cdn(url: str) -> bytes | None:
    """Telecharge une image depuis le CDN public TecAlliance."""
    try:
        # Prendre la version 800px (meilleure qualite)
        url_800 = url.replace('/images/100/', '/images/800/').replace('/images/200/', '/images/800/').replace('/images/400/', '/images/800/')
        resp = requests.get(url_800, timeout=30)
        if resp.status_code == 200 and 'image' in resp.headers.get('content-type', ''):
            return resp.content
        # Fallback sur l'URL originale
        resp = requests.get(url, timeout=30)
        if resp.status_code == 200:
            return resp.content
    except Exception as e:
        logger.error(f"  CDN download error: {e}")
    return None


def upload_to_supabase(supabase, dlnr: str, filename: str, data: bytes) -> bool:
    """Uploade une image vers Supabase Storage."""
    try:
        path = f"{dlnr}/{filename}"
        content_type = 'image/jpeg' if filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg') else 'image/png'
        supabase.storage.from_(BUCKET).upload(path, data, {"content-type": content_type})
        return True
    except Exception as e:
        if "already exists" in str(e).lower() or "Duplicate" in str(e):
            return True
        logger.error(f"  Upload error {dlnr}/{filename}: {e}")
        return False


async def recover_dlnr(dlnr: str, dry_run: bool = True):
    """Recupere les images manquantes pour un DLNR."""
    logger.info(f"=== Recovery DLNR {dlnr} ===")

    progress = load_progress()

    # 1. Obtenir la liste des images manquantes
    logger.info(f"  Getting missing images for DLNR {dlnr}...")
    missing = get_missing_images(dlnr)
    logger.info(f"  Missing images: {len(missing)}")

    if not missing:
        logger.info(f"  Nothing to recover for DLNR {dlnr}")
        return {"recovered": 0, "failed": 0}

    # Filtrer les deja recuperes
    recovered_key = f"{dlnr}"
    already_done = set(progress.get("recovered", {}).get(recovered_key, []))
    missing = [m for m in missing if m["pmi_name"] not in already_done]
    logger.info(f"  After filtering already recovered: {len(missing)}")

    if dry_run:
        logger.info(f"  [DRY-RUN] Would attempt to recover {len(missing)} images")
        for m in missing[:5]:
            logger.info(f"    {dlnr}/{m['pmi_name']} (ARTNR: {m['artnr']})")
        return {"recovered": 0, "failed": 0}

    # 2. Lancer Playwright pour obtenir les URLs
    stats = {"recovered": 0, "failed": 0}
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        )
        page = await context.new_page()

        # Login
        logger.info("  Logging in to TecDoc...")
        if not await login_tecdoc(page):
            logger.error("  Login failed!")
            await browser.close()
            return stats
        logger.info("  Login OK")

        # Grouper par ARTNR unique (plusieurs images par article)
        artnr_to_files = {}
        for m in missing:
            artnr_to_files.setdefault(m["artnr"], []).append(m["pmi_name"])

        logger.info(f"  Unique articles to search: {len(artnr_to_files)}")

        for i, (artnr, filenames) in enumerate(artnr_to_files.items()):
            logger.info(f"  [{i+1}/{len(artnr_to_files)}] Searching ARTNR: {artnr} ({len(filenames)} images)...")

            # Rechercher l'article
            cdn_urls = await search_article_images(page, artnr, dlnr)

            if cdn_urls:
                logger.info(f"    Found {len(cdn_urls)} CDN images with fileName mapping")

                # Matcher les fileNames du CDN avec les pmi_name manquants
                for needed_file in filenames:
                    # Chercher un match exact dans les resultats API
                    cdn_match = next((m for m in cdn_urls if m["fileName"] == needed_file), None)
                    if cdn_match:
                        data = download_from_cdn(cdn_match["url"])
                        if data:
                            if upload_to_supabase(supabase, dlnr, needed_file, data):
                                stats["recovered"] += 1
                                if recovered_key not in progress.get("recovered", {}):
                                    progress.setdefault("recovered", {})[recovered_key] = []
                                progress["recovered"][recovered_key].append(needed_file)
                                logger.info(f"    OK: {dlnr}/{needed_file} ({len(data)} bytes)")
                            else:
                                stats["failed"] += 1
                        else:
                            stats["failed"] += 1
                        time.sleep(DOWNLOAD_DELAY)
                    else:
                        logger.warning(f"    No match for {needed_file} in API response")
                        stats["failed"] += 1
            else:
                logger.warning(f"    No CDN images found for ARTNR {artnr}")
                for fn in filenames:
                    stats["failed"] += 1

            # Sauvegarder progression regulierement
            if i % 10 == 0:
                save_progress(progress)

            # Delai humain entre les recherches
            delay = random.uniform(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX)
            await page.wait_for_timeout(int(delay * 1000))

        await browser.close()

    save_progress(progress)
    logger.info(f"  DONE DLNR {dlnr}: recovered={stats['recovered']}, failed={stats['failed']}")
    return stats


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Recover missing TecDoc images")
    parser.add_argument("--dlnr", type=str, help="Process a single DLNR")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()

    dry_run = not args.commit
    mode = "DRY-RUN" if dry_run else "COMMIT"

    logger.info(f"{'='*60}")
    logger.info(f"=== TecDoc Image Recovery [{mode}] ===")
    logger.info(f"{'='*60}")

    if args.dlnr:
        await recover_dlnr(args.dlnr, dry_run)
    else:
        # Traiter tous les DLNR impactes, du plus petit au plus grand
        dlnrs = ['86','67','95','83','6','11','38','31','4','113','159','15',
                 '114','42','43','39','33','16','134','110','10','85','65',
                 '3','140','62','89','123','101','13','30']
        for dlnr in dlnrs:
            await recover_dlnr(dlnr, dry_run)


if __name__ == "__main__":
    asyncio.run(main())
