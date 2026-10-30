# Higgsfield MCP — Provider externe officiel (V1 prioritaire test)

> **MCP URL** : `https://mcp.higgsfield.ai/mcp`
> **Statut V1** : optional asset generation only — **2-3 pilotes V1 max, jamais plus**.

## Pourquoi Higgsfield

Couche MCP officielle qui pilote plusieurs modèles vidéo/image depuis une seule interface agentique :

| Modèles disponibles | Type |
|---|---|
| Soul, Cinema Studio, Flux, Seedream | Image / scènes |
| Kling, Minimax Hailuo, Veo | Vidéo générative |

**Outils MCP additionnels** : génération image/vidéo, history, characters trained, Marketing Studio, brand kits, hooks, ad references, billing/credits, workspaces, virality predictor.

Plus sérieux que les MCPs GitHub non officiels (`geopopos/higgsfield_ai_mcp`) — provider officiel maintenu.

## Pourquoi V1 limité à 2-3 pilotes

V1 = prouver que la chaîne éditoriale Fafa Media Factory tient. Higgsfield est un **accélérateur** pour comparer plusieurs modèles vidéo, pas l'asset principal.

- ✅ Tester Higgsfield sur 2-3 pilotes (1 par modèle clé : Soul vs Veo vs Kling par ex.)
- ❌ NE PAS utiliser Higgsfield sur les 10 pilotes — diluerait l'analyse pattern
- ❌ NE PAS intégrer en runtime (pas de dépendance hard backend V1)
- ❌ NE PAS publier automatiquement (`publish_approved=false` strict)

## Règles strictes (hors gates, sauf la première : G6 `visual_role`, après rendu)

| Règle | Pourquoi |
|---|---|
| ❌ Aucun asset généré n'est utilisé comme **preuve** mécanique | G6 `visual_role` : chaque visuel du rendu relevé comme preuve compte, un seul = FAIL |
| ❌ Aucune transformation d'asset source concurrent | Statut `INSPIRED_PATTERN_ONLY` obligatoire ; G5 Reuse Risk ne le lit pas (score de similarité du script seul, sans producteur au 18/10) |
| ❌ Aucune auto-publication | Workflow V1 = owner-only (`publish_approved=false` strict) |
| ✅ Tout asset stocké S3 (`s3://automecanik-renders/higgsfield/`) | Anti-binaires-en-git (`.gitignore` racine) |
| ✅ Manifest JSON dans `manifests/renders/*.json` avec `provider: "higgsfield"` + `model: "..."` | Traçabilité + reproductibilité |
| ✅ Mention IA assumée dans disclaimer plan | Transparence YouTube/TikTok 2026 |

## Workflow V1 typique

1. Owner identifie un pilote DRAFT_ONLY qui bénéficierait d'un b-roll IA cinématique
2. Choisir le template prompt approprié (`broll-prompt-template.md` / `avatar-prompt-template.md` / `product-scene-template.md`)
3. Personnaliser le prompt avec contexte vidéo (gamme, scène, durée, style)
4. Invoquer Higgsfield MCP (manuel cette V1) avec modèle choisi
5. Récupérer asset → upload S3 → manifest JSON
6. Après rendu, le skill `fafa-brand-safety-reviewer` rejoue les 7 gates sur le dossier de la vidéo ; aucune ne juge l'asset seul
7. Asset utilisable comme `truth_dependency=illustration` ou `reference` (jamais `proof`), après relecture de l'owner ; G6 ne rend jamais PASS (0 visuel relevé = WARN)

## Schéma manifest

```json
{
  "video_id": "fafa-vanne-egr-001",
  "asset_id": "higgsfield-broll-001",
  "provider": "higgsfield",
  "model": "kling|veo|soul|flux|...",
  "prompt_template_used": "broll-prompt-template",
  "prompt_hash_sha256": "...",
  "s3_key": "s3://automecanik-renders/higgsfield/fafa-vanne-egr-001/broll-001.mp4",
  "duration_sec": 4.0,
  "format": "9:16",
  "visual_type": "ambiance",
  "truth_dependency": "illustration",
  "generated_at": "2026-05-28T...",
  "credits_consumed": 12
}
```

## Coût / quota

Higgsfield = pay-per-credit. V1 budget recommandé :
- Plafond strict 2-3 pilotes V1 max (~50-100 crédits estimés)
- Pas d'auto-renewal
- Suivi crédits dans `notes` du CSV metrics

## Voir aussi

- `broll-prompt-template.md` — template prompt b-roll (atelier, schéma, ambiance)
- `avatar-prompt-template.md` — template prompt avatar Fafa (avec règles persona strictes)
- `product-scene-template.md` — template prompt scène produit (pièce isolée, close-up macro)
- Skill `[[fafa-video-prompt-builder]]`
