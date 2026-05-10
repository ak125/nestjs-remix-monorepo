import {
  SeoTemplateRenderer,
  type TemplateVariables,
} from '../seo-template-renderer.service';

describe('SeoTemplateRenderer.applyVariables (pure)', () => {
  let renderer: SeoTemplateRenderer;

  const baseVars: TemplateVariables = {
    gamme: 'Plaquettes',
    gammeMeta: 'Plaquettes de frein',
    marque: 'Renault',
    marqueMeta: 'Renault',
    marqueMetaTitle: 'Renault',
    modele: 'Clio',
    modeleMeta: 'Clio IV',
    type: '1.5 dCi 90',
    typeMeta: '1.5 dCi 90',
    annee: '2015',
    nbCh: 90,
    carosserie: 'berline',
    fuel: 'diesel',
    codeMoteur: 'K9K',
    minPrice: 25,
    articlesCount: 42,
    familyName: 'Freinage',
    seoScore: 85,
    gammeLevel: 1,
    isTopGamme: false,
  };

  beforeEach(() => {
    renderer = new SeoTemplateRenderer();
  });

  it('replace standard variables en mode meta (sans <b>)', () => {
    const out = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#Gamme# pour #VMarque# #VModele# #VType# #VAnnee# #VNbCh#',
      variables: baseVars,
      pgId: 124,
      typeId: 12345,
      useMeta: true,
    });
    expect(out).toBe(
      'Plaquettes de frein pour Renault Clio IV 1.5 dCi 90 2015 90',
    );
  });

  it('replace standard variables en mode HTML (avec <b>)', () => {
    const out = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#Gamme# #VMarque# #VModele#',
      variables: baseVars,
      pgId: 124,
      typeId: 12345,
      useMeta: false,
    });
    expect(out).toBe('<b>Plaquettes</b> <b>Renault</b> <b>Clio</b>');
  });

  it('#MinPrice# format title vs descrip', () => {
    const tplT = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: 'Achetez #MinPrice#',
      variables: baseVars,
      pgId: 1,
      typeId: 1,
      useMeta: true,
      minPriceFormat: 'title',
    });
    expect(tplT).toContain('dès 25€');

    const tplD = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: 'Disponibles #MinPrice#',
      variables: baseVars,
      pgId: 1,
      typeId: 1,
      useMeta: true,
      minPriceFormat: 'descrip',
    });
    expect(tplD).toContain('à partir de 25€');
  });

  it('#PrixPasCher# pioché dans la liste 16 (déterministe via seed)', () => {
    // Même seed → même valeur (le test n'inspecte pas la valeur exacte mais la
    // stabilité + l'appartenance à la liste légitime).
    const out1 = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#PrixPasCher#',
      variables: baseVars,
      pgId: 5,
      typeId: 11,
      useMeta: true,
      prixPasCherSeed: 0,
    });
    const out2 = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#PrixPasCher#',
      variables: baseVars,
      pgId: 5,
      typeId: 11,
      useMeta: true,
      prixPasCherSeed: 0,
    });
    expect(out1).toBe('pas cher'); // index 0
    expect(out2).toBe('pas cher');
  });

  it('#VousPropose# pioché dans la liste 12 (seed=0 → "vous propose")', () => {
    const out = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#VousPropose#',
      variables: baseVars,
      pgId: 1,
      typeId: 1,
      useMeta: false,
      vousProposeSeed: 0,
    });
    expect(out).toBe('vous propose');
  });

  it('#ArticlesCount# + #ArticlesCountFormatted# selon volume', () => {
    const out1 = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#ArticlesCount# #ArticlesCountFormatted#',
      variables: { ...baseVars, articlesCount: 1 },
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    expect(out1).toBe('1 <b>1 référence</b>');

    const out2 = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#ArticlesCountFormatted#',
      variables: { ...baseVars, articlesCount: 5 },
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    expect(out2).toBe('<b>5 références</b>');

    const out3 = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#ArticlesCountFormatted#',
      variables: { ...baseVars, articlesCount: 42 },
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    expect(out3).toBe('<b>plus de 42 références</b>');
  });

  it('#QualityBadge# selon seoScore (>=80 Premium, 60-79 Vérifiée, sinon vide)', () => {
    const premium = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#QualityBadge#',
      variables: { ...baseVars, seoScore: 90 },
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    expect(premium).toBe('<b>Sélection Premium</b>');

    const verified = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#QualityBadge#',
      variables: { ...baseVars, seoScore: 70 },
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    expect(verified).toBe('<b>Qualité Vérifiée</b>');

    const empty = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#QualityBadge#',
      variables: { ...baseVars, seoScore: 30 },
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    expect(empty).toBe('');
  });

  it('#FamilyContext# inséré seulement si familyName fourni', () => {
    const out = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: 'Découvrez nos pièces #FamilyContext#',
      variables: baseVars,
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    expect(out).toContain('dans la catégorie <b>Freinage</b>');
  });

  it('marqueurs non résolus restent dans la sortie (le caller les nettoie via cleanContent)', () => {
    const out = renderer.applyVariables({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      templateText: '#Inconnu# #CompSwitch_5_124#',
      variables: baseVars,
      pgId: 1,
      typeId: 1,
      useMeta: false,
    });
    // Renderer ne touche pas aux marqueurs `#CompSwitch_*#` (= job de SwitchSelector).
    expect(out).toBe('#Inconnu# #CompSwitch_5_124#');
  });
});
