/**
 * RemixApiService — in-process integration for the embedded Remix SSR realm.
 *
 * It builds a per-request, actor-bound, FROZEN `RemixApplicationPort`
 * (`createRequestPort`) that the SSR loaders reach through the load context.
 * Every capability calls the NestJS domain services DIRECTLY — no HTTP loopback,
 * no `Internal-Call` / `X-User-*` header auth, no ConnectRPC. Admin capabilities
 * re-authorize the bound actor server-side (401 anonymous / 403 non-admin),
 * mirroring `IsAdminGuard` / `AdminSessionGuard` (`level >= 7 || isAdmin`).
 */

import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type {
  RemixApplicationPort,
  PortActor,
  HomepageFamiliesResult,
  HomepageBelowFoldResult,
  AdminOrdersQuery,
  AdminOrdersResult,
  AdminStaffQuery,
  AdminStaffResult,
  AdminStaffStatistics,
} from '@fafa/frontend';
import { OrdersService } from '../database/services/orders.service';
import { HomepageRpcService } from '../modules/catalog/services/homepage-rpc.service';
import { StaffService } from '../modules/staff/staff.service';

/**
 * Canonical admin gate — mirrors `IsAdminGuard` / `AdminSessionGuard`
 * (`user.isAdmin === true || user.level >= 7`). A single named constant here
 * rather than a 9th copy of the bare literal `7`.
 */
const ADMIN_MIN_LEVEL = 7;

function isAdminActor(actor: PortActor | null): boolean {
  return (
    !!actor &&
    (actor.isAdmin === true || Number(actor.level) >= ADMIN_MIN_LEVEL)
  );
}

@Injectable()
export class RemixApiService {
  private readonly logger = new Logger(RemixApiService.name);

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly homepageRpcService: HomepageRpcService,
    private readonly staffService: StaffService,
  ) {}

  /**
   * Build the per-request, actor-bound, frozen application port. The actor is
   * derived from `request.user` (Passport/NestJS session); `null` = anonymous.
   * The returned object is `Object.freeze`d so a loader cannot mutate the port,
   * and it closes over the actor so authorization travels WITH the port instead
   * of via bypassable `X-User-*` headers.
   */
  createRequestPort(rawActor: unknown): RemixApplicationPort {
    const actor = RemixApiService.toPortActor(rawActor);

    const assertAdmin = (capability: string): void => {
      if (!actor) {
        throw new UnauthorizedException(
          `Authentication required for ${capability}`,
        );
      }
      if (!isAdminActor(actor)) {
        throw new ForbiddenException(
          `Admin privilege required for ${capability}`,
        );
      }
    };

    const port: RemixApplicationPort = {
      // ── PUBLIC (no actor) ──
      getHomepageFamilies: () => this.getHomepageFamilies(),
      getHomepageBelowFold: () => this.getHomepageBelowFold(),
      // ── ADMIN (re-authorized server-side, then direct DI) ──
      // `async` so an `assertAdmin` refusal surfaces as a REJECTED promise
      // (contract: every port method returns a Promise), not a sync throw.
      listAdminOrders: async (query) => {
        assertAdmin('listAdminOrders');
        return this.listAdminOrders(query);
      },
      listAdminStaff: async (query) => {
        assertAdmin('listAdminStaff');
        return this.listAdminStaff(query);
      },
      getAdminStaffStatistics: async () => {
        assertAdmin('getAdminStaffStatistics');
        return this.getAdminStaffStatistics();
      },
    };

    return Object.freeze(port);
  }

  /** Coerce the raw session user into the port's authoritative actor shape. */
  private static toPortActor(rawActor: unknown): PortActor | null {
    if (!rawActor || typeof rawActor !== 'object') return null;
    const u = rawActor as Record<string, unknown>;
    if (u.id == null || u.email == null) return null;
    const authSource =
      u.authSource === 'admin' || u.authSource === 'customer'
        ? u.authSource
        : undefined;
    return {
      id: String(u.id),
      email: String(u.email),
      level: Number(u.level ?? 0),
      isAdmin: u.isAdmin === true,
      isPro: u.isPro === true,
      isActive: u.isActive !== false,
      authSource,
    };
  }

  // ── PUBLIC homepage capabilities (direct DI to HomepageRpcService) ──
  private async getHomepageFamilies(): Promise<HomepageFamiliesResult> {
    return (await this.homepageRpcService.getHomepageFamilies()) as HomepageFamiliesResult;
  }

  private async getHomepageBelowFold(): Promise<HomepageBelowFoldResult> {
    return (await this.homepageRpcService.getHomepageBelowFold()) as HomepageBelowFoldResult;
  }

  // ── ADMIN orders ──
  // Direct DI to the DB `OrdersService` (wired via DatabaseModule). The module
  // DDD `OrdersService` lacks the customer / ic_postback enrichment and the
  // excludePending/paymentStatus filters the production admin order table relies
  // on; the in-scope consumer (admin.reports) needs only order totals, so the
  // already-injected DB service is the zero-regression choice (see PR body).
  private async listAdminOrders(
    query: AdminOrdersQuery,
  ): Promise<AdminOrdersResult> {
    const { page = 1, limit = 20, status, search } = query;
    const result = await this.ordersService.listOrders({
      page,
      limit,
      status,
      search,
    });
    return { data: result.data, pagination: result.pagination };
  }

  // ── ADMIN staff (direct DI to StaffService; retires the /api/users/test-staff
  // HTTP loopback, which never existed and always 404'd) ──
  private async listAdminStaff(
    query: AdminStaffQuery,
  ): Promise<AdminStaffResult> {
    const { page = 1, limit = 20, status, department, search, level } = query;
    const isActive =
      status === 'active' ? true : status === 'inactive' ? false : undefined;

    const result = await this.staffService.findAll(page, limit, {
      department,
      isActive,
      search,
      level,
    });

    const staff = result.data.staff.map((s) => ({
      id: s.id,
      email: s.email,
      firstName: s.firstName,
      lastName: s.lastName,
      level: s.level,
      isActive: s.isActive,
      status: (s.isActive ? 'active' : 'inactive') as 'active' | 'inactive',
      // `___config_admin` has a single `cnfa_job` column; expose it as both.
      department: s.job,
      role: s.job,
    }));

    const total = result.data.total;
    return {
      staff,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  private async getAdminStaffStatistics(): Promise<AdminStaffStatistics> {
    // StaffService.getStats → StaffDataService.getStats, now fail-loud (no
    // silent all-zeros catch): a DB failure propagates here instead of masking.
    const { data } = await this.staffService.getStats();
    return {
      total: data.total,
      active: data.active,
      inactive: data.inactive,
      departments: data.departments.length,
      departmentNames: data.departments,
    };
  }
}
