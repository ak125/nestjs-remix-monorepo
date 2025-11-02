# 🚗 Breadcrumb Dynamique avec Véhicule Sélectionné

## 📋 Cas d'Usage

**Scénario :** Utilisateur arrive sur `/pieces/filtre-a-huile` avec un véhicule déjà sélectionné (stocké en session/cookie/state).

**Breadcrumb attendu :**
```
Accueil → Pièces → Filtre à Huile → Renault Avantime
```

**Différence avec URL directe :**
- **URL directe** : `/pieces/freinage/renault/avantime/2-0.html`  
  → Breadcrumb : `Accueil → Freinage → Renault Avantime → 25 pièces`
  
- **URL gamme + véhicule en session** : `/pieces/filtre-a-huile` (+ cookie véhicule)  
  → Breadcrumb : `Accueil → Pièces → Filtre à Huile → Renault Avantime`

---

## 🎯 Structure du Breadcrumb

### 4 Niveaux

| Position | Label | Type | Lien |
|----------|-------|------|------|
| 1 | Accueil | Fixe | `/` |
| 2 | Pièces | Fixe | `/pieces/catalogue` |
| 3 | {Gamme} | Dynamique (URL) | `/pieces/{slug}` |
| 4 | {Véhicule} | Dynamique (Session) | `/constructeurs/{brand}/{model}/{type}` ou `null` |

**Particularités :**
- Niveau 4 **optionnel** : affiché uniquement si véhicule sélectionné
- Niveau 4 peut pointer vers la page véhicule OU vers l'URL combinée
- Si pas de véhicule : 3 niveaux seulement

---

## 🔧 Implémentation Technique

### Option 1 : Véhicule dans Cookie/Session (Recommandé)

**Avantages :**
- ✅ Pas de modification d'URL
- ✅ Véhicule persiste entre les pages
- ✅ SEO friendly (URL propre `/pieces/filtre-a-huile`)

**Inconvénients :**
- ⚠️ Breadcrumb différent selon l'état session
- ⚠️ Schema.org peut varier (cache complexe)

**Code exemple :**

```tsx
// pieces.$slug.tsx

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  
  // 1. Récupérer véhicule depuis session/cookie
  const cookieHeader = request.headers.get("Cookie");
  const selectedVehicle = await getVehicleFromCookie(cookieHeader);
  
  // 2. Construire breadcrumb avec véhicule optionnel
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Accueil", href: "/" },
    { label: "Pièces", href: "/pieces/catalogue" },
    { label: gammeData.pg_name, href: `/pieces/${slug}` }
  ];
  
  // 3. Ajouter véhicule si disponible
  if (selectedVehicle) {
    breadcrumbItems.push({
      label: `${selectedVehicle.marque} ${selectedVehicle.modele}`,
      href: `/constructeurs/${selectedVehicle.marque_alias}-${selectedVehicle.marque_id}/${selectedVehicle.modele_alias}-${selectedVehicle.modele_id}/${selectedVehicle.type_id}.html`
    });
  }
  
  return json({ 
    breadcrumbs: { items: breadcrumbItems },
    // ...
  });
}
```

---

### Option 2 : Véhicule dans Query String

**Exemple URL :**
```
/pieces/filtre-a-huile?vehicle=renault-avantime-123
```

**Avantages :**
- ✅ URL contient toute l'info (partage facile)
- ✅ Breadcrumb déterministe (même pour Google)
- ✅ Cache simplifié

**Inconvénients :**
- ❌ URL longue et complexe
- ❌ Duplicate content possible (avec/sans query)
- ❌ Moins SEO friendly

---

### Option 3 : Véhicule dans State React (Client-side)

**Avantages :**
- ✅ Pas de cookie/session
- ✅ Gestion état moderne

**Inconvénients :**
- ❌ **Pas de Schema.org server-side** (Google ne le voit pas)
- ❌ Breadcrumb généré côté client (mauvais SEO)

**❌ NE PAS UTILISER pour SEO**

---

## 🎨 Interface Utilisateur

### Cas 1 : Véhicule Sélectionné

```
┌────────────────────────────────────────────────────────────┐
│  🍞 Accueil → Pièces → Filtre à Huile → Renault Avantime  │
│     [/]     [/pieces] [page actuelle]  [véhicule actif]   │
└────────────────────────────────────────────────────────────┘

📦 Filtres actifs :
  ✅ Véhicule : Renault Avantime 2.0 16V (2001-2003)
  [× Retirer le filtre]

🔍 Résultats : 12 Filtres à Huile compatibles Renault Avantime
```

### Cas 2 : Aucun Véhicule Sélectionné

```
┌────────────────────────────────────────────────────────────┐
│  🍞 Accueil → Pièces → Filtre à Huile                      │
│     [/]     [/pieces] [page actuelle]                      │
└────────────────────────────────────────────────────────────┘

🚗 Sélectionnez votre véhicule pour voir les pièces compatibles
[Choisir un véhicule]

🔍 Résultats : 1,247 Filtres à Huile (tous véhicules)
```

---

## 📊 Schema.org Dynamique

### Avec Véhicule Sélectionné (4 niveaux)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://site.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Pièces",
      "item": "https://site.com/pieces/catalogue"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Filtre à Huile",
      "item": "https://site.com/pieces/filtre-a-huile-12"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Renault Avantime"
      // ⚠️ Pas d'URL car c'est un filtre, pas une page dédiée
    }
  ]
}
```

### Sans Véhicule (3 niveaux)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Accueil",
      "item": "https://site.com/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Pièces",
      "item": "https://site.com/pieces/catalogue"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Filtre à Huile",
      "item": "https://site.com/pieces/filtre-a-huile-12"
    }
  ]
}
```

---

## 🔄 Gestion du Cookie Véhicule

### Structure Cookie

```typescript
interface VehicleCookie {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  type_id: number;
  type_name: string;
  type_alias: string;
  selected_at: string; // ISO timestamp
}
```

### Helper Functions

```typescript
// utils/vehicle-cookie.ts

export async function getVehicleFromCookie(
  cookieHeader: string | null
): Promise<VehicleCookie | null> {
  if (!cookieHeader) return null;
  
  const cookies = parse(cookieHeader);
  const vehicleData = cookies.selected_vehicle;
  
  if (!vehicleData) return null;
  
  try {
    return JSON.parse(vehicleData);
  } catch {
    return null;
  }
}

export function setVehicleCookie(vehicle: VehicleCookie): string {
  const vehicleData = JSON.stringify({
    ...vehicle,
    selected_at: new Date().toISOString()
  });
  
  return serialize('selected_vehicle', vehicleData, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
    httpOnly: false, // Accessible en JS pour UI
    sameSite: 'lax'
  });
}

export function clearVehicleCookie(): string {
  return serialize('selected_vehicle', '', {
    path: '/',
    maxAge: 0
  });
}
```

---

## 🎯 Implémentation Complète

### 1. Modifier `pieces.$slug.tsx`

```tsx
import { getVehicleFromCookie } from '~/utils/vehicle-cookie';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  
  // Récupérer véhicule depuis cookie
  const selectedVehicle = await getVehicleFromCookie(
    request.headers.get("Cookie")
  );
  
  // ... fetch gamme data ...
  
  // Construire breadcrumb dynamique
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Accueil", href: "/" },
    { label: "Pièces", href: "/pieces/catalogue" },
    { label: gammeData.pg_name, href: `/pieces/${slug}` }
  ];
  
  // Ajouter véhicule si présent
  if (selectedVehicle) {
    breadcrumbItems.push({
      label: `${selectedVehicle.marque_name} ${selectedVehicle.modele_name}`,
      href: `/constructeurs/${selectedVehicle.marque_alias}-${selectedVehicle.marque_id}/${selectedVehicle.modele_alias}-${selectedVehicle.modele_id}/${selectedVehicle.type_id}.html`
    });
  }
  
  return json({
    breadcrumbs: { items: breadcrumbItems },
    selectedVehicle,
    // ...
  });
}

export default function PiecesGammeRoute() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumbs 
        items={data.breadcrumbs.items}
        enableSchema={true}
      />
      
      {/* Badge véhicule actif */}
      {data.selectedVehicle && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-blue-600">
                🚗 Filtré pour : <strong>{data.selectedVehicle.marque_name} {data.selectedVehicle.modele_name}</strong>
              </span>
            </div>
            <button 
              onClick={handleClearVehicle}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              × Retirer le filtre
            </button>
          </div>
        </div>
      )}
      
      {/* VehicleSelector */}
      <VehicleSelectorV2
        mode="compact"
        currentVehicle={data.selectedVehicle ? {
          brand: { id: data.selectedVehicle.marque_id, name: data.selectedVehicle.marque_name },
          model: { id: data.selectedVehicle.modele_id, name: data.selectedVehicle.modele_name },
          type: { id: data.selectedVehicle.type_id, name: data.selectedVehicle.type_name }
        } : undefined}
        onVehicleSelect={(vehicle) => {
          // Stocker dans cookie et recharger
          document.cookie = setVehicleCookie({
            marque_id: vehicle.brand.id,
            marque_name: vehicle.brand.name,
            // ...
          });
          window.location.reload();
        }}
      />
      
      {/* Reste du contenu... */}
    </div>
  );
}
```

---

## ⚠️ Considérations SEO

### Problème : Breadcrumb Variable

**Situation :**
- Google crawle `/pieces/filtre-a-huile` **sans cookie**
- Google voit breadcrumb à 3 niveaux : `Accueil → Pièces → Filtre à Huile`
- Utilisateur voit breadcrumb à 4 niveaux : `Accueil → Pièces → Filtre à Huile → Renault Avantime`

**Impact :**
- ⚠️ Schema.org différent selon session
- ✅ URL canonique identique (pas de duplicate content)
- ✅ Google indexe la version "générique" (OK)

### Solution : Breadcrumb Canonique

**Toujours générer Schema.org avec 3 niveaux (sans véhicule) :**

```tsx
// Breadcrumb visuel : 4 niveaux si véhicule
const visualBreadcrumb = [...baseItems, vehicleItem];

// Schema.org : 3 niveaux (toujours)
const schemaBreadcrumb = baseItems;

<Breadcrumbs 
  items={visualBreadcrumb}
  schemaItems={schemaBreadcrumb} // ← Séparé pour SEO
  enableSchema={true}
/>
```

---

## 📊 Comparaison des Approches

| Critère | Cookie/Session | Query String | Client-side State |
|---------|---------------|--------------|-------------------|
| **URL Propre** | ✅ Oui | ❌ Non | ✅ Oui |
| **SEO Friendly** | ✅ Oui | ⚠️ Moyen | ❌ Non |
| **Partage URL** | ❌ Non | ✅ Oui | ❌ Non |
| **Schema.org** | ✅ Server-side | ✅ Server-side | ❌ Client-side |
| **Persistance** | ✅ 30 jours | ❌ URL only | ❌ Session only |
| **Complexité** | ⚠️ Moyenne | ✅ Simple | ✅ Simple |

**🏆 Recommandation : Cookie/Session**

---

## ✅ Checklist Implémentation

- [ ] Créer `utils/vehicle-cookie.ts`
- [ ] Modifier `pieces.$slug.tsx` loader
- [ ] Ajouter logique breadcrumb dynamique
- [ ] Afficher badge véhicule actif
- [ ] Bouton "Retirer filtre véhicule"
- [ ] VehicleSelector persiste sélection dans cookie
- [ ] Schema.org canonique (sans véhicule)
- [ ] Breadcrumb visuel avec véhicule
- [ ] Tester avec/sans cookie
- [ ] Valider Google Rich Results

---

## 🎯 Résultat Final

**Avec véhicule sélectionné :**
```
URL: /pieces/filtre-a-huile-12
Breadcrumb visuel: Accueil → Pièces → Filtre à Huile → Renault Avantime
Schema.org: Accueil → Pièces → Filtre à Huile (3 niveaux - canonical)
Filtres: ✅ Véhicule = Renault Avantime
Résultats: 12 pièces compatibles
```

**Sans véhicule :**
```
URL: /pieces/filtre-a-huile-12
Breadcrumb: Accueil → Pièces → Filtre à Huile
Schema.org: Accueil → Pièces → Filtre à Huile (3 niveaux)
Filtres: ∅ Aucun
Résultats: 1,247 pièces (tous véhicules)
```

---

## 🚀 Prochaines Étapes

1. Implémenter `vehicle-cookie.ts`
2. Modifier `pieces.$slug.tsx`
3. Tester en dev avec cookie manipulation
4. Valider Schema.org
5. Déployer en production
6. Monitorer comportement utilisateur (analytics)
