/**
 * 🧪 Tests de Non-Régression - URL Pièces
 * 
 * Garantit que les pages produits retournent toujours des articles
 * pour éviter les désindexations SEO
 */

import { describe, it, expect } from '@jest/globals';

describe('SEO - Pages Pièces avec Articles', () => {
  const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
  
  // URLs critiques à tester (format attendu de production)
  const CRITICAL_URLS = [
    {
      name: 'Filtre à huile Renault Clio III 1.5 dCi',
      typeId: 19052,
      pgId: 7,
      frontendUrl: '/pieces/filtre-a-huile-7/renault-140/clio-iii-140004/1-5-dci-19052.html',
      minExpectedPieces: 1, // Au moins 1 pièce attendue
    },
    {
      name: 'Plaquettes de frein Peugeot 208',
      typeId: 128049,
      pgId: 402,
      frontendUrl: '/pieces/plaquettes-de-frein-402/peugeot-19/208-128/1-2-puretech-128049.html',
      minExpectedPieces: 1,
    },
  ];

  describe('Validation des IDs', () => {
    it.each(CRITICAL_URLS)(
      'devrait valider les IDs pour $name',
      ({ typeId, pgId }) => {
        // Vérifier que les IDs sont valides
        expect(typeId).toBeGreaterThan(0);
        expect(pgId).toBeGreaterThan(0);
        expect(Number.isInteger(typeId)).toBe(true);
        expect(Number.isInteger(pgId)).toBe(true);
      }
    );
  });

  describe('API Backend - Retour de Pièces', () => {
    it.each(CRITICAL_URLS)(
      'devrait retourner des pièces pour $name (type=$typeId, gamme=$pgId)',
      async ({ name, typeId, pgId, minExpectedPieces }) => {
        const url = `${API_BASE_URL}/api/catalog/pieces/php-logic/${typeId}/${pgId}`;
        
        const response = await fetch(url);
        expect(response.ok).toBe(true);
        
        const data = await response.json();
        
        // Vérifications critiques SEO
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.pieces).toBeDefined();
        expect(Array.isArray(data.data.pieces)).toBe(true);
        expect(data.data.count).toBeGreaterThanOrEqual(minExpectedPieces);
        
        // Log pour debugging
        console.log(`✅ ${name}: ${data.data.count} pièces trouvées`);
      },
      10000 // timeout 10s
    );
  });

  describe('Parsing URL - Extraction IDs', () => {
    // Fonction de parsing (copie de la fonction utils)
    function parseUrlParam(param: string): { alias: string; id: number } {
      const parts = param.split('-');
      for (let i = parts.length - 1; i >= 0; i--) {
        const id = parseInt(parts[i]);
        if (!isNaN(id) && id > 0) {
          const alias = parts.slice(0, i).join('-');
          return { alias, id };
        }
      }
      return { alias: param, id: 0 };
    }

    it('devrait extraire correctement les IDs des segments URL', () => {
      const tests = [
        { input: 'filtre-a-huile-7', expected: { alias: 'filtre-a-huile', id: 7 } },
        { input: 'renault-140', expected: { alias: 'renault', id: 140 } },
        { input: 'clio-iii-140004', expected: { alias: 'clio-iii', id: 140004 } },
        { input: '1-5-dci-19052', expected: { alias: '1-5-dci', id: 19052 } },
      ];

      tests.forEach(({ input, expected }) => {
        const result = parseUrlParam(input);
        expect(result).toEqual(expected);
      });
    });

    it('devrait retourner id=0 si aucun ID trouvé', () => {
      const result = parseUrlParam('filtre-a-huile');
      expect(result.alias).toBe('filtre-a-huile');
      expect(result.id).toBe(0);
    });
  });

  describe('Validation Complète - Flux End-to-End', () => {
    it.each(CRITICAL_URLS)(
      'E2E: URL $frontendUrl devrait afficher des pièces',
      async ({ frontendUrl, typeId, pgId, minExpectedPieces }) => {
        // 1. Parser l'URL
        const segments = frontendUrl.split('/').filter(Boolean);
        const gammeParam = segments[1]; // filtre-a-huile-7
        const marqueParam = segments[2]; // renault-140
        const modeleParam = segments[3]; // clio-iii-140004
        const typeParam = segments[4].replace('.html', ''); // 1-5-dci-19052

        function parseUrlParam(param: string) {
          const parts = param.split('-');
          for (let i = parts.length - 1; i >= 0; i--) {
            const id = parseInt(parts[i]);
            if (!isNaN(id) && id > 0) {
              return { alias: parts.slice(0, i).join('-'), id };
            }
          }
          return { alias: param, id: 0 };
        }

        const gamme = parseUrlParam(gammeParam);
        const _marque = parseUrlParam(marqueParam);
        const _modele = parseUrlParam(modeleParam);
        const type = parseUrlParam(typeParam);

        // 2. Vérifier extraction IDs
        expect(type.id).toBe(typeId);
        expect(gamme.id).toBe(pgId);
        expect(type.id).toBeGreaterThan(0);
        expect(gamme.id).toBeGreaterThan(0);

        // 3. Appel API avec IDs extraits
        const apiUrl = `${API_BASE_URL}/api/catalog/pieces/php-logic/${type.id}/${gamme.id}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        // 4. Validation finale
        expect(data.success).toBe(true);
        expect(data.data.count).toBeGreaterThanOrEqual(minExpectedPieces);
        
        console.log(`✅ E2E ${frontendUrl}: ${data.data.count} pièces`);
      },
      15000
    );
  });
});
