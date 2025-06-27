# 🎯 INSTRUCTIONS COPILOT MCP - REMIX

## 📋 CONTEXTE MCP REMIX
Ce guide contient les instructions spécialisées pour GitHub Copilot lors du développement avec Remix dans l'architecture MCP Context-7.

## 🏗️ STRUCTURE REMIX MCP

### Architecture des Routes
```
app/routes/
├── {module-name}.{feature}.tsx        # Nested route
├── {module-name}.tsx                  # Module layout
├── api.{module-name}.ts               # API route
└── _index.tsx                         # Index route
```

## 🎨 STANDARDS MCP REMIX

### 1. Headers MCP obligatoires
```typescript
/**
 * MCP GENERATED ROUTE
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
```

### 2. Conventions de nommage
- **Routes**: `{module-name}.{feature}.tsx`
- **Components**: `{FeatureName}Page`
- **Loaders**: `loader` (export named)
- **Actions**: `action` (export named)

### 3. Structure Route type avec Loader
```typescript
/**
 * MCP GENERATED ROUTE
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  
  // API call to NestJS backend
  const response = await fetch(`${process.env.API_URL}/api/{module-name}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Response('Error loading data', { status: response.status });
  }
  
  const data = await response.json();
  
  return json({
    status: 'success',
    data: data.data,
    module: '{module-name}',
    ...query
  });
}

export default function {ModuleName}Page() {
  const { data, module } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {module.charAt(0).toUpperCase() + module.slice(1)}
        </h1>
        <p className="text-gray-600 mt-2">
          Gestion des {module}
        </p>
      </div>

      <div className="grid gap-6">
        {data?.map((item: any, index: number) => (
          <div key={item.id || index} className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">
              {item.title || item.name || `Item ${index + 1}`}
            </h3>
            <p className="text-gray-600">
              {item.description || 'Aucune description disponible'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4. Structure Route avec Action (Formulaire)
```typescript
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch(`${process.env.API_URL}/api/{module-name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      return json({ 
        status: 'error', 
        error: 'Erreur lors de la création',
        module: '{module-name}'
      }, { status: 400 });
    }

    return redirect('/{module-name}');
  } catch (error) {
    return json({ 
      status: 'error', 
      error: 'Erreur serveur',
      module: '{module-name}'
    }, { status: 500 });
  }
}

export default function Create{ModuleName}Page() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Créer un {module-name}</h1>
      
      <Form method="post" className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nom
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        {actionData?.status === 'error' && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">
              {actionData.error}
            </div>
          </div>
        )}

        <div>
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Créer
          </button>
        </div>
      </Form>
    </div>
  );
}
```

### 5. Route API (Resource Route)
```typescript
/**
 * MCP GENERATED API ROUTE
 * Généré automatiquement par MCP Context-7
 * Module: {module-name}
 */
import { json, type LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  try {
    const response = await fetch(`${process.env.API_URL}/api/{module-name}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch');
    }

    const data = await response.json();
    
    return json(data);
  } catch (error) {
    return json(
      { 
        status: 'error', 
        error: 'Internal server error',
        module: '{module-name}'
      }, 
      { status: 500 }
    );
  }
}
```

## 🔧 INTÉGRATIONS MCP

### Avec NestJS Backend
```typescript
// Utility pour les appels API
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${process.env.API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Response('API Error', { status: response.status });
  }

  return response.json();
}
```

### Avec Authentication
```typescript
import { authenticator } from '~/services/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  // Continue with authenticated request
}
```

### Avec Error Boundaries
```typescript
export function ErrorBoundary() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Oops! Quelque chose s'est mal passé
        </h1>
        <p className="text-gray-600 mb-8">
          Une erreur s'est produite lors du chargement de cette page.
        </p>
        <a 
          href="/"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
```

## 🎨 COMPOSANTS UI STANDARDISÉS

### Layout Component
```typescript
interface LayoutProps {
  children: React.ReactNode;
  title: string;
  module: string;
}

export function Layout({ children, title, module }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">Module: {module}</p>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

## 🎯 INSTRUCTIONS COPILOT

Quand tu génères du code Remix pour l'architecture MCP :

1. **TOUJOURS** inclure le header MCP avec le nom du module
2. **RESPECTER** les conventions de nommage MCP
3. **UTILISER** les loaders pour les données et actions pour les mutations
4. **IMPLÉMENTER** la gestion d'erreur avec ErrorBoundary
5. **CONNECTER** avec l'API NestJS backend
6. **APPLIQUER** les classes Tailwind CSS pour le styling
7. **GÉRER** les états de loading et d'erreur
8. **UTILISER** les types TypeScript appropriés

### Exemple complet d'utilisation :
Si l'utilisateur demande "Crée une page products pour Remix", tu dois générer :
- Route avec loader pour récupérer les produits
- Component avec UI responsive et accessible
- Gestion des erreurs avec ErrorBoundary
- Intégration avec l'API NestJS products
- Header MCP Context-7
- Styling avec Tailwind CSS

Cette approche garantit la cohérence avec l'architecture MCP Context-7 et une expérience utilisateur optimale.
