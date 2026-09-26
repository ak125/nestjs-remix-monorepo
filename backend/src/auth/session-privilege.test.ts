/**
 * Niveau de droits porté par une session — personnel vs client.
 *
 * `cst_level` (palier d'un compte client) et `cnfa_level` (droits du
 * personnel) partagent les mêmes chiffres. Ces tests fixent la frontière :
 * chaque constructeur d'identité de l'AuthService produit, pour un compte
 * client, une session sans droit d'équipe quel que soit son palier, et les
 * gardes qui lisent `level` / `isAdmin` refusent ce principal.
 *
 * @see backend/src/auth/session-privilege.ts
 */
import { Test } from '@nestjs/testing';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@cache/cache.service';
import { AuthService, type AuthUser } from './auth.service';
import { UserDataConsolidatedService } from '../modules/users/services/user-data-consolidated.service';
import { PasswordCryptoService } from '../shared/crypto/password-crypto.service';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { IsAdminGuard } from './is-admin.guard';
import { AdminSessionGuard } from './admin-session.guard';
import { CookieSerializer } from './cookie-serializer';
import {
  ADMIN_PERMISSIONS,
  COMMERCIAL_PERMISSIONS,
  MANAGER_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  type PermissionAction,
} from './dto/user-permissions.dto';
import {
  CUSTOMER_SESSION_LEVEL,
  STAFF_LEVEL,
  isAdminSession,
  sessionPrivilegeLevel,
} from './session-privilege';

// Paliers client présents ou possibles (le DTO client borne `level` à 1..10).
const CUSTOMER_TIERS = [0, 1, 3, 5, 7, 9, 10];

function customerRow(level: number) {
  return {
    id: 'cst-1',
    email: 'client@example.test',
    firstName: 'Client',
    lastName: 'Test',
    isActive: true,
    isPro: level >= 5,
    level,
  };
}

function adminRow(level: number) {
  return {
    id: 'adm-1',
    email: 'equipe@example.test',
    firstName: 'Equipe',
    lastName: 'Test',
    isActive: true,
    level,
  };
}

function resolvedRow(authSource: 'admin' | 'customer', level: number) {
  return {
    userId: authSource === 'admin' ? 'adm-1' : 'cst-1',
    email: 'compte@example.test',
    passwordHash: '$2b$10$hash',
    firstName: 'Compte',
    lastName: 'Test',
    level,
    isActive: true,
    authSource,
  };
}

function httpContext(req: Record<string, unknown>): ExecutionContext {
  const handler = () => undefined;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function expectCustomerSession(user: AuthUser | null) {
  expect(user).not.toBeNull();
  expect(user!.level).toBe(CUSTOMER_SESSION_LEVEL);
  expect(user!.isAdmin).toBe(false);
  expect(user!.authSource).toBe('customer');
}

describe('session-privilege — échelle et règles', () => {
  it.each(CUSTOMER_TIERS)(
    'une session client (palier %i) porte le niveau de base',
    (tier) => {
      expect(sessionPrivilegeLevel('customer', tier)).toBe(
        CUSTOMER_SESSION_LEVEL,
      );
      expect(isAdminSession('customer', tier)).toBe(false);
    },
  );

  it('une session du personnel porte son niveau de droits', () => {
    expect(sessionPrivilegeLevel('admin', STAFF_LEVEL.COMMERCIAL)).toBe(3);
    expect(sessionPrivilegeLevel('admin', STAFF_LEVEL.SUPER_ADMIN)).toBe(9);
    expect(isAdminSession('admin', STAFF_LEVEL.ADMIN)).toBe(true);
    expect(isAdminSession('admin', STAFF_LEVEL.MANAGER)).toBe(false);
  });

  it('le niveau de base ne donne aucune permission du personnel', () => {
    const permissions = new PermissionsService().getPermissions(
      CUSTOMER_SESSION_LEVEL,
    );
    expect(Object.values(permissions).every((v) => v === false)).toBe(true);
  });

  it('PermissionsService lit la même échelle que les sessions du personnel', () => {
    const service = new PermissionsService();
    expect(service.getPermissions(STAFF_LEVEL.COMMERCIAL)).toBe(
      COMMERCIAL_PERMISSIONS,
    );
    expect(service.getPermissions(STAFF_LEVEL.MANAGER)).toBe(
      MANAGER_PERMISSIONS,
    );
    expect(service.getPermissions(STAFF_LEVEL.ADMIN)).toBe(ADMIN_PERMISSIONS);
    expect(service.getPermissions(STAFF_LEVEL.SUPER_ADMIN)).toBe(
      SUPER_ADMIN_PERMISSIONS,
    );
  });
});

describe('AuthService — constructeurs d’identité', () => {
  let service: AuthService;

  const users = {
    resolveUserByEmail: jest.fn(),
    emailExistsAnywhere: jest.fn(),
    findAdminById: jest.fn(),
    findById: jest.fn(),
    findByGoogleId: jest.fn(),
    findByEmail: jest.fn(),
    linkGoogleId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setPasswordHash: jest.fn(),
  };
  const jwt = { sign: jest.fn(), verify: jest.fn() };
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delete: jest.fn(),
    getLoginAttempts: jest.fn(),
    incrementLoginAttempts: jest.fn(),
    clearLoginAttempts: jest.fn(),
  };
  const crypto = {
    validatePassword: jest.fn(),
    needsRehash: jest.fn(),
    upgradeHashIfNeeded: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    cache.getLoginAttempts.mockResolvedValue(0);
    crypto.validatePassword.mockResolvedValue({
      isValid: true,
      format: 'bcrypt',
    });
    crypto.needsRehash.mockReturnValue(false);
    users.findAdminById.mockResolvedValue(null);
    users.findById.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserDataConsolidatedService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: CacheService, useValue: cache },
        { provide: PasswordCryptoService, useValue: crypto },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe.each(CUSTOMER_TIERS)('compte client au palier %i', (tier) => {
    it('connexion e-mail + mot de passe → session client', async () => {
      users.resolveUserByEmail.mockResolvedValue(resolvedRow('customer', tier));
      expectCustomerSession(
        await service.authenticateUser('compte@example.test', 'secret'),
      );
    });

    it('recherche par e-mail → session client', async () => {
      users.emailExistsAnywhere.mockResolvedValue(true);
      users.resolveUserByEmail.mockResolvedValue(resolvedRow('customer', tier));
      expectCustomerSession(
        await service.checkIfUserExists({ email: 'compte@example.test' }),
      );
    });

    it('relecture de session (source client) → session client', async () => {
      users.findById.mockResolvedValue(customerRow(tier));
      expectCustomerSession(
        await service.getUserByIdAndSource('cst-1', 'customer'),
      );
    });

    it('relecture de session ancienne (sans source) → session client', async () => {
      users.findById.mockResolvedValue(customerRow(tier));
      expectCustomerSession(await service.getUserById('cst-1'));
    });

    it('jeton JWT → session client', async () => {
      jwt.verify.mockReturnValue({ sub: 'cst-1' });
      users.findById.mockResolvedValue(customerRow(tier));
      expectCustomerSession(await service.validateToken('jeton'));
    });

    it('session depuis la requête → session client', async () => {
      jwt.verify.mockReturnValue({ sub: 'cst-1' });
      users.findById.mockResolvedValue(customerRow(tier));
      const session = await service.getSessionFromRequest({
        headers: { authorization: 'Bearer jeton' },
      });
      expectCustomerSession(session?.user ?? null);
    });

    it('mise à jour du profil → session client', async () => {
      users.update.mockResolvedValue(customerRow(tier));
      expectCustomerSession(
        await service.updateUserProfile('cst-1', { firstName: 'Client' }),
      );
    });

    it('connexion Google → session client', async () => {
      Object.assign(service as unknown as Record<string, unknown>, {
        googleClientId: 'client-id',
        googleClient: {
          verifyIdToken: jest.fn().mockResolvedValue({
            getPayload: () => ({ sub: 'g-1', email: 'compte@example.test' }),
          }),
        },
      });
      users.findByGoogleId.mockResolvedValue(customerRow(tier));
      expectCustomerSession(await service.authenticateWithGoogle('id-token'));
    });

    it('isAdmin(id) est faux', async () => {
      users.findById.mockResolvedValue(customerRow(tier));
      expect(await service.isAdmin('cst-1')).toBe(false);
    });

    it.each([
      'admin',
      'finance',
      'seo',
      'expedition',
      'inventory',
      'dashboard',
    ])('checkModuleAccess refuse le module %s en lecture', async (module) => {
      users.findById.mockResolvedValue(customerRow(tier));
      const result = await service.checkModuleAccess('cst-1', module, 'read');
      expect(result.hasAccess).toBe(false);
    });
  });

  it('le palier client ≥ 5 reste un compte pro (isPro inchangé)', async () => {
    users.resolveUserByEmail.mockResolvedValue(resolvedRow('customer', 5));
    const user = await service.authenticateUser(
      'compte@example.test',
      'secret',
    );
    expect(user?.isPro).toBe(true);
    users.findById.mockResolvedValue(customerRow(5));
    expect(
      (await service.getUserByIdAndSource('cst-1', 'customer'))?.isPro,
    ).toBe(true);
  });

  it.each([
    [STAFF_LEVEL.COMMERCIAL, false],
    [STAFF_LEVEL.MANAGER, false],
    [STAFF_LEVEL.ADMIN, true],
    [STAFF_LEVEL.SUPER_ADMIN, true],
  ])(
    'personnel au niveau %i : niveau conservé, administrateur = %s',
    async (level, admin) => {
      users.resolveUserByEmail.mockResolvedValue(resolvedRow('admin', level));
      const login = await service.authenticateUser(
        'compte@example.test',
        'secret',
      );
      expect(login).toMatchObject({
        level,
        isAdmin: admin,
        authSource: 'admin',
      });

      users.emailExistsAnywhere.mockResolvedValue(true);
      expect(
        await service.checkIfUserExists({ email: 'compte@example.test' }),
      ).toMatchObject({ level, isAdmin: admin, authSource: 'admin' });

      users.findAdminById.mockResolvedValue(adminRow(level));
      expect(
        await service.getUserByIdAndSource('adm-1', 'admin'),
      ).toMatchObject({
        level,
        isAdmin: admin,
        authSource: 'admin',
      });
      expect(await service.getUserById('adm-1')).toMatchObject({
        level,
        isAdmin: admin,
      });
      expect(await service.isAdmin('adm-1')).toBe(admin);
    },
  );

  describe('gardes — principal réel produit par la connexion', () => {
    async function customerPrincipal(tier: number) {
      users.resolveUserByEmail.mockResolvedValue(resolvedRow('customer', tier));
      return service.authenticateUser('compte@example.test', 'secret');
    }
    async function staffPrincipal(level: number) {
      users.resolveUserByEmail.mockResolvedValue(resolvedRow('admin', level));
      return service.authenticateUser('compte@example.test', 'secret');
    }

    let permissionsGuard: PermissionsGuard;
    let reflector: Reflector;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [PermissionsGuard, PermissionsService, Reflector],
      }).compile();
      permissionsGuard = moduleRef.get(PermissionsGuard);
      reflector = moduleRef.get(Reflector);
    });

    function permits(user: AuthUser | null, action: PermissionAction) {
      jest.spyOn(reflector, 'get').mockReturnValue(action);
      return permissionsGuard.canActivate(httpContext({ user }));
    }

    it.each(CUSTOMER_TIERS)(
      'client au palier %i : refusé par IsAdminGuard, AdminSessionGuard, PermissionsGuard',
      async (tier) => {
        const user = await customerPrincipal(tier);
        expectCustomerSession(user);
        expect(new IsAdminGuard().canActivate(httpContext({ user }))).toBe(
          false,
        );
        expect(() =>
          new AdminSessionGuard().canActivate(
            httpContext({ user, method: 'GET', url: '/admin' }),
          ),
        ).toThrow(new UnauthorizedException('Admin level required'));
        expect(permits(user, 'canSeeCustomerDetails')).toBe(false);
        expect(permits(user, 'canCancel')).toBe(false);
        expect(permits(user, 'canRefund')).toBe(false);
      },
    );

    it('personnel administrateur : accepté par les trois gardes', async () => {
      const user = await staffPrincipal(STAFF_LEVEL.ADMIN);
      expect(new IsAdminGuard().canActivate(httpContext({ user }))).toBe(true);
      expect(
        new AdminSessionGuard().canActivate(
          httpContext({ user, method: 'GET', url: '/admin' }),
        ),
      ).toBe(true);
      expect(permits(user, 'canRefund')).toBe(true);
    });

    it('personnel commercial : droits commerciaux, pas administrateur', async () => {
      const user = await staffPrincipal(STAFF_LEVEL.COMMERCIAL);
      expect(permits(user, 'canSeeCustomerDetails')).toBe(true);
      expect(permits(user, 'canRefund')).toBe(false);
      expect(new IsAdminGuard().canActivate(httpContext({ user }))).toBe(false);
    });

    it('le cookie de session garde la source client, quel que soit le palier', async () => {
      const serializer = new CookieSerializer({
        getSessionVersion: jest.fn().mockResolvedValue(0),
      } as unknown as AuthService);
      users.findById.mockResolvedValue(customerRow(10));
      const user = await service.getUserByIdAndSource('cst-1', 'customer');
      const stored = await new Promise((resolve) =>
        serializer.serializeUser(user, (_err, value) => resolve(value)),
      );
      expect(stored).toEqual({
        userId: 'cst-1',
        authSource: 'customer',
        sessionVersion: 0,
      });
    });
  });
});
