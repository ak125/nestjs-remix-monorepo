# Avatar prompt template — Higgsfield MCP

> **OPTIONNEL V1**. Fafa peut tourner sans avatar IA (voix + sous-titres + plans garage + schémas + motion text suffisent).
> Si utilisé, respecter strictement la persona Fafa figée.

## Slots à remplir

| Slot | Valeur Fafa V1 figée |
|---|---|
| `{{character_identity}}` | « Fafa, mécano IA AutoMecanik » (assumée explicitement) |
| `{{visual_style}}` | mécano garage de quartier, ton accessible, lunettes optionnelles, t-shirt simple |
| `{{age_range}}` | 35-45 ans apparent |
| `{{gender_neutral_or_specific}}` | (cohérent avec choix initial Fafa, à figer dans vault PR A) |
| `{{ethnic_neutrality}}` | éviter caricature, traits neutres |
| `{{voice_sync}}` | sync avec piste voix ElevenLabs |
| `{{aspect}}` | 9:16 vertical, plan poitrine ou plan moyen |
| `{{model_hint}}` | kling-avatar ou équivalent disponible via Higgsfield MCP (à choisir selon test comparatif) |

## Template prompt

```
Personnage : {{character_identity}}, mécano de garage de quartier, accessible, pédagogue.
Apparence : {{visual_style}}, {{age_range}}, traits {{ethnic_neutrality}}.
Identité IA explicite (pas de tentative de réalisme humain trompeur, pas d'imitation d'une personne réelle).
Décor : atelier garage sobre arrière-plan flou, éclairage chaleureux mais professionnel.
Expression : calme, légère assurance pédagogique, sourire occasionnel, JAMAIS de surenchère commerciale.
Mouvement : statique parlant face caméra, mouvements naturels mains/visage légers.
Aspect : {{aspect}}, plan poitrine ou moyen.
Sync : lipsync précis avec piste voix fournie.
```

## Règles strictes Fafa persona

- ✅ **Toujours assumer l'identité IA** (transparence YouTube/TikTok 2026 obligatoire)
- ✅ **Disclaimer ai_generated_notice** dans disclaimer plan
- ❌ **Aucune ressemblance avec une personne réelle identifiable** (politicien, influenceur, employé)
- ❌ **Aucune voix imitant une personne réelle** (voix Fafa propriétaire ElevenLabs ou équivalent)
- ❌ **Aucune surpromesse commerciale** dans expression faciale (vente agressive, urgence)
- ❌ **Aucun geste pouvant être interprété comme caution médicale/légale**

## Output attendu

1 fichier `.mp4` 9:16 avec avatar parlant, `visual_type` = `motion_text` ou `ambiance` (jamais `proof`), `truth_dependency` = `illustration`.

## Avant utilisation V1

- [ ] Vault PR A merged avec `rules-fafa-persona-canon-v1.md` figée
- [ ] Apparence Fafa figée et validée par owner
- [ ] Voix Fafa propriétaire générée et figée
- [ ] Disclaimer ai_generated_notice intégré dans le rendu final (overlay continu ou intro+outro)

**Sans ces 4 pré-requis → NE PAS générer d'avatar Fafa.** Utiliser b-roll + voix off à la place.

## Voir aussi

- `personas/fafa.md`
- `README.md` (règles Higgsfield V1)
- Vault PR A `rules-fafa-persona-canon-v1.md`
