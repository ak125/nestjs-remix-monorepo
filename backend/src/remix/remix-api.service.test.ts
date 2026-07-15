/**
 * RemixApplicationPort contract — actor-bound, frozen, direct-DI, fail-closed.
 *
 * Locks, at the unit level, the port `RemixApiService.createRequestPort` returns:
 * - it is FROZEN (a loader cannot mutate it);
 * - PUBLIC homepage capabilities work for an anonymous actor (no authz);
 * - ADMIN capabilities re-authorize server-side — 401 anonymous /
 *   403 authenticated-non-admin — mirroring IsAdminGuard (`level >= 7 || isAdmin`);
 * - when authorized, ADMIN capabilities delegate DIRECTLY to the NestJS domain
 *   services (no HTTP loopback) with the documented staff normalization
 *   (isActive→status, cnfa_job→department/role) and a department COUNT;
 * - the staff-stats path is fail-loud (a rejected getStats rejects the port
 *   call — no silent all-zeros);
 * - ports are per-request / actor-independent.
 *
 * The three domain services are auto-mocked so importing the real
 * RemixApiService does not pull in Supabase/heavy transitive deps.
 */
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RemixApiService } from './remix-api.service';

jest.mock('../database/services/orders.service');
jest.mock('../modules/catalog/services/homepage-rpc.service');
jest.mock('../modules/staff/staff.service');

function makeService() {
  const homepage = {
    getHomepageFamilies: jest
      .fn()
      .mockResolvedValue({ catalog: { families: [] } }),
    getHomepageBelowFold: jest
      .fn()
      .mockResolvedValue({ brands: [], equipementiers: [], blog_articles: [] }),
  };
  const orders = {
    listOrders: jest.fn().mockResolvedValue({
      data: [{ ord_id: 1 }],
      pagination: {
        page: 1,
        limit: 20,
        total: 42,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    }),
  };
  const staff = {
    findAll: jest.fn().mockResolvedValue({
      success: true,
      data: {
        staff: [
          {
            id: '1',
            email: 'a@b.c',
            firstName: 'Alice',
            lastName: 'Bee',
            level: 7,
            job: 'Ventes',
            isActive: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      },
    }),
    getStats: jest.fn().mockResolvedValue({
      success: true,
      data: {
        total: 3,
        active: 2,
        inactive: 1,
        departments: ['Ventes', 'Support'],
      },
    }),
  };
  const svc = new RemixApiService(
    orders as never,
    homepage as never,
    staff as never,
  );
  return { svc, homepage, orders, staff };
}

const ADMIN = {
  id: '7',
  email: 'admin@x.y',
  level: 7,
  isAdmin: true,
  isPro: false,
  isActive: true,
};
const NON_ADMIN = {
  id: '3',
  email: 'user@x.y',
  level: 3,
  isAdmin: false,
  isPro: false,
  isActive: true,
};

describe('RemixApiService.createRequestPort — actor-bound frozen port', () => {
  it('returns a FROZEN port object', () => {
    const { svc } = makeService();
    expect(Object.isFrozen(svc.createRequestPort(null))).toBe(true);
  });

  it('PUBLIC homepage capabilities work for an anonymous actor', async () => {
    const { svc, homepage } = makeService();
    const port = svc.createRequestPort(null);
    await expect(port.getHomepageFamilies()).resolves.toEqual({
      catalog: { families: [] },
    });
    await expect(port.getHomepageBelowFold()).resolves.toEqual({
      brands: [],
      equipementiers: [],
      blog_articles: [],
    });
    expect(homepage.getHomepageFamilies).toHaveBeenCalledTimes(1);
    expect(homepage.getHomepageBelowFold).toHaveBeenCalledTimes(1);
  });

  it('ADMIN capabilities reject an anonymous actor with 401 (no service hit)', async () => {
    const { svc, orders, staff } = makeService();
    const port = svc.createRequestPort(null);
    await expect(port.listAdminOrders({})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(port.listAdminStaff({})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(port.getAdminStaffStatistics()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(orders.listOrders).not.toHaveBeenCalled();
    expect(staff.findAll).not.toHaveBeenCalled();
    expect(staff.getStats).not.toHaveBeenCalled();
  });

  it('ADMIN capabilities reject an authenticated NON-admin with 403', async () => {
    const { svc, staff } = makeService();
    const port = svc.createRequestPort(NON_ADMIN);
    await expect(port.listAdminStaff({})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(port.getAdminStaffStatistics()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(staff.findAll).not.toHaveBeenCalled();
  });

  it('authorizes level >= 7 even without isAdmin (mirrors IsAdminGuard)', async () => {
    const { svc } = makeService();
    const port = svc.createRequestPort({ ...ADMIN, isAdmin: false, level: 7 });
    await expect(port.getAdminStaffStatistics()).resolves.toBeDefined();
  });

  it('listAdminOrders delegates directly to OrdersService.listOrders', async () => {
    const { svc, orders } = makeService();
    const port = svc.createRequestPort(ADMIN);
    const res = await port.listAdminOrders({ page: 2, limit: 10 });
    expect(orders.listOrders).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      status: undefined,
      search: undefined,
    });
    expect(res.pagination.total).toBe(42);
    expect(res.data).toHaveLength(1);
  });

  it('listAdminStaff normalizes rows (isActive→status, cnfa_job→department/role)', async () => {
    const { svc, staff } = makeService();
    const port = svc.createRequestPort(ADMIN);
    const res = await port.listAdminStaff({ status: 'active', level: 7 });
    expect(staff.findAll).toHaveBeenCalledWith(1, 20, {
      department: undefined,
      isActive: true,
      search: undefined,
      level: 7,
    });
    expect(res.total).toBe(1);
    expect(res.staff[0]).toMatchObject({
      id: '1',
      email: 'a@b.c',
      status: 'active',
      department: 'Ventes',
      role: 'Ventes',
    });
  });

  it('getAdminStaffStatistics returns a department COUNT plus names', async () => {
    const { svc } = makeService();
    const port = svc.createRequestPort(ADMIN);
    await expect(port.getAdminStaffStatistics()).resolves.toEqual({
      total: 3,
      active: 2,
      inactive: 1,
      departments: 2,
      departmentNames: ['Ventes', 'Support'],
    });
  });

  it('is fail-loud: a rejected getStats rejects the port call (no silent zeros)', async () => {
    const { svc, staff } = makeService();
    staff.getStats.mockRejectedValueOnce(new Error('db down'));
    const port = svc.createRequestPort(ADMIN);
    await expect(port.getAdminStaffStatistics()).rejects.toThrow('db down');
  });

  it('binds a distinct actor per request', async () => {
    const { svc } = makeService();
    const anon = svc.createRequestPort(null);
    const admin = svc.createRequestPort(ADMIN);
    await expect(anon.listAdminStaff({})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(admin.listAdminStaff({})).resolves.toBeDefined();
  });
});
