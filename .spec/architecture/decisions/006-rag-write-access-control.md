# ADR-006: Controle d'Acces en Ecriture au RAG

## Statut

**Accepte** - 2025-12-28

## Contexte

Le systeme RAG (Retrieval-Augmented Generation) stocke la connaissance metier dans Weaviate (vector database). Cette connaissance est utilisee par :
- Le chatbot client (PROD)
- Les agents internes (PROD/DEV)
- Les outils de support

La question critique est : **qui peut modifier cette connaissance ?**

### Risques identifies

| Risque | Impact | Probabilite |
|--------|--------|-------------|
| Injection de contenu malveillant | Critique | Moyenne |
| Corruption d'index en PROD | Critique | Faible |
| Fuite de donnees internes | Eleve | Moyenne |
| Compromission via chatbot | Eleve | Moyenne |

## Decision

### Une seule entite peut ecrire dans le RAG : l'AI Orchestrator

```
┌─────────────────────────────────────────────────────────────────┐
│                    DECISION ARCHITECTURALE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✅ UNE SEULE ENTITE peut ecrire :                              │
│     → AI Orchestrator                                           │
│     → via credentials inexistants en PROD                       │
│                                                                  │
│  ❌ TOUT LE RESTE = lecture uniquement :                        │
│     → Chatbot                                                   │
│     → Agents PROD                                               │
│     → Clients                                                   │
│     → Runner PROD                                               │
│     → Tout service en PROD                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tableau des droits

| Entite | WRITE | READ | Credentials Weaviate |
|--------|-------|------|----------------------|
| **AI Orchestrator** | ✅ | ✅ | `WEAVIATE_WRITE_KEY` (DEV/CI only) |
| Chatbot | ❌ | ✅ | Aucun (query via API) |
| Agents PROD | ❌ | ✅ | Aucun |
| Runner PROD | ❌ | ❌ | Aucun |
| Clients | ❌ | ✅ | Aucun |

### Garantie technique

```
WEAVIATE_WRITE_KEY :
├── Existe en : DEV, CI (environment: build)
└── N'existe PAS en : PROD, staging, preview
```

### Schema de pilotage

```
          YOU (Developpeur)
           │
           ▼
  ┌─────────────────────────┐
  │    AI ORCHESTRATOR      │  ← Seul point d'ecriture
  │      (DEV / CI)         │
  └───────────┬─────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────┐       ┌─────────┐
│knowledge│       │internal │
│   :*    │       │   :*    │
└────┬────┘       └────┬────┘
     │                 │
     └────────┬────────┘
              ▼
  ┌─────────────────────────┐
  │     VECTOR STORE        │
  │   (READ ONLY IN PROD)   │
  └───────────┬─────────────┘
              │
              ▼
  ┌─────────────────────────┐
  │  Chatbot / Agents PROD  │
  │      (query only)       │
  └─────────────────────────┘
```

## Consequences

### Positives

| Avantage | Description |
|----------|-------------|
| **Securite maximale** | Compromission PROD ≠ compromission RAG |
| **Audit simple** | Un seul point d'entree pour les modifications |
| **Rollback facile** | Versions gerees par l'Orchestrator |
| **Blast radius limite** | Chatbot pirate = aucun impact sur la connaissance |

### Negatives

| Inconvenient | Mitigation |
|--------------|------------|
| Mise a jour plus lente | Pipeline CI/CD automatise |
| Complexite operationnelle | Documentation complete (rag-system.md) |

### Scenarios de compromission

| Scenario | Impact sur le RAG |
|----------|-------------------|
| Chatbot pirate | **Aucun** - lecture seule |
| Runner PROD compromis | **Aucun** - pas de credentials Weaviate |
| Token API vole | **Aucun** - namespaces hardcodes |
| Secrets PROD leakes | **Aucun** - pas de WEAVIATE_WRITE_KEY |

## Implementation

### Pipelines CI/CD separes

```yaml
# Pipeline 1 : deploy-prod (PAS d'acces RAG)
environment: production
secrets: DATABASE_URL, SUPABASE_KEY
# ❌ PAS de WEAVIATE_WRITE_KEY

# Pipeline 2 : build-knowledge (acces RAG)
environment: build
secrets: WEAVIATE_URL, WEAVIATE_WRITE_KEY, OPENAI_API_KEY
# ❌ PAS de DATABASE_URL
```

### Verification

- [ ] `WEAVIATE_WRITE_KEY` absent des secrets PROD
- [ ] Chatbot = endpoint `/knowledge/query` uniquement
- [ ] Agents PROD = READ ONLY sur namespaces autorises
- [ ] Orchestrator = seul a avoir `WEAVIATE_WRITE_KEY`

## References

- [rag-system.md](../../features/rag-system.md) - Section 13.5 (AI Orchestrator)
- [rag-system.md](../../features/rag-system.md) - Section 13.7 (Isolation Pipelines)

## Historique

| Date | Action | Auteur |
|------|--------|--------|
| 2025-12-28 | Creation | Claude Code |
