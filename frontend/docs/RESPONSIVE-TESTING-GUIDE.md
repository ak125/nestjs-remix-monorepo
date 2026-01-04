# Guide de Test Responsive Manuel

Ce guide permet de valider manuellement les améliorations mobile-first sur les pages critiques du funnel e-commerce.

## Configuration DevTools

1. Ouvrir Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Choisir "Responsive" pour resize libre

## Breakpoints à tester

| Breakpoint | Largeur | Device |
|------------|---------|--------|
| Mobile small | 375px | iPhone SE |
| Mobile | 390px | iPhone 14 |
| Tablet | 768px | iPad |
| Desktop small | 1024px | Laptop |
| Desktop | 1280px | Desktop |

---

## Checklist par page

### PDP - Product Detail Page
**URL:** `/pieces/kit-distribution`

- [ ] MobileBottomBar apparaît quand on scroll sous le sélecteur véhicule
- [ ] Bouton "Sélectionner mon véhicule" visible et cliquable
- [ ] Touch targets des boutons ≥44px
- [ ] Images responsive (pas de scroll horizontal)

### PLP - Product Listing Page
**URL:** `/pieces/kit-distribution/renault/clio/clio-iv/essence.html`

- [ ] Sidebar filtres cachée sur mobile (< 1024px)
- [ ] MobileBottomBar avec bouton "Filtres" visible
- [ ] FilterDrawer s'ouvre en bottom sheet (pas latéral)
- [ ] Badge compteur filtres actifs affiché
- [ ] Bouton "Voir X résultats" ferme le drawer
- [ ] Grille produits 1 colonne sur mobile, 2-4 sur desktop

### Cart - Panier
**URL:** `/cart`

- [ ] Boutons delete (corbeille) ≥44px
- [ ] Boutons quantité (+/-) ≥44px
- [ ] MobileBottomBar checkout sticky en bas
- [ ] Total visible dans la barre mobile
- [ ] Bouton "Commander" accessible au pouce

### Checkout - Commande
**URL:** `/checkout`

- [ ] Taper dans un input email: PAS de zoom iOS
- [ ] Tous les inputs ont font-size ≥16px
- [ ] Checkbox newsletter accessible (≥44px zone tactile)
- [ ] MobileBottomBar avec bouton submit
- [ ] Formulaire scrollable, bouton toujours visible

### Search - Recherche
**URL:** `/search?q=filtre`

- [ ] FilterTrigger dans MobileBottomBar
- [ ] Compteur résultats affiché
- [ ] FilterDrawer bottom sheet fonctionnel
- [ ] Sidebar cachée sur mobile
- [ ] Résultats en grille responsive

### Account - Compte
**URL:** `/account/dashboard`

- [ ] Hamburger menu visible (pas sidebar)
- [ ] Clic hamburger → Sheet navigation s'ouvre à gauche
- [ ] Liens navigation ont touch-target (≥44px)
- [ ] Header sticky "Mon compte" sur mobile
- [ ] Fermeture sheet au clic sur un lien

---

## Tests iOS Zoom (CRITIQUE)

Sur iPhone réel ou simulateur Safari:

1. Ouvrir `/checkout` ou `/contact`
2. Taper dans un champ email ou texte
3. **Attendu:** Pas de zoom automatique
4. **Si zoom:** L'input n'a pas `text-base` (16px minimum)

### Fix si problème:
```css
/* Ajouter à l'input */
.no-zoom-input {
  font-size: 16px; /* ou text-base en Tailwind */
}
```

---

## Tests Touch Target (WCAG)

Pour vérifier qu'un élément a 44px minimum:

1. Inspecter l'élément (clic droit → Inspecter)
2. Vérifier dans "Computed" → height et width
3. Minimum: 44px × 44px
4. Recommandé e-commerce: 48px × 48px

### Classes à utiliser:
```tsx
<Button className="touch-target">...</Button>     // 44px
<Button className="touch-target-lg">...</Button>  // 48px
```

---

## Validation rapide (5 minutes)

1. Ouvrir DevTools → Mobile 375px
2. Visiter ces URLs dans l'ordre:
   - `/pieces/kit-distribution` → MobileBottomBar au scroll
   - `/search?q=huile` → FilterTrigger visible
   - `/cart` → Checkout bar sticky
   - `/account/dashboard` → Hamburger menu
3. Si tout fonctionne → responsive OK

---

## Problèmes courants

| Symptôme | Cause | Fix |
|----------|-------|-----|
| Sidebar visible sur mobile | Manque `hidden lg:block` | Ajouter la classe |
| Zoom iOS sur input | font-size < 16px | Ajouter `no-zoom-input` |
| Bouton trop petit | Pas de touch-target | Ajouter `touch-target` |
| MobileBottomBar manquante | Composant non importé | Import + render |
| FilterDrawer latéral | Side="left" au lieu de "bottom" | Changer side prop |
