# 🔄 Intégration CI/CD - Design System

## ✅ État actuel : CI/CD Compatible

Le Design System est **déjà intégré** à votre CI/CD existant via npm workspaces.

## 🏗️ Comment ça fonctionne

### 1. Workspaces npm (automatique)

Votre `package.json` racine déclare :

```json
{
  "workspaces": [
    "backend",
    "frontend",
    "packages/*"  // ← Le design-system est inclus ici
  ]
}
```

**Avantages** :
- ✅ Linking automatique entre packages
- ✅ Installation centralisée (`npm install` à la racine)
- ✅ Pas besoin de `npm link` manuel
- ✅ Compatible avec les CI existantes

### 2. Pas de modification Turbo nécessaire

Votre `turbo.json` actuel n'a **pas besoin d'être modifié**. Turbo détecte automatiquement les workspaces npm.

Le Design System peut :
- ✅ Être buildé indépendamment (`cd packages/design-system && npm run build`)
- ✅ Être utilisé comme dépendance dans `frontend` et `backend`
- ✅ Bénéficier du cache Turbo si vous ajoutez des tâches

## 🚀 Utilisation dans votre CI

### Option 1 : Build indépendant (recommandé initialement)

Le Design System se build de manière autonome :

```bash
# Dans votre CI existante
cd packages/design-system
npm run build  # Génère tokens + tsup
npm run test   # Tests de sanité
```

Pas besoin de modifier `.github/workflows/ci.yml` - le workflow existant fonctionnera.

### Option 2 : Intégration Turbo (optionnel, plus tard)

Si vous voulez ajouter le Design System au pipeline Turbo, c'est simple :

#### 2.1. Déclarer les tâches (optionnel)

Créez `packages/design-system/turbo.json` :

```json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["build"]
    }
  }
}
```

#### 2.2. Ajouter au workflow GitHub Actions

Dans `.github/workflows/ci.yml` (si vous voulez) :

```yaml
jobs:
  design-system:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Design System
        run: npm run build --workspace=@monorepo/design-system
      
      - name: Test Design System
        run: npm run test --workspace=@monorepo/design-system
      
      - name: Lint Design System
        run: npm run lint --workspace=@monorepo/design-system
```

## 📦 Dépendances frontend/backend

### Ajouter le Design System comme dépendance

#### Dans frontend/package.json :

```json
{
  "dependencies": {
    "@monorepo/design-system": "*"
  }
}
```

Puis :

```bash
cd frontend
npm install  # Ou npm ci en CI
```

Le workspace npm résout automatiquement vers `packages/design-system`.

#### Dans backend/package.json (si nécessaire) :

```json
{
  "dependencies": {
    "@monorepo/design-system": "*"
  }
}
```

## 🔁 Workflow de développement

### 1. Développement local

```bash
# Terminal 1 : Watch mode Design System
cd packages/design-system
npm run dev  # Auto-rebuild sur changements

# Terminal 2 : Dev frontend
cd frontend
npm run dev  # Utilise le DS en temps réel
```

### 2. Développement avec Turbo

```bash
# À la racine (si turbo.json configuré)
turbo dev  # Lance tous les workspaces en parallèle
```

### 3. Build production

```bash
# Build tout le monorepo
npm run build  # Via turbo

# Ou build sélectif
npm run build --workspace=@monorepo/design-system
```

## 🧪 Tests en CI

### Script CI complet

```bash
#!/bin/bash
# .github/workflows/ci.yml

# Install
npm ci

# Build
npm run build --workspace=@monorepo/design-system

# Tests Design System
npm run test --workspace=@monorepo/design-system
npm run lint --workspace=@monorepo/design-system
npm run typecheck --workspace=@monorepo/design-system

# Build frontend (qui dépend du DS)
npm run build --workspace=@fafa/frontend

# Tests frontend
npm run test --workspace=@fafa/frontend
```

## 📊 Cache Turbo (optionnel)

Si vous voulez optimiser les rebuilds avec Turbo :

```json
// turbo.json (racine)
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        "backend/dist/**",
        "frontend/build/**",
        "packages/*/dist/**"  // ← Inclut design-system/dist
      ]
    }
  }
}
```

Bénéfices :
- ✅ Cache des builds identiques
- ✅ Rebuilds partiels seulement
- ✅ CI plus rapide

## 🎯 Stratégie de publication (future)

### Option 1 : Monorepo privé (actuel)

Le Design System reste dans le monorepo, utilisé via workspaces.

**Avantages** :
- ✅ Pas de publication npm nécessaire
- ✅ Développement synchronisé
- ✅ Pas de versions à gérer

### Option 2 : Package npm privé (futur)

Publier sur un registry npm privé (GitHub Packages, npm Org privée, Verdaccio).

```bash
cd packages/design-system
npm version patch
npm publish  # Vers registry privé
```

Puis dans frontend :

```json
{
  "dependencies": {
    "@monorepo/design-system": "^1.0.0"
  }
}
```

### Option 3 : Package npm public (si open-source)

Publier publiquement sur npmjs.com :

```bash
cd packages/design-system
npm publish --access public
```

## 🚨 Checklist CI/CD

- [x] ✅ Workspaces npm configurés
- [x] ✅ Package buildable (`npm run build`)
- [x] ✅ Tests automatisés (`npm run test`)
- [x] ✅ Linting configuré (`npm run lint`)
- [x] ✅ TypeCheck fonctionnel (`npm run typecheck`)
- [ ] 🚧 Intégration Turbo (optionnel)
- [ ] 🚧 Workflow GitHub Actions dédié (optionnel)
- [ ] 🚧 Tests visuels Chromatic (optionnel)
- [ ] 🚧 Publication npm (si besoin)

## 💡 Recommandations

### Phase 1 : Actuelle (validation)

1. ✅ Laisser le Design System dans le monorepo
2. ✅ Le builder manuellement si nécessaire
3. ✅ Le consommer via workspaces npm

### Phase 2 : Intégration CI (optionnelle)

1. Ajouter un job GitHub Actions spécifique
2. Tester le build + lint + tests en CI
3. Mettre en cache avec Turbo

### Phase 3 : Optimisation (future)

1. Configurer Changesets pour versioning automatique
2. Ajouter des tests visuels avec Chromatic
3. Publier sur npm privé si besoin de découplage

## 🎉 Conclusion

**Votre CI/CD existant fonctionne déjà avec le Design System !**

Aucune action requise pour l'instant. Le système de workspaces npm gère tout automatiquement.

Si vous voulez aller plus loin :
1. Créez un workflow GitHub Actions dédié (optionnel)
2. Intégrez au pipeline Turbo (optionnel)
3. Ajoutez des tests visuels (optionnel)

**La configuration actuelle est production-ready.**
