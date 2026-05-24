-- =====================================================
-- Opportunity Lens — analytique manuelle
-- =====================================================
-- V1 scope (cf. spec docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.5) :
-- intersection des prompts probes-cibles (workspaces/ai-probe/prompts.yaml) avec :
--   - GSC impressions 30j (__seo_gsc_daily, partitioned table existante)
--   - Quality history faible AI-readiness (__seo_quality_history, EAV metric_name LIKE 'ai_has_%')
--   - Présence absente dans la probe AI (chargée séparément côté admin via cycles CSV)
--
-- Sortie : CSV review candidates. Triage humain ensuite.
-- =====================================================

WITH probe_targets AS (
  -- Charger les target_url depuis le Prompt Registry (workspaces/ai-probe/prompts.yaml)
  -- V1 : staticement listé ici. À automatiser quand le registry sera plus stable.
  SELECT unnest(ARRAY[
    '/symptomes-auto/fumee-noire/clio-3',
    '/symptomes-auto/turbo-hs/1-5-dci',
    '/symptomes-auto/tremblements-freinage',
    '/symptomes-auto/voyant-esp-allume',
    '/symptomes-auto/bruit-coupelle-amortisseur',
    '/symptomes-auto/fumee-blanche-demarrage-diesel',
    '/conseils-entretien/distribution/peugeot-207-1-4-hdi',
    '/conseils-entretien/huile-moteur/citroen-c4-picasso-hdi',
    '/conseils-entretien/vidange/renault-megane-1-5-dci',
    '/conseils-entretien/plaquettes-frein-usure',
    '/pieces/filtration/filtre-a-gasoil/renault/clio-3/1-5-dci',
    '/pieces/freinage/plaquettes/peugeot/208/1-4-hdi',
    '/pieces/suspension/amortisseurs/renault/clio-3',
    '/pieces/echappement/vanne-egr/renault/megane/1-5-dci',
    '/pieces/freinage/disques/peugeot/308',
    '/comparatif/oscaro-vs-mister-auto',
    '/comparatif/huile-5w30-vs-5w40',
    '/local/garage/citroen/lyon',
    '/local/specialiste/turbo-diesel/marseille',
    '/conseils-entretien/tutoriel/changer-filtre-air'
  ]) AS target_url
),
gsc_signals AS (
  -- __seo_gsc_daily : (date, page, query, device, clicks, impressions, ctr, position)
  -- Agréger 30j sur device='all' pour signaux haut-niveau
  SELECT
    page,
    SUM(impressions) AS total_impressions,
    SUM(clicks)      AS total_clicks,
    AVG(position)    AS avg_position
  FROM __seo_gsc_daily
  WHERE date >= CURRENT_DATE - INTERVAL '30 days'
    AND device = 'all'
  GROUP BY page
),
quality_signals AS (
  -- __seo_quality_history (EAV, pg_id stocke le slug) — extraire ai_has_* récents
  SELECT
    pg_id,
    MAX(role_id) AS role_id,
    MAX(CASE WHEN metric_name = 'ai_has_extractable_tldr' THEN metric_value END) AS has_tldr,
    MAX(CASE WHEN metric_name = 'ai_has_faq_schema'        THEN metric_value END) AS has_faq,
    MAX(CASE WHEN metric_name = 'ai_has_visible_sources'   THEN metric_value END) AS has_sources
  FROM __seo_quality_history
  WHERE sampled_at >= NOW() - INTERVAL '30 days'
    AND metric_name LIKE 'ai_has_%'
  GROUP BY pg_id
)
SELECT
  pt.target_url,
  COALESCE(g.total_impressions, 0)  AS impressions_30d,
  COALESCE(g.total_clicks, 0)       AS clicks_30d,
  ROUND(g.avg_position::numeric, 1) AS avg_position,
  q.has_tldr,
  q.has_faq,
  q.has_sources,
  CASE
    WHEN g.total_impressions IS NULL                                           THEN 'no-gsc-signal'
    WHEN q.has_tldr = 0 AND q.has_faq = 0                                      THEN 'high-impr-low-ai-readiness'
    WHEN g.avg_position > 10 AND (q.has_tldr = 0 OR q.has_faq = 0)             THEN 'mid-pos-improvable'
    WHEN g.total_impressions > 0 AND COALESCE(g.total_clicks, 0) = 0           THEN 'impressions-but-no-clicks'
    ELSE 'baseline'
  END AS opportunity_class
FROM probe_targets pt
LEFT JOIN gsc_signals     g ON g.page  = pt.target_url
LEFT JOIN quality_signals q ON q.pg_id = pt.target_url
ORDER BY COALESCE(g.total_impressions, 0) DESC, pt.target_url;
