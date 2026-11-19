import {
  SeoTemplateService,
  SeoContext,
  SeoTemplates,
} from '../seo-template.service';

/**
 * Mandat DW (2026-11-19) — titre R2 « <Gamme> <MARQUE> <MODÈLE> <type>
 * [carburant] <puissance> ch », porté par `__seo_gamme_car.sgc_title`
 * (migration `20261119_seo_r2_title_all_gammes.sql`). Exemples des gammes
 * 10 (courroie d'accessoire) et 316 (thermostat), essai initial.
 *
 * Gabarits : `OLD_TITLE` = valeur relevée en base le 2026-11-19 (118 lignes
 * sur 118) ; `NEW_TITLE` = valeur posée par la migration.
 * Contextes = pages PROD relevées le 2026-11-19 (titre servi en commentaire).
 * Complément 1 (2026-11-19) : toutes les gammes, code moteur ajouté aux
 * seules pages en collision (`R2TitleCollisionService`, simulé ici).
 */
const OLD_TITLE =
  '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.';
const NEW_TITLE = '#Gamme# #VMarque# #VModele# #VTypeCarburantPuissance#';
const H1 = '#Gamme# #VMarque# #VModele# #VType#';

function ctx(overrides: Partial<SeoContext> = {}): SeoContext {
  return {
    type_id: 18389,
    pg_id: 10,
    mf_id: 0,
    marque_name: 'DACIA',
    marque_alias: 'dacia',
    modele_name: 'LOGAN I',
    modele_alias: 'logan-i',
    type_name: '1.4',
    type_alias: '1-4',
    gamme_name: "Courroie d'accessoire",
    gamme_alias: 'courroie-d-accessoire',
    power_ps: '75',
    min_price: 10,
    // rm-builder : `legacy_marker_motorisation` = vehicleInfo.typeFuel
    // (auto_type.type_fuel) ; `fuel` n'est pas transmis.
    legacy_marker_motorisation: 'Essence',
    ...overrides,
  };
}

const templates = (title: string): SeoTemplates => ({
  h1: H1,
  title,
  description: '',
  content: '',
  preview: '',
});

function build(resolveMotorCode: jest.Mock = jest.fn().mockResolvedValue('')) {
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const record = jest.fn().mockResolvedValue({ ok: true });
  const svc = new SeoTemplateService(
    cache as unknown as ConstructorParameters<typeof SeoTemplateService>[0],
    { record } as unknown as ConstructorParameters<
      typeof SeoTemplateService
    >[1],
    { resolveMotorCode } as unknown as ConstructorParameters<
      typeof SeoTemplateService
    >[2],
  );
  return { svc, record, cache, resolveMotorCode };
}

describe('SeoTemplateService — #VTypeCarburantPuissance# (mandat DW)', () => {
  it('type ambigu essence : carburant inséré avant la puissance, sans prix', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(templates(NEW_TITLE), ctx());
    // PROD 2026-11-19 : « Courroie d'accessoire DACIA LOGAN I 1.4 75 ch à partir de 10.00€ économique. »
    expect(r.title).toBe(
      "Courroie d'accessoire DACIA LOGAN I 1.4 Essence 75 ch",
    );
    expect(record).not.toHaveBeenCalled();
  });

  it('carburant implicite (dCi, TDI) : omis', async () => {
    const { svc } = build();
    const a = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 19052,
        marque_name: 'RENAULT',
        modele_name: 'CLIO III',
        type_name: '1.5 dCi',
        power_ps: '86',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(a.title).toBe(
      "Courroie d'accessoire RENAULT CLIO III 1.5 dCi 86 ch",
    );
    const b = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 33030,
        pg_id: 316,
        gamme_name: 'Thermostat',
        marque_name: 'VOLKSWAGEN',
        modele_name: 'GOLF VI',
        type_name: '1.6 TDI',
        power_ps: '90',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(b.title).toBe('Thermostat VOLKSWAGEN GOLF VI 1.6 TDI 90 ch');
  });

  it('type non ambigu (3 parties) : carburant et puissance ajoutés', async () => {
    const { svc } = build();
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 7979,
        marque_name: 'PEUGEOT',
        modele_name: 'PARTNER I',
        type_name: '1.9 D (Phase 1)',
        power_ps: '69',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(r.title).toBe(
      "Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1) 69 ch",
    );
  });

  it('H1 inchangé par le nouveau titre', async () => {
    const { svc } = build();
    const before = await svc.processTemplates(templates(OLD_TITLE), ctx());
    const after = await svc.processTemplates(templates(NEW_TITLE), ctx());
    expect(after.h1).toBe(before.h1);
    expect(after.h1).toBe("Courroie d'accessoire DACIA LOGAN I 1.4 75 ch");
  });

  it('ancien gabarit inchangé (groupe témoin) : prix et accroche conservés', async () => {
    const { svc } = build();
    const r = await svc.processTemplates(templates(OLD_TITLE), ctx());
    expect(r.title).toMatch(
      /^Courroie d'accessoire DACIA LOGAN I 1\.4 75 ch à partir de 10\.00€ .+\.$/,
    );
  });

  it('carburant absent : rien d’inventé', async () => {
    const { svc } = build();
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({ legacy_marker_motorisation: undefined }),
    );
    expect(r.title).toBe("Courroie d'accessoire DACIA LOGAN I 1.4 75 ch");
  });

  it('page en collision : code moteur ajouté au seul titre', async () => {
    // Paire relevée le 2026-11-19 (auto_type, modèle 58030) : FIAT DUCATO V
    // Fourgon (250-290) « 2.3 D Multijet » 150 ch Diesel, types 10207
    // (codes F1AE3481E) et 65976 (F1AGL411A, F1AGL411C).
    const { svc, resolveMotorCode } = build(
      jest.fn().mockResolvedValue('F1AE3481E'),
    );
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 10207,
        marque_name: 'FIAT',
        modele_name: 'DUCATO V Fourgon (250-290)',
        type_name: '2.3 D Multijet',
        power_ps: '150',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(resolveMotorCode).toHaveBeenCalledWith(10, 10207);
    expect(r.title).toBe(
      "Courroie d'accessoire FIAT DUCATO V Fourgon (250-290) 2.3 D Multijet 150 ch F1AE3481E",
    );
    expect(r.h1).not.toContain('F1AE3481E');
  });

  it('ancien gabarit : aucune recherche de collision', async () => {
    const { svc, resolveMotorCode } = build();
    await svc.processTemplates(templates(OLD_TITLE), ctx());
    expect(resolveMotorCode).not.toHaveBeenCalled();
  });

  it('lecture de collision en erreur : échec signalé, rien en cache', async () => {
    const { svc, cache } = build(
      jest.fn().mockRejectedValue(new Error('db down')),
    );
    const r = await svc.processTemplates(templates(NEW_TITLE), ctx());
    expect(r.success).toBe(false);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('carburant électrique : une seule graphie affichée', async () => {
    const { svc } = build();
    const a = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_name: '1.8 Hybrid',
        power_ps: '122',
        legacy_marker_motorisation: 'Essence-Electrique',
      }),
    );
    expect(a.title).toBe(
      "Courroie d'accessoire DACIA LOGAN I 1.8 Hybrid Essence-Électrique 122 ch",
    );
  });
});
