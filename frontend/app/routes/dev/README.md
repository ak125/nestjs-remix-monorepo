# 🧪 Dossier de Développement

Ce dossier contient les routes et composants de test utilisés pendant le développement.

## 📁 Structure

```
dev/
├── README.md                    # Ce fichier
├── test-cart.tsx               # Tests du système de panier
├── test-cart-complete.tsx      # Tests complets du panier
├── test-cart-complet.tsx       # Tests complets (version française)
└── zod-test.tsx                # Tests de validation Zod (si déplacé ici)
```

## 🎯 Usage

Ces routes sont accessibles en développement uniquement :
- `/dev/test-cart` - Tests du panier de base
- `/dev/test-cart-complete` - Tests du panier complet
- `/dev/zod-test` - Tests de validation Zod

## ⚠️ Important

Ces routes **NE DOIVENT PAS** être accessibles en production.
En production, ajouter une guard ou supprimer ces routes.

## 🔧 Configuration Recommandée

```typescript
// Dans vite.config.ts ou remix.config.js
if (process.env.NODE_ENV === 'production') {
  // Exclure les routes dev
  ignoredRouteFiles: ["**/dev/**"]
}
```