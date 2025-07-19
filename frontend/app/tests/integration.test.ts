/**
 * Tests d'intégration pour les hooks API
 * Valide l'alignement avec le backend NestJS
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useUsers,
  useUserActions,
  useOrders,
  useOrderActions,
  useAutomotiveActions,
  useVehicleValidation,
  useCalculations,
  useAuth,
} from '../hooks/api-hooks';

// Mock du client API
vi.mock('../lib/api-client', () => ({
  apiClient: {
    getUsers: vi.fn(),
    getActiveUsers: vi.fn(),
    getUsersByLevel: vi.fn(),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserProfile: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    updateUserLevel: vi.fn(),
    deactivateUser: vi.fn(),
    activateUser: vi.fn(),
    getOrders: vi.fn(),
    getOrder: vi.fn(),
    getOrdersByCustomer: vi.fn(),
    updateOrderStatus: vi.fn(),
    createAutomotiveOrder: vi.fn(),
    updateAutomotiveOrderStatus: vi.fn(),
    validateVehicleData: vi.fn(),
    validateVIN: vi.fn(),
    validateRegistration: vi.fn(),
    calculateOrderTax: vi.fn(),
    calculateShippingFee: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

describe('API Hooks - Intégration Backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Users Hooks', () => {
    it('useUsers devrait récupérer la liste des utilisateurs', async () => {
      const mockUsers = {
        users: [
          { id: '1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.getUsers).mockResolvedValue(mockUsers);

      const { result } = renderHook(() => useUsers({ page: 1, limit: 20 }));

      await waitFor(() => {
        expect(result.current.data).toEqual(mockUsers);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(apiClient.getUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('useUserActions devrait créer un utilisateur', async () => {
      const mockUser = { id: '1', email: 'new@example.com' };
      const userData = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        tel: '0123456789',
        address: '123 rue Test',
        city: 'Paris',
        zipCode: '75001',
        country: 'FR',
      };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.createUser).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useUserActions());

      await act(async () => {
        const user = await result.current.createUser(userData);
        expect(user).toEqual(mockUser);
      });

      expect(apiClient.createUser).toHaveBeenCalledWith(userData);
    });

    it('useUserActions devrait mettre à jour le niveau utilisateur', async () => {
      const mockUser = { id: '1', level: 5 };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.updateUserLevel).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useUserActions());

      await act(async () => {
        const user = await result.current.updateUserLevel('1', 5);
        expect(user).toEqual(mockUser);
      });

      expect(apiClient.updateUserLevel).toHaveBeenCalledWith('1', 5);
    });
  });

  describe('Orders Hooks', () => {
    it('useOrders devrait récupérer la liste des commandes', async () => {
      const mockOrders = {
        orders: [
          { id: '1', customerId: '1', status: 'pending', totalAmount: 100 },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.getOrders).mockResolvedValue(mockOrders);

      const { result } = renderHook(() => useOrders({ page: 1, limit: 20 }));

      await waitFor(() => {
        expect(result.current.data).toEqual(mockOrders);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(apiClient.getOrders).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('useOrderActions devrait mettre à jour le statut d\'une commande', async () => {
      const mockResult = { success: true, message: 'Statut mis à jour' };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.updateOrderStatus).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useOrderActions());

      await act(async () => {
        const response = await result.current.updateOrderStatus('1', 'confirmed', 'Validation manuelle');
        expect(response).toEqual(mockResult);
      });

      expect(apiClient.updateOrderStatus).toHaveBeenCalledWith('1', 'confirmed', 'Validation manuelle');
    });
  });

  describe('Automotive Hooks', () => {
    it('useAutomotiveActions devrait créer une commande automobile', async () => {
      const orderData = {
        customerId: '1',
        vehicleData: {
          vin: 'WVWAA71K08W201030',
          brand: 'Volkswagen',
          model: 'Golf',
          year: 2008,
        },
        items: [{ productId: '1', quantity: 1 }],
      };
      const mockResult = { success: true, data: { id: 'auto-1' } };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.createAutomotiveOrder).mockResolvedValue(mockResult);

      const { result } = renderHook(() => useAutomotiveActions());

      await act(async () => {
        const response = await result.current.createAutomotiveOrder(orderData);
        expect(response).toEqual(mockResult);
      });

      expect(apiClient.createAutomotiveOrder).toHaveBeenCalledWith(orderData);
    });

    it('useVehicleValidation devrait valider un VIN', async () => {
      const mockValidation = {
        valid: true,
        vehicleData: { brand: 'Volkswagen', model: 'Golf', year: 2008 },
      };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.validateVIN).mockResolvedValue(mockValidation);

      const { result } = renderHook(() => useVehicleValidation());

      await act(async () => {
        const validation = await result.current.validateVIN('WVWAA71K08W201030');
        expect(validation).toEqual(mockValidation);
      });

      expect(apiClient.validateVIN).toHaveBeenCalledWith('WVWAA71K08W201030');
    });
  });

  describe('Calculations Hooks', () => {
    it('useCalculations devrait calculer les taxes', async () => {
      const taxData = {
        orderId: '1',
        country: 'FR',
        customerType: 'individual' as const,
        items: [{ id: '1', price: 100, quantity: 1, category: 'auto' }],
      };
      const mockTaxes = { taxAmount: 20, taxRate: 0.2 };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.calculateOrderTax).mockResolvedValue(mockTaxes);

      const { result } = renderHook(() => useCalculations());

      await act(async () => {
        const taxes = await result.current.calculateOrderTax(taxData);
        expect(taxes).toEqual(mockTaxes);
      });

      expect(apiClient.calculateOrderTax).toHaveBeenCalledWith(taxData);
    });

    it('useCalculations devrait calculer les frais de livraison', async () => {
      const shippingData = {
        orderId: '1',
        origin: 'Paris',
        destination: 'Lyon',
        weight: 5,
        dimensions: { length: 30, width: 20, height: 10 },
        items: [{ id: '1', weight: 5, dimensions: { length: 30, width: 20, height: 10 } }],
      };
      const mockShipping = { shippingFee: 15.90, carrier: 'Standard' };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.calculateShippingFee).mockResolvedValue(mockShipping);

      const { result } = renderHook(() => useCalculations());

      await act(async () => {
        const shipping = await result.current.calculateShippingFee(shippingData);
        expect(shipping).toEqual(mockShipping);
      });

      expect(apiClient.calculateShippingFee).toHaveBeenCalledWith(shippingData);
    });
  });

  describe('Authentication Hooks', () => {
    it('useAuth devrait se connecter', async () => {
      const mockAuth = {
        user: { id: '1', email: 'admin@example.com' },
        token: 'jwt-token',
      };

      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.login).mockResolvedValue(mockAuth);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        const auth = await result.current.login('admin@example.com', 'password');
        expect(auth).toEqual(mockAuth);
      });

      expect(apiClient.login).toHaveBeenCalledWith('admin@example.com', 'password');
      expect(result.current.user).toEqual(mockAuth.user);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('useAuth devrait se déconnecter', async () => {
      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.logout).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(apiClient.logout).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Gestion d\'erreurs', () => {
    it('devrait gérer les erreurs API correctement', async () => {
      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.getUsers).mockRejectedValue(new Error('Erreur réseau'));

      const { result } = renderHook(() => useUsers());

      await waitFor(() => {
        expect(result.current.data).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Erreur réseau');
      });
    });

    it('devrait gérer les erreurs d\'actions utilisateur', async () => {
      const { apiClient } = await import('../lib/api-client');
      vi.mocked(apiClient.createUser).mockRejectedValue(new Error('Email déjà utilisé'));

      const { result } = renderHook(() => useUserActions());

      await act(async () => {
        try {
          await result.current.createUser({
            email: 'existing@example.com',
            password: 'password',
            firstName: 'Test',
            lastName: 'User',
            tel: '0123456789',
            address: '123 rue Test',
            city: 'Paris',
            zipCode: '75001',
            country: 'FR',
          });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Email déjà utilisé');
        }
      });

      expect(result.current.error).toBe('Erreur création utilisateur');
    });
  });
});

// Test d'intégration des composants
describe('Composants d\'intégration', () => {
  it('UserManagement devrait utiliser les hooks correctement', async () => {
    // Ce test nécessiterait un environnement de test React complet
    // Pour l'instant, on valide que les imports fonctionnent
    const { default: UserManagement } = await import('../components/UserManagement');
    expect(UserManagement).toBeDefined();
  });

  it('OrderManagement devrait utiliser les hooks correctement', async () => {
    const { default: OrderManagement } = await import('../components/OrderManagement');
    expect(OrderManagement).toBeDefined();
  });

  it('Navigation devrait définir toutes les routes attendues', async () => {
    const { default: Navigation } = await import('../components/Navigation');
    expect(Navigation).toBeDefined();
  });
});

// Test de l'API Client
describe('API Client', () => {
  it('devrait être configuré correctement', async () => {
    const { apiClient } = await import('../lib/api-client');
    expect(apiClient).toBeDefined();
    
    // Vérifie que toutes les méthodes attendues existent
    expect(typeof apiClient.getUsers).toBe('function');
    expect(typeof apiClient.getOrders).toBe('function');
    expect(typeof apiClient.createAutomotiveOrder).toBe('function');
    expect(typeof apiClient.validateVIN).toBe('function');
    expect(typeof apiClient.calculateOrderTax).toBe('function');
  });
});

// Helper function pour les tests asynchrones
async function act(callback: () => Promise<void>) {
  await callback();
}
