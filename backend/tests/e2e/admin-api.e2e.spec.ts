/**
 * 🧪 TESTS E2E ADMIN API - Avec Authentification
 * 
 * Suite de tests complète pour valider l'API admin avec des tokens valides
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'AdminPassword123!';

// Helper: Obtenir un token admin valide
async function getAdminToken(page) {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });
  
  if (!response.ok()) {
    throw new Error('Failed to get admin token');
  }
  
  const data = await response.json();
  return data.token || data.access_token;
}

// Helper: Faire un appel API authentifié
async function authenticatedRequest(page, method, endpoint, body = null) {
  const token = await getAdminToken(page);
  
  const options = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.data = body;
  }
  
  return await page.request[method.toLowerCase()](`${API_URL}${endpoint}`, options);
}

test.describe('Admin API - Stock Management', () => {
  test('GET /api/admin/stock/dashboard should return stock dashboard', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/stock/dashboard');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('statistics');
    expect(data.statistics).toHaveProperty('totalProducts');
  });

  test('GET /api/admin/stock/stats should return statistics', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/stock/stats');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('GET /api/admin/stock/search should search products', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/stock/search?query=filtre');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
  });

  test('GET /api/admin/stock/alerts should return alerts', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/stock/alerts');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data) || data.alerts).toBeDefined();
  });

  test('GET /api/admin/stock/health should return health status', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/stock/health');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });
});

test.describe('Admin API - Staff Management', () => {
  test('GET /api/admin/staff should return staff list', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/staff');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data) || data.staff).toBeDefined();
  });

  test('GET /api/admin/staff/stats should return staff statistics', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/staff/stats');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('total');
  });
});

test.describe('Admin API - Configuration', () => {
  test('GET /api/admin/configuration should return all configurations', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/configuration');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
  });

  test('GET /api/admin/configuration/:key should return specific config', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/configuration/app.name');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toBeDefined();
  });
});

test.describe('Admin API - User Management', () => {
  test('GET /api/admin/users/stats should return user statistics', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/users/stats');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toBeDefined();
  });

  test('GET /api/admin/users should return users list', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/users');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data) || data.users).toBeDefined();
  });
});

test.describe('Admin API - Reporting', () => {
  test('GET /api/admin/reports/analytics should return analytics reports', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/reports/analytics');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toBeDefined();
  });
});

test.describe('Admin API - Products', () => {
  test('GET /api/admin/products/dashboard should return products dashboard', async ({ page }) => {
    const response = await authenticatedRequest(page, 'GET', '/api/admin/products/dashboard');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('success');
  });
});

test.describe('Admin API - Security Tests', () => {
  test('Endpoints without auth should return 403', async ({ page }) => {
    const endpoints = [
      '/api/admin/stock/dashboard',
      '/api/admin/staff',
      '/api/admin/configuration',
      '/api/admin/users/stats',
      '/api/admin/reports/analytics',
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(`${API_URL}${endpoint}`);
      expect(response.status()).toBe(403);
    }
  });

  test('Invalid token should return 401 or 403', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/api/admin/stock/dashboard`, {
      headers: {
        'Authorization': 'Bearer invalid_token_12345',
      },
    });
    
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Admin API - Integration Tests', () => {
  test('Complete workflow: View dashboard -> Get stats -> Search stock', async ({ page }) => {
    // Step 1: Dashboard
    const dashboardResponse = await authenticatedRequest(page, 'GET', '/api/admin/stock/dashboard');
    expect(dashboardResponse.ok()).toBeTruthy();
    const dashboardData = await dashboardResponse.json();
    
    // Step 2: Stats
    const statsResponse = await authenticatedRequest(page, 'GET', '/api/admin/stock/stats');
    expect(statsResponse.ok()).toBeTruthy();
    
    // Step 3: Search
    const searchResponse = await authenticatedRequest(page, 'GET', '/api/admin/stock/search?query=test');
    expect(searchResponse.ok()).toBeTruthy();
    
    console.log('✅ Complete workflow passed:', {
      dashboard: dashboardData?.statistics?.totalProducts || 'N/A',
    });
  });

  test('Staff management workflow: List staff -> Get stats', async ({ page }) => {
    // List staff
    const listResponse = await authenticatedRequest(page, 'GET', '/api/admin/staff');
    expect(listResponse.ok()).toBeTruthy();
    
    // Get stats
    const statsResponse = await authenticatedRequest(page, 'GET', '/api/admin/staff/stats');
    expect(statsResponse.ok()).toBeTruthy();
    const stats = await statsResponse.json();
    
    console.log('✅ Staff workflow passed:', stats);
  });
});
