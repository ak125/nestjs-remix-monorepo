/**
 * 🧪 Tests unitaires pour l'interpolation SEO
 *
 * Ces tests vérifient que toutes les variables SEO sont correctement interpolées.
 * CI/CD bloquant : si un test échoue, le déploiement est bloqué.
 */

import { SeoTemplateService, SeoContext } from '../../src/modules/catalog/services/seo-template.service';

// Mock du CacheService
const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  clearByPattern: jest.fn().mockResolvedValue(undefined),
};

describe('SeoTemplateService - Interpolation', () => {
  let service: SeoTemplateService;

  // Contexte de test complet (BMW Série 3 E46 320d)
  const testContext: SeoContext = {
    type_id: 9045,
    pg_id: 4,
    mf_id: 16,
    marque_name: 'BMW',
    marque_alias: 'bmw',
    modele_name: 'Série 3 (E46)',
    modele_alias: 'serie-3-e46',
    type_name: '320 d',
    type_alias: '2-0-320-d',
    gamme_name: 'Alternateur',
    gamme_alias: 'alternateur',
    min_price: 118.45,
    count: 25,
    year_from: '1998',
    year_to: '2001',
    motor_codes: 'M47D20',
    fuel: 'Diesel',
    power_ps: '136',
    power_kw: '100',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SeoTemplateService(mockCacheService as any);
  });

  describe('Variables Legacy (#Xxx#)', () => {
    it.each([
      ['#VMarque#', 'BMW'],
      ['#VModele#', 'Série 3 (E46)'],
      ['#VType#', '320 d'],
      ['#VNbCh#', '136'],
      ['#VGamme#', 'Alternateur'],
      ['#VAnneeFrom#', '1998'],
      ['#VAnneeTo#', '2001'],
      ['#VFuel#', 'Diesel'],
      ['#VPower#', '136 ch'],
    ])('interpole %s → "%s"', (variable, expected) => {
      const result = (service as any).processTemplate(variable, testContext);
      expect(result).toBe(expected);
    });

    it('interpole #VAnnee# avec formatage année', () => {
      const result = (service as any).processTemplate('#VAnnee#', testContext);
      expect(result).toBe('1998-2001');
    });

    it.each([
      ['#Gamme#', 'Alternateur'],
      ['#MinPrice#', 'à partir de 118.45€'],
      ['#Count#', '25'],
    ])('interpole nouveau format %s → "%s"', (variable, expected) => {
      const result = (service as any).processTemplate(variable, testContext);
      expect(result).toBe(expected);
    });
  });

  describe('Variables Modernes (%xxx%)', () => {
    it.each([
      ['%gamme_name%', 'Alternateur'],
      ['%marque_name%', 'BMW'],
      ['%modele_name%', 'Série 3 (E46)'],
      ['%type_name%', '320 d'],
      ['%min_price%', '118.45€'],
      ['%count%', '25'],
      ['%power_ps%', '136 ch'],
      ['%power_kw%', '100 kW'],
      ['%year_from%', '1998'],
      ['%year_to%', '2001'],
      ['%motor_codes%', 'M47D20'],
      ['%fuel%', 'Diesel'],
    ])('interpole %s → "%s"', (variable, expected) => {
      const result = (service as any).processTemplate(variable, testContext);
      expect(result).toBe(expected);
    });
  });

  describe('Switches statiques', () => {
    it.each([
      ['#VousPropose#', 'vous propose'],
      ['#PrixPasCher#', 'au meilleur prix'],
      ['#Commander#', 'commander'],
      ['#Controler#', 'contrôler'],
    ])('interpole switch %s → "%s"', (switchVar, expected) => {
      const result = (service as any).processTemplate(switchVar, testContext);
      expect(result).toBe(expected);
    });

    it('supprime les switches complexes non résolus', () => {
      const template = 'Test #CompSwitch_2# et #FamilySwitch_3# et #Switch_1#';
      const result = (service as any).processTemplate(template, testContext);
      expect(result).toBe('Test et et');
    });

    it('interpole #LinkCarAll# avec marque + modèle', () => {
      const result = (service as any).processTemplate('#LinkCarAll#', testContext);
      expect(result).toBe('BMW Série 3 (E46)');
    });

    it('interpole #LinkGammeCar# avec gamme + marque + modèle', () => {
      const result = (service as any).processTemplate('#LinkGammeCar#', testContext);
      expect(result).toBe('Alternateur BMW Série 3 (E46)');
    });
  });

  describe('Templates réels de la base de données', () => {
    it('interpole le H1 Alternateur correctement', () => {
      const template = 'Alternateur #VMarque# #VModele# #VType# #VNbCh# ch #VAnnee# #CompSwitch_2#';
      const result = (service as any).processTemplate(template, testContext);
      expect(result).toBe('Alternateur BMW Série 3 (E46) 320 d 136 ch 1998-2001');
    });

    it('interpole le Title Alternateur correctement', () => {
      const template = '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.';
      const result = (service as any).processTemplate(template, testContext);
      expect(result).toBe('Alternateur BMW Série 3 (E46) 320 d à partir de 118.45€ au meilleur prix.');
    });

    it('interpole le H1 Plaquette de frein correctement', () => {
      const plaquetteContext = { ...testContext, gamme_name: 'Plaquette de frein', pg_id: 402 };
      const template = 'Plaquette de frein pour #VMarque# #VModele# #VType# #VNbCh# ch #VAnnee# #CompSwitch_2#';
      const result = (service as any).processTemplate(template, plaquetteContext);
      expect(result).toBe('Plaquette de frein pour BMW Série 3 (E46) 320 d 136 ch 1998-2001');
    });
  });

  describe('Aucune variable non-interpolée', () => {
    it('ne laisse aucune variable #xxx# dans le H1', async () => {
      const templates = {
        h1: 'Alternateur #VMarque# #VModele# #VType# #VNbCh# ch #VAnnee# #CompSwitch_2#',
        title: '#Gamme# #VMarque# #VModele# #VType# #MinPrice# #PrixPasCher#.',
        description: '',
        content: '',
        preview: '',
      };

      const result = await service.processTemplates(templates, testContext);

      // Regex pour détecter variables non-interpolées
      const uninterpolatedRegex = /#[A-Za-z_]+#/;

      expect(result.h1).not.toMatch(uninterpolatedRegex);
      expect(result.title).not.toMatch(uninterpolatedRegex);
    });

    it('ne laisse aucune variable %xxx% dans les champs SEO', async () => {
      const templates = {
        h1: '%gamme_name% %marque_name% %modele_name%',
        title: '%gamme_name% %marque_name% %min_price%',
        description: '%gamme_name% pour %marque_name% %modele_name%',
        content: '',
        preview: '%count% pièces disponibles',
      };

      const result = await service.processTemplates(templates, testContext);

      const uninterpolatedRegex = /%[a-z_]+%/;

      expect(result.h1).not.toMatch(uninterpolatedRegex);
      expect(result.title).not.toMatch(uninterpolatedRegex);
      expect(result.description).not.toMatch(uninterpolatedRegex);
      expect(result.preview).not.toMatch(uninterpolatedRegex);
    });
  });

  describe('Cas limites', () => {
    it('gère un contexte avec valeurs vides', () => {
      const emptyContext: SeoContext = {
        type_id: 0,
        pg_id: 0,
        mf_id: 0,
        marque_name: '',
        marque_alias: '',
        modele_name: '',
        modele_alias: '',
        type_name: '',
        type_alias: '',
        gamme_name: '',
        gamme_alias: '',
      };

      const template = '#Gamme# #VMarque# #VModele#';
      const result = (service as any).processTemplate(template, emptyContext);

      // Devrait retourner des espaces (pas de variables #xxx#)
      expect(result).not.toMatch(/#[A-Za-z]+#/);
    });

    it('gère un template vide', () => {
      const result = (service as any).processTemplate('', testContext);
      expect(result).toBe('');
    });

    it('gère un template null', () => {
      const result = (service as any).processTemplate(null, testContext);
      expect(result).toBe('');
    });

    it('gère min_price = 0', () => {
      const contextZeroPrice = { ...testContext, min_price: 0 };
      const result = (service as any).processTemplate('#MinPrice#', contextZeroPrice);
      expect(result).toBe('');
    });

    it('nettoie les espaces multiples', () => {
      const template = 'Test    avec     espaces   multiples';
      const result = (service as any).processTemplate(template, testContext);
      expect(result).toBe('Test avec espaces multiples');
    });
  });

  describe('Régression: variables critiques', () => {
    it('CRITIQUE: #Gamme# ne doit pas rester vide si gamme_name existe', () => {
      const result = (service as any).processTemplate('#Gamme#', testContext);
      expect(result).toBe('Alternateur');
      expect(result).not.toBe('');
    });

    it('CRITIQUE: #MinPrice# ne doit pas rester vide si min_price > 0', () => {
      const result = (service as any).processTemplate('#MinPrice#', testContext);
      expect(result).toContain('118.45');
      expect(result).not.toBe('');
    });

    it('CRITIQUE: #VNbCh# ne doit pas rester vide si power_ps existe', () => {
      const result = (service as any).processTemplate('#VNbCh#', testContext);
      expect(result).toBe('136');
      expect(result).not.toBe('');
    });

    it('CRITIQUE: #VAnnee# ne doit pas rester vide si year_from/to existent', () => {
      const result = (service as any).processTemplate('#VAnnee#', testContext);
      expect(result).toBe('1998-2001');
      expect(result).not.toBe('');
    });
  });
});
