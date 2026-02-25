# Hero Components Contract

> Regles communes a tous les composants Hero du site.
> Ref: .spec/00-canon/image-matrix-v1.md §7

## Regles

1. **H1 unique** : le Hero rend le `<h1>`. La route ne doit plus avoir d'autre `<h1>`.
2. **Pas de texte dans l'image** : tout texte est en HTML (H1, description, badges).
3. **Animations** : `transition-[opacity,transform] duration-200` max. Pas de `transition-all`.
4. **Hauteurs** : `py-*` + `min-h-*` optionnel. Pas de ratio force en CSS (sauf Selection 3:1).
5. **Image alt obligatoire** : si `image` prop fournie, `alt` est requis (`image: { src: string; alt: string }`).
6. **LCP** : les images hero sont `loading="eager"` (pas lazy) car elles sont souvent LCP.
7. **Mobile** : `py` diminue en `sm:`, le hero ne doit pas depasser 50vh.
8. **Couleurs** : utiliser `getFamilyTheme()` pour les gradients et accents famille.

9. **Slogans** : prop `slogan?: string` optionnel, rendu dans un `<p>` (jamais dans `<h1>` ni dans les images). Max 60 caracteres. Genere par `resolveSlogan()` depuis `visual-intent.ts`.
10. **Animation level** : respecter `getAnimationClasses()` de `visual-intent.ts`. Jamais depasser `transition-[opacity,transform] duration-200`. Trois niveaux : `none`, `subtle` (opacity), `moderate` (opacity+transform).
11. **HeroRole** : intent class `role-piece`, hero_policy `illustration`, tier `pedagogical`. Utilise gradient famille + illustration technique optionnelle. Distinct de HeroReference (minimal, encyclopedique).

## Composants

| Composant | hero_policy | Intent classes |
|-----------|------------|----------------|
| HeroReference | none | GLOSSAIRE_REFERENCE |
| HeroSelection | gradient | SELECTION |
| HeroDiagnostic | illustration | DIAGNOSTIC, PANNE_SYMPTOME |
| HeroBlog | photo | BLOG_CONSEIL |
| HeroGuide | photo | GUIDE_ACHAT |
| HeroTransaction | photo | TRANSACTION |
| HeroRole | illustration | ROLE_PIECE |
