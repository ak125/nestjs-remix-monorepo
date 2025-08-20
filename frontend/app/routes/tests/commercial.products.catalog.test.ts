/**
 * Tests pour la route commercial.products.catalog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock des dépendances Remix
const mockJson = vi.fn();
const mockRequireUser = vi.fn();
const mockFetch = vi.fn();

vi.mock('@remix-run/node', () => ({
  json: mockJson,
  redirect: vi.fn(),
}));

vi.mock('../auth/unified.server', () => ({
  requireUser: mockRequireUser,
}));

global.fetch = mockFetch;

describe('commercial.products.catalog - Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'http://localhost:3000';
  });

  it('devrait charger le catalogue avec succès', async () => {
    // Mock de l'utilisateur authentifié
    mockRequireUser.mockResolvedValue({
      id: 'test-user',
      level: 5,
      isPro: true,
    });

    // Mock de la réponse API
    const mockApiResponse = {
      products: [
        {
          piece_id: '1',
          piece_name: 'Disque de frein avant',
          piece_ref: 'DF001',
          piece_activ: true,
          piece_top: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 24,
      totalPages: 1,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    });

    mockJson.mockImplementation((data) => data);

    // Import dynamique du loader pour éviter les problèmes d'ordre
    const { loader } = await import('../routes/commercial.products.catalog');

    const request = new Request('http://localhost:3000/commercial/products/catalog');
    const context = {};

    const result = await loader({ request, context });

    expect(mockRequireUser).toHaveBeenCalledWith({ context });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/products/pieces-catalog?search=&page=1&limit=24',
      { headers: { 'internal-call': 'true' } }
    );
    expect(mockJson).toHaveBeenCalledWith({
      products: mockApiResponse.products,
      total: 1,
      page: 1,
      limit: 24,
      totalPages: 1,
      searchTerm: '',
    });
  });

  it('devrait gérer la recherche dans les paramètres URL', async () => {
    mockRequireUser.mockResolvedValue({
      id: 'test-user',
      level: 5,
      isPro: true,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        products: [],
        total: 0,
        page: 1,
        limit: 24,
        totalPages: 0,
      }),
    });

    mockJson.mockImplementation((data) => data);

    const { loader } = await import('../routes/commercial.products.catalog');

    const request = new Request('http://localhost:3000/commercial/products/catalog?search=frein&page=2&limit=12');
    const context = {};

    await loader({ request, context });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/products/pieces-catalog?search=frein&page=2&limit=12',
      { headers: { 'internal-call': 'true' } }
    );
  });

  it('devrait rediriger si utilisateur non autorisé', async () => {
    mockRequireUser.mockResolvedValue({
      id: 'test-user',
      level: 2, // Niveau insuffisant
      isPro: true,
    });

    const { redirect } = await import('@remix-run/node');

    const { loader } = await import('../routes/commercial.products.catalog');

    const request = new Request('http://localhost:3000/commercial/products/catalog');
    const context = {};

    try {
      await loader({ request, context });
    } catch (error) {
      // Devrait lever une exception de redirection
    }

    expect(redirect).toHaveBeenCalledWith('/unauthorized');
  });

  it('devrait gérer les erreurs API', async () => {
    mockRequireUser.mockResolvedValue({
      id: 'test-user',
      level: 5,
      isPro: true,
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    mockJson.mockImplementation((data) => data);

    const { loader } = await import('../routes/commercial.products.catalog');

    const request = new Request('http://localhost:3000/commercial/products/catalog');
    const context = {};

    const result = await loader({ request, context });

    expect(mockJson).toHaveBeenCalledWith({
      products: [],
      total: 0,
      page: 1,
      limit: 24,
      totalPages: 0,
      searchTerm: '',
      error: 'Impossible de charger le catalogue',
    });
  });

  it('devrait limiter la taille de page', async () => {
    mockRequireUser.mockResolvedValue({
      id: 'test-user',
      level: 5,
      isPro: true,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        products: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
      }),
    });

    mockJson.mockImplementation((data) => data);

    const { loader } = await import('../routes/commercial.products.catalog');

    const request = new Request('http://localhost:3000/commercial/products/catalog?limit=200');
    const context = {};

    await loader({ request, context });

    // Vérifie que la limite est appliquée à 100
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=100'),
      { headers: { 'internal-call': 'true' } }
    );
  });
});
