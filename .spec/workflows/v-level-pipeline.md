# Pipeline V-Level : Guide Complet

## Vue d'Ensemble

Ce document decrit le pipeline complet pour calculer les niveaux V1-V5 des vehicules.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIPELINE V-LEVEL                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   COLLECTE                 CALCUL                    UTILISATION            │
│   ────────                 ──────                    ───────────            │
│                                                                              │
│   ┌─────────────┐         ┌─────────────┐          ┌─────────────┐         │
│   │ Google      │         │             │          │             │         │
│   │ Trends      │────────▶│    n8n      │─────────▶│  NestJS     │         │
│   │ (pytrends)  │         │  Workflow   │          │  Service    │         │
│   └─────────────┘         │             │          │             │         │
│                           │  Calcul:    │          └─────────────┘         │
│   ┌─────────────┐         │  - V2/gamme │                 │                │
│   │ Search      │────────▶│  - V3/V4    │                 ▼                │
│   │ Console     │         │  - V1 global│          ┌─────────────┐         │
│   └─────────────┘         └─────────────┘          │  Frontend   │         │
│                                  │                 │  (Remix)    │         │
│                                  ▼                 └─────────────┘         │
│                           ┌─────────────┐                                  │
│                           │ PostgreSQL  │                                  │
│                           │ (Supabase)  │                                  │
│                           └─────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Prerequisites

### 1.1 Logiciels a Installer

| Composant | Version | Role |
|-----------|---------|------|
| **Docker** | 20.10+ | Conteneurisation |
| **n8n** | latest | Orchestration workflows |
| **Python** | 3.9+ | Script pytrends |
| **pytrends** | 4.9+ | API Google Trends |

### 1.2 Comptes et Acces

| Service | Requis | Documentation |
|---------|--------|---------------|
| **Google Search Console** | Oui | https://search.google.com/search-console |
| **Google Cloud Console** | Oui (OAuth) | https://console.cloud.google.com |
| **Supabase** | Deja configure | - |

### 1.3 Configuration OAuth Google

```
1. Aller sur Google Cloud Console
2. Creer un projet (ou utiliser existant)
3. Activer "Search Console API"
4. Creer des identifiants OAuth 2.0
5. Configurer les URIs de redirection:
   - https://n8n.automecanik.fr/rest/oauth2-credential/callback
6. Recuperer CLIENT_ID et CLIENT_SECRET
```

---

## 2. Installation n8n

### 2.1 Docker Compose

Creer le fichier `docker-compose.n8n.yml`:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      # Authentification
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}

      # Configuration URL
      - N8N_HOST=n8n.automecanik.fr
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.automecanik.fr/

      # Timezone
      - GENERIC_TIMEZONE=Europe/Paris
      - TZ=Europe/Paris

      # Base de donnees (SQLite par defaut, ou PostgreSQL)
      # - DB_TYPE=postgresdb
      # - DB_POSTGRESDB_HOST=postgres
      # - DB_POSTGRESDB_DATABASE=n8n
      # - DB_POSTGRESDB_USER=n8n
      # - DB_POSTGRESDB_PASSWORD=${N8N_DB_PASSWORD}

    volumes:
      - n8n_data:/home/node/.n8n
      - ./scripts:/home/node/scripts:ro
    networks:
      - automecanik-prod

volumes:
  n8n_data:

networks:
  automecanik-prod:
    external: true
```

### 2.2 Commandes d'Installation

```bash
# 1. Creer le reseau Docker (si non existant)
docker network create automecanik-prod

# 2. Creer le fichier .env avec le mot de passe
echo "N8N_PASSWORD=VotreMotDePasseSecurise" >> .env

# 3. Demarrer n8n
docker compose -f docker-compose.n8n.yml up -d

# 4. Verifier que n8n fonctionne
docker logs n8n

# 5. Acceder a l'interface
# https://n8n.automecanik.fr ou http://localhost:5678
```

### 2.3 Configuration Caddy (Reverse Proxy)

Ajouter dans `docker-compose.caddy.yml`:

```yaml
# Dans la section services.caddy.environment ou Caddyfile
n8n.automecanik.fr {
    reverse_proxy n8n:5678
}
```

---

## 3. Tables SQL

### 3.1 Table des Donnees Brutes

```sql
-- Stocke les donnees collectees (Google Trends, Search Console)
CREATE TABLE IF NOT EXISTS __v_level_raw (
    id SERIAL PRIMARY KEY,

    -- Identification vehicule
    model_id INT NOT NULL,              -- FK vers __models (ex: Clio 3)
    model_name VARCHAR(100),            -- Cache du nom pour debug
    variant_id INT NOT NULL,            -- FK vers __variants (ex: 1.5 dCi 90cv)
    variant_name VARCHAR(100),          -- Cache du nom pour debug
    gamme_id INT NOT NULL,              -- FK vers __gammes (ex: Plaquettes)
    gamme_name VARCHAR(100),            -- Cache du nom pour debug

    -- Energie (separation obligatoire)
    energy VARCHAR(10) NOT NULL,        -- 'diesel' | 'essence' | 'hybride' | 'electrique'

    -- Source des donnees
    source VARCHAR(20) NOT NULL,        -- 'google_trends' | 'search_console' | 'autocomplete'

    -- Donnees collectees
    score INT,                          -- Score relatif Google Trends (0-100)
    clicks INT,                         -- Clics Search Console
    impressions INT,                    -- Impressions Search Console
    ctr DECIMAL(5,4),                   -- CTR Search Console
    position DECIMAL(5,2),              -- Position moyenne Search Console
    query TEXT,                         -- Requete originale

    -- Metadata
    collected_at TIMESTAMP DEFAULT NOW(),
    period_start DATE,                  -- Debut periode (pour historique)
    period_end DATE,                    -- Fin periode

    -- Contrainte d'unicite
    UNIQUE(model_id, variant_id, gamme_id, energy, source, period_start)
);

-- Index pour performances
CREATE INDEX idx_vlr_model_energy ON __v_level_raw(model_id, energy);
CREATE INDEX idx_vlr_gamme ON __v_level_raw(gamme_id);
CREATE INDEX idx_vlr_collected ON __v_level_raw(collected_at DESC);
```

### 3.2 Table des Resultats Calcules

```sql
-- Stocke les V-levels calcules
CREATE TABLE IF NOT EXISTS __v_level_computed (
    id SERIAL PRIMARY KEY,

    -- Identification
    model_id INT NOT NULL,
    model_name VARCHAR(100),
    variant_id INT NOT NULL,
    variant_name VARCHAR(100),
    gamme_id INT,                       -- NULL pour V1 (niveau modele global)
    gamme_name VARCHAR(100),
    energy VARCHAR(10) NOT NULL,

    -- Resultat V-Level
    v_level VARCHAR(2) NOT NULL,        -- 'V1', 'V2', 'V3', 'V4', 'V5'
    rank INT,                           -- Position dans le classement (1, 2, 3...)

    -- Scores agriges
    score_trends INT DEFAULT 0,         -- Score Google Trends agrege
    score_search_console INT DEFAULT 0, -- Score Search Console agrege
    score_total INT DEFAULT 0,          -- Score total combine

    -- Metadata V1
    is_v1 BOOLEAN DEFAULT FALSE,        -- Est-ce le V1 du modele ?
    v2_count INT DEFAULT 0,             -- Nombre de fois V2 (pour calcul V1)
    v2_percentage DECIMAL(5,2),         -- % de gammes ou c'est V2

    -- Timestamps
    computed_at TIMESTAMP DEFAULT NOW(),
    valid_until TIMESTAMP,              -- Date d'expiration (prochain recalcul)

    -- Contrainte d'unicite
    UNIQUE(model_id, variant_id, gamme_id, energy)
);

-- Index pour requetes frequentes
CREATE INDEX idx_vlc_model_energy ON __v_level_computed(model_id, energy);
CREATE INDEX idx_vlc_gamme ON __v_level_computed(gamme_id);
CREATE INDEX idx_vlc_vlevel ON __v_level_computed(v_level);
CREATE INDEX idx_vlc_v1 ON __v_level_computed(is_v1) WHERE is_v1 = TRUE;
```

### 3.3 Table de Configuration

```sql
-- Configuration du systeme V-Level
CREATE TABLE IF NOT EXISTS __v_level_config (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Valeurs par defaut
INSERT INTO __v_level_config (key, value, description) VALUES
('v1_threshold_percentage', '30', 'Seuil minimum % gammes G1 pour V1'),
('v3_min_score', '1', 'Score minimum pour etre V3 (sinon V4)'),
('refresh_interval_days', '7', 'Intervalle de rafraichissement en jours'),
('trends_geo', 'FR', 'Region Google Trends'),
('trends_timeframe', 'today 12-m', 'Periode Google Trends');
```

---

## 4. Workflow 1 : Collecte Google Trends

### 4.1 Script Python (pytrends)

Creer le fichier `scripts/collect_google_trends.py`:

```python
#!/usr/bin/env python3
"""
Script de collecte Google Trends pour le systeme V-Level
Usage: python collect_google_trends.py '["requete1", "requete2"]'
"""

import sys
import json
import time
from pytrends.request import TrendReq

def get_trends(keywords: list, geo: str = 'FR', timeframe: str = 'today 12-m') -> dict:
    """
    Collecte les scores Google Trends pour une liste de mots-cles.

    Args:
        keywords: Liste de mots-cles (max recommande: 100)
        geo: Region (FR, US, etc.)
        timeframe: Periode ('today 12-m', 'today 3-m', etc.)

    Returns:
        dict: {keyword: score} ou score est 0-100
    """
    pytrends = TrendReq(hl='fr-FR', tz=60, retries=3, backoff_factor=0.5)
    results = {}

    # Google Trends limite a 5 mots-cles par requete
    batch_size = 5

    for i in range(0, len(keywords), batch_size):
        batch = keywords[i:i + batch_size]

        try:
            # Construire la requete
            pytrends.build_payload(batch, cat=0, timeframe=timeframe, geo=geo)

            # Recuperer les donnees
            interest = pytrends.interest_over_time()

            if not interest.empty:
                for kw in batch:
                    if kw in interest.columns:
                        # Moyenne sur la periode
                        results[kw] = int(interest[kw].mean())
                    else:
                        results[kw] = 0
            else:
                # Aucune donnee pour ce batch
                for kw in batch:
                    results[kw] = 0

        except Exception as e:
            # En cas d'erreur, mettre 0 et loguer
            print(f"Erreur batch {i}: {e}", file=sys.stderr)
            for kw in batch:
                results[kw] = 0

        # Pause entre les requetes pour eviter le rate limiting
        if i + batch_size < len(keywords):
            time.sleep(2)

    return results


def generate_keywords(model: str, variants: list, gamme: str) -> list:
    """
    Genere les mots-cles de recherche pour un modele/gamme.

    Args:
        model: Nom du modele (ex: "clio 3")
        variants: Liste des variantes (ex: ["1.5 dci 90", "1.5 dci 105"])
        gamme: Nom de la gamme (ex: "plaquette frein")

    Returns:
        list: Liste de mots-cles formates
    """
    keywords = []
    for variant in variants:
        # Format: "gamme modele variante"
        kw = f"{gamme} {model} {variant}".lower().strip()
        keywords.append(kw)
    return keywords


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python collect_google_trends.py '<json_keywords>'")
        print("Example: python collect_google_trends.py '[\"plaquette frein clio 3 1.5 dci 90\"]'")
        sys.exit(1)

    try:
        keywords = json.loads(sys.argv[1])

        # Options supplementaires
        geo = sys.argv[2] if len(sys.argv) > 2 else 'FR'
        timeframe = sys.argv[3] if len(sys.argv) > 3 else 'today 12-m'

        results = get_trends(keywords, geo, timeframe)

        # Output JSON pour n8n
        print(json.dumps(results))

    except json.JSONDecodeError as e:
        print(f"Erreur JSON: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erreur: {e}", file=sys.stderr)
        sys.exit(1)
```

### 4.2 Workflow n8n : Collecte Trends

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOW: Collecte Google Trends                               │
│  Trigger: Cron (chaque lundi a 3h00)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Cron Trigger]                                                 │
│       │                                                         │
│       ▼                                                         │
│  [Supabase] ─── SELECT model_id, model_name FROM __models      │
│       │         WHERE active = true                             │
│       ▼                                                         │
│  [Loop: Pour chaque modele]                                    │
│       │                                                         │
│       ▼                                                         │
│  [Supabase] ─── SELECT variant_id, variant_name                │
│       │         FROM __variants WHERE model_id = {{model_id}}   │
│       ▼                                                         │
│  [Supabase] ─── SELECT gamme_id, gamme_name FROM __gammes      │
│       │         WHERE g_level = 'G1'                            │
│       ▼                                                         │
│  [Code Node] ─── Generer les mots-cles                         │
│       │         "plaquette frein clio 3 1.5 dci 90"            │
│       ▼                                                         │
│  [Execute Command] ─── python collect_google_trends.py          │
│       │               '["kw1", "kw2", ...]'                     │
│       ▼                                                         │
│  [Code Node] ─── Parser les resultats JSON                     │
│       │                                                         │
│       ▼                                                         │
│  [Supabase] ─── INSERT INTO __v_level_raw                      │
│                 (model_id, variant_id, gamme_id, energy,        │
│                  source, score, query, collected_at)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Code Node - Generation mots-cles:**

```javascript
// Generer les mots-cles pour pytrends
const model = $input.first().json.model_name;
const variants = $input.all().map(item => item.json.variant_name);
const gammes = $node["Supabase_Gammes"].json;

const keywords = [];

for (const gamme of gammes) {
  for (const variant of variants) {
    // Separer diesel/essence
    const energy = variant.toLowerCase().includes('dci') ||
                   variant.toLowerCase().includes('hdi') ||
                   variant.toLowerCase().includes('tdi') ? 'diesel' : 'essence';

    keywords.push({
      keyword: `${gamme.gamme_name} ${model} ${variant}`.toLowerCase(),
      model_id: $input.first().json.model_id,
      variant_id: variant.variant_id,
      gamme_id: gamme.gamme_id,
      energy: energy
    });
  }
}

return keywords;
```

---

## 5. Workflow 2 : Collecte Search Console

### 5.1 Configuration OAuth

Dans n8n, creer une credential "Google OAuth2 API":

```
1. Aller dans Settings > Credentials
2. Ajouter "Google OAuth2 API"
3. Configurer:
   - Client ID: (depuis Google Cloud Console)
   - Client Secret: (depuis Google Cloud Console)
   - Scope: https://www.googleapis.com/auth/webmasters.readonly
4. Autoriser l'acces
```

### 5.2 Workflow n8n : Collecte Search Console

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOW: Collecte Search Console                              │
│  Trigger: Cron (chaque jour a 4h00)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Cron Trigger]                                                 │
│       │                                                         │
│       ▼                                                         │
│  [HTTP Request] ─── POST searchanalytics/query                 │
│       │             site: https://www.automecanik.fr           │
│       │             startDate: -30 jours                        │
│       │             endDate: aujourd'hui                        │
│       │             dimensions: [query, page]                   │
│       │             rowLimit: 25000                             │
│       ▼                                                         │
│  [Code Node] ─── Filtrer requetes pertinentes                  │
│       │         (contenant modele + piece)                      │
│       ▼                                                         │
│  [Code Node] ─── Parser et extraire:                           │
│       │         - model_id (depuis URL ou query)                │
│       │         - variant_id                                    │
│       │         - gamme_id                                      │
│       │         - energy                                        │
│       ▼                                                         │
│  [Supabase] ─── INSERT INTO __v_level_raw                      │
│                 (clicks, impressions, ctr, position, query)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**HTTP Request - Search Console API:**

```json
{
  "method": "POST",
  "url": "https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fwww.automecanik.fr/searchAnalytics/query",
  "authentication": "oAuth2",
  "body": {
    "startDate": "{{ $now.minus({days: 30}).toFormat('yyyy-MM-dd') }}",
    "endDate": "{{ $now.toFormat('yyyy-MM-dd') }}",
    "dimensions": ["query", "page"],
    "rowLimit": 25000,
    "dimensionFilterGroups": [{
      "filters": [{
        "dimension": "query",
        "operator": "contains",
        "expression": "plaquette|filtre|amortisseur|courroie"
      }]
    }]
  }
}
```

---

## 6. Workflow 3 : Calcul V-Level

### 6.1 Algorithme de Calcul

```
POUR chaque modele M:
    POUR chaque energie E (diesel, essence):

        # ETAPE 1: Calculer V2 par gamme
        POUR chaque gamme G:
            variantes = SELECT * FROM __v_level_raw
                        WHERE model_id = M AND energy = E AND gamme_id = G

            # Agreger les scores (trends + search console)
            POUR chaque variante V:
                score_total = score_trends + (clicks * 10)

            # Trier par score DESC
            classement = SORT(variantes, score_total, DESC)

            # Assigner V2, V3, V4
            classement[0] → V2
            classement[1..N] avec score > 0 → V3
            classement avec score = 0 → V4

        # ETAPE 2: Calculer V1 (global)
        v2_counts = COUNT(*) GROUP BY variant_id WHERE v_level = 'V2'
        total_gammes_g1 = COUNT(DISTINCT gamme_id) WHERE g_level = 'G1'

        POUR chaque variante V:
            v2_percentage = v2_counts[V] / total_gammes_g1 * 100

        # Regle 11: Seuil >= 30%
        SI MAX(v2_percentage) >= 30%:
            V1 = variante avec MAX(v2_percentage)
        SINON:
            V1 = variante avec MAX(v2_counts)

        # Regle 12: Egalite → departage par volume total
        SI egalite v2_counts:
            V1 = variante avec MAX(score_total)
```

### 6.2 Workflow n8n : Calcul V-Level

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOW: Calcul V-Level                                       │
│  Trigger: Apres collecte OU Cron (chaque mardi a 5h00)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Cron/Webhook Trigger]                                         │
│       │                                                         │
│       ▼                                                         │
│  [Supabase] ─── SELECT DISTINCT model_id FROM __v_level_raw    │
│       │         WHERE collected_at > NOW() - INTERVAL '7 days'  │
│       ▼                                                         │
│  [Loop: Pour chaque modele]                                    │
│       │                                                         │
│       ▼                                                         │
│  [Loop: Pour chaque energie (diesel, essence)]                 │
│       │                                                         │
│       ├──────────────────────────────────────┐                  │
│       │                                      │                  │
│       ▼                                      │                  │
│  [Supabase] ─── Agreger scores par variante/gamme              │
│       │                                      │                  │
│       ▼                                      │                  │
│  [Code Node] ─── Calculer V2/V3/V4 par gamme                   │
│       │                                      │                  │
│       ▼                                      │                  │
│  [Code Node] ─── Calculer V1 (inter-gammes)  │                  │
│       │                                      │                  │
│       └──────────────────────────────────────┘                  │
│       │                                                         │
│       ▼                                                         │
│  [Supabase] ─── UPSERT INTO __v_level_computed                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Code Node - Calcul V2/V3/V4:**

```javascript
// Entree: variantes avec scores pour une gamme
const variantes = $input.all();

// Trier par score total DESC
const sorted = variantes.sort((a, b) => b.json.score_total - a.json.score_total);

const results = sorted.map((v, index) => {
  let v_level;

  if (index === 0) {
    v_level = 'V2'; // Champion unique
  } else if (v.json.score_total > 0) {
    v_level = 'V3'; // Challenger recherche
  } else {
    v_level = 'V4'; // Non recherche
  }

  return {
    ...v.json,
    v_level: v_level,
    rank: index + 1
  };
});

return results;
```

**Code Node - Calcul V1:**

```javascript
// Entree: tous les V-levels calcules pour un modele/energie
const allVLevels = $input.all();

// Compter les V2 par variante
const v2Counts = {};
const totalScores = {};

for (const item of allVLevels) {
  const variantId = item.json.variant_id;

  if (!v2Counts[variantId]) {
    v2Counts[variantId] = 0;
    totalScores[variantId] = 0;
  }

  if (item.json.v_level === 'V2') {
    v2Counts[variantId]++;
  }

  totalScores[variantId] += item.json.score_total;
}

// Compter les gammes G1
const totalGammesG1 = $node["Supabase_GammesG1"].json.length;

// Calculer le pourcentage V2
const v2Percentages = {};
for (const variantId in v2Counts) {
  v2Percentages[variantId] = (v2Counts[variantId] / totalGammesG1) * 100;
}

// Determiner V1
let v1VariantId = null;
let maxV2Percentage = 0;
let maxV2Count = 0;

for (const variantId in v2Counts) {
  const percentage = v2Percentages[variantId];
  const count = v2Counts[variantId];

  // Regle 11: Seuil >= 30%
  if (percentage >= 30 && percentage > maxV2Percentage) {
    v1VariantId = variantId;
    maxV2Percentage = percentage;
  }
}

// Si aucun >= 30%, prendre le max count
if (!v1VariantId) {
  for (const variantId in v2Counts) {
    if (v2Counts[variantId] > maxV2Count) {
      maxV2Count = v2Counts[variantId];
      v1VariantId = variantId;
    } else if (v2Counts[variantId] === maxV2Count) {
      // Regle 12: Egalite → departage par score total
      if (totalScores[variantId] > totalScores[v1VariantId]) {
        v1VariantId = variantId;
      }
    }
  }
}

return {
  v1_variant_id: v1VariantId,
  v2_count: v2Counts[v1VariantId],
  v2_percentage: v2Percentages[v1VariantId],
  total_score: totalScores[v1VariantId]
};
```

---

## 7. API NestJS

### 7.1 Endpoints

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v-level/:modelId` | V-levels d'un modele |
| `GET` | `/api/v-level/:modelId/:gammeId` | V-levels pour une gamme |
| `GET` | `/api/v-level/v1/:modelId` | V1 d'un modele |
| `POST` | `/api/v-level/recalculate` | Declencher recalcul |

### 7.2 Types TypeScript

```typescript
// types/v-level.types.ts

export type VLevelType = 'V1' | 'V2' | 'V3' | 'V4' | 'V5';
export type EnergyType = 'diesel' | 'essence' | 'hybride' | 'electrique';

export interface VLevelResult {
  model_id: number;
  model_name: string;
  variant_id: number;
  variant_name: string;
  gamme_id: number | null;
  gamme_name: string | null;
  energy: EnergyType;
  v_level: VLevelType;
  rank: number;
  score_total: number;
  is_v1: boolean;
  v2_count?: number;
  v2_percentage?: number;
  computed_at: Date;
}

export interface VLevelRanking {
  gamme_id: number;
  gamme_name: string;
  variants: VLevelResult[];
}

export interface V1Result {
  model_id: number;
  model_name: string;
  energy: EnergyType;
  v1_variant: VLevelResult;
}
```

### 7.3 Service NestJS

```typescript
// backend/src/modules/seo/services/v-level-calculator.service.ts

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { VLevelResult, VLevelRanking, V1Result, EnergyType } from '../types/v-level.types';

@Injectable()
export class VLevelCalculatorService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Recupere tous les V-levels d'un modele
   */
  async getVLevelsByModel(
    modelId: number,
    energy?: EnergyType
  ): Promise<VLevelResult[]> {
    let query = this.supabase.client
      .from('__v_level_computed')
      .select('*')
      .eq('model_id', modelId)
      .order('gamme_id')
      .order('rank');

    if (energy) {
      query = query.eq('energy', energy);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * Recupere les V-levels pour une gamme specifique
   */
  async getVLevelsByGamme(
    modelId: number,
    gammeId: number,
    energy?: EnergyType
  ): Promise<VLevelResult[]> {
    let query = this.supabase.client
      .from('__v_level_computed')
      .select('*')
      .eq('model_id', modelId)
      .eq('gamme_id', gammeId)
      .order('rank');

    if (energy) {
      query = query.eq('energy', energy);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * Recupere le V1 d'un modele (par energie)
   */
  async getV1(modelId: number, energy: EnergyType): Promise<V1Result | null> {
    const { data, error } = await this.supabase.client
      .from('__v_level_computed')
      .select('*')
      .eq('model_id', modelId)
      .eq('energy', energy)
      .eq('is_v1', true)
      .single();

    if (error || !data) return null;

    return {
      model_id: data.model_id,
      model_name: data.model_name,
      energy: data.energy,
      v1_variant: data
    };
  }

  /**
   * Recupere le classement complet par gamme
   */
  async getGammeRanking(
    modelId: number,
    gammeId: number,
    energy: EnergyType
  ): Promise<VLevelRanking> {
    const variants = await this.getVLevelsByGamme(modelId, gammeId, energy);

    return {
      gamme_id: gammeId,
      gamme_name: variants[0]?.gamme_name || '',
      variants
    };
  }

  /**
   * Verifie si une variante est V2 pour une gamme donnee
   */
  async isV2(
    variantId: number,
    gammeId: number,
    energy: EnergyType
  ): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('__v_level_computed')
      .select('v_level')
      .eq('variant_id', variantId)
      .eq('gamme_id', gammeId)
      .eq('energy', energy)
      .single();

    return data?.v_level === 'V2';
  }
}
```

---

## 8. Checklist d'Implementation

### Phase 1 : Infrastructure (Semaine 1)

- [ ] Installer Docker (si non present)
- [ ] Creer le fichier `docker-compose.n8n.yml`
- [ ] Configurer les variables d'environnement (.env)
- [ ] Demarrer n8n
- [ ] Configurer le reverse proxy (Caddy/Nginx)
- [ ] Tester l'acces a n8n

### Phase 2 : Configuration Google (Semaine 1)

- [ ] Creer projet Google Cloud Console
- [ ] Activer Search Console API
- [ ] Creer identifiants OAuth 2.0
- [ ] Configurer les URIs de redirection
- [ ] Ajouter credential OAuth dans n8n
- [ ] Tester la connexion Search Console

### Phase 3 : Base de Donnees (Semaine 2)

- [ ] Creer table `__v_level_raw`
- [ ] Creer table `__v_level_computed`
- [ ] Creer table `__v_level_config`
- [ ] Inserer les valeurs de config par defaut
- [ ] Creer les index
- [ ] Tester les requetes

### Phase 4 : Scripts Python (Semaine 2)

- [ ] Installer Python 3.9+ sur le serveur
- [ ] Installer pytrends (`pip install pytrends`)
- [ ] Deployer `collect_google_trends.py`
- [ ] Tester le script manuellement
- [ ] Configurer les permissions

### Phase 5 : Workflows n8n (Semaine 3)

- [ ] Creer Workflow 1 : Collecte Google Trends
- [ ] Tester Workflow 1 sur un modele
- [ ] Creer Workflow 2 : Collecte Search Console
- [ ] Tester Workflow 2
- [ ] Creer Workflow 3 : Calcul V-Level
- [ ] Tester Workflow 3
- [ ] Configurer les triggers Cron

### Phase 6 : Service NestJS (Semaine 4)

- [ ] Creer les types TypeScript
- [ ] Creer VLevelCalculatorService
- [ ] Creer VLevelController
- [ ] Ajouter les routes API
- [ ] Ecrire les tests unitaires
- [ ] Tester les endpoints

### Phase 7 : Integration (Semaine 4)

- [ ] Connecter le frontend aux endpoints
- [ ] Afficher les V-levels sur les pages produits
- [ ] Tester le flux complet
- [ ] Documenter les erreurs possibles

---

## 9. Maintenance

### 9.1 Monitoring

```bash
# Logs n8n
docker logs n8n -f

# Verifier les executions
# Dans n8n: Executions > All Executions

# Verifier les donnees
SELECT COUNT(*) FROM __v_level_raw WHERE collected_at > NOW() - INTERVAL '7 days';
SELECT COUNT(*) FROM __v_level_computed;
```

### 9.2 Troubleshooting

| Probleme | Cause Probable | Solution |
|----------|----------------|----------|
| Scores tous a 0 | Rate limiting Google | Augmenter les delais entre requetes |
| Erreur OAuth | Token expire | Reconnecter dans n8n |
| V1 incorrect | Donnees insuffisantes | Verifier les gammes G1 |
| Workflow echoue | Timeout | Augmenter le timeout n8n |

### 9.3 Mise a Jour

```bash
# Mettre a jour n8n
docker compose -f docker-compose.n8n.yml pull
docker compose -f docker-compose.n8n.yml up -d

# Mettre a jour pytrends
pip install --upgrade pytrends
```

---

## References

- Cahier des charges : `.spec/features/g-v-classification.md`
- ADR Architecture : `.spec/architecture/decisions/005-v-level-calculator.md`
- pytrends : https://github.com/GeneralMills/pytrends
- n8n : https://docs.n8n.io/
- Search Console API : https://developers.google.com/webmaster-tools/v1/api_reference_index
