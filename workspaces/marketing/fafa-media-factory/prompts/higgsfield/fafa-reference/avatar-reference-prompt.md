# Fafa — Prompt image-référence officielle (Higgsfield)

> Génère **l'image-référence canonique** de Fafa (verrou anti-dérive). Aligné sur les slots de
> [`../avatar-prompt-template.md`](../avatar-prompt-template.md) + charte
> [`../../../personas/fafa-brand-palette.md`](../../../personas/fafa-brand-palette.md).
> Objectif : **portrait référence propre** (pas un poster chargé), réutilisable comme seed pour
> toutes les futures vidéos. Sortie → S3 + manifest
> [`../../../manifests/renders/fafa-reference-v1.json`](../../../manifests/renders/fafa-reference-v1.json).

## Slots (figés V1)

| Slot | Valeur |
|---|---|
| `character_identity` | Fafa, **mécano IA d'AutoMecanik** (persona virtuel assumé) |
| `visual_style` | semi-réaliste premium, propre, cohérent, réutilisable |
| `age_range` | 35-45 ans apparent |
| `ethnic_neutrality` | traits neutres, non caricaturaux |
| `aspect` | **9:16 vertical**, plan poitrine, image stable nette |
| `model_hint` | Higgsfield — modèle à choisir (Soul / Flux / Seedream), test comparatif |

## Prompt

```
Image-référence officielle du persona « Fafa Mécano », le mécano IA d'AutoMecanik.

Fafa est un avatar IA stylisé mais crédible, clairement assumé comme persona virtuel de
conseil pièces auto. Il ne doit PAS être présenté comme un vrai humain réel. Style
semi-réaliste premium, propre, cohérent et réutilisable comme référence.

Charte AutoMecanik STRICTE :
- navy #0F1E38 = couleur principale,
- bleu #0F4C81 = couleur secondaire,
- orange #F97316 = accent CTA uniquement,
- blanc et gris métal pour la lisibilité.
NE PAS utiliser le rouge comme couleur dominante.

Fafa porte une combinaison navy avec détails bleus et liserés orange, badge simple « FAFA »,
gants de mécanicien sobres. Atelier propre, moderne, réaliste : établi avec une pièce auto
neuve et une pièce usée, une tablette de compatibilité véhicule, un colis AutoMecanik discret.
Aucun grand texte généré. Aucun nouveau logo AutoMecanik inventé.

Expression : sympathique, expert, pédagogue, proche des automobilistes.
Cadrage : portrait vertical 9:16, plan poitrine, image claire et stable, fond atelier
légèrement flou. Référence propre (pas de surcharge de poster).
```

## Negative prompt

```
style cartoon, garage sale/désordonné, logo déformé ou réinventé, texte illisible, mains
déformées, voiture futuriste, ambiance luxe, personnage mannequin, publicité agressive,
fausses pièces, interface illisible, visage instable, rouge dominant, ressemblance avec une
personne réelle identifiable, plaque d'immatriculation lisible, logo concurrent.
```

## Après génération (owner)

1. Générer 3-4 variantes → choisir la plus canonique (visage clair, charte respectée).
2. Upload S3 `s3://automecanik-renders/brand/fafa/reference-v1.png`.
3. Renseigner [`../../../manifests/renders/fafa-reference-v1.json`](../../../manifests/renders/fafa-reference-v1.json)
   (clé S3 + `prompt_hash_sha256` + `model` + seed/character-id).
4. Renseigner la ligne « Image-référence » de
   [`../../../personas/fafa-visual-reference-lock.md`](../../../personas/fafa-visual-reference-lock.md).
5. Cocher les pré-requis avatar dans [`../avatar-prompt-template.md`](../avatar-prompt-template.md).

> Asset binaire = **S3 uniquement**, jamais committé (`.gitignore` bloque les médias ; un `.png`
> de référence reste hors-repo par cohérence avec la règle « assets générés → S3 »).
