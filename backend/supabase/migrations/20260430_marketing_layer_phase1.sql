-- ADR-036 Phase 1 — Marketing Operating Layer (PR-1.1)
--
-- Source : ADR-036 (governance-vault) + plan rev 8 + canon brand voice
-- (`.claude/rules/marketing-voice.md` v1.0.0, hash-locked vs vault).
-- Auto-revue post-inventaire DB :
--   9 tables __marketing_* existent déjà (vérifié inventory-marketing-tables.py)
--   Aucune n'est doublon parfait : toutes channel-specific
--     (__marketing_social_posts = IG/FB only, __marketing_campaigns = backlinks
--      only, __marketing_weekly_plans = plan agrégé, __marketing_kpi_snapshots =
--      snapshot quotidien). __marketing_brief comme table fédératrice multi-channel
--      agent-orchestrated n'a pas d'équivalent.
--
-- Convention brand_gate adoptée du codebase existant :
--   __marketing_social_posts.brand_gate_level CHECK IN ('PASS','WARN','FAIL')
--   → __marketing_brief reprend la même convention (pas d'invention BLOCK/WRITE/REVIEW).
--
-- Channels enum aligné strict canon `marketing-voice.md` v1.0.0 :
--   ECOMMERCE → website_seo, email, social_facebook, social_instagram
--   LOCAL     → gbp, local_landing, sms
--   HYBRID    → ECOMMERCE channels (cas d'école : email cross-business)
--   YouTube hors scope canon Phase 1. Si ajouté plus tard : PR vault dédiée
--   (bump marketing-voice.md → v1.1) puis migration ALTER CONSTRAINT.
--
-- Defense-in-depth gates (3 couches indépendantes) :
--   - SQL CHECK             = invariants immuables (énums, présence champs,
--                             cohérence unit×channel)
--   - DTO Zod (NestJS)      = validation valeurs runtime (ex: target_zone='93')
--   - brand-compliance-gate.service.ts
--                           = règles métier dynamiques (lit
--                             `__marketing_brand_rules` + `local_canon.validated`,
--                             retourne BLOCK avec reason `local_canon_unvalidated`
--                             tant que local_canon n'est pas validé par le métier)
--
-- 3 changes idempotents (IF NOT EXISTS partout) :
--   1. __marketing_brief : table fédératrice briefs agent-orchestrated
--   2. __retention_trigger_rules : règles métier data-driven cycles véhicule
--   3. ___xtr_customer.cst_marketing_consent_at : champ RGPD non-négociable
--
-- RLS service_role only sur les 2 nouvelles tables.
-- ALTER ___xtr_customer = additif uniquement (NULL backfill, non rétroactif RGPD).
--
-- Transaction : gérée par le caller (apply-migration-marketing-phase1.py
-- enveloppe en BEGIN/ROLLBACK-on-error/COMMIT côté driver, ou supabase CLI,
-- ou `psql -1`). Pas de BEGIN/COMMIT inline ici → refactoring-safe et
-- compatible tous les runners.

-- ── 1. __marketing_brief ─────────────────────────────────────────────────────
-- Table fédératrice : 1 brief = 1 sortie agent (LEAD/LOCAL/RETENTION).
-- Multi-channel (gbp, local_landing, website_seo, email, sms, social_*).
-- Métriques inline (cohérent __marketing_social_posts.actual_*).

CREATE TABLE IF NOT EXISTS public.__marketing_brief (
  -- Identity
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        text        NOT NULL,

  -- Business unit + channel (ECOMMERCE/LOCAL/HYBRID séparation cf ADR-036)
  business_unit   text        NOT NULL
                              CHECK (business_unit IN ('ECOMMERCE','LOCAL','HYBRID')),
  -- Channel enum strict canon marketing-voice.md v1.0.0 — 7 valeurs.
  -- Pas de social_youtube : hors scope canon Phase 1 (cf header §"Channels enum").
  channel         text        NOT NULL
                              CHECK (channel IN (
                                'gbp','local_landing','website_seo',
                                'email','sms',
                                'social_facebook','social_instagram'
                              )),

  -- Conversion-driven (NOT NULL = règle ADR-036 anti contenu décoratif)
  conversion_goal text        NOT NULL
                              CHECK (conversion_goal IN ('CALL','VISIT','QUOTE','ORDER')),
  cta             text        NOT NULL,
  target_segment  text        NOT NULL,

  -- Payload + AEC coverage manifest obligatoire
  payload            jsonb    NOT NULL,
  coverage_manifest  jsonb    NOT NULL,

  -- Brand/compliance gates (cohérent __marketing_social_posts)
  brand_gate_level       text CHECK (brand_gate_level IN ('PASS','WARN','FAIL')),
  compliance_gate_level  text CHECK (compliance_gate_level IN ('PASS','WARN','FAIL')),
  gate_summary           jsonb,

  -- Lifecycle status
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN (
                                'draft','reviewed','approved','published','archived'
                              )),

  -- Validation humaine (AI4)
  reviewed_by     text,
  reviewed_at     timestamptz,
  approved_by     text,
  approved_at     timestamptz,
  published_at    timestamptz,

  -- Lien optionnel vers post social spécifique
  -- (si brief LOCAL produit aussi un post IG/FB/YT, FK vers la table existante)
  social_post_id  bigint REFERENCES public.__marketing_social_posts(id) ON DELETE SET NULL,

  -- Performance metrics inline (cohérent __marketing_social_posts.actual_*)
  -- Phase 1 = saisie admin manuelle. Phase 3 = providers auto.
  actual_impressions       integer DEFAULT 0,
  actual_clicks            integer DEFAULT 0,
  actual_calls             integer DEFAULT 0,
  actual_visits            integer DEFAULT 0,
  actual_quotes            integer DEFAULT 0,
  actual_orders            integer DEFAULT 0,
  actual_revenue_cents     bigint  DEFAULT 0,
  performance_updated_at   timestamptz,

  -- Trace agent (cohérent __marketing_social_posts.ai_*)
  ai_provider              text,
  ai_model                 text,
  generation_prompt_hash   text,

  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- HYBRID payload — invariants immuables (5 conditions canon marketing-voice.md
  -- §"Voix HYBRID — Conditions strictes"). Le SQL CHECK enforce la PRÉSENCE
  -- des 6 clés obligatoires + length>0 sur les chaînes critiques. La
  -- VALIDATION DES VALEURS (target_zone='93' ou intention magasin explicite,
  -- cohérence sémantique cta_ecommerce ≠ cta_local, conversion_goals distincts
  -- non-identiques, local_canon.validated=true) est faite par :
  --   1. DTO Zod (NestJS) au moment du POST /admin/marketing/briefs
  --   2. brand-compliance-gate.service.ts au moment du transition status reviewed
  CONSTRAINT marketing_brief_hybrid_payload_check CHECK (
    business_unit <> 'HYBRID'
    OR (
      payload ? 'hybrid_reason'
      AND payload ? 'target_zone'
      AND payload ? 'cta_ecommerce'
      AND payload ? 'cta_local'
      AND payload ? 'conversion_goal_ecommerce'
      AND payload ? 'conversion_goal_local'
      AND length(coalesce(payload->>'hybrid_reason','')) > 0
      AND length(coalesce(payload->>'target_zone','')) > 0
      AND length(coalesce(payload->>'cta_ecommerce','')) > 0
      AND length(coalesce(payload->>'cta_local','')) > 0
    )
  ),

  -- Cohérence business_unit × channel — strict canon marketing-voice.md v1.0.0
  -- HYBRID emprunte les channels ECOMMERCE (cas d'école : email cross-business).
  CONSTRAINT marketing_brief_unit_channel_coherence CHECK (
    (business_unit = 'LOCAL'
      AND channel IN ('gbp','local_landing','sms'))
    OR
    (business_unit = 'ECOMMERCE'
      AND channel IN ('website_seo','email','social_facebook','social_instagram'))
    OR
    (business_unit = 'HYBRID'
      AND channel IN ('website_seo','email','social_facebook','social_instagram'))
  )
);

-- Index pour requêtes courantes (admin UI listing par status, agent, business_unit)
CREATE INDEX IF NOT EXISTS idx_marketing_brief_status_created
  ON public.__marketing_brief (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_brief_business_unit_status
  ON public.__marketing_brief (business_unit, status);

CREATE INDEX IF NOT EXISTS idx_marketing_brief_agent_created
  ON public.__marketing_brief (agent_id, created_at DESC);

-- Trigger updated_at auto
CREATE OR REPLACE FUNCTION public.fn_marketing_brief_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_brief_updated_at ON public.__marketing_brief;
CREATE TRIGGER trg_marketing_brief_updated_at
  BEFORE UPDATE ON public.__marketing_brief
  FOR EACH ROW EXECUTE FUNCTION public.fn_marketing_brief_updated_at();

-- RLS : service_role only (pas d'accès anon ou authenticated direct)
ALTER TABLE public.__marketing_brief ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_brief_service_role_all ON public.__marketing_brief; -- APPROVED: idempotent recreate, policy redefined immediately below (no access gap)
CREATE POLICY marketing_brief_service_role_all
  ON public.__marketing_brief
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Bloque tout accès anon/authenticated (revoke par défaut postgres)
REVOKE ALL ON public.__marketing_brief FROM anon, authenticated;

COMMENT ON TABLE public.__marketing_brief IS
  'ADR-036 Phase 1 — Briefs agent-orchestrated multi-channel (LEAD/LOCAL/RETENTION). '
  'Canal d''échange agent → engine. Métriques inline cohérentes __marketing_social_posts.actual_*. '
  'FK optionnel social_post_id pour briefs qui génèrent un post IG/FB. '
  'Channels enum strict canon marketing-voice.md v1.0.0 (pas de social_youtube hors scope). '
  'Defense-in-depth : SQL CHECK (invariants) + Zod DTO (valeurs) + '
  'brand-compliance-gate.service.ts (règles dynamiques — local_canon.validated, '
  'cohérence cta_ecommerce ≠ cta_local, lit __marketing_brand_rules pour rejeter '
  'briefs non conformes au canon brand voice).';

-- ── 2. __retention_trigger_rules ─────────────────────────────────────────────
-- Règles métier data-driven (cycles véhicule). Pas hardcodé code.

CREATE TABLE IF NOT EXISTS public.__retention_trigger_rules (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category                    text NOT NULL,
  min_days_since_last_order   int  NOT NULL CHECK (min_days_since_last_order >= 0),
  max_days_since_last_order   int  NOT NULL CHECK (max_days_since_last_order >= 0),
  trigger_template            text NOT NULL,
  active                      boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT retention_trigger_rules_min_lt_max
    CHECK (min_days_since_last_order < max_days_since_last_order),

  CONSTRAINT retention_trigger_rules_category_template_unique
    UNIQUE (category, trigger_template)
);

CREATE INDEX IF NOT EXISTS idx_retention_rules_active_category
  ON public.__retention_trigger_rules (active, category)
  WHERE active = true;

DROP TRIGGER IF EXISTS trg_retention_rules_updated_at ON public.__retention_trigger_rules;
CREATE TRIGGER trg_retention_rules_updated_at
  BEFORE UPDATE ON public.__retention_trigger_rules
  FOR EACH ROW EXECUTE FUNCTION public.fn_marketing_brief_updated_at();

ALTER TABLE public.__retention_trigger_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retention_rules_service_role_all ON public.__retention_trigger_rules; -- APPROVED: idempotent recreate, policy redefined immediately below (no access gap)
CREATE POLICY retention_rules_service_role_all
  ON public.__retention_trigger_rules
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.__retention_trigger_rules FROM anon, authenticated;

COMMENT ON TABLE public.__retention_trigger_rules IS
  'ADR-036 Phase 1 — Règles métier data-driven cycles véhicule (freinage, vidange, batterie, filtres). '
  'Lues par customer-retention-agent pour générer briefs RETENTION ciblés temporellement. '
  'CRUD admin via /admin/marketing/retention-rules — jamais hardcodé en code.';

-- Seed initial : 4 cycles véhicule canon (sources : maintenance constructeur usuelle)
-- ON CONFLICT DO NOTHING : idempotent en relance.
INSERT INTO public.__retention_trigger_rules
  (category, min_days_since_last_order, max_days_since_last_order, trigger_template)
VALUES
  ('freinage',          180, 365,  'controle_freinage'),
  ('vidange',           270, 365,  'rappel_vidange'),
  ('batterie',          1095, 1825, 'remplacement_batterie'),
  ('filtres_habitacle', 365,  540,  'changement_filtre_habitacle')
ON CONFLICT (category, trigger_template) DO NOTHING;

-- ── 3. ___xtr_customer.cst_marketing_consent_at (RGPD) ───────────────────────
-- Champ RGPD non-négociable. Backfill = NULL (consentement non rétroactif CNIL).
-- Index partiel : seuls les users consentants comptent dans les queries RETENTION.

ALTER TABLE public.___xtr_customer
  ADD COLUMN IF NOT EXISTS cst_marketing_consent_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_xtr_customer_marketing_consent
  ON public.___xtr_customer (cst_marketing_consent_at)
  WHERE cst_marketing_consent_at IS NOT NULL;

COMMENT ON COLUMN public.___xtr_customer.cst_marketing_consent_at IS
  'ADR-036 Phase 1 — Timestamp consentement marketing explicite (RGPD non-négociable). '
  'NULL = pas consentant → exclu de toute query RETENTION (filtre dur DTO Zod + WHERE clause). '
  'Backfill = NULL (consentement non rétroactif). Set/unset par UI compte/profil/checkout.';

-- (Pas de COMMIT inline : la transaction est ouverte et fermée par le caller —
-- voir header §"Transaction".)

-- ── Tests négatifs (cf. apply-migration-marketing-phase1.py --test-negative) ──
-- Doivent ÉCHOUER (CHECK constraint violation) :
--
--   -- 1. business_unit invalide
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('t', 'INVALID', 'gbp', 'CALL', 'x', 'y', '{}', '{}');
--
--   -- 2. LOCAL + website_seo (incohérent)
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('t', 'LOCAL', 'website_seo', 'CALL', 'x', 'y', '{}', '{}');
--
--   -- 3. ECOMMERCE + gbp (incohérent)
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('t', 'ECOMMERCE', 'gbp', 'CALL', 'x', 'y', '{}', '{}');
--
--   -- 4. social_youtube (hors canon Phase 1, doit fail le CHECK channel)
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('t', 'ECOMMERCE', 'social_youtube', 'ORDER', 'x', 'y', '{}', '{}');
--
--   -- 5. HYBRID sans hybrid_reason (a target_zone, manque hybrid_reason)
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('t', 'HYBRID', 'email', 'CALL', 'x', 'y',
--           '{"target_zone":"93","cta_ecommerce":"a","cta_local":"b","conversion_goal_ecommerce":"ORDER","conversion_goal_local":"VISIT"}',
--           '{}');
--
--   -- 6. HYBRID sans target_zone (a hybrid_reason, manque target_zone)
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('t', 'HYBRID', 'email', 'CALL', 'x', 'y',
--           '{"hybrid_reason":"r","cta_ecommerce":"a","cta_local":"b","conversion_goal_ecommerce":"ORDER","conversion_goal_local":"VISIT"}',
--           '{}');
--
--   -- 7. retention min >= max
--   INSERT INTO __retention_trigger_rules (category, min_days_since_last_order, max_days_since_last_order, trigger_template)
--   VALUES ('test', 100, 50, 'test_template');
--
-- Doivent RÉUSSIR :
--
--   -- 8. brief LOCAL+gbp valide
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('local-business-agent', 'LOCAL', 'gbp', 'CALL', 'Appelez le 01-XX', 'commune-bondy',
--           '{"text":"Test"}', '{"final_status":"PARTIAL_COVERAGE"}');
--
--   -- 9. brief HYBRID complet (6 clés payload présentes + length>0)
--   INSERT INTO __marketing_brief (agent_id, business_unit, channel, conversion_goal, cta, target_segment, payload, coverage_manifest)
--   VALUES ('customer-retention-agent', 'HYBRID', 'email', 'CALL', 'split', 'zone-93',
--           '{"hybrid_reason":"client zone 93 panier abandonné","target_zone":"93","cta_ecommerce":"Reprenez en ligne","cta_local":"Ou venez chercher","conversion_goal_ecommerce":"ORDER","conversion_goal_local":"VISIT"}',
--           '{"final_status":"PARTIAL_COVERAGE"}');
