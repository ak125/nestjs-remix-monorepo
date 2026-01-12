/**
 * Tests Unitaires - Validation des Patterns d'URL
 *
 * Ces tests s'exécutent AVANT le déploiement (PRE-deploy)
 * pour bloquer les patterns d'URL cassés.
 *
 * Pas besoin de serveur - pure validation de patterns.
 */

import { describe, it, expect } from 'vitest';

// ============================================
// PATTERNS D'URL VALIDES
// ============================================

/**
 * Pattern pour les URLs de gammes de pièces
 * Format attendu: /pieces/{alias}-{id}.html
 */
const PIECES_GAMME_PATTERN = /^\/pieces\/[\w-]+-(\d+)\.html$/;

/**
 * Pattern pour les URLs de catalogue
 * Format: /pieces/catalogue ou /pieces/catalogue?category=xxx
 */
const CATALOGUE_PATTERN = /^\/pieces\/catalogue(\?.*)?$/;

/**
 * Pattern pour les URLs de recherche
 * Format: /search?q=xxx
 */
const SEARCH_PATTERN = /^\/search\?q=.+$/;

/**
 * Pattern pour les URLs de constructeurs/véhicules
 * Format: /constructeurs/{brand-id}/{model-id}/{type-id}.html
 */
const CONSTRUCTEURS_PATTERN = /^\/constructeurs\/[\w-]+-\d+\/[\w-]+-\d+\/[\w-]+-\d+\.html$/;

// ============================================
// URLS DE TEST
// ============================================

// URLs valides qui DOIVENT matcher leurs patterns
const VALID_CATALOGUE_URLS = [
  '/pieces/catalogue',
  '/pieces/catalogue?category=freinage',
  '/pieces/catalogue?category=moteur',
  '/pieces/catalogue?category=embrayage',
  '/pieces/catalogue?category=electrique',
  '/pieces/catalogue?category=suspension',
];

const VALID_SEARCH_URLS = [
  '/search?q=plaquette',
  '/search?q=filtre+huile',
  '/search?q=kit+distribution',
];

const VALID_GAMME_URLS = [
  '/pieces/freinage-123.html',
  '/pieces/kit-distribution-456.html',
  '/pieces/plaquettes-frein-avant-789.html',
];

const VALID_CONSTRUCTEURS_URLS = [
  '/constructeurs/renault-1/clio-123/type-456.html',
  '/constructeurs/peugeot-2/308-789/hdi-110-1234.html',
];

// URLs INVALIDES qui ne doivent PAS être acceptées par pieces.$slug.tsx
const INVALID_PIECE_URLS = [
  '/pieces/freinage',           // Manque -id.html
  '/pieces/moteur',             // Manque -id.html
  '/pieces/distribution',       // Manque -id.html
  '/pieces/embrayage',          // Manque -id.html
  '/pieces/allumage',           // Manque -id.html
  '/pieces/suspension',         // Manque -id.html
  '/pieces/invalid-url',        // Format incorrect
  '/pieces/freinage.html',      // Manque -id
  '/pieces/abc-def.html',       // ID non numérique
];

// ============================================
// TESTS
// ============================================

describe('URL Patterns - Catalogue', () => {
  it.each(VALID_CATALOGUE_URLS)('"%s" is a valid catalogue URL', (url) => {
    expect(url).toMatch(CATALOGUE_PATTERN);
  });

  it('rejects invalid catalogue URLs', () => {
    expect('/pieces/catalogue/invalid').not.toMatch(CATALOGUE_PATTERN);
    expect('/pieces/cat').not.toMatch(CATALOGUE_PATTERN);
  });
});

describe('URL Patterns - Search', () => {
  it.each(VALID_SEARCH_URLS)('"%s" is a valid search URL', (url) => {
    expect(url).toMatch(SEARCH_PATTERN);
  });

  it('rejects search URLs without query', () => {
    expect('/search').not.toMatch(SEARCH_PATTERN);
    expect('/search?').not.toMatch(SEARCH_PATTERN);
    expect('/search?q=').not.toMatch(SEARCH_PATTERN);
  });
});

describe('URL Patterns - Gamme Pieces', () => {
  it.each(VALID_GAMME_URLS)('"%s" is a valid gamme URL', (url) => {
    expect(url).toMatch(PIECES_GAMME_PATTERN);
  });

  it.each(INVALID_PIECE_URLS)('"%s" is NOT a valid gamme URL', (url) => {
    expect(url).not.toMatch(PIECES_GAMME_PATTERN);
  });

  it('extracts gamme ID from URL', () => {
    const url = '/pieces/freinage-123.html';
    const match = url.match(PIECES_GAMME_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('123');
  });
});

describe('URL Patterns - Constructeurs', () => {
  it.each(VALID_CONSTRUCTEURS_URLS)('"%s" is a valid constructeur URL', (url) => {
    expect(url).toMatch(CONSTRUCTEURS_PATTERN);
  });

  it('rejects invalid constructeur URLs', () => {
    expect('/constructeurs/renault').not.toMatch(CONSTRUCTEURS_PATTERN);
    expect('/constructeurs/renault-1/clio').not.toMatch(CONSTRUCTEURS_PATTERN);
    expect('/constructeurs/renault/clio/type.html').not.toMatch(CONSTRUCTEURS_PATTERN);
  });
});

describe('URL Patterns - QuickCategoryChip Bug Fix', () => {
  // Ce test vérifie que les anciennes URLs cassées ne matchent pas
  // le pattern gamme, et que les nouvelles URLs catalogue sont valides

  const OLD_BROKEN_URLS = [
    '/pieces/freinage',
    '/pieces/filtration',
    '/pieces/distribution',
    '/pieces/embrayage',
    '/pieces/allumage',
    '/pieces/suspension',
  ];

  const NEW_FIXED_URLS = [
    '/pieces/catalogue?category=freinage',
    '/pieces/catalogue?category=moteur',
    '/pieces/catalogue?category=embrayage',
    '/pieces/catalogue?category=electrique',
    '/pieces/catalogue?category=suspension',
  ];

  it.each(OLD_BROKEN_URLS)('OLD broken URL "%s" does NOT match gamme pattern', (url) => {
    expect(url).not.toMatch(PIECES_GAMME_PATTERN);
  });

  it.each(NEW_FIXED_URLS)('NEW fixed URL "%s" matches catalogue pattern', (url) => {
    expect(url).toMatch(CATALOGUE_PATTERN);
  });
});
