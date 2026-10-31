import { GammeDataTransformerService } from '../../src/modules/gamme-rest/services/gamme-data-transformer.service';

// FH-14 : la vignette du catalogue famille lit pg_img (dossier catalogue/) ;
// pg_pic (hero) ne sert que si pg_img manque.
describe('GammeDataTransformerService.processCatalogueFamille', () => {
  const transformer = new GammeDataTransformerService();
  const base = { pg_name: 'Filtre', description: '', meta_description: '' };
  const catalogue = '/img/uploads/articles/gammes-produits/catalogue';

  it('prend pg_img avant pg_pic', () => {
    const [row] = transformer.processCatalogueFamille([
      { ...base, pg_id: 424, pg_alias: 'filtre-d-habitacle', pg_pic: 'filtre-habitacle.webp', pg_img: 'filtre-d-habitacle.webp' },
    ]);
    expect(row.image).toBe(`${catalogue}/filtre-d-habitacle.webp`);
    expect(row.link).toBe('/pieces/filtre-d-habitacle-424.html');
  });

  it('sans pg_img, garde pg_pic ; sans les deux, image par défaut', () => {
    const rows = transformer.processCatalogueFamille([
      { ...base, pg_id: 8, pg_alias: 'filtre-a-air', pg_pic: 'filtre-a-air.webp', pg_img: null },
      { ...base, pg_id: 9, pg_alias: 'filtre-a-carburant' },
    ]);
    expect(rows.map((r) => r.image)).toEqual([
      `${catalogue}/filtre-a-air.webp`,
      '/images/pieces/default.png',
    ]);
  });
});
