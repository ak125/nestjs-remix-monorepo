# Top Priorities — Manifest machine-readable

# Format strict — éditer 1 ligne = 1 slug kebab-case. Pas de prose.
# Bornes (anti-bloat mécanique, enforced par validate-top-priorities.sh) :
#   TOP ≤ 5, DO_NOT_START ≤ 7, ACTIVE_INCIDENTS ≤ 10, STRUCTURAL_CONSTRAINTS ≤ 10
# Lecteurs : SessionStart hook, Stop hook, skills, CI dashboards, agents Paperclip
# Mise à jour : édit manuel git tracké, max 1×/semaine (ou pivot business)
# updated_at: 2026-05-23

## TOP
- commerce-loop-v1
- runtime-truth-p0
- runtime-truth-p1
- web-vitals-attribution-ingestion

## DO_NOT_START
- r5-diagnostic-engine
- claude-plugin-marketplace
- new-control-plane
- new-seo-platform
- new-meta-architecture-adr

## ACTIVE_INCIDENTS
- snapshot-partition-rotation-sensitive
- web-vitals-attribution-unstable

## STRUCTURAL_CONSTRAINTS
- supabase-js-1000-row-cap
- postgrest-stable-function-write
- dev-runtime-not-auto-updated-on-merge
- node-22-required-for-architecture-build
