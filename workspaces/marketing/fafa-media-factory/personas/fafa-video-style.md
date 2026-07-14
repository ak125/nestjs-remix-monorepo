# Fafa — Video Style (guide vidéo 9:16)

> Guide **style vidéo** (motion, typo, mise en page) pour les compositions Remotion Fafa et les
> assets associés. La narration par format vit dans [`../formats/`](../formats/) ; les couleurs
> dans [`fafa-brand-palette.md`](fafa-brand-palette.md) ; le verrou visuel dans
> [`fafa-visual-reference-lock.md`](fafa-visual-reference-lock.md).

## Format conteneur

- **9:16 vertical, 1080×1920, 30 fps.** Mobile-first (TikTok / Reels / Shorts / FB Reels).
- **Safe areas** : marge 60 px gauche/droite pour le texte ; bas réservé (barre de progression +
  disclaimer overlay + UI plateforme) → pas de texte critique sous ~160 px du bas.
- **Durée** : selon le format (SHORT 15-60 s ; `ne-change-pas-trop-vite` 30-45 s).

## Typographie

- Police compositions : `Liberation Sans` (système, pas de webfont — rendu déterministe).
- Hiérarchie : hook ~64 px bold · accent/symptôme ~28 px caps · corps 38-46 px · sous-titres
  24 px · disclaimer 18 px.
- **Une seule idée par séquence**, phrases courtes, gras sur le mot-clé.

## Motion

- `spring({damping:12, stiffness:70-80})` pour les titres ; `interpolate` clamp pour
  opacity/slide. Reveal séquentiel des cartes (slide-left).
- **Pas de mouvement rapide** (lisibilité mobile). Barre de progression orange en bas.

## Mise en page de marque

- **Badge disclosure IA** : mention « Fafa — mécano IA » visible (intro ou overlay continu) +
  disclaimer `ai_generated_notice`. Non négociable (G6 + conformité plateformes 2026).
- **Logo AutoMecanik** : asset officiel `frontend/public/` uniquement, **jamais redessiné**.
- Couleurs : voir [`fafa-brand-palette.md`](fafa-brand-palette.md) (navy fond / bleu cartes /
  orange CTA, rouge interdit sauf danger).

## Équilibre éditorial (risque #1)

**Sécurité dans les artefacts** (claims/evidence/gates) — **énergie dans la vidéo**. Le rendu doit
rester TikTok : accroche forte, visuel immédiat, rythme rapide, CTA clair. Ne pas produire une
vidéo « trop compliance » et oubliable.

## Voir aussi

- [`../formats/`](../formats/) · `.spec/00-canon/video-governance-p0.md` · Skill `fafa-remotion-template-planner`
