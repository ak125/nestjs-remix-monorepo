# `SeoShadowObservatoryModule` — observabilité shadow réutilisable

> **Statut** : livré dans PR-6 (seo-v9). Premier usage : R7 (`brand-rpc`) + R8 (`vehicle-rpc`).
> **ADR vault associée** : `ADR-054 SEO Shadow Mode Architecture` (à ouvrir post-merge).
> **Plan** : `home/.claude/plans/pr-6-r7-brand-rpc-fancy-blum.md`.

## Vue d'ensemble

Le module observe en **shadow** (audit silencieux, sans mutation) les divergences
entre la sortie SEO **legacy** (RPC bake `__seo_marque` / `__seo_r8_pages` / etc.)
et la sortie **chain** (`SeoChainOrchestratorService`, PR-2c). Les divergences
sont :

- **Persistées** dans `__seo_event_log` (`event_type='anomaly_detected'`,
  `payload.subtype='seo.shadow.<r>.divergence'`) — queryable SQL.
- **Émises sur Sentry** (level `warning`) lorsque `policy_divergence=true`
  (canonical ou robots divergent).
- **Hashées** (sha256 12 hex) — aucune URL canonical brute en log, cardinalité
  maîtrisée.

## Garanties

| Garantie | Mécanisme |
|---|---|
| Chemin réponse non bloquant | `observe()` est sync ; le travail réel court via `setImmediate`. Lint ast-grep `.ast-grep/rules/seo-shadow-no-await.yml` interdit `await` sur l'API. |
| Aucune mutation de la réponse | Le module n'expose **aucune** API qui modifie le payload servi. Aucune branche `mode === 'on'` dans le code livré. |
| Sampler déterministe | `sha1(surface:entityId)` — même entité = même décision pour un sample-rate fixe. Reproductibilité tests. |
| Boot guard `mode=on` | `onModuleInit` throw si `SEO_CHAIN_R*_MODE=on` détecté → container ne boot pas (PR-6 ne livre pas la branche on). |
| Circuit breaker | > 50 timeouts/60s sur `SeoShadowChainRunner.compute()` → breaker ouvert, `observe()` skip silencieux. Empêche l'accumulation de `setImmediate` callbacks pendant un slowdown Supabase. |
| Couplage minimal | Seul `SeoShadowChainRunner` importe `SeoModule`. Sampler / Normalizer / DiffEngine / Sink / PurgeCron sont purs. |

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  Caller (BrandRpcService, VehicleRpcService, futurs PR-8/12 R0/Blog)   │
│      this.shadowObservatory.observe({...});  ← sync, return immédiat   │
│      return legacyPayload;                                             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ setImmediate (vraie fire-and-forget)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│  SeoShadowObservatory (public)                                         │
│   ├─ Zod parse input (fail-fast, no-op si invalide)                    │
│   ├─ shouldObserve()  → SeoShadowSampler                               │
│   ├─ isCircuitOpen()  → recentTimeouts                                 │
│   └─ runComparison()                                                   │
│        ├─ chainRunner.compute()  → SeoShadowChainRunner (timeout 2s)   │
│        ├─ diffEngine.compare()   → SeoShadowDiffEngine (+ R8 skip)     │
│        └─ sink.write()           → SeoShadowEventSink                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
        __seo_event_log JSONB                Sentry.captureMessage
        (queryable SQL, retention 30j)       (warning, withScope)
```

## Comment lire les divergences (queries SQL types)

```sql
-- Bilan 7j par surface (décide go/no-go pour le flip mode=on futur)
SELECT
  payload->>'surface' AS surface,
  count(*) FILTER (WHERE payload->>'policy_divergence' = 'true') AS policy_div,
  count(*) AS total
FROM __seo_event_log
WHERE event_type = 'anomaly_detected'
  AND payload->>'subtype' LIKE 'seo.shadow.%.divergence'
  AND created_at > now() - interval '7 days'
GROUP BY 1;

-- Top 10 divergences canonical R7 (pour debug)
SELECT
  payload->>'entity_id'                AS brand_id,
  entity_url,
  payload->'diffs'                     AS field_diffs
FROM __seo_event_log
WHERE event_type = 'anomaly_detected'
  AND payload->>'subtype' = 'seo.shadow.r7.divergence'
  AND payload->>'policy_divergence' = 'true'
ORDER BY created_at DESC
LIMIT 10;
```

## Comment brancher un nouveau surface (checklist)

Pour ajouter R0 (PR-8), Blog (PR-12), R3, etc. :

1. **Vérifier le SurfaceKey** dans `@repo/seo-role-contracts/surface-keys` (déjà 16 surfaces déclarées).
2. **Ajouter le slug** dans `SURFACE_SUBTYPE` de `seo-shadow-event-sink.service.ts` :
   ```ts
   const SURFACE_SUBTYPE: Partial<Record<SurfaceKey, string>> = {
     R7_BRAND_HUB: 'seo.shadow.r7.divergence',
     R8_VEHICLE: 'seo.shadow.r8.divergence',
     R0_HOME: 'seo.shadow.r0.divergence',  // ← nouveau
   };
   ```
3. **Mapper le flag** dans `SURFACE_TO_FLAG` de `seo-shadow-observatory.service.ts` :
   ```ts
   const SURFACE_TO_FLAG: Partial<Record<SurfaceKey, SeoChainFlagKey>> = {
     R7_BRAND_HUB: 'R7',
     R8_VEHICLE: 'R8',
     R0_HOME: 'HOME',  // ← nouveau (flag déjà déclaré dans SeoFeatureFlagRegistry)
   };
   ```
4. **Ajouter un cas** dans `SeoShadowChainRunner.adaptInput()` :
   ```ts
   case 'R0_HOME':
     return {
       surfaceKey: surface,
       pgId: 0,
       typeId: 0,
       variables,
       ids: { staticPath: '/' },
       baseUrl: SeoShadowChainRunner.BASE_URL,
       requestedUrl: requestUrl,
       breadcrumbs: [],
     };
   ```
5. **Si redirect logic frontend non reproduit** (cas R8) : ajouter le `skip` dans `SeoShadowDiffEngine.compareCanonical()` avec `skip_reason` documenté.
6. **Brancher le caller** :
   ```ts
   this.shadowObservatory.observe({
     surface: 'R0_HOME',
     legacy: homePayload.seo,
     requestUrl: req.url,
     ids: { staticPath: '/' },
     vars: { /* depuis le payload */ },
     entityId: 'home',
   });
   ```
7. **Tests** : ≥ 4 cas par surface (off, sample false, sample true OK, sample true throw) — voir `seo-shadow-observatory.test.ts` pour le pattern.
8. **Mettre à jour ce README** avec l'entrée "Comment brancher" ci-dessus.

## Bumping `schema_version`

Si le format de `payload.diffs[*]` ou la structure générale change :

1. Incrémenter `SeoShadowEventSink.SCHEMA_VERSION` (de `1` à `2`).
2. Documenter le changelog dans ce README (section "Schema versions").
3. L'ETL doit lire `payload->>'schema_version'` pour disambiguïser et appliquer
   la bonne déserialisation.

## Schema versions

| Version | PR | Date | Changelog |
|---|---|---|---|
| 1 | PR-6 | 2026-05-08 | Format initial : `{schema_version, subtype, surface, entity_id, divergence_types[], policy_divergence, diffs[], observed_at}`. R7+R8 wirés. R8 canonical skip. |

## Limites connues

- **R8 canonical comparison désactivée** (`skip_reason: 'r8_frontend_redirect_logic_not_reproduced'`).
  Le frontend Remix R8 applique un redirect 301 (`marque_alias-marque_id`) que le
  backend ne reproduit pas. `policy_divergence` R8 reste piloté par `robots_eq`
  uniquement. Issue follow-up à ouvrir post-merge pour reproduire le redirect.
- **PR-3 (RM) et PR-5 (gamme-rest)** utilisent encore le pattern shadow inline
  (`await chainSeo` bloquant + branche `mode === 'on'` exposée). Issue follow-up
  pour retrofit sur ce module.
- **`@Cron` décorateur** : `ScheduleModule` est désactivé dans le monorepo (cf.
  `app.module.ts:150-153`). Le `SeoShadowPurgeCron.purgeOldEvents()` doit être
  déclenché par crontab système + curl admin endpoint, ou ré-activer
  ScheduleModule. Documenté dans la classe.

## Cron purge `__seo_event_log`

`SeoShadowPurgeCron.purgeOldEvents()` supprime quotidiennement les observations
shadow > 30 jours. WHERE clause : `payload->>'subtype' LIKE 'seo.shadow.%.divergence'`.
**Ne touche aucun autre consommateur** de `__seo_event_log`. Respecte
`READ_ONLY=true` (gate au processor — cf. mémoire
`feedback_readonly_gate_at_processor_not_scheduler`).

## Defense-in-depth

| Couche | Mécanisme |
|---|---|
| Zod env | `SEO_CHAIN_R*_MODE=tru` (typo) → boot fail. |
| Boot guard | `mode=on` détecté → `throw` → container ne boot pas. |
| CI guard | `.github/workflows/seo-shadow-flag-guard.yml` refuse `SEO_CHAIN_R*_MODE=on` dans `.env*` / `docker-compose*` / workflows / secrets. |
| ADR | `ADR-054` (vault) formalise le sign-off pour le flip futur. |

Trois modifications coordonnées (code + ADR + ENV) sont nécessaires pour activer
`mode=on` en prod.

## ENV vars

| Variable | Default | Description |
|---|---|---|
| `SEO_CHAIN_R7_MODE` | `off` | `off` / `shadow` / `on`. PR-6 accepte uniquement `off` ou `shadow`. |
| `SEO_CHAIN_R8_MODE` | `off` | Idem R7. |
| `SEO_CHAIN_SHADOW_SAMPLE_RATE` | `0.01` | Taux d'échantillonnage \[0..1\]. **Conservateur en preprod** ; augmenter à `0.05` ou `0.1` après 24h si volume `__seo_event_log` soutenable. |
| `READ_ONLY` | _absent_ | `true` → `SeoShadowPurgeCron` no-op (cohérent avec ADR-028 read-only hardening). |
