import { restoreAccents } from './fr-accent-map';

/**
 * Extension lexique freinage de restoreAccents() (read-time content quality gate).
 * Couvre : correction métier + pluriel + frontière hyphen-aware (slugs/URLs/wikilinks),
 * anglais/marques/JSON-LD intacts, ambigus exclus (cote/rainure), idempotence, non-régression.
 *
 * NB : restoreAccents s'applique au CONTENU HTML (sgc_content), jamais au frontmatter/clés YAML.
 * Périmètre = additif (entrées existantes inchangées) ; les nouvelles entrées sont hyphen-aware.
 */
describe('restoreAccents — extension lexique freinage', () => {
  describe('correction métier + casse + pluriel', () => {
    it('corrige les termes métier freinage', () => {
      const out = restoreAccents(
        "l'energie cinetique du disque ventile, perfore ou rivete a l'arriere",
      );
      expect(out).toContain('cinétique');
      expect(out).toContain('ventilé');
      expect(out).toContain('perforé');
      expect(out).toContain('arrière');
    });

    it('corrige aussi un terme capitalisé (sortie minuscule = comportement existant)', () => {
      // restoreAccents historique replie la casse (cf. test EnricherTextUtils
      // "case-insensitive"). Ce PR reste ADDITIF : il ne change pas ce contrat.
      expect(restoreAccents('Diametre nominal')).toBe('diamètre nominal');
      expect(restoreAccents('Etrier flottant')).toBe('étrier flottant');
    });

    it('préserve le pluriel', () => {
      expect(restoreAccents('disques ventiles')).toBe('disques ventilés');
      expect(restoreAccents('les etriers avant')).toBe('les étriers avant');
      expect(restoreAccents('machoires usees')).toContain('mâchoires');
    });

    it('corrige etrier/machoire/pedale/diametre/epaisseur en prose', () => {
      expect(restoreAccents("laisser l'etrier pendre")).toContain('étrier');
      expect(restoreAccents('pulsation dans la pedale')).toContain('pédale');
      expect(restoreAccents('frottement metallique')).toContain('métallique');
    });
  });

  describe('anti-sur-correction — slugs / URLs / wikilinks (hyphen-aware)', () => {
    it('ne touche pas un slug kebab même s’il contient un terme corrigé', () => {
      expect(restoreAccents('etrier-de-frein')).toBe('etrier-de-frein');
      expect(restoreAccents('machoires-de-frein')).toBe('machoires-de-frein');
      expect(restoreAccents('kit-de-freins-arriere')).toBe(
        'kit-de-freins-arriere',
      );
    });

    it('les nouvelles entrées freinage ne cassent pas un slug dans un href', () => {
      // NB scope : le chemin "/pieces/" est volontairement ABSENT ici. Son altération par
      // l'entrée HISTORIQUE `pieces` (/\bpieces\b/) est un bug PRÉ-EXISTANT (cf. description PR),
      // hors périmètre de ce correctif additif freinage — non corrigé ici volontairement.
      const html = '<a href="etrier-de-frein-78.html">étrier de frein</a>';
      expect(restoreAccents(html)).toBe(html);
    });

    it('ne touche pas un wikilink', () => {
      const s = '[[disque-de-frein]] et [[machoires-de-frein]]';
      expect(restoreAccents(s)).toBe(s);
    });
  });

  describe('anti-sur-correction — anglais / marques / JSON-LD', () => {
    it('ne touche pas les tokens techniques anglais (snake_case)', () => {
      const s = 'requires_review NO_VEHICLE_EVIDENCE rag_recycled_candidate';
      expect(restoreAccents(s)).toBe(s);
    });

    it('ne touche pas les marques équipementiers', () => {
      const s = 'Brembo, ATE, Bosch, TRW, Textar, Ferodo, Valeo, NK, Delphi';
      expect(restoreAccents(s)).toBe(s);
    });

    it('ne touche pas les clés JSON-LD (schema.org en contenu)', () => {
      const s =
        '{"@type":"Question","name":"Q","acceptedAnswer":{"@type":"Answer"}}';
      expect(restoreAccents(s)).toBe(s);
    });
  });

  describe('ambigus EXCLUS — laissés intacts (hors scope déterministe)', () => {
    it('ne convertit pas "cote" (cotation ≠ côté)', () => {
      expect(restoreAccents('respecter la cote constructeur')).toBe(
        'respecter la cote constructeur',
      );
      expect(restoreAccents("le vehicule tire d'un cote")).toBe(
        "le véhicule tire d'un cote",
      );
    });

    it('ne convertit pas "rainure" (nom/adj ambigu)', () => {
      expect(restoreAccents('des rainures profondes')).toBe(
        'des rainures profondes',
      );
      expect(restoreAccents('rainure (sport)')).toBe('rainure (sport)');
    });
  });

  describe('idempotence + non-régression', () => {
    it('est idempotent (rejouer ne change rien)', () => {
      const once = restoreAccents("l'energie cinetique du vehicule ventile");
      expect(restoreAccents(once)).toBe(once);
    });

    it("n'altère pas un texte déjà correct", () => {
      const s = "l'énergie cinétique du véhicule ventilé à l'arrière";
      expect(restoreAccents(s)).toBe(s);
    });

    it('corrige toujours les entrées existantes (véhicule)', () => {
      expect(restoreAccents('le vehicule et la securite')).toBe(
        'le véhicule et la sécurité',
      );
    });

    it('gère null/empty sans crash', () => {
      expect(restoreAccents('')).toBe('');
      expect(restoreAccents(undefined as unknown as string)).toBe(undefined);
    });
  });
});
