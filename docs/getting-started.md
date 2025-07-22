# Guide de Démarrage Rapide

Bienvenue dans le projet NestJS-Remix Monorepo ! Ce guide vous permettra de commencer rapidement.

## 🚀 Installation Express (5 minutes)

### 1. Prérequis

Vérifiez que vous avez :

```bash
node --version    # >= 20.0.0
npm --version     # >= 10.0.0
```

### 2. Installation

```bash
# Cloner et installer
git clone <votre-repo>
cd nestjs-remix-monorepo
npm install
```

### 3. Configuration Minimale

```bash
# Copier la configuration
cp backend/.env.example backend/.env

# Éditer backend/.env avec vos paramètres Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SESSION_SECRET=your-secret-key-here
```

### 4. Démarrage

```bash
# Lancer en mode développement
npm run dev
```


## 🗺️ Tour Rapide du Projet

### Pages Principales

1. **Accueil :** `/` - Page d'accueil
2. **Commandes :** `/orders` - Gestion des commandes
3. **Panier :** `/cart` - Panier utilisateur
4. **Admin :** `/admin` - Interface d'administration

### API Endpoints

L'API NestJS est accessible sur http://localhost:3000 :

- `GET /api/orders` - Liste des commandes
- `GET /api/users` - Liste des utilisateurs
- `GET /api/cart` - Contenu du panier

## 🎯 Premiers Pas

### 1. Tester l'Architecture Zero-Latency

Ouvrez `/frontend/app/routes/admin.orders._index.tsx` et observez :

```typescript
export const loader: LoaderFunction = async ({ context }) => {
  // ✅ Appel direct sans latence réseau !
  const result = await context.remixService.integration.getOrdersForRemix({
    page: 1,
    limit: 10
  });
  
  return json({ orders: result.orders });
};
```

### 2. Créer votre Première Route

```bash
# Créer une nouvelle route
touch frontend/app/routes/hello.tsx
```

```typescript
// frontend/app/routes/hello.tsx
import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader: LoaderFunction = async ({ context }) => {
  // Utiliser l'intégration directe
  const result = await context.remixService.integration.getOrdersForRemix({
    limit: 5
  });
  
  return json({ 
    message: "Hello World!",
    orderCount: result.total 
  });
};

export default function Hello() {
  const { message, orderCount } = useLoaderData();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{message}</h1>
      <p>Il y a {orderCount} commandes dans le système.</p>
    </div>
  );
}
```

Visitez http://localhost:3001/hello pour voir votre page !

### 3. Ajouter une Méthode au Service d'Intégration

```typescript
// backend/src/remix/remix-integration.service.ts

// Ajouter cette méthode à la classe
async getHelloDataForRemix() {
  try {
    return {
      success: true,
      message: "Hello from backend!",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

Puis l'utiliser dans votre route :

```typescript
export const loader: LoaderFunction = async ({ context }) => {
  const result = await context.remixService.integration.getHelloDataForRemix();
  return json(result);
};
```

## 🛠️ Commandes Utiles

```bash
# Développement
npm run dev              # Lance backend + frontend
npm run typecheck        # Vérification TypeScript
npm run lint             # Linting ESLint

# Build
npm run build            # Build de production

# Nettoyage
npm run clean-node-modules  # Nettoie les node_modules
npm run clean-turbo-cache   # Vide le cache Turbo
```

## 📁 Structure Rapide

```
nestjs-remix-monorepo/
├── backend/src/
│   ├── modules/              # Logique métier
│   └── remix/               # Intégration Remix ⭐
├── frontend/app/
│   ├── routes/              # Pages de l'app ⭐
│   └── components/          # Composants UI
└── docs/                    # Documentation
```

Les dossiers ⭐ sont ceux que vous modifierez le plus souvent.

## 🆘 Aide Rapide

### Problème : Erreur de Compilation

```bash
npm run typecheck
# Corrigez les erreurs TypeScript affichées
```

### Problème : Module Non Trouvé

```bash
rm -rf node_modules package-lock.json
npm install
```

### Problème : Port Déjà Utilisé

```bash
# Tuer les processus sur les ports 3000 et 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Problème : Cache Turbo

```bash
npm run clean-turbo-cache
npm run build
```

## 📖 Prochaines Étapes

1. **Lire la documentation :**
   - [Architecture](docs/architecture.md) - Comprendre l'architecture zero-latency
   - [Développement](docs/development.md) - Guide de développement détaillé

2. **Explorer les modules :**
   - `backend/src/modules/orders/` - Gestion des commandes
   - `backend/src/modules/users/` - Gestion des utilisateurs
   - `backend/src/modules/cart/` - Gestion du panier

3. **Tester les fonctionnalités :**
   - Interface d'admin : http://localhost:3001/admin
   - API Swagger : http://localhost:3000/api (si configuré)

## 💡 Concepts Clés à Retenir

1. **Zero-Latency :** Pas d'appels HTTP internes, communication directe
2. **Monorepo :** Un seul repository pour frontend + backend
3. **Type Safety :** Types TypeScript partagés automatiquement
4. **Performance :** Architecture optimisée pour la vitesse

Vous êtes maintenant prêt à développer ! 🚀

**Besoin d'aide ?** Consultez les autres fichiers de documentation ou créez une issue dans le repository.
