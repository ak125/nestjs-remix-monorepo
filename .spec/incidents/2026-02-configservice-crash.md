# Incident: AdminKeywordClustersController crash au demarrage

**Date:** 2026-02-23
**Severite:** DEV (pas de downtime prod)
**Duree resolution:** ~20 min

## Symptome

Backend NestJS refuse de demarrer :

```
Error: supabaseKey is required
```

Suivi de :

```
TS2339: Property 'serviceRoleKey' does not exist on type '{ url: string; serviceKey: string; anonKey: string; }'
```

## Cause racine

Le controller `AdminKeywordClustersController` utilisait `getAppConfig()` dans son constructeur :

```typescript
constructor() {
  const config = getAppConfig();
  this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
}
```

Deux problemes :

1. `getAppConfig()` lit `process.env` directement — dans un constructeur NestJS, les env vars injectees par `ConfigService` ne sont pas encore disponibles
2. `AppConfig.supabase` a `serviceKey`, pas `serviceRoleKey`

## Fix

Remplacer par injection `ConfigService` (pattern standard NestJS) :

```typescript
constructor(private readonly configService: ConfigService) {
  const url = this.configService.get<string>('SUPABASE_URL');
  const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
  this.supabase = createClient(url!, key!);
}
```

## Complication: dist/ stale

Apres le fix dans `src/`, le crash persistait car `dist/` contenait l'ancien code compile.
Le watcher TypeScript n'avait pas recompile. Fix :

```bash
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --build --force
```

Note : sans `--max-old-space-size=4096`, le build OOM sur ce monorepo.

## Prevention

1. **Ne jamais utiliser `getAppConfig()` dans un constructeur** de controller ou service NestJS — toujours injecter `ConfigService`
2. **Si un fix source ne prend pas effet**, verifier que `dist/` est a jour : `npx tsc --build --force`
3. Le pattern correct est documente dans `SupabaseBaseService` qui recoit `ConfigService` via `super(configService)`
