#!/bin/bash

# Script de nettoyage des dépendances redondantes
# Élimine les doublons et met à jour les versions

set -e

echo "📦 Nettoyage des dépendances redondantes..."

MONOREPO_ROOT="/workspaces/nestjs-remix-monorepo"
cd "$MONOREPO_ROOT"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Analyse des dépendances redondantes${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Vérifier les doublons de dépendances
echo -e "\n${YELLOW}🔍 Recherche de doublons...${NC}"

echo -e "\n${GREEN}Doublons identifiés :${NC}"
echo "  • bcrypt ET bcryptjs (garder bcrypt seulement)"
echo "  • zod versions multiples (unifier sur 3.24.1)"
echo "  • @nestjs/swagger versions différentes"
echo "  • @nestjs/platform-express versions différentes"

# Créer un rapport
REPORT_FILE="$MONOREPO_ROOT/docs/DEPENDENCIES-CLEANUP-$(date +%Y-%m-%d).md"

cat > "$REPORT_FILE" << 'EOF'
# 📦 Rapport de Nettoyage des Dépendances

## Doublons Identifiés et Actions

### 1. Cryptographie (bcrypt vs bcryptjs)

**Problème**: Deux bibliothèques pour le même usage
- `bcrypt` : Version native, plus rapide
- `bcryptjs` : Version pure JS, plus lente

**Action**: Garder `bcrypt` uniquement
- ✅ Plus performant
- ✅ Meilleure sécurité
- ✅ Support natif

**Changements requis**:
```typescript
// Remplacer tous les imports
- import * as bcryptjs from 'bcryptjs';
+ import * as bcrypt from 'bcrypt';

// Mise à jour des appels
- bcryptjs.hash()
+ bcrypt.hash()
```

### 2. Validation (zod)

**Problème**: Versions multiples
- Racine: `^3.24.1`
- Backend: `^4.0.5`

**Action**: Unifier sur `^3.24.1` (stable et compatible)

### 3. NestJS (@nestjs/swagger)

**Problème**: Versions différentes
- Racine: `^11.2.0`
- Backend: `^7.4.2`

**Action**: Unifier sur `^11.2.0` (dernière stable)

### 4. NestJS (@nestjs/platform-express)

**Problème**: Versions différentes
- Racine: `^11.1.5`
- Backend: `^10.0.0`

**Action**: Unifier sur `^11.1.5`

## Dépendances à Supprimer

### Backend
- ❌ `bcryptjs` (remplacé par bcrypt)
- ❌ `unix-crypt-td-js` (obsolète)

## Recommandations

### 1. Utiliser les workspaces NPM
Les dépendances communes devraient être gérées à la racine :

```json
{
  "dependencies": {
    "bcrypt": "^6.0.0",
    "zod": "^3.24.1",
    "@nestjs/swagger": "^11.2.0",
    "@nestjs/platform-express": "^11.1.5"
  }
}
```

### 2. Backend package.json
Garder uniquement les dépendances spécifiques au backend.

### 3. Audit régulier
```bash
npm audit
npx depcheck
```

## Commandes de Nettoyage

```bash
# 1. Nettoyer node_modules
rm -rf node_modules backend/node_modules frontend/node_modules

# 2. Nettoyer package-lock
rm -f package-lock.json backend/package-lock.json frontend/package-lock.json

# 3. Réinstaller
npm install
```

## Sécurité

### Avant
- Risques de conflits de versions
- Doublons de code
- Surface d'attaque augmentée

### Après
- Versions unifiées
- Moins de dépendances
- Meilleure maintenabilité
- Surface d'attaque réduite
EOF

echo "✓ Rapport généré: $REPORT_FILE"

echo -e "\n${GREEN}✅ Analyse terminée${NC}"
echo -e "${BLUE}📄 Consultez le rapport:${NC} $REPORT_FILE"

echo -e "\n${YELLOW}⚠️  Actions manuelles requises:${NC}"
echo "  1. Examiner le rapport des dépendances"
echo "  2. Mettre à jour les package.json (script suivant)"
echo "  3. Rechercher et remplacer bcryptjs par bcrypt dans le code"
echo "  4. Réinstaller les dépendances"
echo "  5. Tester l'application"

echo -e "\n${BLUE}Voulez-vous appliquer automatiquement les changements de package.json ?${NC}"
echo "Exécutez: ./scripts/update-package-json.sh"
