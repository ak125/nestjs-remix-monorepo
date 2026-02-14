import {
  BuyingGuideDataService,
  type BuyingGuideContractV1,
} from '../../src/modules/gamme-rest/services/buying-guide-data.service';

describe('BuyingGuideDataService quality gate', () => {
  const service = Object.create(
    BuyingGuideDataService.prototype,
  ) as BuyingGuideDataService;

  const transform = (raw: Record<string, unknown>): BuyingGuideContractV1 =>
    (service as any).transformToV2(raw) as BuyingGuideContractV1;

  it('applique un fallback sectionnel sur contenu faible', () => {
    const result = transform({
      sgpg_id: 82,
      sgpg_pg_id: '82',
      sgpg_intro_title: 'A quoi sert Disque de frein ?',
      sgpg_intro_role:
        'Rôle essentiel pour le bon fonctionnement et un entretien régulier.',
      sgpg_intro_sync_parts: ['Plaquettes', 'Plaquettes'],
      sgpg_risk_title: 'Pourquoi remplacer Disque de frein ?',
      sgpg_risk_explanation: 'Pièce importante en bon état.',
      sgpg_risk_consequences: ['Usure rapide', 'Usure rapide'],
      sgpg_risk_cost_range: '',
      sgpg_risk_conclusion: 'Il est recommandé de vérifier.',
      sgpg_timing_title: 'Quand intervenir ?',
      sgpg_timing_years: '',
      sgpg_timing_km: '',
      sgpg_timing_note: 'Entretien régulier.',
      sgpg_arg1_title: 'Compatibilité',
      sgpg_arg1_content: 'Compatibilité simple.',
      sgpg_arg1_icon: 'check-circle',
      sgpg_arg2_title: 'Compatibilité',
      sgpg_arg2_content: 'Compatibilité simple.',
      sgpg_arg2_icon: 'check-circle',
      sgpg_how_to_choose: 'Pièce importante.',
      sgpg_symptoms: ['Bruit', 'Bruit'],
      sgpg_faq: [
        { question: 'Quand remplacer ?', answer: 'Oui.' },
        { question: 'Quand remplacer ?', answer: 'Oui.' },
      ],
      sgpg_source_verified: false,
    });

    expect(result.symptoms.length).toBeGreaterThanOrEqual(3);
    expect(result.faq.length).toBeGreaterThanOrEqual(3);
    expect(result.antiMistakes.length).toBeGreaterThanOrEqual(3);
    expect(result.arguments.length).toBeGreaterThanOrEqual(3);

    expect(result.quality.flags).toEqual(
      expect.arrayContaining([
        'GENERIC_PHRASES',
        'TOO_SHORT',
        'FAQ_TOO_SMALL',
        'SYMPTOMS_TOO_SMALL',
        'DUPLICATE_ITEMS',
        'MISSING_SOURCE_PROVENANCE',
      ]),
    );
    expect(result.quality.source).toBe('db:__seo_gamme_purchase_guide:82');
    expect(result.quality.verified).toBe(false);
    expect(result.quality.score).toBeLessThan(80);
  });

  it('conserve un contenu solide et valide une provenance PDF', () => {
    const result = transform({
      sgpg_id: 82,
      sgpg_pg_id: '82',
      sgpg_intro_title: 'Les disques de frein',
      sgpg_intro_role:
        "Les disques de frein ralentissent le véhicule avec les plaquettes. C'est une pièce de sécurité majeure: un disque usé ou voilé dégrade la qualité de freinage et le confort de conduite.",
      sgpg_intro_sync_parts: [
        'les plaquettes de frein',
        'les étriers',
        'le liquide de frein',
      ],
      sgpg_risk_title: 'Pourquoi ne pas attendre pour remplacer les disques ?',
      sgpg_risk_explanation:
        "Continuer à rouler avec des disques usés augmente la distance de freinage, provoque des vibrations et accélère l'usure des plaquettes. Plus vous attendez, plus le coût final augmente.",
      sgpg_risk_consequences: [
        "distance de freinage allongée en situation d'urgence",
        'vibrations au volant et à la pédale',
        'usure prématurée des plaquettes',
        "facture plus élevée si d'autres pièces sont impactées",
      ],
      sgpg_risk_cost_range: '150 à 900 EUR selon véhicule et marque choisie',
      sgpg_risk_conclusion:
        'Remplacer les disques au bon moment protège votre sécurité et votre budget.',
      sgpg_timing_title: 'Quand changer les disques de frein ?',
      sgpg_timing_years: 'contrôle à chaque révision',
      sgpg_timing_km: 'généralement entre 60 000 et 80 000 km',
      sgpg_timing_note:
        'Changez immédiatement en cas de vibration, rainures profondes ou épaisseur sous la cote minimale gravée sur le disque.',
      sgpg_arg1_title: 'Compatibilité vérifiée',
      sgpg_arg1_content:
        'Sélection par marque, modèle, motorisation et année pour éviter les erreurs de référence.',
      sgpg_arg1_icon: 'check-circle',
      sgpg_arg2_title: 'Qualité équivalente origine',
      sgpg_arg2_content:
        'Marques reconnues (Brembo, ATE, TRW, Bosch) pour un freinage fiable au quotidien.',
      sgpg_arg2_icon: 'shield-check',
      sgpg_arg3_title: 'Prix juste en ligne',
      sgpg_arg3_content:
        'Un bon niveau de qualité avec un budget maîtrisé, sans compromis sur la sécurité.',
      sgpg_arg3_icon: 'list-check',
      sgpg_arg4_title: 'Commande simplifiée',
      sgpg_arg4_content:
        'Guide de sélection clair, disponibilité rapide et accompagnement avant achat.',
      sgpg_arg4_icon: 'clock',
      sgpg_how_to_choose:
        "Renseignez votre véhicule puis comparez le type de disque (plein ou ventilé), le diamètre, l'épaisseur et l'entraxe. Respectez les dimensions constructeur et remplacez toujours les deux disques du même essieu.",
      sgpg_symptoms: [
        'vibrations au volant lors du freinage',
        'pulsations dans la pédale de frein',
        'bruit métallique au freinage',
        'rainures visibles sur la piste du disque',
        "distance de freinage qui augmente",
      ],
      sgpg_faq: [
        {
          question: 'Comment vérifier la compatibilité ?',
          answer:
            'Sélectionnez votre véhicule puis vérifiez diamètre, épaisseur, entraxe et référence constructeur avant validation.',
        },
        {
          question: 'Quand remplacer les disques ?',
          answer:
            "En général entre 60 000 et 80 000 km, ou plus tôt en cas de vibration, rainures profondes ou usure hors tolérance.",
        },
        {
          question: 'Peut-on remplacer un seul disque ?',
          answer:
            "Non, le remplacement se fait par paire sur le même essieu pour préserver l'équilibre de freinage et la sécurité.",
        },
        {
          question: 'Faut-il changer les plaquettes en même temps ?',
          answer:
            "Oui, c'est recommandé pour garder un freinage homogène et éviter une usure irrégulière.",
        },
      ],
      sgpg_source_uri: 'pdf://catalog/ate-brake-discs-2025.pdf',
      sgpg_source_ref: 'pages=12-19',
      sgpg_source_verified: true,
    });

    expect(result.intro.role).toContain('freinage');
    expect(result.quality.flags).toEqual([]);
    expect(result.quality.score).toBe(100);
    expect(result.antiMistakes.length).toBeGreaterThanOrEqual(3);
    expect(result.symptoms.length).toBeGreaterThanOrEqual(3);
    expect(result.faq.length).toBeGreaterThanOrEqual(3);
    expect(result.quality.source).toBe(
      'pdf://catalog/ate-brake-discs-2025.pdf#pages=12-19',
    );
    expect(result.quality.verified).toBe(true);
  });

  it('accepte une provenance scraping qualifiée', () => {
    const result = transform({
      sgpg_id: 82,
      sgpg_pg_id: '82',
      sgpg_intro_title: 'A quoi sert Disque de frein ?',
      sgpg_intro_role:
        "Le disque de frein travaille avec les plaquettes pour assurer le freinage, maintenir la sécurité et garder une distance d'arrêt stable.",
      sgpg_intro_sync_parts: ['Plaquettes de frein', 'Étrier de frein'],
      sgpg_risk_title: 'Pourquoi remplacer Disque de frein à temps ?',
      sgpg_risk_explanation:
        "Un disque usé dégrade le freinage, augmente la distance d'arrêt et peut surchauffer l'ensemble. Remplacer à temps limite le risque sécurité.",
      sgpg_risk_consequences: [
        "Allongement de la distance d'arrêt.",
        'Usure prématurée des plaquettes.',
        "Perte de stabilité lors d'un freinage appuyé.",
      ],
      sgpg_risk_cost_range: '120 à 450 EUR',
      sgpg_risk_conclusion:
        'Un contrôle périodique réduit le risque de panne secondaire et protège la sécurité.',
      sgpg_timing_title: 'Quand intervenir ?',
      sgpg_timing_years: 'tous les 2 ans',
      sgpg_timing_km: 'tous les 30 000 à 60 000 km',
      sgpg_timing_note:
        'Contrôler immédiatement en cas de vibration ou de bruit au freinage.',
      sgpg_arg1_title: 'Compatibilité vérifiée',
      sgpg_arg1_content:
        'Sélection par véhicule et référence constructeur pour un montage fiable.',
      sgpg_arg1_icon: 'check-circle',
      sgpg_arg2_title: 'Freinage sécurisé',
      sgpg_arg2_content:
        "Choisir une référence conforme permet de garder une distance d'arrêt constante.",
      sgpg_arg2_icon: 'shield-check',
      sgpg_arg3_title: 'Montage maîtrisé',
      sgpg_arg3_content:
        'Les points de contrôle atelier sont connus avant commande.',
      sgpg_arg3_icon: 'list-check',
      sgpg_how_to_choose:
        "Renseignez marque, modèle, motorisation et année. Vérifiez ensuite diamètre, épaisseur et référence pour conserver un freinage sûr, une bonne distance d'arrêt et la sécurité.",
      sgpg_symptoms: [
        'Vibrations au freinage.',
        'Bruit métallique au freinage.',
        "Distance d'arrêt qui augmente.",
      ],
      sgpg_faq: [
        {
          question: 'Comment vérifier la compatibilité ?',
          answer:
            'Utilisez la plaque véhicule, la motorisation et la référence constructeur pour confirmer la compatibilité exacte avant montage.',
        },
        {
          question: 'Quand remplacer les disques ?',
          answer:
            "Dès que l'épaisseur minimale est atteinte ou si des vibrations persistantes apparaissent lors du freinage.",
        },
        {
          question: 'Peut-on remplacer un seul disque ?',
          answer:
            'Non, le remplacement se fait par paire sur le même essieu pour conserver un freinage équilibré et une sécurité homogène.',
        },
      ],
      sgpg_source_type: 'scraping',
      sgpg_source_uri: 'https://docs.exemple.com/freinage/disque-de-frein',
      sgpg_source_ref: 'section=compatibilite',
      sgpg_source_verified: true,
    });

    expect(result.quality.flags).not.toContain('MISSING_SOURCE_PROVENANCE');
    expect(result.quality.source).toBe(
      'scraping:https://docs.exemple.com/freinage/disque-de-frein#section=compatibilite',
    );
    expect(result.quality.verified).toBe(true);
  });

  it('rejette une source non verifiee meme si prefixe source est fiable', () => {
    const result = transform({
      sgpg_id: 82,
      sgpg_pg_id: '82',
      sgpg_intro_title: 'Les disques de frein',
      sgpg_intro_role:
        "Les disques de frein ralentissent le véhicule avec les plaquettes et participent directement à la sécurité de freinage.",
      sgpg_intro_sync_parts: ['les plaquettes de frein', 'les étriers'],
      sgpg_risk_title: 'Pourquoi remplacer à temps ?',
      sgpg_risk_explanation:
        "Continuer à rouler avec des disques usés augmente la distance de freinage et le risque sécurité.",
      sgpg_risk_consequences: [
        "distance de freinage allongée en situation d'urgence",
        'vibrations au volant et à la pédale',
        'usure prématurée des plaquettes',
      ],
      sgpg_risk_cost_range: '150 à 900 EUR selon véhicule',
      sgpg_risk_conclusion:
        'Remplacer les disques au bon moment protège votre sécurité et votre budget.',
      sgpg_timing_title: 'Quand changer ?',
      sgpg_timing_years: 'contrôle à chaque révision',
      sgpg_timing_km: 'entre 60 000 et 80 000 km',
      sgpg_timing_note: 'Contrôler en cas de vibration ou rainures marquées.',
      sgpg_arg1_title: 'Compatibilité vérifiée',
      sgpg_arg1_content: 'Sélection par véhicule et référence technique.',
      sgpg_arg1_icon: 'check-circle',
      sgpg_arg2_title: 'Freinage sécurisé',
      sgpg_arg2_content: "Conserve une distance d'arrêt stable.",
      sgpg_arg2_icon: 'shield-check',
      sgpg_arg3_title: 'Commande claire',
      sgpg_arg3_content: 'Parcours d’achat orienté anti-erreur.',
      sgpg_arg3_icon: 'list-check',
      sgpg_how_to_choose:
        "Vérifiez essieu, diamètre, épaisseur et référence constructeur avant validation.",
      sgpg_symptoms: [
        'vibrations au volant lors du freinage',
        'pulsations dans la pédale de frein',
        'distance de freinage qui augmente',
      ],
      sgpg_faq: [
        {
          question: 'Comment vérifier la compatibilité ?',
          answer: 'Vérifiez dimensions et référence constructeur.',
        },
        {
          question: 'Quand remplacer les disques ?',
          answer: 'Dès symptômes persistants ou usure hors tolérance.',
        },
        {
          question: 'Faut-il remplacer par paire ?',
          answer: "Oui, toujours sur le même essieu pour l'équilibre de freinage.",
        },
      ],
      sgpg_source_uri: 'pdf://catalog/ate-brake-discs-2025.pdf',
      sgpg_source_ref: 'pages=12-19',
      sgpg_source_verified: false,
    });

    expect(result.quality.flags).toContain('MISSING_SOURCE_PROVENANCE');
    expect(result.quality.verified).toBe(false);
  });

  it('construit un contrat GammeBuyingGuide oriente achat pour freinage', () => {
    const content = transform({
      sgpg_id: 82,
      sgpg_pg_id: '82',
      sgpg_intro_title: 'Les disques de frein',
      sgpg_intro_role:
        "Les disques de frein travaillent avec les plaquettes pour garder un freinage stable et une distance d'arrêt maîtrisée.",
      sgpg_intro_sync_parts: ['les plaquettes de frein', 'les étriers'],
      sgpg_risk_title: 'Pourquoi remplacer a temps ?',
      sgpg_risk_explanation:
        "Des disques usés dégradent le freinage et augmentent le risque de vibration et de surcoût atelier.",
      sgpg_risk_consequences: [
        "distance d'arrêt allongée",
        'vibrations au freinage',
        'usure prématurée des plaquettes',
      ],
      sgpg_risk_cost_range: '150 à 900 EUR selon véhicule',
      sgpg_risk_conclusion:
        'Un remplacement à temps limite les erreurs et protège la sécurité.',
      sgpg_timing_title: 'Quand intervenir ?',
      sgpg_timing_years: 'controle a chaque revision',
      sgpg_timing_km: 'entre 60 000 et 80 000 km',
      sgpg_timing_note: "Verifier les cotes mini en atelier avant d'attendre.",
      sgpg_arg1_title: 'Compatibilite verifiee',
      sgpg_arg1_content: 'Selection par vehicule et reference technique.',
      sgpg_arg1_icon: 'check-circle',
      sgpg_how_to_choose:
        'Verifier essieu, diametre, epaisseur et type de disque avant validation panier.',
      sgpg_symptoms: [
        'vibrations au volant lors du freinage',
        'pulsations dans la pedale de frein',
        "distance d'arret qui augmente",
      ],
      sgpg_faq: [
        {
          question: 'Comment verifier la compatibilite ?',
          answer: 'Verifier dimensions, essieu et reference constructeur.',
        },
        {
          question: 'Quand remplacer les disques ?',
          answer: 'Des symptomes persistants imposent un controle immediate.',
        },
        {
          question: 'Faut-il remplacer par paire ?',
          answer: 'Oui, toujours sur le meme essieu pour garder un freinage equilibre.',
        },
      ],
      sgpg_source_type: 'pdf',
      sgpg_source_uri: 'pdf://catalog/ate-brake-discs-2025.pdf',
      sgpg_source_ref: 'pages=12-19',
      sgpg_source_verified: true,
    });

    const buyingGuide = service.toBuyingGuideV1(content);

    expect(buyingGuide.decisionTree.length).toBeGreaterThanOrEqual(5);
    expect(
      buyingGuide.decisionTree.some((node) => node.id === 'vehicle-identification'),
    ).toBe(true);
    expect(
      buyingGuide.decisionTree.some((node) => node.id === 'axle-position'),
    ).toBe(true);
    expect(
      buyingGuide.decisionTree.some((node) => node.id === 'original-disc-type'),
    ).toBe(true);
    expect(
      buyingGuide.decisionTree.some((node) => node.id === 'critical-dimensions'),
    ).toBe(true);
    const dimensionsNode = buyingGuide.decisionTree.find(
      (node) => node.id === 'critical-dimensions',
    );
    expect(
      dimensionsNode?.options?.some((opt) => opt.outcome === 'stop'),
    ).toBe(true);
    expect(
      dimensionsNode?.options?.some((opt) =>
        /incompatibilit[eé] probable/i.test(opt.note || ''),
      ),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some((item) => item.key === 'disc-type'),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some((item) => item.key === 'height'),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some((item) => item.key === 'bolt-pattern'),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some((item) => item.key === 'center-bore'),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some((item) => item.key === 'offset'),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some(
        (item) => item.key === 'parking-brake-drum',
      ),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some(
        (item) => item.key === 'left-right-config',
      ),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some(
        (item) => item.key === 'heat-dissipation',
      ),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some(
        (item) => item.key === 'fade-resistance',
      ),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some(
        (item) => item.key === 'anti-corrosion-coating',
      ),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some((item) => item.key === 'total-cost'),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some((item) => item.key === 'return-risk'),
    ).toBe(true);
    expect(
      buyingGuide.selectionCriteria.some(
        (item) => item.key === 'expected-longevity',
      ),
    ).toBe(true);
    expect(
      buyingGuide.compatibilityRules.some((rule) =>
        /(tambour int[eé]gr[eé]|frein de parking)/i.test(rule),
      ),
    ).toBe(true);
    expect(
      buyingGuide.compatibilityRules.some((rule) =>
        /(gauche\/droite|gauche|droite|essieu)/i.test(rule),
      ),
    ).toBe(true);
    expect(buyingGuide.useCases.some((item) => item.label === 'Montagne')).toBe(
      true,
    );
    expect(
      buyingGuide.pairing.required.some((item) =>
        /capteur d'usure/i.test(item),
      ),
    ).toBe(true);
    expect(
      buyingGuide.output.pairingAdvice.some((item) =>
        /avant ensemble|arriere ensemble|par paire/i.test(item),
      ),
    ).toBe(true);
    expect(
      buyingGuide.output.pairingAdvice.some((item) =>
        /disques?.*plaquettes?.*ensemble|plaquettes?.*disques?.*ensemble/i.test(
          item,
        ),
      ),
    ).toBe(true);
    expect(
      buyingGuide.output.pairingAdvice.some((item) =>
        /200\s*(a|-|à)\s*300\s*km/i.test(item),
      ),
    ).toBe(true);
    expect(
      buyingGuide.trustArguments.some((item) => /(oem|oe|origine)/i.test(item.title)),
    ).toBe(true);
    expect(
      buyingGuide.trustArguments.some((item) =>
        /(retours|echanges|retour|échange)/i.test(item.title),
      ),
    ).toBe(true);
    expect(
      buyingGuide.trustArguments.some((item) =>
        /(livraison|expedition|expédition)/i.test(item.title),
      ),
    ).toBe(true);
  });

  it('genere automatiquement les sections achat minimales quand le guide DB est absent', () => {
    const autoGuide = service.buildAutoBuyingGuideV1({
      pgId: '479',
      pgName: 'Disque de frein',
      familyName: 'Freinage',
    });

    expect(autoGuide.inputs.vehicle.toLowerCase()).toContain('vin');
    expect(autoGuide.inputs.vehicle.toLowerCase()).toContain('frein arrière');
    expect(autoGuide.output.selectedSpec.length).toBeGreaterThan(20);
    expect(autoGuide.output.warnings.length).toBeGreaterThanOrEqual(1);
    expect(autoGuide.decisionTree.length).toBeGreaterThanOrEqual(5);
    expect(autoGuide.selectionCriteria.length).toBeGreaterThanOrEqual(5);
    expect(autoGuide.antiMistakes.length).toBeGreaterThanOrEqual(4);
    expect(autoGuide.compatibilityRules.length).toBeGreaterThanOrEqual(3);
    expect(autoGuide.useCases.length).toBeGreaterThanOrEqual(3);
    expect(autoGuide.faq.length).toBeGreaterThanOrEqual(3);
    expect(autoGuide.quality.verified).toBe(false);
    expect(autoGuide.quality.source).toMatch(/^fallback:\/\//);
  });

  it('rejette un guide anti-wiki avec criteres insuffisants et blabla generique', () => {
    const badGuide = {
      id: 479,
      pgId: '479',
      inputs: {
        vehicle: '',
        position: '',
        dimensionsOrReference: '',
        discType: '',
        constraints: [],
      },
      decisionTree: [],
      compatibilityRules: ['Piece importante pour le bon fonctionnement.'],
      antiMistakes: ['Entretien regulier conseille.'],
      selectionCriteria: [
        {
          key: 'k1',
          label: 'Critere 1',
          guidance: 'Role essentiel.',
          priority: 'required' as const,
        },
      ],
      useCases: [],
      pairing: { required: [], recommended: [], checks: [] },
      output: {
        selectedSpec: '',
        pairingAdvice: [],
        warnings: [],
      },
      faq: [],
      symptoms: [],
      trustArguments: [],
      quality: {
        score: 40,
        flags: [],
        version: 'GammeBuyingGuide.v1' as const,
        source: 'pdf://catalog/test.pdf',
        verified: true,
      },
    };

    const gate = service.passesBuyingGuideAntiWikiGate(badGuide);
    expect(gate.ok).toBe(false);
    expect(gate.reasons).toEqual(
      expect.arrayContaining([
        'MISSING_SELECTION_CRITERIA',
        'MISSING_ANTI_MISTAKES',
        'MISSING_DECISION_TREE',
        'GENERIC_WITHOUT_ACTION',
      ]),
    );
  });

  it('accepte un guide achat actionnable conforme au gate anti-wiki', () => {
    const goodGuide = service.buildAutoBuyingGuideV1({
      pgId: '479',
      pgName: 'Disque de frein',
      familyName: 'Freinage',
    });
    const gate = service.passesBuyingGuideAntiWikiGate(goodGuide);
    expect(gate.ok).toBe(true);
    expect(gate.reasons).toEqual([]);
  });
});
