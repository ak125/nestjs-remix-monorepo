# RAG Config Questions - AutoMecanik

> **Date:** 2026-01-07
> **Type:** BMAD RAG Config Review
> **Objectif:** Questions decisionnelles pour finaliser la config RAG

---

## A) Corpus & Scope

### A1. Le RAG repond a quoi exactement?

**Pourquoi:** Definir le perimetre evite les reponses hors-sujet.

| Option | Description |
|--------|-------------|
| SAV uniquement | FAQ livraison, retours, paiement |
| Diagnostic auto | Procedures techniques, symptomes |
| SEO/Content | Generation contenu produit |
| Mix | Tous les domaines |

**Recommandation:** SAV + FAQ (actuel `knowledge:faq`)

---

### A2. Refuser si vehicule non identifie?

**Pourquoi:** Les pieces auto sont specifiques aux vehicules.

| Option | Description |
|--------|-------------|
| Oui | Demander marque/modele/annee avant reponse |
| Non | Repondre generiquement |

**Recommandation:** Oui (meilleure pertinence)

---

### A3. Sources autorisees?

**Pourquoi:** Eviter les sources externes non verifiees.

| Option | Description |
|--------|-------------|
| Docs internes only | Corpus /knowledge/ uniquement |
| Mix web | Inclure recherche web |

**Recommandation:** Docs internes only

---

## B) Stockage Vectoriel

### B1. Index Weaviate existant?

**Pourquoi:** Savoir si le corpus est deja indexe.

| Check | Commande |
|-------|----------|
| Status Weaviate | `curl http://localhost:8080/v1/meta` |
| Collections | `curl http://localhost:8080/v1/schema` |

**A verifier:** Demarrer Weaviate et verifier l'index

---

### B2. Dimension embeddings correcte?

**Pourquoi:** Mismatch = erreurs de recherche.

| Config | Valeur |
|--------|--------|
| Model | all-MiniLM-L6-v2 |
| Dimension | 384 |

**Status:** OK (384 dim hardcode dans config.py)

---

## C) Ingestion

### C1. Chunk size & overlap?

**Pourquoi:** Affecte la qualite de retrieval.

| Option | Chunk Size | Overlap |
|--------|------------|---------|
| Small | 256 tokens | 50 |
| Medium | 512 tokens | 100 |
| Large | 1024 tokens | 200 |

**Recommandation:** Medium (512/100) pour FAQ

**Status:** Non specifie dans le code (a definir)

---

### C2. Nettoyage HTML?

**Pourquoi:** HTML dans le corpus = bruit.

| Check | Methode |
|-------|---------|
| Grep HTML | `grep -r "<[a-z]" /opt/automecanik/rag/knowledge/` |

**Recommandation:** Activer nettoyage dans pipeline

---

### C3. Deduplication activee?

**Pourquoi:** Doublons = biais retrieval.

**Status:** A verifier dans build_index.py

---

## D) Retrieval

### D1. TopK = 5 suffisant?

**Pourquoi:** Trop peu = manque contexte, trop = bruit.

| Option | TopK |
|--------|------|
| Conservateur | 3 |
| Standard | 5 |
| Large | 10 |

**Recommandation:** 5 (actuel) OK pour FAQ

---

### D2. Score min 0.70 OK?

**Pourquoi:** Seuil de pertinence.

| Option | Score | Comportement |
|--------|-------|--------------|
| Strict | 0.80 | Moins de reponses, plus precises |
| Standard | 0.70 | Equilibre |
| Permissif | 0.50 | Plus de reponses, moins precises |

**Recommandation:** 0.70 (actuel) OK

---

### D3. Reranker necessaire?

**Pourquoi:** Ameliore la pertinence des top resultats.

| Option | Description |
|--------|-------------|
| Sans reranker | Hybrid search seul |
| Cross-encoder | Rerank par similarite semantique |
| LLM rerank | Rerank par Claude |

**Recommandation:** Sans pour MVP, ajouter en V2

---

## E) Generation / Prompt

### E1. Fallback sans sources autorise?

**Pourquoi:** Eviter hallucinations.

| Option | Comportement |
|--------|--------------|
| Oui | LLM repond meme sans sources |
| Non | Refuse si <3 sources pertinentes |

**Status actuel:** Non (needs_clarification=true)
**Recommandation:** Maintenir Non

---

### E2. Format reponse structure?

**Pourquoi:** Coherence des reponses.

| Element | Obligatoire |
|---------|-------------|
| Reponse principale | Oui |
| Sources citees | Oui |
| Etapes/Actions | Optionnel |
| Avertissements | Si applicable |

**Recommandation:** Definir template dans prompts/templates.py

---

## F) Evaluation

### F1. Golden queries set existe?

**Pourquoi:** Valider qualite avant PROD.

**Status:** NON

**Recommandation:** Creer 8-10 queries avec expected answers:

| # | Query | Expected | Truth Level |
|---|-------|----------|-------------|
| 1 | Delai livraison standard? | 48-72h | L1 |
| 2 | Frais port gratuits? | 59 euros | L1 |
| 3 | Politique retour? | 14 jours | L1 |
| 4 | Prix disques BMW? | REFUSE | - |
| 5 | Comment installer plaquettes? | Guide | L2 |

---

### F2. Score minimal PROD?

**Pourquoi:** Gate d'activation RAG.

| Option | Score |
|--------|-------|
| Strict | 90% golden tests pass |
| Standard | 80% golden tests pass |

**Recommandation:** 100% golden tests pass avant PROD

---

## G) Ops / Endpoints

### G1. Endpoints exposes?

| Endpoint | Status |
|----------|--------|
| /api/rag/health | ACTIVE (apres wiring) |
| /api/rag/chat | ACTIVE (apres wiring) |
| /api/rag/search | ACTIVE (apres wiring) |

---

### G2. Auth configuree?

| Aspect | Valeur |
|--------|--------|
| Type | X-API-Key header |
| Key | automecanik-rag-dev-2026 (DEV) |

**Recommandation:** Changer la cle pour PROD

---

### G3. Rate limiting actif?

| Parametre | Valeur |
|-----------|--------|
| Requests/min | 60 |
| Requests/hour | 3600 |

**Status:** OK

---

## Resume des Decisions Requises

| # | Question | Decision Requise |
|---|----------|------------------|
| A1 | Scope RAG | SAV+FAQ / Diagnostic / Mix |
| A2 | Refus si vehicule inconnu | Oui / Non |
| C1 | Chunk size | 256 / 512 / 1024 |
| D3 | Reranker | Non / Cross-encoder / LLM |
| E2 | Format reponse | Definir template |
| F1 | Golden tests | A creer |
| F2 | Score PROD | 80% / 90% / 100% |

---

_Questions generees le 2026-01-07_
_BMAD RAG Config Review v1.0_
