# RAG Audit Report - AutoMecanik

> **Date:** 2026-01-07
> **Type:** BMAD RAG Config Review
> **Status:** WIRING FIXED

---

## 1. Resume Executif

Le systeme RAG AutoMecanik est compose de:
- **NestJS Proxy** (RagProxyModule) - Port 3000
- **Python FastAPI** (RAG Service) - Port 8000
- **Weaviate** (Vector DB) - Port 8080
- **Corpus** - 15 documents markdown

**Ecart resolu:** `RagProxyModule` etait non importe dans `app.module.ts`. Corrige le 2026-01-07.

---

## 2. Architecture

```
Frontend Remix
     |
     v
NestJS (Port 3000)
  |-- RagProxyModule
  |     |-- POST /api/rag/chat
  |     |-- POST /api/rag/search
  |     |-- GET  /api/rag/health
     |
     v (HTTP + X-API-Key)
Python FastAPI (Port 8000)
  |-- NamespaceGuard (HARDCODED)
  |-- RAGService (Truth Levels L1-L4)
  |-- SecurityValidator (PII + Injection)
     |
     v
Weaviate (Port 8080)
  |-- Hybrid Search (BM25 + Vector)
  |-- all-MiniLM-L6-v2 (384 dim)
```

---

## 3. Composants Status

### 3.1 NestJS Proxy

| Fichier | Status | Description |
|---------|--------|-------------|
| `rag-proxy.module.ts` | OK | Module definition |
| `rag-proxy.controller.ts` | OK | @Controller('api/rag') |
| `rag-proxy.service.ts` | OK | Forward to Python |
| `app.module.ts` | **FIXED** | Import added 2026-01-07 |

### 3.2 Python RAG Service

| Fichier | Status | Description |
|---------|--------|-------------|
| `app/main.py` | OK | FastAPI + Security middleware |
| `app/config.py` | OK | Settings + Kill switch |
| `app/services/rag_service.py` | OK | Truth Levels L1-L4 |
| `app/services/namespace_guard.py` | OK | HARDCODED namespaces |
| `app/services/weaviate_client.py` | OK | Vector DB client |
| `app/services/security_validator.py` | OK | PII + Injection detection |

### 3.3 Endpoints

| Endpoint | Method | Auth | Plane |
|----------|--------|------|-------|
| `/api/rag/chat` | POST | API Key | Runtime |
| `/api/rag/search` | POST | API Key | Runtime |
| `/api/rag/health` | GET | None | Runtime |

---

## 4. Configuration Actuelle

### 4.1 Embeddings
```yaml
model: all-MiniLM-L6-v2
dimension: 384
cost: $0 (local)
```

### 4.2 Retrieval
```yaml
retrieval_top_k: 5
retrieval_alpha: 0.7  # 70% vector, 30% BM25
min_score_threshold: 0.70
min_results_required: 3
```

### 4.3 LLM
```yaml
model: claude-3-5-sonnet-20241022
max_tokens: 1024
temperature: 0.3
```

### 4.4 Security
```yaml
ai_prod_write: false  # KILL SWITCH
PROD_CHATBOT_NAMESPACE: knowledge:faq
rate_limit_rpm: 60
request_timeout: 30
```

---

## 5. Corpus Knowledge

| Categorie | Count | Exemples |
|-----------|-------|----------|
| diagnostic/ | 3 | vibrations.md, temoins-tableau-bord.md |
| faq/ | 4 | livraison.md, paiement.md |
| guides/ | 2 | choisir-plaquettes.md |
| policies/ | 3 | garantie.md, remboursement.md |
| vehicle/ | 2 | peugeot-206.md, renault-clio-3.md |
| **TOTAL** | **15** | |

---

## 6. Truth Levels

| Level | Poids | Description |
|-------|-------|-------------|
| L1 | 1.0 | Faits verifies |
| L2 | 0.9 | Regles metier |
| L3 | 0.6 | Hypotheses |
| L4 | 0.4 | Heuristiques |

### Mixing Rules
- L1 + L2: Autorise
- L1 + L3: Warning
- L1 + L4: **INTERDIT**
- L3 + L4: **INTERDIT**

---

## 7. Risques Identifies

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| RAG hors sujet | MEDIUM | HIGH | Namespace Guard HARDCODE |
| Hallucination | LOW | CRITICAL | min_score=0.70, citations |
| PII leakage | LOW | HIGH | SecurityValidator |
| Injection | LOW | HIGH | SecurityValidator |

---

## 8. Priorites (P0/P1/P2)

### P0 - RESOLU
- [x] Import RagProxyModule dans app.module.ts
- [x] ENV vars configurees

### P1 - A FAIRE
- [ ] Creer golden test suite (8-10 queries)
- [ ] Activer metadata filters
- [ ] Definir chunk size/overlap

### P2 - FUTUR
- [ ] Ajouter reranker
- [ ] Monitoring Grafana
- [ ] ChatWidget Remix

---

## 9. Prochaines Etapes

1. Demarrer le service RAG Python: `cd /opt/automecanik/rag && docker compose up -d`
2. Tester endpoint: `curl http://localhost:3000/api/rag/health`
3. Creer golden tests
4. RAG OFF jusqu'a 100% golden tests pass

---

_Audit genere le 2026-01-07_
_BMAD RAG Config Review v1.0_
