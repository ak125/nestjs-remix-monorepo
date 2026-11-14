/**
 * Démarrage de LegalService — aucune requête en base.
 *
 * Le constructeur cherchait les documents légaux par un LIKE '%…%' sur toute la
 * table des messages et tentait d'en insérer des versions rédigées dans le code,
 * à chaque démarrage de chaque instance. Construire le service ne doit plus
 * toucher Supabase.
 */

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

import { LegalService } from '../legal.service';
import type { LegalPageService } from '../legal-page.service';
import type { LegalVersionService } from '../legal-version.service';

describe('LegalService — démarrage', () => {
  // Valeurs factices : le client est simulé, aucune connexion n'est ouverte.
  const saved = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  beforeAll(() => {
    process.env.SUPABASE_URL = 'http://supabase.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  });
  afterAll(() => {
    if (saved.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
  });

  it("n'envoie aucune requête à Supabase quand il est construit", async () => {
    new LegalService({} as LegalVersionService, {} as LegalPageService);
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
