# 🎯 Guide de Migration vers les Tokens Sémantiques

## ⚠️ Principe : ZÉRO RÉGRESSION

Cette migration se fait **progressivement** composant par composant, avec validation à chaque étape.

---

## 📋 Stratégie de Migration

### Phase 1 : Préparation (Sans toucher au code existant)
1. ✅ Analyser l'utilisation actuelle des couleurs
2. ✅ Créer un mapping entre couleurs Tailwind → Tokens sémantiques
3. ✅ Configurer Tailwind pour supporter les tokens
4. ⏳ Créer des classes utilitaires de transition

### Phase 2 : Migration Progressive
1. Migrer 1 composant à la fois
2. Tester visuellement après chaque composant
3. Commit après validation
4. Rollback facile si problème

### Phase 3 : Nettoyage
1. Supprimer les anciennes couleurs
2. Documenter les patterns

---

## 🗺️ Mapping Couleurs → Tokens Sémantiques

### Navigation & Liens
```tsx
// ❌ AVANT (Tailwind hardcodé)
<Link className="text-blue-600 hover:text-blue-700">

// ✅ APRÈS (Token sémantique)
<Link className="text-[var(--color-semantic-info)] hover:text-[var(--color-secondary-600)]">
```

### Boutons d'Action (CTA)
```tsx
// ❌ AVANT
<button className="bg-blue-600 hover:bg-blue-700 text-white">

// ✅ APRÈS
<button className="bg-[var(--color-semantic-action)] hover:bg-[var(--color-semantic-action)]/90 text-[var(--color-semantic-action-contrast)]">
```

### États de Succès
```tsx
// ❌ AVANT
<div className="bg-green-50 text-green-700 border-green-200">

// ✅ APRÈS
<div className="bg-[var(--color-semantic-success)]/10 text-[var(--color-semantic-success)] border-[var(--color-semantic-success)]/20">
```

### Textes Neutres
```tsx
// ❌ AVANT
<p className="text-slate-600">
<p className="text-gray-700">

// ✅ APRÈS
<p className="text-[var(--color-neutral-600)]">
<p className="text-[var(--color-neutral-700)]">
```

### Backgrounds
```tsx
// ❌ AVANT
<div className="bg-gray-900">

// ✅ APRÈS
<div className="bg-[var(--color-neutral-900)]">
```

---

## 🎨 Table de Correspondance Complète

| Utilisation | Tailwind Actuel | Token Sémantique | Variable CSS |
|------------|----------------|------------------|--------------|
| **Navigation** | | | |
| Liens principaux | `text-blue-600` | `info` | `var(--color-semantic-info)` |
| Liens hover | `hover:text-blue-700` | `secondary-600` | `var(--color-secondary-600)` |
| **Boutons** | | | |
| CTA principal | `bg-blue-600` | `action` | `var(--color-semantic-action)` |
| CTA text | `text-white` | `action-contrast` | `var(--color-semantic-action-contrast)` |
| **États** | | | |
| Succès bg | `bg-green-50` | `success/10` | `var(--color-semantic-success)` avec opacity |
| Succès text | `text-green-700` | `success` | `var(--color-semantic-success)` |
| Info bg | `bg-blue-50` | `info/10` | `var(--color-semantic-info)` avec opacity |
| Info text | `text-blue-600` | `info` | `var(--color-semantic-info)` |
| **Neutrals** | | | |
| Texte principal | `text-slate-800` | `neutral-800` | `var(--color-neutral-800)` |
| Texte secondaire | `text-slate-600` | `neutral-600` | `var(--color-neutral-600)` |
| Texte subtil | `text-slate-400` | `neutral-400` | `var(--color-neutral-400)` |
| Background dark | `bg-gray-900` | `neutral-900` | `var(--color-neutral-900)` |
| Border | `border-gray-200` | `neutral-200` | `var(--color-neutral-200)` |

---

## 🛡️ Règles de Sécurité

### ✅ À FAIRE
- Migrer UN composant à la fois
- Tester dans le navigateur après chaque changement
- Prendre des screenshots avant/après
- Commit après validation visuelle
- Garder le même contraste visuel

### ❌ NE PAS FAIRE
- Migrer plusieurs composants en même temps
- Changer la structure HTML en même temps
- Modifier la logique métier
- Supprimer des classes sans remplacement

---

## 📝 Checklist par Composant

### Avant de commencer
- [ ] Screenshot du composant actuel
- [ ] Identifier toutes les classes de couleur utilisées
- [ ] Préparer le mapping des tokens

### Pendant la migration
- [ ] Remplacer les couleurs une par une
- [ ] Vérifier le rendu après chaque couleur
- [ ] Tester les états hover/focus/active

### Après la migration
- [ ] Screenshot du composant migré
- [ ] Comparer visuellement (doit être identique)
- [ ] Tester la responsive
- [ ] Tester le dark mode (si applicable)
- [ ] Commit avec message explicite

---

## 🔄 Ordre de Migration Recommandé

1. **Footer** (moins critique, moins visible)
2. **Navbar** (plus visible, tester avec attention)
3. **Index** (page principale, valider en dernier)

---

## 🚨 Rollback Rapide

Si problème détecté :

```bash
# 1. Identifier le dernier commit OK
git log --oneline -5

# 2. Rollback
git reset --hard <commit-hash>

# 3. Ou revenir au commit précédent
git reset --hard HEAD~1
```

---

## 📦 Tokens Disponibles

Voir `/packages/design-tokens/src/tokens/design-tokens.json` pour la liste complète.

### Couleurs Sémantiques (À privilégier)
- `--color-semantic-action` : Actions principales (rouge #D63027)
- `--color-semantic-info` : Navigation, informations (bleu #0F4C81)
- `--color-semantic-success` : Validations (vert #1E8449)
- `--color-semantic-warning` : Alertes (orange #D68910)
- `--color-semantic-danger` : Erreurs (rouge #C0392B)
- `--color-semantic-neutral` : États neutres (gris #4B5563)

### Couleurs Neutres (11 nuances)
- `--color-neutral-50` à `--color-neutral-950`
- `--color-neutral-white` : #FFFFFF
- `--color-neutral-black` : #000000

### Espacements (Grille 8px)
- `--spacing-xs` : 4px
- `--spacing-sm` : 8px
- `--spacing-md` : 16px ← Standard
- `--spacing-lg` : 24px
- `--spacing-xl` : 32px
- etc.

---

## 💡 Exemples Pratiques

### Navbar - Lien de Navigation
```tsx
// ❌ AVANT
<Link className="text-slate-600 hover:text-blue-600">
  Catalogue
</Link>

// ✅ APRÈS (Identique visuellement)
<Link className="text-[var(--color-neutral-600)] hover:text-[var(--color-semantic-info)]">
  Catalogue
</Link>
```

### Footer - Titre de Section
```tsx
// ❌ AVANT
<h3 className="text-xl font-bold mb-4 text-lightTurquoise">
  À propos
</h3>

// ✅ APRÈS (Utilise token sémantique cohérent)
<h3 className="text-xl font-bold mb-4 text-[var(--color-semantic-info)]">
  À propos
</h3>
```

### Badge Notification
```tsx
// ❌ AVANT
<span className="bg-blue-500 text-white">5</span>

// ✅ APRÈS
<span className="bg-[var(--color-semantic-info)] text-[var(--color-semantic-info-contrast)]">
  5
</span>
```

---

## 🎯 Bénéfices Attendus

1. **Cohérence** : Même couleur pour même usage partout
2. **Maintenabilité** : Changer une couleur = modifier un token
3. **Dark Mode** : Support automatique (tokens dark déjà définis)
4. **Accessibilité** : Contraste garanti avec `-contrast`
5. **Scalabilité** : Ajout facile de nouveaux composants

---

## 📞 En Cas de Doute

- Consulter `/packages/design-tokens/CHEAT-SHEET.md`
- Vérifier les tokens dans `/packages/design-tokens/src/styles/tokens.css`
- Demander validation avant de merger

---

**Règle d'or : Si ça marche actuellement, ça doit marcher EXACTEMENT pareil après migration !**
