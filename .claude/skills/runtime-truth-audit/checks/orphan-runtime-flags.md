---
check: orphan-runtime-flags
severity: medium
confidence: low
expected_false_positive_rate: 0.35
autofixable: false
sources:
  - backend/.env.example
  - backend/src/**/*.ts (grep process.env / configService.get)
  - frontend/.env.example
  - frontend/app/**/*.{ts,tsx} (grep import.meta.env / VITE_*)
risk_documented:
  - feedback_more_seo_engineering_not_equal_more_business.md
  - feedback_v1_first_dont_build_ultimate_engine_too_early.md
---

# Check : Orphan Runtime Flags

## Pattern audité

Variables d'environnement et feature flags déclarés mais **jamais lus en
runtime** :

1. Entry dans `.env.example` sans `process.env.X` / `configService.get('X')` /
   `import.meta.env.X` correspondant côté code.
2. Variable `FEATURE_*` / `*_FLAG` / `*_ENABLED` lue 0 fois après scan AST.
3. (Optionnel V2) Flag GrowthBook déclaré côté plateforme externe mais
   sans handler runtime correspondant.

**Impact business** : flags morts accumulent du bruit cognitif, masquent
les flags actifs, et peuvent réintroduire des comportements obsolètes si
re-câblés par inadvertance.

## Origine

Check **préventif** — pas d'incident PROD documenté à ce jour pour ce
pattern dans le monorepo, mais [feedback_v1_first_dont_build_ultimate_engine_too_early.md](feedback_v1_first_dont_build_ultimate_engine_too_early.md)
+ [feedback_more_seo_engineering_not_equal_more_business.md](feedback_more_seo_engineering_not_equal_more_business.md)
documentent le risque général d'accumulation de surfaces mortes en
monorepo gouverné. Audit déterministe = anti-bloat mécanique.

**Note** : ce check accepte un FPR élevé (≤ 0.35) car heuristique (regex
sur naming). C'est intentionnel : `severity: medium` + `confidence: low`
signale que les findings doivent passer par review humaine, pas en CI.

## Méthode

1. Parser `backend/.env.example` et `frontend/.env.example` → set de
   variables déclarées.
2. Pour chaque variable `V` :
   a. Grep `backend/src/**/*.ts` pour
      `process\.env\.V\b|configService\.get\(['"]V['"]\)|envContract\.V\b`.
   b. Si frontend var (`VITE_*`) : grep `frontend/app/**/*.{ts,tsx}` pour
      `import\.meta\.env\.V\b`.
   c. Compter les occurrences. Si 0 → finding `declared_unused`.
3. Pour les variables matching pattern `FEATURE_*|*_FLAG|*_ENABLED`,
   sortir avec un severity bump si findings (les flags morts sont
   particulièrement coûteux cognitivement).

## Sortie attendue (JSON)

```json
{
  "check": "orphan-runtime-flags",
  "pass": false,
  "findings": [
    {
      "variable": "OLD_R5_FALLBACK_ENABLED",
      "declared_in": "backend/.env.example",
      "grep_count": 0,
      "category": "declared_unused",
      "severity": "medium",
      "fix_hint": "DROP de .env.example si vraiment mort, ou rebrancher si rollout en cours"
    }
  ],
  "summary": { "declared": 87, "orphans": 1, "flag_orphans": 1 }
}
```

## Faux positifs connus

- Variables lues uniquement dans un fichier `.json`/`.yaml` config (CI,
  docker-compose, k8s). Mitigation : étendre le grep aux extensions
  pertinentes via flag explicite ou exclusion list.
- Variables lues dynamiquement via `process.env[varName]` avec `varName`
  construit. Détection impossible — accepter le FPR.
- Variables documentées dans `.env.example` mais ENV "well-known"
  jamais explicitement lue (NODE_ENV est utilisé par Node lui-même).
  Mitigation : whitelist `WELL_KNOWN_ENVS = ["NODE_ENV", "PORT", "DATABASE_URL"]`.

## Limites

- Heuristique pure naming + grep. FPR ≥ 0.30 attendu en V1.
- N'audite pas la **valeur** des flags (un flag déclaré `false` partout
  est syntaxiquement vivant mais sémantiquement mort — V2).
- Pas de détection GrowthBook (V2 si pertinent).

## Action recommandée pour les findings

1. Pour `category: declared_unused` + variable claire (`OLD_*`, `LEGACY_*`,
   `*_DEPRECATED`) : DROP de `.env.example`.
2. Pour flags ambigus : reviewer-decide, vérifier d'abord l'historique
   git (`git log -S "VAR_NAME" --all`) pour comprendre l'intention.
3. Ne jamais auto-supprimer (autofixable=false strict).
