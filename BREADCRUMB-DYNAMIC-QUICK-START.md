# 🚀 Implémentation Rapide : Breadcrumb Dynamique avec Véhicule

## ✅ Ce qui a été créé

1. **`frontend/app/utils/vehicle-cookie.ts`** - Helpers de gestion du cookie véhicule
2. **`frontend/app/components/vehicle/VehicleFilterBadge.tsx`** - Badge UI pour afficher le véhicule actif
3. **`BREADCRUMB-DYNAMIC-VEHICLE.md`** - Documentation complète

## 🎯 Comment l'utiliser

### Étape 1 : Modifier le Loader de `pieces.$slug.tsx`

```tsx
import { getVehicleFromCookie, buildBreadcrumbWithVehicle } from '~/utils/vehicle-cookie';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { slug } = params;
  
  // 1. Récupérer véhicule depuis cookie
  const selectedVehicle = await getVehicleFromCookie(
    request.headers.get("Cookie")
  );
  
  // 2. ... fetch gamme data ...
  
  // 3. Construire breadcrumb de base
  const baseBreadcrumb = [
    { label: "Accueil", href: "/" },
    { label: "Pièces", href: "/pieces/catalogue" },
    { label: gammeData.pg_name, current: true }
  ];
  
  // 4. Ajouter véhicule si présent
  const breadcrumbItems = buildBreadcrumbWithVehicle(
    baseBreadcrumb,
    selectedVehicle
  );
  
  return json({
    breadcrumbs: { items: breadcrumbItems },
    selectedVehicle, // ← Passer au component
    // ... rest of data
  });
}
```

### Étape 2 : Afficher le Breadcrumb et le Badge

```tsx
import { VehicleFilterBadge } from '~/components/vehicle/VehicleFilterBadge';

export default function PiecesGammeRoute() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div>
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-4">
        <Breadcrumbs 
          items={data.breadcrumbs.items}
          enableSchema={true}
          separator="arrow"
          showHome={true}
        />
      </div>
      
      {/* Badge véhicule actif (si présent) */}
      {data.selectedVehicle && (
        <div className="container mx-auto px-4 mt-4">
          <VehicleFilterBadge 
            vehicle={data.selectedVehicle}
            showDetails={true}
          />
        </div>
      )}
      
      {/* VehicleSelector */}
      <VehicleSelectorV2
        onVehicleSelect={(vehicle) => {
          // Stocker dans cookie
          const cookieValue = setVehicleCookie({
            marque_id: vehicle.brand.id,
            marque_name: vehicle.brand.name,
            marque_alias: vehicle.brand.alias,
            modele_id: vehicle.model.id,
            modele_name: vehicle.model.name,
            modele_alias: vehicle.model.alias,
            type_id: vehicle.type.id,
            type_name: vehicle.type.name,
            type_alias: vehicle.type.alias
          });
          
          document.cookie = cookieValue;
          window.location.reload();
        }}
      />
      
      {/* Reste du contenu... */}
    </div>
  );
}
```

## 🎨 Résultat Visuel

### Avec Véhicule Sélectionné

```
┌────────────────────────────────────────────────────────────┐
│  🍞 Accueil → Pièces → Filtre à Huile → Renault Avantime  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  🚗 Filtré pour : Renault Avantime                         │
│     2.0 16V                                   [× Retirer]  │
└────────────────────────────────────────────────────────────┘

📦 12 Filtres à Huile compatibles Renault Avantime
```

### Sans Véhicule

```
┌────────────────────────────────────────────────────────────┐
│  🍞 Accueil → Pièces → Filtre à Huile                      │
└────────────────────────────────────────────────────────────┘

📦 1,247 Filtres à Huile (tous véhicules)
```

## 📊 Schema.org Généré

**Important :** Le Schema.org reste à 3 niveaux (sans véhicule) pour éviter confusion SEO.

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "position": 1, "name": "Accueil", "item": "https://..." },
    { "position": 2, "name": "Pièces", "item": "https://..." },
    { "position": 3, "name": "Filtre à Huile", "item": "https://..." }
  ]
}
```

Le breadcrumb **visuel** affiche 4 niveaux, mais le Schema.org reste canonique.

## ⚙️ Configuration Avancée

### Breadcrumb Visuel ET Schema.org Différents

Si vous voulez un Schema.org avec véhicule :

```tsx
// Breadcrumb visuel (4 niveaux avec véhicule)
const visualBreadcrumb = buildBreadcrumbWithVehicle(baseBreadcrumb, selectedVehicle);

// Schema.org canonique (3 niveaux sans véhicule)
const schemaBreadcrumb = baseBreadcrumb;

<Breadcrumbs 
  items={visualBreadcrumb}
  schemaItems={schemaBreadcrumb} // ← Différent
  enableSchema={true}
/>
```

**Note :** Nécessite modification du composant `Breadcrumbs.tsx` pour accepter `schemaItems`.

## 🧪 Tests

### Test 1 : Cookie Présent

```bash
# Créer cookie manuellement
document.cookie = 'selected_vehicle=%7B%22marque_id%22%3A140%2C%22marque_name%22%3A%22Renault%22%2C...%7D'

# Recharger page
window.location.reload()

# Vérifier breadcrumb affiché
✅ Accueil → Pièces → Filtre à Huile → Renault Avantime
```

### Test 2 : Cookie Absent

```bash
# Supprimer cookie
document.cookie = 'selected_vehicle=; Max-Age=0'

# Recharger page
window.location.reload()

# Vérifier breadcrumb affiché
✅ Accueil → Pièces → Filtre à Huile
```

### Test 3 : Bouton "Retirer"

```bash
# Cliquer sur [× Retirer]
# Cookie supprimé automatiquement
# Page rechargée
✅ Breadcrumb revient à 3 niveaux
```

## 🔧 Dépendances Requises

```bash
npm install cookie
# ou
yarn add cookie
```

Le package `cookie` est utilisé pour `parse()` et `serialize()`.

## 📝 Checklist Implémentation

- [x] Créer `utils/vehicle-cookie.ts`
- [x] Créer `components/vehicle/VehicleFilterBadge.tsx`
- [ ] Modifier `pieces.$slug.tsx` loader
- [ ] Ajouter `VehicleFilterBadge` dans le component
- [ ] Mettre à jour `VehicleSelectorV2` pour stocker cookie
- [ ] Tester avec cookie présent/absent
- [ ] Valider Schema.org (3 niveaux)
- [ ] Déployer en production

## 🎯 Prochaines Pages à Implémenter

Cette logique peut s'appliquer à :

1. **`pieces.catalogue.tsx`** - Catalogue général avec véhicule
2. **Pages blog** - Articles filtrés par véhicule
3. **Pages recherche** - Résultats filtrés par véhicule

Même pattern partout :
```tsx
const selectedVehicle = await getVehicleFromCookie(request.headers.get("Cookie"));
const breadcrumb = buildBreadcrumbWithVehicle(baseBreadcrumb, selectedVehicle);
```

## ✅ Résultat Final

**Avec véhicule :**
```
Breadcrumb: Accueil → Pièces → Filtre à Huile → Renault Avantime
Badge: 🚗 Filtré pour : Renault Avantime [× Retirer]
Résultats: 12 pièces compatibles
```

**Sans véhicule :**
```
Breadcrumb: Accueil → Pièces → Filtre à Huile
Badge: (absent)
Résultats: 1,247 pièces (tous véhicules)
```

**SEO :**
```
Schema.org: Toujours 3 niveaux (canonical)
URL: /pieces/filtre-a-huile-12 (propre)
Cookie: 30 jours de persistance
```

---

**🎉 C'est prêt ! Il ne reste qu'à modifier `pieces.$slug.tsx` pour l'activer.**
