# Supabase Data API — Politique d'exposition (PostgREST/GraphQL)

> Note interne consécutive à la newsletter Supabase mai 2026 (Data API auto-expose désactivé par défaut sur les nouveaux projets dès 2026-05-30). **Ce document n'est pas un ADR** — il documente une politique externe et le pattern à appliquer si un nouveau projet Supabase est créé.

## Pourquoi

À partir du 2026-05-30, Supabase exige des `GRANT` Postgres explicites pour qu'une table ou une fonction du schéma `public` soit joignable via PostgREST (`/rest/v1/...`) ou GraphQL (`/graphql/v1`). Aucun changement sur les projets antérieurs — c'est uniquement la valeur par défaut à la création qui change.

Cibles concernées dans ce monorepo :
- Backend NestJS : ~1 712 appels `supabase.from()` + ~19 `supabase.rpc()` (côté Data Services).
- Frontend React Router : services `frontend/app/services/api/` qui consomment l'API NestJS (donc indirectement la Data API).
- 3 appels directs `/rest/v1/` (auth.service.ts, admin-health.service.ts, users.controller.ts).

## État actuel

| Projet | Date création | Auto-expose | Action requise |
|--------|---------------|-------------|----------------|
| PROD (existant) | < 2026-04-28 | ON (legacy) | Aucune. Code 100% compatible. |
| Nouveau projet (futur) | ≥ 2026-05-30 | OFF par défaut | Migration baseline obligatoire (snippet ci-dessous). |

Pas de Branching adopté actuellement (cf. `feedback_supabase_cost_traps`). Pas de fork staging. Pas de tenant secondaire.

## Snippet baseline pour tout nouveau projet

À inclure comme PREMIÈRE migration (`supabase migration new baseline_grants`) :

```sql
-- 1. Exposer les entités existantes du schéma public
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 2. Filet : exposer les FUTURES tables/fonctions créées après ce GRANT
--    Sans ALTER DEFAULT PRIVILEGES, la première nouvelle migration casse
--    silencieusement (drift à retardement non attrapé en CI initial).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
```

Adapter selon les rôles :
- `service_role` : NestJS server (bypass RLS, déjà `GRANT ALL` natif Supabase).
- `anon` : React Router 8 SSR public, requêtes non authentifiées.
- `authenticated` : React Router 8 SSR avec session utilisateur.

Restreindre à des tables spécifiques (`GRANT SELECT ON public.pieces, public.__seo_*`) si RLS-strict ou compliance audit requis — `ALL TABLES` reste un raccourci pratique mais expose tout au PostgREST.

## ⚠️ GRANT ≠ RLS — distinction critique

| Mécanisme | Rôle | Effet |
|-----------|------|-------|
| `GRANT SELECT ON public.X TO anon` | Visibilité Data API | L'entité `public.X` devient joignable via `/rest/v1/X` |
| `CREATE POLICY ... ON public.X FOR SELECT TO anon USING (...)` | Filtre runtime RLS | Filtre les lignes/colonnes effectivement renvoyées |

**Important** : `GRANT` ne bypass pas RLS. Postgres exécute toujours les politiques RLS si elles existent. MAIS si **aucune politique** n'est définie sur la table et que RLS est `ENABLED`, le rôle `anon` ne voit rien (deny-by-default RLS). À l'inverse, si RLS est `DISABLED` sur une table et qu'on fait `GRANT SELECT TO anon`, **toutes les lignes sont publiques**.

Pattern attendu sur ce monorepo : RLS ENABLED + politiques explicites par rôle. Vérifier après chaque `GRANT` :

```sql
SELECT schemaname, tablename, rowsecurity, hasoids
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'X';

SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'X';
```

Pas de `pg_policies` rows + `rowsecurity = true` → la table est visible mais zéro ligne ne sort. C'est le mode strict-deny par défaut.

## Pré-flight checklist nouveau projet

Avant tout `git push` sur un projet avec un `SUPABASE_URL` ≠ PROD actuel :

1. [ ] Dashboard Supabase → **Settings → Data API → Exposed schemas** : `public` listé.
2. [ ] Migration baseline `GRANT … + ALTER DEFAULT PRIVILEGES` appliquée.
3. [ ] `pg_policies` vérifié pour les tables nouvellement exposées (RLS coverage).
4. [ ] Smoke test runtime : un `supabase.from('pieces').select('id').limit(1)` ne retourne pas `relation does not exist`.

## Backlog (non bloquant — à implémenter sur premier incident, pas avant)

`scripts/check-supabase-api-exposure.ts` : guard CI optionnel qui croise les `.from('table_x')` / `.rpc('fn_x')` du backend (AST grep) avec les `pg_class` + `pg_proc` du projet pour détecter :
- Entités appelées par client mais sans `GRANT` correspondant → erreur runtime garantie.
- `GRANT` sur des entités non utilisées → exposition inutile (review attaquant-surface).

Justification "pas maintenant" : le projet PROD existant n'est pas affecté (zéro risque immédiat), et 1 712 sites d'usage rendent toute introduction d'un guard non-trivial. À considérer si/quand un nouveau projet Supabase est effectivement créé OU si un premier incident de drift apparaît.

## Références

- Newsletter Supabase Update May 2026 (reçue automecanik.seo@gmail.com 2026-05-09).
- GitHub Discussion lien dans la newsletter (Supabase officiel).
- Mémoire feedback : `feedback_supabase_grant_explicit_for_new_projects.md`.
- Mémoire connexe : `feedback_supabase_cost_traps.md`, `supabase-cleanup-2026-03.md`.
