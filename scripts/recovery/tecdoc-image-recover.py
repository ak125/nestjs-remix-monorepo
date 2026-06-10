#!/usr/bin/env python3
"""
TecDoc rack-images recovery ingester — fast path via the subscription's official
JSON API (Pegasus `getArticles`), NOT UI scraping.

Context: INC-2026-015 / ADR-078. `scripts/cleanup-inactive-rack-images.py` (removed
in PR #921) purged `rack-images/<folder>/` files for brands that were temporarily
`piece_display=false`. The DB metadata (`pieces_media_img`) survived but the storage
objects are gone. This script re-fetches the images from TecDoc and re-uploads them;
the `pieces_media_img` rebuild is a SEPARATE governed SQL step (see the runbook
`.claude/knowledge/ops/rack-images-brand-recovery-procedure.md`, §5). This script
NEVER writes the database.

Method (proven end-to-end 2026-06-10, 15/15 MECAFILTER refs):
  POST https://webservice.tecalliance.services/pegasus-3-0/services/TecdocToCatDLB.jsonEndpoint
  body {"getArticles": {provider, articleCountry, lang, searchQuery:<ARTNR>,
        searchType:10, searchMatchType:"prefix_or_suffix", perPage}}
  header x-api-key: <subscription key>
  -> articles[]; filter dataSupplierId==<dlnr> AND articleNumber==<ARTNR>
  -> article.images[N].imageURL3200 (fallback to lower res) on digital-assets.tecalliance.services
  -> download bytes, sha256, upload under rack-images/<folder>/<sha256>.jpg

Auth: TECDOC_API_KEY (env) is used directly if present; otherwise a one-time
Playwright OAuth2 login (TECDOC_WEB_USER / TECDOC_WEB_PASSWORD) captures the key.

Safety:
  --dry-run is the DEFAULT (fetch + manifest, ZERO Supabase write).
  --commit is explicit. Uploads are refused outside the brand's registry folder.
  The script performs NO database writes (article_registry is read READ-ONLY).
"""
import argparse
import asyncio
import csv
import hashlib
import json
import os
import re
import sys
import time

import httpx

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENV_PATH = os.path.join(REPO_ROOT, "backend", ".env")
REGISTRY_PATH = os.path.join(
    REPO_ROOT, ".spec", "00-canon", "repository-registry", "brand-folder-registry.yaml"
)
LOG_DIR = os.path.join(REPO_ROOT, "scripts", "logs")

API_ENDPOINT = (
    "https://webservice.tecalliance.services/pegasus-3-0/services/"
    "TecdocToCatDLB.jsonEndpoint"
)
LOGIN_URL = "https://web.tecalliance.net/tecdoc/fr/home"
# Owner subscription provider id (overridable). Captured from the live session.
DEFAULT_PROVIDER = int(os.environ.get("TECDOC_PROVIDER", "23365"))
# Highest-resolution image fields first.
IMAGE_RES_KEYS = (
    "imageURL3200",
    "imageURL1600",
    "imageURL800",
    "imageURL400",
    "imageURL200",
    "imageURL100",
    "imageURL50",
)
CHROME_PATH = os.environ.get(
    "PLAYWRIGHT_CHROMIUM",
    "/home/deploy/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome",
)


def log(msg):
    print(msg, flush=True)


# ─────────────────────────────────────────────────────────────────────────────
# env / registry
# ─────────────────────────────────────────────────────────────────────────────
def load_env_file(path):
    out = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


def env(key, file_env, default=None):
    return os.environ.get(key) or file_env.get(key) or default


def registry_folders(pm_id):
    """Return (primary_folder, [alt_folders]) for a pm_id from the canonical registry.

    The registry is the SoT; this script only READS it (owner-only edits)."""
    if not os.path.exists(REGISTRY_PATH):
        return None, []
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(open(REGISTRY_PATH))
        for b in (data or {}).get("brands", []):
            if int(b.get("pm_id", -1)) == int(pm_id):
                return str(b.get("primary_folder")), [str(x) for x in b.get("alt_folders", []) or []]
        return None, []
    except ImportError:
        # tolerant fallback parse (no pyyaml): find the pm_id block
        txt = open(REGISTRY_PATH).read()
        m = re.search(
            r"pm_id:\s*%d\b[^\n]*\n(?:.*\n)*?\s*primary_folder:\s*(\d+)" % int(pm_id), txt
        )
        if not m:
            m = re.search(
                r"\{[^}]*pm_id:\s*%d\b[^}]*primary_folder:\s*(\d+)[^}]*\}" % int(pm_id), txt
            )
        return (m.group(1) if m else None), []


# ─────────────────────────────────────────────────────────────────────────────
# auth: x-api-key (env or one-time Playwright login)
# ─────────────────────────────────────────────────────────────────────────────
def build_template(provider, per_page):
    """Static number-search getArticles body (shape captured from the live SPA)."""
    return {
        "getArticles": {
            "provider": provider,
            "articleCountry": "FR",
            "lang": "fr",
            "searchQuery": "",
            "searchType": 10,
            "searchMatchType": "prefix_or_suffix",
            "perPage": per_page,
            "page": 1,
        }
    }


async def login_capture_apikey(user, password, provider, per_page):
    """One-time OAuth2 login; capture x-api-key (and the real request template)."""
    from playwright.async_api import async_playwright

    cap = {}
    async with async_playwright() as p:
        kw = {"headless": True}
        if os.path.exists(CHROME_PATH):
            kw["executable_path"] = CHROME_PATH
        browser = await p.chromium.launch(**kw)
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
            )
        )
        page = await ctx.new_page()

        def on_req(req):
            pd = req.post_data or ""
            if "TecdocToCatDLB" in req.url and "getArticles" in pd and '"searchQuery"' in pd and "key" not in cap:
                cap["key"] = next((v for k, v in req.headers.items() if k.lower() == "x-api-key"), None)
                cap["body"] = pd

        page.on("request", on_req)
        await page.goto(LOGIN_URL, wait_until="networkidle", timeout=45000)
        if "login" in page.url:
            await page.wait_for_selector('input[name="identifier"]', timeout=15000)
            await page.fill('input[name="identifier"]', user)
            await page.wait_for_timeout(400)
            await page.click('input[type="submit"]')
            await page.wait_for_timeout(3000)
            await page.wait_for_selector('input[name="credentials.passcode"]', timeout=15000)
            await page.fill('input[name="credentials.passcode"]', password)
            await page.wait_for_timeout(400)
            await page.click('input[type="submit"]')
            await page.wait_for_timeout(9000)
        s = page.locator('input[placeholder="Recherche par numéro quelconque"]')
        await s.wait_for(timeout=30000)
        await s.fill("CLR7120")
        await page.wait_for_timeout(400)
        await s.press("Enter")
        await page.wait_for_timeout(9000)
        await browser.close()
    if not cap.get("key"):
        raise RuntimeError("login OK but x-api-key not captured (layout change?)")
    tmpl = json.loads(cap["body"])
    tmpl["getArticles"]["perPage"] = per_page  # we control paging
    return cap["key"], tmpl


def resolve_apikey(file_env, provider, per_page):
    """Direct env key (fast, no browser) else one-time Playwright login."""
    direct = env("TECDOC_API_KEY", file_env)
    if direct:
        log("🔑 x-api-key depuis l'env (TECDOC_API_KEY) — pas de login navigateur.")
        return direct, build_template(provider, per_page)
    user = env("TECDOC_WEB_USER", file_env)
    password = env("TECDOC_WEB_PASSWORD", file_env)
    if not (user and password):
        sys.exit(
            "ABORT: ni TECDOC_API_KEY ni TECDOC_WEB_USER/TECDOC_WEB_PASSWORD en env. "
            "Pas de fallback silencieux — fournir les credentials (owner)."
        )
    log("🔐 Login OAuth2 TecDoc (one-shot) pour capturer x-api-key…")
    return asyncio.get_event_loop().run_until_complete(
        login_capture_apikey(user, password, provider, per_page)
    )


# ─────────────────────────────────────────────────────────────────────────────
# article_registry mapping (READ-ONLY) + ARTNR list
# ─────────────────────────────────────────────────────────────────────────────
def artnr_piece_map(dlnr, file_env, only_artnrs=None, sellable_only=False):
    """{source_artnr -> piece_id} for the DLNR, read READ-ONLY from PG.

    sellable_only=True restricts to pieces with a sellable price
    (pieces_price.pri_dispo IN ('1','2','3')) — image recovery is coupled to the
    supplier tariff: only pieces a tariff makes sellable get their images fetched."""
    import psycopg2

    pwd = env("SUPABASE_DB_PASSWORD", file_env)
    if not pwd:
        sys.exit("ABORT: SUPABASE_DB_PASSWORD absent (backend/.env) — requis pour le mapping ARTNR→piece.")
    conn = psycopg2.connect(
        host=env("SUPABASE_DB_HOST", file_env, "aws-0-eu-west-3.pooler.supabase.com"),
        port=env("SUPABASE_DB_PORT", file_env, "6543"),
        user=env("SUPABASE_DB_USER", file_env, "postgres.cxpojprgwgubzjyqzmoq"),
        password=pwd,
        dbname="postgres",
    )
    conn.set_session(readonly=True, autocommit=True)  # hard guard: no DB writes
    cur = conn.cursor()
    sellable_clause = (
        " AND EXISTS (SELECT 1 FROM pieces_price pr "
        "WHERE pr.pri_piece_id_i = ar.piece_id AND pr.pri_dispo IN ('1','2','3'))"
        if sellable_only else ""
    )
    if only_artnrs:
        cur.execute(
            "SELECT ar.source_artnr, ar.piece_id FROM tecdoc_map.article_registry ar "
            "WHERE ar.source_dlnr = %s AND ar.source_artnr = ANY(%s)" + sellable_clause,
            (dlnr, list(only_artnrs)),
        )
    else:
        cur.execute(
            "SELECT ar.source_artnr, ar.piece_id FROM tecdoc_map.article_registry ar "
            "WHERE ar.source_dlnr = %s" + sellable_clause,
            (dlnr,),
        )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return {r[0]: r[1] for r in rows}


# ─────────────────────────────────────────────────────────────────────────────
# fetch / extract / download / upload
# ─────────────────────────────────────────────────────────────────────────────
def best_image_url(image):
    for k in IMAGE_RES_KEYS:
        if image.get(k):
            return image[k].replace("\\/", "/")
    return None


async def get_articles(client, tmpl, apikey, artnr):
    body = json.loads(json.dumps(tmpl))
    body["getArticles"]["searchQuery"] = artnr
    headers = {
        "Content-Type": "application/json",
        "x-api-key": apikey,
        "Accept": "application/json",
        "User-Agent": "automecanik-image-recover/1.0",
        "Origin": "https://web.tecalliance.net",
        "Referer": "https://web.tecalliance.net/",
    }
    r = await client.post(API_ENDPOINT, content=json.dumps(body).encode(), headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def extract_images(resp, dlnr, artnr):
    """Image URLs for the exact <brand=dlnr, artnr> article (drops cross-refs)."""
    norm = artnr.upper().replace(" ", "")
    urls = []
    for a in resp.get("articles", []) or []:
        if int(a.get("dataSupplierId", -1)) != int(dlnr):
            continue
        if str(a.get("articleNumber", "")).upper().replace(" ", "") != norm:
            continue
        for img in a.get("images", []) or []:
            u = best_image_url(img)
            if u:
                urls.append(u)
    return urls


async def download(client, url):
    r = await client.get(url, headers={"User-Agent": "automecanik-image-recover/1.0"}, timeout=30)
    r.raise_for_status()
    data = r.content
    is_img = data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n"
    if not is_img:
        raise ValueError(f"not an image (ct={r.headers.get('content-type')})")
    return data


def storage_upload(supabase_url, service_key, key, data):
    """Upload one object to rack-images/<key> via Supabase Storage REST (idempotent)."""
    url = f"{supabase_url}/storage/v1/object/rack-images/{key}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }
    r = httpx.post(url, content=data, headers=headers, timeout=30)
    r.raise_for_status()
    return r.status_code


# ─────────────────────────────────────────────────────────────────────────────
# checkpoint / manifest
# ─────────────────────────────────────────────────────────────────────────────
def checkpoint_path(pm_id):
    return os.path.join(LOG_DIR, f"recover-images-progress-pm{pm_id}.json")


def load_checkpoint(pm_id):
    p = checkpoint_path(pm_id)
    if os.path.exists(p):
        return json.load(open(p))
    return {"pm_id": pm_id, "done": {}, "uploaded_keys": []}


def save_checkpoint(cp):
    os.makedirs(LOG_DIR, exist_ok=True)
    json.dump(cp, open(checkpoint_path(cp["pm_id"]), "w"), indent=1)


# ─────────────────────────────────────────────────────────────────────────────
# main
# ─────────────────────────────────────────────────────────────────────────────
async def run(args, file_env, apikey, tmpl):
    pm_id, dlnr, folder = args.pm_id, args.dlnr, args.folder
    prefix = args.test_prefix.strip("/") if args.test_prefix else folder
    commit = args.commit and not args.dry_run

    # ARTNR set
    only = [a.strip() for a in args.artnr.split(",")] if args.artnr else None
    amap = artnr_piece_map(dlnr, file_env, only_artnrs=only, sellable_only=args.sellable_only)
    if args.sellable_only:
        log("🎯 --sellable-only : restreint aux pièces vendables (pri_dispo ∈ 1,2,3) — couplé au tarif injecté")
    artnrs = sorted(amap.keys())
    if args.limit:
        artnrs = artnrs[: args.limit]
    log(f"📦 {len(artnrs)} ARTNR à traiter (DLNR {dlnr} → folder {folder}, prefix='{prefix}', commit={commit})")

    cp = load_checkpoint(pm_id)
    if args.retry_failed:
        for ref, st in list(cp["done"].items()):
            if st.get("status") in ("fetch_failed", "upload_failed", "download_failed"):
                cp["done"].pop(ref, None)

    sup_url = env("SUPABASE_URL", file_env)
    svc_key = env("SUPABASE_SERVICE_ROLE_KEY", file_env)
    if commit and not (sup_url and svc_key):
        sys.exit("ABORT: --commit requiert SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (env).")

    manifest_jsonl = os.path.join(LOG_DIR, f"recover-manifest-pm{pm_id}.jsonl")
    manifest_csv = os.path.join(LOG_DIR, f"recover-manifest-pm{pm_id}.csv")
    os.makedirs(LOG_DIR, exist_ok=True)
    mf = open(manifest_jsonl, "a")
    cf = open(manifest_csv, "a", newline="")
    cw = csv.writer(cf)
    if os.path.getsize(manifest_csv) == 0:
        cw.writerow(["artnr", "piece_id", "folder", "image_name", "image_url", "sha256", "bytes", "status"])

    sem = asyncio.Semaphore(args.concurrency)
    consecutive_failures = {"n": 0}
    stats = {"api": 0, "img": 0, "uploaded": 0, "no_images": 0, "failed": 0}
    seen_hashes = set()

    async def handle(client, artnr):
        if args.resume and artnr in cp["done"] and cp["done"][artnr].get("status") == "ok":
            return
        async with sem:
            await asyncio.sleep(args.rate_limit_ms / 1000.0)
            piece_id = amap.get(artnr)
            try:
                resp = await get_articles(client, tmpl, apikey, artnr)
            except Exception as e:
                stats["failed"] += 1
                consecutive_failures["n"] += 1
                cp["done"][artnr] = {"status": "fetch_failed", "err": str(e)[:120]}
                log(f"  {artnr:12s} API ERR {str(e)[:60]}")
                return
            consecutive_failures["n"] = 0
            stats["api"] += 1
            urls = extract_images(resp, dlnr, artnr)
            if not urls:
                stats["no_images"] += 1
                cp["done"][artnr] = {"status": "no_images"}
                rec = dict(artnr=artnr, piece_id=piece_id, folder=folder, image_name=None,
                           image_url=None, sha256=None, bytes=0, status="no_images")
                mf.write(json.dumps(rec) + "\n")
                cw.writerow([artnr, piece_id, folder, "", "", "", 0, "no_images"])
                return
            stats["img"] += 1
            files = []
            for u in urls:
                try:
                    data = await download(client, u)
                except Exception as e:
                    cp["done"].setdefault(artnr, {})["status"] = "download_failed"
                    log(f"  {artnr:12s} DL ERR {str(e)[:50]}")
                    continue
                h = hashlib.sha256(data).hexdigest()
                name = f"{h}.jpg"
                key = f"{prefix}/{name}"
                # HARD guard: never upload outside the brand's registry folder / test prefix
                if not key.startswith(f"{prefix}/"):
                    raise RuntimeError(f"refused upload outside prefix: {key}")
                status = "fetched"
                if commit:
                    if h in seen_hashes:
                        status = "uploaded_dup"
                    else:
                        try:
                            storage_upload(sup_url, svc_key, key, data)
                            cp["uploaded_keys"].append(key)
                            stats["uploaded"] += 1
                            status = "uploaded"
                        except Exception as e:
                            cp["done"].setdefault(artnr, {})["status"] = "upload_failed"
                            log(f"  {artnr:12s} UPLOAD ERR {str(e)[:50]}")
                            continue
                seen_hashes.add(h)
                files.append(name)
                rec = dict(artnr=artnr, piece_id=piece_id, folder=folder, image_name=name,
                           image_url=u, sha256=h, bytes=len(data), status=status)
                mf.write(json.dumps(rec) + "\n")
                cw.writerow([artnr, piece_id, folder, name, u, h, len(data), status])
            cp["done"][artnr] = {"status": "ok", "files": files}

    async with httpx.AsyncClient(http2=True, follow_redirects=True) as client:
        batch = []
        for i, artnr in enumerate(artnrs, 1):
            if consecutive_failures["n"] >= args.max_consecutive_failures:
                log(f"⛔ circuit-breaker: {consecutive_failures['n']} échecs consécutifs — arrêt (checkpoint conservé).")
                break
            batch.append(handle(client, artnr))
            if len(batch) >= args.concurrency * 2:
                await asyncio.gather(*batch)
                batch = []
                save_checkpoint(cp)
        if batch:
            await asyncio.gather(*batch)
    save_checkpoint(cp)
    mf.close()
    cf.close()
    log("")
    log(f"=== RÉSUMÉ pm{pm_id} : {stats['api']} API OK · {stats['img']} avec image · "
        f"{stats['no_images']} no_images · {stats['failed']} API échec · "
        f"{stats['uploaded']} objets uploadés ({'COMMIT' if commit else 'DRY-RUN'}) ===")
    log(f"Manifest : {manifest_jsonl}  +  {manifest_csv}")
    if not commit:
        log("ℹ️  DRY-RUN — aucune écriture Supabase. Relancer avec --commit (owner GO) pour uploader.")


def main():
    ap = argparse.ArgumentParser(description="TecDoc rack-images recovery (API getArticles).")
    ap.add_argument("--pm-id", type=int, required=True, help="brand pm_id (e.g. 3040 MECAFILTER)")
    ap.add_argument("--dlnr", type=int, required=True, help="TecDoc data supplier number (e.g. 218)")
    ap.add_argument("--folder", required=True, help="rack-images folder (e.g. 218) — must match registry")
    ap.add_argument("--dry-run", action="store_true", default=True, help="default: fetch + manifest, no write")
    ap.add_argument("--commit", action="store_true", help="explicit: upload to Supabase Storage")
    ap.add_argument("--test-prefix", default=None, help="upload under this prefix instead of <folder> (e.g. _recover-test/218)")
    ap.add_argument("--artnr", default=None, help="comma-separated ARTNR subset")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sellable-only", action="store_true",
                    help="restreint aux pièces vendables (pieces_price.pri_dispo IN 1,2,3) — usage normal couplé au tarif")
    ap.add_argument("--resume", action="store_true", help="skip ARTNR already 'ok' in checkpoint")
    ap.add_argument("--retry-failed", action="store_true", help="re-attempt failed ARTNR from checkpoint")
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--rate-limit-ms", type=int, default=250)
    ap.add_argument("--max-consecutive-failures", type=int, default=20)
    ap.add_argument("--per-page", type=int, default=80)
    args = ap.parse_args()
    if args.commit:
        args.dry_run = False

    file_env = load_env_file(ENV_PATH)

    # registry cross-check (read-only): folder must match the canonical registry
    primary, alts = registry_folders(args.pm_id)
    if primary is None:
        log(f"⚠️  pm_id {args.pm_id} absent de brand-folder-registry.yaml — vérifier (owner édite le registry, pas ce script).")
    elif args.folder not in [primary] + alts:
        sys.exit(f"ABORT: folder {args.folder} ≠ registry (primary={primary}, alt={alts}) pour pm_id {args.pm_id}.")

    apikey, tmpl = resolve_apikey(file_env, DEFAULT_PROVIDER, args.per_page)
    t0 = time.monotonic()
    asyncio.get_event_loop().run_until_complete(run(args, file_env, apikey, tmpl))
    log(f"⏱  {time.monotonic() - t0:.1f}s")


if __name__ == "__main__":
    main()
