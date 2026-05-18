import { describe, it, expect } from 'vitest';
import { buildPiecesVehicleMeta } from '~/utils/pieces-vehicle.meta';
import type { NoProductsData } from '~/components/pieces/NoProductsAlternatives';

const noProductsFixture: NoProductsData = {
  noProducts: true,
  gammeId: 3859,
  gammeAlias: 'kit-de-freins-arriere',
  gammeName: 'Kit de freins arrière',
  vehicleLabel: 'BMW Série 5 (F10-F18) 525 d',
  vehicleContext: {
    marqueName: 'BMW',
    modeleName: 'Série 5 (F10-F18)',
    typeName: '525 d',
    typeFuel: 'Diesel',
    typePowerPs: '218',
    yearFrom: '2011',
    yearTo: '2016',
  },
  alternativeGammes: [
    { pg_id: 3860, pg_name: 'Disques arrière', pg_alias: 'disques-arriere', pg_pic: null, piece_count: 42, tier: 1 },
  ],
  alternativeVehicles: [
    {
      type_id: '11838',
      type_name: '530 d',
      type_alias: '3-0-530-d',
      type_fuel: 'Diesel',
      type_power_ps: '258',
      type_year_from: '2011',
      type_year_to: '2016',
      modele_id: 33053,
      modele_name: 'Série 5 (F10-F18)',
      modele_alias: 'serie-5-f10-f18',
      marque_id: 33,
      marque_name: 'BMW',
      marque_alias: 'bmw',
      tier: 1,
    },
  ],
  relatedModels: [],
};

const location = {
  pathname: '/pieces/kit-de-freins-arriere-3859/bmw-33/serie-5-f10-f18-33053/2-0-525-d-11836.html',
};

describe('buildPiecesVehicleMeta — soft-404 branch', () => {
  const meta = buildPiecesVehicleMeta(noProductsFixture, location);

  it('inclut robots: noindex, follow', () => {
    const robotsEntry = meta.find((m: any) => m.name === 'robots');
    expect(robotsEntry?.content).toBe('noindex, follow');
  });

  it('title contient gamme + véhicule + motif "non référencé" ou "alternatives"', () => {
    const titleEntry = meta.find((m: any) => 'title' in m) as any;
    const title = titleEntry?.title as string;
    expect(title).toMatch(/Kit de freins arrière/);
    expect(title).toMatch(/BMW|525/);
    expect(title).toMatch(/non référencé|alternatives/i);
  });

  it('description évoque le véhicule et les alternatives', () => {
    const descEntry = meta.find((m: any) => m.name === 'description') as any;
    const desc = descEntry?.content as string;
    expect(desc).toMatch(/525 d|525d/i);
    expect(desc).toMatch(/alternative/i);
  });

  it('émet un JSON-LD ItemList', () => {
    const ld = meta.find((m: any) => 'script:ld+json' in m) as any;
    expect(ld).toBeDefined();
    const parsed = ld['script:ld+json'];
    expect(parsed['@type']).toBe('ItemList');
    expect(Array.isArray(parsed.itemListElement)).toBe(true);
    expect(parsed.itemListElement.length).toBeGreaterThan(0);
  });

  it('og:title et og:description présents et cohérents', () => {
    const ogt = (meta.find((m: any) => m.property === 'og:title') as any)?.content;
    const ogd = (meta.find((m: any) => m.property === 'og:description') as any)?.content;
    expect(ogt).toBeTruthy();
    expect(ogd).toBeTruthy();
  });
});
