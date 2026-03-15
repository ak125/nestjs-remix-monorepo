/**
 * Mapping cause_slug → gamme(s) catalogue
 *
 * Aligned on real pg_ids from pieces_gamme table.
 * This is the SINGLE source of truth for cause→gamme resolution.
 */
export interface GammeMapping {
  slug: string;
  label: string;
  pg_id: number;
}

export const CAUSE_GAMME_MAP: Record<string, GammeMapping[]> = {
  // ── Freinage ──────────────────────────────────────
  brake_pads_worn: [
    { slug: 'plaquette-de-frein', label: 'Plaquette de frein', pg_id: 402 },
  ],
  brake_disc_warped: [
    { slug: 'disque-de-frein', label: 'Disque de frein', pg_id: 82 },
  ],
  brake_caliper_seized: [
    { slug: 'etrier-de-frein', label: 'Étrier de frein', pg_id: 78 },
  ],
  brake_slide_pins_dry: [
    { slug: 'etrier-de-frein', label: 'Étrier de frein', pg_id: 78 },
  ],
  brake_fluid_low: [
    { slug: 'liquide-de-frein', label: 'Liquide de frein', pg_id: 479 },
  ],

  // ── Démarrage / Charge ────────────────────────────
  battery_dead: [{ slug: 'batterie', label: 'Batterie', pg_id: 1 }],
  battery_terminals_corroded: [
    { slug: 'batterie', label: 'Batterie', pg_id: 1 },
  ],
  starter_solenoid_worn: [{ slug: 'demarreur', label: 'Démarreur', pg_id: 2 }],
  alternator_failing: [{ slug: 'alternateur', label: 'Alternateur', pg_id: 4 }],
  parasitic_drain: [], // pas de piece specifique
  glow_plugs_failing: [
    {
      slug: 'bougie-de-prechauffage',
      label: 'Bougie de préchauffage',
      pg_id: 243,
    },
  ],
  ground_cable_corroded: [], // cable de masse — pas de gamme standard

  // ── Refroidissement ─────────────────────────────────
  coolant_level_low: [
    {
      slug: 'durite-de-refroidissement',
      label: 'Durite de refroidissement',
      pg_id: 475,
    },
    { slug: 'vase-d-expansion', label: "Vase d'expansion", pg_id: 397 },
  ],
  water_pump_failing: [
    { slug: 'pompe-a-eau', label: 'Pompe à eau', pg_id: 1260 },
  ],
  thermostat_stuck_closed: [
    { slug: 'thermostat', label: 'Thermostat', pg_id: 316 },
  ],
  thermostat_stuck_open: [
    { slug: 'thermostat', label: 'Thermostat', pg_id: 316 },
  ],
  cooling_fan_failure: [
    {
      slug: 'ventilateur-de-refroidissement',
      label: 'Ventilateur de refroidissement',
      pg_id: 508,
    },
  ],
  radiator_clogged: [
    {
      slug: 'radiateur-de-refroidissement',
      label: 'Radiateur de refroidissement',
      pg_id: 470,
    },
  ],

  // ── Distribution ──────────────────────────────────────────
  courroie_distribution_usee: [
    { slug: 'kit-de-distribution', label: 'Kit de distribution', pg_id: 307 },
    {
      slug: 'kit-de-distribution-avec-pompe-a-eau',
      label: 'Kit de distribution avec pompe à eau',
      pg_id: 3096,
    },
  ],
  galet_tendeur_defaillant: [
    {
      slug: 'galet-tendeur-de-courroie-de-distribution',
      label: 'Galet tendeur de courroie de distribution',
      pg_id: 308,
    },
  ],
  pompe_eau_distribution: [
    { slug: 'pompe-a-eau', label: 'Pompe à eau', pg_id: 1260 },
  ],
  courroie_accessoires_usee: [
    {
      slug: 'courroie-trapezoidale-a-nervures',
      label: 'Courroie trapézoïdale à nervures',
      pg_id: 305,
    },
  ],

  // ── Embrayage ─────────────────────────────────────────────
  disque_embrayage_use: [
    { slug: 'embrayage', label: 'Embrayage', pg_id: 3825 },
  ],
  butee_embrayage_hs: [
    { slug: 'butee-d-embrayage', label: "Butée d'embrayage", pg_id: 48 },
  ],
  volant_moteur_bimasse_hs: [
    { slug: 'volant-moteur', label: 'Volant moteur', pg_id: 577 },
  ],
  emetteur_recepteur_defaillant: [
    { slug: 'emetteur-d-embrayage', label: "Emetteur d'embrayage", pg_id: 234 },
    {
      slug: 'recepteur-d-embrayage',
      label: "Récepteur d'embrayage",
      pg_id: 620,
    },
  ],

  // ── Suspension ────────────────────────────────────────────
  amortisseur_use: [{ slug: 'amortisseur', label: 'Amortisseur', pg_id: 854 }],
  ressort_casse: [
    {
      slug: 'ressort-de-suspension',
      label: 'Ressort de suspension',
      pg_id: 188,
    },
  ],
  rotule_suspension_hs: [
    {
      slug: 'rotule-de-suspension',
      label: 'Rotule de suspension',
      pg_id: 2462,
    },
  ],
  silentbloc_use: [
    {
      slug: 'silentbloc-de-bras-de-suspension',
      label: 'Silentbloc de bras de suspension',
      pg_id: 251,
    },
  ],
  coupelle_amortisseur_hs: [
    {
      slug: 'coupelle-de-suspension',
      label: 'Coupelle de suspension',
      pg_id: 1180,
    },
  ],

  // ── Direction ─────────────────────────────────────────────
  cremaillere_usee: [], // pas de gamme crémaillère complète
  pompe_direction_hs: [
    {
      slug: 'pompe-de-direction-assistee',
      label: 'Pompe de direction assistée',
      pg_id: 12,
    },
  ],
  rotule_direction_usee: [
    {
      slug: 'rotule-de-direction',
      label: 'Rotule de direction',
      pg_id: 2066,
    },
  ],
  biellette_direction_usee: [
    {
      slug: 'biellette-de-barre-stabilisatrice',
      label: 'Biellette de barre stabilisatrice',
      pg_id: 3230,
    },
  ],

  // ── Échappement ───────────────────────────────────────────
  catalyseur_colmate: [{ slug: 'catalyseur', label: 'Catalyseur', pg_id: 429 }],
  sonde_lambda_hs: [
    { slug: 'sonde-lambda', label: 'Sonde lambda', pg_id: 3922 },
  ],
  silencieux_perce: [{ slug: 'silencieux', label: 'Silencieux', pg_id: 26 }],
  joint_collecteur_hs: [], // joint collecteur — pas de gamme standard

  // ── Filtration ────────────────────────────────────────────
  filtre_huile_colmate: [
    { slug: 'filtre-a-huile', label: 'Filtre à huile', pg_id: 7 },
  ],
  filtre_air_colmate: [
    { slug: 'filtre-a-air', label: 'Filtre à air', pg_id: 8 },
  ],
  filtre_carburant_colmate: [
    { slug: 'filtre-a-carburant', label: 'Filtre à carburant', pg_id: 9 },
  ],
  filtre_habitacle_sature: [
    { slug: 'filtre-d-habitacle', label: "Filtre d'habitacle", pg_id: 424 },
  ],

  // ── Injection ─────────────────────────────────────────────
  injecteur_encrasse: [{ slug: 'injecteur', label: 'Injecteur', pg_id: 3902 }],
  pompe_injection_hs: [
    { slug: 'pompe-a-injection', label: 'Pompe à injection', pg_id: 3904 },
  ],
  bobine_allumage_hs: [
    { slug: 'bougie-d-allumage', label: "Bougie d'allumage", pg_id: 686 },
  ],
  filtre_carburant_injection: [
    { slug: 'filtre-a-carburant', label: 'Filtre à carburant', pg_id: 9 },
  ],

  // ── Climatisation ─────────────────────────────────────────
  compresseur_clim_hs: [
    {
      slug: 'compresseur-de-climatisation',
      label: 'Compresseur de climatisation',
      pg_id: 447,
    },
  ],
  condenseur_clim_bouche: [
    {
      slug: 'condenseur-de-climatisation',
      label: 'Condenseur de climatisation',
      pg_id: 448,
    },
  ],
  deshydrateur_sature: [
    {
      slug: 'bouteille-deshydratante',
      label: 'Bouteille déshydratante',
      pg_id: 851,
    },
  ],
  fuite_gaz_refrigerant: [], // pas de pièce spécifique — recharge gaz
  filtre_habitacle_clim: [
    { slug: 'filtre-d-habitacle', label: "Filtre d'habitacle", pg_id: 424 },
  ],

  // ── Transmission ──────────────────────────────────────────
  cardan_use: [{ slug: 'cardan', label: 'Cardan', pg_id: 13 }],
  soufflet_cardan_dechire: [
    { slug: 'soufflet-de-cardan', label: 'Soufflet de Cardan', pg_id: 193 },
  ],
  boite_vitesses_usee: [], // boîte de vitesses — pas de gamme pièce détachée standard

  // ── Éclairage ─────────────────────────────────────────────
  ampoule_grillee: [{ slug: 'ampoule', label: 'Ampoule', pg_id: 1457 }],
  feu_avant_defaillant: [{ slug: 'feu-avant', label: 'Feu avant', pg_id: 259 }],
  feu_arriere_defaillant: [
    { slug: 'feu-arriere', label: 'Feu arrière', pg_id: 290 },
  ],
};
