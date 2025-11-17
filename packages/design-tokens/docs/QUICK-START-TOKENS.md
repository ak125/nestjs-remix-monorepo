# 🎨 Quick Start : Utiliser les Tokens dans Vos Composants

## 🚀 3 Étapes pour Tokeniser un Composant

### Étape 1 : Identifier les Couleurs Hardcodées

Cherchez dans votre code :
```bash
# Chercher tous les blues, grays, etc.
grep -E "blue-[0-9]|gray-[0-9]|slate-[0-9]|green-[0-9]|red-[0-9]|orange-[0-9]" MonComposant.tsx
```

### Étape 2 : Mapper vers les Tokens

Utilisez ce tableau de référence rapide :

| Utilisation | Remplacer | Par |
|-------------|-----------|-----|
| 🔵 **Boutons primaires** | `bg-blue-600` | `bg-semantic-action` |
| 🔗 **Liens** | `text-blue-600` | `text-semantic-info` |
| ✅ **Succès** | `text-green-600` | `text-semantic-success` |
| ⚠️ **Warning** | `text-orange-600` | `text-semantic-warning` |
| ❌ **Erreur** | `text-red-600` | `text-semantic-danger` |
| 📄 **Texte secondaire** | `text-gray-600` | `text-neutral-600` |
| 🔲 **Bordures** | `border-gray-300` | `border-neutral-300` |
| 🎨 **Backgrounds légers** | `bg-gray-50` | `bg-neutral-50` |

### Étape 3 : Remplacer et Tester

```tsx
// ❌ AVANT
<button className="bg-blue-600 hover:bg-blue-700 text-white">
  Cliquez ici
</button>

// ✅ APRÈS
<button className="bg-semantic-action hover:bg-semantic-action/90 text-semantic-action-contrast">
  Cliquez ici
</button>
```

**Tester :** Ouvrir dans le navigateur et vérifier que rien n'a changé visuellement.

---

## 📋 Tokens Disponibles

### Couleurs Sémantiques

#### Action (Boutons CTA)
```tsx
bg-semantic-action              // Fond bouton
text-semantic-action-contrast   // Texte sur bouton
hover:bg-semantic-action/90     // Hover léger
```

#### Info (Liens, badges info)
```tsx
bg-semantic-info                // Fond
text-semantic-info              // Texte
bg-semantic-info/10             // Fond très léger (10% opacité)
hover:text-semantic-info/80     // Hover
```

#### Success (Confirmations)
```tsx
bg-semantic-success             // Fond
text-semantic-success           // Texte
bg-semantic-success/10          // Fond léger
```

#### Warning (Alertes)
```tsx
bg-semantic-warning             // Fond
text-semantic-warning           // Texte
bg-semantic-warning/10          // Fond léger
```

#### Danger (Erreurs)
```tsx
bg-semantic-danger              // Fond
text-semantic-danger            // Texte
bg-semantic-danger/10           // Fond léger
```

### Couleurs Neutres (Texte, Bordures, Backgrounds)

```tsx
// Texte
text-neutral-900    // Texte principal (très foncé)
text-neutral-600    // Texte secondaire
text-neutral-500    // Texte tertiaire

// Bordures
border-neutral-300  // Bordures standards
border-neutral-200  // Bordures légères

// Backgrounds
bg-neutral-50       // Background très léger
bg-neutral-100      // Background léger
bg-neutral-900      // Background foncé
```

---

## 🎯 Cas d'Usage Courants

### Bouton CTA Principal
```tsx
<Button className="bg-semantic-action hover:bg-semantic-action/90 text-semantic-action-contrast">
  Acheter maintenant
</Button>
```

### Lien Cliquable
```tsx
<Link className="text-semantic-info hover:text-semantic-info/80 underline">
  En savoir plus
</Link>
```

### Badge de Statut
```tsx
{/* En stock */}
<Badge className="bg-semantic-success/10 text-semantic-success border-semantic-success/20">
  ✓ Disponible
</Badge>

{/* En attente */}
<Badge className="bg-semantic-warning/10 text-semantic-warning border-semantic-warning/20">
  ⏱ Délai 5j
</Badge>

{/* Rupture */}
<Badge className="bg-semantic-danger/10 text-semantic-danger border-semantic-danger/20">
  ✗ Rupture
</Badge>
```

### Input avec Focus
```tsx
<input
  className="border border-neutral-300 focus:ring-2 focus:ring-semantic-info focus:border-semantic-info"
  placeholder="Rechercher..."
/>
```

### Card avec Hover
```tsx
<Card className="border border-neutral-200 hover:border-semantic-info hover:shadow-lg transition-all">
  {/* Contenu */}
</Card>
```

### Prix
```tsx
<span className="text-2xl font-bold text-semantic-info">
  49,99 €
</span>
```

---

## ⚠️ À NE PAS FAIRE

### ❌ Ne Pas Remplacer les Gris Très Foncés
```tsx
// ❌ MAUVAIS
<h1 className="text-neutral-900"> {/* Trop clair ! */}

// ✅ BON - Garder gray-900 pour les titres
<h1 className="text-gray-900">
```

### ❌ Ne Pas Abuser des Tokens Sémantiques
```tsx
// ❌ MAUVAIS - Tout n'est pas une "info"
<div className="border-semantic-info"> {/* Trop visible */}

// ✅ BON - Utiliser neutral pour les éléments secondaires
<div className="border-neutral-300">
```

### ❌ Ne Pas Perdre les Contrastes
```tsx
// ❌ MAUVAIS
<button className="bg-semantic-info/30 text-white"> {/* Contraste insuffisant */}

// ✅ BON
<button className="bg-semantic-info text-semantic-info-contrast">
```

---

## 🔧 Commandes Utiles

### Rechercher les Couleurs à Migrer
```bash
# Dans un fichier spécifique
grep -E "blue-|gray-|slate-|green-|red-|orange-" frontend/app/components/MonComposant.tsx

# Dans tous les composants
grep -r -E "blue-|gray-|slate-|green-|red-|orange-" frontend/app/components/
```

### Remplacer en Masse (avec sed)
```bash
# Blue → semantic-info
sed -i 's/text-blue-600/text-semantic-info/g' MonComposant.tsx
sed -i 's/bg-blue-600/bg-semantic-info/g' MonComposant.tsx

# Gray → neutral
sed -i 's/text-gray-600/text-neutral-600/g' MonComposant.tsx
sed -i 's/border-gray-300/border-neutral-300/g' MonComposant.tsx
```

⚠️ **Attention** : Toujours vérifier visuellement après remplacement automatique !

---

## 📚 Ressources

- **Guide Complet** : [`MIGRATION-PAGES-PRODUITS.md`](./MIGRATION-PAGES-PRODUITS.md)
- **Tokens JSON** : [`packages/design-tokens/src/tokens.json`](../src/tokens.json)
- **Exemples Migrés** :
  - `frontend/app/routes/_index.tsx` (Homepage)
  - `frontend/app/components/Navbar.tsx` (Navigation)
  - `frontend/app/components/Footer.tsx` (Footer)

---

## 🎯 Checklist Rapide

Avant de commiter :

- [ ] Toutes les couleurs `blue-`, `gray-`, `slate-`, etc. ont été remplacées
- [ ] Test visuel : Aucun changement visible
- [ ] Test hover : États interactifs OK
- [ ] Test focus : Focus ring visible
- [ ] Contrastes : WCAG AA minimum
- [ ] TypeScript : Pas d'erreurs

---

**Besoin d'aide ?** Consultez le guide complet ou demandez à l'équipe !
