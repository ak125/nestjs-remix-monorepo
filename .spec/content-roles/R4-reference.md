# R4 — RÉFÉRENCE : Brief Générateur de Contenu

> **Route :** `/reference-auto/{slug}`
> **Table :** `__seo_reference`
> **Gold standard :** `disque-de-frein` (id=106)

---

## 1. Identité du rôle

| Attribut | Valeur |
|----------|--------|
| Rôle SEO | R4 — RÉFÉRENCE |
| URL | `/reference-auto/{slug}` |
| Intention | Définition canonique d'une pièce automobile |
| Funnel | Consideration |
| Persona | Automobiliste qui cherche "c'est quoi un {pièce} ?" ou mécanicien amateur qui vérifie |
| Ton | Technique mais accessible — pas de jargon non expliqué |
| Schema.org | DefinedTerm + TechArticle + BreadcrumbList + FAQPage |

### Ce que R4 EST

- L'entrée encyclopédique d'une pièce auto (Larousse technique)
- La vérité mécanique de référence
- Un contenu quasi-incopiable grâce aux données numériques précises
- Le hub de maillage vers R1 (achat), R3 (conseils), R5 (diagnostic)

### Ce que R4 N'EST PAS

- Pas une page produit → R1 `/pieces/{slug}-{pgId}.html`
- Pas un guide d'achat → R1 purchase guide (sgpg)
- Pas un article conseils → R3 `/blog-pieces-auto/conseils/{alias}`
- Pas un diagnostic de panne → R5 `/diagnostic-auto/{slug}`
- Pas une page marketing — zéro CTA commercial, zéro prix promotionnel

---

## 2. Schéma DB — Champs à remplir

| Champ | Type | Obligatoire | Longueur cible | Règle |
|-------|------|:-----------:|----------------|-------|
| `title` | text | OUI | 40-80 chars | `{Nom pièce} : définition, rôle et remplacement \| Guide Auto` |
| `meta_description` | text | OUI | 140-160 chars | Nom pièce + rôle principal + 1 mot-clé symptôme |
| `definition` | text | OUI | 800-2000 chars | Voir §3 — minimum 4 données chiffrées |
| `role_mecanique` | text | OUI | 300-600 chars | Voir §4 — transformation physique + seuil critique |
| `role_negatif` | text | OUI | 300-600 chars | Voir §5 — 4-6 phrases "ne fait pas" |
| `composition` | text[] | OUI | 3-7 éléments | Voir §6 — matériau + spec chiffrée par élément |
| `confusions_courantes` | text[] | OUI | 3-5 éléments | Voir §7 — format "A ≠ B : explication" |
| `regles_metier` | text[] | OUI | 3-5 éléments | Voir §8 — verbe d'action + pourquoi |
| `symptomes_associes` | text[] | OUI | 3-6 slugs | Slugs `__seo_observable` existants |
| `scope_limites` | text | OUI | 100-300 chars | Voir §9 — couvre / ne couvre pas |
| `blog_slugs` | text[] | RECO | 1-3 slugs | Articles R3 liés |
| `related_references` | int[] | RECO | 1-4 IDs | Autres R4 du même système mécanique |
| `content_html` | text | NON | — | Contenu riche additionnel (rare) |
| `pg_id` | int | OUI | — | FK vers `pieces_gamme.pg_id` |
| `canonical_url` | text | AUTO | — | `/reference-auto/{slug}` (construit par le controller) |

---

## 3. Définition — 3 paragraphes obligatoires

### Paragraphe 1 — Quoi + Où

- Nom de la pièce + sa fonction principale en 1 phrase
- Où elle se situe dans le véhicule (système, emplacement physique)
- Comment elle fonctionne (principe physique simplifié)
- **Minimum 2 données chiffrées** (pression, température, couple, dimensions)

### Paragraphe 2 — Types / Variantes

- Les variantes qui existent (ex : ventilé/plein, mécanique/hydraulique, simple/double)
- Différences clés entre les variantes
- **Minimum 1 donnée chiffrée par variante** (épaisseur, diamètre, capacité)

### Paragraphe 3 — Usure et remplacement

- Signes d'usure principaux (ce que le conducteur perçoit)
- Critère de remplacement absolu (la mesure qui tranche)
- Fourchette de coût remplacement en € (par essieu ou par unité selon la pièce)

### Anti-patterns INTERDITS

- ❌ "Cette pièce joue un rôle essentiel dans le bon fonctionnement du véhicule"
- ❌ Phrases sans données chiffrées (min 4 chiffres dans la définition complète)
- ❌ Copie Wikipedia ou paraphrase évidente
- ❌ Langage marketing ("prix imbattable", "qualité premium", "large choix")
- ❌ Texte sans accents français ("vehicule", "securite", "systeme")
- ❌ Phrases creuses ("il est important de", "il convient de noter que")

### Score qualité minimum

**4 données chiffrées distinctes** dans la définition = seuil de publication.

---

## 4. Rôle mécanique

- 1 paragraphe dense (300-600 chars)
- Décrire la **transformation physique** (énergie cinétique → chaleur, rotation → translation, pression → force, etc.)
- Inclure les contraintes de fonctionnement (force en kN, pression en bars, température en °C, couple en Nm)
- Mentionner le **seuil critique de défaillance** (à partir de quelle valeur ça casse/dysfonctionne)

**Template :**

> Le {pièce} convertit {entrée} en {sortie}. En fonctionnement normal, il supporte {contrainte chiffrée}. Au-delà de {seuil}, {conséquence grave}. Sa masse/dimension de {valeur} détermine directement {caractéristique de performance}.

---

## 5. Rôle négatif ("Ce que ça NE fait PAS")

- 4-6 phrases
- Chaque phrase commence par "Le {pièce} ne..."
- Chaque phrase **nomme la pièce qui fait réellement cette fonction**
- Format : "Le X ne fait pas Y — c'est le Z qui s'en charge."

**But :** Empêcher le client d'attribuer à cette pièce des fonctions d'autres composants → réduit les erreurs de diagnostic et les retours produit.

**Exemple (disque de frein) :**

> Le disque de frein ne ralentit pas le véhicule à lui seul — sans plaquettes et étrier, il ne produit aucune force de freinage. Le disque ne génère pas la pression hydraulique — c'est le maître-cylindre, alimenté par le servo-frein.

---

## 6. Composition

- 3-7 éléments
- Format par élément : `"{Composant} en {matériau} — {spec technique chiffrée}"`
- Chaque élément doit contenir au moins 1 de : matériau, dimension, tolérance, norme

### Anti-patterns

- ❌ "Composants principaux"
- ❌ "Éléments d'assemblage"
- ❌ "Pièces d'usure"
- ❌ Tout élément sans matériau ni dimension

---

## 7. Confusions courantes

- 3-5 paires
- Format obligatoire : `"{Pièce A} ≠ {Pièce B} : {explication en 1-2 phrases}"`
- La confusion doit être **réelle** (erreur que font les clients en commandant)
- Expliquer pourquoi les deux ne sont **PAS interchangeables**
- Inclure au moins 1 chiffre par paire si possible

**Exemple :**

> Disque ventilé ≠ Disque plein : le ventilé possède des ailettes entre deux plateaux pour dissiper la chaleur, le plein est monobloc — non interchangeables car épaisseurs et étriers différents

---

## 8. Règles métier (anti-erreur)

- 3-5 règles
- Commencer par un verbe d'action : "Toujours...", "Ne jamais...", "Vérifier...", "Remplacer..."
- Chaque règle inclut le **pourquoi** (pas juste l'injonction)
- Les règles couvrent : achat (erreur de ref), montage (erreur de pose), entretien (erreur de timing)

**Exemple :**

> Toujours remplacer les disques par paire sur le même essieu — un disque neuf face à un disque usé crée un freinage asymétrique qui tire le véhicule d'un côté.

---

## 9. Scope et limites

- 1-3 phrases
- Nommer explicitement ce qui EST couvert (véhicules de tourisme, VUL < 3.5T)
- Nommer explicitement ce qui N'EST PAS couvert (poids lourds, compétition, moto, etc.)
- Si le scope exclu a un budget très différent, le mentionner

**Exemple :**

> Cette référence couvre les disques de frein pour véhicules de tourisme et utilitaires légers (< 3,5 T). Les disques carbone-céramique (compétition, supercars) relèvent de spécifications et budgets très différents (2 000 à 8 000 € l'ensemble).

---

## 10. Maillage interne

| Lien | Destination | Obligatoire | Comment trouver la valeur |
|------|-------------|:-----------:|---------------------------|
| `pg_id` | R1 gamme | OUI | `SELECT pg_id FROM pieces_gamme WHERE pg_alias = '{slug}'` |
| `symptomes_associes` | R5 diagnostic | OUI | `SELECT slug FROM __seo_observable WHERE slug LIKE '%{slug}%'` |
| `related_references` | Autres R4 | RECO | Pièces du même système (freinage, embrayage, distribution...) |
| `blog_slugs` | R3 conseils | RECO | `SELECT ba_alias FROM __blog_advice WHERE ba_pg_id = '{pg_id}'` |

---

## 11. Titre — Convention de nommage

**Format standard :**

```
{Nom pièce} : définition, rôle et remplacement | Guide Auto
```

**Exemples conformes :**

- Disque de frein : définition, rôle et remplacement | Guide Auto
- Kit embrayage : définition, rôle et remplacement | Guide Auto
- Filtre à huile : définition, rôle et remplacement | Guide Auto

**Exemples NON conformes :**

- ❌ FAP : Fiche technique (trop court, pas de mots-clés)
- ❌ Tout savoir sur le disque de frein (trop marketing)
- ❌ Disque de frein (pas de descripteurs)

---

## 12. Gold Standard — disque-de-frein (id=106)

| Champ | Longueur | Données chiffrées |
|-------|----------|-------------------|
| definition | 1500 chars | 50-180 bars, 290 kJ, GG25, 9-12mm, 20-32mm, 70%, 80°C-400°C, 0.05mm, 80-120 km/h, 80-400€ |
| role_mecanique | 450 chars | 10-40 kN, 400°C, 600°C, 0.05mm, 2-15 kg |
| role_negatif | 600 chars | 5 phrases "ne fait pas" avec attribution |
| composition | 5 éléments | GG25, Ra 1.6, 100-150 Nm, 40-60% |
| confusions_courantes | 5 paires | Chiffres dans chaque paire |
| regles_metier | 5 règles | 4 points, 50%, 200 km, 80-30 km/h |
| scope_limites | 250 chars | < 3.5T, 2000-8000€, > 400mm |

**Score qualité : 6/6** — Objectif pour toutes les références.

---

## 13. Quality Gate — Flags de rejet

| Flag | Condition | Sévérité |
|------|-----------|----------|
| `GENERIC_DEFINITION` | Contient "joue un rôle essentiel" OU < 300 chars | BLOQUANT |
| `NO_NUMBERS_IN_DEFINITION` | Aucun chiffre dans `definition` | BLOQUANT |
| `GENERIC_COMPOSITION` | Contient "Composants principaux" | BLOQUANT |
| `MISSING_ROLE_NEGATIF` | `role_negatif` vide | WARNING |
| `MISSING_REGLES_METIER` | `regles_metier` vide ou length < 3 | WARNING |
| `MISSING_SCOPE` | `scope_limites` vide | WARNING |
| `MISSING_ACCENTS` | Mots courants sans accents (véhicule, sécurité, système) | WARNING |
| `TITLE_FORMAT` | Ne suit pas la convention §11 | WARNING |

**Règle : aucun flag BLOQUANT → publication autorisée.**
