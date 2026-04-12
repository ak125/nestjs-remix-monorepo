import { R4LintGatesService, R4LintInput } from './r4-lint-gates.service';

describe('R4LintGatesService', () => {
  let service: R4LintGatesService;

  beforeEach(() => {
    service = new R4LintGatesService();
  });

  const baseInput: R4LintInput = {
    definition:
      'Le disque de frein est un composant rotatif du système de freinage automobile à friction.',
    takeaways: [
      'Convertit énergie cinétique en chaleur par friction',
      'Fonctionne par paire sur un essieu',
      'Épaisseur minimale à respecter selon constructeur',
    ],
    role_mecanique:
      'Le disque de frein assure la décélération du véhicule par friction avec les plaquettes. Il dissipe la chaleur générée lors du freinage et maintient la stabilité directionnelle.',
    composition: [
      'Fonte grise GG25 — surface de friction',
      'Moyeu central — fixation au porte-fusée',
      'Ailettes de ventilation — dissipation thermique',
      'Vis de fixation — positionnement sur le moyeu',
    ],
    key_specs: [
      { label: 'Diamètre', value: '256-380 mm', note: 'selon véhicule' },
      { label: 'Épaisseur neuf', value: '20-32 mm', note: 'selon véhicule' },
    ],
    common_questions: [
      {
        question: 'Peut-on rectifier un disque ?',
        answer:
          'La rectification est possible si le disque reste au-dessus de son épaisseur minimale.',
      },
      {
        question: 'Faut-il agir sur les deux disques ?',
        answer:
          'Toujours intervenir par paire sur un essieu pour un freinage équilibré.',
      },
    ],
    regles_metier: [
      'Toujours intervenir par paire sur un essieu complet',
      'Ne jamais réutiliser un disque sous épaisseur minimale',
      'Doit respecter la norme ECE R90 pour la vente en Europe',
      'Vérifier le voile au comparateur avant pose',
      'Ne pas graisser la surface de friction',
    ],
    scope_limites:
      'Concerne uniquement le disque de frein en tant que pièce de rechange. Ne couvre pas les plaquettes, étriers, ou flexibles de frein.',
    targetKeywords: ['disque de frein', 'frein', 'freinage'],
  };

  describe('Full validation (clean input)', () => {
    it('should pass with score 100 on clean content', () => {
      const result = service.validate(baseInput);
      expect(result.score).toBe(100);
      expect(result.pass).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('LG1 — Forbidden terms', () => {
    it('should detect R1 transactional terms', () => {
      const input: R4LintInput = {
        ...baseInput,
        definition:
          'Le disque de frein pas cher est disponible en livraison rapide.',
      };
      const result = service.validate(input);
      expect(result.gates['LG1_FORBIDDEN_TERMS'].pass).toBe(false);
      expect(result.gates['LG1_FORBIDDEN_TERMS'].penalty).toBe(30);
    });

    it('should detect R3 procedure terms', () => {
      const input: R4LintInput = {
        ...baseInput,
        role_mecanique:
          'Pour remplacer le disque, suivez ce tutoriel étapes par étapes.',
      };
      const result = service.validate(input);
      expect(result.gates['LG1_FORBIDDEN_TERMS'].pass).toBe(false);
    });

    it('should detect R5 diagnostic terms', () => {
      const input: R4LintInput = {
        ...baseInput,
        definition:
          "Si votre voyant s'allume, c'est un symptome de panne du disque.",
      };
      const result = service.validate(input);
      expect(result.gates['LG1_FORBIDDEN_TERMS'].pass).toBe(false);
    });
  });

  describe('LG2 — Procedure headings', () => {
    it('should detect step-by-step patterns', () => {
      const input: R4LintInput = {
        ...baseInput,
        definition: 'Étape 1 : démontage du disque. Étape 2 : nettoyage.',
      };
      const result = service.validate(input);
      expect(result.gates['LG2_PROCEDURE_HEADINGS'].pass).toBe(false);
      expect(result.gates['LG2_PROCEDURE_HEADINGS'].penalty).toBe(20);
    });

    it('should pass when no procedure patterns', () => {
      const result = service.validate(baseInput);
      expect(result.gates['LG2_PROCEDURE_HEADINGS'].pass).toBe(true);
    });
  });

  describe('LG3 — Target keywords', () => {
    it('should pass when keywords are present', () => {
      const result = service.validate(baseInput);
      expect(result.gates['LG3_TARGET_KEYWORDS'].pass).toBe(true);
    });

    it('should fail when keywords are absent', () => {
      const input: R4LintInput = {
        ...baseInput,
        definition: 'Composant mécanique du système.',
        role_mecanique: 'Assure la décélération.',
        targetKeywords: ['turbocompresseur', 'turbo diesel', 'turbine'],
      };
      const result = service.validate(input);
      expect(result.gates['LG3_TARGET_KEYWORDS'].pass).toBe(false);
      expect(result.gates['LG3_TARGET_KEYWORDS'].penalty).toBe(10);
    });

    it('should auto-pass in skip-kp mode (empty keywords)', () => {
      const input: R4LintInput = { ...baseInput, targetKeywords: [] };
      const result = service.validate(input);
      expect(result.gates['LG3_TARGET_KEYWORDS'].pass).toBe(true);
    });
  });

  describe('LG4 — Rules format', () => {
    it('should pass with conforming prefixes', () => {
      const result = service.validate(baseInput);
      expect(result.gates['LG4_RULES_FORMAT'].pass).toBe(true);
    });

    it('should fail with bare verb rules', () => {
      const input: R4LintInput = {
        ...baseInput,
        regles_metier: ['freiner', 'supporter', 'résister'],
      };
      const result = service.validate(input);
      expect(result.gates['LG4_RULES_FORMAT'].pass).toBe(false);
      expect(result.gates['LG4_RULES_FORMAT'].penalty).toBe(10);
    });
  });

  describe('LG5 — Filler phrases', () => {
    it('should detect generic filler', () => {
      const input: R4LintInput = {
        ...baseInput,
        definition:
          'Le disque de frein joue un rôle essentiel dans le système de freinage.',
      };
      const result = service.validate(input);
      expect(result.gates['LG5_FILLER_PHRASES'].pass).toBe(false);
      expect(result.gates['LG5_FILLER_PHRASES'].penalty).toBe(10);
    });

    it('should pass when no filler detected', () => {
      const result = service.validate(baseInput);
      expect(result.gates['LG5_FILLER_PHRASES'].pass).toBe(true);
    });
  });

  describe('LG6 — FAQ answer length', () => {
    it('should fail when answer exceeds 60 words', () => {
      const longAnswer = Array(70).fill('mot').join(' ');
      const input: R4LintInput = {
        ...baseInput,
        common_questions: [{ question: 'Test?', answer: longAnswer }],
      };
      const result = service.validate(input);
      expect(result.gates['LG6_FAQ_LENGTH'].pass).toBe(false);
      expect(result.gates['LG6_FAQ_LENGTH'].penalty).toBe(5);
    });

    it('should pass when all answers under 60 words', () => {
      const result = service.validate(baseInput);
      expect(result.gates['LG6_FAQ_LENGTH'].pass).toBe(true);
    });
  });

  describe('LG7 — Specs disclaimer', () => {
    it('should pass when disclaimer present', () => {
      const result = service.validate(baseInput);
      expect(result.gates['LG7_SPECS_DISCLAIMER'].pass).toBe(true);
    });

    it('should fail when no disclaimer', () => {
      const input: R4LintInput = {
        ...baseInput,
        key_specs: [
          { label: 'Diamètre', value: '300 mm' },
          { label: 'Épaisseur', value: '25 mm' },
        ],
      };
      const result = service.validate(input);
      expect(result.gates['LG7_SPECS_DISCLAIMER'].pass).toBe(false);
      expect(result.gates['LG7_SPECS_DISCLAIMER'].penalty).toBe(5);
    });
  });

  describe('LG8 — Duplicates', () => {
    it('should detect duplicated content between sections', () => {
      const sharedText =
        'Le disque de frein assure la conversion de énergie cinétique en chaleur par friction des plaquettes sur sa surface.';
      const input: R4LintInput = {
        ...baseInput,
        definition: sharedText,
        role_mecanique: sharedText,
      };
      const result = service.validate(input);
      expect(result.gates['LG8_DUPLICATES'].pass).toBe(false);
      expect(result.gates['LG8_DUPLICATES'].penalty).toBe(10);
    });

    it('should pass when sections are distinct', () => {
      const result = service.validate(baseInput);
      expect(result.gates['LG8_DUPLICATES'].pass).toBe(true);
    });
  });

  describe('Score calculation', () => {
    it('should subtract penalties from 100', () => {
      const input: R4LintInput = {
        ...baseInput,
        definition: 'Le prix pas cher avec livraison rapide.',
        regles_metier: ['freiner', 'supporter'],
      };
      const result = service.validate(input);
      // LG1 = -30, LG4 = -10 → 60
      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.pass).toBe(false);
    });

    it('should never go below 0', () => {
      const input: R4LintInput = {
        ...baseInput,
        definition:
          'Étape 1 : acheter pas cher en promo livraison. Ce symptome de panne joue un rôle essentiel. Guide achat budget.',
        role_mecanique:
          'Étape 1 : acheter pas cher en promo livraison. Ce symptome de panne joue un rôle essentiel. Guide achat budget.',
        regles_metier: ['freiner', 'supporter'],
        key_specs: [{ label: 'test', value: '1' }],
        common_questions: [
          { question: 'Q?', answer: Array(70).fill('mot').join(' ') },
        ],
        targetKeywords: ['inexistant'],
      };
      const result = service.validate(input);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('toGateResults', () => {
    it('should convert to GateResult[] format', () => {
      const lintResult = service.validate(baseInput);
      const gateResults = service.toGateResults(lintResult);
      expect(gateResults).toHaveLength(8);
      expect(gateResults[0]).toHaveProperty('gate');
      expect(gateResults[0]).toHaveProperty('status');
      expect(gateResults[0]).toHaveProperty('message');
    });
  });
});
