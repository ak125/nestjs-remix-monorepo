-- ══════════════════════════════════════════════════════════
-- Diagnostic Engine MVP — Schema Slice 1
-- 6 tables + seed freinage
--
-- Sources RAG alignees :
--   diagnostic/bruits-freinage.md (probabilites, verifications)
--   gammes/plaquette-de-frein.md (pg_id: 402)
--   gammes/disque-de-frein.md (pg_id: 82)
--   gammes/etrier-de-frein.md (pg_id: 78)
-- ══════════════════════════════════════════════════════════

-- ── 1. Systemes mecaniques ──────────────────────────────

CREATE TABLE IF NOT EXISTS __diag_system (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Symptomes ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __diag_symptom (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  system_id INT NOT NULL REFERENCES __diag_system(id),
  label TEXT NOT NULL,
  description TEXT,
  signal_mode TEXT NOT NULL DEFAULT 'symptom_slugs',
  urgency TEXT DEFAULT 'moyenne',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Causes ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS __diag_cause (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  system_id INT NOT NULL REFERENCES __diag_system(id),
  label TEXT NOT NULL,
  cause_type TEXT NOT NULL DEFAULT 'maintenance_related',
  description TEXT,
  verification_method TEXT,
  urgency TEXT DEFAULT 'moyenne',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Liaison symptome ↔ cause (MVP simplifie) ────────

CREATE TABLE IF NOT EXISTS __diag_symptom_cause_link (
  id SERIAL PRIMARY KEY,
  symptom_id INT NOT NULL REFERENCES __diag_symptom(id),
  cause_id INT NOT NULL REFERENCES __diag_cause(id),
  relative_score INT DEFAULT 50 CHECK (relative_score BETWEEN 0 AND 100),
  evidence_for TEXT[] DEFAULT '{}',
  evidence_against TEXT[] DEFAULT '{}',
  requires_verification BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symptom_id, cause_id)
);

-- ── 5. Regles de securite ───────────────────────────────

CREATE TABLE IF NOT EXISTS __diag_safety_rule (
  id SERIAL PRIMARY KEY,
  system_id INT NOT NULL REFERENCES __diag_system(id),
  rule_slug TEXT UNIQUE NOT NULL,
  condition_description TEXT NOT NULL,
  risk_flag TEXT NOT NULL,
  urgency TEXT DEFAULT 'haute',
  blocks_catalog BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. Session (MVP simplifie) ──────────────────────────

CREATE TABLE IF NOT EXISTS __diag_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_type TEXT NOT NULL,
  system_scope TEXT NOT NULL,
  vehicle_context JSONB DEFAULT '{}',
  signal_input JSONB NOT NULL,
  answers JSONB DEFAULT '{}',
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- SEED DATA — Freinage
-- Aligne sur diagnostic/bruits-freinage.md + gammes RAG
-- ══════════════════════════════════════════════════════════

-- Systeme
INSERT INTO __diag_system (slug, label, description, display_order)
VALUES ('freinage', 'Système de freinage', 'Circuit de freinage hydraulique : plaquettes, disques, étriers, flexibles, liquide', 1)
ON CONFLICT (slug) DO NOTHING;

-- Symptomes (aligne sur bruits-freinage.md : 4 symptomes courants)
INSERT INTO __diag_symptom (slug, system_id, label, description, urgency) VALUES
  ('brake_noise_metallic', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Grincement aigu au freinage',
   'Son métallique aigu au moment du freinage léger ou modéré, type crissement',
   'haute'),
  ('brake_noise_grinding', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Bruit sourd / grondement au freinage',
   'Grondement au freinage appuyé, vibration ressentie dans la pédale',
   'haute'),
  ('brake_vibration_pedal', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Vibration dans la pédale de frein',
   'Vibration ressentie dans la pédale lors du freinage',
   'moyenne'),
  ('brake_soft_pedal', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Pédale de frein molle',
   'Pédale de frein qui s''enfonce anormalement, manque de résistance',
   'haute'),
  ('brake_pulling_side', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Véhicule tire d''un côté au freinage',
   'Déviation latérale du véhicule lors du freinage',
   'haute')
ON CONFLICT (slug) DO NOTHING;

-- Causes (aligne sur bruits-freinage.md : probabilites 70%, 15%, 10%, 5%)
INSERT INTO __diag_cause (slug, system_id, label, cause_type, description, verification_method, urgency) VALUES
  ('brake_pads_worn', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Plaquettes de frein usées',
   'maintenance_related',
   'Garniture de friction usée, témoin d''usure métallique en contact avec le disque',
   'Témoin usure allumé, épaisseur < 3mm',
   'haute'),
  ('brake_disc_warped', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Disques de frein voilés',
   'wear_related',
   'Disque déformé ou usé de façon irrégulière, provoque vibrations',
   'Vibration pédale, usure inégale visible',
   'moyenne'),
  ('brake_caliper_seized', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Étrier de frein grippé',
   'component_fault',
   'Piston d''étrier bloqué, provoque frottement permanent ou usure asymétrique',
   'Usure asymétrique des plaquettes',
   'haute'),
  ('brake_slide_pins_dry', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Glissières d''étrier sèches',
   'maintenance_related',
   'Absence de graisse sur les glissières, plaquettes difficiles à bouger',
   'Plaquettes difficiles à bouger dans le support',
   'basse'),
  ('brake_fluid_low', (SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'Niveau de liquide de frein bas',
   'maintenance_related',
   'Niveau de liquide de frein en dessous du minimum, peut indiquer fuite ou usure plaquettes',
   'Vérification niveau bocal, recherche de fuite',
   'haute')
ON CONFLICT (slug) DO NOTHING;

-- Liaisons symptome ↔ cause (scores alignes sur les probabilites RAG)
-- brake_noise_metallic : 70% plaquettes, 15% disques, 10% etrier, 5% glissieres
INSERT INTO __diag_symptom_cause_link (symptom_id, cause_id, relative_score, evidence_for, evidence_against) VALUES
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_metallic'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_pads_worn'),
   70,
   ARRAY['Bruit métallique typique du témoin d''usure', 'Cause la plus fréquente de bruit au freinage'],
   ARRAY['Épaisseur non mesurée — pas de confirmation directe']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_metallic'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_disc_warped'),
   15,
   ARRAY['Bruit peut indiquer contact anormal disque/plaquette'],
   ARRAY['Pas de vibration typique du voilage']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_metallic'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_caliper_seized'),
   10,
   ARRAY['Bruit compatible avec frottement permanent'],
   ARRAY['Pas de tirage au freinage', 'Moins fréquent que usure plaquettes']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_metallic'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_slide_pins_dry'),
   5,
   ARRAY['Bruit possible si plaquettes ne coulissent pas librement'],
   ARRAY['Bruit généralement moins prononcé'])
ON CONFLICT (symptom_id, cause_id) DO NOTHING;

-- brake_noise_grinding : 65% plaquettes (usure avancee), 20% disques, 10% etrier, 5% glissieres
INSERT INTO __diag_symptom_cause_link (symptom_id, cause_id, relative_score, evidence_for, evidence_against) VALUES
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_grinding'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_pads_worn'),
   65,
   ARRAY['Grondement = usure avancée de la garniture', 'Bruit sourd quand plaquettes quasi au métal'],
   ARRAY['Épaisseur non mesurée — pas de confirmation directe']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_grinding'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_disc_warped'),
   20,
   ARRAY['Grondement peut indiquer disque usé irrégulièrement', 'Vibration ressentie dans la pédale'],
   ARRAY['Vibration plus caractéristique du voilage que grondement']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_grinding'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_caliper_seized'),
   10,
   ARRAY['Étrier grippé provoque frottement permanent = grondement'],
   ARRAY['Pas de tirage latéral signalé']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_noise_grinding'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_slide_pins_dry'),
   5,
   ARRAY['Glissières sèches = plaquettes frottent anormalement'],
   ARRAY['Effet généralement moins prononcé'])
ON CONFLICT (symptom_id, cause_id) DO NOTHING;

-- brake_vibration_pedal : 60% disques, 25% plaquettes, 15% etrier
INSERT INTO __diag_symptom_cause_link (symptom_id, cause_id, relative_score, evidence_for, evidence_against) VALUES
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_vibration_pedal'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_disc_warped'),
   60,
   ARRAY['Vibration pédale est le symptôme classique du disque voilé', 'Usure inégale du disque'],
   ARRAY['Nécessite mesure au comparateur pour confirmer']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_vibration_pedal'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_pads_worn'),
   25,
   ARRAY['Plaquettes usées irrégulièrement peuvent provoquer vibration'],
   ARRAY['Vibration plus typique du disque voilé']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_vibration_pedal'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_caliper_seized'),
   15,
   ARRAY['Étrier grippé peut causer vibration par freinage asymétrique'],
   ARRAY['Symptôme secondaire, tirage latéral plus fréquent'])
ON CONFLICT (symptom_id, cause_id) DO NOTHING;

-- brake_soft_pedal : 60% liquide, 25% fuite, 15% autre
INSERT INTO __diag_symptom_cause_link (symptom_id, cause_id, relative_score, evidence_for, evidence_against) VALUES
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_soft_pedal'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_fluid_low'),
   60,
   ARRAY['Pédale molle = manque de pression hydraulique', 'Niveau liquide à vérifier en priorité'],
   ARRAY['Peut aussi indiquer air dans le circuit']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_soft_pedal'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_pads_worn'),
   25,
   ARRAY['Usure extrême des plaquettes augmente la course de la pédale'],
   ARRAY['Pédale molle moins typique que bruit pour usure plaquettes']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_soft_pedal'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_caliper_seized'),
   15,
   ARRAY['Étrier grippé peut affecter la course de la pédale'],
   ARRAY['Symptôme moins direct'])
ON CONFLICT (symptom_id, cause_id) DO NOTHING;

-- brake_pulling_side : etrier grippe dominant
INSERT INTO __diag_symptom_cause_link (symptom_id, cause_id, relative_score, evidence_for, evidence_against) VALUES
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_pulling_side'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_caliper_seized'),
   65,
   ARRAY['Tirage latéral = freinage asymétrique', 'Étrier grippé = cause la plus fréquente'],
   ARRAY['Peut aussi venir des pneumatiques ou de la géométrie']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_pulling_side'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_pads_worn'),
   20,
   ARRAY['Usure inégale gauche/droite possible'],
   ARRAY['Tirage plus typique de l''étrier']),
  ((SELECT id FROM __diag_symptom WHERE slug = 'brake_pulling_side'),
   (SELECT id FROM __diag_cause WHERE slug = 'brake_slide_pins_dry'),
   15,
   ARRAY['Glissières sèches = mouvement asymétrique des plaquettes'],
   ARRAY['Effet généralement moins prononcé'])
ON CONFLICT (symptom_id, cause_id) DO NOTHING;

-- Regles de securite freinage
INSERT INTO __diag_safety_rule (system_id, rule_slug, condition_description, risk_flag, urgency, blocks_catalog) VALUES
  ((SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'brake_metal_on_metal',
   'Plaquettes usées jusqu''au métal — freinage dégradé',
   'SECURITE: freinage dégradé si plaquettes métal sur métal',
   'haute', true),
  ((SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'brake_disc_damage_risk',
   'Retard de remplacement plaquettes — risque d''endommagement disques',
   'AGGRAVATION: disques endommagés si remplacement retardé',
   'haute', true),
  ((SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'brake_long_trip_warning',
   'Symptôme freinage actif — contrôle recommandé avant longs trajets',
   'ROULAGE: contrôle recommandé avant longs trajets',
   'moyenne', false),
  ((SELECT id FROM __diag_system WHERE slug = 'freinage'),
   'brake_fluid_critical',
   'Niveau liquide de frein bas — risque de perte de freinage',
   'CRITIQUE: perte de freinage possible si niveau liquide bas',
   'haute', true)
ON CONFLICT (rule_slug) DO NOTHING;

-- ── Index pour performances ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_diag_symptom_system ON __diag_symptom(system_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_diag_cause_system ON __diag_cause(system_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_diag_scl_symptom ON __diag_symptom_cause_link(symptom_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_diag_scl_cause ON __diag_symptom_cause_link(cause_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_diag_safety_system ON __diag_safety_rule(system_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_diag_session_created ON __diag_session(created_at);
