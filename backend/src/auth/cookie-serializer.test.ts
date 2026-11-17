/**
 * Relecture de session — compte du personnel désactivé.
 *
 * La connexion refuse un compte inactif ; ces tests fixent la même règle à la
 * relecture : une session ouverte avant la désactivation d'un compte du
 * personnel (`cnfa_activ` ≠ '1') est refusée, comme celle d'un compte
 * introuvable. `CookieSerializer` est exercé avec l'`AuthService` réel : seule
 * la couche de données est simulée.
 *
 * Le compte client n'est pas concerné par cette règle : son comportement
 * actuel est fixé ici tel quel.
 */
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import passport from 'passport';
import { CacheService } from '@cache/cache.service';
import { AuthService } from './auth.service';
import { CookieSerializer } from './cookie-serializer';
import { UserDataConsolidatedService } from '../modules/users/services/user-data-consolidated.service';
import { PasswordCryptoService } from '../shared/crypto/password-crypto.service';
import { STAFF_LEVEL } from './session-privilege';

type SessionData = Parameters<CookieSerializer['deserializeUser']>[0];

function adminRow(isActive: boolean) {
  return {
    id: 'adm-1',
    email: 'equipe@example.test',
    firstName: 'Equipe',
    lastName: 'Test',
    isActive,
    level: STAFF_LEVEL.SUPER_ADMIN,
  };
}

function customerRow(isActive: boolean) {
  return {
    id: 'cst-1',
    email: 'client@example.test',
    firstName: 'Client',
    lastName: 'Test',
    isActive,
    isPro: false,
    level: 1,
  };
}

const ADMIN_SESSION: SessionData = {
  userId: 'adm-1',
  authSource: 'admin',
  sessionVersion: 0,
};
const CUSTOMER_SESSION: SessionData = {
  userId: 'cst-1',
  authSource: 'customer',
  sessionVersion: 0,
};

describe('relecture de session — compte du personnel désactivé', () => {
  let service: AuthService;
  let serializer: CookieSerializer;

  const users = { findAdminById: jest.fn(), findById: jest.fn() };
  const jwt = { sign: jest.fn(), verify: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  /** Résultat rendu à Passport : l'utilisateur, ou `false` (session refusée). */
  function deserialize(session: SessionData): Promise<unknown> {
    return new Promise((resolve, reject) => {
      void serializer.deserializeUser(session, (err, user) =>
        err ? reject(err) : resolve(user),
      );
    });
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    users.findAdminById.mockResolvedValue(null);
    users.findById.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        CookieSerializer,
        { provide: UserDataConsolidatedService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: CacheService, useValue: cache },
        { provide: PasswordCryptoService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
    serializer = moduleRef.get(CookieSerializer);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('CookieSerializer.deserializeUser', () => {
    it('accepte la session d’un administrateur actif', async () => {
      users.findAdminById.mockResolvedValue(adminRow(true));

      expect(await deserialize(ADMIN_SESSION)).toMatchObject({
        id: 'adm-1',
        authSource: 'admin',
        isAdmin: true,
        isActive: true,
        level: STAFF_LEVEL.SUPER_ADMIN,
      });
    });

    it('refuse la session d’un administrateur inactif', async () => {
      users.findAdminById.mockResolvedValue(adminRow(false));

      expect(await deserialize(ADMIN_SESSION)).toBe(false);
    });

    it('refuse la session d’un administrateur introuvable', async () => {
      users.findAdminById.mockResolvedValue(null);

      expect(await deserialize(ADMIN_SESSION)).toBe(false);
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('refuse une session déjà ouverte dès que le cache de 5 s est échu', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      users.findAdminById.mockResolvedValue(adminRow(true));
      expect(await deserialize(ADMIN_SESSION)).toMatchObject({ id: 'adm-1' });

      // Le compte est désactivé en base pendant que la session est ouverte.
      users.findAdminById.mockResolvedValue(adminRow(false));

      // Fenêtre du cache en mémoire : la désactivation n'est pas encore lue.
      jest.advanceTimersByTime(4_000);
      expect(await deserialize(ADMIN_SESSION)).toMatchObject({ id: 'adm-1' });
      expect(users.findAdminById).toHaveBeenCalledTimes(1);

      // Cache échu : la base est relue, la session est refusée.
      jest.advanceTimersByTime(1_001);
      expect(await deserialize(ADMIN_SESSION)).toBe(false);
      expect(users.findAdminById).toHaveBeenCalledTimes(2);

      // Le refus n'est pas mis en cache : chaque relecture suivante échoue.
      expect(await deserialize(ADMIN_SESSION)).toBe(false);
    });

    it('ancien format de session : un administrateur inactif est refusé, sans repli sur un compte client de même identifiant', async () => {
      users.findAdminById.mockResolvedValue(adminRow(false));
      users.findById.mockResolvedValue({ ...customerRow(true), id: 'adm-1' });

      expect(await deserialize('adm-1')).toBe(false);
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('ancien format de session : un administrateur actif est accepté', async () => {
      users.findAdminById.mockResolvedValue(adminRow(true));

      expect(await deserialize('adm-1')).toMatchObject({
        id: 'adm-1',
        isAdmin: true,
      });
    });

    it('compte client actif : session acceptée (inchangé)', async () => {
      users.findById.mockResolvedValue(customerRow(true));

      expect(await deserialize(CUSTOMER_SESSION)).toMatchObject({
        id: 'cst-1',
        authSource: 'customer',
        isAdmin: false,
      });
      expect(users.findAdminById).not.toHaveBeenCalled();
    });

    it('compte client introuvable : session refusée (inchangé)', async () => {
      expect(await deserialize(CUSTOMER_SESSION)).toBe(false);
    });

    // Comportement actuel, laissé tel quel par ce correctif : la relecture
    // n'applique pas `isActive` à un compte client. Écart signalé au mandat BA.
    it('compte client inactif : session encore acceptée (inchangé)', async () => {
      users.findById.mockResolvedValue(customerRow(false));

      expect(await deserialize(CUSTOMER_SESSION)).toMatchObject({
        id: 'cst-1',
        authSource: 'customer',
        isActive: false,
      });
    });
  });

  // Passport réel (`passport.session()`, celui de main.ts) : ce que les gardes
  // lisent ensuite, et ce qui reste dans la session après un refus.
  describe('passport.session() — effet du refus', () => {
    type SessionRequest = {
      session: { passport: { user?: SessionData } };
      user?: unknown;
      isAuthenticated?: () => boolean;
    };

    async function replaySession(stored: SessionData): Promise<SessionRequest> {
      const authenticator = new passport.Passport();
      authenticator.deserializeUser((data: SessionData, done) => {
        void serializer.deserializeUser(data, done);
      });
      const req: SessionRequest = { session: { passport: { user: stored } } };
      await new Promise<void>((resolve, reject) => {
        authenticator.session()(req as never, {} as never, (err?: unknown) =>
          err ? reject(err) : resolve(),
        );
      });
      return req;
    }

    it('administrateur actif : requête authentifiée, session conservée', async () => {
      users.findAdminById.mockResolvedValue(adminRow(true));

      const req = await replaySession(ADMIN_SESSION);

      expect(req.isAuthenticated?.()).toBe(true);
      expect(req.user).toMatchObject({ id: 'adm-1', isAdmin: true });
      expect(req.session.passport.user).toEqual(ADMIN_SESSION);
    });

    it('administrateur inactif : requête anonyme, identité retirée de la session', async () => {
      users.findAdminById.mockResolvedValue(adminRow(false));

      const req = await replaySession(ADMIN_SESSION);

      expect(req.isAuthenticated?.()).toBe(false);
      expect(req.user).toBeUndefined();
      expect(req.session.passport.user).toBeUndefined();
    });

    it('administrateur introuvable : requête anonyme, identité retirée de la session', async () => {
      const req = await replaySession(ADMIN_SESSION);

      expect(req.isAuthenticated?.()).toBe(false);
      expect(req.user).toBeUndefined();
      expect(req.session.passport.user).toBeUndefined();
    });
  });

  describe('AuthService — relecture par identifiant', () => {
    it('getUserByIdAndSource : administrateur inactif → aucune identité', async () => {
      users.findAdminById.mockResolvedValue(adminRow(false));

      expect(await service.getUserByIdAndSource('adm-1', 'admin')).toBeNull();
    });

    it('getUserById : administrateur inactif → aucune identité, sans lecture de la table client', async () => {
      users.findAdminById.mockResolvedValue(adminRow(false));

      expect(await service.getUserById('adm-1')).toBeNull();
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('jeton JWT d’un administrateur inactif → refusé', async () => {
      jwt.verify.mockReturnValue({ sub: 'adm-1' });
      users.findAdminById.mockResolvedValue(adminRow(false));

      expect(await service.validateToken('jeton')).toBeNull();
    });

    it('isAdmin(id) est faux pour un administrateur inactif', async () => {
      users.findAdminById.mockResolvedValue(adminRow(false));

      expect(await service.isAdmin('adm-1')).toBe(false);
    });

    it('administrateur actif : identité et droits conservés', async () => {
      users.findAdminById.mockResolvedValue(adminRow(true));

      expect(
        await service.getUserByIdAndSource('adm-1', 'admin'),
      ).toMatchObject({ isAdmin: true, level: STAFF_LEVEL.SUPER_ADMIN });
      expect(await service.isAdmin('adm-1')).toBe(true);
    });
  });
});
