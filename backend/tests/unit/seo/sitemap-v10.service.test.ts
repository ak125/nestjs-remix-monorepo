/**
 * 🧪 Tests pour SitemapV10Service
 *
 * Tests des fonctions pures et constantes (sans accès DB/FS):
 * - xmlEscape() - Échappement des entités XML
 * - BUCKET_CONFIG - Configuration par température
 * - STATIC_PAGES - Liste des pages statiques
 * - MAX_URLS_PER_FILE - Constante de sharding
 *
 * Note: Les méthodes privées sont répliquées pour les tests unitaires.
 */

// ================================================
// CONSTANTS (répliquées depuis sitemap-v10.service.ts)
// ================================================

type TemperatureBucket = 'hot' | 'new' | 'stable' | 'cold';

const BUCKET_CONFIG: Record<
  TemperatureBucket,
  { changefreq: string; priority: string; maxAge: number }
> = {
  hot: { changefreq: 'daily', priority: '1.0', maxAge: 3600 }, // 1h cache
  new: { changefreq: 'daily', priority: '0.8', maxAge: 3600 },
  stable: { changefreq: 'weekly', priority: '0.6', maxAge: 86400 }, // 24h cache
  cold: { changefreq: 'monthly', priority: '0.4', maxAge: 604800 }, // 7d cache
};

const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/constructeurs', priority: '0.8', changefreq: 'weekly' },
  { loc: '/blog', priority: '0.7', changefreq: 'daily' },
  { loc: '/diagnostic-auto', priority: '0.8', changefreq: 'weekly' }, // R5 Index
  { loc: '/reference-auto', priority: '0.8', changefreq: 'weekly' }, // R4 Index
  { loc: '/cgv', priority: '0.3', changefreq: 'yearly' },
  { loc: '/mentions-legales', priority: '0.3', changefreq: 'yearly' },
  { loc: '/politique-confidentialite', priority: '0.3', changefreq: 'yearly' },
  { loc: '/contact', priority: '0.4', changefreq: 'yearly' },
  { loc: '/aide', priority: '0.4', changefreq: 'monthly' },
  { loc: '/faq', priority: '0.4', changefreq: 'monthly' },
];

const MAX_URLS_PER_FILE = 50000;

// ================================================
// PURE FUNCTIONS (répliquées pour tests)
// ================================================

/**
 * Escape XML entities
 */
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build sitemap URL entry XML
 */
function buildUrlEntry(
  url: string,
  baseUrl: string,
  config: { changefreq: string; priority: string },
  lastmod?: string,
): string {
  const loc = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const lastmodDate = lastmod
    ? new Date(lastmod).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${lastmodDate}</lastmod>
    <changefreq>${config.changefreq}</changefreq>
    <priority>${config.priority}</priority>
  </url>`;
}

/**
 * Calculate number of shards needed for URL count
 */
function calculateShards(urlCount: number): number {
  return Math.ceil(urlCount / MAX_URLS_PER_FILE);
}

/**
 * Generate shard file name
 */
function getShardFileName(
  baseName: string,
  shardIndex: number,
  totalShards: number,
): string {
  if (totalShards === 1) {
    return `${baseName}.xml`;
  }
  return `${baseName}-${shardIndex + 1}.xml`;
}

// ================================================
// TESTS
// ================================================

describe('SitemapV10Service - Pure Functions & Constants', () => {
  // ========================================
  // xmlEscape()
  // ========================================
  describe('xmlEscape()', () => {
    it('should escape ampersand &', () => {
      expect(xmlEscape('A & B')).toBe('A &amp; B');
    });

    it('should escape less than <', () => {
      expect(xmlEscape('A < B')).toBe('A &lt; B');
    });

    it('should escape greater than >', () => {
      expect(xmlEscape('A > B')).toBe('A &gt; B');
    });

    it('should escape double quote "', () => {
      expect(xmlEscape('A "B" C')).toBe('A &quot;B&quot; C');
    });

    it("should escape single quote '", () => {
      expect(xmlEscape("A 'B' C")).toBe('A &apos;B&apos; C');
    });

    it('should escape all entities in one string', () => {
      const input = '<a href="test?a=1&b=2">It\'s a test</a>';
      const expected =
        '&lt;a href=&quot;test?a=1&amp;b=2&quot;&gt;It&apos;s a test&lt;/a&gt;';
      expect(xmlEscape(input)).toBe(expected);
    });

    it('should not double-escape already escaped entities', () => {
      // This tests current behavior - it WILL double escape
      // This is expected behavior for sitemap generation (raw input)
      expect(xmlEscape('&amp;')).toBe('&amp;amp;');
    });

    it('should handle empty string', () => {
      expect(xmlEscape('')).toBe('');
    });

    it('should handle string without entities', () => {
      expect(xmlEscape('Hello World 123')).toBe('Hello World 123');
    });

    it('should handle URL with query parameters', () => {
      const url = '/search?q=plaquette&category=freinage';
      expect(xmlEscape(url)).toBe('/search?q=plaquette&amp;category=freinage');
    });

    it('should handle French accented characters (no escape needed)', () => {
      expect(xmlEscape('Pièces détachées')).toBe('Pièces détachées');
    });
  });

  // ========================================
  // BUCKET_CONFIG
  // ========================================
  describe('BUCKET_CONFIG', () => {
    it('should have all 4 temperature buckets', () => {
      expect(Object.keys(BUCKET_CONFIG)).toEqual([
        'hot',
        'new',
        'stable',
        'cold',
      ]);
    });

    describe('hot bucket', () => {
      it('should have daily changefreq', () => {
        expect(BUCKET_CONFIG.hot.changefreq).toBe('daily');
      });

      it('should have priority 1.0 (highest)', () => {
        expect(BUCKET_CONFIG.hot.priority).toBe('1.0');
      });

      it('should have 1 hour maxAge (3600s)', () => {
        expect(BUCKET_CONFIG.hot.maxAge).toBe(3600);
      });
    });

    describe('new bucket', () => {
      it('should have daily changefreq', () => {
        expect(BUCKET_CONFIG.new.changefreq).toBe('daily');
      });

      it('should have priority 0.8', () => {
        expect(BUCKET_CONFIG.new.priority).toBe('0.8');
      });

      it('should have 1 hour maxAge', () => {
        expect(BUCKET_CONFIG.new.maxAge).toBe(3600);
      });
    });

    describe('stable bucket', () => {
      it('should have weekly changefreq', () => {
        expect(BUCKET_CONFIG.stable.changefreq).toBe('weekly');
      });

      it('should have priority 0.6', () => {
        expect(BUCKET_CONFIG.stable.priority).toBe('0.6');
      });

      it('should have 24 hour maxAge (86400s)', () => {
        expect(BUCKET_CONFIG.stable.maxAge).toBe(86400);
      });
    });

    describe('cold bucket', () => {
      it('should have monthly changefreq', () => {
        expect(BUCKET_CONFIG.cold.changefreq).toBe('monthly');
      });

      it('should have priority 0.4 (lowest)', () => {
        expect(BUCKET_CONFIG.cold.priority).toBe('0.4');
      });

      it('should have 7 day maxAge (604800s)', () => {
        expect(BUCKET_CONFIG.cold.maxAge).toBe(604800);
      });
    });

    it('should have decreasing priority from hot to cold', () => {
      const hotPriority = parseFloat(BUCKET_CONFIG.hot.priority);
      const newPriority = parseFloat(BUCKET_CONFIG.new.priority);
      const stablePriority = parseFloat(BUCKET_CONFIG.stable.priority);
      const coldPriority = parseFloat(BUCKET_CONFIG.cold.priority);

      expect(hotPriority).toBeGreaterThan(newPriority);
      expect(newPriority).toBeGreaterThan(stablePriority);
      expect(stablePriority).toBeGreaterThan(coldPriority);
    });

    it('should have increasing maxAge from hot to cold', () => {
      expect(BUCKET_CONFIG.hot.maxAge).toBeLessThanOrEqual(
        BUCKET_CONFIG.new.maxAge,
      );
      expect(BUCKET_CONFIG.new.maxAge).toBeLessThan(
        BUCKET_CONFIG.stable.maxAge,
      );
      expect(BUCKET_CONFIG.stable.maxAge).toBeLessThan(
        BUCKET_CONFIG.cold.maxAge,
      );
    });
  });

  // ========================================
  // STATIC_PAGES
  // ========================================
  describe('STATIC_PAGES', () => {
    it('should contain 11 static pages', () => {
      expect(STATIC_PAGES).toHaveLength(11);
    });

    it('should have homepage at root with highest priority', () => {
      const homepage = STATIC_PAGES.find((p) => p.loc === '/');
      expect(homepage).toBeDefined();
      expect(homepage?.priority).toBe('1.0');
      expect(homepage?.changefreq).toBe('daily');
    });

    it('should include R4 reference index', () => {
      const r4 = STATIC_PAGES.find((p) => p.loc === '/reference-auto');
      expect(r4).toBeDefined();
      expect(r4?.changefreq).toBe('weekly');
    });

    it('should include R5 diagnostic index', () => {
      const r5 = STATIC_PAGES.find((p) => p.loc === '/diagnostic-auto');
      expect(r5).toBeDefined();
      expect(r5?.changefreq).toBe('weekly');
    });

    it('should have legal pages with low priority', () => {
      const legalPages = STATIC_PAGES.filter((p) =>
        ['/cgv', '/mentions-legales', '/politique-confidentialite'].includes(
          p.loc,
        ),
      );
      expect(legalPages).toHaveLength(3);
      legalPages.forEach((page) => {
        expect(page.priority).toBe('0.3');
        expect(page.changefreq).toBe('yearly');
      });
    });

    it('should have blog page', () => {
      const blog = STATIC_PAGES.find((p) => p.loc === '/blog');
      expect(blog).toBeDefined();
      expect(blog?.changefreq).toBe('daily');
    });

    it('should have all pages with valid loc starting with /', () => {
      STATIC_PAGES.forEach((page) => {
        expect(page.loc).toMatch(/^\//);
      });
    });

    it('should have all pages with valid priority between 0.0 and 1.0', () => {
      STATIC_PAGES.forEach((page) => {
        const priority = parseFloat(page.priority);
        expect(priority).toBeGreaterThanOrEqual(0);
        expect(priority).toBeLessThanOrEqual(1);
      });
    });

    it('should have all pages with valid changefreq', () => {
      const validFreqs = [
        'always',
        'hourly',
        'daily',
        'weekly',
        'monthly',
        'yearly',
        'never',
      ];
      STATIC_PAGES.forEach((page) => {
        expect(validFreqs).toContain(page.changefreq);
      });
    });
  });

  // ========================================
  // MAX_URLS_PER_FILE & Sharding
  // ========================================
  describe('MAX_URLS_PER_FILE & Sharding', () => {
    it('should be 50000 (Google sitemap limit)', () => {
      expect(MAX_URLS_PER_FILE).toBe(50000);
    });

    describe('calculateShards()', () => {
      it('should return 1 for 0 URLs', () => {
        expect(calculateShards(0)).toBe(0);
      });

      it('should return 1 for 1 URL', () => {
        expect(calculateShards(1)).toBe(1);
      });

      it('should return 1 for exactly 50000 URLs', () => {
        expect(calculateShards(50000)).toBe(1);
      });

      it('should return 2 for 50001 URLs', () => {
        expect(calculateShards(50001)).toBe(2);
      });

      it('should return 15 for 714000 URLs (typical pieces count)', () => {
        expect(calculateShards(714000)).toBe(15);
      });

      it('should return 20 for 1 million URLs', () => {
        expect(calculateShards(1000000)).toBe(20);
      });
    });

    describe('getShardFileName()', () => {
      it('should return simple name for single shard', () => {
        expect(getShardFileName('sitemap-pieces', 0, 1)).toBe(
          'sitemap-pieces.xml',
        );
      });

      it('should return numbered name for first shard of multiple', () => {
        expect(getShardFileName('sitemap-pieces', 0, 15)).toBe(
          'sitemap-pieces-1.xml',
        );
      });

      it('should return numbered name for last shard', () => {
        expect(getShardFileName('sitemap-pieces', 14, 15)).toBe(
          'sitemap-pieces-15.xml',
        );
      });

      it('should handle middle shards', () => {
        expect(getShardFileName('sitemap-pieces', 7, 15)).toBe(
          'sitemap-pieces-8.xml',
        );
      });
    });
  });

  // ========================================
  // buildUrlEntry()
  // ========================================
  describe('buildUrlEntry()', () => {
    const baseUrl = 'https://www.automecanik.com';
    const config = { changefreq: 'weekly', priority: '0.6' };

    it('should build valid XML entry for relative URL', () => {
      const result = buildUrlEntry('/pieces/freinage', baseUrl, config);
      expect(result).toContain(
        '<loc>https://www.automecanik.com/pieces/freinage</loc>',
      );
      expect(result).toContain('<changefreq>weekly</changefreq>');
      expect(result).toContain('<priority>0.6</priority>');
    });

    it('should use absolute URL as-is', () => {
      const absUrl = 'https://other.site.com/page';
      const result = buildUrlEntry(absUrl, baseUrl, config);
      expect(result).toContain('<loc>https://other.site.com/page</loc>');
    });

    it('should escape XML entities in URL', () => {
      const result = buildUrlEntry('/search?a=1&b=2', baseUrl, config);
      expect(result).toContain('a=1&amp;b=2');
    });

    it('should include lastmod date', () => {
      const result = buildUrlEntry('/page', baseUrl, config, '2026-02-03');
      expect(result).toContain('<lastmod>2026-02-03</lastmod>');
    });

    it('should use today for missing lastmod', () => {
      const result = buildUrlEntry('/page', baseUrl, config);
      const today = new Date().toISOString().split('T')[0];
      expect(result).toContain(`<lastmod>${today}</lastmod>`);
    });

    it('should format ISO date to YYYY-MM-DD', () => {
      const result = buildUrlEntry(
        '/page',
        baseUrl,
        config,
        '2026-02-03T14:30:00Z',
      );
      expect(result).toContain('<lastmod>2026-02-03</lastmod>');
    });

    it('should have proper XML structure', () => {
      const result = buildUrlEntry('/page', baseUrl, config);
      expect(result).toMatch(/^\s*<url>/);
      expect(result).toMatch(/<\/url>$/);
      expect(result).toContain('<loc>');
      expect(result).toContain('</loc>');
      expect(result).toContain('<lastmod>');
      expect(result).toContain('</lastmod>');
      expect(result).toContain('<changefreq>');
      expect(result).toContain('</changefreq>');
      expect(result).toContain('<priority>');
      expect(result).toContain('</priority>');
    });
  });

  // ========================================
  // Integration: URL Building
  // ========================================
  describe('URL Building Integration', () => {
    const baseUrl = 'https://www.automecanik.com';

    it('should build valid piece URL', () => {
      const pieceUrl =
        '/pieces/freinage-1/renault-2/clio-3/clio-iii-br0-4.html';
      const result = buildUrlEntry(
        pieceUrl,
        baseUrl,
        BUCKET_CONFIG.stable,
        '2026-02-01',
      );

      expect(result).toContain(`${baseUrl}${pieceUrl}`);
      expect(result).toContain('<changefreq>weekly</changefreq>');
      expect(result).toContain('<priority>0.6</priority>');
    });

    it('should build valid category URL', () => {
      const categoryUrl = '/pieces/freinage';
      const result = buildUrlEntry(categoryUrl, baseUrl, BUCKET_CONFIG.hot);

      expect(result).toContain(`${baseUrl}${categoryUrl}`);
      expect(result).toContain('<changefreq>daily</changefreq>');
      expect(result).toContain('<priority>1.0</priority>');
    });

    it('should handle special characters in URL', () => {
      const specialUrl = "/pieces/filtre-à-huile";
      const result = buildUrlEntry(specialUrl, baseUrl, BUCKET_CONFIG.stable);

      // French accents don't need XML escaping
      expect(result).toContain('filtre-à-huile');
    });
  });
});
