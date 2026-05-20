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

const tpl = (description: string): SeoTemplates => ({
  h1: '',
  title: '',
  description,
  content: '',
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
    expect(['alpha', 'beta', 'gamma']).toContain(r.description);
    expect(r.description).not.toContain('#CompSwitch');
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
    expect(a.description).not.toEqual(b.description);
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
    expect(a.description).toEqual(b.description);
  });

  it('fallback : sans comp_switches → strip propre (aucun # résiduel)', async () => {
    const r = await svc.processTemplates(
      tpl('#LinkGammeCar_402#, #CompSwitch_3_402#'),
      ctx(),
    );
    expect(r.description).not.toContain('#');
    expect(r.description).toContain('Plaquette de frein');
  });

  it('#CompSwitch_X_Y# (alias X + pg Y) résolu via alias X', async () => {
    const r = await svc.processTemplates(
      tpl('#CompSwitch_2_402#'),
      ctx({ comp_switches: { '2': ['ralentir', 'freiner'] } }),
    );
    expect(['ralentir', 'freiner']).toContain(r.description);
    expect(r.description).not.toContain('#');
  });

  it('slots indépendants : #CompSwitch_1# et #CompSwitch_2# tournent séparément', async () => {
    const r = await svc.processTemplates(
      tpl('#CompSwitch_1# / #CompSwitch_2#'),
      ctx({
        type_id: 1,
        comp_switches: { '1': ['a1', 'a2', 'a3'], '2': ['b1', 'b2', 'b3'] },
      }),
    );
    const [left, right] = r.description.split(' / ');
    expect(['a1', 'a2', 'a3']).toContain(left);
    expect(['b1', 'b2', 'b3']).toContain(right);
  });
});
