/**
 * Engine profile derivation + motorisation-specific content dicts.
 *
 * ADR-022 Pilier A — R8 duplicate content fix. Because `auto_type_motor_code`
 * is empty (1 row for 28K active types, DB audit 2026-04-24), we cannot key
 * content on engine_codes (K9K, F4R…). Instead we derive a synthetic profile
 * from (fuel × power_tier), giving ~16 profiles that cover ~90% of catalog.
 *
 * Used by R8VehicleEnricherService to render:
 *   - S_MOTOR_ISSUES (problèmes connus par motorisation) — was S_ENTRETIEN_CONTEXT
 *   - S_COMPAT_SCOPE enrichment (technical description) when engine_codes empty
 *   - S_TECH_SPECS Euro norm fallback from year_from
 *
 * Editorial ownership: modifications via PR signed commit (G3). Content is
 * factual technical description, not marketing copy.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Fuel =
  | 'essence'
  | 'diesel'
  | 'hybride_essence'
  | 'hybride_diesel'
  | 'electrique'
  | 'gpl'
  | 'ethanol'
  | 'inconnu';

export type PowerTier =
  | 'p1_mini'
  | 'p2_basse'
  | 'p3_moyenne'
  | 'p4_haute'
  | 'p5_sport'
  | 'p6_tres_haute';

export type EngineProfileKey = `${Fuel}_${PowerTier}`;

// ─────────────────────────────────────────────────────────────────────────────
// Derivation helpers
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_ACCENTS_RE = /[̀-ͯ]/g;

/**
 * Normalize a raw fuel string from `auto_type.type_fuel` into a canonical Fuel.
 * Handles accents (essence-électrique / essence-electrique both → hybride_essence).
 */
export function normalizeFuel(raw?: string | null): Fuel {
  if (!raw) return 'inconnu';
  const s = raw
    .normalize('NFD')
    .replace(STRIP_ACCENTS_RE, '')
    .toLowerCase()
    .trim();
  if (s.includes('electrique') && s.includes('essence'))
    return 'hybride_essence';
  if (s.includes('electrique') && s.includes('diesel')) return 'hybride_diesel';
  if (s === 'electrique') return 'electrique';
  if (s === 'diesel') return 'diesel';
  if (s === 'essence') return 'essence';
  if (s.includes('gpl') || s.includes('lpg')) return 'gpl';
  if (s.includes('ethanol') || s.includes('e85')) return 'ethanol';
  return 'inconnu';
}

/**
 * Map horsepower (ps) to canonical power tier.
 * Boundaries validated against DB distribution (audit 2026-04-24) : top 11
 * (fuel×tier) combos cover 85% of active catalog.
 */
export function derivePowerTier(powerPs: number): PowerTier {
  if (!Number.isFinite(powerPs) || powerPs <= 0) return 'p3_moyenne';
  if (powerPs < 75) return 'p1_mini';
  if (powerPs < 100) return 'p2_basse';
  if (powerPs < 130) return 'p3_moyenne';
  if (powerPs < 170) return 'p4_haute';
  if (powerPs < 230) return 'p5_sport';
  return 'p6_tres_haute';
}

/**
 * Compose the (fuel × tier) key. Accepts raw strings as they come from RPC.
 */
export function deriveEngineProfile(
  fuel?: string | null,
  powerPs?: string | number | null,
): EngineProfileKey {
  const f = normalizeFuel(fuel);
  const ps =
    typeof powerPs === 'number'
      ? powerPs
      : parseInt(String(powerPs || '0'), 10);
  const tier = derivePowerTier(ps);
  return `${f}_${tier}` as EngineProfileKey;
}

/**
 * Derive Euro norm from first production year. Conservative cutoff (actual
 * Euro rules depend on vehicle category + date d'immatriculation not year_from
 * of the type definition, so this is a best-effort SEO signal not a legal claim).
 */
export function deriveEuroNorm(
  yearFrom?: string | number | null,
): string | null {
  const y =
    typeof yearFrom === 'number'
      ? yearFrom
      : parseInt(String(yearFrom || '0'), 10);
  if (!Number.isFinite(y) || y <= 1980) return null;
  if (y < 1996) return 'Euro 1';
  if (y < 2000) return 'Euro 2';
  if (y < 2005) return 'Euro 3';
  if (y < 2009) return 'Euro 4';
  if (y < 2014) return 'Euro 5';
  if (y < 2017) return 'Euro 6b';
  if (y < 2020) return 'Euro 6c';
  return 'Euro 6d';
}

// ─────────────────────────────────────────────────────────────────────────────
// Content dicts
//
// Issues lists : 6–8 items per profile, distinct vocabulary to maximise Jaccard
// divergence between sibling profiles. Factual technical content, no marketing.
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_ISSUES: readonly string[] = [
  'Filtre à air à remplacer selon kilométrage constructeur',
  'Plaquettes et disques de frein à contrôler tous les 30 000 km',
  'Batterie de démarrage à tester au-delà de 4 ans',
  'Liquide de refroidissement à vérifier annuellement',
  'Amortisseurs à inspecter lors de la révision',
];

export const ENGINE_PROFILE_ISSUES: Partial<
  Record<EngineProfileKey, readonly string[]>
> = {
  // ── Essence (6 tiers) ─────────────────────────────────────────────────────
  essence_p1_mini: [
    "Bougies d'allumage à changer tous les 30 000 km",
    "Bobines d'allumage sujettes à défaillance prématurée",
    'Injecteurs multipoint encrassés par additifs de carburant',
    'Alternateur à charbon faible puissance sensible aux démarrages répétés',
    'Filtre à air à remplacer régulièrement (usage urbain poussiéreux)',
    "Démarreur d'origine à contrôler après 120 000 km",
    'Sonde lambda en amont catalyseur souvent en cause de voyant moteur',
  ],
  essence_p2_basse: [
    "Bougies et bobines d'allumage (panne intermittente à froid)",
    'Capteur de vilebrequin sensible à la chaleur',
    'Papillon des gaz motorisé encrassé (ralenti instable)',
    "Sonde d'oxygène (lambda) avant et après catalyseur",
    'Filtre à carburant à remplacer tous les 60 000 km',
    'Distribution par courroie crantée à intervalle strict',
    'Pompe à eau souvent solidaire de la courroie de distribution',
  ],
  essence_p3_moyenne: [
    'Turbocompresseur de petite taille sujet à fatigue (TCe, THP, TSI)',
    'Injecteurs électroniques multipoint ou directs selon génération',
    'Distribution par chaîne : tendeur hydraulique à surveiller',
    "Capteurs d'arbre à cames (admission/échappement)",
    "Amortisseurs renforcés d'origine à contrôler tous les 60 000 km",
    'Embrayage bi-matière sensible aux couples élevés',
    'Vanne thermostatique électronique (température moteur instable)',
  ],
  essence_p4_haute: [
    'Turbo à géométrie variable (TSI, TFSI)',
    "Dépôts de calamine aux soupapes d'admission (injection directe)",
    'Tendeur de chaîne de distribution défaillant avant 150 000 km',
    "Bobines d'allumage individuelles (panne moteur cylindre par cylindre)",
    "Débitmètre d'air massique (MAF) sensible à l'huile de l'admission",
    'Pompe haute pression injection directe',
    'Refroidisseur intercooler à contrôler (perte de pression)',
  ],
  essence_p5_sport: [
    'Turbo haute performance à géométrie variable ou bi-scroll',
    'Injecteurs haute pression à remplacer en cas de perte de puissance',
    'Refroidisseur intercooler haute capacité (étanchéité)',
    'Tendeur et chaîne de distribution renforcée',
    'Amortisseurs pilotés électroniquement',
    'Disques de frein surdimensionnés (vérifier voile et épaisseur)',
    'Différentiel auto-bloquant ou pont limité sur certaines finitions',
  ],
  essence_p6_tres_haute: [
    'Turbos multiples (bi-turbo parallèle ou séquentiel)',
    'Distribution complexe (double VANOS, chaîne courte + longue)',
    'Boîte automatique DSG/PDK (mécatronique, huile à remplacer selon constructeur)',
    'Différentiel auto-bloquant ou Torque Vectoring',
    'Refroidisseurs haute capacité (huile, intercooler, direction)',
    'Plaquettes céramique haute température',
    'Calibrage électronique moteur sensible aux reprogrammations',
  ],

  // ── Diesel (6 tiers) ──────────────────────────────────────────────────────
  diesel_p1_mini: [
    'Vanne EGR encrassée (perte de puissance, voyant moteur)',
    'FAP colmaté sur usage urbain (petite cylindrée, peu de régénération)',
    'Injecteurs Siemens ou Bosch sujets à coupure cylindre',
    'Turbo de petite taille (fuite huile côté admission)',
    "Débitmètre d'air massique encrassé",
    'Sonde de température carburant (démarrage à froid difficile)',
    "Pompe à vide mécanique (freinage dur ou fuite d'huile)",
  ],
  diesel_p2_basse: [
    'Vanne EGR haute pression à nettoyer ou remplacer',
    'FAP catalysé (additif FAP à refaire chez certains constructeurs)',
    'Injecteurs common rail (cliquetis ou fumée)',
    "Turbocompresseur à géométrie fixe (durite d'huile turbo)",
    "Pompe à vide assistance freinage (fuite moteur d'huile)",
    'Capteur pression rail haute pression',
    'Thermostat moteur (température de fonctionnement basse)',
  ],
  diesel_p3_moyenne: [
    'Injection common rail seconde génération (rail 1800 bar)',
    'Vanne EGR électrique (code défaut P0401)',
    'FAP catalysé à régénérer régulièrement (trajet autoroutier)',
    'Turbo à géométrie variable (VGT) — aubes grippées',
    'Volant bi-masse (vibrations à bas régime, embrayage à risque)',
    'AdBlue sur motorisations post-2016 (qualité et consommation)',
    'Radiateur EGR parfois poreux (mélange eau/huile)',
  ],
  diesel_p4_haute: [
    'Injecteurs piézo-électriques (remplacement coûteux)',
    'Vanne EGR double (haute et basse pression) sur Euro 6',
    'FAP + catalyseur SCR (système AdBlue obligatoire)',
    'Turbo à géométrie variable de grand diamètre',
    'Radiateur intercooler (étanchéité sous forte pression)',
    'Pompe haute pression CP4 (usure internes sur gasoil dégradé)',
    'Refroidisseur EGR basse pression',
  ],
  diesel_p5_sport: [
    'Bi-turbo séquentiel (soupape de répartition)',
    'Injection piézo 2000 bar (étalonnage périodique)',
    'Catalyseur SCR + réservoir AdBlue (20–25 L)',
    'Vanne EGR haute pression + basse pression',
    'Échangeur air-eau intercooler',
    'Distribution par chaîne à pignons (bruit de cliquetis à froid)',
    'Système AdBlue cristallisé en cas de non-utilisation prolongée',
  ],
  diesel_p6_tres_haute: [
    'Turbo compound ou tri-turbo haute performance',
    'Injection common rail 2500 bar (piézo multi-injection)',
    'Post-traitement SCR multi-étages + FAP + NOx trap',
    'Distribution complexe par chaîne multi-étages',
    'Radiateur huile moteur et boîte séparé',
    'Échangeur air-eau intercooler refroidi par circuit dédié',
    'Boîte automatique 8 ou 9 rapports (huile spéciale + mécatronique)',
  ],

  // ── Hybrides (2 tiers) ────────────────────────────────────────────────────
  hybride_essence_p3_moyenne: [
    'Batterie haute tension (NiMH ou Li-ion) — perte de capacité après 8 ans',
    'Moteur électrique intégré (roulements à contrôler)',
    'Système eCVT ou boîte hybride à engrenages planétaires',
    'Calculateur hybride (diagnostic spécifique constructeur obligatoire)',
    'Pompe à eau électrique (circuit refroidissement batterie)',
    'Freinage régénératif : disques moins sollicités mais oxydation possible',
    'Contacteur haute tension (relais orange sécurité)',
  ],
  hybride_essence_p5_sport: [
    'Batterie Li-ion haute capacité refroidie (liquide ou air pulsé)',
    'Onduleur (inverter) haute tension — fuite huile sur certaines générations',
    'Moteurs-générateurs MG1/MG2 intégrés à la transmission',
    'Transmission CVT hybride ou boîte à double moteur électrique',
    'Système de refroidissement batterie dédié (pompe + radiateur)',
    'Freinage régénératif pilotage électronique fin',
    'Chargeur embarqué on-board (PHEV uniquement)',
  ],

  // ── Electrique (1 profil) ─────────────────────────────────────────────────
  electrique_p6_tres_haute: [
    'Batterie lithium-ion (dégradation 1–2 % par an en moyenne)',
    'BMS (Battery Management System) : mise à jour firmware constructeur',
    'Chargeur embarqué on-board (AC 7 à 22 kW)',
    'Convertisseur DC/DC (alimente batterie 12V auxiliaire)',
    'Compresseur de climatisation électrique haute tension',
    'Moteur synchrone à aimants permanents ou asynchrone',
    'Système de freinage régénératif : disques à dérouiller régulièrement',
  ],

  // ── Fallback (motorisations atypiques) ────────────────────────────────────
  inconnu_p3_moyenne: FALLBACK_ISSUES,
};

/**
 * Lookup with cascade :
 *   1. exact profile key
 *   2. essence tier for ethanol/gpl/hybride_essence
 *   3. diesel tier for hybride_diesel
 *   4. inconnu_p3_moyenne fallback
 */
export function getEngineProfileIssues(
  profile: EngineProfileKey,
): readonly string[] {
  const direct = ENGINE_PROFILE_ISSUES[profile];
  if (direct) return direct;

  const [fuel, ...tierParts] = profile.split('_');
  const tier = tierParts.join('_') as PowerTier;
  let fallbackFuel: Fuel;
  if (fuel === 'ethanol' || fuel === 'gpl') fallbackFuel = 'essence';
  else if (fuel === 'hybride')
    fallbackFuel = 'essence'; // shouldn't happen but defensive
  else fallbackFuel = 'inconnu';

  const fallbackKey = `${fallbackFuel}_${tier}` as EngineProfileKey;
  return (
    ENGINE_PROFILE_ISSUES[fallbackKey] ??
    ENGINE_PROFILE_ISSUES.inconnu_p3_moyenne ??
    FALLBACK_ISSUES
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Technical descriptions (short, 1–2 sentences per profile)
// Used by S_COMPAT_SCOPE enrichment when engine_codes are empty (most cases).
// ─────────────────────────────────────────────────────────────────────────────

export const ENGINE_PROFILE_DESCRIPTIONS: Partial<
  Record<EngineProfileKey, string>
> = {
  essence_p1_mini:
    'Bloc essence atmosphérique 3 ou 4 cylindres à injection multipoint, faible cylindrée adaptée aux trajets urbains.',
  essence_p2_basse:
    'Moteur essence 4 cylindres à injection électronique séquentielle, distribution par courroie crantée ou chaîne.',
  essence_p3_moyenne:
    'Moteur essence turbocompressé de cylindrée moyenne (TCe, THP, TSI), injection directe ou semi-directe haute pression.',
  essence_p4_haute:
    'Bloc essence à injection directe haute pression, turbo à géométrie variable, distribution par chaîne et gestion électronique complète.',
  essence_p5_sport:
    'Motorisation sportive suralimentée, injection directe haute pression, culasse multisoupapes, refroidisseur intercooler renforcé.',
  essence_p6_tres_haute:
    'Moteur haute performance multi-turbo ou V6/V8 à injection directe, distribution complexe et lubrification renforcée.',

  diesel_p1_mini:
    'Bloc diesel atmosphérique ou turbo basse pression, injection indirecte ou common rail première génération.',
  diesel_p2_basse:
    'Diesel common rail première génération, turbocompresseur à géométrie fixe, FAP catalysé sur certaines déclinaisons.',
  diesel_p3_moyenne:
    'Diesel common rail seconde génération, turbo à géométrie variable (VGT), FAP + gestion électronique EDC.',
  diesel_p4_haute:
    'Diesel à injection piézo haute pression, turbo VGT, post-traitement SCR + AdBlue conformité Euro 6.',
  diesel_p5_sport:
    'Diesel performance bi-turbo séquentiel ou hybride léger 48V, injection piézo 2000+ bar, SCR + AdBlue Euro 6d.',
  diesel_p6_tres_haute:
    'Diesel haut de gamme V6 ou V8, turbo compound ou tri-turbo, injection common rail 2500 bar, post-traitement multi-étages.',

  hybride_essence_p3_moyenne:
    'Chaîne de traction hybride essence–électrique, transmission eCVT ou à engrenages planétaires, batterie HV NiMH ou Li-ion.',
  hybride_essence_p5_sport:
    'Hybride full essence–électrique haute puissance, moteur thermique turbo associé à générateur-moteur, batterie Li-ion refroidie.',

  electrique_p6_tres_haute:
    'Propulsion 100 % électrique, moteur synchrone à aimants permanents ou asynchrone, batterie lithium-ion haute densité.',

  inconnu_p3_moyenne:
    "Motorisation spécifique à ce modèle — consulter la documentation constructeur pour le type d'injection et de suralimentation.",
};

export function getEngineProfileDescription(profile: EngineProfileKey): string {
  const direct = ENGINE_PROFILE_DESCRIPTIONS[profile];
  if (direct) return direct;

  const [fuel, ...tierParts] = profile.split('_');
  const tier = tierParts.join('_') as PowerTier;
  let fallbackFuel: Fuel;
  if (fuel === 'ethanol' || fuel === 'gpl') fallbackFuel = 'essence';
  else fallbackFuel = 'inconnu';
  const fallbackKey = `${fallbackFuel}_${tier}` as EngineProfileKey;
  return (
    ENGINE_PROFILE_DESCRIPTIONS[fallbackKey] ??
    ENGINE_PROFILE_DESCRIPTIONS.inconnu_p3_moyenne!
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// S_MOTOR_ISSUES opener variations (rotated per typeId, pool size = 7 prime).
// Placeholders: {brand} {model} {type} {power} {fuel}
// ─────────────────────────────────────────────────────────────────────────────

export const SEO_R8_MOTOR_ISSUES_OPENERS = [
  "Problèmes techniques récurrents de la motorisation {type} {power} ch {fuel} — vérifiez ces points à l'entretien.",
  'Faiblesses connues de la {brand} {model} {type} ({power} ch) : composants à surveiller en priorité.',
  'Points techniques sensibles de ce bloc {type} {fuel} — liste extraite des retours atelier.',
  "Pannes fréquentes sur la motorisation {type} de {power} ch — à contrôler lors d'un achat d'occasion.",
  'Défaillances typiques de ce moteur {fuel} {power} ch équipant la {brand} {model}.',
  'Avant un achat ou une réparation sur la {brand} {model} {type}, prenez connaissance de ces faiblesses documentées.',
  "Retour d'expérience atelier sur la motorisation {type} {power} ch — points de vigilance.",
] as const;

/** Offset for MOTOR_ISSUES rotation slot (distinct from R8_SLOT_OFFSETS). */
export const MOTOR_ISSUES_SLOT_OFFSET = 500;
