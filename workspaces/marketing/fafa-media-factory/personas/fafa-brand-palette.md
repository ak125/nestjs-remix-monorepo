# Fafa — Brand Palette (mapping d'USAGE)

> **⚠️ Ceci n'est PAS une source de vérité couleurs.** La SoT = **`packages/design-tokens`**
> (`@fafa/design-tokens`, `src/tokens/design-tokens.json` + `COLOR-SYSTEM.md`).
> Ce fichier décrit **comment Fafa applique** ces tokens — il ne redéfinit aucune valeur
> comme autorité (anti-duplication `[CRITICAL]`). Si un hex diverge des tokens, **les tokens
> gagnent**.

## Tokens utilisés (valeurs ⟵ design-tokens)

| Token | Hex | Rôle marque |
|---|---|---|
| `primary` | `#0F1E38` | Navy — couleur dominante (fonds) |
| `secondary` | `#0F4C81` | Bleu — surfaces/cartes, détails |
| `action` | `#F97316` | Orange — **CTA / accent uniquement** |
| `warning` | `#D68910` | Ambre — avertissement / sévérité moyenne |
| `danger` | `#C0392B` | Rouge — **danger / voyant / alerte uniquement** |
| (texte) | `#FFFFFF` / `rgba(255,255,255,.85/.55/.4)` | Texte / sous-titres / muted |

## Règles d'application Fafa

- **Navy dominant** : fond des compositions, tenue de base.
- **Bleu = détails** : cartes/panels, liserés secondaires, tablette compat.
- **Orange = CTA/accent SEULEMENT** : titres d'accroche, bordure gauche de carte, n° de séquence,
  marque, barre de progression, boutons CTA. **Jamais** en aplat de fond.
- **Rouge INTERDIT** sauf sémantique **danger/voyant/alerte** (ex. icône voyant moteur). Jamais décoratif.
- **Ambre** = sévérité « medium » (échelle d'usure), pas un accent libre.
- **Contraste** : texte blanc sur navy/bleu OK. Ne jamais poser orange sur orange.

## État compositions Remotion

Les 3 compositions Fafa (`NeChangePasTropVite`, `SymptomeTroisCauses`, `PieceExpliquee`) sont
alignées sur ce mapping depuis la **PR #801** (correction du drift `#1a1a2e/#16213e/#e94560/#f0a500`).

## Voir aussi

- `packages/design-tokens/COLOR-SYSTEM.md` (SoT) · [`fafa-visual-reference-lock.md`](fafa-visual-reference-lock.md)
