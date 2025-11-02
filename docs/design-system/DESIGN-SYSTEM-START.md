# 🎨 Design System - Démarrage Rapide

> **Guide de démarrage** pour utiliser le Design System avec couleurs métier

---

## 📖 Documentation

Le Design System est **complet et prêt à utiliser** ! Voici comment naviguer dans la documentation :

### 🚀 Je débute

**[Commencez ici →](./DESIGN-SYSTEM-QUICK-REF.md)**  
Référence rapide 1 page : couleurs, classes, exemples

### 📚 J'approfondis

1. **[Guide Complet](./DESIGN-SYSTEM-USAGE-GUIDE.md)** - Exemples détaillés + règles UX
2. **[Index Documentation](./DESIGN-SYSTEM-INDEX.md)** - Navigation complète
3. **[Audit Design System](./DESIGN-SYSTEM-AUDIT.md)** - Analyse technique
4. **[Checklist](./DESIGN-SYSTEM-CHECKLIST.md)** - Validation & intégration

### 🎯 J'ai une tâche précise

**Créer un composant ?**  
→ [Quick Reference](./DESIGN-SYSTEM-QUICK-REF.md) - Section "Exemples Rapides"

**Modifier les couleurs globales ?**  
→ `packages/design-tokens/src/tokens/design-tokens.json` puis `npm run build`

**Voir les composants exemples ?**  
→ `frontend/app/components/examples/DesignSystemExamples.tsx`

---

## � Les 3 Règles d'Or

### 1️⃣ Couleurs : 1 Couleur = 1 Fonction

| Je veux... | J'utilise... | Code HEX |
|------------|--------------|----------|
| **Bouton d'action** | `bg-primary-500` | #FF3B30 |
| **Lien navigation** | `text-secondary-500` | #0F4C81 |
| **Validation** | `bg-success` | #27AE60 |
| **Alerte** | `bg-warning` | #F39C12 |
| **Erreur** | `bg-error` | #C0392B |

### 2️⃣ Typographie : 3 Polices, 3 Rôles

| Police | Usage | Classe |
|--------|-------|--------|
| **Montserrat Bold** | Titres, Headings | `font-heading` |
| **Inter Regular** | Texte corps, Paragraphes | `font-sans` |
| **Roboto Mono** | Données techniques (REF, Prix, Stock) | `font-mono` |

### 3️⃣ Espacement : 8px Grid

| Espacement | Valeur | Usage | Classe |
|------------|--------|-------|--------|
| **XS** | 4px | Micro (badges) | `p-xs` |
| **SM** | 8px | Serré (form) | `p-sm` |
| **MD** | 16px | Standard (card) | `p-md` |
| **LG** | 24px | Sections/Grid | `gap-lg` |
| **XL** | 32px | Marges page | `p-xl` |

> **Règle :** Toujours des multiples de 8px !

---

## ⚡ Exemples Ultra-Rapides

```tsx
// Bouton CTA
<button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg">
  Ajouter au panier
</button>

// Lien Navigation
<a className="text-secondary-500 hover:text-secondary-600">Catalogue</a>

// Badge Compatible
<span className="bg-success text-white px-4 py-2 rounded-full">✓ Compatible</span>

// Alerte
<div className="bg-warning/10 border border-warning p-4 rounded-md">
  ⚠️ Livraison sous 5-7 jours
</div>

// Erreur
<div className="bg-error text-white p-4 rounded-md">
  ✗ Pièce incompatible
</div>
```

---

## 🎨 Couleurs Disponibles

- **Primary** `#FF3B30` - CTA (Ajouter panier, Payer)
- **Secondary** `#0F4C81` - Navigation (Menu, liens)
- **Success** `#27AE60` - Validation (Compatible)
- **Warning** `#F39C12` - Alerte (Délai)
- **Error** `#C0392B` - Erreur (Incompatible)

---

## 🔧 Commandes Utiles

```bash
# Rebuild Design Tokens
cd packages/design-tokens && npm run build

# Redémarrer frontend
cd frontend && npm run dev
```

---

## 📊 Résumé Complet

**[Voir DESIGN-SYSTEM-SUMMARY.txt](./DESIGN-SYSTEM-SUMMARY.txt)**  
Résumé visuel complet avec tous les détails

---

## ✅ Checklist Rapide

Avant de commit :
- [ ] Pas de couleurs hardcodées (`#...`, `rgb(...)`)
- [ ] Couleurs sémantiques utilisées (Primary/Secondary/Success/Warning/Error)
- [ ] Classes `p-space-X` au lieu de valeurs arbitraires
- [ ] Contraste vérifié

---

**Version** : 2.0 | **Statut** : ✅ Production Ready  
**Documentation complète** : [Index](./DESIGN-SYSTEM-INDEX.md)
