# Guide de développement: Workflow recommandé

## Principe fondamental: Vérifier l'existant avant d'implémenter

### Pourquoi cette pratique?

Avant d'implémenter une nouvelle fonctionnalité ou de modifier du code existant, il est **essentiel** de vérifier ce qui existe déjà dans le codebase. Cela permet de:

- ✅ Éviter les duplications de code
- ✅ Maintenir la cohérence du projet
- ✅ Comprendre les patterns existants
- ✅ Identifier les services/composants réutilisables
- ✅ Respecter les conventions établies
- ✅ Gagner du temps (ne pas réinventer la roue)

### Workflow recommandé

#### 1. Recherche sémantique (`semantic_search`)

Commencez par une recherche sémantique pour identifier les fichiers et composants pertinents:

```typescript
// Exemple de recherche pour "images de véhicules dans hero section"
semantic_search("vehicle detail page route tsx hero section images")
```

**Résultats typiques:**
- Composants similaires (`VehicleCard`, `VehicleCarousel`)
- Services existants (`brandColorsService`, `catalogFamiliesApi`)
- Patterns d'URL d'images
- Conventions de nommage

#### 2. Lecture ciblée (`read_file`)

Une fois les fichiers identifiés, lisez-les par sections pour comprendre l'implémentation:

```typescript
// Lire la section hero (lignes 620-720)
read_file("/path/to/file.tsx", offset: 620, limit: 100)
```

**Points d'attention:**
- Structure des données (interfaces TypeScript)
- Appels API et leurs réponses
- Composants réutilisables
- Gestion des erreurs et fallbacks
- Styling et design patterns

#### 3. Recherche de patterns (`grep_search`)

Recherchez des patterns spécifiques dans les fichiers identifiés:

```typescript
// Rechercher les champs d'images
grep_search("modele_pic|type_image|vehicle\..*image", isRegexp: true)
```

**Utilisations:**
- Trouver les conventions de nommage
- Identifier les champs de données disponibles
- Repérer les transformations d'URLs
- Détecter les services helpers

#### 4. Analyse des types et APIs

Vérifiez les définitions de types et les contrats d'API:

- **Frontend**: Interfaces TypeScript (`VehicleData`, `LoaderData`)
- **Backend**: DTOs, Services, Entités
- **API**: Réponses JSON, structures de données

#### 5. Documentation des découvertes

Avant d'implémenter, documentez ce que vous avez trouvé:

```markdown
## État actuel
- Image hardcodée: OUI/NON
- Champs disponibles: [liste]
- Services existants: [liste]

## Problèmes identifiés
1. [Problème 1]
2. [Problème 2]

## Recommandations
- Action 1: [description]
- Action 2: [description]
```

### Exemple concret: Ajout d'images de véhicules

#### Contexte
Tâche: Ajouter les images correspondantes dans la hero section des pages `/constructeurs/{brand}/{model}/{type}.html`

#### Étapes suivies

**1. Recherche initiale**
```bash
semantic_search("vehicle detail page route tsx cayenne porsche hero section")
```
→ Trouvé: `constructeurs.$brand.$model.$type.tsx` (965 lignes)

**2. Lecture de la hero section**
```bash
read_file("constructeurs.$brand.$model.$type.tsx", lines: 620-720)
```
→ Découverte: Image hardcodée BMW Serie 2 pour tous les véhicules

**3. Recherche des champs image**
```bash
grep_search("modele_pic|type_image|vehicle\..*image")
```
→ Résultat: Aucun champ `modele_pic` dans l'interface `VehicleData`

**4. Analyse du loader**
```bash
read_file("constructeurs.$brand.$model.$type.tsx", lines: 61-211)
```
→ Constat: API `/api/vehicles/types/${type_id}` ne récupère pas `modele_pic`

**5. Vérification backend**
```bash
read_file("backend/src/modules/vehicles/vehicles.service.ts", lines: 1040-1120)
```
→ Problème: SELECT n'inclut pas `modele_pic` ni `marque_alias`

**6. Recherche de patterns existants**
```bash
semantic_search("VehicleCard VehicleCarousel modele_pic image")
```
→ Trouvé: `VehicleCard`, `OptimizedModelImage` avec le pattern d'URL correct

**7. Implémentation**

Avec toutes ces informations, l'implémentation a été précise et cohérente:

- ✅ Correction backend: Ajout de `modele_pic` et `marque_alias` dans les SELECT
- ✅ Mise à jour interface: Ajout de `modele_pic?: string` dans `VehicleData`
- ✅ Remplacement image hardcodée: URL dynamique avec fallback icon `<Car />`
- ✅ Respect du pattern existant: Même structure d'URL que `VehicleCard`

### Outils de recherche disponibles

| Outil | Usage | Quand l'utiliser |
|-------|-------|------------------|
| `semantic_search` | Recherche sémantique large | Découverte initiale, trouver des fichiers similaires |
| `read_file` | Lecture précise de fichiers | Comprendre l'implémentation détaillée |
| `grep_search` | Recherche de patterns regex | Trouver des conventions, patterns spécifiques |
| `file_search` | Recherche par nom de fichier | Localiser des fichiers spécifiques |
| `list_dir` | Lister un répertoire | Explorer la structure d'un dossier |

### Checklist avant implémentation

- [ ] J'ai recherché des fonctionnalités similaires existantes
- [ ] J'ai lu les fichiers pertinents identifiés
- [ ] J'ai compris les patterns et conventions utilisés
- [ ] J'ai vérifié les interfaces TypeScript et types de données
- [ ] J'ai identifié les services/helpers réutilisables
- [ ] J'ai documenté l'état actuel et les problèmes
- [ ] Mon implémentation respecte les patterns existants
- [ ] J'ai prévu des fallbacks en cas d'erreur

### Anti-patterns à éviter

❌ **Implémenter directement sans recherche**
```typescript
// Mauvais: Créer un nouveau service sans vérifier l'existant
const newImageService = { ... }
```

❌ **Dupliquer du code existant**
```typescript
// Mauvais: Recréer une fonction qui existe déjà
function getVehicleImageUrl(vehicle) { ... }
// Alors que OptimizedModelImage existe déjà!
```

❌ **Ignorer les conventions établies**
```typescript
// Mauvais: Utiliser un pattern d'URL différent
const imageUrl = `/images/vehicles/${vehicle.id}.jpg`
// Alors que le pattern est: marques-modeles/${marque_alias}/${modele_pic}
```

❌ **Ne pas prévoir de fallback**
```typescript
// Mauvais: Afficher uniquement l'image sans gérer l'erreur
<img src={vehicle.modele_pic} alt="..." />
```

### Bonnes pratiques

✅ **Réutiliser les composants existants**
```typescript
// Bon: Utiliser OptimizedModelImage qui existe déjà
<OptimizedModelImage 
  brandAlias={vehicle.marque_alias}
  modelPic={vehicle.modele_pic}
  alt={`${vehicle.marque_name} ${vehicle.modele_name}`}
/>
```

✅ **Respecter les patterns d'URL**
```typescript
// Bon: Suivre la convention établie
const imageUrl = `constructeurs-automobiles/marques-modeles/${vehicle.marque_alias}/${vehicle.modele_pic}`
```

✅ **Toujours prévoir des fallbacks**
```typescript
// Bon: Gérer le cas où l'image n'existe pas
{vehicle.modele_pic ? (
  <img src={imageUrl} alt="..." onError={handleError} />
) : (
  <Car className="w-16 h-16 text-gray-400" />
)}
```

✅ **Documenter les découvertes**
```markdown
# Analyse: Images de véhicules
## État actuel
- Image hardcodée: OUI
- Champs manquants: modele_pic, marque_alias

## Actions
1. Corriger backend SELECT
2. Mettre à jour interface TypeScript
3. Implémenter affichage dynamique
```

---

## Images de véhicules: Bonnes pratiques

### Vérification des images manquantes

Avant de déployer une fonctionnalité utilisant des images de véhicules, toujours vérifier leur disponibilité :

```bash
npx ts-node scripts/check-missing-vehicle-images.ts
```

**Ce script vérifie :**
- ✅ Images existantes dans Supabase Storage
- ⚠️ Modèles avec `modele_pic = "no.webp"`
- ❌ Images définies mais fichiers manquants
- 📊 Statistiques par marque

### Upload d'images manquantes

**Structure requise :**
```
uploads/
  constructeurs-automobiles/
    marques-concepts/
      {marque_alias}/
        {modele_pic}
```

**Conventions de nommage :**
- Format: `kebab-case.webp`
- Exemple: `cayenne-955.webp`, `serie-3.webp`
- Dimensions recommandées: 800x600px
- Compression: WebP qualité 85%

### Filtrage des images invalides

Toujours filtrer les valeurs `no.webp` et gérer les erreurs de chargement :

```tsx
const [imageError, setImageError] = useState(false);

{!imageError && vehicle.modele_pic && vehicle.modele_pic !== 'no.webp' ? (
  <img 
    src={imageUrl} 
    alt={...}
    onError={() => setImageError(true)}
  />
) : (
  <FallbackComponent />
)}
```

### ALT SEO-optimisé

Inclure année et motorisation pour le SEO :

```tsx
alt={`${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} - ${vehicle.type_year_from} à ${vehicle.type_year_to || "aujourd'hui"}`}
// Exemple: "Porsche Cayenne (9PA) 3.0 TDI - 2002 à 2010"
```

### Gestion d'erreur avec React State

**❌ Mauvais** - Manipulation du DOM :
```tsx
onError={(e) => {
  const target = e.target as HTMLImageElement;
  target.style.display = 'none';
  const fallback = target.nextElementSibling as HTMLElement;
  if (fallback) fallback.style.display = 'flex';
}}
```

**✅ Bon** - Utiliser useState :
```tsx
const [imageError, setImageError] = useState(false);

{!imageError && vehicle.modele_pic ? (
  <img onError={() => setImageError(true)} />
) : (
  <Fallback />
)}
```

### Accessibilité (a11y)

Ajouter `aria-label` sur les icônes de fallback :

```tsx
<Car 
  className="w-16 h-16 text-gray-400" 
  aria-label={`Image ${vehicle.marque_name} ${vehicle.modele_name} non disponible`}
/>
```

---

## SEO: Éviter le duplicate content

### Problème du duplicate content

**Définition:** Le duplicate content désigne du contenu identique ou très similaire présent sur plusieurs pages d'un site web.

**Impact SEO:**
- ⚠️ Pénalités Google (baisse de classement)
- ⚠️ Dilution de la valeur SEO entre pages similaires
- ⚠️ Indexation inefficace (Google choisit une page "canonique" arbitrairement)
- ⚠️ Gaspillage du "crawl budget" Google

### Cas concret identifié: Descriptions génériques des familles de pièces

**Problème détecté:**
- 19 familles de pièces par page véhicule
- Chaque famille avait une description générique de 150-200 mots
- Ces descriptions étaient **identiques** sur des milliers de pages
- Impact: ~19 × 200 mots × 10 000+ pages = contenu dupliqué massif

**Exemple de contenu problématique:**
```html
<p class="text-sm text-gray-600 mb-4">
  {family.mf_description}
  <!-- "Le système de filtration est essentiel pour maintenir la propreté..." 
       répété sur 10 000+ pages véhicules -->
</p>
```

**Solution appliquée:**
```tsx
{/* ❌ Supprimé: Description générique dupliquée */}
{/* <p className="text-sm text-gray-600 mb-4">
  {family.mf_description || 'Découvrez notre sélection complète'}
</p> */}

{/* ✅ Gardé: Liste unique de gammes spécifiques au véhicule */}
<div className="space-y-2.5 mb-4">
  {displayedGammes.map((gamme) => (
    <a href={...}>{gamme.pg_name}</a>
  ))}
</div>
```

### Principes anti-duplicate content

#### 1. Privilégier le contenu unique et spécifique

**❌ Mauvais** - Contenu générique répété:
```tsx
<p>Le système de freinage est essentiel pour la sécurité...</p>
```

**✅ Bon** - Données structurées uniques:
```tsx
<div itemScope itemType="https://schema.org/Product">
  <span itemProp="name">{gamme.pg_name}</span>
  <span itemProp="category">{family.mf_name}</span>
</div>
```

#### 2. Utiliser Schema.org pour les données structurées

Au lieu de décrire textuellement, structurer les données pour Google:

```tsx
<script type="application/ld+json">
{JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": `Pièces ${family.mf_name}`,
  "itemListElement": displayedGammes.map((gamme, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "item": {
      "@type": "Product",
      "name": gamme.pg_name,
      "url": gamme.url
    }
  }))
})}
</script>
```

**Avantages:**
- ✅ Compréhensible par Google (rich snippets)
- ✅ Pas de duplicate content visible
- ✅ Meilleur SEO technique
- ✅ Données structurées = meilleur classement

#### 3. Supprimer plutôt que réécrire

Si un texte est générique et répété sur 1000+ pages:

**❌ Mauvais** - Réécrire des variantes (toujours du duplicate):
```tsx
{brand === 'bmw' && "Les pièces BMW nécessitent une attention particulière..."}
{brand === 'audi' && "Les pièces Audi nécessitent une attention particulière..."}
// Toujours du duplicate content!
```

**✅ Bon** - Supprimer complètement:
```tsx
{/* Pas de description générique - laisser les données uniques parler */}
<h3>{gamme.pg_name}</h3> {/* Contenu unique */}
<span>{vehicle.type_name}</span> {/* Contexte spécifique */}
```

#### 4. Détecter le duplicate content avant production

**Vérifications à faire:**

1. **Recherche de texte répété:**
```bash
# Chercher les descriptions utilisées plusieurs fois
grep -r "Le système de filtration" frontend/app/routes/
```

2. **Audit avec Google Search Console:**
   - Indexation > Duplicate sans canonical
   - Couverture > Exclues (duplicate)

3. **Test local:**
```bash
# Générer 3 pages différentes et comparer le contenu
curl localhost:3000/vehicle1 > page1.html
curl localhost:3000/vehicle2 > page2.html
diff page1.html page2.html | grep "text-gray-600"
```

4. **Script de détection automatique:**
```typescript
// scripts/detect-duplicate-content.ts
// Compare le contenu HTML de plusieurs pages
// Alerte si >70% de similarité textuelle
```

### Anti-patterns SEO à éviter

❌ **Texte générique dans les composants réutilisables**
```tsx
// Mauvais: Même texte sur toutes les pages
const CatalogCard = () => (
  <div>
    <p>Découvrez notre sélection de pièces automobiles de qualité...</p>
  </div>
);
```

❌ **Descriptions "spinner" (rotation de synonymes)**
```tsx
// Mauvais: Google détecte ces patterns
const descriptions = {
  filtration: "Le système de {filtration|épuration|purification}...",
  freinage: "Les {freins|dispositifs de freinage|systèmes de ralentissement}..."
};
```

❌ **Texte caché avec CSS**
```tsx
// Mauvais: Pénalité Google garantie
<p className="hidden">
  Contenu keyword stuffing invisible pour l'utilisateur...
</p>
```

❌ **Même meta description sur toutes les pages**
```tsx
// Mauvais: Duplicate dans les SERPs Google
<meta name="description" content="Pièces automobiles de qualité" />
```

### Bonnes pratiques SEO

✅ **Meta descriptions uniques avec données spécifiques**
```tsx
<meta 
  name="description" 
  content={`Pièces ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} (${vehicle.type_year_from}-${vehicle.type_year_to}). ${catalogFamilies.length} familles disponibles.`}
/>
```

✅ **Titres H1/H2 avec contexte unique**
```tsx
<h1>{vehicle.marque_name} {vehicle.modele_name} - Catalogue pièces {vehicle.type_name}</h1>
<h2>Pièces compatibles {vehicle.type_year_from} à {vehicle.type_year_to}</h2>
```

✅ **Breadcrumbs structurés (Schema.org)**
```tsx
<nav itemScope itemType="https://schema.org/BreadcrumbList">
  <span itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
    <a itemProp="item" href="/">
      <span itemProp="name">Accueil</span>
    </a>
    <meta itemProp="position" content="1" />
  </span>
  {/* ... */}
</nav>
```

✅ **Contenu généré dynamiquement unique**
```tsx
// Bon: Combiner plusieurs données pour créer du contenu unique
<p>
  Trouvez {catalogFamilies.length} familles de pièces pour votre 
  {vehicle.marque_name} {vehicle.modele_name} {vehicle.type_name} 
  ({vehicle.type_year_from}-{vehicle.type_year_to}).
  {bestsellers.length > 0 && ` ${bestsellers.length} best-sellers disponibles.`}
</p>
```

### Checklist SEO avant mise en production

- [ ] Aucune description générique répétée sur plus de 10 pages
- [ ] Meta descriptions uniques par page (ou générées dynamiquement)
- [ ] Titres H1/H2 incluent des données spécifiques au contexte
- [ ] Schema.org utilisé pour les données structurées
- [ ] Pas de texte caché (CSS `display:none`, `visibility:hidden`)
- [ ] Test de similarité textuelle entre 3 pages différentes < 50%
- [ ] Google Search Console vérifié pour duplicates
- [ ] Canonical tags définis si duplicates intentionnels

### Outils de détection

| Outil | Usage | Gratuit |
|-------|-------|---------|
| Google Search Console | Duplicate officiel indexé | ✅ |
| Screaming Frog SEO Spider | Crawl local + détection duplicate | ✅ (500 URLs) |
| Siteliner | Analyse duplicate content site | ✅ (250 pages) |
| Copyscape | Détection duplicate externe | ❌ |
| `diff` + `curl` | Comparaison manuelle HTML | ✅ |

### Ressources

- [Google: Duplicate Content Guidelines](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Schema.org: Product Markup](https://schema.org/Product)
- [Google Search Console: Duplicate Reports](https://search.google.com/search-console)

---

## Ressources

- [Architecture Overview](../architecture/overview.md)
- [API Reference](../api-reference.md)
- [Database Schema](../database/supabase-schema.md)
- [Component Library](../../features/)

## Contribuer

Cette documentation est vivante. Si vous identifiez de nouvelles bonnes pratiques ou patterns, n'hésitez pas à mettre à jour ce guide.

---

**Dernière mise à jour:** 16 novembre 2025  
**Auteur:** Équipe développement

