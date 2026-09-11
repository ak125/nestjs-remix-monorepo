import {
  SeoTemplateService,
  SeoContext,
  SeoTemplates,
} from '../seo-template.service';

/**
 * Garde finale des marqueurs non résolus (R2) + résolution de #VMotorisation#
 * et #VCodeMoteur#.
 *
 * Défaut confirmé 2026-09-10 : `#CompSwicth_12_1289#` servi en clair sur une
 * page R2 pg 1289. Portée mesurée en base (lecture seule, 2026-09-11) : après
 * les résolveurs, 7 marqueurs inconnus dans `__seo_gamme_car` (pg 3096 ×5,
 * 1289 ×1, 1298 ×1), tous dans content/preview ; aucun dans h1/title/descrip
 * ni dans `__seo_gamme_car_switch`.
 *
 * Les gabarits ci-dessous sont des extraits EXACTS de `__seo_gamme_car`
 * (fautes d'origine comprises) — ils ne sont pas corrigés ici.
 */

const PG1289_CONTENT =
  "<a href=\"https://www.automecanik.com/pieces/capteur-niveau-d-huile-moteur-1289.html\">Contrôler l'état d'usure du capteur de niveau d'huile #CompSwitch_11_1289#</a>.<br />Nous vous conseillons #CompSwitch_15_1289# #CompSwicth_12_1289#. De #LinkGammeCar_805#, #CompSwitch_3_805#";

const PG1298_PREVIEW =
  '<p>Automecanik vous conseils de #LinkGammeCar_1298#, #CompSwich_3_1298#</p>';

const PG3096_CONTENT =
  'Le <b>kit de distribution avec pompe à eau</b> de la <a href="https://www.automecanik.com/#ContentLinkToCar#"><b>#VMarque# #VModele# #VType# #VNbCh# ch #VAnnee#</b></a> de motorisation <b>#VMotorisation#</b> pour code moteur <b>#VCodeMoteur#</b> est composé : d\'une <a href="https://www.automecanik.com/pieces/courroie-de-distribution-306/#ContentLinkToGamCar#"><b>courroie de distribution</b></a>, d\'un <a href="https://www.automecanik.com/pieces/poulie-tendeur-de-courroie-de-distribution-308/#ContentLinkToGamCar#"><b>galet tendeur de distribution</b></a>, d\'un galet enrouleur de distribution et d\'une <a href="https://www.automecanik.com/pieces/pompe-a-eau-1260/#ContentLinkToGamCar#"><b>pompe à eau</b></a> pour la <b>#VMarque# #VModele# #VType# #VNbCh# ch</b>.<br>Automecanik vous conseille avant le remplacement du <a href="https://www.automecanik.com/#ContentLinkToGam#"><b>kit de distribution avec pompe à eau</b></a> de votre #VMarque# #VModele# #VType# #VNbCh# ch de contrôler que';

const PG1795_CONTENT =
  "La <b>Pompe à injection</b> dela #LinkCar# #VAnnee# demotorisation #VMotorisation# pour codemoteur #VCodeMoteur# assure l'arrivédu carburant aux injecteurs sous une pression optimal.";

const RESIDUAL = /#[A-Z][A-Za-z]+(?:_\d+){0,2}#/;

function ctx(overrides: Partial<SeoContext> = {}): SeoContext {
  return {
    type_id: 33409,
    pg_id: 1289,
    mf_id: 0,
    marque_name: 'Audi',
    marque_alias: 'audi',
    modele_name: 'A5 Sportback',
    modele_alias: 'a5-sportback',
    type_name: '1.8 TFSI',
    type_alias: '1-8-tfsi',
    gamme_name: "Capteur niveau d'huile moteur",
    gamme_alias: 'capteur-niveau-d-huile-moteur',
    ...overrides,
  };
}

const content = (text: string): SeoTemplates => ({
  h1: '',
  title: '',
  description: '',
  content: text,
  preview: '',
});

function tagCounts(html: string): Record<string, number> {
  const count = (re: RegExp) => (html.match(re) ?? []).length;
  return {
    aOpen: count(/<a\s/g),
    aClose: count(/<\/a>/g),
    bOpen: count(/<b>/g),
    bClose: count(/<\/b>/g),
    br: count(/<br\s*\/?>/g),
    pOpen: count(/<p>/g),
    pClose: count(/<\/p>/g),
  };
}

function build(cached: unknown = null) {
  const cache = {
    get: jest.fn().mockResolvedValue(cached),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const record = jest.fn().mockResolvedValue({ ok: true });
  const svc = new SeoTemplateService(
    cache as unknown as ConstructorParameters<typeof SeoTemplateService>[0],
    { record } as unknown as ConstructorParameters<
      typeof SeoTemplateService
    >[1],
  );
  return { svc, record, cache };
}

describe('SeoTemplateService — garde des marqueurs non résolus (données réelles)', () => {
  it('pg 1289 : #CompSwicth_12_1289# retiré, rien d’autre ne change, signal émis', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      content(PG1289_CONTENT),
      ctx({
        comp_switches: {
          '11': ['de manière régulière'],
          '15': ['de remplacer le capteur'],
          '3': ['à vérifier'],
        },
      }),
    );

    expect(r.success).toBe(true);
    expect(r.content).toBe(
      "<a href=\"https://www.automecanik.com/pieces/capteur-niveau-d-huile-moteur-1289.html\">Contrôler l'état d'usure du capteur de niveau d'huile de manière régulière</a>.<br />Nous vous conseillons de remplacer le capteur. De Capteur niveau d'huile moteur Audi A5 Sportback, à vérifier",
    );
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      trigger: 'residual_marker_detected',
      source: 'r2_seo_template',
      field: 'content',
      marker_count: 1,
      stripped_count: 1,
      markers: ['#CompSwicth_12_1289#'],
      pg_id: 1289,
      type_id: 33409,
    });
  });

  it('pg 1298 : #CompSwich_3_1298# retiré du preview, balises <p> intactes, ponctuation non réécrite', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      {
        h1: '',
        title: '',
        description: '',
        content: '',
        preview: PG1298_PREVIEW,
      },
      ctx({ pg_id: 1298 }),
    );

    expect(r.preview).toBe(
      "<p>Automecanik vous conseils de Capteur niveau d'huile moteur Audi A5 Sportback, </p>",
    );
    expect(tagCounts(r.preview)).toEqual(tagCounts(PG1298_PREVIEW));
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      field: 'preview',
      markers: ['#CompSwich_3_1298#'],
      pg_id: 1298,
    });
  });

  it('pg 3096 : marqueurs dans les href retirés (cible effective inchangée), #VMotorisation#/#VCodeMoteur# résolus, HTML équilibré', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      content(PG3096_CONTENT),
      ctx({
        pg_id: 3096,
        type_name: '1.9 TDI',
        power_ps: '90',
        legacy_marker_motorisation: 'Diesel',
        legacy_marker_code_moteur: 'AJM, ATJ',
      }),
    );

    expect(r.content).not.toMatch(RESIDUAL);
    expect(tagCounts(r.content)).toEqual(tagCounts(PG3096_CONTENT));
    // href : seul le fragment `#Marqueur#` disparaît
    expect(r.content).toContain('<a href="https://www.automecanik.com/">');
    expect(r.content).toContain(
      '<a href="https://www.automecanik.com/pieces/courroie-de-distribution-306/">',
    );
    expect(r.content).toContain(
      '<a href="https://www.automecanik.com/pieces/pompe-a-eau-1260/">',
    );
    expect(r.content).toContain(
      'de motorisation <b>Diesel</b> pour code moteur <b>AJM, ATJ</b> est composé',
    );
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      field: 'content',
      marker_count: 5,
      stripped_count: 5,
      markers: [
        '#ContentLinkToCar#',
        '#ContentLinkToGamCar#',
        '#ContentLinkToGamCar#',
        '#ContentLinkToGamCar#',
        '#ContentLinkToGam#',
      ],
      pg_id: 3096,
    });
  });

  it('pg 1795 : #VMotorisation#/#VCodeMoteur# résolus depuis les valeurs véhicule, aucun signal', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      content(PG1795_CONTENT),
      ctx({
        pg_id: 1795,
        legacy_marker_motorisation: 'Diesel',
        legacy_marker_code_moteur: 'AJM, ATJ',
      }),
    );

    expect(r.content).toContain(
      'demotorisation Diesel pour codemoteur AJM, ATJ assure',
    );
    expect(r.content).not.toMatch(RESIDUAL);
    expect(record).not.toHaveBeenCalled();
  });

  it('valeurs véhicule absentes : marqueurs connus remplacés par du vide, aucun texte inventé', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      content(PG1795_CONTENT),
      ctx({ pg_id: 1795 }),
    );

    expect(r.content).toContain('demotorisation pour codemoteur assure');
    expect(r.content).not.toMatch(RESIDUAL);
    expect(record).not.toHaveBeenCalled();
  });

  it('h1/title/description/keywords identiques avec ou sans valeurs de marqueurs legacy (titres indexés inchangés)', async () => {
    const templates: SeoTemplates = {
      h1: '#Gamme# #VMarque# #VModele# #VType#',
      title: '%gamme_name% %marque_name% %type_name% %fuel% #VFuel# #VPower#',
      description:
        'Texte rédigé à la main pour la #VMarque# #VModele# avec des mots réels',
      content: '',
      preview: '',
    };
    const base = ctx({ type_name: '1.6', power_ps: '90' });

    const without = await build().svc.processTemplates(templates, base);
    const withValues = await build().svc.processTemplates(templates, {
      ...base,
      legacy_marker_motorisation: 'Diesel',
      legacy_marker_code_moteur: 'AJM, ATJ',
    });

    expect(withValues.h1).toBe(without.h1);
    expect(withValues.title).toBe(without.title);
    expect(withValues.description).toBe(without.description);
    expect(withValues.keywords).toBe(without.keywords);
    expect(withValues.title).not.toContain('Diesel');
  });

  it('marqueurs pris en charge inchangés : %var%, #VMarque#, #CompSwitch_n#, #LinkCar#', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      content(
        '%gamme_name% pour #LinkCar# chez #VMarque# #VModele# #CompSwitch_2#',
      ),
      ctx({ comp_switches: { '2': ['au meilleur prix'] } }),
    );

    expect(r.content).toBe(
      "Capteur niveau d'huile moteur pour Audi A5 Sportback 1.8 TFSI chez Audi A5 Sportback au meilleur prix",
    );
    expect(record).not.toHaveBeenCalled();
  });

  it('faux positifs : couleurs, ancres, références, entités et # isolés ne sont ni retirés ni signalés', async () => {
    const { svc, record } = build();
    const text =
      '<p style="color:#fff">Voir la <a href="#faq">FAQ</a> (réf. 123#R3#S1), l&#39;entretien, C# et #1 du marché</p>';
    const r = await svc.processTemplates(content(text), ctx());

    expect(r.content).toBe(text);
    expect(record).not.toHaveBeenCalled();
  });

  it('description dégénérée : la phrase composée remplace le rendu → marqueur non servi, non signalé', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      {
        h1: '',
        title: '',
        description: '#LinkGammeCar#, #CompSwicth_1_2#',
        content: '',
        preview: '',
      },
      ctx(),
    );

    expect(r.description).not.toMatch(RESIDUAL);
    expect(r.description.length).toBeGreaterThan(0);
    expect(record).not.toHaveBeenCalled();
  });

  it('description rédigée servie : marqueur retiré et signalé sur le champ description', async () => {
    const { svc, record } = build();
    const r = await svc.processTemplates(
      {
        h1: '',
        title: '',
        description:
          'Découvrez notre sélection de pièces pour votre véhicule #CompSwicth_1_2#',
        content: '',
        preview: '',
      },
      ctx(),
    );

    expect(r.description).toBe(
      'Découvrez notre sélection de pièces pour votre véhicule',
    );
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      field: 'description',
      markers: ['#CompSwicth_1_2#'],
    });
  });

  it('cache hit : aucun recalcul, aucun signal', async () => {
    const cachedSeo = {
      success: true,
      h1: 'h',
      title: 't',
      description: 'd',
      content: 'c',
      preview: 'p',
      keywords: null,
    };
    const { svc, record } = build(cachedSeo);
    const r = await svc.processTemplates(content(PG1289_CONTENT), ctx());

    expect(r).toBe(cachedSeo);
    expect(record).not.toHaveBeenCalled();
  });

  it('échec d’écriture du signal : le rendu reste servi (fire-and-forget)', async () => {
    const { svc, record } = build();
    record.mockRejectedValue(new Error('db down'));
    const r = await svc.processTemplates(content(PG1298_PREVIEW), ctx());

    expect(r.success).toBe(true);
    expect(r.content).not.toMatch(RESIDUAL);
    expect(record).toHaveBeenCalledTimes(1);
  });
});
