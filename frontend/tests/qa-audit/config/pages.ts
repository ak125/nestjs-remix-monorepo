/**
 * QA Audit H24 — 50 pages to audit
 */

export interface AuditPage {
  name: string;
  url: string;
  category: 'core' | 'product' | 'vehicle' | 'blog' | 'auth' | 'commerce' | 'legal' | 'seo' | 'admin';
  expectedStatus?: number; // default 200
  fetchOnly?: boolean;     // skip Playwright navigation, use fetch instead
  requiresAuth?: boolean;
}

export const AUDIT_PAGES: AuditPage[] = [
  // ─── Core (5) ─────────────────────────────────────────
  { name: 'Homepage', url: '/', category: 'core' },
  { name: 'Search', url: '/search?q=filtre', category: 'core' },
  { name: 'Search CNIT', url: '/search/cnit', category: 'core' },
  { name: 'Catalogue', url: '/catalogue', category: 'core' },
  { name: 'Brands', url: '/brands', category: 'core' },

  // ─── Product / Gamme (10) ─────────────────────────────
  { name: 'Plaquette de frein', url: '/pieces/plaquette-de-frein-402.html', category: 'product' },
  { name: 'Disque de frein', url: '/pieces/disque-de-frein-82.html', category: 'product' },
  { name: 'Filtre a huile', url: '/pieces/filtre-a-huile-1.html', category: 'product' },
  { name: 'Amortisseur', url: '/pieces/amortisseur-13.html', category: 'product' },
  { name: 'Bougie allumage', url: '/pieces/bougie-d-allumage-187.html', category: 'product' },
  { name: 'Kit embrayage', url: '/pieces/kit-d-embrayage-479.html', category: 'product' },
  { name: 'Radiateur', url: '/pieces/radiateur-50.html', category: 'product' },
  { name: 'Alternateur', url: '/pieces/alternateur-62.html', category: 'product' },
  { name: 'Demarreur', url: '/pieces/demarreur-63.html', category: 'product' },
  { name: 'Courroie distribution', url: '/pieces/courroie-de-distribution-189.html', category: 'product' },

  // ─── Vehicle (4) ──────────────────────────────────────
  { name: 'Marques', url: '/marques', category: 'vehicle' },
  { name: 'Reference auto', url: '/reference-auto', category: 'vehicle' },
  { name: 'Diagnostic auto', url: '/diagnostic-auto', category: 'vehicle' },
  { name: 'Constructeurs', url: '/constructeurs', category: 'vehicle', expectedStatus: 404 },

  // ─── Blog / Content (5) ───────────────────────────────
  { name: 'Blog index', url: '/blog-pieces-auto', category: 'blog' },
  { name: 'Plan du site', url: '/plan-du-site', category: 'blog' },
  { name: 'Aide', url: '/aide', category: 'blog' },
  { name: 'Support', url: '/support', category: 'blog' },
  { name: 'FAQ', url: '/faq', category: 'blog', expectedStatus: 404 },

  // ─── Auth (4) ─────────────────────────────────────────
  { name: 'Login', url: '/login', category: 'auth' },
  { name: 'Register', url: '/register', category: 'auth' },
  { name: 'Forgot password', url: '/forgot-password', category: 'auth' },
  { name: 'Account (redirect)', url: '/account', category: 'auth' },

  // ─── Commerce (4) ─────────────────────────────────────
  { name: 'Cart', url: '/cart', category: 'commerce' },
  { name: 'Checkout', url: '/checkout', category: 'commerce' },
  { name: 'Dashboard', url: '/dashboard', category: 'commerce', requiresAuth: true },
  { name: 'Orders', url: '/orders', category: 'commerce', requiresAuth: true, expectedStatus: 404 },

  // ─── Legal (5) ────────────────────────────────────────
  { name: 'Mentions legales', url: '/mentions-legales', category: 'legal' },
  { name: 'Politique confidentialite', url: '/politique-confidentialite', category: 'legal' },
  { name: 'Politique cookies', url: '/politique-cookies', category: 'legal' },
  { name: 'CGV', url: '/conditions-generales-de-vente.html', category: 'legal' },
  { name: 'Contact', url: '/contact', category: 'legal' },

  // ─── SEO / Technical (8) ──────────────────────────────
  { name: 'Sitemap XML', url: '/sitemap.xml', category: 'seo', fetchOnly: true },
  { name: 'Robots.txt', url: '/robots.txt', category: 'seo', fetchOnly: true },
  { name: 'Page 404', url: '/page-qui-nexiste-pas-12345', category: 'seo', expectedStatus: 404 },
  { name: 'API Health', url: '/health', category: 'seo', fetchOnly: true },
  { name: 'API Families', url: '/api/catalog/families', category: 'seo', fetchOnly: true },

  // ─── Admin (5) ────────────────────────────────────────
  { name: 'Admin index', url: '/admin', category: 'admin', requiresAuth: true, expectedStatus: 404 },
  { name: 'Admin SEO hub', url: '/admin/seo-hub', category: 'admin', requiresAuth: true, expectedStatus: 404 },
  { name: 'Admin articles', url: '/admin/articles', category: 'admin', requiresAuth: true, expectedStatus: 404 },
  { name: 'Admin payments', url: '/admin/payments', category: 'admin', requiresAuth: true, expectedStatus: 404 },
  { name: 'Unauthorized', url: '/unauthorized', category: 'admin' },
];

/** Pages that can be navigated with Playwright (not fetchOnly) */
export const NAVIGABLE_PAGES = AUDIT_PAGES.filter(p => !p.fetchOnly);

/** Pages that don't require auth */
export const PUBLIC_PAGES = AUDIT_PAGES.filter(p => !p.requiresAuth);

/** Public navigable pages (main test target) */
export const PUBLIC_NAVIGABLE_PAGES = AUDIT_PAGES.filter(p => !p.fetchOnly && !p.requiresAuth);
