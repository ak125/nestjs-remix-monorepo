# Fafa — Visual Reference Lock (verrou anti-dérive)

> **But : empêcher la dérive visuelle entre vidéos.** Les générateurs IA dérivent vite
> (visage, tenue, couleurs). CE fichier est la contrainte que **chaque image/vidéo générée
> doit respecter**. Court et opérationnel — la justification détaillée est dans
> [`fafa-character-bible.md`](fafa-character-bible.md).

## Non-negotiable visual invariants

- **Même visage apparent** sur toutes les sorties (même image-référence / seed verrouillée).
- **Badge « FAFA » toujours simple, lisible, non décoratif.**
- **Le logo AutoMecanik n'est JAMAIS redessiné par l'IA** (asset officiel `frontend/public/` uniquement).
- **Orange uniquement pour CTA / accent** — jamais en couleur dominante.
- **Rouge interdit sauf danger / voyant / alerte.**
- **Fafa est présenté comme mécano IA**, jamais comme une personne réelle.

## Référence verrouillée

| Élément | Valeur verrouillée | Source de vérité |
|---|---|---|
| Image-référence | _(à remplir : clé S3 après génération + validation owner)_ | [`../manifests/renders/fafa-reference-v1.json`](../manifests/renders/fafa-reference-v1.json) |
| Seed / character-id | _(à remplir : seed ou Higgsfield trained-character id)_ | manifest |
| Tenue | combinaison navy + détails bleu + liserés orange + badge FAFA | [`fafa-character-bible.md`](fafa-character-bible.md) |
| Couleurs | navy `#0F1E38` · bleu `#0F4C81` · orange CTA `#F97316` | `@fafa/design-tokens` (voir [`fafa-brand-palette.md`](fafa-brand-palette.md)) |
| Atelier | propre/moderne, établi pièce neuve+usée, tablette compat, colis AutoMecanik discret | character-bible |
| Niveau réalisme | semi-réaliste premium, IA assumée (pas photoréaliste trompeur) | character-bible |

## Angles autorisés / interdits

| ✅ Autorisés | ❌ Interdits |
|---|---|
| Plan poitrine / plan moyen face caméra | Gros plan extrême déformant le visage |
| Pan lent / statique (lisibilité mobile 9:16) | Mouvements caméra rapides |
| Léger 3/4 cohérent avec la référence | Profils/angles non couverts par la référence |
| Mains désignant une pièce / la tablette | Mains déformées, gestes ambigus |

## Règle d'usage

Avant toute génération (avatar, b-roll avec Fafa, miniature) : **vérifier la sortie contre ces
invariants**. Toute dérive (visage différent, logo redessiné, rouge dominant, orange envahissant,
IA non assumée) = **rejet**, régénérer. En review, le skill `fafa-brand-safety-reviewer`
applique G3 (Brand) + G6 (Visual Honesty STRICT).

## Voir aussi

- [`fafa-character-bible.md`](fafa-character-bible.md) · [`fafa-brand-palette.md`](fafa-brand-palette.md) · [`fafa-video-style.md`](fafa-video-style.md)
- [`../prompts/higgsfield/avatar-prompt-template.md`](../prompts/higgsfield/avatar-prompt-template.md) (4 pré-requis avatar)
