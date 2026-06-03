# Product scene prompt template — Higgsfield MCP

> Pour générer des scènes produit isolées (pièce mécanique close-up macro, schéma technique animé).
> **Jamais utilisé comme preuve d'état réel de la pièce client.**

## Slots à remplir

| Slot | Exemple |
|---|---|
| `{{piece_name}}` | vanne EGR / plaquette de frein / alternateur / filtre à air |
| `{{piece_state}}` | neuve / signes d'usure légère / encrassement (jamais « usée du client X ») |
| `{{angle}}` | gros plan macro / vue 3/4 / coupe stylisée |
| `{{background}}` | fond neutre studio / atelier flou / schéma technique |
| `{{animation_hint}}` | rotation lente 360° / zoom progressif / superposition schéma |
| `{{duration_sec}}` | 3 à 8 secondes (segment éducatif) |
| `{{aspect}}` | 9:16 vertical |
| `{{model_hint}}` | seedream / flux (pour image) puis kling pour animation |

## Template prompt (image)

```
Sujet : {{piece_name}} {{piece_state}}, isolée, plan {{angle}}.
Fond : {{background}}.
Éclairage : éclairage studio doux 3 points, ombres subtiles, palette neutre garage.
Détails : matériaux réalistes (métal, plastique, caoutchouc selon pièce), pas de marquage logo fabricant sauf si négocié.
Style : photoréaliste sobre éducatif, pas de filtre stylisé exagéré.
Interdits : pas de texte overlay (texte = Remotion), pas de comparaison directe avec autre pièce sans contexte, pas de logo concurrent.
```

## Template prompt (animation suivante)

```
Animation : {{animation_hint}} à partir de l'image de référence {{image_id}}.
Mouvement : {{animation_hint}}, durée {{duration_sec}}s.
Caméra : statique ou pan minimal, focus reste sur la pièce.
Aspect : {{aspect}}.
Interdits : pas de transformation morphologique (la pièce ne doit pas changer de forme), pas de transition magique trompeuse.
```

## Règles strictes

- ❌ **Aucune photo réelle de pièce client présentée comme générée IA** (interdiction inverse aussi : ne pas générer une scène qui imite une vraie pièce client)
- ❌ **Aucune comparaison avant/après IA** (interdit comme preuve diagnostic — G6)
- ❌ **Aucun logo concurrent visible** sauf accord commercial explicite
- ❌ **Aucune mise en scène trompeuse** (pièce qui s'use à vue d'œil, etc.)
- ✅ Pièces neuves génériques OK (`truth_dependency=reference`)
- ✅ Schémas techniques stylisés OK (`truth_dependency=illustration`)
- ✅ Macros abstraites d'état d'usure OK (`truth_dependency=illustration`)

## Output attendu

1 fichier image `.png` (image statique de référence) OU `.mp4` (animation) selon usage. Stocké S3 + manifest JSON.

## Voir aussi

- `README.md` (règles Higgsfield V1)
- `broll-prompt-template.md`
- Skill `[[fafa-brand-safety-reviewer]]` gates G3 (Brand), G5 (Reuse), G6 (Visual Honesty)
