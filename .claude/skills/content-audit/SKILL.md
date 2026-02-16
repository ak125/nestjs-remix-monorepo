---
name: content-audit
description: "Audit contenu R2D2 universel : Intent-First, Evidence-First, Decision-First. Adapté aux 6 rôles de page (R1-R6). Score qualité /6 + rapport structuré."
argument-hint: "[/url-path, file-path, ou page-role (R1|R2|R3|R4|R5|R6)]"
allowed-tools: Read, Grep, Glob
version: "1.2"
---

# Content Audit R2D2 — v1.1

Audit de contenu base sur le framework **R2D2** (Reponse → Decision → Details → Deploiement).

**Principes fondamentaux :**
- **Intent-First** : chaque H2 repond a une intention (comprendre, choisir, vérifier, agir, eviter)
- **Evidence-First** : chaque section apporte preuve / methode / test (pas du bla-bla)
- **Decision-First** : la decision arrive tot (resume + checklist + erreurs dans les 50% premiers)
- **Progressive Disclosure** : simple d'abord, details ensuite (H3/H4 + accordeons)
- **Composable Blocks** : memes blocs reutilisables partout (maintenance facile)

---

## Quand proposer ce skill

| Contexte detecte | Proposition |
|------------------|------------|
| Demande audit qualite contenu ou page | `/content-audit [url ou fichier]` |
| Verifier une page SEO apres production | `/content-audit [url]` |
| Audit par role (R1-R6) | `/content-audit R3` |
| Apres `/seo-content-architect` (chaine contenu) | `/content-audit [gamme]` |

---

## Modes d'execution

| Mode | Invocation | Comportement |
|------|-----------|-------------|
| Audit cible | `/content-audit [url ou fichier]` | Audit d'une page ou composant |
| Audit par role | `/content-audit R3` | Toutes les pages detectees pour ce role |
| Audit complet | `/content-audit` | Toutes les routes publiques |

---

## Workflow (4 phases)

### Phase 1 — IDENTIFY (auto-decouverte)

**Jamais d'URL en dur.** Le skill decouvre les pages automatiquement :

**Etape 1 — Trouver les fichiers routes :**
```
Glob: frontend/app/routes/*.tsx
```
Exclure : `admin.*`, `api.*`, `_public+/*`, fichiers `_index.tsx` (sauf homepage)

**Etape 2 — Detecter le role depuis le code source :**
```
Grep: "PageRole\." dans chaque fichier route
```
Le role est declare dans `handle.pageRole` via `createPageRoleMeta(PageRole.XX_YYYY, ...)`.

**Etape 3 — Si `PageRole` absent, inferer depuis le pattern du nom de fichier :**

| Pattern nom de fichier | Role infere |
|----------------------|-------------|
| `pieces.$slug` | R1_ROUTER |
| `pieces.$gamme.$marque.$modele.$type*` | R2_PRODUCT |
| `products.$id` | R2_PRODUCT |
| `blog-pieces-auto.*` | R3_BLOG |
| `reference-auto.*` | R4_REFERENCE |
| `diagnostic-auto.*` | R5_DIAGNOSTIC |
| `constructeurs.*` | R1_ROUTER |
| `contact`, `mentions-*`, `politique-*`, `conditions-*`, `legal.*` | R6_SUPPORT |

**Etape 4 — Afficher le resultat :**
- Fichier route (chemin relatif)
- Role detecte (R1-R6) + source (handle ou infere)
- Intent, contentType, funnelStage (depuis `page-role.types.ts`)

**Reference :** `frontend/app/utils/page-role.types.ts` contient l'enum PageRole et les types associes.

### Phase 2 — SCAN

Extraire la structure de contenu du fichier identifie :

1. **Headings** : lister tous les `<h1>`, `<h2>`, `<h3>`, `<h4>` dans le fichier ET dans les composants qu'il importe
2. **Sections** : identifier TOC, FAQ (Accordion), CTA (Button + Link), tables, Alert/Card blocks
3. **Schema.org** : grep `script:ld+json` dans la fonction `meta` ou `export const meta`
4. **Liens internes** : compter les `<Link to=` et `href="/`
5. **Longueur** : nombre total de lignes, position (ligne + pourcentage) des sections cles

### Phase 3 — AUDIT

Appliquer les checklists adaptees au role detecte en Phase 1 (voir "Checklists par role").

Pour chaque check :
- **Present ?** (OUI / NON / PARTIEL)
- **Position** (numero de ligne, pourcentage de la page)
- **Qualite** (BON / ACCEPTABLE / INSUFFISANT)

### Phase 4 — REPORT

Produire le rapport au format defini (voir "Format de sortie").

---

## Squelette R2D2 — 10 blocs

Chaque page DEVRAIT contenir ces blocs (adaptes selon le role) :

| # | Bloc | Intention | Obligatoire pour | Contenu attendu |
|---|------|-----------|-----------------|-----------------|
| B1 | **Reponse immediate** | Repondre vite | R3, R4, R5 | TL;DR (2-4 lignes) + Checklist rapide (5-9 pts) + Erreurs a eviter (3-6 pts) + "Si tu n'as qu'une minute" (3 bullets) |
| B2 | **Ce qui change selon les cas** | Contextualiser | R2, R3, R5 | Variantes / scenarios + Signaux pour trancher + Exceptions |
| B3 | **Methode universelle** | Guider | R3, R5 | Inputs necessaires + Etapes numerotees + Validation finale + Cas limites |
| B4 | **Grille de decision** | Decider | R2, R3, R4 | Table comparative (Critere / Importance / Comment vérifier / Pieges / Si OK-KO) |
| B5 | **Comparer les options** | Trancher | R2, R3 | Options detaillees (pour qui, avantages, limites) + Regle "si... alors..." |
| B6 | **Mise en pratique** | Agir | R3, R5 | Procedure numerotee + Controle apres action + Securite/risques si pertinent |
| B7 | **Depannage** | Debloquer | R3, R5 | Symptome → causes probables → test → solution (3+ cas) + "Quand demander un pro" |
| B8 | **Preuves & confiance** | Rassurer | R3, R4, R5 | Sources / standards + Temoignages + Hypotheses et limites (transparence) |
| B9 | **FAQ** | Completer | Tous | 8-12 questions en Accordion + Questions pieges (SAV) + Schema.org FAQPage |
| B10 | **Action suivante** | Convertir | Tous | CTA principal + Alternatives + Checklist finale avant action |

**Regle de position :**
- B1 (Reponse immediate) DOIT etre dans les 20% premiers de la page
- B4 (Grille) + B7 (Depannage) DOIVENT etre avant les 70%
- B9 (FAQ) + B10 (Action) en fin de page

---

## Checklists par role

> Les checklists ci-dessous s'appliquent selon le role **detecte automatiquement** en Phase 1.
> Ne pas chercher des pages par URL — laisser le workflow IDENTIFY les trouver.

### R1 — Router (catalogue, navigation)

Detecte via : `PageRole.R1_ROUTER` ou pattern `pieces.$slug`, `constructeurs.*`

| Check | Critere | Severite |
|-------|---------|----------|
| R1-1 | H1 unique avec entite + contexte | CRITIQUE |
| R1-2 | Filtres visibles sans scroll (above the fold) | HAUTE |
| R1-3 | Breadcrumb complet avec Schema.org BreadcrumbList | HAUTE |
| R1-4 | Maillage interne vers sous-categories et pages R2 | HAUTE |
| R1-5 | Meta description avec entite + benefice (120-160 chars) | MOYENNE |
| R1-6 | FAQ ou contenu SEO en bas de page | MOYENNE |
| R1-7 | Pagination avec URL canonique | MOYENNE |

### R2 — Product (fiche produit, ecommerce)

Detecte via : `PageRole.R2_PRODUCT` ou pattern `pieces.$gamme.$marque.$modele.$type*`

| Check | Critere | Severite |
|-------|---------|----------|
| R2-1 | H1 unique : produit + vehicule + benefice | CRITIQUE |
| R2-2 | **B2** Alertes variantes si montages multiples | CRITIQUE |
| R2-3 | Prix + stock + CTA visibles en 10 sec (above fold) | CRITIQUE |
| R2-4 | **B4** Tableau compatibilite vehicules | HAUTE |
| R2-5 | Specifications techniques structurees (table) | HAUTE |
| R2-6 | Schema.org Product + AggregateRating si avis | HAUTE |
| R2-7 | **B9** FAQ questions produit (montage, compatibilite) | MOYENNE |
| R2-8 | **B10** CTA ajout panier + guides lies | MOYENNE |
| R2-9 | Maillage interne vers R3 (guide) et R4 (reference) | MOYENNE |

### R3 — Blog/Guide (article, guide d'achat)

Detecte via : `PageRole.R3_BLOG` ou pattern `blog-pieces-auto.*`

**Application COMPLETE du squelette R2D2 (les 10 blocs) :**

| Check | Critere | Severite |
|-------|---------|----------|
| R3-1 | H1 unique : objet + intention + contexte | CRITIQUE |
| R3-2 | **B1** TL;DR visible en 10 sec (avant premier H2 de contenu) | CRITIQUE |
| R3-3 | **B1** Checklist rapide (5-9 points) dans les 30% premiers | CRITIQUE |
| R3-4 | **B1** Erreurs a eviter (3-6 points) dans les 50% premiers | HAUTE |
| R3-5 | **B2** Variantes/scenarios listes clairement | HAUTE |
| R3-6 | **B3** Inputs → etapes numerotees → validation finale | HAUTE |
| R3-7 | **B4** Table comparative / grille de decision | HAUTE |
| R3-8 | **B5** Regles "si... alors..." dans chaque grand bloc | MOYENNE |
| R3-9 | **B6** Demo, procedure ou exercice pratique | HAUTE |
| R3-10 | **B7** Depannage : symptome → cause → solution (3+ cas) | HAUTE |
| R3-11 | **B8** Sources, temoignages, transparence sur limites | MOYENNE |
| R3-12 | **B9** 8-12 questions FAQ en Accordion + Schema FAQPage | HAUTE |
| R3-13 | **B10** CTA clair + alternatives + checklist finale | HAUTE |
| R3-14 | TOC / sommaire avec ancres | MOYENNE |
| R3-15 | Schema.org Article/TechArticle + BreadcrumbList | HAUTE |
| R3-16 | HowTo Schema si etapes presentes | MOYENNE |
| R3-17 | Maillage interne : 5+ liens contextuels vers R1/R2/R4 | HAUTE |
| R3-18 | Progressive Disclosure : H3/H4 + accordeons pour details | MOYENNE |

### R4 — Reference (definition technique)

Detecte via : `PageRole.R4_REFERENCE` ou pattern `reference-auto.*`

| Check | Critere | Severite |
|-------|---------|----------|
| R4-1 | H1 unique : terme technique + contexte | CRITIQUE |
| R4-2 | **B1** Definition en 2-3 lignes visible immediatement | CRITIQUE |
| R4-3 | **B2** Types/variantes du composant | HAUTE |
| R4-4 | **B4** Tableau comparatif des types | HAUTE |
| R4-5 | **B8** Normes, standards constructeur | HAUTE |
| R4-6 | **B9** FAQ questions "pourquoi/comment/quand" | HAUTE |
| R4-7 | Schema.org DefinedTerm ou TechArticle | MOYENNE |
| R4-8 | Maillage vers R2 (produits) et R5 (diagnostics) | HAUTE |
| R4-9 | Illustrations / schemas techniques | MOYENNE |

### R5 — Diagnostic (symptome → solution)

Detecte via : `PageRole.R5_DIAGNOSTIC` ou pattern `diagnostic-auto.*`

| Check | Critere | Severite |
|-------|---------|----------|
| R5-1 | H1 unique : symptome + vehicule/contexte | CRITIQUE |
| R5-2 | **B1** Cause la plus probable en 3 lignes | CRITIQUE |
| R5-3 | **B7** Matrice symptome → causes → test → solution | CRITIQUE |
| R5-4 | **B2** Variantes selon vehicule/contexte | HAUTE |
| R5-5 | **B3** Etapes de diagnostic numerotees | HAUTE |
| R5-6 | "Quand consulter un professionnel" (sécurité) | HAUTE |
| R5-7 | **B9** FAQ questions liees au symptome | HAUTE |
| R5-8 | **B10** Lien vers pieces de remplacement (R2) | HAUTE |
| R5-9 | Maillage vers R2 (pieces) et R4 (reference) | MOYENNE |

### R6 — Support/Legal

Detecte via : `PageRole.R6_SUPPORT` ou pattern `contact`, `mentions-*`, `politique-*`, `conditions-*`, `legal.*`

| Check | Critere | Severite |
|-------|---------|----------|
| R6-1 | H1 unique et clair | CRITIQUE |
| R6-2 | Information actionnable (email, tel, formulaire) | HAUTE |
| R6-3 | FAQ si pertinent | MOYENNE |
| R6-4 | Schema.org ContactPoint si page contact | MOYENNE |
| R6-5 | Breadcrumb | MOYENNE |

---

## Regles universelles (tous roles)

| # | Regle | Comment detecter | Severite |
|---|-------|-----------------|----------|
| U1 | **H1 unique** — jamais 2 h1 simultanes sur la meme page | Grep `<h1` dans fichier + composants importes. Exclure ErrorBoundary/CatchBoundary (faux positifs) | CRITIQUE |
| U2 | **Intent = H2** — chaque H2 repond a une intention resumable en 6 mots | Lister les H2 et vérifier qu'on peut les resumer en une intention | HAUTE |
| U3 | **Evidence > blabla** — chaque section a preuve/methode/test | Verifier la presence de tables, listes a puces, exemples concrets, chiffres | HAUTE |
| U4 | **Decision early** — resume + checklist + erreurs dans les 50% premiers | Compter les lignes : position de la checklist / total des lignes | HAUTE |
| U5 | **Progressive Disclosure** — H2 → H3 → H4, pas de H4 sans H3 parent | Verifier la hierarchie de headings | MOYENNE |
| U6 | **"Comment vérifier"** — au moins 1 test concret par section majeure | Chercher des phrases de vérification/validation | MOYENNE |
| U7 | **"Si... alors..."** — regles de decision conditionnelles | Chercher des patterns "si/quand/dans le cas" | MOYENNE |
| U8 | **Tables > paragraphes** — si 3+ elements comparables, utiliser une table | Detecter les listes longues sans mise en forme table | MOYENNE |
| U9 | **Anti-doublon** — une definition n'existe qu'a un endroit, rappel = lien + 1 phrase | Chercher du contenu repete entre sections | BASSE |
| U10 | **Maillage Topic Cluster** — 3-7 liens internes contextuels | Compter les `<Link to=` et `href="/` internes | HAUTE |

---

## Verification SEO

| Check | Critere | Comment vérifier |
|-------|---------|-----------------|
| SEO-1 | Schema.org adapte au role | Grep `script:ld+json` dans meta. R2=Product, R3=Article+FAQ, R4=TechArticle, R5=Article |
| SEO-2 | Entites couvertes (noms, standards, parametres) | Verifier dans le contenu que les entites cles sont mentionnees |
| SEO-3 | Questions couvertes (pourquoi/comment/quand/combien/risque) | FAQ + titres de sections |
| SEO-4 | Relations (cause → effet, option → usage) | Presence dans le contenu |
| SEO-5 | Meta title < 60 chars, description 120-160 chars | Verifier dans la fonction `meta` |
| SEO-6 | Canonical URL definie | Grep `rel: "canonical"` dans meta |
| SEO-7 | Open Graph + Twitter Cards | Grep `og:title`, `twitter:card` dans meta |

---

## Contrat de section (gouvernance)

Chaque H2 doit pouvoir remplir ce contrat. Si non → section "molle" a restructurer.

| Dimension | Question a se poser |
|-----------|-------------------|
| **But** | Quelle intention ce H2 resout ? (6 mots max) |
| **Input** | De quoi le lecteur a besoin pour comprendre ? |
| **Output** | Qu'est-ce que le lecteur sait/peut faire apres ? |
| **Preuve** | Quel element concret prouve l'affirmation ? |
| **Pieges** | Quelles erreurs courantes ce H2 previent ? |
| **Next step** | Ou aller ensuite ? |

---

## Detections automatiques (astuces avancees)

Le skill signale automatiquement :

| Pattern detecte | Recommandation | Severite |
|----------------|---------------|----------|
| "Erreurs a eviter" apres 50% de la page | Remonter avant la moitie | HAUTE |
| Paragraphe avec 3+ elements comparables sans table | Transformer en table | MOYENNE |
| H2 non resumable en 6 mots d'intention | Split en 2 H2 ou reformuler | MOYENNE |
| Section sans "comment vérifier" | Ajouter un test concret | MOYENNE |
| Contenu repete entre 2 sections | Remplacer par lien interne + 1 phrase | BASSE |
| `<h1` dans un composant de navigation (nav/header) | Changer en `<span>` ou `<div>` | CRITIQUE |
| FAQ < 5 questions | Ajouter questions pertinentes | MOYENNE |
| Aucun lien interne dans le contenu | Ajouter 3-7 liens contextuels | HAUTE |
| Schema.org absent | Ajouter le schema adapte au role | HAUTE |
| Meta description > 160 chars ou < 120 chars | Ajuster la longueur | MOYENNE |

---

## Format de sortie

```markdown
## Audit R2D2 — [page ou role] — [date]

### Identite
- **Fichier :** [path relatif depuis frontend/app/routes/]
- **Role :** [R1-R6] — [intent] (source: handle | infere)
- **URL pattern :** [pattern Remix resolu]
- **Lignes :** [total]

### Score qualité rapide

| # | Critere | OK ? | Note |
|---|---------|------|------|
| 1 | Reponse + checklist visibles en 10 sec | | |
| 2 | On sait "ce qui change selon les cas" | | |
| 3 | Il y a une methode + validation | | |
| 4 | Il y a une grille de decision | | |
| 5 | Il y a erreurs frequentes + depannage | | |
| 6 | Il y a FAQ + next step | | |
| **TOTAL** | | **X/6** | |

### Blocs R2D2

| Bloc | Present | Position (ligne) | Qualite |
|------|---------|-----------------|---------|
| B1 Reponse immediate | OUI/NON/PARTIEL | L__ (_%%) | BON/ACCEPTABLE/INSUFFISANT |
| B2 Ce qui change | | | |
| B3 Methode | | | |
| B4 Grille decision | | | |
| B5 Comparer options | | | |
| B6 Mise en pratique | | | |
| B7 Depannage | | | |
| B8 Preuves | | | |
| B9 FAQ | | | |
| B10 Action suivante | | | |

### Issues par sévérité

#### CRITIQUES (X)
| Check | Fichier:Ligne | Probleme | Fix propose |
|-------|--------------|----------|-------------|

#### HAUTES (X)
| Check | Fichier:Ligne | Probleme | Fix propose |
|-------|--------------|----------|-------------|

#### MOYENNES (X)
| Check | Fichier:Ligne | Probleme | Fix propose |
|-------|--------------|----------|-------------|

### SEO

| Schema | Present | Correct |
|--------|---------|---------|
| FAQ | | |
| HowTo | | |
| Breadcrumb | | |
| Article/TechArticle | | |
| Product | | |

### Recommandations prioritaires
1. [action #1 — impact le plus fort]
2. [action #2]
3. [action #3]
```

---

## Severites

| Niveau | Definition | Action |
|--------|-----------|--------|
| **CRITIQUE** | Manque un element fondamental (H1, TL;DR, CTA) — impact SEO/conversion direct | Corriger immediatement |
| **HAUTE** | Element present mais insuffisant ou mal positionne — impact UX/engagement | Corriger dans la session |
| **MOYENNE** | Amelioration qualitative — impact progressif | Planifier |
| **BASSE** | Nice-to-have, dette mineure | Backlog |

---

## Interaction avec Autres Skills

| Skill | Direction | Declencheur |
|-------|-----------|-------------|
| `seo-content-architect` | ← recoit | Apres production contenu, `/content-audit` valide la qualite |
| `rag-ops` | → propose | Si preuves insuffisantes (B8 faible), proposer `/rag-ops ingest` pour enrichir le corpus |
| `seo-content-architect` | → propose | Si contenu a reecrire (score < 4/6), proposer `/seo-content-architect` pour regenerer |
