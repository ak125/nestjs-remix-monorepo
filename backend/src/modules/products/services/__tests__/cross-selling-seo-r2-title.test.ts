process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

// Le mock partagé de @repo/database-types ne porte pas ces tables.
jest.mock('@repo/database-types', () => ({
  TABLES: {
    seo_gamme_car: '__seo_gamme_car',
    seo_gamme_car_switch: '__seo_gamme_car_switch',
    seo_family_gamme_car_switch: '__seo_family_gamme_car_switch',
  },
}));

import { CrossSellingSeoService } from '../cross-selling-seo.service';
import type { CrossGamme, VehicleContext } from '../cross-selling.service';

/**
 * Complément 1 du mandat DW (2026-11-19) : `cross-selling-seo` lit
 * `__seo_gamme_car.sgc_title` mais ne comprenait aucun marqueur du gabarit R2.
 * L'ancien gabarit rendait « . », le nouveau un titre vide.
 */
const OLD_TITLE =
  '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.';
const NEW_TITLE =
  '#Gamme# #VMarqueAffichage# #VModeleAffichage# #VTypeCarburantPuissance#';
// Gabarit du complément 1 (valeur antérieure acceptée par la migration).
const C1_TITLE = '#Gamme# #VMarque# #VModele# #VTypeCarburantPuissance#';

function build(sgcTitle: string) {
  const svc = new CrossSellingSeoService();
  const chain = (data: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      single: async () => ({ data, error: null }),
      then: (ok: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(ok),
    };
    return q;
  };
  Object.defineProperty(svc, 'supabase', {
    value: {
      from: () =>
        chain({
          sgc_title: sgcTitle,
          sgc_descrip: '',
          sgc_h1: '',
          sgc_content: '',
        }),
    },
  });
  return svc;
}

const gamme: CrossGamme = {
  pg_id: 316,
  pg_name: 'Thermostat',
  pg_alias: 'thermostat',
  cross_level: 1,
  source: 'family',
};
const vehicle: VehicleContext = {
  type_id: 33030,
  mfId: 0,
  marque_name: 'VOLKSWAGEN',
  modele_name: 'GOLF VI',
  type_name: '1.6 TDI',
  type_nbch: 90,
  type_date: '2009',
};

describe('CrossSellingSeoService — gabarit R2 de sgc_title (complément 1 DW)', () => {
  it('nouveau gabarit : titre rendu, plus de titre vide', async () => {
    const r = await build(NEW_TITLE).generateAdvancedCrossSellingSeo(
      gamme,
      33030,
      316,
      vehicle,
    );
    // Complément 2 : casse normale ; pas de nom d'affichage dans ce contexte.
    expect(r.title).toBe('Thermostat Volkswagen Golf VI 1.6 TDI 90 ch');
  });

  it('gabarit du complément 1 : marque et modèle bruts', async () => {
    const r = await build(C1_TITLE).generateAdvancedCrossSellingSeo(
      gamme,
      33030,
      316,
      vehicle,
    );
    expect(r.title).toBe('Thermostat VOLKSWAGEN GOLF VI 1.6 TDI 90 ch');
  });

  it('ancien gabarit : marqueurs véhicule rendus, prix toujours absent', async () => {
    const r = await build(OLD_TITLE).generateAdvancedCrossSellingSeo(
      gamme,
      33030,
      316,
      vehicle,
    );
    expect(r.title).toMatch(/^Thermostat VOLKSWAGEN GOLF VI 1\.6 TDI\s*\.$/);
  });

  it('puissance inconnue (0) : rien d’inventé', () => {
    const svc = build(NEW_TITLE);
    expect(
      svc.replaceVariables(NEW_TITLE, {
        gammeMeta: 'Thermostat',
        gammeAlias: 'thermostat',
        marque: 'PEUGEOT',
        modele: '207',
        type: '1.4',
        nbCh: 0,
        annee: '2008',
      }),
    ).toBe('Thermostat Peugeot 207 1.4');
  });
});
