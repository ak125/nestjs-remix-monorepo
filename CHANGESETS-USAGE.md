# 📦 Changesets - Guide d'utilisation

## Workflow de versioning

### 1. Après avoir fait des changements

```bash
npm run changeset
```

Cela va :
1. Vous demander quels packages ont changé
2. Vous demander le type de changement (major/minor/patch)
3. Créer un fichier `.changeset/xxx.md` avec la description

### 2. Créer une version

```bash
npm run changeset:version
```

Cela va :
1. Lire tous les changesets en attente
2. Bump les versions dans `package.json`
3. Mettre à jour les `CHANGELOG.md`
4. Supprimer les changesets consommés

### 3. Publier sur npm

```bash
npm run changeset:publish
```

Cela va :
1. Build tous les packages
2. Publier sur npm registry
3. Créer des tags git

## Types de changements

- **patch** (0.0.X) : Bug fixes, petites améliorations
- **minor** (0.X.0) : Nouvelles fonctionnalités, backward compatible
- **major** (X.0.0) : Breaking changes

## Linked packages

Les 5 packages Design System sont linkés :
- `@fafa/design-tokens`
- `@fafa/theme-automecanik`
- `@fafa/theme-admin`
- `@fafa/ui`
- `@fafa/patterns`

Cela signifie qu'ils seront **toujours versionnés ensemble** pour maintenir la cohérence.

## Packages ignorés

Ces packages sont ignorés et ne seront pas publiés :
- `@fafa/frontend` (app Remix, pas une lib)
- `@fafa/backend` (app NestJS, pas une lib)

## Exemple de workflow

```bash
# 1. Faire des changements sur Button component
vim packages/ui/src/components/button.tsx

# 2. Créer un changeset
npm run changeset
# → Select: @fafa/ui
# → Type: minor
# → Summary: "Add icon variant to Button component"

# 3. Faire d'autres changements...
vim packages/design-tokens/src/tokens/design-tokens.json

# 4. Créer un autre changeset
npm run changeset
# → Select: @fafa/design-tokens
# → Type: patch
# → Summary: "Fix shadow-xl token value"

# 5. Quand prêt pour release
npm run changeset:version
# → Bump versions, update CHANGELOGs

# 6. Commit et push
git add .
git commit -m "chore: release packages"
git push

# 7. Publish (CI ou manuel)
npm run changeset:publish
```

## CI/CD Integration

Pour automatiser avec GitHub Actions :

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npx changeset publish
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Access public

Les packages sont configurés en `access: public` dans `.changeset/config.json`.

Assurez-vous que chaque package a `"publishConfig": { "access": "public" }` dans son `package.json`.
