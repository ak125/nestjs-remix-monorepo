# B-roll prompt template — Higgsfield MCP

> Pour générer des plans illustratifs (atelier, schémas animés, ambiance). **Jamais utilisés comme preuve mécanique.**

## Slots à remplir

| Slot | Exemple |
|---|---|
| `{{scene_type}}` | atelier garage / schéma technique / ambiance route / close-up pièce |
| `{{vehicle_context}}` | berline familiale capot ouvert / aucun véhicule visible / châssis sous-jacent |
| `{{lighting}}` | éclairage atelier néon / lumière naturelle journée / contre-jour stylisé |
| `{{mood}}` | pédagogique / sobre / dramatique léger |
| `{{duration_sec}}` | 2 à 6 secondes max (b-roll court) |
| `{{aspect}}` | 9:16 vertical (TikTok/Reels/Shorts) |
| `{{model_hint}}` | kling-2.5 / veo-3 / soul-1 (selon test comparatif) |

## Template prompt

```
Scène : {{scene_type}}, contexte {{vehicle_context}}.
Éclairage : {{lighting}}, mood {{mood}}.
Composition : plan large pédagogique, sans personne identifiable au visage, sans logo de marque visible, sans plaque d'immatriculation.
Style : photoréaliste sobre, pas de filtre stylisé exagéré, palette neutre garage.
Mouvement caméra : statique ou pan lent uniquement (lisibilité 9:16 mobile).
Durée : {{duration_sec}}s, format {{aspect}}.
Interdits : pas de texte overlay, pas d'avatar humain identifiable, pas de gros plan diagnostic (réservé à plans techniques validés), pas de symboles concurrents.
```

## Règles strictes

- ❌ **Aucun visage humain identifiable** — pas d'imitation de mécanicien réel
- ❌ **Aucun logo de marque** (Bosch, Valeo, etc.) sauf si negotiated brand
- ❌ **Aucune plaque d'immatriculation lisible** (RGPD)
- ❌ **Aucun mouvement caméra rapide** (lisibilité mobile dégradée)
- ❌ **Aucun texte overlay généré IA** (texte = Remotion uniquement, contrôlé)
- ✅ Plans larges, ambiance, atelier générique
- ✅ Schémas animés stylisés (flux gaz, principe pression, usure)
- ✅ Macro abstraite de pièce (sans contexte véhicule identifiable)

## Output attendu

1 fichier `.mp4` court, 9:16, `truth_dependency` = `illustration` ou `ambiance` (jamais `proof`).

## Voir aussi

- `README.md` — règles Higgsfield V1
- Skill `[[fafa-brand-safety-reviewer]]` (gate G6 Visual Honesty)
- `.spec/00-canon/video-governance-p0.md` (matrice visuels autorisés/interdits)
