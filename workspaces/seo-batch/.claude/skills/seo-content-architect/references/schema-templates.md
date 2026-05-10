# Schema.org Templates & Structure de Contenu

---

## Structure de Contenu Standard

```markdown
# H1 — Descriptif factuel (sans promesse)

## Introduction
- Contexte
- Portée réelle
- Limites explicites

## H2 — Fonction / Rôle
- Description neutre
- Usage réel (confirmé)

## H2 — Périmètre d'application
- Ce qui est confirmé
- Formulations conditionnelles si nécessaire

## H2 — Critères de choix
- Techniques (mesurables)
- Vérifiables
- Sans jugement de valeur

## H2 — Bonnes pratiques
- Sécurité
- Entretien
- Conformité réglementaire

## Conclusion
- Synthèse factuelle
- Orientation navigation (non commerciale)
```

---

## Product (pièces détachées — automotive enrichi)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{nom_produit}",
  "sku": "{reference}",
  "mpn": "{ref_constructeur}",
  "description": "{description_courte}",
  "brand": {
    "@type": "Brand",
    "name": "{marque}"
  },
  "manufacturer": {
    "@type": "Organization",
    "name": "{fabricant}"
  },
  "offers": {
    "@type": "Offer",
    "priceCurrency": "EUR",
    "price": "{prix}",
    "availability": "https://schema.org/InStock",
    "url": "{url_produit}"
  },
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "Diamètre", "value": "{diametre_mm}", "unitCode": "MMT" },
    { "@type": "PropertyValue", "name": "Épaisseur", "value": "{epaisseur_mm}", "unitCode": "MMT" },
    { "@type": "PropertyValue", "name": "Position", "value": "{avant|arriere}" }
  ],
  "isCompatibleWith": {
    "@type": "Car",
    "manufacturer": "{marque_vehicule}",
    "model": "{modele_vehicule}",
    "vehicleModelDate": "{annee}"
  }
}
```

---

## DefinedTerm (R4 Reference — piece auto)

```json
{
  "@context": "https://schema.org",
  "@type": "DefinedTerm",
  "name": "{nom_piece}",
  "description": "{definition_paragraphe_1}",
  "inDefinedTermSet": {
    "@type": "DefinedTermSet",
    "name": "Glossaire pieces automobiles",
    "url": "https://www.automecanik.com/reference-auto"
  }
}
```

---

## TechArticle (R4 Reference — fiche technique)

```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "{title}",
  "description": "{meta_description}",
  "articleBody": "{definition}",
  "proficiencyLevel": "Beginner",
  "about": {
    "@type": "DefinedTerm",
    "name": "{nom_piece}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "AutoMecanik"
  }
}
```

---

## Structure de contenu R4 (Reference)

```markdown
# H1 — {Nom piece} : definition, role et remplacement | Guide Auto

## Definition
- Paragraphe 1 : Quoi + Ou (2+ donnees chiffrees)
- Paragraphe 2 : Types / Variantes (1 donnee chiffree par variante)
- Paragraphe 3 : Usure et remplacement (cout en EUR)

## Role mecanique
- 1 paragraphe dense : transformation physique + seuil critique

## Ce que le {piece} ne fait PAS
- 4-6 phrases "Le {piece} ne..." avec attribution

## Composition
- 3-7 elements : composant + materiau + spec chiffree

## Confusions courantes
- 3-5 paires : "A ≠ B : explication"

## Regles metier
- 3-5 regles : verbe d'action + pourquoi

## Scope et limites
- 1-3 phrases : couvre / ne couvre pas
```

---

## Patterns Meta Description R4

```
# R4 Reference
{Nom piece} : definition, role mecanique, composition et criteres de remplacement. Guide technique complet pour vehicules de tourisme.
```

---

## BreadcrumbList (navigation)

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Pièces", "item": "/pieces"},
    {"@type": "ListItem", "position": 2, "name": "{famille}", "item": "/pieces/{famille}"}
  ]
}
```

---

## FAQPage (questions fréquentes)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{question}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{réponse_factuelle}"
      }
    }
  ]
}
```

---

## R3/guide-achat — Schemas + Meta Patterns

### Schema.org (triple combine)

Le detail guide-achat emet 3 schemas : TechArticle + BreadcrumbList + FAQPage (conditionnel).

```json
// TechArticle — toujours present
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "{H1 guide}",
  "description": "{meta description}",
  "url": "https://www.automecanik.com/blog-pieces-auto/guide-achat/{bg_alias}",
  "datePublished": "{bg_create}",
  "dateModified": "{bg_update}",
  "articleSection": "Guides d'Achat",
  "author": { "@type": "Organization", "name": "Automecanik" },
  "publisher": { "@type": "Organization", "name": "Automecanik", "logo": { "@type": "ImageObject", "url": "https://www.automecanik.com/logo-navbar.webp" } },
  "mainEntityOfPage": { "@type": "WebPage" }
}

// FAQPage — present si FAQ S8 avec >= 1 Q&A extraite
// Extraction : regex sur <details>/<summary>/<strong> dans le contenu de la section FAQ
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{ "@type": "Question", "name": "{Q}", "acceptedAnswer": { "@type": "Answer", "text": "{A}" } }]
}
```

**Index page** : emet un `@graph` avec `CollectionPage` + `ItemList` + `BreadcrumbList`.

### Patterns Meta Title R3/guide-achat

```
# Pattern 1 — H1 complet (prefere)
{Pieces au pluriel} : guide d'achat complet [{annee}]

# Pattern 2 — Question
Comment choisir {vos pieces} ? Guide complet [{annee}]

# Pattern 3 — Court
Guide achat {pieces} — Comparatif et conseils [{annee}]
```

Contrainte : max 60 caracteres. "choisir" interdit dans le H1 (reserve a S4).

### Patterns Meta Description R3/guide-achat

```
# Pattern 1 — Anti-erreur (prefere)
Evitez les erreurs d'achat de {pieces}. Compatibilite, references, qualite : checklist complete pour commander la bonne piece.

# Pattern 2 — Expert
Comment bien choisir {vos pieces} ? Nos experts vous guident : specs, marques, pack complet et pieges a eviter.

# Pattern 3 — Checklist
{Pieces} : 7 etapes pour commander sans se tromper. Compatibilite vehicule, references, qualite et checklist avant paiement.
```

Contrainte : 120-155 caracteres.

### Ancres internes recommandees (6 types)

| Type | Cible | Ancre type |
|------|-------|------------|
| Selecteur vehicule | `/pieces/{slug}-{pg_id}.html` | "Trouver {piece} compatible" |
| Glossaire technique | `/reference-auto` | "Consultez notre glossaire" |
| Guide associe (sibling) | `/blog-pieces-auto/guide-achat/{alias}` | "Notre guide {piece associee}" |
| Guide conseils (remplacement) | `/blog-pieces-auto/conseils/{alias}` | "Comment remplacer {piece}" |
| Fiche reference | `/reference-auto/{alias}` | "Fiche technique {piece}" |
| Categorie famille | `/pieces/{famille}` | "Toutes les pieces {famille}" |

---

## Patterns Meta Description

```
# Famille
{Famille} pour votre véhicule. Trouvez {sous-famille-1}, {sous-famille-2} parmi notre sélection.

# Sous-famille
{Sous-famille} {marque-véhicule} {modèle}. Références compatibles, caractéristiques techniques et disponibilité.

# Produit
{Nom produit} - Réf {ref}. Compatible {véhicule}. Caractéristiques et disponibilité sur Automecanik.
```

---

## Bloc Provenance Source (en fin de contenu)

Chaque contenu produit par le skill doit inclure un bloc récapitulatif des sources utilisées :

```markdown
---
### Sources
- rag://gammes.{slug} (truth_level: L2, updated_at: {date})
- rag://guides.{slug} (truth_level: L2)
- rag://diagnostic.{slug} (truth_level: L1)
- db://pieces_gamme.{pg_id}
- user (données fournies par l'utilisateur)
```

**Règles :**
- Minimum 3 sources par contenu
- Indiquer le truth_level et la date pour chaque source RAG
- Les sources BDD et utilisateur n'ont pas de truth_level
