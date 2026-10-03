/**
 * Redirection par défaut après connexion — elle suit le niveau de droits de
 * la session, comme le routage de `/app` et la page de connexion du frontend :
 * administrateur → `/admin`, personnel ≥ commercial → `/commercial`, sinon `/`.
 * Un compte client (session de niveau de base, `isPro` compris) va à l'accueil.
 *
 * @see backend/src/auth/session-privilege.ts
 */
import type { Response } from 'express';
import { AuthLoginController } from './auth-login.controller';
import type { AuthService, AuthUser } from '../auth.service';
import type { UsersFinalService } from '../../modules/users/users-final.service';
import type { UserDataConsolidatedService } from '../../modules/users/services/user-data-consolidated.service';
import type { CartDataService } from '../../database/services/cart-data.service';
import type { MailService } from '../../services/mail.service';
import { CUSTOMER_SESSION_LEVEL, STAFF_LEVEL } from '../session-privilege';

function sessionUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 'u-1',
    email: 'compte@example.test',
    firstName: 'Compte',
    lastName: 'Test',
    isPro: false,
    isAdmin: false,
    isActive: true,
    level: CUSTOMER_SESSION_LEVEL,
    ...overrides,
  };
}

// [libellé, utilisateur de session, redirection attendue]
const CASES: Array<[string, AuthUser, string]> = [
  ['client', sessionUser({ authSource: 'customer' }), '/'],
  ['client pro', sessionUser({ authSource: 'customer', isPro: true }), '/'],
  [
    'personnel commercial',
    sessionUser({
      authSource: 'admin',
      isPro: true,
      level: STAFF_LEVEL.COMMERCIAL,
    }),
    '/commercial',
  ],
  [
    'personnel responsable',
    sessionUser({
      authSource: 'admin',
      isPro: true,
      level: STAFF_LEVEL.MANAGER,
    }),
    '/commercial',
  ],
  [
    'personnel administrateur',
    sessionUser({
      authSource: 'admin',
      isPro: true,
      isAdmin: true,
      level: STAFF_LEVEL.ADMIN,
    }),
    '/admin',
  ],
];

function fakeRequest(user?: AuthUser): Express.Request {
  const session = {
    regenerate: (cb: (err?: Error) => void) => cb(),
    save: (cb: (err?: Error) => void) => cb(),
  };
  return {
    headers: {},
    body: {},
    query: {},
    session,
    user,
    login: (_u: unknown, cb: (err: Error | null) => void) => cb(null),
  } as unknown as Express.Request;
}

function buildController(authUser?: AuthUser): AuthLoginController {
  const authService = {
    authenticateWithGoogle: jest.fn().mockResolvedValue(authUser),
  } as unknown as AuthService;
  return new AuthLoginController(
    {} as UsersFinalService,
    authService,
    {} as UserDataConsolidatedService,
    { mergeCart: jest.fn().mockResolvedValue(0) } as unknown as CartDataService,
    {} as MailService,
  );
}

describe('AuthLoginController — redirection par défaut après connexion', () => {
  describe('POST /auth/google', () => {
    it.each(CASES)('%s', async (_label, user, expected) => {
      const result = await buildController(user).googleAuth(
        { credential: 'jeton' },
        fakeRequest(),
      );
      expect(result.redirectUrl).toBe(expected);
    });

    it('un redirectTo relatif explicite reste prioritaire', async () => {
      const result = await buildController(CASES[2][1]).googleAuth(
        { credential: 'jeton', redirectTo: '/account/orders' },
        fakeRequest(),
      );
      expect(result.redirectUrl).toBe('/account/orders');
    });
  });

  describe('POST /authenticate', () => {
    it.each(CASES)('%s', async (_label, user, expected) => {
      const redirect = jest.fn();
      await buildController().login(fakeRequest(user), {
        redirect,
      } as unknown as Response);
      expect(redirect).toHaveBeenCalledTimes(1);
      expect(redirect).toHaveBeenCalledWith(expected);
    });
  });
});
