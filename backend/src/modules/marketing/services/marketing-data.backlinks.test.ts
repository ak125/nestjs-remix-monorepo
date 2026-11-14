/**
 * Suivi des backlinks — une erreur de base est une panne, pas une absence de liens.
 *
 * Les lectures renvoyaient une liste vide et des compteurs à zéro quand la base
 * répondait en erreur, et le contrôleur admin répondait `success: true`. Les
 * écritures renvoyaient `null` ou `0` sous le même `success: true`. Ces tests
 * verrouillent le comportement attendu : l'erreur est journalisée et remonte.
 */

// getAppConfig() lit process.env à la construction du service.
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import { HttpStatus, Logger } from '@nestjs/common';
import { DatabaseException, DomainNotFoundException } from '@common/exceptions';
import type { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { MarketingBacklinksController } from '../controllers/marketing-backlinks.controller';
import { MarketingBacklinksService } from './marketing-backlinks.service';
import { MarketingDataService } from './marketing-data.service';

type Reponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
};

const BACKLINKS = '__marketing_backlinks';

/**
 * Client Supabase factice : chaque table répond par la réponse donnée, que la
 * requête soit attendue directement ou terminée par `.single()`.
 */
function clientFactice(reponses: Record<string, Reponse>) {
  return {
    from: (table: string) => {
      const reponse = reponses[table] ?? { data: [], error: null };
      const requete: Record<string, unknown> = {};
      for (const methode of [
        'select',
        'insert',
        'update',
        'delete',
        'eq',
        'gte',
        'ilike',
        'order',
        'range',
      ]) {
        requete[methode] = () => requete;
      }
      requete.single = () => Promise.resolve(reponse);
      requete.then = (
        resolve: (value: Reponse) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(reponse).then(resolve, reject);
      return requete;
    },
  };
}

function sujet(reponses: Record<string, Reponse>) {
  const service = new MarketingDataService({} as unknown as RpcGateService);
  Object.defineProperty(service, 'supabase', {
    value: clientFactice(reponses),
  });
  return service;
}

const ligne = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  status: 'live',
  da_score: null,
  source_domain: 'exemple.fr',
  source_category: 'garage',
  ...overrides,
});

/** Erreurs que supabase-js rapporte sans lever d'exception. */
const PANNES: Array<[string, { code?: string; message: string }]> = [
  ['erreur de base', { code: '57014', message: 'statement timeout' }],
  [
    'permissions insuffisantes',
    { code: '42501', message: 'permission denied for table' },
  ],
  ['échec réseau', { message: 'TypeError: fetch failed' }],
];

let journal: jest.SpyInstance;

beforeEach(() => {
  journal = jest.spyOn(Logger.prototype, 'error').mockImplementation();
});

afterEach(() => {
  journal.mockRestore();
});

describe('MarketingDataService — lecture des backlinks', () => {
  it('renvoie la page demandée et le total', async () => {
    const service = sujet({
      [BACKLINKS]: {
        data: [ligne(), ligne({ id: 2 })],
        error: null,
        count: 45,
      },
    });

    await expect(
      service.getBacklinks({ page: 2, limit: 20 }),
    ).resolves.toMatchObject({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
      data: [{ id: 1 }, { id: 2 }],
    });
  });

  it('renvoie une liste vide quand la table ne contient rien', async () => {
    const service = sujet({
      [BACKLINKS]: { data: null, error: null, count: null },
    });

    await expect(service.getBacklinks({})).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    expect(journal).not.toHaveBeenCalled();
  });

  it.each(PANNES)('ne déguise pas en liste vide : %s', async (_cas, error) => {
    const service = sujet({ [BACKLINKS]: { data: null, error } });

    const echec = await service.getBacklinks({}).catch((e) => e);

    expect(echec).toBeInstanceOf(DatabaseException);
    expect(echec.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(journal).toHaveBeenCalledTimes(1);
  });
});

describe('MarketingDataService — statistiques des backlinks', () => {
  it('compte les statuts, les domaines et les catégories', async () => {
    const service = sujet({
      [BACKLINKS]: {
        data: [
          ligne({ da_score: 42 }),
          ligne({ status: 'lost', source_domain: 'autre.fr' }),
          ligne({ status: 'broken', source_category: null }),
          ligne({ status: 'pending', source_category: 'forum' }),
        ],
        error: null,
      },
    });

    await expect(service.getBacklinkStats()).resolves.toEqual({
      total: 4,
      live: 1,
      lost: 1,
      pending: 1,
      broken: 1,
      da30plus: 1,
      uniqueDomains: 2,
      byCategory: { garage: 2, other: 1, forum: 1 },
    });
  });

  it('renvoie des compteurs à zéro quand la table ne contient rien', async () => {
    const service = sujet({ [BACKLINKS]: { data: null, error: null } });

    await expect(service.getBacklinkStats()).resolves.toMatchObject({
      total: 0,
      live: 0,
      uniqueDomains: 0,
      byCategory: {},
    });
    expect(journal).not.toHaveBeenCalled();
  });

  it.each(PANNES)(
    'ne déguise pas en compteurs à zéro : %s',
    async (_cas, error) => {
      const service = sujet({ [BACKLINKS]: { data: null, error } });

      await expect(service.getBacklinkStats()).rejects.toBeInstanceOf(
        DatabaseException,
      );
      expect(journal).toHaveBeenCalledTimes(1);
    },
  );

  it('fait échouer le tableau de bord marketing au lieu d’afficher zéro backlink', async () => {
    const service = sujet({
      [BACKLINKS]: { data: null, error: { message: 'connection refused' } },
    });

    await expect(service.getDashboardStats()).rejects.toBeInstanceOf(
      DatabaseException,
    );
  });

  it('laisse le tableau de bord marketing répondre quand la lecture réussit', async () => {
    const service = sujet({ [BACKLINKS]: { data: [ligne()], error: null } });

    await expect(service.getDashboardStats()).resolves.toMatchObject({
      backlinks: { total: 1, live: 1, uniqueDomains: 1 },
    });
  });
});

describe('MarketingDataService — écriture des backlinks', () => {
  const panne = { code: '23505', message: 'duplicate key value' };

  it('renvoie la ligne créée', async () => {
    const service = sujet({ [BACKLINKS]: { data: ligne(), error: null } });

    await expect(
      service.createBacklink({ source_url: 'https://exemple.fr/a' }),
    ).resolves.toMatchObject({ id: 1 });
  });

  it('remonte l’échec d’une création au lieu de renvoyer null', async () => {
    const service = sujet({ [BACKLINKS]: { data: null, error: panne } });

    await expect(service.createBacklink({})).rejects.toBeInstanceOf(
      DatabaseException,
    );
    expect(journal).toHaveBeenCalledTimes(1);
  });

  it('compte les lignes importées', async () => {
    const service = sujet({
      [BACKLINKS]: { data: [{ id: 1 }, { id: 2 }], error: null },
    });

    await expect(service.createBacklinks([{}, {}])).resolves.toBe(2);
  });

  it('remonte l’échec d’un import au lieu de compter zéro ligne', async () => {
    const service = sujet({ [BACKLINKS]: { data: null, error: panne } });

    await expect(service.createBacklinks([{}])).rejects.toBeInstanceOf(
      DatabaseException,
    );
  });

  it('renvoie la ligne mise à jour', async () => {
    const service = sujet({
      [BACKLINKS]: { data: ligne({ status: 'lost' }), error: null },
    });

    await expect(
      service.updateBacklink(1, { status: 'lost' }),
    ).resolves.toMatchObject({ status: 'lost' });
  });

  it('répond 404 quand le backlink à mettre à jour n’existe pas', async () => {
    const service = sujet({
      [BACKLINKS]: {
        data: null,
        error: { code: 'PGRST116', message: '0 rows' },
      },
    });

    const echec = await service.updateBacklink(999, {}).catch((e) => e);

    expect(echec).toBeInstanceOf(DomainNotFoundException);
    expect(echec.getStatus()).toBe(HttpStatus.NOT_FOUND);
    // Une ligne absente n'est pas une panne de base.
    expect(journal).not.toHaveBeenCalled();
  });

  it('remonte l’échec d’une mise à jour au lieu de renvoyer null', async () => {
    const service = sujet({ [BACKLINKS]: { data: null, error: panne } });

    await expect(service.updateBacklink(1, {})).rejects.toBeInstanceOf(
      DatabaseException,
    );
  });

  it('confirme une suppression réussie', async () => {
    const service = sujet({ [BACKLINKS]: { data: null, error: null } });

    await expect(service.deleteBacklink(1)).resolves.toBe(true);
  });

  it('remonte et journalise l’échec d’une suppression', async () => {
    const service = sujet({ [BACKLINKS]: { data: null, error: panne } });

    await expect(service.deleteBacklink(1)).rejects.toBeInstanceOf(
      DatabaseException,
    );
    expect(journal).toHaveBeenCalledTimes(1);
  });
});

describe('contrôleur admin des backlinks', () => {
  const controleur = (reponses: Record<string, Reponse>) =>
    new MarketingBacklinksController(
      new MarketingBacklinksService(sujet(reponses)),
    );

  it('répond success avec les données quand la base répond', async () => {
    const api = controleur({
      [BACKLINKS]: { data: [ligne()], error: null, count: 1 },
    });

    await expect(api.getBacklinks()).resolves.toMatchObject({
      success: true,
      total: 1,
    });
    await expect(api.getStats()).resolves.toMatchObject({
      success: true,
      data: { total: 1 },
    });
  });

  it('ne répond plus success quand la base est en erreur', async () => {
    const api = controleur({
      [BACKLINKS]: { data: null, error: { message: 'connection refused' } },
    });

    await expect(api.getBacklinks()).rejects.toBeInstanceOf(DatabaseException);
    await expect(api.getStats()).rejects.toBeInstanceOf(DatabaseException);
    await expect(api.create({})).rejects.toBeInstanceOf(DatabaseException);
    await expect(api.bulkImport([{}])).rejects.toBeInstanceOf(
      DatabaseException,
    );
    await expect(api.update(1, {})).rejects.toBeInstanceOf(DatabaseException);
    await expect(api.remove(1)).rejects.toBeInstanceOf(DatabaseException);
  });
});
