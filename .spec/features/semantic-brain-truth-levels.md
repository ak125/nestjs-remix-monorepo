---
title: "Semantic Brain - Niveaux de Vérité (L1-L4)"
status: active
version: 1.0.0
authors: [AI-COS Team, Tech Squad]
created: 2026-01-01
updated: 2026-01-01
relates-to:
  - ./ai-cos-operating-system.md
  - ./ai-cos-governance-rules.md
  - ./knowledge-graph-governance.md
tags: [semantic-brain, rag, truth-levels, knowledge, ai-cos, critical]
priority: critical
---

# Semantic Brain - Niveaux de Vérité (L1-L4)

## Overview

Le **Semantic Brain** est le système de mémoire professionnelle RAG++ d'AutoMecanik. Il introduit une hiérarchie de **niveaux de vérité** (L1-L4) pour différencier les types de connaissances et garantir des réponses fiables.

> **Avantage concurrentiel** : Les agents IA ne peuvent pas mélanger les niveaux de vérité sans avertissement explicite.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC BRAIN - TRUTH LEVELS                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ L1 - FAITS VÉRIFIÉS                                             │
│      Documentation officielle, politiques confirmées                 │
│      Confiance: 100% | Ton: AFFIRME AVEC CERTITUDE                  │
│                                                                      │
│  📋 L2 - RÈGLES MÉTIER                                              │
│      Procédures établies, logique business                          │
│      Confiance: 90% | Ton: POLITIQUE ÉTABLIE                        │
│                                                                      │
│  ❓ L3 - HYPOTHÈSES                                                 │
│      Inférences, déductions raisonnées                              │
│      Confiance: 60% | Ton: PROBABLEMENT                             │
│                                                                      │
│  💭 L4 - HEURISTIQUES                                               │
│      Approximations, règles empiriques                              │
│      Confiance: 40% | Ton: EN GÉNÉRAL                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Hiérarchie des Niveaux de Vérité

### L1 - Faits Vérifiés

| Attribut | Valeur |
|----------|--------|
| **Emoji** | ✅ |
| **Poids confiance** | 1.0 (100%) |
| **Ton de réponse** | Affirme avec certitude |
| **Sources typiques** | Documentation officielle, CGV, politiques confirmées |

**Exemples :**
- "La livraison standard est de 48-72h" (CGV)
- "Les retours sont acceptés sous 14 jours" (Politique officielle)
- "Le siège social est à Paris" (Information légale)

### L2 - Règles Métier

| Attribut | Valeur |
|----------|--------|
| **Emoji** | 📋 |
| **Poids confiance** | 0.9 (90%) |
| **Ton de réponse** | Selon notre politique |
| **Sources typiques** | Procédures internes, règles business, SOP |

**Exemples :**
- "Les frais de port sont offerts à partir de 100€" (Règle business)
- "Les professionnels bénéficient d'une remise de 15%" (Politique commerciale)
- "Les commandes passées avant 14h sont expédiées le jour même" (Procédure)

### L3 - Hypothèses

| Attribut | Valeur |
|----------|--------|
| **Emoji** | ❓ |
| **Poids confiance** | 0.6 (60%) |
| **Ton de réponse** | Probablement, selon nos informations |
| **Sources typiques** | Inférences, déductions, analyses |

**Exemples :**
- "Cette pièce est probablement compatible selon les spécifications" (Inférence)
- "Le délai devrait être similaire aux commandes précédentes" (Déduction)
- "Selon les retours clients, ce produit convient généralement" (Analyse)

### L4 - Heuristiques

| Attribut | Valeur |
|----------|--------|
| **Emoji** | 💭 |
| **Poids confiance** | 0.4 (40%) |
| **Ton de réponse** | En général, typiquement, approximativement |
| **Sources typiques** | Règles empiriques, approximations, expérience |

**Exemples :**
- "En général, cela prend 2-3 jours ouvrés" (Estimation)
- "Typiquement, les plaquettes de frein durent 30-40 000 km" (Règle empirique)
- "Approximativement, le montage prend 1-2 heures" (Expérience)

---

## Règles de Mélange

### Matrice de Compatibilité

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RÈGLES DE MÉLANGE DES NIVEAUX                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   L1 + L2 = ✅ OK                                                   │
│       Faits + Règles métier = Cohérent                              │
│                                                                      │
│   L1 + L3 = ⚠️ WARNING EXPLICITE                                    │
│       "Cette information est en partie confirmée, en partie supposée│
│                                                                      │
│   L1 + L4 = ❌ INTERDIT SANS DISCLAIMER                             │
│       Mélange faits et heuristiques = Dangereux                     │
│                                                                      │
│   L2 + L3 = ⚠️ WARNING                                              │
│       "Selon nos règles et nos estimations..."                      │
│                                                                      │
│   L2 + L4 = ⚠️ WARNING                                              │
│       "Selon nos règles et généralement..."                         │
│                                                                      │
│   L3 + L4 = ❌ INTERDIT                                             │
│       Trop incertain - Proposer de contacter le service client      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Règle Cardinale

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│     LES AGENTS N'ONT PAS LE DROIT DE MÉLANGER LES NIVEAUX          │
│                   SANS AVERTISSEMENT EXPLICITE                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## KPIs du Semantic Brain

| KPI | Cible | Alerte | Critique |
|-----|-------|--------|----------|
| `contradiction-detection-rate` | > 95% | < 90% | < 80% |
| `reasoning-explainability` | > 90% | < 85% | < 75% |
| `truth-level-mixing-violations` | 0 | > 0 | > 5 |
| `source-verification-coverage` | > 80% | < 70% | < 50% |
| `l1-fact-accuracy` | 100% | < 100% | < 95% |
| `composite-confidence-avg` | > 0.7 | < 0.6 | < 0.5 |

---

## Architecture Technique

### Propriétés Weaviate

```python
# Collection Prod_Chatbot - Schéma enrichi
properties = [
    # Core properties
    Property(name="content", data_type=DataType.TEXT),
    Property(name="title", data_type=DataType.TEXT),
    Property(name="source_type", data_type=DataType.TEXT),
    Property(name="source_path", data_type=DataType.TEXT),
    Property(name="category", data_type=DataType.TEXT),

    # Truth Level System (Semantic Brain L1-L4)
    Property(name="truth_level", data_type=DataType.TEXT),       # L1|L2|L3|L4
    Property(name="verification_status", data_type=DataType.TEXT),# verified|unverified|disputed
    Property(name="confidence_score", data_type=DataType.NUMBER), # 0.0-1.0
    Property(name="last_verified_date", data_type=DataType.TEXT), # ISO date
    Property(name="verified_by", data_type=DataType.TEXT),        # who verified
]
```

### Format Frontmatter Documents

```yaml
---
title: "Politique de livraison"
source_type: policy
category: livraison
# Truth Level metadata
truth_level: L1
verification_status: verified
confidence_score: 0.98
last_verified_date: 2026-01-01
verified_by: product-team
---

# Contenu du document...
```

### API Response Format

```json
{
  "context": "...",
  "sources": ["path/to/doc1.md", "path/to/doc2.md"],
  "total_sources": 5,
  "truth_metadata": {
    "composition": {
      "L1": 2,
      "L2": 1,
      "L3": 2,
      "L4": 0
    },
    "dominant_level": "L1",
    "composite_confidence": 0.76,
    "mixing_warning": "⚠️ Mélange faits vérifiés et hypothèses",
    "contradictions": [],
    "reasoning_chain": [
      "1. ✅ [L1] Politique livraison (score: 0.92) → affirme avec certitude",
      "2. ✅ [L1] CGV retours (score: 0.88) → affirme avec certitude",
      "3. ❓ [L3] FAQ estimations (score: 0.75) → probablement"
    ]
  }
}
```

---

## Détection de Contradictions

### Algorithme

```python
def detect_contradictions(results: list[dict]) -> list[str]:
    """
    Détecte les contradictions entre sources.

    Stratégie:
    1. Grouper par catégorie
    2. Comparer les niveaux de vérité
    3. Signaler si même catégorie a différents niveaux
    """
    contradictions = []
    category_levels = {}

    for r in results:
        category = r.get("category")
        level = r.get("truth_level")
        title = r.get("title")

        if category in category_levels:
            existing_level, existing_title = category_levels[category]
            if existing_level != level:
                contradictions.append(
                    f"Conflit [{category}]: '{existing_title}' ({existing_level}) "
                    f"vs '{title}' ({level})"
                )
        else:
            category_levels[category] = (level, title)

    return contradictions
```

### Gestion des Contradictions

```
┌─────────────────────────────────────────────────────────────────────┐
│                  GESTION DES CONTRADICTIONS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. DÉTECTION                                                        │
│     - Même catégorie, différents niveaux de vérité                  │
│     - Sources avec informations contradictoires                      │
│                                                                      │
│  2. SIGNALEMENT                                                      │
│     - Ajouter dans contradictions[]                                  │
│     - Inclure dans reasoning_chain                                   │
│                                                                      │
│  3. RÉPONSE                                                          │
│     - Mentionner les DEUX versions                                   │
│     - Indiquer le niveau de chaque source                           │
│     - Recommander de contacter le service client                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Intégration AI-COS

### Agents Concernés

| Agent | Rôle avec Semantic Brain |
|-------|--------------------------|
| IA-CX360 | Utilise L1-L4 pour réponses chatbot |
| IA-SEO | Génère contenu basé sur L1 uniquement |
| IA-Content | Différencie faits (L1) des estimations (L4) |
| IA-Diag | Diagnostic utilise L2 (règles) + L3 (hypothèses) |
| Front-Agent | Affiche niveau de confiance dans UI |

### Règles pour les Agents

```yaml
Agent_Rules:
  content_generation:
    allowed_levels: [L1, L2]
    forbidden_levels: [L3, L4]
    reason: "Le contenu publié doit être factuel"

  customer_support:
    allowed_levels: [L1, L2, L3]
    warning_levels: [L4]
    reason: "Peut utiliser hypothèses avec avertissement"

  diagnostic:
    allowed_levels: [L2, L3, L4]
    primary_level: L2
    reason: "Diagnostic utilise règles métier + heuristiques"

  legal_compliance:
    allowed_levels: [L1]
    forbidden_levels: [L2, L3, L4]
    reason: "Documents légaux = faits vérifiés uniquement"
```

---

## Fichiers Modifiés

| Fichier | Modification |
|---------|--------------|
| `/opt/automecanik/rag/scripts/init_schema.py` | +5 propriétés truth_level |
| `/opt/automecanik/rag/scripts/build_index.py` | Extraction frontmatter L1-L4 |
| `/opt/automecanik/rag/app/services/rag_service.py` | Analyse + scoring composite |
| `/opt/automecanik/rag/app/services/weaviate_client.py` | Retour métadonnées |
| `/opt/automecanik/rag/app/api/chat.py` | Response enrichie |
| `/opt/automecanik/rag/app/api/search.py` | Response enrichie |
| `/opt/automecanik/rag/app/prompts/templates.py` | Prompt avec truth levels |

---

## Migration

### Étapes

1. **Backup** collection Weaviate existante
2. **Créer** nouvelle collection avec propriétés enrichies
3. **Migrer** documents avec `truth_level=L3` par défaut (unverified)
4. **Re-indexer** avec nouveaux embeddings si nécessaire
5. **Vérifier** via API que truth_metadata est retourné

### Script de Migration

```bash
# 1. Backup
python scripts/backup_collection.py

# 2. Recréer schéma
python scripts/init_schema.py  # Répondre 'y' pour recréer

# 3. Re-indexer avec truth levels
python scripts/build_index.py /path/to/knowledge

# 4. Vérifier
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "livraison"}' | jq '.truth_metadata'
```

---

## Related Documents

- [AI-COS Operating System](./ai-cos-operating-system.md) - Système global
- [AI-COS Governance Rules](./ai-cos-governance-rules.md) - Règles de gouvernance
- [Knowledge Graph Governance](./knowledge-graph-governance.md) - Gouvernance KG
- [AI-COS Products](./ai-cos-products.md) - Catalogue produits IA
