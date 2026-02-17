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
