---
check: nest-dead-services
severity: high
confidence: medium
expected_false_positive_rate: 0.20
autofixable: false
sources:
  - audit/registry/canonical.json
  - backend/src/**/*.ts
  - backend/src/**/*.module.ts
incidents_proven:
  - "#696 (2026-05-22, OrderStatusService/Controller doublon mort retiré — F3 audit runtime-truth)"
---

# Check : NestJS Dead Services

## Pattern audité

Services NestJS marqués `@Injectable()` mais **jamais résolus par le DI
container** : pas de `providers: [X]` actif dans un `*.module.ts` chargé,
ou module chargé uniquement en sous-arbre mort (module parent non importé
par AppModule).

## Origine

PR #696 (2026-05-22) a retiré `OrderStatusService` + `OrderStatusController`
détectés morts manuellement après plusieurs semaines de coexistence avec
le service vivant. Sans audit déterministe, ce type de doublon se découvre
par accident.

## Méthode

1. Lister tous les `@Injectable()` dans `backend/src/**/*.ts` (grep AST).
2. Pour chaque classe `X`, vérifier :
   a. `providers: [..., X, ...]` dans un `*.module.ts` du repo.
   b. Ce module est-il dans la chaîne `imports:` partant de `AppModule` ?
3. Si `X` n'est dans aucun `providers:` actif → finding `dead-service`.
4. Si `X` est dans `providers:` mais le module n'est jamais importé →
   finding `dead-module` (severity high aussi).

## Sortie attendue (JSON)

```json
{
  "check": "nest-dead-services",
  "pass": false,
  "findings": [
    {
      "file": "backend/src/modules/orders/orphan.service.ts",
      "class": "OrphanService",
      "reason": "Not in any providers[] of an imported module",
      "severity": "high"
    }
  ],
  "summary": { "scanned": 412, "dead": 1, "dead_modules": 0 }
}
```

## Faux positifs connus

- Services exportés dans un package interne (`packages/**`) consommés par
  un autre app worktree non scanné. Mitigation : marker `@PublicAPI()` ou
  exclusion via path glob.
- Services en cours de migration progressive (flag de bascule). Mitigation :
  vérifier `# wip:` commentaire dans le fichier (à formaliser plus tard).

## Limites

- N'audite pas les services injectés par `useFactory` ou `useExisting`
  dynamique. À documenter explicitement dans `summary.skipped`.
- N'audite pas le frontend Remix (pas de DI NestJS).
