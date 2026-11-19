import {
  SeoTemplateService,
  SeoContext,
  SeoTemplates,
} from '../seo-template.service';

/**
 * Mandat DW (2026-11-19) — titre R2 « <Gamme> <Marque> <Modèle> <type>
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
// Complément 2 : marque et modèle en casse normale, noms d'affichage.
const NEW_TITLE =
  '#Gamme# #VMarqueAffichage# #VModeleAffichage# #VTypeCarburantPuissance#';
// Gabarit du complément 1 (accepté par la migration, valeur antérieure).
const C1_TITLE = '#Gamme# #VMarque# #VModele# #VTypeCarburantPuissance#';
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
    // Noms d'affichage relevés le 2026-11-19 (auto_modele, auto_type).
    modele_name_meta: 'LOGAN I',
    type_name_meta: '1.4',
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

const resolved = (motorCode = '', rawNames = false) =>
  jest.fn().mockResolvedValue({ motorCode, rawNames });

function build(resolveTitle: jest.Mock = resolved()) {
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
    { resolveTitle } as unknown as ConstructorParameters<
      typeof SeoTemplateService
    >[2],
  );
  return { svc, record, cache, resolveTitle };
}

describe('SeoTemplateService — #VTypeCarburantPuissance# (mandat DW)', () => {
  it('type ambigu essence : carburant inséré avant la puissance, sans prix', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(templates(NEW_TITLE), ctx());
    // PROD 2026-11-19 : « Courroie d'accessoire DACIA LOGAN I 1.4 75 ch à partir de 10.00€ économique. »
    expect(r.title).toBe(
      "Courroie d'accessoire Dacia Logan I 1.4 Essence 75 ch",
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
        modele_name_meta: 'CLIO III',
        type_name: '1.5 dCi',
        type_name_meta: '1.5 dCi',
        power_ps: '86',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(a.title).toBe(
      "Courroie d'accessoire Renault Clio III 1.5 dCi 86 ch",
    );
    const b = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 33030,
        pg_id: 316,
        gamme_name: 'Thermostat',
        marque_name: 'VOLKSWAGEN',
        modele_name: 'GOLF VI',
        modele_name_meta: 'GOLF VI',
        type_name: '1.6 TDI',
        type_name_meta: '1.6 TDI',
        power_ps: '90',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(b.title).toBe('Thermostat Volkswagen Golf VI 1.6 TDI 90 ch');
  });

  it("nom d'affichage du type : retenu au titre, h1 inchangé", async () => {
    const { svc } = build();
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 7979,
        marque_name: 'PEUGEOT',
        modele_name: 'PARTNER I',
        modele_name_meta: 'PARTNER I',
        type_name: '1.9 D (Phase 1)',
        type_name_meta: '1.9 D',
        power_ps: '69',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(r.title).toBe("Courroie d'accessoire Peugeot Partner I 1.9 D 69 ch");
    // H1 : noms bruts, comme avant le complément 2.
    expect(r.h1).toBe(
      "Courroie d'accessoire PEUGEOT PARTNER I 1.9 D (Phase 1)",
    );
  });

  it("nom d'affichage du modèle : retenu au titre (DUSTER I → Duster)", async () => {
    // Type 77206 relevé le 2026-11-19.
    const { svc } = build();
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 77206,
        marque_name: 'DACIA',
        modele_name: 'DUSTER I',
        modele_name_meta: 'DUSTER',
        type_name: '1.5 dCi 4x4 (Phase 1)',
        type_name_meta: '1.5 dCi 4x4',
        power_ps: '109',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(r.title).toBe(
      "Courroie d'accessoire Dacia Duster 1.5 dCi 4x4 109 ch",
    );
  });

  it('exemple du pilotage : Thermostat Peugeot 207 1.4 16V Essence 95 ch', async () => {
    // Type 26630 relevé le 2026-11-19 (noms d'affichage = noms bruts).
    const { svc } = build();
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 26630,
        pg_id: 316,
        gamme_name: 'Thermostat',
        marque_name: 'PEUGEOT',
        modele_name: '207',
        modele_name_meta: '207',
        type_name: '1.4 16V',
        type_name_meta: '1.4 16V',
        power_ps: '95',
      }),
    );
    expect(r.title).toBe('Thermostat Peugeot 207 1.4 16V Essence 95 ch');
  });

  it('sigle de marque gardé, modèle en casse mixte inchangé', async () => {
    // Type 61518 relevé le 2026-11-19 (BMW « Série 3 (E46) » « 320 i »).
    const { svc } = build();
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 61518,
        marque_name: 'BMW',
        modele_name: 'Série 3 (E46)',
        modele_name_meta: 'Série 3 (E46)',
        type_name: '320 i',
        type_name_meta: '320 i',
        power_ps: '163',
      }),
    );
    expect(r.title).toMatch(
      /^Courroie d'accessoire BMW Série 3 \(E46\) 320 i (Essence )?163 ch$/,
    );
  });

  it("noms d'affichage non transmis : noms bruts en casse normale, avertissement unique", async () => {
    const { svc, resolveTitle } = build();
    const warn = jest
      .spyOn(
        (svc as unknown as { logger: { warn: (m: string) => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    const bare = ctx({
      type_id: 7979,
      marque_name: 'PEUGEOT',
      modele_name: 'PARTNER I',
      modele_name_meta: undefined,
      type_name: '1.9 D (Phase 1)',
      type_name_meta: undefined,
      power_ps: '69',
      legacy_marker_motorisation: 'Diesel',
    });
    const r = await svc.processTemplates(templates(NEW_TITLE), bare);
    await svc.processTemplates(templates(NEW_TITLE), bare);
    expect(r.title).toBe(
      "Courroie d'accessoire Peugeot Partner I 1.9 D (Phase 1) 69 ch",
    );
    // Départage calculé sur les mêmes noms (bruts).
    expect(resolveTitle).toHaveBeenCalledWith(10, 7979, false);
    const missing = warn.mock.calls.filter(([m]) =>
      String(m).includes("noms d'affichage"),
    );
    expect(missing).toHaveLength(1);
  });

  it('gabarit du complément 1 : marque et modèle bruts, toujours servis', async () => {
    const { svc } = build();
    const r = await svc.processTemplates(templates(C1_TITLE), ctx());
    expect(r.title).toBe(
      "Courroie d'accessoire DACIA LOGAN I 1.4 Essence 75 ch",
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
    expect(r.title).toBe("Courroie d'accessoire Dacia Logan I 1.4 75 ch");
  });

  it('page en collision : code moteur ajouté au seul titre', async () => {
    // Paire relevée le 2026-11-19 (auto_type, modèle 58030) : FIAT DUCATO V
    // Fourgon (250-290) « 2.3 D Multijet » 150 ch Diesel, types 10207
    // (codes F1AE3481E) et 65976 (F1AGL411A, F1AGL411C). Nom d'affichage
    // du type : « 2.3 D » pour les deux.
    const { svc, resolveTitle } = build(resolved('F1AE3481E'));
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 10207,
        marque_name: 'FIAT',
        modele_name: 'DUCATO V Fourgon (250-290)',
        modele_name_meta: 'DUCATO V Fourgon (250-290)',
        type_name: '2.3 D Multijet',
        type_name_meta: '2.3 D',
        power_ps: '150',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(resolveTitle).toHaveBeenCalledWith(10, 10207, true);
    expect(r.title).toBe(
      "Courroie d'accessoire Fiat Ducato V Fourgon (250-290) 2.3 D 150 ch F1AE3481E",
    );
    expect(r.h1).not.toContain('F1AE3481E');
  });

  it("noms d'affichage confondus, mêmes codes : noms bruts", async () => {
    // Types relevés le 2026-11-19 (modèle 76083, HYUNDAI TUCSON I, code D4EA
    // pour les deux) : 19623 « 2.0 CRDI » et 19624 « 2.0 CRDI Traction
    // Intégrale », même nom d'affichage « 2.0 CRDi », 140 ch Diesel.
    const { svc } = build(resolved('', true));
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 19624,
        marque_name: 'HYUNDAI',
        modele_name: 'TUCSON I',
        modele_name_meta: 'TUCSON I',
        type_name: '2.0 CRDI Traction Intégrale',
        type_name_meta: '2.0 CRDi',
        power_ps: '140',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(r.title).toBe(
      "Courroie d'accessoire Hyundai Tucson I 2.0 CRDI Traction Intégrale 140 ch",
    );
  });

  it("modèles confondus par leur nom d'affichage : nom brut du modèle", async () => {
    // Relevé le 2026-11-19 : modèles 173094 « PASSAT VII B7 » et 173095
    // « PASSAT VII B7 (A32-A33) », même nom d'affichage « PASSAT VII » ;
    // types 294 et 56884 « 2.0 TDI » 140 ch, premier code CFFB pour les deux.
    const { svc } = build(resolved('', true));
    const r = await svc.processTemplates(
      templates(NEW_TITLE),
      ctx({
        type_id: 294,
        marque_name: 'VOLKSWAGEN',
        modele_name: 'PASSAT VII B7',
        modele_name_meta: 'PASSAT VII',
        type_name: '2.0 TDI',
        type_name_meta: '2.0 TDI',
        power_ps: '140',
        legacy_marker_motorisation: 'Diesel',
      }),
    );
    expect(r.title).toBe(
      "Courroie d'accessoire Volkswagen Passat VII B7 2.0 TDI 140 ch",
    );
  });

  it('ancien gabarit : aucune recherche de collision', async () => {
    const { svc, resolveTitle } = build();
    await svc.processTemplates(templates(OLD_TITLE), ctx());
    expect(resolveTitle).not.toHaveBeenCalled();
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
        type_name_meta: '1.8 Hybrid',
        power_ps: '122',
        legacy_marker_motorisation: 'Essence-Electrique',
      }),
    );
    expect(a.title).toBe(
      "Courroie d'accessoire Dacia Logan I 1.8 Hybrid Essence-Électrique 122 ch",
    );
  });
});
