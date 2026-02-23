# R4 Reference — Role de page (Fiche piece encyclopedique)

> **Le R4 repond a UNE question : "c'est quoi un {piece} ?"**
> Entree encyclopedique technique — definition canonique, role mecanique, composition, confusions courantes.
> Il ne parle PAS de : prix, achat, marques vehicules, diagnostic, guide d'achat.
> Ces sujets relevent d'autres roles de page (R2 Product, R3 Blog/guide-achat, R5 Diagnostic).

---

## 1. Identite de page

| Champ | Valeur |
|-------|--------|
| Role SEO | R4 — REFERENCE |
| URL pattern | `/reference-auto/{slug}` |
| Table BDD | `__seo_reference` |
| Intent principal | Informationnel (consideration) |
| Persona | Automobiliste qui cherche "c'est quoi un {piece} ?" ou mecanicien amateur |
| Ton | Technique mais accessible — pas de jargon non explique |
| Schema.org | DefinedTerm + TechArticle + BreadcrumbList + FAQPage |
| Conversion goal | Engagement — liens vers R1 (catalogue), R3 (guide), R5 (diagnostic) |
| Gold standard | `disque-de-frein` (id=106, pg_id=82) |

---

## 2. Perimetre strict

### CE QUE R4 EST

- L'entree encyclopedique d'une piece auto (Larousse technique)
- La verite mecanique de reference
- Un contenu quasi-incopiable grace aux donnees numeriques precises
- Le hub de maillage vers R1 (achat), R3 (conseils), R5 (diagnostic)

### CE QUE R4 N'EST PAS

| Sujet | Role concerne | Lien autorise |
|-------|---------------|---------------|
| Page produit / prix / achat | R2 Product (`/pieces/{slug}-{pgId}.html`) | NON — jamais de lien commercial |
| Guide d'achat | R3 Blog (`/blog-pieces-auto/guide-achat/{alias}`) | OUI — "Lire le guide : comment choisir" |
| Diagnostic / symptomes | R5 Diagnostic (`/diagnostic-auto/{slug}`) | OUI — "Consulter les symptomes" |
| Marketing / promotion | — | INTERDIT |

---

## 3. Champs DB — `__seo_reference`

| Champ | Type | Obligatoire | Longueur cible | Regle |
|-------|------|:-----------:|----------------|-------|
| `title` | text | OUI | 40-80 chars | `{Nom piece} : definition, role et remplacement \| Guide Auto` |
| `meta_description` | text | OUI | 140-160 chars | Nom piece + role principal + 1 mot-cle symptome |
| `definition` | text | OUI | 800-2000 chars | 3 paragraphes — minimum 4 donnees chiffrees |
| `role_mecanique` | text | OUI | 300-600 chars | Transformation physique + seuil critique |
| `role_negatif` | text | OUI | 300-600 chars | 4-6 phrases "ne fait pas" |
| `composition` | text[] | OUI | 3-7 elements | Materiau + spec chiffree par element |
| `confusions_courantes` | text[] | OUI | 3-5 elements | Format "A ≠ B : explication" |
| `regles_metier` | text[] | OUI | 3-5 elements | Verbe d'action + pourquoi |
| `symptomes_associes` | text[] | OUI | 3-6 slugs | Slugs `__seo_observable` existants |
| `scope_limites` | text | OUI | 100-300 chars | Couvre / ne couvre pas |
| `blog_slugs` | text[] | RECO | 1-3 slugs | Articles R3 lies |
| `related_references` | int[] | RECO | 1-4 IDs | Autres R4 du meme systeme mecanique |
| `pg_id` | int | OUI | — | FK vers `pieces_gamme.pg_id` |
| `canonical_url` | text | AUTO | — | `/reference-auto/{slug}` |

---

## 4. Template de structure — 7 sections obligatoires

### 4.1 Definition (3 paragraphes)

#### Paragraphe 1 — Quoi + Ou

- Nom de la piece + sa fonction principale en 1 phrase
- Ou elle se situe dans le vehicule (systeme, emplacement physique)
- Comment elle fonctionne (principe physique simplifie)
- **Minimum 2 donnees chiffrees** (pression, temperature, couple, dimensions)

#### Paragraphe 2 — Types / Variantes

- Les variantes qui existent (ex : ventile/plein, mecanique/hydraulique)
- Differences cles entre les variantes
- **Minimum 1 donnee chiffree par variante**

#### Paragraphe 3 — Usure et remplacement

- Signes d'usure principaux (ce que le conducteur percoit)
- Critere de remplacement absolu (la mesure qui tranche)
- Fourchette de cout remplacement en EUR (par essieu ou par unite)

### 4.2 Role mecanique

1 paragraphe dense (300-600 chars). Template :

> Le {piece} convertit {entree} en {sortie}. En fonctionnement normal, il supporte {contrainte chiffree}. Au-dela de {seuil}, {consequence grave}. Sa masse/dimension de {valeur} determine directement {caracteristique de performance}.

### 4.3 Role negatif ("Ce que ca NE fait PAS")

- 4-6 phrases
- Chaque phrase commence par "Le {piece} ne..."
- Chaque phrase **nomme la piece qui fait reellement cette fonction**
- Format : "Le X ne fait pas Y — c'est le Z qui s'en charge."

### 4.4 Composition

- 3-7 elements
- Format par element : `"{Composant} en {materiau} — {spec technique chiffree}"`
- Chaque element doit contenir au moins 1 de : materiau, dimension, tolerance, norme

### 4.5 Confusions courantes

- 3-5 paires
- Format obligatoire : `"{Piece A} ≠ {Piece B} : {explication en 1-2 phrases}"`
- La confusion doit etre reelle (erreur que font les clients)
- Inclure au moins 1 chiffre par paire si possible

### 4.6 Regles metier (anti-erreur)

- 3-5 regles
- Commencer par un verbe d'action : "Toujours...", "Ne jamais...", "Verifier...", "Remplacer..."
- Chaque regle inclut le **pourquoi**
- Les regles couvrent : achat (erreur de ref), montage (erreur de pose), entretien (erreur de timing)

### 4.7 Scope et limites

- 1-3 phrases
- Nommer ce qui EST couvert (vehicules de tourisme, VUL < 3,5T)
- Nommer ce qui N'EST PAS couvert (poids lourds, competition, moto)

---

## 5. Anti-patterns INTERDITS

### Phrases generiques (flag GENERIC_DEFINITION)

- "Cette piece automobile joue un role essentiel dans le bon fonctionnement du vehicule"
- "joue un role essentiel"
- "assure le bon fonctionnement"
- "il est important de noter que"
- "il convient de souligner"

### Contenus vides

- Phrases sans donnees chiffrees (minimum 4 chiffres dans la definition)
- Copie Wikipedia ou paraphrase evidente
- Langage marketing ("prix imbattable", "qualite premium", "large choix")
- Texte sans accents francais ("vehicule", "securite", "systeme")

### Composition generique (flag GENERIC_COMPOSITION)

- "Composants principaux"
- "Elements d'assemblage"
- "Pieces d'usure"
- Tout element sans materiau ni dimension

---

## 6. Quality Gate — 8 flags (alignes avec backend `validateReferenceQuality()`)

| Flag | Condition | Severite |
|------|-----------|----------|
| `GENERIC_DEFINITION` | Contient "joue un role essentiel" OU definition < 300 chars | **BLOQUANT** |
| `NO_NUMBERS_IN_DEFINITION` | Aucun chiffre (`\d`) dans definition | **BLOQUANT** |
| `GENERIC_COMPOSITION` | Contient "Composants principaux" | **BLOQUANT** |
| `MISSING_ROLE_NEGATIF` | role_negatif null ou vide | WARNING |
| `MISSING_REGLES_METIER` | regles_metier null ou length < 3 | WARNING |
| `MISSING_SCOPE` | scope_limites null ou vide | WARNING |
| `MISSING_ACCENTS` | definition contient "vehicule" ou "securite" ou "systeme" sans accent | WARNING |
| `TITLE_FORMAT` | Ne contient pas " : " ou ne finit pas par "\| Guide Auto" | WARNING |

**Score R4 = 6 - (nombre de flags BLOQUANTS).** Seuil de publication : score >= 4.

**Regle : aucun flag BLOQUANT → publication autorisee.**

---

## 7. Mapping v4 / legacy → champs R4

| Champ v4 | Champ legacy (fallback) | Champ R4 | Usage |
|----------|------------------------|----------|-------|
| `domain.role` | `page_contract.intro.role` | `definition` (paragraphe 1) | Seed pour la definition — reformuler GEO-first |
| `domain.cross_gammes[].slug` | `page_contract.intro.syncParts` | `related_references` + liens internes | Pieces associees du meme systeme |
| `maintenance.interval` | `page_contract.timing.*` | `definition` (paragraphe 3) | Intervalles de remplacement |
| `maintenance.interval.note` | `page_contract.timing.note` | `regles_metier` | Condition critique de remplacement |
| `rendering.risk_explanation` | `page_contract.risk.explanation` | `role_mecanique` | Base pour la transformation physique |
| `rendering.risk_consequences` | `page_contract.risk.consequences` | `role_negatif` | Consequences en cas de defaillance |
| `selection.cost_range` | `page_contract.risk.costRange` | `definition` (paragraphe 3) | Fourchette cout remplacement |
| `selection.anti_mistakes` | `page_contract.antiMistakes` | `regles_metier` | Enrichir les regles anti-erreur |
| `diagnostic.symptoms[].label` | `page_contract.symptoms` | `symptomes_associes` | Slugs diagnostics associes |
| `domain.must_be_true` | `mechanical_rules.must_be_true` | Validation post-redaction | Termes obligatoires dans le contenu |
| `domain.confusion_with` | `mechanical_rules.confusion_with` | `confusions_courantes` | Generer les paires "A ≠ B" |
| `domain.related_parts` | *(pas d'equivalent)* | `composition` | Composants et sous-ensembles |

### Champs NON utilises en R4

| Champ v4 | Champ legacy | Raison | Role concerne |
|----------|-------------|--------|---------------|
| `rendering.faq` | `page_contract.faq` | Les FAQ sont du ressort R3/R5 | R3 Blog, R5 Diagnostic |
| `selection.criteria` | `page_contract.howToChoose` | Guide de selection = achat | R3 Blog/guide-achat |
| `rendering.arguments` | `page_contract.arguments` | Arguments de vente = commercial | R2 Product, R3 Blog |

---

## 8. Concepts partages injectables (contexte technique)

> Source : `.spec/content-roles/R4-shared-concepts.md`

### Types de references

| Type | Definition courte |
|------|-------------------|
| **OEM** | Code officiel du constructeur vehicule. Source de verite |
| **OES** | Reference du fabricant 1ere monte (ATE, Valeo, Bosch). Piece identique, catalogue different |
| **IAM** | Reference catalogue fabricant independant (TRW, Brembo). Lie a l'OEM via cross-reference |
| **Distributeur** | Code interne vendeur (SKU). Inutile pour la compatibilite |
| **TecDoc** | Identifiant base europeenne TecDoc. Liens vehicule-piece pre-valides |

### Hierarchie de confiance

```
VIN/immat > OEM > OES > IAM (cross verifie) > IAM (catalogue seul) > Distributeur > Recherche client
```

### 6 pieges a documenter dans chaque fiche R4

1. **Ref ressemblante ±1 digit** — refs qui ne different que d'1 caractere
2. **Position gauche/droite ou avant/arriere** — version miroir non interchangeable
3. **Kit vs composant** — piece vendue aussi en kit
4. **Universel vs specifique** — piece vehicule-specifique ou quasi-universelle
5. **Supersession connue** — ancienne ref couramment recherchee
6. **Code PR discriminant** — VW/Audi : code PR change la piece

### Vocabulaire normalise (coherence inter-fiches)

| Concept | Terme a utiliser | NE PAS utiliser |
|---------|------------------|-----------------|
| Reference constructeur | Reference OEM | Ref d'origine, code constructeur |
| Reference equipementier | Reference OES | Ref premiere monte |
| Piece aftermarket | Piece IAM | Piece compatible, piece adaptable |
| Table d'equivalence | Cross-reference | Correspondance, matching |
| Remplacement de ref | Supersession | Succession, evolution |
| Selecteur vehicule | Selecteur vehicule | Configurateur, chercheur de piece |
| Compatible | Compatible (vehicule) | Adaptable, montable, universel |
| Equivalent | Equivalent (= meme piece) | Compatible (≠ meme vehicule) |

### Dimensions techniques par famille

| Famille | Dimensions cles | Unites |
|---------|----------------|--------|
| Freinage | Diametre, epaisseur, entraxe, nb trous | mm |
| Embrayage | Diametre, nb cannelures, epaisseur | mm |
| Distribution | Nb dents, largeur, pas | —, mm |
| Filtration | Longueur, largeur, hauteur | mm |
| Suspension | Longueur, diametre tige, force | mm, N |
| Eclairage | Puissance, culot, tension | W, V |
| Refroidissement | Capacite, debit, pression ouverture | L, L/min, bars |

---

## 9. Gold Standard — disque-de-frein (id=106)

| Champ | Longueur | Donnees chiffrees |
|-------|----------|-------------------|
| definition | 1500 chars | 50-180 bars, 290 kJ, GG25, 9-12mm, 20-32mm, 70%, 80-400C, 0.05mm, 80-120 km/h, 80-400 EUR |
| role_mecanique | 450 chars | 10-40 kN, 400C, 600C, 0.05mm, 2-15 kg |
| role_negatif | 600 chars | 5 phrases "ne fait pas" avec attribution |
| composition | 5 elements | GG25, Ra 1.6, 100-150 Nm, 40-60% |
| confusions_courantes | 5 paires | Chiffres dans chaque paire |
| regles_metier | 5 regles | 4 points, 50%, 200 km, 80-30 km/h |
| scope_limites | 250 chars | < 3,5T, 2000-8000 EUR, > 400mm |

**Score qualite : 6/6** — Objectif pour toutes les references.

---

## 10. Pre-requis gamme pour generer une fiche R4

| Champ | Requis | Si absent |
|-------|--------|-----------|
| `pg_id` valide dans `pieces_gamme` | OUI | **STOP** — pas de fiche sans gamme |
| `pg_alias` (slug) | OUI | STOP — necessaire pour l'URL |
| Knowledge doc RAG | RECOMMANDE | Continuer avec donnees BDD + expertise. Signaler l'absence |
| `domain.must_be_true` (v4) ou `mechanical_rules.must_be_true` (legacy) | RECOMMANDE | WARNING — validation anti-hallucination limitee |
| `domain.confusion_with` (v4) ou `mechanical_rules.confusion_with` (legacy) | RECOMMANDE | Flag — confusions_courantes generiques |
| Diagnostic R5 existants (`__seo_observable`) | RECOMMANDE | `symptomes_associes` vide |
| Articles R3 existants (`__blog_advice`) | OPTIONNEL | `blog_slugs` vide |

### Requete de decouverte

```sql
-- Trouver pg_id et verifier les liens
SELECT
  pg.pg_id, pg.pg_alias, pg.pg_name_url,
  (SELECT count(*) FROM __seo_observable WHERE pg_id = pg.pg_id) AS nb_diagnostics,
  (SELECT count(*) FROM __blog_advice WHERE ba_pg_id = pg.pg_id::text) AS nb_articles
FROM pieces_gamme pg
WHERE pg.pg_alias = '{slug}';
```

---

## 11. Titre — Convention de nommage

**Format standard :**

```
{Nom piece} : definition, role et remplacement | Guide Auto
```

**Exemples conformes :**

- Disque de frein : definition, role et remplacement | Guide Auto
- Kit embrayage : definition, role et remplacement | Guide Auto
- Filtre a huile : definition, role et remplacement | Guide Auto

**Exemples NON conformes :**

- FAP : Fiche technique (trop court, pas de mots-cles)
- Tout savoir sur le disque de frein (trop marketing)
- Disque de frein (pas de descripteurs)

---

## 12. Liens internes (maillage R4)

| Lien | Destination | Autorise | Ancre type |
|------|-------------|----------|------------|
| `pg_id` → R1 gamme | `/pieces/{slug}-{pgId}.html` | OUI | "Voir les {pieces} compatibles" |
| `symptomes_associes` → R5 | `/diagnostic-auto/{slug}` | OUI | "Consulter les symptomes du {piece}" |
| `related_references` → R4 | `/reference-auto/{slug}` | OUI | "Voir aussi : {piece associee}" |
| `blog_slugs` → R3 | `/blog-pieces-auto/conseils/{alias}` | OUI | "Lire le guide : {titre}" |
| → R2 Product | — | **INTERDIT** | Pas de lien commercial |

**Minimum** : 4 liens internes par fiche R4.
