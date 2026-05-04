#!/usr/bin/env python3
"""
download-oem-corpus.py — Télécharge des pages techniques pour enrichir le corpus RAG des gammes.

Sources (ordre de priorité) :
  1. Wikipedia FR  — via API search (statique, riche, 100-200KB)
  2. Pages OEM statiques vérifiées (textar.com, gates.com, monroe.com, bremboparts.com…)

Cible : 221 gammes avec phase5_enrichment insuffisant (< 2 signaux types/mats/norms).
Output : fichiers .md dans automecanik-raw/recycled/rag-knowledge/web/ (format corpus existant).

Configurable via env :
  AUTOMECANIK_RAW_PATH (default /opt/automecanik/automecanik-raw)

Usage:
  python3 scripts/raw-downloaders/download-oem-corpus.py [--dry-run] [--limit 20] [--category freinage]
  python3 scripts/raw-downloaders/download-oem-corpus.py --gamme alternateur
"""

import os
import re
import sys
import time
import hashlib
import argparse
import textwrap
from datetime import datetime, timezone
from urllib.parse import urlparse, quote

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Manque : pip install requests beautifulsoup4")
    sys.exit(1)

# === CONFIG ===
# AUTOMECANIK_RAW_PATH overrides the rag-knowledge root for ADR-031 Phase D.
# Default keeps the legacy location so unset = no behavioral change.
RAW_KNOWLEDGE_ROOT = os.getenv("AUTOMECANIK_RAW_PATH", "/opt/automecanik/rag/knowledge")
GAMMES_DIR = f"{RAW_KNOWLEDGE_ROOT}/gammes"
WEB_DIR = f"{RAW_KNOWLEDGE_ROOT}/web"
REQUEST_DELAY = 1.2
MAX_RETRIES = 2
TIMEOUT = 12
MIN_CONTENT_LEN = 300
WIKI_API = "https://fr.wikipedia.org/w/api.php"
WIKI_BASE = "https://fr.wikipedia.org/wiki/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AutoMecanik-RAGBot/1.0; tech-research)",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml",
}

# === MAPPING GAMME → TERMES DE RECHERCHE WIKIPEDIA ===
GAMME_WIKI_QUERIES = {
    # Freinage
    "accessoires-de-machoire":          ["mâchoire de frein tambour"],
    "accessoires-de-plaquette":         ["plaquette de frein automobile"],
    "accumulateur-de-pression":         ["accumulateur hydraulique freinage"],
    "cable-de-frein-a-main":            ["frein à main câble stationnement"],
    "cylindre-de-roue":                 ["cylindre de roue frein tambour"],
    "flexible-de-frein":                ["flexible de frein hydraulique"],
    "maitre-cylindre-de-frein":         ["maître-cylindre frein automobile"],
    "repartiteur-de-frein":             ["répartiteur de freinage correcteur"],
    "servo-frein":                      ["servofrein assistance freinage"],
    "temoin-d-usure":                   ["témoin d'usure plaquette frein"],
    "agregat-de-freinage":              ["système antiblocage ABS ESP"],
    "machoires-de-frein":               ["mâchoire de frein tambour"],
    "tambour-de-frein":                 ["tambour de frein automobile"],
    # Filtration
    "filtre-a-air":                     ["filtre à air moteur automobile"],
    "filtre-a-huile":                   ["filtre à huile moteur"],
    "filtre-d-habitacle":               ["filtre habitacle pollen automobile"],
    "filtre-a-carburant":               ["filtre à carburant automobile"],
    "filtre-de-boite-auto":             ["filtre boîte automatique transmission"],
    "filtre-de-direction-assistee":     ["direction assistée hydraulique filtre"],
    # Allumage
    "bobine-d-allumage":                ["bobine d'allumage automobile"],
    "bougie-d-allumage":                ["bougie d'allumage moteur"],
    "bougie-de-prechauffage":           ["bougie de préchauffage diesel"],
    "cable-de-bougie":                  ["câble d'allumage bougie"],
    "distributeur-d-allumage":          ["distributeur allumage automobile"],
    # Distribution
    "courroie-de-distribution":         ["courroie de distribution moteur"],
    "chaine-de-distribution":           ["chaîne de distribution moteur"],
    "galet-de-distribution":            ["galet tendeur distribution"],
    "pompe-a-eau":                      ["pompe à eau moteur refroidissement"],
    "tendeur-de-distribution":          ["tendeur courroie distribution"],
    "kit-de-distribution":              ["kit distribution moteur courroie"],
    # Embrayage
    "disque-d-embrayage":               ["disque d'embrayage automobile"],
    "kit-d-embrayage":                  ["kit embrayage disque volant"],
    "volant-moteur":                    ["volant moteur bimasse automobile"],
    "butee-d-embrayage":                ["butée d'embrayage automobile"],
    "cylindre-emetteur-embrayage":      ["cylindre récepteur émetteur embrayage"],
    "cylindre-recepteur-embrayage":     ["cylindre récepteur embrayage"],
    # Amortisseur / Suspension
    "amortisseur":                      ["amortisseur automobile suspension"],
    "barre-stabilisatrice":             ["barre stabilisatrice antiroulis"],
    "ressort-de-suspension":            ["ressort suspension hélicoïdal automobile"],
    "silent-bloc":                      ["silent bloc silentbloc suspension"],
    "rotule-de-suspension":             ["rotule de suspension automobile"],
    "coupelle-d-amortisseur":           ["coupelle amortisseur butée"],
    "kit-de-suspension":                ["kit suspension jambe McPherson"],
    # Direction
    "amortisseur-de-direction":         ["amortisseur direction automobile", "direction amortisseur"],
    "biellette-de-direction":           ["biellette direction rotule"],
    "barre-de-direction":               ["barre de direction automobile"],
    "rotule-de-direction":              ["rotule de direction automobile"],
    "cremaillere-de-direction":         ["crémaillère direction assistée"],
    "pompe-de-direction-assistee":      ["pompe direction assistée hydraulique"],
    "soufflet-de-direction":            ["soufflet crémaillère direction"],
    # Refroidissement
    "radiateur":                        ["radiateur automobile refroidissement"],
    "thermostat":                       ["thermostat moteur refroidissement"],
    "ventilateur-de-refroidissement":   ["ventilateur refroidissement moteur"],
    "vase-d-expansion":                 ["vase d'expansion circuit refroidissement"],
    "sonde-de-refroidissement":         ["capteur température liquide refroidissement"],
    "bouchon-de-radiateur":             ["bouchon radiateur pression"],
    "joint-de-culasse":                 ["joint de culasse moteur"],
    # Climatisation
    "compresseur-climatisation":        ["compresseur climatisation automobile"],
    "condenseur-climatisation":         ["condenseur climatisation automobile"],
    "evaporateur-climatisation":        ["évaporateur climatisation automobile"],
    "filtre-deshydrateur":              ["filtre déshydrateur climatisation"],
    "valve-de-detente":                 ["détendeur valve climatisation"],
    "courroie-de-climatisation":        ["courroie accessoires climatisation"],
    # Alimentation / Injection
    "accumulateur-de-pression-de-carburant": ["rampe injection common rail"],
    "injecteur":                        ["injecteur injection moteur", "injecteur diesel essence"],
    "pompe-a-carburant":                ["pompe carburant automobile", "pompe essence gasoil"],
    "pompe-a-haute-pression":           ["pompe haute pression diesel injection", "pompe HP common rail"],
    "regulateur-de-pression-de-carburant": ["régulateur pression injection carburant"],
    "soupape-egr":                      ["vanne EGR recirculation gaz échappement"],
    "corps-de-papillon":                ["papillon des gaz injection automobile"],
    "rampe-d-injection":                ["rampe injection common rail"],
    "jauge-a-carburant":                ["jauge à carburant flotteur"],
    # Capteurs
    "capteur-abs":                      ["capteur ABS vitesse de roue"],
    "capteur-d-arbre-a-cames":          ["capteur position arbre à cames"],
    "capteur-vilebrequin":              ["capteur position vilebrequin PMH"],
    "capteur-de-cliquetis":             ["capteur de cliquetis moteur"],
    "capteur-de-pression-turbo":        ["capteur pression suralimentation turbo"],
    "debitmetre-d-air":                 ["débitmètre air massique MAF"],
    "sonde-lambda":                     ["sonde lambda capteur oxygène"],
    "sonde-de-temperature-des-gaz":     ["capteur température gaz échappement", "sonde température gaz échappement"],
    "capteur-de-pression-d-huile":      ["capteur pression huile moteur"],
    "capteur-de-temperature-d-air":     ["capteur température air admission"],
    # Moteur (joints, pistons)
    "segment-de-piston":                ["segment piston moteur thermique"],
    "piston":                           ["piston moteur à explosion"],
    "joint-d-huile":                    ["joint spi huile moteur"],
    "joint-de-soupape":                 ["joint de soupape queue"],
    "joint-de-carter":                  ["joint carter moteur étanchéité"],
    "joint-de-collecteur":              ["joint collecteur admission échappement"],
    "soupape":                          ["soupape moteur à explosion"],
    "poussoir-de-soupape":              ["poussoir de soupape hydraulique"],
    "arbre-a-cames":                    ["arbre à cames distribution moteur"],
    "bielle":                           ["bielle moteur thermique"],
    "vilebrequin":                      ["vilebrequin moteur explosion"],
    "palier-de-vilebrequin":            ["palier lisse vilebrequin moteur"],
    # Éclairage
    "ampoule-eclairage-interieur":      ["ampoule halogène automobile", "lampe automobile"],
    "ampoule-feu-arriere":              ["feu arrière automobile ampoule", "feu stop ampoule"],
    "ampoule-feu-avant":                ["lampe phare automobile halogène", "phare avant lampe"],
    "kit-de-feux":                      ["phare automobile éclairage"],
    "projecteur-antibrouillard":        ["antibrouillard phare brouillard"],
    # Turbo
    "turbocompresseur":                 ["turbocompresseur turbo automobile"],
    "vanne-de-decharge":                ["wastegate vanne décharge turbo"],
    "durite-de-turbo":                  ["durite air turbocompresseur intercooler"],
    "intercooler":                      ["intercooler refroidisseur air turbo"],
    # Échappement
    "pot-catalytique":                  ["catalyseur pot catalytique automobile"],
    "filtre-a-particules":              ["filtre à particules diesel FAP DPF"],
    "silencieux-d-echappement":         ["silencieux échappement automobile"],
    # Transmission
    "roulement-de-roue":                ["roulement de roue automobile"],
    "moyeu-de-roue":                    ["moyeu de roue automobile"],
    "arbre-de-transmission":            ["arbre de transmission homocinetique"],
    "joint-de-transmission":            ["joint de transmission homocinétique"],
    "soufflet-de-transmission":         ["soufflet de transmission joint homocinétique"],
    "differentiel":                     ["différentiel automobile transmission"],
    # Électrique
    "alternateur":                      ["alternateur automobile", "alternateur électrique"],
    "demarreur":                        ["démarreur automobile", "démarreur moteur"],
    "batterie":                         ["batterie automobile", "accumulateur automobile"],
    "relais":                           ["relais électromagnétique automobile"],
    "fusible":                          ["fusible protection électrique automobile"],
    # Gestion moteur
    "calculateur-moteur":               ["calculateur moteur ECU gestion"],
    "papillon-des-gaz":                 ["papillon des gaz injection"],
    # Support moteur
    "support-moteur":                   ["support moteur silent bloc silentbloc"],
    "support-de-boite-de-vitesses":     ["support boîte de vitesses"],
    # Tableau de bord
    "capteur-de-pluie":                 ["capteur de pluie essuie-glace automatique"],
}

# Pages OEM statiques vérifiées (retournent du contenu HTML réel, FR uniquement)
CATEGORY_OEM_URLS = {
    "freinage": [
        "https://www.bremboparts.com/europe/fr/support/",
        "https://textar.com/fr/produits/",
    ],
    "allumage": [
        "https://www.ngkntk.com/fr/produits/",
    ],
    "suspension": [
        "https://www.monroe.com/fr-fr/",
        "https://www.bilstein.com/fr/",
        "https://www.kyb-europe.com/fr/",
        "https://www.sachs.de/",
        "https://www.meyle.com/fr/",
        "https://aftermarket.zf.com/fr/",
    ],
    "distribution": [
        "https://www.gates.com/fr/fr.html",
    ],
    "direction": [
        "https://aftermarket.zf.com/fr/",
        "https://www.meyle.com/fr/",
    ],
    "refroidissement": [
        "https://www.valeo.com/fr/",
        "https://www.mahle-aftermarket.com/",
    ],
    "echappement": [
        "https://www.bosal.com/fr/",
    ],
    "climatisation": [
        "https://www.valeo.com/fr/",
    ],
    "electrique": [
        "https://www.boschaftermarket.com/fr/",
    ],
    "capteurs": [
        "https://www.continental-aftermarket.com/fr/",
        "https://www.meyle.com/fr/",
    ],
    "gestion-moteur": [
        "https://www.bosch-mobility.com/fr/",
    ],
}


def slugify_to_hash(slug: str, url: str) -> str:
    raw = f"{slug}:{url}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def detect_needs_enrichment() -> list[dict]:
    gammes = []
    for f in sorted(os.listdir(GAMMES_DIR)):
        if not f.endswith('.md'):
            continue
        with open(f'{GAMMES_DIR}/{f}', encoding='utf-8') as fh:
            content = fh.read()
        has_types = bool(re.search(r'types_variants:\s*\n(\s+- type:)', content))
        has_mats = bool(re.search(r'materials:\s*\n(\s+- materiau:)', content))
        has_norms = bool(re.search(r'norme_ece_r90|norme_dot', content))
        if sum([has_types, has_mats, has_norms]) >= 2:
            continue
        cat_m = re.search(r'^category:\s*(.+)', content, re.M)
        cat = cat_m.group(1).strip() if cat_m else 'unknown'
        bp_m = re.search(r'^business_priority:\s*(.+)', content, re.M)
        bp = bp_m.group(1).strip() if bp_m else 'low'
        basket_m = re.search(r'avg_basket:\s*(\d+)', content)
        basket = int(basket_m.group(1)) if basket_m else 0
        gammes.append({'slug': f.replace('.md', ''), 'category': cat, 'priority': bp, 'avg_basket': basket})
    priority_order = {'high': 0, 'medium': 1, 'low': 2}
    return sorted(gammes, key=lambda g: (priority_order.get(g['priority'], 9), -g['avg_basket']))


def build_download_index() -> dict[str, int]:
    """Build slug → file count index in a single pass (O(n) instead of O(n×m))."""
    index = {}
    for f in os.listdir(WEB_DIR):
        if not f.endswith('.md'):
            continue
        try:
            with open(f'{WEB_DIR}/{f}', encoding='utf-8') as fh:
                header = fh.read(600)
            m = re.search(r'slug_gamme:\s*(\S+)', header)
            if m:
                slug = m.group(1)
                index[slug] = index.get(slug, 0) + 1
        except OSError:
            pass
    return index


def wiki_search(query: str) -> tuple[str, str] | None:
    """Trouve l'article Wikipedia FR le plus pertinent.
    Retourne (url, title) ou None si non pertinent."""
    try:
        r = requests.get(WIKI_API, params={
            "action": "query", "list": "search",
            "srsearch": query, "srlimit": 3,
            "srnamespace": 0, "format": "json"
        }, headers={"User-Agent": "AutoMecanik-RAGBot/1.0"}, timeout=8)
        data = r.json()
        results = data.get("query", {}).get("search", [])
        if not results:
            return None
        # Vérifier pertinence : au moins 1 mot-clé de la query dans le titre
        query_words = set(w.lower() for w in query.split() if len(w) > 3)
        auto_keywords = {'automobile', 'moteur', 'véhicule', 'voiture', 'frein',
                         'suspension', 'direction', 'embrayage', 'transmission',
                         'injection', 'turbo', 'échappement', 'climatisation'}
        for res in results:
            title = res["title"]
            title_lower = title.lower()
            if any(w in title_lower for w in query_words):
                safe = title.replace(" ", "_")
                return f"{WIKI_BASE}{safe}", title
        # Fallback : premier résultat SI titre contient un mot-clé automobile
        for res in results:
            title_lower = res["title"].lower()
            if any(w in title_lower for w in auto_keywords):
                safe = res["title"].replace(" ", "_")
                return f"{WIKI_BASE}{safe}", res["title"]
    except (requests.RequestException, KeyError, ValueError):
        pass
    return None


def fetch_url(url: str) -> str | None:
    for attempt in range(MAX_RETRIES + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
            if r.status_code == 200 and 'text/html' in r.headers.get('Content-Type', ''):
                r.encoding = r.apparent_encoding
                return r.text
            if r.status_code in (403, 404, 429, 503):
                return None
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY * 2)
        except Exception as e:
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY)
            else:
                print(f"    ❌ Réseau : {e}")
    return None


def extract_text_wikipedia(html: str) -> tuple[str, str]:
    """Extraction optimisée pour Wikipedia (structure connue)."""
    soup = BeautifulSoup(html, 'html.parser')
    title = ''
    if soup.find('h1', id='firstHeading'):
        title = soup.find('h1', id='firstHeading').get_text(strip=True)

    # Contenu Wikipedia = #mw-content-text
    content_div = soup.find('div', id='mw-content-text')
    if not content_div:
        return title, ''

    # Supprimer tables de navigation, références, boîtes info
    for tag in content_div.find_all(['table', 'sup', 'cite', 'div'],
                                    class_=re.compile(r'(navbox|reflist|infobox|toc|hatnote|thumb)', re.I)):
        tag.decompose()
    for tag in content_div.find_all(id=re.compile(r'(references|notes|voir_aussi|liens)', re.I)):
        if tag.parent:
            tag.parent.decompose()

    lines = []
    for el in content_div.find_all(['h2', 'h3', 'h4', 'p', 'li']):
        text = el.get_text(separator=' ', strip=True)
        text = re.sub(r'\[\d+\]', '', text)  # Supprimer [1], [2]...
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) < 20:
            continue
        if el.name in ('h2', 'h3', 'h4'):
            lines.append(f'\n## {text}\n')
        elif el.name == 'li':
            lines.append(f'- {text}')
        else:
            lines.append(text)

    return title, '\n'.join(lines[:200])  # Cap à 200 lignes


def extract_text_oem(html: str) -> tuple[str, str]:
    """Extraction générique pour sites OEM."""
    soup = BeautifulSoup(html, 'html.parser')
    for tag in soup.find_all(['nav', 'footer', 'script', 'style', 'header',
                               'aside', 'noscript', 'iframe', 'form']):
        tag.decompose()
    for tag in soup.find_all(class_=re.compile(r'(cookie|gdpr|banner|popup|menu)', re.I)):
        tag.decompose()

    title = soup.title.get_text(strip=True) if soup.title else ''
    main = (soup.find('main') or soup.find('article') or soup.body)
    if not main:
        return title, ''

    lines = []
    for el in main.find_all(['h1', 'h2', 'h3', 'p', 'li']):
        text = el.get_text(separator=' ', strip=True)
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) < 20:
            continue
        if el.name in ('h1', 'h2', 'h3'):
            lines.append(f'\n## {text}\n')
        elif el.name == 'li':
            lines.append(f'- {text}')
        else:
            lines.append(text)

    return title, '\n'.join(lines)


def save_file(slug: str, url: str, title: str, content: str) -> str | None:
    if len(content.strip()) < MIN_CONTENT_LEN:
        return None
    h = slugify_to_hash(slug, url)
    existing = [f for f in os.listdir(WEB_DIR) if f.startswith(h)]
    section_num = len(existing) + 1
    filename = f"{h}-s{section_num:03d}.md"
    path = f"{WEB_DIR}/{filename}"
    now = datetime.now(timezone.utc).isoformat()
    domain = urlparse(url).netloc
    safe_title = title.replace("'", "\\'")[:120]
    md = textwrap.dedent(f"""\
        ---
        title: '{safe_title} - s{section_num:03d}'
        source_type: guide
        category: knowledge
        truth_level: L2
        verification_status: unverified
        slug_gamme: {slug}
        source_uri: {url}
        source_url: {url}
        source_domain: {domain}
        created_at: '{now}'
        updated_at: '{now}'
        ---

        # {title}

        {content}
    """)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(md)
    return path


def process_gamme(gamme: dict, dry_run: bool) -> int:
    slug = gamme['slug']
    cat = gamme['category']
    created = 0

    # --- Source 1 : Wikipedia via API search ---
    queries = GAMME_WIKI_QUERIES.get(slug)
    if not queries:
        # Fallback : extraire 2 mots significatifs du slug (ignore articles)
        STOP = {'de', 'd', 'a', 'en', 'du', 'des', 'le', 'la', 'les', 'l'}
        words = [w for w in slug.split('-') if w not in STOP and len(w) > 1]
        queries = [' '.join(words[:2])]  # ≤ 2 mots → déclenche le fallback

    for query in queries[:2]:
        print(f"  🔍 Wikipedia : '{query}'")
        if dry_run:
            print(f"     [DRY-RUN] serait cherché")
            created += 1
            break

        wiki_result = wiki_search(query)
        if not wiki_result:
            print(f"     ⚠️  Aucun article pertinent trouvé")
            continue
        wiki_url, wiki_title = wiki_result
        print(f"  ↓  {wiki_url} [{wiki_title}]")
        html = fetch_url(wiki_url)
        if not html:
            time.sleep(REQUEST_DELAY)
            continue

        title, content = extract_text_wikipedia(html)
        path = save_file(slug, wiki_url, title, content)
        if path:
            print(f"     ✅ {os.path.basename(path)} ({len(content)}c)")
            created += 1
            break
        else:
            print(f"     ⚠️  Contenu trop court")
        time.sleep(REQUEST_DELAY)

    # --- Source 2 : OEM statique (si dispo pour la catégorie) ---
    oem_urls = CATEGORY_OEM_URLS.get(cat, [])
    for url in oem_urls[:2]:  # max 2 OEM par gamme
        if dry_run:
            print(f"  ↓  [DRY-RUN] OEM : {url}")
            break

        print(f"  ↓  OEM : {url}")
        html = fetch_url(url)
        if not html:
            time.sleep(REQUEST_DELAY)
            continue

        title, content = extract_text_oem(html)
        # Filtrer au contenu pertinent à la gamme
        search_terms = GAMME_WIKI_QUERIES.get(slug, [slug.replace('-', ' ')])
        relevant = [l for l in content.split('\n')
                    if any(t.lower() in l.lower() for t in search_terms)
                    or l.startswith('## ') or l.startswith('- ')]
        filtered = '\n'.join(relevant) if len(relevant) > 5 else content

        path = save_file(slug, url, f"{title} — {slug}", filtered)
        if path:
            print(f"     ✅ {os.path.basename(path)} OEM ({len(filtered)}c)")
            created += 1
        time.sleep(REQUEST_DELAY)

    return created


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true', help='Ignore existing files, re-download')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--category', type=str)
    parser.add_argument('--gamme', type=str)
    args = parser.parse_args()

    print("=== download-oem-corpus.py ===")
    print(f"WEB_DIR : {WEB_DIR} ({len(os.listdir(WEB_DIR))} fichiers existants)")

    gammes = detect_needs_enrichment()

    if args.gamme:
        gammes = [g for g in gammes if g['slug'] == args.gamme]
    elif args.category:
        gammes = [g for g in gammes if g['category'] == args.category]

    if args.limit > 0:
        gammes = gammes[:args.limit]

    print(f"Gammes cibles : {len(gammes)}")
    if args.dry_run:
        print("[MODE DRY-RUN]\n")

    total_created = 0
    dl_index = build_download_index()

    for i, gamme in enumerate(gammes, 1):
        slug = gamme['slug']
        n = dl_index.get(slug, 0)
        if n > 0 and not args.force:
            print(f"[{i}/{len(gammes)}] {slug} — ⏭️  {n} fichier(s) déjà présent(s)")
            continue

        print(f"\n[{i}/{len(gammes)}] {slug} (cat={gamme['category']}, basket={gamme['avg_basket']}€)")
        created = process_gamme(gamme, dry_run=args.dry_run)
        total_created += created

    print(f"\n=== RÉSULTAT ===")
    print(f"Fichiers créés : {total_created}")
    print(f"\nProchaine étape :")
    print(f"  python3 scripts/rag/rag-enrich-from-web-corpus.py")
    print(f"  python3 scripts/rag/ingest-oem-enriched-gammes.py")


if __name__ == "__main__":
    main()
