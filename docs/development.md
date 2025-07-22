# Guide de Développement

## Prérequis

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git

## Installation et Configuration

### 1. Clonage et Installation

```bash
git clone <repository-url>
cd nestjs-remix-monorepo
npm install
```

### 2. Configuration de l'Environnement

```bash
# Backend
cp backend/.env.example backend/.env
```

Configurer les variables dans `backend/.env` :

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Session
SESSION_SECRET=your-super-secret-session-key

# Redis (optionnel)
REDIS_URL=redis://localhost:6379
```

### 3. Démarrage

```bash
# Développement (lance backend + frontend)
npm run dev

# Ou individuellement :
cd backend && npm run dev    # Backend sur port 3000
cd frontend && npm run dev   # Frontend sur port 3001
```

## Architecture des Dossiers

```
nestjs-remix-monorepo/
├── backend/
│   ├── src/
│   │   ├── main.ts                 # Point d'entrée
│   │   ├── app.module.ts           # Module racine
│   │   ├── modules/                # Modules métier
│   │   │   ├── users/
│   │   │   ├── orders/
│   │   │   ├── cart/
│   │   │   └── payments/
│   │   ├── remix/                  # Intégration Remix
│   │   │   ├── remix.service.ts
│   │   │   └── remix-integration.service.ts
│   │   ├── auth/                   # Authentification
│   │   ├── database/               # Accès données
│   │   └── cache/                  # Cache Redis
│   └── dist/                       # Build compilé
├── frontend/
│   ├── app/
│   │   ├── routes/                 # Routes Remix
│   │   ├── components/             # Composants UI
│   │   │   └── ui/                 # shadcn/ui components
│   │   ├── lib/                    # Utilitaires
│   │   └── server/                 # Code serveur
│   └── build/                      # Build compilé
└── packages/                       # Configurations partagées
    ├── eslint-config/
    └── typescript-config/
```

## Conventions de Code

### 1. Nommage

```typescript
// Services
class OrdersService {}
class OrdersCompleteService {}

// Méthodes pour Remix (toujours suffixe ForRemix)
async getOrdersForRemix() {}
async createOrderForRemix() {}

// Routes Remix (conventions Remix)
routes/
  admin.orders._index.tsx      // /admin/orders
  admin.orders.$id.tsx         // /admin/orders/:id
  orders.new.tsx               // /orders/new
```

### 2. Structure des Services

```typescript
@Injectable()
export class ExampleService {
  constructor(
    private readonly supabaseService: SupabaseRestService,
    private readonly cacheService: CacheService,
  ) {}

  // Méthodes publiques
  async publicMethod() {
    try {
      // Logique métier
      return result;
    } catch (error) {
      console.error('Error in publicMethod:', error);
      throw error;
    }
  }

  // Méthodes privées
  private async helperMethod() {
    // Logique d'aide
  }
}
```

### 3. Structure des Routes Remix

```typescript
// Types
interface LoaderData {
  items: Item[];
  total: number;
}

interface ActionData {
  success?: boolean;
  error?: string;
}

// Loader
export const loader: LoaderFunction = async ({ context }) => {
  const result = await context.remixService.integration.getItemsForRemix();
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return json<LoaderData>({
    items: result.items,
    total: result.total,
  });
};

// Action
export const action: ActionFunction = async ({ request, context }) => {
  const formData = await request.formData();
  // Traiter les données
  
  const result = await context.remixService.integration.createItemForRemix(data);
  
  if (result.success) {
    return redirect('/items');
  }
  
  return json<ActionData>({ error: result.error });
};

// Composant
export default function ItemsPage() {
  const { items, total } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  
  return (
    <div>
      {/* UI */}
    </div>
  );
}
```

## Ajout d'un Nouveau Module

### 1. Backend - Créer le Module

```bash
mkdir backend/src/modules/new-module
cd backend/src/modules/new-module
```

Structure du module :

```
new-module/
├── new-module.module.ts        # Module NestJS
├── new-module.service.ts       # Service métier
├── new-module.controller.ts    # Contrôleur API
├── dto/                        # Types et validations
│   ├── create-new-item.dto.ts
│   └── update-new-item.dto.ts
└── schemas/                    # Schémas Zod
    └── new-item.schemas.ts
```

### 2. Service Métier

```typescript
@Injectable()
export class NewModuleService {
  constructor(
    private readonly supabaseService: SupabaseRestService,
  ) {}

  async findAll(): Promise<NewItem[]> {
    // Logique métier
  }

  async create(data: CreateNewItemDto): Promise<NewItem> {
    // Logique de création
  }
}
```

### 3. Intégration Remix

Ajouter les méthodes ForRemix dans `RemixIntegrationService` :

```typescript
// Dans remix-integration.service.ts
constructor(
  // ... autres services
  private readonly newModuleService: NewModuleService,
) {}

async getNewItemsForRemix(params?: {
  page?: number;
  limit?: number;
}) {
  try {
    const { page = 1, limit = 10 } = params || {};
    
    const items = await this.newModuleService.findAll();
    
    return {
      success: true,
      items,
      total: items.length,
      page,
      totalPages: Math.ceil(items.length / limit),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      items: [],
      total: 0,
    };
  }
}
```

### 4. Frontend - Créer les Routes

```typescript
// frontend/app/routes/new-items._index.tsx
export const loader: LoaderFunction = async ({ context }) => {
  const result = await context.remixService.integration.getNewItemsForRemix();
  return json({ items: result.items });
};

export default function NewItemsIndex() {
  const { items } = useLoaderData();
  
  return (
    <div>
      <h1>New Items</h1>
      {/* Liste des items */}
    </div>
  );
}
```

## Tests

### 1. Tests Backend

```bash
cd backend
npm run test        # Tests unitaires
npm run test:e2e    # Tests d'intégration
```

### 2. Tests Frontend

```bash
cd frontend
npm run test        # Tests composants
```

### 3. Structure de Test

```typescript
// backend/src/modules/example/example.service.spec.ts
describe('ExampleService', () => {
  let service: ExampleService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ExampleService],
    }).compile();

    service = module.get<ExampleService>(ExampleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## Débogage

### 1. Backend

```typescript
// Utiliser les logs NestJS
console.log('🔍 Debug info:', data);
console.error('❌ Error:', error);
console.warn('⚠️ Warning:', warning);
```

### 2. Frontend

```typescript
// Dans les loaders/actions
export const loader: LoaderFunction = async ({ context }) => {
  console.log('🔍 Loader called');
  
  const result = await context.remixService.integration.getDataForRemix();
  
  console.log('📊 Result:', result);
  
  return json({ data: result.data });
};
```

### 3. DevTools

- **Backend :** Logs dans la console du serveur
- **Frontend :** Remix DevTools dans le navigateur
- **Base de données :** Supabase Dashboard

## Scripts Utiles

```bash
# Nettoyage
npm run clean-node-modules     # Supprime tous les node_modules
npm run clean-turbo-cache      # Vide le cache Turbo

# Vérifications
npm run typecheck              # Vérification TypeScript
npm run lint                   # Linting ESLint
npm run build                  # Build complet

# Base de données
cd backend
npm run db:generate           # Génère les types DB
npm run db:deploy             # Déploie les migrations
```

## Résolution de Problèmes

### 1. Erreurs de Compilation TypeScript

```bash
# Vérifier les types
npm run typecheck

# Nettoyer et réinstaller
npm run clean-node-modules
npm install
```

### 2. Erreurs de Module Non Trouvé

```bash
# Vérifier les dépendances
npm ls

# Réinstaller si nécessaire
rm -rf node_modules package-lock.json
npm install
```

### 3. Erreurs de Cache Turbo

```bash
# Vider le cache
npm run clean-turbo-cache

# Rebuild complet
npm run build
```

## Bonnes Pratiques

### 1. Performance

- Utiliser le cache Redis pour les données fréquentes
- Paginer les listes importantes
- Éviter les requêtes N+1 avec Supabase

### 2. Sécurité

- Valider toutes les entrées avec Zod
- Utiliser les guards NestJS pour l'autorisation
- Nettoyer les données sensibles côté client

### 3. Maintenabilité

- Documenter les méthodes publiques
- Utiliser des types stricts
- Écrire des tests pour la logique métier critique

### 4. Déploiement

- Tester en local avant commit
- Utiliser les environnements staging
- Monitoring des erreurs en production
