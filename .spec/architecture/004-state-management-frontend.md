---
title: "ADR-004: State Management Frontend (Remix Pattern)"
status: accepted
version: 1.0.0
authors: [Frontend Team]
created: 2025-11-14
updated: 2025-11-14
relates-to:
  - ./002-monorepo-structure.md
  - ../features/auth-system.md
tags: [architecture, frontend, remix, state-management, performance]
---

# ADR-004: State Management Frontend (Remix Pattern)

## 📊 Status

**Status:** Accepted  
**Date:** 2025-11-14  
**Decision Makers:** [Frontend Team, Architecture Team]  
**Consulted:** [Backend Team]  
**Informed:** [All Teams]

## 🎯 Context

### Problème

L'application frontend Remix (React 18) doit gérer l'état pour :
- **213 routes** avec data fetching complexe
- **59k utilisateurs** avec sessions et authentification
- **4M+ produits** avec filtres, recherche, pagination
- **Panier e-commerce** avec synchronisation temps réel
- **Préférences utilisateur** (véhicule sélectionné, thème, langue)

### Contraintes Techniques

- **SSR (Server-Side Rendering)** : Remix fait du rendu serveur par défaut
- **Progressive Enhancement** : L'app doit fonctionner sans JavaScript
- **Performance** : Time to First Byte < 200ms, LCP < 2.5s
- **SEO** : 714k pages SEO indexées (95.2% du catalogue)
- **Hydration** : Éviter "hydration mismatch" entre server/client
- **Cache** : Redis backend + HTTP cache headers

### Forces en Présence

**Technique** :
- Remix encourage les loaders/actions (data fetching serveur)
- React Context disponible pour state client minimal
- URL state = source of truth (bookmarkable, shareable)
- FormData native > JSON pour Progressive Enhancement

**Business** :
- Réactivité : mutations doivent être rapides (< 300ms perceived)
- Offline : panier doit persister entre sessions
- Multidevice : état synchronisé (desktop/mobile/tablet)
- Analytics : tracking actions utilisateur

**Social** :
- Équipe 1-2 devs : simplicité > sophistication
- Éviter boilerplate Redux (actions, reducers, sagas)
- Debugging facile : Network tab > Redux DevTools

## 🤔 Decision

**Nous adoptons le pattern natif Remix : loaders + actions + URL state, avec React Context minimal pour UI state.**

### Architecture Décision

```typescript
// ✅ Pattern Remix Standard

// 1. SERVER-SIDE DATA FETCHING (Loader)
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const search = url.searchParams.get("search") || "";

  // Fetch depuis backend API
  const products = await fetch(`${API_URL}/products?page=${page}&search=${search}`);
  
  // Redis cache si disponible
  const cached = await redis.get(`products:${page}:${search}`);
  if (cached) return json(JSON.parse(cached));

  return json({ products, page, search }, {
    headers: {
      "Cache-Control": "public, max-age=300", // 5min cache
    }
  });
}

// 2. SERVER-SIDE MUTATIONS (Action)
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent"); // "add-to-cart", "update-qty"

  if (intent === "add-to-cart") {
    const productId = formData.get("productId");
    await fetch(`${API_URL}/cart/add`, {
      method: "POST",
      body: JSON.stringify({ productId }),
      headers: { "Content-Type": "application/json" }
    });
    return redirect("/cart");
  }

  return json({ success: true });
}

// 3. CLIENT-SIDE RENDERING (Component)
export default function ProductsRoute() {
  const { products, page } = useLoaderData<typeof loader>();
  const fetcher = useFetcher(); // Pour mutations optimistes

  return (
    <div>
      {products.map(p => (
        <fetcher.Form method="post" key={p.id}>
          <input type="hidden" name="intent" value="add-to-cart" />
          <input type="hidden" name="productId" value={p.id} />
          <button>Ajouter</button>
        </fetcher.Form>
      ))}
    </div>
  );
}
```

### Règles de Décision

| État Type | Pattern | Exemple | Raison |
|-----------|---------|---------|--------|
| **URL State** | `useSearchParams()` | Filtres, pagination, tri | Bookmarkable, shareable |
| **Server Data** | `loader()` + `useLoaderData()` | Produits, commandes, user | SSR, SEO, performance |
| **Mutations** | `action()` + `useFetcher()` | Ajout panier, login, checkout | Progressive Enhancement |
| **UI State** | `useState()` local | Modal open/closed, accordion | Éphémère, non-persistant |
| **Cross-Component** | React Context | Theme, auth session, vehicle | Éviter prop drilling |
| **Persistent Client** | `localStorage` | Panier offline, préférences | Survit rechargements |

## 🔍 Considered Options

### Option 1: Remix Loaders/Actions (Choisi ✅)

**Description:** Pattern natif Remix pour data fetching (loaders) et mutations (actions).

**Pros:**
- ✅ **SSR natif** : Données disponibles au premier render
- ✅ **SEO optimal** : Contenu crawlable sans JavaScript
- ✅ **Progressive Enhancement** : Fonctionne sans JS (FormData)
- ✅ **Cache intégré** : HTTP headers + Redis backend
- ✅ **Zero boilerplate** : Pas de store setup, actions, reducers
- ✅ **Type-safe** : TypeScript inference automatique (`typeof loader`)
- ✅ **Revalidation automatique** : Après mutations, loaders re-run
- ✅ **URL state** : Bookmarkable, shareable, back/forward works

**Cons:**
- ❌ **Client-side reactivity limitée** : Pas de Redux DevTools
- ❌ **Cross-route state complexe** : Besoin Context ou URL params
- ❌ **Optimistic UI manuel** : Doit gérer fetcher.state soi-même

**Cost:** 
- **Temps** : 0h (déjà en place)
- **Complexity** : Faible (pattern natif)

### Option 2: Redux Toolkit

**Description:** Redux avec RTK Query pour state global et data fetching.

**Pros:**
- ✅ **DevTools puissants** : Time-travel debugging, state inspection
- ✅ **State global unifié** : Single source of truth
- ✅ **RTK Query** : Cache automatique, invalidation
- ✅ **Middleware riche** : Thunks, sagas pour side-effects
- ✅ **Community** : Énorme écosystème, best practices

**Cons:**
- ❌ **Boilerplate massif** : Actions, reducers, slices, thunks
- ❌ **SSR complexe** : Hydration Redux store délicat
- ❌ **Pas Progressive Enhancement** : Requiert JavaScript
- ❌ **SEO impact** : Données pas dans HTML initial
- ❌ **Over-engineering** : Trop pour 1-2 devs
- ❌ **Bundle size** : +50KB gzipped
- ❌ **Courbe d'apprentissage** : Redux mental model

**Cost:**
- **Temps** : 2-3 semaines migration complète
- **Money** : ~15 jours × €500/j = €7,500
- **Complexity** : Très élevée

**Pourquoi rejeté ?**
- Pas adapté à Remix philosophy (server-first)
- Over-kill pour notre scale (1-2 devs)
- SEO degradation inacceptable (714k pages)

### Option 3: Zustand

**Description:** State management minimaliste avec API hooks simple.

**Pros:**
- ✅ **Simple** : API minimale, pas de boilerplate
- ✅ **Léger** : ~1KB gzipped
- ✅ **TypeScript-first** : Excellent typage
- ✅ **DevTools** : Support Redux DevTools
- ✅ **Middleware** : Persist, immer, devtools

**Cons:**
- ❌ **Client-only** : Pas de SSR natif
- ❌ **Hydration manuelle** : Doit synchroniser server/client
- ❌ **Pas Progressive Enhancement**
- ❌ **Duplication** : State serveur (loaders) + client (Zustand)

**Cost:**
- **Temps** : 1 semaine setup + migration
- **Complexity** : Moyenne

**Pourquoi rejeté ?**
- Redondant avec loaders Remix
- Hydration complexe (mismatch server/client)
- Pas Progressive Enhancement

### Option 4: Jotai / Recoil (Atomic State)

**Description:** State atomique avec atoms et selectors.

**Pros:**
- ✅ **Granular reactivity** : Render only what changes
- ✅ **Derived state** : Selectors pour computed values
- ✅ **Concurrent Mode ready**
- ✅ **TypeScript-friendly**

**Cons:**
- ❌ **Learning curve** : Mental model différent
- ❌ **SSR limité** : Hydration complexe
- ❌ **Overkill** : Pour notre use case simple
- ❌ **Debugging** : Pas de DevTools mature

**Cost:**
- **Temps** : 1-2 semaines
- **Complexity** : Moyenne-élevée

**Pourquoi rejeté ?**
- Paradigme atomique pas nécessaire
- Complexité vs bénéfices pas justifiée

## 🎯 Decision Rationale

### Facteurs Clés

1. **SSR & SEO Critical (Weight: 40%)**
   - 714k pages SEO = 95% du trafic organique
   - Google indexe contenu serveur
   - Remix loaders = SSR parfait ✅

2. **Progressive Enhancement (Weight: 25%)**
   - E-commerce = accessibility essentielle
   - FormData = fonctionne sans JS
   - Redux/Zustand = requiert JS ❌

3. **Developer Experience (Weight: 20%)**
   - 1-2 devs = simplicité critique
   - Remix pattern = zero boilerplate
   - Redux = semaines de setup ❌

4. **Performance (Weight: 15%)**
   - TTFB < 200ms = cache serveur (Redis)
   - Loaders = fetch serveur rapide
   - Client state = latency réseau

### Trade-offs Acceptés

✅ **On accepte** :
- Moins de réactivité client (vs Redux)
- DevTools limités (vs Redux DevTools)
- Cross-route state via Context (vs global store)

🎁 **On gagne** :
- SSR parfait = SEO optimal
- Progressive Enhancement = accessibility
- Zero boilerplate = vélocité développement
- HTTP cache = performance gratuite

## 📈 Consequences

### Positive ✅

1. **SEO Preserved**
   - 714k pages SEO restent indexables
   - Contenu dans HTML initial
   - Pas de JavaScript waterfall

2. **Performance Optimale**
   - TTFB < 200ms (Redis cache)
   - LCP < 2.5s (SSR)
   - Cache-Control headers automatiques

3. **Developer Velocity**
   - Pas de Redux boilerplate
   - TypeScript inference gratuite
   - Debugging simple (Network tab)

4. **Accessibility**
   - Fonctionne sans JavaScript
   - FormData = Progressive Enhancement
   - Screen readers OK

5. **Maintenance**
   - Code simple = onboarding facile
   - Moins de bugs (moins de complexité)
   - Pattern standard Remix

### Negative ❌

1. **Client Reactivity Limitée**
   - Pas de Redux DevTools time-travel
   - Optimistic UI manuel
   - **Mitigation** : `useFetcher()` + `fetcher.state`

2. **Cross-Route State Complexe**
   - Pas de global store
   - Besoin Context ou URL params
   - **Mitigation** : Context pour auth/vehicle (3 contexts max)

3. **Offline Support Limité**
   - Pas de Redux Persist out-of-the-box
   - **Mitigation** : `localStorage` + Service Worker

4. **Real-time Updates**
   - Pas de WebSocket integration native
   - **Mitigation** : `useRevalidator()` + polling

### Neutral ℹ️

1. **Learning Curve**
   - Remix pattern = standard React
   - Mais mental shift vs SPA Redux

2. **Testing**
   - Loaders/actions = facile à tester (unit)
   - Moins de mocks vs Redux

## 🔧 Implementation

### Changes Required

- [x] **Loaders pour data fetching** (déjà en place)
  - 213 routes avec loaders
  - TypeScript inference automatique
  - Cache Redis backend

- [x] **Actions pour mutations** (déjà en place)
  - `useFetcher()` pour mutations optimistes
  - FormData Progressive Enhancement
  - Revalidation automatique

- [ ] **React Context pour state cross-component**
  - `VehicleContext` : véhicule sélectionné (✅ fait)
  - `ThemeContext` : dark/light mode
  - `NotificationContext` : toasts, alerts

- [ ] **localStorage pour persistence**
  - Panier offline
  - Préférences utilisateur
  - Historique recherche

### Pattern Implementations

#### 1. Server Data (Loader Pattern)

```typescript
// ✅ GOOD: Loader avec cache
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const cacheKey = `products:${url.searchParams.toString()}`;

  // Try Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return json(JSON.parse(cached), {
      headers: { "X-Cache": "HIT" }
    });
  }

  // Fetch from API
  const products = await fetchProducts(url.searchParams);

  // Cache for 5min
  await redis.set(cacheKey, JSON.stringify(products), "EX", 300);

  return json(products, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "X-Cache": "MISS"
    }
  });
}
```

#### 2. Mutations (Action Pattern)

```typescript
// ✅ GOOD: Action avec revalidation
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add-to-cart") {
    const productId = formData.get("productId");
    const quantity = parseInt(formData.get("quantity") as string);

    // Call backend API
    const response = await fetch(`${API_URL}/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": request.headers.get("Cookie") || ""
      },
      body: JSON.stringify({ productId, quantity })
    });

    if (!response.ok) {
      return json({ error: "Échec ajout panier" }, { status: 400 });
    }

    // Invalidate cache
    await redis.del(`cart:${userId}`);

    // Redirect + revalidation auto
    return redirect("/cart");
  }

  return json({ success: false }, { status: 400 });
}

// Component avec optimistic UI
export default function ProductCard({ product }) {
  const fetcher = useFetcher();
  const isAdding = fetcher.state === "submitting";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="add-to-cart" />
      <input type="hidden" name="productId" value={product.id} />
      <button disabled={isAdding}>
        {isAdding ? "Ajout..." : "Ajouter au panier"}
      </button>
    </fetcher.Form>
  );
}
```

#### 3. URL State (Search Params)

```typescript
// ✅ GOOD: Filtres dans URL
export default function ProductsFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";
  const sort = searchParams.get("sort") || "price";

  const handleFilterChange = (newCategory: string) => {
    setSearchParams(prev => {
      prev.set("category", newCategory);
      return prev;
    });
  };

  return (
    <select value={category} onChange={e => handleFilterChange(e.target.value)}>
      <option value="all">Toutes</option>
      <option value="brake">Freinage</option>
      <option value="engine">Moteur</option>
    </select>
  );
}
```

#### 4. React Context (Cross-Component State)

```typescript
// ✅ GOOD: Context pour véhicule sélectionné
// File: frontend/app/hooks/useVehiclePersistence.tsx

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
}

const VehicleContext = createContext<{
  vehicle: Vehicle | null;
  setVehicle: (v: Vehicle | null) => void;
} | undefined>(undefined);

export function VehicleProvider({ children }: { children: ReactNode }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(() => {
    // Load from localStorage
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("userVehicle");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    // Persist to localStorage
    if (vehicle) {
      localStorage.setItem("userVehicle", JSON.stringify(vehicle));
    } else {
      localStorage.removeItem("userVehicle");
    }
  }, [vehicle]);

  return (
    <VehicleContext.Provider value={{ vehicle, setVehicle }}>
      {children}
    </VehicleContext.Provider>
  );
}

export function useVehicle() {
  const context = useContext(VehicleContext);
  if (!context) throw new Error("useVehicle must be within VehicleProvider");
  return context;
}
```

#### 5. Local UI State

```typescript
// ✅ GOOD: useState pour UI éphémère
export function ProductModal({ product }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Voir détails</button>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <h2>{product.name}</h2>
        <p>{product.description}</p>
      </Dialog>
    </>
  );
}
```

### Cache Strategy

| Type | Strategy | TTL | Invalidation |
|------|----------|-----|--------------|
| **Products List** | Redis + HTTP | 5min | Manual + on mutation |
| **Product Detail** | Redis + HTTP | 10min | On product update |
| **User Session** | Redis | 7 days | On logout |
| **Cart** | Redis + Cookie | Session | On cart mutation |
| **Search Results** | Redis | 1min | On new products |

### When to Use What

```typescript
// ❓ Quand utiliser quel pattern ?

// 1. URL STATE = filtres, pagination, tri
// ✅ Use: useSearchParams()
// ✅ Example: ?category=brake&page=2&sort=price

// 2. SERVER DATA = produits, users, orders
// ✅ Use: loader() + useLoaderData()
// ✅ Example: Catalogue produits, détails commande

// 3. MUTATIONS = add to cart, login, checkout
// ✅ Use: action() + useFetcher()
// ✅ Example: Ajouter panier, soumettre formulaire

// 4. UI STATE = modal open, accordion expanded
// ✅ Use: useState() local
// ✅ Example: Modal visibilité, tabs active

// 5. CROSS-COMPONENT = auth, vehicle, theme
// ✅ Use: React Context
// ✅ Example: User session, véhicule sélectionné

// 6. PERSISTENT CLIENT = offline cart, preferences
// ✅ Use: localStorage + useEffect
// ✅ Example: Panier offline, historique recherche

// ❌ AVOID:
// - Redux pour data serveur (use loaders)
// - Context pour data fetching (use loaders)
// - localStorage pour auth (use secure cookies)
```

### Migration Path

**Phase 1: Audit actuel** ✅ (Fait)
- [x] 213 routes utilisent loaders
- [x] 3 React Contexts (Vehicle, Notification, ConversionTracking)
- [x] Actions pour mutations (cart, login, forms)
- [x] localStorage pour véhicule

**Phase 2: Consolidation**
- [ ] Documenter tous les loaders
- [ ] Standardiser cache strategy
- [ ] Audit Context usage (limiter à 3-5 max)

**Phase 3: Optimisation**
- [ ] Optimistic UI avec `useFetcher()`
- [ ] Service Worker pour offline
- [ ] WebSocket pour real-time (optionnel)

### Rollback Plan

Si Remix pattern insuffisant :
1. Identifier use cases problématiques
2. Évaluer Zustand pour state client isolé
3. Garder loaders pour SSR
4. Zustand = complément, pas remplacement

## 📊 Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **TTFB** | < 200ms | ~150ms | ✅ |
| **LCP** | < 2.5s | ~2.1s | ✅ |
| **FID** | < 100ms | ~50ms | ✅ |
| **CLS** | < 0.1 | ~0.05 | ✅ |
| **SEO Pages Indexed** | > 95% | 95.2% | ✅ |
| **Cache Hit Rate** | > 80% | ~85% | ✅ |
| **Hydration Errors** | 0 | 0 | ✅ |

## ⚠️ Risks

### Risk 1: Client Reactivity Insuffisante

**Probability:** Medium  
**Impact:** Medium  
**Mitigation:**
- Use `useFetcher()` pour optimistic UI
- `useRevalidator()` pour refresh manuel
- Évaluer Zustand si besoin client state complexe

### Risk 2: Cross-Route State Complexe

**Probability:** Low  
**Impact:** Low  
**Mitigation:**
- Limiter Context à 3-5 max
- URL params pour state partageable
- localStorage pour persistence

### Risk 3: Offline Support Limité

**Probability:** Low  
**Impact:** Medium  
**Mitigation:**
- Service Worker pour offline
- localStorage pour panier
- Sync API backend quand online

## 🔗 Related Decisions

- **Relates to:** [ADR-002: Monorepo Architecture](./002-monorepo-structure.md)
- **Relates to:** [Feature: Authentication System](../features/auth-system.md)
- **Depends on:** Remix framework choice (implicite)

## 📚 References

- [Remix Documentation - Data Loading](https://remix.run/docs/en/main/guides/data-loading)
- [Remix Documentation - Actions](https://remix.run/docs/en/main/guides/data-writes)
- [React Context Best Practices](https://react.dev/learn/passing-data-deeply-with-context)
- [Progressive Enhancement](https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement)
- [Web Vitals](https://web.dev/vitals/)

## 📝 Notes

**Existing Contexts in Codebase:**
1. `VehicleContext` - Véhicule sélectionné (useVehiclePersistence.tsx)
2. `NotificationContext` - Toasts/alerts (NotificationContainer.tsx)
3. `ConversionTrackingContext` - Analytics (useConversionTracking.tsx)
4. `CarouselContext` - UI component (carousel.tsx)

**Patterns Observed:**
- 213 routes with loaders (100% coverage)
- `export async function loader` pattern standard
- `useLoaderData<typeof loader>` TypeScript inference
- `useFetcher()` pour mutations optimistes
- `useSearchParams()` pour filtres URL

## 🔄 Review

**Review Date:** 2026-11-14 (1 an)  
**Review Criteria:**
- Si client reactivity devient bloquante
- Si cross-route state trop complexe
- Si offline support critique business
- Si nouvelle version Remix change paradigme

## 📅 Timeline

- **Proposed:** 2025-11-14
- **Discussed:** 2025-11-14
- **Decided:** 2025-11-14
- **Implemented:** 2024-08 (déjà en production)

## 🔄 Change Log

### v1.0.0 (2025-11-14)

- Initial ADR documenting existing Remix pattern
- Alternatives analysis (Redux, Zustand, Jotai)
- Implementation patterns documented
- Cache strategy defined
- Success metrics baseline
