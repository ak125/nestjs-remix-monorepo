/**
 * 🧪 Tests d'intégration - Dashboard Commercial
 * 
 * Tests complets pour valider :
 * - API Endpoints du dashboard commercial
 * - Intégration avec les vraies données
 * - Performance et cache
 * - Sécurité et authentification
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DashboardModule } from '../dashboard.module';

describe('Commercial Dashboard API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DashboardModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('internal-call', 'true')
        .expect(200);

      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('totalOrders');
      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('seoStats');
      
      // Valider les types de données
      expect(typeof response.body.totalUsers).toBe('number');
      expect(typeof response.body.totalRevenue).toBe('number');
      expect(response.body.seoStats).toHaveProperty('totalPages');
      expect(response.body.seoStats).toHaveProperty('completionRate');
    });

    it('should return stats within performance limits', async () => {
      const start = Date.now();
      
      await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('internal-call', 'true')
        .expect(200);
        
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000); // < 2 secondes
    });
  });

  describe('GET /api/dashboard/orders/recent', () => {
    it('should return recent orders with correct structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/orders/recent')
        .set('internal-call', 'true')
        .expect(200);

      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.orders)).toBe(true);
      
      // Vérifier structure des commandes
      if (response.body.orders.length > 0) {
        const order = response.body.orders[0];
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('total');
        expect(order).toHaveProperty('date');
        expect(typeof order.total).toBe('number');
      }
    });

    it('should handle null/undefined values gracefully', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/dashboard/orders/recent')
        .set('internal-call', 'true')
        .expect(200);

      // Vérifier que tous les ordres ont des valeurs valides ou nulles explicites
      response.body.orders.forEach((order: any) => {
        expect(['string', 'object']).toContain(typeof order.status); // null ok
        expect(['number', 'object']).toContain(typeof order.total);  // null ok mais converti en 0
      });
    });
  });

  describe('Security Tests', () => {
    it('should reject requests without internal-call header', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .expect(403); // ou selon votre configuration
    });

    it('should handle malformed requests gracefully', async () => {
      await request(app.getHttpServer())
        .get('/api/dashboard/stats?malformed="><script>')
        .set('internal-call', 'true')
        .expect(200); // Ne doit pas planter
    });
  });

  describe('Cache Performance Tests', () => {
    it('should cache dashboard stats for better performance', async () => {
      const response1Start = Date.now();
      const response1 = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('internal-call', 'true');
      const response1Time = Date.now() - response1Start;

      const response2Start = Date.now();
      const response2 = await request(app.getHttpServer())
        .get('/api/dashboard/stats')
        .set('internal-call', 'true');
      const response2Time = Date.now() - response2Start;

      // La 2ème requête devrait être plus rapide (cache)
      expect(response2Time).toBeLessThanOrEqual(response1Time);
      expect(response1.body).toEqual(response2.body);
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency across multiple calls', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/api/dashboard/stats').set('internal-call', 'true'),
        request(app.getHttpServer()).get('/api/dashboard/stats').set('internal-call', 'true'),
        request(app.getHttpServer()).get('/api/dashboard/stats').set('internal-call', 'true')
      ]);

      // Les totaux devraient être cohérents
      const users1 = responses[0].body.totalUsers;
      const users2 = responses[1].body.totalUsers;
      const users3 = responses[2].body.totalUsers;

      expect(Math.abs(users1 - users2)).toBeLessThanOrEqual(100); // Variation acceptable
      expect(Math.abs(users2 - users3)).toBeLessThanOrEqual(100);
    });
  });
});
