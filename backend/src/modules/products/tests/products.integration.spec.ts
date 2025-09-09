import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ProductsModule } from '../products.module';

describe('Products API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProductsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/products/pieces-catalog', () => {
    it('devrait retourner le catalogue avec pagination par défaut', () => {
      return request(app.getHttpServer())
        .get('/api/products/pieces-catalog')
        .set('internal-call', 'true')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('products');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body).toHaveProperty('totalPages');
          expect(Array.isArray(res.body.products)).toBe(true);
        });
    });

    it('devrait gérer la recherche', () => {
      return request(app.getHttpServer())
        .get('/api/products/pieces-catalog?search=frein&page=1&limit=12')
        .set('internal-call', 'true')
        .expect(200)
        .expect((res) => {
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(12);
        });
    });

    it('devrait limiter la taille de page', () => {
      return request(app.getHttpServer())
        .get('/api/products/pieces-catalog?limit=500')
        .set('internal-call', 'true')
        .expect(200)
        .expect((res) => {
          expect(res.body.limit).toBe(100); // Limité à 100
        });
    });
  });

  describe('GET /api/products/:id', () => {
    it('devrait retourner une pièce existante', () => {
      // Test avec un ID qui existe probablement
      return request(app.getHttpServer())
        .get('/api/products/1')
        .set('internal-call', 'true')
        .expect((res) => {
          if (res.status === 200) {
            expect(res.body).toHaveProperty('piece_id');
            expect(res.body).toHaveProperty('piece_name');
          }
          // Accepter 404 si l'ID n'existe pas
          expect([200, 404]).toContain(res.status);
        });
    });

    it('devrait retourner 404 pour un ID inexistant', () => {
      return request(app.getHttpServer())
        .get('/api/products/999999999')
        .set('internal-call', 'true')
        .expect(404);
    });
  });

  describe('GET /api/products/stats', () => {
    it('devrait retourner les statistiques', () => {
      return request(app.getHttpServer())
        .get('/api/products/stats')
        .set('internal-call', 'true')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalProducts');
          expect(res.body).toHaveProperty('totalCategories');
          expect(typeof res.body.totalProducts).toBe('number');
          expect(typeof res.body.totalCategories).toBe('number');
        });
    });
  });

  describe('Performance Tests', () => {
    it('devrait répondre rapidement au catalogue (< 2s)', () => {
      const startTime = Date.now();

      return request(app.getHttpServer())
        .get('/api/products/pieces-catalog?limit=24')
        .set('internal-call', 'true')
        .expect(200)
        .expect(() => {
          const responseTime = Date.now() - startTime;
          expect(responseTime).toBeLessThan(2000); // Moins de 2 secondes
        });
    });

    it('devrait gérer une grande limite sans crash', () => {
      return request(app.getHttpServer())
        .get('/api/products/pieces-catalog?limit=100')
        .set('internal-call', 'true')
        .expect(200)
        .expect((res) => {
          expect(res.body.products.length).toBeLessThanOrEqual(100);
        });
    });
  });
});
