/**
 * `GET /api/legacy-users/dashboard` — le `level` renvoyé est celui de la
 * session (niveau de droits), pas le palier stocké sur le compte client.
 * L'espace client s'en sert pour proposer l'accès à l'espace commercial.
 *
 * @see backend/src/auth/session-privilege.ts
 */
import type { Request } from 'express';
import { UsersController } from './users.controller';
import type { UserDataConsolidatedService } from '../modules/users/services/user-data-consolidated.service';
import type { OrdersService } from '../database/services/orders.service';
import { CUSTOMER_SESSION_LEVEL } from '../auth/session-privilege';

describe('UsersController — niveau renvoyé au tableau de bord', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('[]', { status: 200 }));
  });

  afterEach(() => fetchSpy.mockRestore());

  it.each([0, 3, 7, 10])(
    'compte client au palier %i → niveau de la session client',
    async (tier) => {
      const userData = {
        findById: jest.fn().mockResolvedValue({
          id: 'cst-1',
          email: 'client@example.test',
          firstName: 'Client',
          lastName: 'Test',
          isActive: true,
          isPro: tier >= 5,
          level: tier,
        }),
        countActive: jest.fn().mockResolvedValue(0),
      } as unknown as UserDataConsolidatedService;
      const orders = {
        getTotalOrdersCount: jest.fn().mockResolvedValue(0),
        getUserOrders: jest.fn().mockResolvedValue([]),
      } as unknown as OrdersService;

      const controller = new UsersController(userData, orders);
      const result = await controller.getDashboardStats({
        user: {
          id: 'cst-1',
          email: 'client@example.test',
          level: CUSTOMER_SESSION_LEVEL,
          isAdmin: false,
          authSource: 'customer',
        },
      } as unknown as Request);

      expect(result.user.level).toBe(CUSTOMER_SESSION_LEVEL);
    },
  );
});
