# 🎨 Design Tokens - Documentation Complète

> Système professionnel de 140+ design tokens pour un design cohérent et accessible

---

## 🚀 Par où commencer ?

### 1. **Débutant (5 min)** - Vous découvrez les design tokens
👉 Lisez le **[QUICK-START-TOKENS.md](./QUICK-START-TOKENS.md)**
- Comprendre en 2 min
- Les 6 couleurs essentielles
- Espacements rapides
- Pattern copier-coller

### 2. **Intermédiaire (15 min)** - Vous voulez tout comprendre
👉 Lisez le **[GUIDE-COMPLET.md](./packages/design-tokens/GUIDE-COMPLET.md)**
- C'est quoi les tokens ?
- Pourquoi c'est important ?
- Les 140+ tokens disponibles
- Comment les utiliser ?
- Cas d'usage concrets
- Règles d'or

### 3. **Avancé** - Vous avez une question précise
👉 Consultez la **[FAQ.md](./packages/design-tokens/FAQ.md)**
- 20 questions/réponses
- Couvre tous les cas d'usage
- Solutions aux problèmes courants

### 4. **Référence** - Vous codez et avez besoin d'une info rapide
👉 Gardez la **[CHEAT-SHEET.md](./packages/design-tokens/CHEAT-SHEET.md)** ouverte
- Tables de référence
- Patterns copy-paste ready
- Checklist
- DO's et DON'Ts

---

## 📚 Documentation

### Guides Généraux
| Document | Durée | Public | Description |
|----------|-------|--------|-------------|
| **[QUICK-START-TOKENS.md](./QUICK-START-TOKENS.md)** | 5 min | Débutant | Démarrage ultra-rapide |
| **[DESIGN-TOKENS-READY.md](./DESIGN-TOKENS-READY.md)** | 10 min | Tous | Récapitulatif complet |
| **[GUIDE-COMPLET.md](./packages/design-tokens/GUIDE-COMPLET.md)** | 15 min | Intermédiaire | Guide pédagogique détaillé |
| **[FAQ.md](./packages/design-tokens/FAQ.md)** | N/A | Avancé | 20 questions/réponses |
| **[CHEAT-SHEET.md](./packages/design-tokens/CHEAT-SHEET.md)** | 2 min | Référence | Guide de référence rapide |

### Documentation Technique
| Document | Description |
|----------|-------------|
| **[COLOR-SYSTEM.md](./packages/design-tokens/COLOR-SYSTEM.md)** | Système de couleurs sémantiques WCAG |
| **[GRID-SPACING.md](./packages/design-tokens/GRID-SPACING.md)** | Grille 8px et espacements |
| **[UTILITIES-GUIDE.md](./packages/design-tokens/UTILITIES-GUIDE.md)** | Classes utilitaires CSS |
| **[README.md](./packages/design-tokens/README.md)** | Package @fafa/design-tokens |

---

## 🎨 Interface Interactive

### Page Dashboard Admin
📍 **[/admin/design-system](/admin/design-system)**

**5 Onglets :**
1. **📚 Introduction** - C'est quoi les tokens + stats
2. **🎨 Couleurs** - Sémantiques + palettes avec boutons copier
3. **📏 Espacements** - Grille 8px + visualisation
4. **✍️ Typographie** - Fonts + tailles avec exemples
5. **💡 Patterns** - Code copy-paste ready

---

## 🎯 Quick Reference

### Les 6 Couleurs Sémantiques (À utiliser TOUJOURS!)

```tsx
// 🔴 Action - CTA principaux
bg-[var(--color-semantic-action)]

// 🔵 Info - Navigation, liens
bg-[var(--color-semantic-info)]

// 🟢 Success - Validations
bg-[var(--color-semantic-success)]

// 🟡 Warning - Avertissements
bg-[var(--color-semantic-warning)]

// 🔴 Danger - Erreurs
bg-[var(--color-semantic-danger)]

// ⚪ Neutral - États neutres
bg-[var(--color-semantic-neutral)]
```

**💡 Règle d'or :** Toujours utiliser avec `-contrast` pour le texte !

### Espacements (Grille 8px)

```tsx
p-space-xs   // 4px  - Micro
p-space-sm   // 8px  - Serré
p-space-md   // 16px - Standard (défaut)
p-space-lg   // 24px - Large
p-space-xl   // 32px - Très large
```

### Typographie

```tsx
font-heading  // Titres (Montserrat)
font-sans     // Texte standard (Inter)
font-mono     // Données techniques (Roboto Mono)
```

---

## 📊 Les 140+ Tokens

### Couleurs (60+)
- **Sémantiques** : 6 couleurs (action, info, success, warning, danger, neutral)
- **Primary** : 11 nuances (50 → 950)
- **Secondary** : 11 nuances (50 → 950)
- **Neutral** : 11 nuances (50 → 950)
- **Accent** : 7 couleurs spéciales

### Espacements (20+)
- **Fixes** : 7 tailles (xs → 3xl)
- **Fluid Section** : 6 tailles responsive
- **Fluid Gap** : 5 tailles responsive

### Typographie (30+)
- **Fonts** : 6 familles
- **Sizes** : 10 fixes + 10 fluid
- **Line-heights** : 6 valeurs
- **Letter-spacing** : 6 valeurs

### Effets (15+)
- **Shadows** : 7 niveaux
- **Border Radius** : 9 valeurs
- **Transitions** : 4 durées
- **Z-Index** : 7 layers

---

## 💡 Patterns Copy-Paste

### Bouton CTA
```tsx
<button className="
  bg-[var(--color-semantic-action)] 
  text-[var(--color-semantic-action-contrast)]
  px-6 py-3 
  rounded-lg 
  font-medium 
  shadow-md
  hover:shadow-lg
  transition-all
">
  Acheter maintenant
</button>
```

### Card Simple
```tsx
<div className="
  bg-white 
  p-space-6 
  rounded-xl 
  shadow-md 
  border border-neutral-200
">
  <h3 className="font-heading text-xl mb-space-2">Titre</h3>
  <p className="text-neutral-600">Description</p>
</div>
```

### Alert Success
```tsx
<div className="
  bg-[var(--color-semantic-success)]
  text-[var(--color-semantic-success-contrast)]
  p-space-4 
  rounded-lg
">
  ✅ Opération réussie !
</div>
```

---

## ✅ Checklist

Avant de coder un composant :

- [ ] Utiliser couleurs sémantiques (`action`, `info`, etc.)
- [ ] Utiliser grille 8px (`p-space-md`, `m-space-lg`)
- [ ] Utiliser bonnes fonts (`font-heading`, `font-sans`, `font-mono`)
- [ ] Toujours mettre `-contrast` avec les couleurs
- [ ] Éviter les valeurs en dur (#HEX, px)
- [ ] Tester en dark mode
- [ ] Vérifier l'accessibilité

---

## 🛠️ Commandes

```bash
# Build tokens
cd packages/design-tokens && npm run build

# Dev mode avec watch
npm run dev

# Vérifier contrastes WCAG
node packages/design-tokens/scripts/verify-colors.js
```

---

## 🔗 Liens Utiles

### Documentation
- [Quick Start](./QUICK-START-TOKENS.md)
- [Guide Complet](./packages/design-tokens/GUIDE-COMPLET.md)
- [FAQ](./packages/design-tokens/FAQ.md)
- [Cheat Sheet](./packages/design-tokens/CHEAT-SHEET.md)

### Interface
- [Dashboard Admin](/admin/design-system)
- [UI Kit](/ui-kit)

### Code
- [Package design-tokens](./packages/design-tokens/)
- [Tokens JSON](./packages/design-tokens/src/tokens/design-tokens.json)

---

## 🎯 Règles d'Or

### ✅ TOUJOURS
1. Utiliser couleurs sémantiques en priorité
2. Respecter grille 8px
3. Utiliser contrastes automatiques (`-contrast`)
4. Tester en dark mode
5. Vérifier accessibilité

### ❌ JAMAIS
1. Hardcoder des couleurs (#HEX)
2. Inventer des espacements hors grille
3. Mélanger les rôles des couleurs
4. Ignorer les contrastes
5. Oublier le dark mode

---

## 📈 Progression Recommandée

### Jour 1 (Aujourd'hui)
- ✅ Lire [QUICK-START-TOKENS.md](./QUICK-START-TOKENS.md)
- ✅ Explorer [/admin/design-system](/admin/design-system)
- ✅ Créer premier composant avec tokens

### Semaine 1
- Remplacer couleurs hardcodées
- Uniformiser espacements
- Standardiser typographie

### Mois 1
- Audit du code existant
- Migration progressive
- Documentation patterns maison

---

## 🎉 Vous Êtes Prêt !

Vous disposez maintenant de :

1. ✅ **140+ tokens** professionnels
2. ✅ **5 guides** complets
3. ✅ **Page interactive** dans admin
4. ✅ **Accessibilité** garantie (WCAG AA/AAA)
5. ✅ **Dark mode** prêt
6. ✅ **Maintenance** facile (1 fichier)

**🚀 Commencez dès maintenant !**

---

## ❓ Besoin d'Aide ?

1. **Question générale** → [GUIDE-COMPLET.md](./packages/design-tokens/GUIDE-COMPLET.md)
2. **Question précise** → [FAQ.md](./packages/design-tokens/FAQ.md)
3. **Référence rapide** → [CHEAT-SHEET.md](./packages/design-tokens/CHEAT-SHEET.md)
4. **Tester en live** → [/admin/design-system](/admin/design-system)

**Bon coding avec vos design tokens ! 🎨✨**
