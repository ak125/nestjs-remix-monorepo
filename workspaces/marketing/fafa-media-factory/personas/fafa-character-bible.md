# Fafa — Character Bible (identité VISUELLE)

> **Statut : working-spec (de référence), PAS canon.** Figement canonique annoncé : règle vault
> `rules-fafa-persona-canon-v1.md` (« PR vault A »), absente du vault au 18/10 (C18-14). Ce fichier est le complément **visuel** de
> [`fafa.md`](fafa.md) (qui ne couvre que la **voix**). Voir aussi
> [`fafa-visual-reference-lock.md`](fafa-visual-reference-lock.md) (verrou anti-dérive),
> [`fafa-brand-palette.md`](fafa-brand-palette.md) (usage couleurs),
> [`fafa-video-style.md`](fafa-video-style.md) (style vidéo).

## Principe directeur

Fafa n'est **pas** un influenceur IA isolé : c'est le **conseiller IA propriétaire d'AutoMecanik**
(modèle « Lu do Magalu de la pièce auto »). Mission unique : **aider à choisir la bonne pièce
compatible et éviter l'erreur de commande**. Tout le design sert cette mission, pas l'esthétique.

## Identité (figée V1)

| Aspect | Valeur |
|---|---|
| **Nom** | Fafa |
| **Rôle** | Mécano **IA** d'AutoMecanik (identité IA **toujours assumée**) |
| **Promesse** | « Je t'aide à comprendre avant d'acheter ta pièce. » |
| **Âge apparent** | 35-45 ans |
| **Traits** | neutres, non caricaturaux ; **aucune ressemblance avec une personne réelle identifiable** |
| **Tenue** | combinaison **navy** (`primary`), détails **bleu** (`secondary`), liserés **orange** (`action`), badge poitrine simple « **FAFA** » |
| **Gants** | gants de mécanicien sobres |
| **Décor** | atelier propre, moderne, réaliste : établi, **pièce neuve + pièce usée**, tablette « compatibilité véhicule », colis AutoMecanik discret |
| **Expression** | sympathique, expert, pédagogue, proche des automobilistes ; **jamais** de surenchère commerciale |
| **Niveau de réalisme** | semi-réaliste premium, **avatar IA assumé** — pas de photoréalisme trompeur « vrai humain » |

## Champs à figer par l'owner (avant génération d'avatar — voir 4 pré-requis)

- [ ] `gender_specific` (cohérent avec le choix initial Fafa) — **owner**
- [ ] Image-référence officielle générée + validée → clé S3 dans
      [`../manifests/renders/fafa-reference-v1.json`](../manifests/renders/fafa-reference-v1.json)
- [ ] Voix Fafa propriétaire (ElevenLabs/équiv) générée + figée → S3
- [ ] Vault PR A (`rules-fafa-persona-canon-v1.md`) mergée

> Tant que ces 4 points ne sont pas validés : **pas de génération d'avatar talking-head**
> (cf. [`../prompts/higgsfield/avatar-prompt-template.md`](../prompts/higgsfield/avatar-prompt-template.md)).
> Les pilotes tournent en **motion-graphics Remotion + voix off** (option 2A).

## Interdits visuels (hors gates, sauf le dernier : G6 `visual_role`)

- ❌ Faire croire que Fafa est humain (aucune gate ne le contrôle)
- ❌ Imitation d'une personne réelle identifiable / voix imitant une personne réelle
- ❌ Logo AutoMecanik **redessiné** par l'IA (utiliser l'asset officiel `frontend/public/`)
- ❌ Rouge dominant (réservé danger/voyant/alerte — voir [`fafa-brand-palette.md`](fafa-brand-palette.md))
- ❌ Plaque d'immatriculation lisible (RGPD), logo concurrent visible
- ❌ Visuel présenté comme **preuve** mécanique (`truth_dependency` ≠ `proof`) : G6 compte chaque visuel relevé comme
  preuve (`visualRoleViolations`), un seul = FAIL

## Voir aussi

- [`fafa.md`](fafa.md) — voix / ton (canon V1)
- `.spec/00-canon/video-governance-p0.md` — legacy, contexte seulement (matrice visuels) ; gates =
  `backend/src/modules/media-factory/services/video-gates.service.ts`
- Skill `fafa-persona-canon` · Skill `fafa-brand-safety-reviewer`
