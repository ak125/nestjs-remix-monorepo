/**
 * robots.txt — SOURCE UNIQUE de la politique d'exploration.
 *
 * Consommateurs :
 *  - backend `RobotsTxtService` → GET /api/seo/robots.txt (corps normal) ;
 *  - frontend `routes/robots[.]txt.tsx` → repli servi quand le backend ne
 *    répond pas (avant 2026-09-11 : une AUTRE politique codée en dur, avec
 *    `Disallow: /account/`, sans blocage des bots, 4 sitemaps).
 *
 * Sémantique Google (https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt) :
 *  - un robot n'applique QUE le groupe `User-agent` le plus spécifique qui le
 *    nomme ; les règles de `User-agent: *` ne s'ajoutent PAS au groupe Googlebot ;
 *  - la règle la plus longue l'emporte, égalité → la moins restrictive (Allow) ;
 *  - `Crawl-delay` n'est pas pris en charge par Google.
 *
 * Décisions owner 2026-09-11 (groupe Googlebot) : recherche interne `/search`
 * bloquée (pages noindex, 0 URL avec impressions dans GSC) ; `Crawl-delay`
 * retiré ; panier / commande / compte et paramètres de tracking restent
 * explorables pour que noindex et canonical soient lus. Aucun autre groupe ne
 * change. Hors production, tout est bloqué.
 *
 * Exposé via le sous-chemin `@repo/seo-url-contract/robots-policy`, PAS via le
 * barrel : le barrel (CommonJS) est importé par du code client, le gabarit n'a
 * rien à faire dans le bundle navigateur.
 */

export interface RobotsTxtOptions {
  /** `true` = politique d'exploration publique ; `false` = tout bloquer. */
  production: boolean;
  /** Origine publique sans slash final, utilisée pour la ligne `Sitemap:`. */
  baseUrl: string;
  /** Instant de génération (défaut : maintenant) — injectable pour des sorties déterministes. */
  now?: Date;
}

/** Même critère que le backend : seul `NODE_ENV=production` publie la politique publique. */
export function isRobotsProductionEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === "production";
}

export function buildRobotsTxt(options: RobotsTxtOptions): string {
  const now = options.now ?? new Date();
  return options.production
    ? productionRobotsTxt(options.baseUrl, now)
    : developmentRobotsTxt(now);
}

/**
 * Structure héritée du système PHP :
 * - Disallow: /_form.get.car.* (formulaires AJAX)
 * - Disallow: /fiche/ (fiches produits - duplicate content)
 * - Disallow: /find/ (recherche générale)
 * - Disallow: /searchmine/ (recherche par type mine)
 * - /account/ retiré du Disallow (pages ont noindex meta tag, robots.txt empêchait GSC de le lire)
 *
 * Non bloqué (stratégie positive) :
 * - /constructeurs/ → R7 marque + R8 véhicule indexés (Allow de section).
 *   L'index /constructeurs et le niveau-modèle 2-seg renvoient 404/410 (ADR-084) ;
 *   l'Allow doit rester pour laisser Googlebot lire le noindex/410.
 * - /pieces/ → Indexé (sitemap gammes produits)
 * - /blog-pieces-auto/ → Indexé (sitemap blog)
 * - / → Indexé (homepage)
 */
function productionRobotsTxt(baseUrl: string, now: Date): string {
  const day = now.toISOString().split("T")[0];
  return `# ===========================================
# 🤖 ROBOTS.TXT PRODUCTION - AutoMecanik.com
# ===========================================
# Migré depuis PHP le ${day}
# Structure alignée sur l'ancien système
# ===========================================

# 🌍 Règles par défaut (tous les crawlers)
User-agent: *
Allow: /

# ❌ Blocages hérités du système PHP
Disallow: /_form.get.car.*    # Formulaires AJAX sélection véhicule
Disallow: /fiche/              # Fiches produits (duplicate avec /pieces/)
Disallow: /find/               # Résultats recherche générale
Disallow: /searchmine/         # Recherche par type mine
# /account/ retiré : les pages ont noindex meta tag, robots.txt empêchait Google de le lire (GSC issue)

# ❌ Blocages additionnels NestJS
Disallow: /api/                # Endpoints API REST
Disallow: /admin/              # Backoffice administration
Disallow: /checkout/           # Processus de commande
Disallow: /cart/               # Panier d'achat
Disallow: /private/            # Ressources privées
Disallow: /img/                # Proxy images brutes

# ❌ Paramètres de tracking (éviter duplicate content)
Disallow: /*?utm_*
Disallow: /*?fbclid=*
Disallow: /*?gclid=*
Disallow: /search?*

# ⏱️ Crawl-delay recommandé
Crawl-delay: 1

# 🤖 Googlebot (prioritaire, sans délai)
# Seul groupe lu par Googlebot : les règles de * ne s'y ajoutent pas.
# Recherche interne bloquée (noindex) ; panier, commande, compte et tracking restent explorables.
User-agent: Googlebot
Allow: /
Disallow: /_form.get.car.*
Disallow: /fiche/
Disallow: /find/
Disallow: /searchmine/
Disallow: /api/
Disallow: /admin/
Disallow: /img/
Disallow: /search?*
Disallow: /search/

# 🖼️ Googlebot-Image (autorisé sur /images/)
User-agent: Googlebot-Image
Allow: /
Allow: /images/
Allow: /uploads/
Disallow: /api/

# 🛒 Googlebot-Shopping (e-commerce)
User-agent: Googlebot-Shopping
Allow: /pieces/
Allow: /constructeurs/
Disallow: /api/
Disallow: /fiche/

# 🔍 Bingbot
User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /fiche/
Crawl-delay: 1

# 🚫 Bad bots SEO (bloquer complètement)
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

User-agent: DotBot
Disallow: /

User-agent: BLEXBot
Disallow: /

User-agent: DataForSeoBot
Disallow: /

User-agent: serpstatbot
Disallow: /

User-agent: SEOkicks
Disallow: /

# 🇨🇳 Bots chinois agressifs
User-agent: Baiduspider
Disallow: /

User-agent: Baiduspider-image
Disallow: /

User-agent: Baiduspider-video
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Sogou
Disallow: /

User-agent: sogou spider
Disallow: /

User-agent: YisouSpider
Disallow: /

User-agent: PetalBot
Disallow: /

User-agent: EtaoSpider
Disallow: /

# 🇷🇺 Bots russes
User-agent: YandexBot
Disallow: /

User-agent: YandexImages
Disallow: /

User-agent: YandexMedia
Disallow: /

User-agent: Mail.RU_Bot
Disallow: /

# 🤖 Bots IA / LLM (scraping pour entraînement)
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: Bytedance
Disallow: /

User-agent: Omgilibot
Disallow: /

User-agent: Cohere-ai
Disallow: /

# 🕷️ Scrapers et bots malveillants
User-agent: Scrapy
Disallow: /

User-agent: python-requests
Disallow: /

User-agent: Go-http-client
Disallow: /

User-agent: Java
Disallow: /

User-agent: libwww-perl
Disallow: /

User-agent: Wget
Disallow: /

User-agent: curl
Disallow: /

User-agent: HTTrack
Disallow: /

User-agent: WebCopier
Disallow: /

User-agent: TurnitinBot
Disallow: /

User-agent: Nutch
Disallow: /

User-agent: ZoominfoBot
Disallow: /

User-agent: archive.org_bot
Disallow: /

User-agent: ia_archiver
Disallow: /

# ===========================================
# 📍 SITEMAPS
# ===========================================
# Index principal unique (contient tous les sitemaps thématiques)
# V6: sitemap-vehicules.xml inclut marques + modèles + types
Sitemap: ${baseUrl}/sitemap.xml

# ===========================================
# ℹ️ INFORMATIONS
# ===========================================
# Contact SEO: seo@automecanik.com
# Dernière mise à jour: ${day}
# ===========================================
`;
}

function developmentRobotsTxt(now: Date): string {
  return `# Robots.txt Development - DO NOT INDEX
# Generated: ${now.toISOString()}

# 🚫 Block all crawlers in development
User-agent: *
Disallow: /

# ℹ️ This is a development/staging environment
# Contact: dev@automecanik.com
`;
}
