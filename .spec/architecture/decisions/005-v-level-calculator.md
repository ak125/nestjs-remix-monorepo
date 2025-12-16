---
title: "ADR-005: V-Level Calculator - Architecture Open Source"
status: proposed
version: 1.0.0
authors: [Claude Code]
created: 2024-12-16
updated: 2024-12-16
supersedes: []
superseded-by: []
tags: [architecture, seo, v-level, open-source]
---

# ADR-005: V-Level Calculator - Architecture Open Source

## Status

**Status:** Proposed
**Date:** 2024-12-16
**Decision Makers:** Equipe Automecanik
**Consulted:** -
**Informed:** Dev Team

## Contexte

Le systeme de classification G+V necessite de determiner les niveaux V1-V5 pour chaque vehicule/gamme.
Ces niveaux dependent des **volumes de recherche Google** pour classer les variantes par popularite.

**Contraintes:**
- Solution 100% open source
- Pas de budget pour APIs payantes (SEMrush, Ahrefs, etc.)
- Automatisation via n8n (workflow engine)
- Stockage dans Supabase/PostgreSQL existant

**Cahier des charges:** `.spec/features/g-v-classification.md`

## Decision

Implementer un pipeline de collecte et calcul V-Level base sur:

1. **Google Trends** (pytrends) - Donnees de popularite relative
2. **Google Search Console** - Donnees reelles du site
3. **n8n** - Orchestration des workflows
4. **NestJS** - Service de calcul et API
5. **PostgreSQL/Supabase** - Stockage des resultats

## Options Considerees

### Option 1: Google Keyword Planner API (via Google Ads)

**Description:** Utiliser l'API officielle Google Ads pour obtenir les volumes de recherche.

**Pros:**
- Donnees officielles Google
- Volumes absolus precis
- API stable

**Cons:**
- Necessite compte Google Ads actif avec depenses
- API complexe (OAuth, quotas)
- Pas vraiment "gratuit"

**Cout:** Moyen (temps) + Budget publicitaire requis

### Option 2: APIs Payantes (SEMrush, Ahrefs, DataForSEO)

**Description:** Utiliser des services SEO professionnels.

**Pros:**
- Donnees tres precises
- APIs simples
- Support technique

**Cons:**
- Cout mensuel eleve (100-500 EUR/mois)
- Dependance a un fournisseur
- Pas open source

**Cout:** Eleve (budget mensuel)

### Option 3: Stack Open Source (RETENU)

**Description:** Combiner Google Trends + Search Console + scraping autocomplete.

**Pros:**
- 100% gratuit
- Donnees suffisantes pour le classement relatif
- Controle total
- Pas de dependance externe payante

**Cons:**
- Donnees relatives (pas de volumes absolus)
- Plus de travail d'integration
- Rate limiting Google Trends

**Cout:** Temps d'implementation uniquement

## Decision Rationale

### Facteurs Cles

1. **Budget zero:** Pas de budget pour APIs payantes
2. **Classement relatif suffisant:** Pour determiner V2 > V3 > V4, on n'a pas besoin de volumes absolus
3. **Donnees reelles du site:** Search Console donne les vraies requetes des utilisateurs
4. **Autonomie:** Pas de dependance a un service externe payant

### Trade-offs Acceptes

- On accepte des **donnees relatives** (scores 0-100) au lieu de volumes absolus
- On accepte un **rate limiting** de Google Trends (environ 100 requetes/jour sans proxy)
- On deprioritize la precision absolue pour gagner en cout et autonomie

## Architecture Technique

### Pipeline de Collecte

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE V-LEVEL                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: COLLECTE          PHASE 2: CALCUL      PHASE 3: API   │
│  ─────────────────          ─────────────────    ────────────   │
│                                                                  │
│  ┌──────────────┐          ┌──────────────┐    ┌─────────────┐ │
│  │ pytrends     │          │              │    │             │ │
│  │ (Python)     │─────────▶│    n8n       │───▶│  NestJS     │ │
│  └──────────────┘          │  Workflows   │    │  Service    │ │
│                            │              │    │             │ │
│  ┌──────────────┐          │  - Calcul V2 │    └─────────────┘ │
│  │ Search       │─────────▶│  - Agreg V1  │           │        │
│  │ Console API  │          │  - Assign V3 │           ▼        │
│  └──────────────┘          │  - Assign V4 │    ┌─────────────┐ │
│                            └──────────────┘    │ PostgreSQL  │ │
│  ┌──────────────┐                 │            │ (Supabase)  │ │
│  │ Autocomplete │─────────────────┘            └─────────────┘ │
│  │ (optionnel)  │                                              │
│  └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sources de Donnees

| Source | Type | Donnees | Frequence |
|--------|------|---------|-----------|
| **Google Trends** | Popularite relative | Score 0-100 par requete | Hebdomadaire |
| **Search Console** | Trafic reel | Clics, impressions, CTR | Quotidien |
| **Autocomplete** | Suggestions | Variantes populaires | Mensuel |

### Schema de Donnees

#### Table: `__v_level_raw` (Donnees brutes collectees)

```sql
CREATE TABLE __v_level_raw (
    id SERIAL PRIMARY KEY,
    model_id INT NOT NULL,              -- ex: Clio 3
    variant_id INT NOT NULL,            -- ex: 1.5 dCi 90cv
    gamme_id INT NOT NULL,              -- ex: Plaquettes de frein
    energy VARCHAR(10) NOT NULL,        -- 'diesel' | 'essence'
    source VARCHAR(20) NOT NULL,        -- 'trends' | 'search_console' | 'autocomplete'
    score INT,                          -- Score relatif (0-100 pour trends)
    clicks INT,                         -- Clics (search console)
    impressions INT,                    -- Impressions (search console)
    query TEXT,                         -- Requete recherchee
    collected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(model_id, variant_id, gamme_id, energy, source)
);
```

#### Table: `__v_level_computed` (Resultats calcules)

```sql
CREATE TABLE __v_level_computed (
    id SERIAL PRIMARY KEY,
    model_id INT NOT NULL,
    variant_id INT NOT NULL,
    gamme_id INT,                       -- NULL pour V1 (niveau modele)
    energy VARCHAR(10) NOT NULL,
    v_level VARCHAR(2) NOT NULL,        -- 'V1', 'V2', 'V3', 'V4', 'V5'
    rank INT,                           -- Position dans le classement
    score_total INT,                    -- Score agrege
    is_v1_candidate BOOLEAN DEFAULT FALSE,
    v2_count INT DEFAULT 0,             -- Nombre de fois V2 (pour calcul V1)
    computed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(model_id, variant_id, gamme_id, energy)
);

-- Index pour requetes frequentes
CREATE INDEX idx_v_level_model_energy ON __v_level_computed(model_id, energy);
CREATE INDEX idx_v_level_gamme ON __v_level_computed(gamme_id);
```

### Workflows n8n

#### Workflow 1: Collecte Google Trends

```
Trigger: Cron (hebdomadaire)
    │
    ▼
┌─────────────────┐
│ Lire modeles    │ ◀── Supabase: SELECT * FROM __models
│ actifs          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Pour chaque     │
│ modele + gamme  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generer         │ ◀── "plaquette frein clio 3 1.5 dci 90"
│ requetes        │     "plaquette frein clio 3 1.5 dci 105"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Appeler         │ ◀── Python: pytrends
│ Google Trends   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stocker         │ ◀── INSERT INTO __v_level_raw
│ resultats       │
└─────────────────┘
```

#### Workflow 2: Collecte Search Console

```
Trigger: Cron (quotidien)
    │
    ▼
┌─────────────────┐
│ API Search      │ ◀── OAuth Google
│ Console         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Filtrer         │ ◀── Requetes contenant modele + piece
│ requetes        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parser          │ ◀── Extraire modele, variante, gamme
│ requetes        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stocker         │ ◀── INSERT INTO __v_level_raw
│ resultats       │
└─────────────────┘
```

#### Workflow 3: Calcul V-Level

```
Trigger: Apres collecte OU Cron (quotidien)
    │
    ▼
┌─────────────────┐
│ Agreger scores  │ ◀── SUM(score) GROUP BY variant_id, gamme_id
│ par variante    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculer V2     │ ◀── Position #1 par gamme
│ par gamme       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculer V3     │ ◀── Positions #2, #3, #4...
│ (challengers)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculer V4     │ ◀── Score = 0 ou tres faible
│ (non recherche) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculer V1     │ ◀── Variante la plus souvent V2 (>= 30% gammes G1)
│ (global)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stocker         │ ◀── UPSERT INTO __v_level_computed
│ resultats       │
└─────────────────┘
```

### Service NestJS

```typescript
// backend/src/modules/seo/services/v-level-calculator.service.ts

@Injectable()
export class VLevelCalculatorService {

  /**
   * Recupere le V-level d'une variante pour une gamme
   */
  async getVLevel(variantId: number, gammeId: number): Promise<VLevelResult> {
    // SELECT v_level FROM __v_level_computed WHERE ...
  }

  /**
   * Recupere le V1 d'un modele (toutes gammes)
   */
  async getV1(modelId: number, energy: 'diesel' | 'essence'): Promise<Variant> {
    // SELECT * FROM __v_level_computed WHERE v_level = 'V1' AND ...
  }

  /**
   * Recupere le classement complet pour une gamme
   */
  async getGammeRanking(modelId: number, gammeId: number, energy: string): Promise<VLevelRanking[]> {
    // SELECT * FROM __v_level_computed WHERE ... ORDER BY rank
  }

  /**
   * Declenche le recalcul V-level (appele par n8n ou manuellement)
   */
  async recalculateVLevels(modelId?: number): Promise<void> {
    // Logique de calcul V2 -> V3 -> V4 -> V1
  }
}
```

### Configuration n8n

#### Installation (Docker)

```yaml
# docker-compose.n8n.yml
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
      - N8N_HOST=n8n.automecanik.fr
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.automecanik.fr/
      - GENERIC_TIMEZONE=Europe/Paris
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - automecanik-prod

volumes:
  n8n_data:

networks:
  automecanik-prod:
    external: true
```

#### Script Python pytrends

```python
# scripts/collect_google_trends.py
from pytrends.request import TrendReq
import json
import sys

def get_trends(keywords: list, geo: str = 'FR') -> dict:
    """
    Collecte les scores Google Trends pour une liste de mots-cles
    """
    pytrends = TrendReq(hl='fr-FR', tz=60)

    # Google Trends limite a 5 mots-cles par requete
    results = {}
    for i in range(0, len(keywords), 5):
        batch = keywords[i:i+5]
        pytrends.build_payload(batch, cat=0, timeframe='today 12-m', geo=geo)
        interest = pytrends.interest_over_time()

        if not interest.empty:
            for kw in batch:
                if kw in interest.columns:
                    results[kw] = int(interest[kw].mean())
                else:
                    results[kw] = 0
        else:
            for kw in batch:
                results[kw] = 0

    return results

if __name__ == '__main__':
    keywords = json.loads(sys.argv[1])
    results = get_trends(keywords)
    print(json.dumps(results))
```

## Consequences

### Positives

- 100% gratuit et open source
- Controle total sur les donnees
- Pas de dependance externe payante
- Donnees reelles du site (Search Console)
- Automatisation complete via n8n

### Negatives

- Donnees relatives, pas de volumes absolus
- Rate limiting Google Trends (~100 req/jour)
- Complexite d'integration plus elevee
- Maintenance du script Python

### Neutres

- Necessite configuration OAuth Google
- Frequence de mise a jour hebdomadaire (pas temps reel)

## Implementation

### Etapes Requises

- [ ] 1. Installer n8n (Docker)
- [ ] 2. Configurer OAuth Google (Search Console)
- [ ] 3. Creer tables SQL `__v_level_raw` et `__v_level_computed`
- [ ] 4. Deployer script Python pytrends
- [ ] 5. Creer workflow n8n: Collecte Trends
- [ ] 6. Creer workflow n8n: Collecte Search Console
- [ ] 7. Creer workflow n8n: Calcul V-Level
- [ ] 8. Creer service NestJS VLevelCalculatorService
- [ ] 9. Tests et validation

### Chemin de Migration

1. **Semaine 1:** Installation n8n + OAuth Google
2. **Semaine 2:** Scripts de collecte + tables SQL
3. **Semaine 3:** Workflows n8n
4. **Semaine 4:** Service NestJS + integration

### Plan de Rollback

- Supprimer les workflows n8n
- Garder les tables avec donnees collectees
- Revenir a un systeme manuel si necessaire

## Metriques de Succes

- **Couverture:** > 80% des modeles ont des V-levels calcules
- **Fraicheur:** Donnees mises a jour chaque semaine
- **Precision:** V2 identifie correctement dans > 90% des gammes
- **Disponibilite:** Service NestJS disponible 99.9%

## Risques

### Risque 1: Rate Limiting Google Trends

**Probabilite:** Moyenne
**Impact:** Moyen
**Mitigation:**
- Espacer les requetes (1 par seconde)
- Utiliser plusieurs IPs/proxies si necessaire
- Cacher les resultats pendant 7 jours

### Risque 2: Changement API Google

**Probabilite:** Faible
**Impact:** Eleve
**Mitigation:**
- Surveiller les changelogs pytrends
- Avoir Search Console comme backup
- Donnees historiques en cache

### Risque 3: Qualite des donnees insuffisante

**Probabilite:** Faible
**Impact:** Moyen
**Mitigation:**
- Combiner plusieurs sources
- Validation manuelle d'un echantillon
- Ajustement des seuils si necessaire

## References

- Cahier des charges: `.spec/features/g-v-classification.md`
- pytrends: https://github.com/GeneralMills/pytrends
- n8n: https://n8n.io/
- Google Search Console API: https://developers.google.com/webmaster-tools

## Notes

- Le score Google Trends est relatif (0-100), pas un volume absolu
- Search Console donne les donnees reelles mais limitees au trafic existant
- La combinaison des deux sources offre une vue complete

## Review

**Date de Review:** 2025-03-16 (dans 3 mois)
**Criteres de Review:**
- Qualite des V-levels calcules
- Performance des workflows
- Cout operationnel

## Timeline

- **Proposed:** 2024-12-16
- **Discussed:** -
- **Decided:** -
- **Implemented:** -

## Change Log

### v1.0.0 (2024-12-16)

- Initial ADR - Architecture V-Level 100% open source
