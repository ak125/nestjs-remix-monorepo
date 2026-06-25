-- Migration : extend seo_event_type ENUM avec 'seo_placeholder_unresolved'.
--
-- A1a-observe (plan R* contenu, Phase 3 SEO_RUNTIME_FOUNDATION). Rend
-- OBSERVABLES deux replis runtime jusqu'ici silencieux du SEO V4 :
--   - le strip des marqueurs `#X#` non résolus (cleanContent) ;
--   - le fallback `generateDefaultSeo`.
-- Réutilise __seo_event_log existant au lieu d'une table parallèle (canon
-- feedback_no_external_canary_when_internal_observability_exists).
--
-- Pattern idempotent NOT EXISTS (retry-safe), aligné sur
-- 20260528_seo_event_runtime_errors.sql — pas de schema change __seo_event_log,
-- juste une extension ENUM dans un DO bloc PL/pgSQL.
--
-- OWNER-GATE (déploiement) : cet ADD VALUE doit être appliqué à la DB partagée
-- AVANT le déploiement du code emitter. Sinon le 1er insert échoue — fail-safe :
-- l'erreur est loggée et la page se rend quand même (l'event n'est pas
-- enregistré tant que l'ENUM n'est pas appliqué). Cf .claude/rules/deployment.md
-- axe 4 (migrations DB non auto-appliquées à la DB partagée).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'seo_placeholder_unresolved'
          AND enumtypid = 'seo_event_type'::regtype
    ) THEN
        ALTER TYPE seo_event_type ADD VALUE 'seo_placeholder_unresolved';
    END IF;
END $$;
