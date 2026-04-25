# Phase 0 — Triage de contenu brut

> Référence canonique de la phase de classification multi-rôles déclenchée
> AVANT toute rédaction lorsque l'utilisateur fournit un texte brut externe
> (copié-collé, PDF, sortie ChatGPT/Gemini/Perplexity, document tiers).
>
> Cible exclusive de la modularité promise par `SKILL.md` : tout le détail
> Phase 0 vit ici, le SKILL.md ne garde que le déclencheur et le pointeur.

---

## Déclencheur

Un texte brut est fourni avec une intention de production de page. Indices :

- "Voici un texte sur {gamme}, transforme-le en page"
- "J'ai ce PDF / cette sortie ChatGPT, classe-le"
- Bloc collé > 200 mots sans rôle de page explicite
- Mélange visible de définitions + symptômes + étapes + sélections véhicule

**Si aucun de ces indices** : pas de Phase 0, passer directement Phase 1.

## Objectif

Classifier chaque bloc/paragraphe vers le **rôle de page** approprié AVANT
la rédaction, pour empêcher la production de pages cannibalisées (un seul
rôle = un seul lexique = un seul intent).

Sortie : un rapport de triage + une recommandation d'ordre de production.
Aucun contenu n'est rédigé en Phase 0.

---

## Étape 1 — Scanner et classifier

Pour chaque section ou paragraphe du contenu brut, attribuer un rôle selon
les marqueurs dominants :

| Marqueurs détectés | Rôle cible | URL pattern |
|---|---|---|
| Définition, composition, rôle mécanique, "qu'est-ce que" | **R4 Reference** | `/reference-auto/{slug}` |
| Symptômes, diagnostic, arbre de décision, codes DTC | **R5 Diagnostic** | (futur) |
| Étapes de remplacement, démontage/remontage, outils, difficulté | **R3/conseils** | `/blog-pieces-auto/conseils/{alias}` |
| Comment choisir, références OEM, checklist achat, marques | **R3/guide-achat** | `/blog-pieces-auto/guide-achat/{alias}` |
| Sélection véhicule, variantes, filtrer par | **R1 Router** | `/pieces/{slug}-{pg_id}.html` |

Pour la sémantique complète (vocabulaire exclusif, maillage interne,
matrice canonique R0-R8), voir [`page-roles.md`](page-roles.md).

### Cas ambigus

Un paragraphe peut contenir plusieurs marqueurs. Règles d'arbitrage :

1. **Marqueur dominant en volume** (≥ 60 % des phrases) gagne
2. **Sinon, marqueur dominant en finalité** (verbe d'action principal :
   _définir_ → R4, _diagnostiquer_ → R5, _remplacer_ → R3/conseils,
   _choisir_ → R3/guide-achat, _sélectionner véhicule_ → R1)
3. **Sinon, signaler "vocabulaire mixte"** dans le rapport et proposer de
   couper le bloc en deux

Aucune classification "fourre-tout" autorisée — un bloc non classifiable
est marqué `INCLASSABLE` (voir Étape 4).

---

## Étape 2 — Produire le rapport de triage

```
TRIAGE CONTENU BRUT — {nom_piece}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source : {type — PDF/ChatGPT/copié-collé/autre}
Sections analysées : {N}

RÉPARTITION PAR RÔLE :
• R3/conseils    : {X}% — {N} blocs (étapes, outils, erreurs)
• R3/guide-achat : {X}% — {N} blocs (choix, références, checklist)
• R4 Reference   : {X}% — {N} blocs (définition, composition)
• R5 Diagnostic  : {X}% — {N} blocs (symptômes, causes)
• R1 Router      : {X}% — {N} blocs (sélection véhicule)
• INCLASSABLE    : {X}% — {N} blocs (signaler en sortie)

PROBLÈMES DÉTECTÉS :
• Répétitions    : {liste des blocs qui disent la même chose}
• Incohérences   : {contradictions entre blocs}
• Vocab. mixte   : {termes exclusifs de plusieurs rôles dans le même bloc}
• Inclassables   : {blocs sans marqueur dominant}

RECOMMANDATION :
Rôle prioritaire : {rôle avec le % le plus élevé}
→ Produire d'abord le contenu {rôle} avec /seo-content-architect {gamme}
→ Les blocs {autres rôles} seront utilisés comme seed pour les autres pages
```

Le rapport est **structuré** (pas de prose libre). Le pourcentage est
calculé en fraction de blocs (pas en mots) — un bloc court compte autant
qu'un bloc long pour éviter les biais de longueur.

---

## Étape 3 — Demander confirmation

Avant de passer en Phase 1, présenter le rapport et demander :

> "Le contenu brut couvre {N} rôles. Je recommande de commencer par
> **{rôle prioritaire}**. Les blocs des autres rôles seront conservés
> comme seed. On lance ?"

Attendre une réponse explicite (`go` / `lance` / `oui` / `start` …).

Pas de réponse → ne pas démarrer Phase 1, signaler l'attente.

Réponse de réorientation (`commence par R4 plutôt`) → recalculer la
recommandation avec le rôle demandé en tête, sans relancer le scan.

---

## Étape 4 — Règles invariantes

| Règle | Pourquoi |
|---|---|
| Ne JAMAIS produire un contenu qui mélange les rôles | Cannibalisation SEO + vocabulaire mixte = pénalité Google |
| Blocs classés dans un rôle ≠ rôle cible : conservés (pas supprimés) | Seed des pages futures du même cluster |
| Si > 50 % du contenu = INCLASSABLE → signaler "contenu non structuré" et proposer `/content-audit` | Pas de production sur base bancale |
| Un bloc avec ≥ 3 marqueurs de rôles différents → couper avant classer | Pas de bloc "couteau suisse" |
| Tout bloc INCLASSABLE est listé nominativement dans le rapport | Audit trail + apprentissage |

Aucune de ces règles n'est négociable en Phase 0 — sinon Phase 1 hérite
d'un dataset pollué.

---

## Edge cases observés

- **Texte 100 % R4** (définition pure) : pas de triage utile — passer
  directement à Phase 1 avec rôle = R4.
- **PDF technique fournisseur** : souvent 70 % R4 + 30 % R3/conseils. Le
  triage capte le R3 inline et le pose en seed séparé.
- **Sortie ChatGPT longue** : généralement ~5 rôles mélangés à parts
  égales. Le rapport doit être complet pour qu'on choisisse l'ordre de
  production.
- **Copié-collé d'une page concurrente** : signaler avant tout `vocab.
  mixte` élevé → c'est précisément ce qui pénalise leur SEO, ne pas
  reproduire.

---

## Sortie attendue

Phase 0 produit **uniquement** :

1. Le rapport de triage formaté ci-dessus
2. Une recommandation de rôle prioritaire
3. Un fichier seed implicite (les blocs hors rôle cible, conservés en
   contexte pour les phases ultérieures du même cluster)

Phase 0 ne produit **jamais** : du contenu rédigé, des meta-tags, du
JSON-LD, des recommandations d'URL définitives.

---

## Liens

- [`page-roles.md`](page-roles.md) — vocabulaire exclusif R1-R8 et
  matrice canonique
- [`quality-scoring.md`](quality-scoring.md) — seuils utilisés en Phase 4
  (post-rédaction, hors scope Phase 0)
- `SKILL.md` (parent) — orchestration des phases 0 → 4
