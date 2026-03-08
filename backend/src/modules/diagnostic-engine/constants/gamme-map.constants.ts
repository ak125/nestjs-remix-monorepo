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
};
