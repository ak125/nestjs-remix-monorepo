/**
 * Complément n° 5 au mandat DS — phrase des cartes motorisation de la page gamme.
 *
 * Données réelles relevées en lecture seule le 2026-11-19 : véhicules servis par
 * GET /api/gamme-rest/:pgId/page-data-rpc-v2 et fragments alias 2 de
 * __seo_item_switch (ordre sis_id, comme get_gamme_page_data_optimized).
 * Vérifie : une phrase par carte issue du switch, aucune phrase sur plus de
 * deux cartes, aucun terme refusé par les lexiques du rôle, fragments
 * incomplets écartés, carte sans phrase quand aucun fragment n'est admis.
 */
import { GammeResponseBuilderService } from '../gamme-response-builder.service';
import { GammeDataTransformerService } from '../gamme-data-transformer.service';
import { GammeRpcService } from '../gamme-rpc.service';
import { PageRoleValidatorService } from '../../../seo/validation/page-role-validator.service';

type Card = [number, string, string, string, string];
type Fragment = [number, string];

const GAMMES: Record<
  string,
  { pgName: string; cards: Card[]; fragments: Fragment[] }
> = {
  'filtre-a-huile (pg 7)': {
    pgName: 'Filtre à huile',
    cards: [
      [19052, 'RENAULT', 'CLIO III', '1.5 dCi', '86'],
      [30091, 'PEUGEOT', '206', '1.4 HDI', '69'],
      [19966, 'AUDI', 'A3 II', '2.0 TDI', '140'],
      [18929, 'ALFA ROMEO', '159', '1.9 JTDM 8V', '120'],
      [16102, 'FORD', 'FIESTA V', '1.4 TDCI', '68'],
      [23175, 'FIAT', '500', '1.2', '69'],
      [17696, 'OPEL', 'CORSA C', '1.3 CDTI', '70'],
      [17079, 'SEAT', 'IBIZA III', '1.4 TDI', '75'],
      [18793, 'JEEP', 'CHEROKEE III', '2.8 CRD 4x4', '163'],
      [31083, 'DACIA', 'SANDERO I', '1.5 dCi', '68'],
      [16201, 'BMW', 'Série 3 (E46)', '320 d', '150'],
      [11758, 'NISSAN', 'QASHQAI+2 (J10)', '1.6 dCi', '130'],
      [17768, 'VOLKSWAGEN', 'TOURAN I', '1.9 TDI', '105'],
      [19255, 'TOYOTA', 'YARIS II', '1.4 D4-D', '90'],
      [22457, 'MERCEDES', 'CLASSE C (W204)', '200 CDI (204.001)', '136'],
      [57, 'SUZUKI', 'SWIFT IV', '1.3 DDIS', '75'],
      [31077, 'MAZDA', '3 II', '1.6 MZR CD', '109'],
      [13927, 'HONDA', 'CIVIC IX', '2.2 DTEC', '150'],
      [7072, 'KIA', 'PICANTO II', '1.2', '85'],
    ],
    fragments: [
      [10182, "purifier l'huile"],
      [10183, 'protéger le moteur'],
      [10184, 'retenir les particules'],
      [10185, 'garantir filtrer les impuretés de'],
      [10186, "assurer purifier l'huile"],
      [10187, 'optimiser les performances'],
      [10188, 'améliorer la fiabilité'],
      [10189, 'prolonger la durée de vie'],
      [10190, 'maintenir en bon état'],
      [10191, 'préserver le véhicule'],
    ],
  },
  'plaquette-de-frein (pg 402)': {
    pgName: 'Plaquette de frein',
    cards: [
      [77310, 'RENAULT', 'MEGANE III', '1.5 dCi', '95'],
      [
        65057,
        'CITROËN',
        'BERLINGO II - BERLINGO MULTISPACE (B9)',
        '1.6 HDi-BlueHDi',
        '75',
      ],
      [16108, 'RENAULT', 'CLIO II', '1.5 dCi', '65'],
      [30936, 'RENAULT', 'CLIO II', '1.5 dCi CAMPUS', '84'],
      [19341, 'PEUGEOT', '307', '1.6 HDI', '90'],
      [17989, 'PEUGEOT', '307', '1.6 HDI', '109'],
      [15903, 'PEUGEOT', '307', '2.0 HDI', '90'],
      [18400, 'AUDI', 'A4 III B7', '1.9 TDI', '116'],
      [26547, 'AUDI', 'A4 III B7', '2.0 TDI', '121'],
      [27326, 'AUDI', 'A4 III B7', '2.0 TDI', '126'],
      [8456, 'VOLKSWAGEN', 'GOLF IV', '1.9 TDI', '90'],
      [8461, 'VOLKSWAGEN', 'GOLF IV', '1.9 TDI', '110'],
      [13100, 'VOLKSWAGEN', 'GOLF IV', '1.9 TDI', '115'],
      [58963, 'BMW', 'Série 1 (E81)', '116 d', '90'],
      [31672, 'BMW', 'Série 1 (E81)', '116 d', '116'],
      [32172, 'BMW', 'Série 1 (E81)', '118 d', '136'],
      [58791, 'HONDA', 'CIVIC IX', '1.6 DTEC', '120'],
    ],
    fragments: [
      [10430, 'préserver le véhicule'],
      [10499, 'ralentir le véhicule'],
      [10524, 'maintenir en bon état'],
      [10559, 'assurer ralentir le véhicule'],
      [10560, 'optimiser les performances'],
      [10597, 'garantir la sécurité'],
      [10598, "dissiper l'énergie"],
      [10652, 'prolonger la durée de vie'],
      [10684, 'garantir assurer le freinage par'],
      [10685, 'améliorer la fiabilité'],
    ],
  },
};

// Mots demandés par le complément n° 5, plus la procédure de montage.
const MANDATE_WORDS =
  /prix|achat|achetez|stock|livraison|promo|pas cher|€|montage|installation/i;

const validator = new PageRoleValidatorService();
const rpc = {
  getSeoFragmentsByTypeId: GammeRpcService.prototype.getSeoFragmentsByTypeId,
};
const dummy = {} as never;
const service = new GammeResponseBuilderService(
  new GammeDataTransformerService(),
  rpc as never,
  dummy, // BuyingGuideDataService
  dummy, // ReferenceService
  dummy, // SeoTitleEngineService
  dummy, // R1RelatedResourcesService
  dummy, // SeoChainOrchestratorService
  dummy, // SeoFeatureFlagRegistry
  dummy, // R6GuideLinkPolicyService
  dummy, // InternalLinkingService
  validator,
);
const build = (
  service as never as {
    buildR1MotorisationDescription: (
      item: Record<string, unknown>,
      pgNameSite: string,
      fragments: { sis_id: number; sis_content: string }[],
      rejected: Set<string>,
    ) => string;
  }
).buildR1MotorisationDescription.bind(service);

const toRows = (fragments: Fragment[]) =>
  fragments.map(([sis_id, sis_content]) => ({ sis_id, sis_content }));
const toItem = ([
  type_id,
  marque_name,
  modele_name,
  type_name,
  type_power_ps,
]: Card) => ({
  type_id,
  marque_name,
  modele_name,
  type_name,
  type_power_ps,
});

describe.each(Object.entries(GAMMES))(
  'phrase R1 des cartes motorisation — %s',
  (_label, gamme) => {
    const rejected = new Set<string>();
    const sentences = gamme.cards.map((card) =>
      build(toItem(card), gamme.pgName, toRows(gamme.fragments), rejected),
    );

    it('sert une phrase issue du switch sur chaque carte', () => {
      expect(sentences).toHaveLength(gamme.cards.length);
      for (const s of sentences) {
        expect(s.startsWith(`${gamme.pgName} compatible `)).toBe(true);
        const benefit = s.split(', pour ')[1]?.replace(/\.$/, '');
        expect(gamme.fragments.map(([, c]) => c)).toContain(benefit);
      }
    });

    it('ne répète aucune phrase sur plus de deux cartes', () => {
      const counts = new Map<string, number>();
      for (const s of sentences) counts.set(s, (counts.get(s) || 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    });

    it('ne porte aucun terme refusé en R1', () => {
      for (const s of sentences) {
        expect(validator.validateR1Router(s)).toEqual([]);
        expect(s).not.toMatch(MANDATE_WORDS);
      }
    });

    it('écarte les fragments incomplets', () => {
      for (const s of sentences) {
        expect(s).not.toMatch(/pour (assurer|garantir) \p{L}+(er|ir|re) /iu);
        expect(s).not.toMatch(/ (de|par)\.$/);
      }
      expect([...rejected].length).toBeGreaterThan(0);
    });
  },
);

describe('phrase R1 des cartes motorisation — cas limites', () => {
  const item = toItem([19052, 'RENAULT', 'CLIO III', '1.5 dCi', '86']);

  it('laisse la carte sans phrase quand le switch est vide', () => {
    expect(build(item, 'Filtre à huile', [], new Set())).toBe('');
  });

  it("laisse la carte sans phrase quand aucun fragment n'est admis", () => {
    const rejected = new Set<string>();
    const rows = toRows([
      [1, "assurer purifier l'huile"],
      [2, 'garantir filtrer les impuretés de'],
      [3, 'absorber les vibrations'],
      [4, 'garantir le meilleur prix'],
    ]);
    expect(build(item, 'Filtre à huile', rows, rejected)).toBe('');
    expect([...rejected].sort()).toEqual(['1', '2', '3', '4']);
  });

  it('omet la puissance absente sans laisser de trou', () => {
    const s = build(
      { ...item, type_power_ps: '' },
      'Filtre à huile',
      toRows([[10183, 'protéger le moteur']]),
      new Set(),
    );
    expect(s).toBe(
      'Filtre à huile compatible CLIO III 1.5 dCi, pour protéger le moteur.',
    );
  });
});
