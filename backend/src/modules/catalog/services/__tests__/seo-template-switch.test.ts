import {
  SeoTemplateService,
  SeoContext,
  SeoTemplates,
} from '../seo-template.service';

// Cache mock (toujours miss → force le traitement)
const noCache = {
  get: async () => null,
  set: async () => undefined,
} as unknown as ConstructorParameters<typeof SeoTemplateService>[0];

function ctx(overrides: Partial<SeoContext> = {}): SeoContext {
  return {
    type_id: 1,
    pg_id: 0,
    mf_id: 0,
    marque_name: 'Peugeot',
    marque_alias: 'peugeot',
    modele_name: '207',
    modele_alias: '207',
    type_name: '1.6 HDi',
    type_alias: '1-6-hdi',
    gamme_name: 'Plaquette de frein',
    gamme_alias: 'plaquette-de-frein',
    ...overrides,
  };
}

// La résolution des switches s'applique à tous les champs ; on la teste via
// `content` (le champ `description` passe désormais par le composeur de phrase).
const tpl = (text: string): SeoTemplates => ({
  h1: '',
  title: '',
  description: '',
  content: text,
  preview: '',
});

describe('SeoTemplateService — résolution switch #CompSwitch#', () => {
  let svc: SeoTemplateService;
  beforeEach(() => {
    svc = new SeoTemplateService(noCache);
  });

  it('résout #CompSwitch_3# depuis comp_switches (plus de strip à vide)', async () => {
    const r = await svc.processTemplates(
      tpl('#CompSwitch_3#'),
      ctx({ comp_switches: { '3': ['alpha', 'beta', 'gamma'] } }),
    );
    expect(['alpha', 'beta', 'gamma']).toContain(r.content);
    expect(r.content).not.toContain('#CompSwitch');
  });

  it('rotation déterministe : 2 type_id distincts → variantes différentes', async () => {
    const sw = { '3': ['alpha', 'beta', 'gamma'] };
    const a = await svc.processTemplates(
      tpl('#CompSwitch_3#'),
      ctx({ type_id: 1, comp_switches: sw }),
    );
    const b = await svc.processTemplates(
      tpl('#CompSwitch_3#'),
      ctx({ type_id: 2, comp_switches: sw }),
    );
    expect(a.content).not.toEqual(b.content);
  });

  it('déterministe : même contexte → même variante', async () => {
    const sw = { '3': ['alpha', 'beta', 'gamma'] };
    const a = await svc.processTemplates(
      tpl('#CompSwitch_3#'),
      ctx({ type_id: 5, comp_switches: sw }),
    );
    const b = await svc.processTemplates(
      tpl('#CompSwitch_3#'),
      ctx({ type_id: 5, comp_switches: sw }),
    );
    expect(a.content).toEqual(b.content);
  });

  it('fallback : sans comp_switches → strip propre (aucun # résiduel)', async () => {
    const r = await svc.processTemplates(
      tpl('#LinkGammeCar_402#, #CompSwitch_3_402#'),
      ctx(),
    );
    expect(r.content).not.toContain('#');
    expect(r.content).toContain('Plaquette de frein');
  });

  it('#CompSwitch_X_Y# (alias X + pg Y) résolu via alias X', async () => {
    const r = await svc.processTemplates(
      tpl('#CompSwitch_2_402#'),
      ctx({ comp_switches: { '2': ['ralentir', 'freiner'] } }),
    );
    expect(['ralentir', 'freiner']).toContain(r.content);
    expect(r.content).not.toContain('#');
  });

  it('slots indépendants : #CompSwitch_1# et #CompSwitch_2# tournent séparément', async () => {
    const r = await svc.processTemplates(
      tpl('#CompSwitch_1# / #CompSwitch_2#'),
      ctx({
        type_id: 1,
        comp_switches: { '1': ['a1', 'a2', 'a3'], '2': ['b1', 'b2', 'b3'] },
      }),
    );
    const [left, right] = r.content.split(' / ');
    expect(['a1', 'a2', 'a3']).toContain(left);
    expect(['b1', 'b2', 'b3']).toContain(right);
  });
});

describe('SeoTemplateService — description composée (vraie phrase véhicule-aware)', () => {
  let svc: SeoTemplateService;
  beforeEach(() => {
    svc = new SeoTemplateService(noCache);
  });

  const tplDesc = (description: string): SeoTemplates => ({
    h1: '',
    title: '',
    description,
    content: '',
    preview: '',
  });

  it('compose une phrase complète quand le template description est dégénéré (placeholders only)', async () => {
    const r = await svc.processTemplates(
      tplDesc('#LinkGammeCar_402#, #CompSwitch_3_402#'),
      ctx({ type_id: 19354, type_name: '1.4 HDI', power_ps: '68', min_price: 9, count: 24 }),
    );
    expect(r.description).toMatch(/Découvrez|Commandez|Trouvez|Comparez|Équipez/); // verbe présent
    expect(r.description).toContain('Peugeot 207 1.4 HDI');
    expect(r.description).not.toMatch(/#|undefined|null/);
  });

  it('descriptions DISTINCTES pour 2 motorisations du même modèle', async () => {
    const tplx = tplDesc('#LinkGammeCar_402#, #CompSwitch_3_402#');
    const a = await svc.processTemplates(tplx, ctx({ type_id: 19354, type_name: '1.4 HDI', min_price: 9 }));
    const b = await svc.processTemplates(tplx, ctx({ type_id: 57720, type_name: '1.9 D', min_price: 10 }));
    expect(a.description).not.toEqual(b.description);
  });

  it('préserve une description rédigée à la main (prose avec verbe, non dégénérée)', async () => {
    const prose = 'Comparez nos plaquettes de frein de qualité pour votre véhicule. Livraison rapide.';
    const r = await svc.processTemplates(tplDesc(prose), ctx());
    expect(r.description).toBe(prose);
  });

  it('ajoute le modifieur mot-clé validé au terme produit', async () => {
    const r = await svc.processTemplates(
      tplDesc('#LinkGammeCar_402#, #CompSwitch_3_402#'),
      ctx({ type_id: 19354, type_name: '1.4 HDI', gamme_keyword_modifier: 'avant' }),
    );
    expect(r.description.toLowerCase()).toContain('plaquette de frein avant');
  });
});
