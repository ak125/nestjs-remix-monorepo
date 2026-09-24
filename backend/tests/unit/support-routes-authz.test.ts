/**
 * Support module — access boundary.
 *
 * Every handler of every controller that `SupportModule` registers is
 * classified in one of four access tiers, and the classification below is
 * EXHAUSTIVE: a controller or a handler added later without being classified
 * here fails the test (the controller list is read from the module metadata).
 *
 *   - public   : no guard (site pages: contact form, FAQ, legal pages);
 *   - customer : `AuthenticatedGuard` only — the handler itself scopes the data
 *                to the session's customer (claims, legal acceptances);
 *   - staff    : `AuthenticatedGuard + PermissionsGuard +
 *                @RequirePermission('canSeeCustomerDetails')` (level 3+);
 *   - admin    : `AuthenticatedGuard + IsAdminGuard` (level 7+).
 *
 * The guard chain is evaluated for real (same shape as
 * `internal-routes-authz.test.ts`), then the customer-tier handlers are called
 * with a mocked service to check their data scoping and that the acting
 * identity always comes from the session, never from the request body.
 *
 * @see backend/src/auth/guards/permissions.guard.ts
 * @see backend/src/auth/permissions.service.ts
 * @see backend/tests/unit/seo-metadata-authz.test.ts (same test shape)
 */
import {
  ExecutionContext,
  ForbiddenException,
  RequestMethod,
  Type,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '@auth/decorators/require-permission.decorator';
import {
  AuthenticationException,
  DomainNotFoundException,
  DomainValidationException,
} from '@common/exceptions';
import { PermissionsService } from '../../src/auth/permissions.service';
import {
  AuthSource,
  isAdminSession,
  sessionPrivilegeLevel,
} from '../../src/auth/session-privilege';
import { AISupportController } from '../../src/modules/support/controllers/ai-support.controller';
import { ClaimController } from '../../src/modules/support/controllers/claim.controller';
import { ContactController } from '../../src/modules/support/controllers/contact.controller';
import { FaqController } from '../../src/modules/support/controllers/faq.controller';
import { LeadsAdminController } from '../../src/modules/support/controllers/leads-admin.controller';
import { LegalController } from '../../src/modules/support/controllers/legal.controller';
import { QuoteController } from '../../src/modules/support/controllers/quote.controller';
import { ReviewController } from '../../src/modules/support/controllers/review.controller';
import { SupportAnalyticsController } from '../../src/modules/support/controllers/support-analytics.controller';
import type {
  Claim,
  ClaimService,
} from '../../src/modules/support/services/claim.service';
import type { LegalService } from '../../src/modules/support/services/legal.service';
import type { ReviewService } from '../../src/modules/support/services/review.service';
import { SupportModule } from '../../src/modules/support/support.module';

// NestJS reflection keys (`@nestjs/common/constants` — stable literals).
const GUARDS_METADATA = '__guards__';
const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Route handlers declared on a controller, in declaration order. */
function routeHandlers(controller: Type<any>): string[] {
  return Object.getOwnPropertyNames(controller.prototype).filter(
    (name) =>
      name !== 'constructor' &&
      typeof controller.prototype[name] === 'function' &&
      Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) !==
        undefined,
  );
}

function routeOf(controller: Type<any>, method: string) {
  const handler = controller.prototype[method];
  return {
    segments: String(Reflect.getMetadata(PATH_METADATA, handler))
      .split('/')
      .filter(Boolean),
    verb: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
  };
}

/** Class-level guards ++ method-level guards (both must pass in NestJS). */
function effectiveGuards(
  controller: Type<any>,
  method: string,
): Array<Type<any>> {
  const classGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller) || [];
  const methodGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller.prototype[method]) || [];
  return [...classGuards, ...methodGuards];
}

function instantiate(Guard: Type<any>) {
  if (Guard === PermissionsGuard) {
    return new PermissionsGuard(new Reflector(), new PermissionsService());
  }
  return new Guard();
}

/**
 * Runs the applied guard chain against a request, with the REAL handler in
 * the execution context so PermissionsGuard reads the real metadata.
 * An empty chain => allowed (how an unguarded endpoint behaves).
 */
function isAllowed(
  controller: Type<any>,
  method: string,
  request: any,
): boolean {
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => controller.prototype[method],
    getClass: () => controller,
  } as unknown as ExecutionContext;
  for (const Guard of effectiveGuards(controller, method)) {
    let result: unknown;
    try {
      result = instantiate(Guard).canActivate(ctx);
    } catch {
      return false;
    }
    if (result !== true) return false;
  }
  return true;
}

// ─── Principals ───────────────────────────────────────────────────────────────

const principal = (level: number | null) =>
  level === null
    ? { path: '/x', isAuthenticated: () => false, user: undefined }
    : {
        path: '/x',
        isAuthenticated: () => true,
        user: {
          id: 'u1',
          email: 'someone@example.test',
          level: String(level),
          isAdmin: level >= 7,
        },
      };

const anonymous = () => principal(null);
const customer = () => principal(1);
const commercial = () => principal(3);
const manager = () => principal(5);
const admin = () => principal(7);

/**
 * Session opened by an account, built with the rule `AuthService` applies:
 * the stored level is a privilege only for a staff account. A customer tier
 * shares its numbers with the staff scale and must never open a staff route.
 */
const accountSession = (authSource: AuthSource, storedLevel: number) => ({
  path: '/x',
  isAuthenticated: () => true,
  user: {
    id: 'u1',
    email: 'someone@example.test',
    level: String(sessionPrivilegeLevel(authSource, storedLevel)),
    isAdmin: isAdminSession(authSource, storedLevel),
  },
});

/** Customer tiers that reuse a number of the staff scale (3, 5, 7, 9) or go above it. */
const HIGH_CUSTOMER_TIERS = [3, 5, 7, 9, 10];

// ─── Access contract ──────────────────────────────────────────────────────────

type Tier = 'public' | 'customer' | 'staff' | 'admin';

/** Controllers guarded as a whole: every handler is admin-only. */
const ADMIN_CONTROLLERS: Array<Type<any>> = [
  QuoteController,
  SupportAnalyticsController,
  AISupportController,
  LeadsAdminController,
];

/** Controllers with per-handler tiers — the list must stay exhaustive. */
const PER_HANDLER_TIERS: Array<{
  controller: Type<any>;
  tiers: Record<string, Tier>;
}> = [
  {
    controller: ContactController,
    tiers: {
      submitContactForm: 'public',
      getAllTickets: 'staff',
      getStats: 'staff',
      getTicket: 'staff',
      searchTickets: 'staff',
      updateTicketStatus: 'admin',
    },
  },
  {
    controller: FaqController,
    tiers: {
      createFAQ: 'admin',
      getAllFAQs: 'public',
      getFAQStats: 'admin',
      getAllCategories: 'public',
      createCategory: 'admin',
      getCategory: 'public',
      updateCategory: 'admin',
      deleteCategory: 'admin',
      getFAQ: 'public',
      updateFAQ: 'admin',
      deleteFAQ: 'admin',
      markHelpful: 'public',
    },
  },
  {
    controller: LegalController,
    tiers: {
      createDocument: 'admin',
      getAllDocuments: 'admin',
      getDocumentByType: 'admin',
      getAllArianePages: 'public',
      getArianePage: 'public',
      getDocument: 'admin',
      updateDocument: 'admin',
      publishDocument: 'admin',
      deleteDocument: 'admin',
      getDocumentVersions: 'admin',
      getDocumentVersion: 'admin',
      restoreVersion: 'admin',
      acceptDocument: 'customer',
      getUserAcceptances: 'customer',
    },
  },
  {
    controller: ClaimController,
    tiers: {
      submitClaim: 'customer',
      getAllClaims: 'customer',
      getClaimStats: 'staff',
      getClaim: 'customer',
      updateClaimStatus: 'admin',
      assignClaim: 'admin',
      addTimelineEntry: 'admin',
      resolveClaim: 'admin',
      escalateClaim: 'admin',
      addSatisfactionRating: 'customer',
    },
  },
  {
    controller: ReviewController,
    tiers: {
      submitReview: 'admin',
      getReviews: 'staff',
      getReviewStats: 'staff',
      getProductReviews: 'admin',
      getCustomerReviews: 'admin',
      getReview: 'staff',
      moderateReview: 'admin',
      markHelpful: 'admin',
      verifyReview: 'admin',
      deleteReview: 'admin',
    },
  },
];

const CASES: Array<{
  label: string;
  controller: Type<any>;
  method: string;
  tier: Tier;
}> = [
  ...ADMIN_CONTROLLERS.flatMap((controller) =>
    routeHandlers(controller).map((method) => ({
      label: `${controller.name}.${method}`,
      controller,
      method,
      tier: 'admin' as Tier,
    })),
  ),
  ...PER_HANDLER_TIERS.flatMap(({ controller, tiers }) =>
    Object.entries(tiers).map(([method, tier]) => ({
      label: `${controller.name}.${method}`,
      controller,
      method,
      tier,
    })),
  ),
];

describe('support controllers — access tiers', () => {
  it('classifies every controller registered by SupportModule', () => {
    const registered: Array<Type<any>> =
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SupportModule) || [];
    const classified = [
      ...ADMIN_CONTROLLERS,
      ...PER_HANDLER_TIERS.map((e) => e.controller),
    ];
    const names = (list: Array<Type<any>>) => list.map((c) => c.name).sort();
    expect(registered.length).toBeGreaterThan(0);
    expect(names(classified)).toEqual(names(registered));
    expect(new Set(classified).size).toBe(classified.length);
  });

  it.each(ADMIN_CONTROLLERS.map((c) => [c.name, c]))(
    '%s is guarded as a whole (AuthenticatedGuard + IsAdminGuard)',
    (_name, controller) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([
        AuthenticatedGuard,
        IsAdminGuard,
      ]);
      expect(routeHandlers(controller).length).toBeGreaterThan(0);
    },
  );

  it.each(PER_HANDLER_TIERS.map((e) => [e.controller.name, e]))(
    '%s — every route handler is classified',
    (_name, { controller, tiers }) => {
      expect([...routeHandlers(controller)].sort()).toEqual(
        Object.keys(tiers).sort(),
      );
    },
  );

  describe.each(CASES)('$label ($tier)', ({ controller, method, tier }) => {
    const guards = () => effectiveGuards(controller, method);
    const permission = () =>
      Reflect.getMetadata(REQUIRE_PERMISSION_KEY, controller.prototype[method]);

    if (tier === 'public') {
      it('has no guard and is reachable anonymously', () => {
        expect(guards()).toEqual([]);
        expect(isAllowed(controller, method, anonymous())).toBe(true);
      });
    }

    if (tier === 'customer') {
      it('requires a session, no role', () => {
        expect(guards()).toEqual([AuthenticatedGuard]);
        expect(isAllowed(controller, method, anonymous())).toBe(false);
        expect(isAllowed(controller, method, customer())).toBe(true);
      });

      it('allows a customer account whatever its tier', () => {
        for (const storedLevel of HIGH_CUSTOMER_TIERS) {
          expect(
            isAllowed(
              controller,
              method,
              accountSession('customer', storedLevel),
            ),
          ).toBe(true);
        }
      });
    }

    if (tier === 'staff') {
      it('wires AuthenticatedGuard + PermissionsGuard + canSeeCustomerDetails', () => {
        expect(guards()).toEqual([AuthenticatedGuard, PermissionsGuard]);
        expect(permission()).toBe('canSeeCustomerDetails');
      });

      it('refuses anonymous and customers, allows staff (3, 5, 7)', () => {
        expect(isAllowed(controller, method, anonymous())).toBe(false);
        expect(isAllowed(controller, method, customer())).toBe(false);
        expect(isAllowed(controller, method, commercial())).toBe(true);
        expect(isAllowed(controller, method, manager())).toBe(true);
        expect(isAllowed(controller, method, admin())).toBe(true);
      });

      it('refuses a customer account whatever its tier, allows a staff account', () => {
        for (const storedLevel of HIGH_CUSTOMER_TIERS) {
          expect(
            isAllowed(
              controller,
              method,
              accountSession('customer', storedLevel),
            ),
          ).toBe(false);
        }
        expect(isAllowed(controller, method, accountSession('admin', 3))).toBe(
          true,
        );
      });
    }

    if (tier === 'admin') {
      it('wires AuthenticatedGuard + IsAdminGuard', () => {
        expect(guards()).toEqual([AuthenticatedGuard, IsAdminGuard]);
      });

      it('refuses everyone below admin level', () => {
        expect(isAllowed(controller, method, anonymous())).toBe(false);
        expect(isAllowed(controller, method, customer())).toBe(false);
        expect(isAllowed(controller, method, commercial())).toBe(false);
        expect(isAllowed(controller, method, manager())).toBe(false);
        expect(isAllowed(controller, method, admin())).toBe(true);
      });

      it('refuses a customer account whatever its tier, allows a staff admin', () => {
        for (const storedLevel of HIGH_CUSTOMER_TIERS) {
          expect(
            isAllowed(
              controller,
              method,
              accountSession('customer', storedLevel),
            ),
          ).toBe(false);
        }
        expect(isAllowed(controller, method, accountSession('admin', 7))).toBe(
          true,
        );
      });
    }
  });
});

// ─── Route order ─────────────────────────────────────────────────────────────

/**
 * NestJS registers routes in declaration order and the first match wins. A
 * parameterised route declared before a fixed one of the same shape takes its
 * requests — and would apply ITS guards to them (e.g. the public legal pages
 * `GET ariane` behind the admin-only `GET :identifier`).
 */
describe('support controllers — no fixed route shadowed by a parameter route', () => {
  const ALL_CONTROLLERS = [
    ...ADMIN_CONTROLLERS,
    ...PER_HANDLER_TIERS.map((e) => e.controller),
  ];

  it.each(ALL_CONTROLLERS.map((c) => [c.name, c]))(
    '%s',
    (_name, controller) => {
      const routes = routeHandlers(controller).map((method) => ({
        method,
        ...routeOf(controller, method),
      }));
      const shadowed: string[] = [];
      routes.forEach((fixed, i) => {
        routes.slice(0, i).forEach((earlier) => {
          const sameShape =
            earlier.verb === fixed.verb &&
            earlier.segments.length === fixed.segments.length;
          const matches =
            sameShape &&
            earlier.segments.every(
              (segment, k) =>
                segment.startsWith(':') || segment === fixed.segments[k],
            );
          const differs = earlier.segments.some(
            (segment, k) => segment !== fixed.segments[k],
          );
          if (matches && differs) {
            shadowed.push(`${fixed.method} shadowed by ${earlier.method}`);
          }
        });
      });
      expect(shadowed).toEqual([]);
    },
  );
});

// ─── Claims — data scoping and acting identity ───────────────────────────────

const OWNER_ID = 'u1';

function buildClaim(overrides: Partial<Claim> = {}): Claim {
  const at = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'c1',
    customerId: OWNER_ID,
    customerName: 'Client Test',
    customerEmail: 'client@example.test',
    type: 'other',
    priority: 'normal',
    status: 'open',
    title: 'Titre',
    description: 'Description',
    expectedResolution: 'Remboursement',
    assignedTo: 'staff-9',
    timeline: [
      {
        id: 't1',
        action: 'created',
        description: 'Réclamation créée',
        performedBy: OWNER_ID,
        performedAt: at,
        visibility: 'both',
      },
      {
        id: 't2',
        action: 'note',
        description: 'Note interne',
        performedBy: 'staff-9',
        performedAt: at,
        visibility: 'internal',
      },
      {
        id: 't3',
        action: 'reply',
        description: 'Réponse au client',
        performedBy: 'staff-9',
        performedAt: at,
        visibility: 'customer',
      },
    ],
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

const session = (level: number, id: string | undefined = OWNER_ID) => ({
  user: {
    id,
    email: 'client@example.test',
    firstName: 'Client',
    lastName: 'Test',
    level: String(level),
  },
});

function claimsHarness() {
  const service = {
    submitClaim: jest.fn(async (data) => buildClaim(data)),
    getAllClaims: jest.fn(async () => [buildClaim()]),
    getClaim: jest.fn(async (id: string) =>
      id === 'c1' ? buildClaim() : null,
    ),
    updateClaimStatus: jest.fn(async () => buildClaim()),
    assignClaim: jest.fn(async () => buildClaim()),
    addTimelineEntry: jest.fn(async () => buildClaim()),
    resolveClaim: jest.fn(async () => buildClaim()),
    escalateClaim: jest.fn(async () => buildClaim()),
    addSatisfactionRating: jest.fn(async () => buildClaim()),
  };
  const controller = new ClaimController(
    service as unknown as ClaimService,
    new PermissionsService(),
  );
  return { service, controller };
}

describe('ClaimController — customer scoping', () => {
  it('submit takes the identity from the session, not from the body', async () => {
    const { service, controller } = claimsHarness();
    await controller.submitClaim(session(1), {
      type: 'other',
      title: 'Titre',
      description: 'Description',
      expectedResolution: 'Remboursement',
      customerId: 'someone-else',
      customerEmail: 'forged@example.test',
      priority: 'urgent',
    } as any);

    expect(service.submitClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: OWNER_ID,
        customerEmail: 'client@example.test',
        customerName: 'Client Test',
        priority: 'normal',
      }),
    );
  });

  it('a customer only lists their own claims, without internal data', async () => {
    const { service, controller } = claimsHarness();
    const claims = await controller.getAllClaims(
      session(1),
      undefined,
      undefined,
      undefined,
      'staff-9',
      'someone-else',
    );

    expect(service.getAllClaims).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: OWNER_ID, assignedTo: undefined }),
    );
    expect(claims[0].assignedTo).toBeUndefined();
    expect(claims[0].timeline.map((e) => e.id)).toEqual(['t1', 't3']);
  });

  it('staff may filter by customer and assignee and see the full claim', async () => {
    const { service, controller } = claimsHarness();
    const claims = await controller.getAllClaims(
      session(3, 'staff-1'),
      undefined,
      undefined,
      undefined,
      'staff-9',
      'someone-else',
    );

    expect(service.getAllClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'someone-else',
        assignedTo: 'staff-9',
      }),
    );
    expect(claims[0].timeline).toHaveLength(3);
    expect(claims[0].assignedTo).toBe('staff-9');
  });

  it.each([undefined, ''])(
    'a session with user id %p is refused instead of listing everything',
    async (id) => {
      const { service, controller } = claimsHarness();
      const req = { user: { ...session(1).user, id } };
      await expect(controller.getAllClaims(req)).rejects.toBeInstanceOf(
        AuthenticationException,
      );
      expect(service.getAllClaims).not.toHaveBeenCalled();
    },
  );

  it('a customer reads their own claim, without internal data', async () => {
    const { controller } = claimsHarness();
    const claim = await controller.getClaim(session(1), 'c1');
    expect(claim.assignedTo).toBeUndefined();
    expect(claim.timeline.map((e) => e.id)).toEqual(['t1', 't3']);
  });

  it('the customer view only keeps entries marked for the customer', async () => {
    const { service, controller } = claimsHarness();
    const base = buildClaim();
    service.getClaim.mockResolvedValueOnce(
      buildClaim({
        timeline: [
          ...base.timeline,
          { ...base.timeline[1], id: 't4', visibility: undefined as any },
          { ...base.timeline[1], id: 't5', visibility: 'public' as any },
        ],
      }),
    );
    const claim = await controller.getClaim(session(1), 'c1');
    expect(claim.timeline.map((e) => e.id)).toEqual(['t1', 't3']);
  });

  it("another customer's claim reads as not found", async () => {
    const { controller } = claimsHarness();
    await expect(
      controller.getClaim(session(1, 'u2'), 'c1'),
    ).rejects.toBeInstanceOf(DomainNotFoundException);
    await expect(
      controller.getClaim(session(1), 'missing'),
    ).rejects.toBeInstanceOf(DomainNotFoundException);
  });

  it('staff reads any claim in full', async () => {
    const { controller } = claimsHarness();
    const claim = await controller.getClaim(session(3, 'staff-1'), 'c1');
    expect(claim.timeline).toHaveLength(3);
  });
});

describe('ClaimController — satisfaction rating', () => {
  it("refuses a rating on another customer's claim", async () => {
    const { service, controller } = claimsHarness();
    await expect(
      controller.addSatisfactionRating(session(1, 'u2'), 'c1', { rating: 5 }),
    ).rejects.toBeInstanceOf(DomainNotFoundException);
    expect(service.addSatisfactionRating).not.toHaveBeenCalled();
  });

  it.each([0, 6, 2.5, '5', undefined])(
    'refuses the rating %p',
    async (rating) => {
      const { service, controller } = claimsHarness();
      await expect(
        controller.addSatisfactionRating(session(1), 'c1', {
          rating: rating as number,
        }),
      ).rejects.toBeInstanceOf(DomainValidationException);
      expect(service.addSatisfactionRating).not.toHaveBeenCalled();
    },
  );

  it('records a valid rating and returns the customer view', async () => {
    const { service, controller } = claimsHarness();
    const claim = await controller.addSatisfactionRating(session(1), 'c1', {
      rating: 4,
      feedback: { not: 'a string' } as unknown as string,
    });
    expect(service.addSatisfactionRating).toHaveBeenCalledWith(
      'c1',
      4,
      undefined,
    );
    expect(claim.timeline.map((e) => e.id)).toEqual(['t1', 't3']);
  });
});

describe('ClaimController — admin actions are attributed to the session', () => {
  const adminSession = () => session(7, 'admin-1');

  it('status change', async () => {
    const { service, controller } = claimsHarness();
    await controller.updateClaimStatus(adminSession(), 'c1', {
      status: 'resolved',
      note: 'ok',
    });
    expect(service.updateClaimStatus).toHaveBeenCalledWith(
      'c1',
      'resolved',
      'admin-1',
      'ok',
    );
  });

  it('assignment: the assignee comes from the body, the author from the session', async () => {
    const { service, controller } = claimsHarness();
    await controller.assignClaim(adminSession(), 'c1', {
      staffId: 'staff-9',
    });
    expect(service.assignClaim).toHaveBeenCalledWith(
      'c1',
      'staff-9',
      'admin-1',
    );
  });

  it.each([undefined, 'public', 'INTERNAL'])(
    'timeline entry with visibility %p is refused',
    async (visibility) => {
      const { service, controller } = claimsHarness();
      await expect(
        controller.addTimelineEntry(adminSession(), 'c1', {
          action: 'note',
          description: 'Note',
          visibility: visibility as any,
        }),
      ).rejects.toBeInstanceOf(DomainValidationException);
      expect(service.addTimelineEntry).not.toHaveBeenCalled();
    },
  );

  it('timeline entry ignores a forged author', async () => {
    const { service, controller } = claimsHarness();
    await controller.addTimelineEntry(adminSession(), 'c1', {
      action: 'note',
      description: 'Note',
      visibility: 'internal',
      performedBy: 'someone-else',
    } as any);
    expect(service.addTimelineEntry).toHaveBeenCalledWith('c1', {
      action: 'note',
      description: 'Note',
      visibility: 'internal',
      attachments: undefined,
      performedBy: 'admin-1',
    });
  });

  it('resolution ignores a forged resolver', async () => {
    const { service, controller } = claimsHarness();
    await controller.resolveClaim(adminSession(), 'c1', {
      resolution: {
        type: 'refund',
        description: 'Remboursé',
        resolvedBy: 'someone-else',
      } as any,
    });
    expect(service.resolveClaim).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ resolvedBy: 'admin-1' }),
      'admin-1',
    );
  });

  it('escalation', async () => {
    const { service, controller } = claimsHarness();
    await controller.escalateClaim(adminSession(), 'c1', { reason: 'délai' });
    expect(service.escalateClaim).toHaveBeenCalledWith(
      'c1',
      'admin-1',
      'délai',
    );
  });
});

// ─── Legal — acceptances and acting identity ─────────────────────────────────

function legalHarness() {
  const service = {
    createDocument: jest.fn(async () => ({})),
    acceptDocument: jest.fn(async () => undefined),
    getUserAcceptances: jest.fn(async () => []),
    updateDocument: jest.fn(async () => ({})),
    restoreVersion: jest.fn(async () => ({})),
  };
  const controller = new LegalController(
    service as unknown as LegalService,
    new PermissionsService(),
  );
  return { service, controller };
}

describe('LegalController — acceptances', () => {
  it('accepting a document records the session user', async () => {
    const { service, controller } = legalHarness();
    await controller.acceptDocument(session(1), 'terms');
    expect(service.acceptDocument).toHaveBeenCalledWith('terms', OWNER_ID);
  });

  it('a customer reads their own acceptances', async () => {
    const { service, controller } = legalHarness();
    await controller.getUserAcceptances(session(1), OWNER_ID);
    expect(service.getUserAcceptances).toHaveBeenCalledWith(OWNER_ID);
  });

  it("a customer cannot read another user's acceptances", async () => {
    const { service, controller } = legalHarness();
    await expect(
      controller.getUserAcceptances(session(1), 'u2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getUserAcceptances).not.toHaveBeenCalled();
  });

  it("staff reads any user's acceptances", async () => {
    const { service, controller } = legalHarness();
    await controller.getUserAcceptances(session(3, 'staff-1'), 'u2');
    expect(service.getUserAcceptances).toHaveBeenCalledWith('u2');
  });
});

describe('LegalController — admin edits are attributed to the session', () => {
  it('document creation ignores a forged author', async () => {
    const { service, controller } = legalHarness();
    await controller.createDocument(session(7, 'admin-1'), {
      type: 'terms',
      title: 'Conditions générales',
      content: 'Contenu',
      language: 'fr',
      createdBy: 'someone-else',
      id: 'forged',
    } as any);
    expect(service.createDocument).toHaveBeenCalledWith({
      type: 'terms',
      title: 'Conditions générales',
      content: 'Contenu',
      language: 'fr',
      effectiveDate: undefined,
      metadata: undefined,
      createdBy: 'admin-1',
    });
  });

  it('document update', async () => {
    const { service, controller } = legalHarness();
    await controller.updateDocument(session(7, 'admin-1'), 'd1', {
      updates: { title: 'CGV' },
      changes: 'typo',
    });
    expect(service.updateDocument).toHaveBeenCalledWith(
      'd1',
      { title: 'CGV' },
      'admin-1',
      'typo',
    );
  });

  it('version restore', async () => {
    const { service, controller } = legalHarness();
    await controller.restoreVersion(session(7, 'admin-1'), 'd1', 'v2');
    expect(service.restoreVersion).toHaveBeenCalledWith('d1', 'v2', 'admin-1');
  });
});

// ─── Reviews — acting identity ───────────────────────────────────────────────

describe('ReviewController — moderation is attributed to the session', () => {
  it('ignores a forged moderator', async () => {
    const service = { moderateReview: jest.fn(async () => ({})) };
    const controller = new ReviewController(
      service as unknown as ReviewService,
    );
    await controller.moderateReview(session(7, 'admin-1'), 'r1', {
      action: 'approve',
      moderatorId: 'someone-else',
      moderatorNote: 'ok',
    } as any);
    expect(service.moderateReview).toHaveBeenCalledWith(
      'r1',
      'approve',
      'admin-1',
      'ok',
    );
  });

  it('refuses a session without user id', async () => {
    const service = { moderateReview: jest.fn(async () => ({})) };
    const controller = new ReviewController(
      service as unknown as ReviewService,
    );
    await expect(
      controller.moderateReview({ user: {} }, 'r1', { action: 'reject' }),
    ).rejects.toBeInstanceOf(AuthenticationException);
    expect(service.moderateReview).not.toHaveBeenCalled();
  });
});
