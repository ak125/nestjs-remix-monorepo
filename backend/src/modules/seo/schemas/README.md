# `seo/schemas/`

Zod response schemas for SEO/admin endpoints (PR-2 boundary).

## Convention

One schema file per controller endpoint. Pattern :

```typescript
// my-endpoint.response.schema.ts
import { z } from 'zod';
import { tolerantRoleSchema, canonicalRoleSchema } from '@repo/seo-roles';

export const myEndpointResponseSchema = z.object({
  role: tolerantRoleSchema,   // accepts legacy DB inputs, transforms to canonical
  // ...other fields
});

export type MyEndpointResponse = z.infer<typeof myEndpointResponseSchema>;
```

In the controller :

```typescript
@Controller('api/admin/...')
export class MyController {
  @Get(':id')
  async getOne(): Promise<MyEndpointResponse> {
    const raw = await this.service.findOne(...);
    return parseResponseOrSoft(
      myEndpointResponseSchema,
      raw,
      { controller: MyController.name, endpoint: 'getOne' },
      this.logger,
    ) as MyEndpointResponse;
  }
}
```

## Rules

- **Use `tolerantRoleSchema`** for fields populated from DB (DB may contain legacy values like `R3_BLOG`, `R3_guide_howto`)
- **Use `canonicalRoleSchema`** for fields that MUST be canonical (e.g. when re-exposing a normalized value)
- **Pas de Pipe NestJS sur outputs** : Pipes opèrent sur les arguments d'entrée. Pour valider la réponse, utiliser `parseResponseOrSoft` (Option A) explicitement, ou un Interceptor typé (Option B, voir PR-2-bis si la répétition devient pénible)
- **Pas d'interceptor walker générique** : chaque schema déclaré explicitement par le caller, pas de regex sur les clés de l'objet

## Observability

`parseResponseOrSoft` instruments :

- `seo_role_normalization_failed_total{controller,endpoint}` — increments on parse failure (soft mode)
- `seo_role_normalize_response_disabled_total{controller,endpoint}` — increments when `SEO_ROLE_NORMALIZE_RESPONSE=false` kill switch is active
- Pino structured warning logs per failure (queryable via LogQL)

## Strict mode

Set `SEO_ROLE_STRICT=true` in DEV / CI to throw on parse failure instead of soft fallback. Wired in `.github/workflows/ci.yml` test job.

## Kill switch

Set `SEO_ROLE_NORMALIZE_RESPONSE=false` in production to disable normalization entirely (returns raw). Use only in incident response — the failure counter still tracks it.
