---
scope: Ops / Cleanup safety
audience: human + Claude
sources:
  - scripts/cleanup/validate-before-delete.sh
  - audit-reports/phase0-baseline.json
last_scan: 2026-04-24
---

# Safe Delete Procedure

> **Règle cardinale** : `knip` dit "unused" ≠ "safe to delete". 15-20 % des
> flags sont des faux positifs (chargement dynamique, DI NestJS, ZodSchema
> invoqué par nom, convention flat-routes Remix). Cette procédure transforme
> un signal knip en décision vérifiée.

## Procédure en 4 étapes

### 1. Sélectionner un candidat

Lister avec :
```bash
npm run audit:knip 2>&1 | awk '/^Unused files/{f=1;next} /^Unused (dep|export|type)|^Unlisted|^Duplicate/{f=0} f'
```

Ou consulter directement `.claude/knowledge/ops/cleanup-targets.md` → section "Obsolètes évidents" / "Dead frontend components".

### 2. Valider avec le safety probe

```bash
./scripts/cleanup/validate-before-delete.sh <path>
```

Exemple :
```bash
./scripts/cleanup/validate-before-delete.sh backend/analyze-options.js
# VERDICT: SAFE TO DELETE

./scripts/cleanup/validate-before-delete.sh backend/src/modules/payments/services/paybox.service.ts
# VERDICT: BLOCKED (6 references found)
```

Le script vérifie **6 canaux** :
1. Imports statiques / dynamiques (stem de fichier)
2. `@Module({ providers | imports | exports | controllers: [...] })` (classe DI NestJS)
3. Strings `"path/to/file"` ou `"basename.ts"` dans le code / configs / YAML
4. Routes Remix (`frontend/app/routes/` = auto-loaded, DO NOT DELETE)
5. Références dans `.claude/knowledge/` et `.claude/rules/`
6. Migrations Supabase `.sql`

### 3. Agir selon le verdict

**SAFE** → procéder :
```bash
git rm <path>
npm run typecheck      # MUST PASS
npm run build          # MUST PASS
npm test               # MUST PASS (au moins backend + frontend suites)
git commit -m "chore(cleanup): remove <path>"
```

**BLOCKED** → triage :
- **Cas A — reference elle-même dead** : supprimer la référence d'abord (cleanup bottom-up), puis re-tenter. Exemple : `X.ts` est importé par `Y.ts` qui est flaggé unused → supprimer `Y` d'abord.
- **Cas B — reference légitime** : `validate-before-delete.sh` a raison, garder `X.ts`. Documenter dans `.claude/knowledge/ops/cleanup-targets.md` avec status `wontfix (<raison>)`.

### 4. Batch + regression gate

Les PRs de cleanup doivent :
- **Rester petites** (5 à 30 fichiers par PR max pour review fluide)
- **Regrouper par cohérence** (ex : tout `frontend/app/components/admin/` dans 1 PR, pas mélanger avec `/cart/`)
- **Ne pas régresser la baseline** : le CI `audit.yml` lance `audit:baseline` qui bloque si les counts régressent au-delà des seuils.

Après merge d'une PR cleanup, le mainteneur refresh la baseline :
```bash
npm run audit:baseline:json > /tmp/current.json
# Merge manually the "current" numbers into audit-reports/phase0-baseline.json
git commit -m "chore(baseline): refresh after #XXX cleanup"
```

## Limites honnêtes de `validate-before-delete.sh`

**Ne détecte PAS** :
- Chargement via `require(dynamicPath)` où `dynamicPath` est construit runtime
- DI NestJS custom providers via `useFactory` / `useClass` passé par variable
- Routes Angular / custom frameworks qui scannent le FS
- Références dans Docker volumes / CI workflows tiers

**Toujours** confirmer avec `npm run build` + `npm test` avant push. Le gate
finale est le runtime, pas le grep.

## Anti-patterns

- ❌ Supprimer **en batch** sans passer par `validate-before-delete.sh`
- ❌ Ignorer un BLOCKED en argumentant "je connais, c'est safe"
- ❌ Supprimer un fichier sous `frontend/app/routes/` (convention-loaded par Remix)
- ❌ Commit sans `npm test` passant
- ❌ PR qui mélange cleanup + refactor + feature — scope séparé

## Références

- Script : `scripts/cleanup/validate-before-delete.sh`
- Baseline numérique : `audit-reports/phase0-baseline.json`
- Backlog : `.claude/knowledge/ops/cleanup-targets.md`
- Cycles : `.claude/knowledge/ops/cycle-resolution-playbook.md`
- Rule similaire (vault) : `feedback_internal_ids.md` — principe "toujours passer par la couche de mapping canonique"
