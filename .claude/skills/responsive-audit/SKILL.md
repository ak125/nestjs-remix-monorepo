---
name: responsive-audit
description: "Mobile-first responsive audit v1.1 : shadcn/ui compliance, touch targets WCAG, viewport units, fluid tokens, design consistency."
argument-hint: "[/url-path or file-pattern]"
allowed-tools: Read, Grep, Glob
version: "1.1"
---

# Responsive Audit Skill — v1.1

Audit systématique du frontend pour garantir la conformité mobile-first, l'usage cohérent de shadcn/ui, et l'alignement du design system sur tout le site.

## Quand proposer ce skill

| Contexte detecte | Proposition |
|------------------|------------|
| User mentionne mobile, responsive, touch | `/responsive-audit [URL]` |
| Apres sprint composants UI | `/responsive-audit` (audit complet) |
| Avant push feature frontend | `/responsive-audit [composants modifies]` |
| Apres `/frontend-design` (chaine UI) | `/responsive-audit [page]` |

## Modes d'invocation
- `/responsive-audit` → **audit complet** (tout le frontend)
- `/responsive-audit /pieces/disque-de-frein-82.html` → **audit par URL** (route + composants importes)
- `/responsive-audit components/pieces/` → **audit cible** sur un dossier
- `/responsive-audit ChatWidget.tsx Footer.tsx` → **audit cible** sur fichiers specifiques

## Modes d'exécution

### Mode complet (`/responsive-audit` sans argument)
Scan de tout `frontend/app/components/**/*.tsx` + `frontend/app/routes/**/*.tsx`.
Utiliser 3 agents Explore en parallèle pour couvrir ~80+ fichiers efficacement.

### Mode par URL (`/responsive-audit /chemin/url`)
Quand l'argument commence par `/`, c'est une URL de route. Résoudre vers le fichier route source + tous ses composants importés.

**Résolution URL → fichiers source :**

| Pattern URL | Fichier route | Composants clés |
|---|---|---|
| `/pieces/<slug>.html` | `routes/pieces.$slug.tsx` | VehicleSelector, MotorisationsSection, QuickGuideSection, SymptomsSection, FAQSection, AntiMistakesSection, TableOfContents, MobileStickyBar |
| `/pieces/<gamme>/<marque>/<modele>/<type>.html` | `routes/pieces.$gamme.$marque.$modele.$type[.]html.tsx` | PiecesCatalogueFamille, PiecesFilterSidebar, PiecesGridView, PiecesGroupedDisplay, PiecesBuyingGuide, PiecesHeader, PiecesToolbar, MobileBottomBar |
| `/constructeurs/<brand>.html` | `routes/constructeurs.$brand[.]html.tsx` | BrandPartsSection |
| `/blog-pieces-auto/conseils/<alias>` | `routes/blog-pieces-auto.conseils.$pg_alias.tsx` | PurchaseGuideSection |
| `/diagnostic-auto/<slug>` | `routes/diagnostic-auto.$slug.tsx` | — |
| `/blog-pieces-auto/auto/<marque>` | `routes/blog-pieces-auto.auto.$marque.index.tsx` | — |
| `/blog-pieces-auto/guide/<slug>` | `routes/blog-pieces-auto.guide.$slug.tsx` | — |
| `/reference-auto/<slug>` | `routes/reference-auto.$slug.tsx` | — |
| `/products/<id>` | `routes/products.$id.tsx` | ProductCard, ConversionButton |
| `/plan-du-site` | `routes/plan-du-site.tsx` | — |
| `/` | `routes/_index.tsx` | HeroSection, HomeBlogSection, ConseilsDiagnosticSection |

**Procédure :**
1. Identifier le pattern URL → trouver le fichier route
2. Lire les imports du fichier route pour lister les composants
3. Auditer le fichier route + chaque composant importé

Exemples :
```
/responsive-audit /pieces/disque-de-frein-82.html
/responsive-audit /pieces/freinage/renault/clio/diesel.html
/responsive-audit /constructeurs/renault.html
```

### Mode ciblé fichier/dossier (`/responsive-audit <chemin(s)>`)
Audit uniquement des fichiers/dossiers passés en argument (sans `/` initial).
Pas d'agent nécessaire si < 10 fichiers — audit direct avec Grep + Read.

Exemples :
```
/responsive-audit components/rag/
/responsive-audit PiecesBuyingGuide.tsx ChatWidget.tsx
/responsive-audit components/ecommerce/ components/seo/
```

## Workflow (4 phases)

### Phase 1 — SCAN
**Mode complet :** Glob `frontend/app/components/**/*.tsx` + `frontend/app/routes/**/*.tsx`. Exclure les fichiers gold standard sauf si modifiés récemment.
**Mode par URL :** Résoudre l'URL vers le fichier route, lire ses imports, collecter tous les composants.
**Mode ciblé :** Résoudre les chemins fournis en argument. Si c'est un dossier, lister ses `.tsx`.

Utiliser Grep pour détecter les antipatterns sur les fichiers identifiés.

### Phase 2 — CHECK
Appliquer les 10 checklists ci-dessous sur chaque fichier.
- **Mode complet (> 20 fichiers)** : 3 agents Explore en parallèle
- **Mode par URL / ciblé (< 15 fichiers)** : audit direct sans agent

### Phase 3 — REPORT
Produire un rapport structuré par sévérité (voir format en bas).

### Phase 4 — FIX (optionnel, sur demande)
Appliquer les corrections automatiques avec les patterns valides documentés.

---

## Checklist 1 : Mobile-First Tailwind

**Règle :** Les classes de base s'appliquent au mobile. Les breakpoints (`sm:`, `md:`, `lg:`, `xl:`) augmentent progressivement.

**Antipatterns à détecter :**
- `grid-cols-[3-9]` sans breakpoint précédant (ex: `grid-cols-4` seul)
- `flex-row` seul quand il devrait être `flex-col sm:flex-row`
- `text-[0-9]xl` > `text-xl` sans variante mobile (ex: `text-3xl` seul devrait être `text-xl sm:text-2xl lg:text-3xl`)
- `hidden` appliqué au mobile cachant du contenu essentiel sans alternative

**Pattern valide :**
```tsx
// Grid responsive
className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"

// Texte responsive
className="text-lg sm:text-xl lg:text-2xl font-bold"

// Layout responsive
className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
```

**Sévérité :** CRITIQUE si élément de navigation ou catalogue, HAUTE sinon.

---

## Checklist 2 : shadcn/ui Components

**Règle :** Utiliser les composants shadcn/ui de `~/components/ui/` au lieu de HTML brut.

**Éléments à vérifier :**
| HTML brut | Remplacement shadcn/ui | Import |
|-----------|----------------------|--------|
| `<button>` (hors SheetTrigger/SheetClose) | `<Button>` | `~/components/ui/button` |
| `<input>` | `<Input>` | `~/components/ui/input` |
| `<textarea>` | `<Textarea>` | `~/components/ui/textarea` |
| `<select>` | `<Select>` | `~/components/ui/select` |
| `<input type="radio">` | `<RadioGroup>` | `~/components/ui/radio-group` |
| `<table>` | `<Table>` | `~/components/ui/table` |
| `<dialog>` | `<Dialog>` | `~/components/ui/dialog` |
| `<details>/<summary>` | `<Accordion>` | `~/components/ui/accordion` |
| `<nav>` tab-like | `<Tabs>` | `~/components/ui/tabs` |
| `<hr>` | `<Separator>` | `~/components/ui/separator` |
| `<span class="badge">` | `<Badge>` | `~/components/ui/badge` |
| `<div class="tooltip">` | `<Tooltip>` | `~/components/ui/tooltip` |
| `<div class="alert">` | `<Alert>` | `~/components/ui/alert` |
| pagination custom | `<Pagination>` | `~/components/ui/pagination` |

**Exceptions autorisées :**
- `<button>` dans `SheetTrigger asChild`, `AccordionTrigger`, `DialogTrigger` (pattern Radix)
- `<button>` dans `<form method="POST">` pour submit natif Remix
- `<input type="hidden">` pour tokens CSRF ou champs cachés
- Composants tiers (éditeurs, selects custom avec dropdown)

**Sévérité :** HAUTE (inconsistance design + touch targets non garantis).

---

## Checklist 3 : Touch Targets

**Règle WCAG :** Minimum 44x44px pour les éléments interactifs sur mobile.

**Antipatterns à détecter :**
- Boutons/liens avec `w-6 h-6` ou `w-8 h-8` (24-32px) sans padding adéquat
- Icônes cliquables sans conteneur de min 44px
- Liens texte sans padding (`py-0` ou `py-1` seuls)

**Pattern valide :**
```tsx
// Bouton icône avec touch target adéquat
<button className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2">
  <Icon className="w-5 h-5" />
</button>

// Lien dans liste avec padding suffisant
<Link className="block py-2.5 px-3">Texte du lien</Link>

// Icône responsive (plus grande sur mobile)
<Icon className="w-7 h-7 sm:w-6 sm:h-6" />
```

**Sévérité :** CRITIQUE pour navigation et CTA, MOYENNE pour icônes décoratives.

---

## Checklist 4 : Viewport Units

**Règle :** Utiliser `dvh` (dynamic viewport height) au lieu de `vh` pour les hauteurs dépendant du viewport. Sur mobile, `100vh` inclut la barre d'adresse, causant un débordement.

**Antipatterns à détecter :**
- `h-[calc(100vh` → doit être `h-[calc(100dvh`
- `h-screen` dans un contexte mobile (équivaut à `100vh`)
- `min-h-screen` pour les layouts full-page sur mobile

**Pattern valide :**
```tsx
// Hauteur dynamique mobile-safe
className="h-[calc(100dvh-8rem)]"

// Hauteur maximale avec fallback
className="h-[min(32rem,calc(100dvh-6rem))]"

// Full-page layout
className="min-h-[100dvh]"
```

**Sévérité :** CRITIQUE pour les modals/panels plein écran, HAUTE pour les sidebars.

---

## Checklist 5 : Responsive Spacing

**Règle :** Les paddings et marges > 6 (24px) doivent avoir des variantes responsives.

**Antipatterns à détecter :**
- `px-8` seul (32px) → déborde sur écrans 320px
- `py-8` ou `p-8` seul
- `gap-8` seul dans un flex/grid
- `space-y-8` seul

**Pattern valide :**
```tsx
// Padding responsive
className="px-4 sm:px-6 lg:px-8"

// Section spacing
className="py-6 sm:py-8 lg:py-12"

// Grid gap responsive
className="gap-3 sm:gap-4 lg:gap-6"
```

**Sévérité :** MOYENNE (fonctionnel mais inélégant sur petits écrans).

---

## Checklist 6 : Focus & Accessibility

**Règle :** Tous les éléments interactifs doivent avoir des états focus visibles et des labels accessibles.

**Antipatterns à détecter :**
- Boutons/liens sans `focus:ring-*` ou `focus:outline-*`
- `focus:outline-none` sans `focus:ring-*` de remplacement
- Boutons icône-seul sans `aria-label`
- Images sans `alt` (sauf décoratives avec `alt=""`)

**Pattern valide :**
```tsx
// Focus ring visible
<Button className="focus:ring-2 focus:ring-primary/50 focus:ring-offset-2">

// Bouton icône accessible
<button aria-label="Fermer le menu" className="focus:outline-none focus:ring-2 focus:ring-white/50">
  <X className="w-5 h-5" />
</button>

// Image avec alt
<img src={logo} alt="Automecanik - pièces auto" />
```

**Sévérité :** HAUTE pour navigation, MOYENNE pour le reste.

---

## Checklist 7 : Design Consistency

**Règle :** Utiliser les tokens du design system plutôt que des valeurs hardcodées.

**Antipatterns à détecter :**
- `bg-[#...]` ou `text-[#...]` → utiliser les tokens (`bg-primary`, `text-destructive`, etc.)
- `style={{ ... }}` → utiliser les classes Tailwind
- `font-size:` inline → utiliser `text-sm`, `text-base`, etc.
- Couleurs inconsistantes pour le même élément (ex: CTA bleu dans un composant, orange dans un autre)

**Tokens disponibles (design-tokens.json) :**
```
primary (500): #e8590c (orange — CTA, boutons principaux)
secondary (500): #0d1b3e (bleu foncé — fond hero, navbar, footer)
semantic.success: vert (stock, validations)
semantic.warning: amber (alertes, avertissements)
semantic.danger: rouge (erreurs, destructif)
semantic.action: bleu (liens, actions secondaires)
neutral: slate-* (échelle 50-950, neutres)
accent: khmerCurry, persianIndigo, vert, bleu (couleurs nommées)
```

**Exceptions autorisées :**
- Couleurs de marque tierces (logos constructeurs)
- Couleurs data-driven (graphiques, badges)
- SVG inline avec couleurs spécifiques

**Sévérité :** MOYENNE (pas de cassure fonctionnelle, mais dette design).

---

## Checklist 8 : Alignement Design (cohérence inter-pages)

**Règle :** Les mêmes éléments doivent avoir les mêmes styles sur toutes les pages. Standards définis à partir de l'audit du codebase réel.

### 8a — CTA Buttons
**Standard :** `<Button>` shadcn avec variants (`default`, `destructive`, `outline`, `ghost`). Mêmes `rounded-xl`, `font-bold`, `min-h-[44px]`.
**Antipatterns :** Mix `bg-[#e8590c]` / `bg-primary` / gradients custom sur des CTAs identiques. Rounding variable (`rounded-lg` vs `rounded-xl` vs `rounded-2xl`).

### 8b — Cards
**Standard :** `rounded-xl border border-slate-200 shadow-sm hover:shadow-lg`. SEO cards = fond sémantique (`amber-50/50` warnings, `orange-50/50` diagnostics).
**Antipatterns :** Mix `rounded-lg` / `rounded-2xl` / `rounded-3xl`. Bordures `border-gray-200` vs `border-neutral-200` vs `border-slate-200`.

### 8c — Section Headers
**Standard :** `flex items-center gap-3` + icône circle `w-8 h-8 sm:w-10 sm:h-10 rounded-full` + titre `text-xl`.
**Antipatterns :** Tailles icônes variables (`w-8` vs `w-10` vs `w-12` sans cohérence). Titres non standardisés (`text-xl` vs `text-2xl` vs `text-[28px]`).

### 8d — Couleurs sémantiques
**Standard :**
- Neutres : `slate-*` uniquement (pas `gray-*` ni `neutral-*`)
- CTA principal : `primary` (token = orange #e8590c) ou `bg-[#e8590c]` → migrer vers `bg-primary`
- Warnings : `amber-*` (semantic.warning)
- Diagnostics : `orange-*`
- Succès/stock : `semantic.success` ou `green-*`
- Fond sombre : `secondary` (token = bleu #0d1b3e) ou `bg-[#0d1b3e]` → migrer vers `bg-secondary`

**Antipatterns :** Mix `gray-*` / `neutral-*` / `slate-*`. Hex hardcodés là où un token existe.

### 8e — Spacing sections
**Standard :** `py-8` pour sections, `container mx-auto px-4` pour conteneurs, gaps sur échelle Tailwind 4px (2, 3, 4, 6, 8).
**Antipatterns :** `gap-2.5` (hors échelle), `py-10` / `py-12` mélangés sans logique.

### 8f — Icon sizes
**Standard :** 4 tailles fixes :
- Small : `w-4 h-4` (inline, badges)
- Medium : `w-5 h-5` (nav, boutons)
- Large : `w-6 h-6` (section headers)
- Section circle : `w-8 h-8 sm:w-10 sm:h-10` (icônes rondes de section)

**Antipatterns :** `w-3.5`, `w-7` hors échelle standard.

**Sévérité globale :** MOYENNE (pas de cassure, dette design progressive).

---

## Checklist 9 : Typographie (polices, hiérarchie, échelle)

**Règle :** La typographie doit suivre une hiérarchie claire, une échelle cohérente, et utiliser uniquement les polices du design system.

### 9a — Hiérarchie des headings
**Standard :**
- **h1** : 1 seul par page. `text-2xl sm:text-3xl lg:text-4xl font-bold`
- **h2** : sections principales. `text-xl sm:text-2xl font-bold`
- **h3** : sous-sections. `text-lg sm:text-xl font-semibold`
- **h4** : items. `text-base font-semibold`

**Antipatterns :**
- Plusieurs `<h1>` sur la même page (rendu simultané)
- `<h3>` en `text-sm` (trop petit, viole la hiérarchie)
- `<h2>` en `text-xl` dans un fichier et `text-2xl` dans un autre pour le même niveau
- Sauter un niveau (h1 → h3 sans h2)

**Exceptions :**
- `<h1>` dans `ErrorBoundary` / `CatchBoundary` ne compte PAS comme double h1 (ne coexiste jamais avec le h1 principal)
- `<h1>` dans un bloc conditionnel exclusif (`if/else`, `switch`) qui ne peut jamais s'afficher en même temps que l'autre

### 9b — Font weight cohérent par rôle
**Standard :**
- Titres (h1, h2) : `font-bold`
- Sous-titres (h3, h4) : `font-semibold`
- Labels formulaire : `font-medium`
- Body text : pas de font-weight (inherit)
- CTA boutons : `font-bold` ou `font-semibold`

**Antipatterns :**
- h3 en `font-bold` dans un composant et `font-semibold` dans un autre
- Labels en `font-semibold` (trop lourd)
- Body text en `font-medium` (trop lourd pour du texte courant)

### 9c — Polices (font-family)
**Standard :**
- `font-sans` (défaut) : tout le site sauf exceptions
- `font-mono` : uniquement pour références produit (OEM, codes, type mine)
- JAMAIS `font-serif` (pas dans le design system)

**Antipatterns :**
- `font-mono` sur des boutons CTA ou labels de formulaire
- `font-sans` explicite là où c'est déjà le défaut (inutile)
- Styles inline `font-family: Calibri` ou `font-family: Arial` (contamination CMS)

### 9d — Échelle de tailles responsive
**Standard :** Chaque taille de texte doit avoir une variante responsive si > `text-lg`.

| Taille base (mobile) | Breakpoint sm | Breakpoint lg | Usage |
|---|---|---|---|
| `text-sm` | — | — | Labels, badges, metadata |
| `text-base` | — | — | Body text, paragraphes |
| `text-lg` | — | — | Sous-titres, descriptions |
| `text-xl` | `sm:text-2xl` | — | h2 sections |
| `text-2xl` | `sm:text-3xl` | `lg:text-4xl` | h1 page |

**Antipatterns :**
- `text-3xl` seul sans `sm:` / `lg:` (trop gros sur mobile)
- `text-xs` pour du contenu important (< 12px, illisible sur mobile)
- Tailles custom `text-[28px]` au lieu de l'échelle Tailwind standard

### 9e — Line-height et espacement
**Standard :**
- Body text : `leading-relaxed` (1.625)
- Headings : `leading-tight` (1.25)
- Compact (badges, labels) : `leading-snug` (1.375)

**Antipatterns :**
- Headings sans `leading-tight` (line-height trop grand sur multi-lignes)
- Body text sans `leading-*` (défaut `leading-normal` = 1.5, OK mais `leading-relaxed` préféré)
- Texte dense sans `leading-snug` qui déborde verticalement

**Sévérité :** HAUTE pour hiérarchie h1/h2/h3 (impact SEO + accessibilité), MOYENNE pour le reste.

---

## Checklist 10 : Fluid Tokens (spacing & typography)

**Règle :** Le design system fournit des tokens fluides basés sur `clamp()` dans `design-tokens.json`. Préférer ces tokens aux valeurs fixes quand disponibles.

**Tokens fluides disponibles :**

| Token | Valeur | Usage |
|-------|--------|-------|
| `--spacing-section-xs` | `clamp(1rem, 2vw, 1.5rem)` | Micro-sections |
| `--spacing-section-sm` | `clamp(1.5rem, 3vw, 2.5rem)` | Sections compactes |
| `--spacing-section-md` | `clamp(2rem, 4vw, 4rem)` | Sections standard |
| `--spacing-section-lg` | `clamp(3rem, 6vw, 6rem)` | Sections hero |
| `--spacing-gap-sm` | `clamp(0.5rem, 1vw, 0.75rem)` | Gaps compacts |
| `--spacing-gap-md` | `clamp(0.75rem, 1.5vw, 1.25rem)` | Gaps standard |
| `--font-size-hero` | `clamp(2rem, 4vw, 3.5rem)` | Titres hero |
| `--font-size-section` | `clamp(1.25rem, 2.5vw, 2rem)` | Titres section |

**Antipatterns à détecter :**
- `py-6 sm:py-8 lg:py-12` quand `var(--spacing-section-md)` est disponible
- Breakpoints manuels pour du spacing qui pourrait être fluide
- `text-2xl sm:text-3xl lg:text-4xl` quand `var(--font-size-hero)` est disponible

**Pattern valide :**
```tsx
// Spacing fluide (remplace py-6 sm:py-8 lg:py-12)
className="py-[var(--spacing-section-md)]"

// Font fluide (remplace text-2xl sm:text-3xl lg:text-4xl)
className="text-[var(--font-size-hero)]"
```

**Sévérité :** BASSE (fonctionnel avec breakpoints, mais tokens fluides = code plus propre).

---

## Issues connues

| Fichier | Checklist | Issue | Statut |
|---------|-----------|-------|--------|
| `root.tsx` L377 | CK4 Viewport | `min-h-screen` (= 100vh) au lieu de `min-h-[100dvh]` | À corriger |
| `AdminSidebar.tsx` | CK3 Touch | Bouton mobile `h-10 w-10` (40px < 44px WCAG) | À corriger |

---

## Composants récents (non audités)

Composants ajoutés récemment, pas encore validés contre les checklists :

| Composant | À auditer pour |
|-----------|---------------|
| `components/home/ConseilsDiagnosticSection.tsx` | CK1 Grid, CK3 Touch, CK8 Alignement |
| `components/layout/DarkSection.tsx` | CK7 Tokens, CK5 Spacing |
| `components/layout/GlassCard.tsx` | CK7 Tokens, CK8b Cards |
| `components/layout/PageSection.tsx` | CK5 Spacing, CK10 Fluid |
| `components/layout/Reveal.tsx` | CK1 Mobile-first animations |
| `components/layout/SectionHeader.tsx` | CK8c Headers, CK9 Typo |
| `components/pieces/R2TransactionGuide.tsx` | CK2 shadcn, CK3 Touch |
| `components/ui/navigation-menu.tsx` | CK3 Touch, CK6 A11y |

---

## Composants Gold Standard (référence)

Ces composants sont conformes à toutes les checklists. Les utiliser comme modèle :

| Composant | Points forts |
|-----------|-------------|
| `components/seo/FAQSection.tsx` | shadcn Accordion + Card, responsive parfait |
| `components/ecommerce/AdvancedFilters.tsx` | shadcn Button/Checkbox/Input/Select, collapse mobile. **Caveat :** utilise `p-md`, `gap-sm`, `font-heading` (classes custom hors Tailwind standard) |
| `components/pieces/MotorisationsSection.tsx` | Grid responsive, flex-wrap, touch targets OK |
| `components/AdminSidebar.tsx` | Drawer pattern `lg:hidden` correct |
| `routes/_index.tsx` | `min-h-[44px]` partout, grids responsives |
| `pieces.$gamme route` | MobileBottomBar + sidebar toggle pattern |

---

## Format de Rapport

```markdown
## Audit Responsive — [date]

**Scope :** X fichiers scannés dans `frontend/app/`
**Résumé :** X critiques, Y hautes, Z moyennes

### CRITIQUES (X issues)
| Fichier | Ligne | Checklist | Problème | Fix proposé |
|---------|-------|-----------|----------|-------------|
| ... | ... | ... | ... | ... |

### HAUTES (X issues)
| Fichier | Ligne | Checklist | Problème | Fix proposé |
|---------|-------|-----------|----------|-------------|
| ... | ... | ... | ... | ... |

### MOYENNES (X issues)
| Fichier | Ligne | Checklist | Problème | Fix proposé |
|---------|-------|-----------|----------|-------------|
| ... | ... | ... | ... | ... |

### Conformes (X fichiers)
Liste des fichiers sans aucun problème détecté.
```

---

## Vérification Manuelle (complément)

Après l'audit automatisé, vérifier manuellement :
1. Chrome DevTools → mode responsive (iPhone SE 375px, iPhone 14 390px, iPad 768px)
2. Naviguer : Homepage → /pieces/freinage → page détail pièce → page constructeur
3. Vérifier : pas de scroll horizontal, boutons cliquables, texte lisible
4. Tester les overlays : ChatWidget, modals, Sheet/Drawer
5. Tester le Footer mobile : liens légaux accessibles

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `frontend-design` | ← recoit | Apres `/frontend-design`, audit mobile des composants construits |
| `ui-os` | ← recoit | `/ui-os` phase mobile delegue a `/responsive-audit` |
| `ui-ux-pro-max` | ← reference | Standards WCAG et contraste valides par `/ui-ux-pro-max` |
