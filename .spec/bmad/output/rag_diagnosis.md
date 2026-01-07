# RAG Diagnosis

> **Generated**: 2026-01-06 | **Updated**: 2026-01-06 | **Agent**: RAG Auditor Agent

---

## Constat Principal

**Le corpus RAG existe dans `/opt/automecanik/rag/knowledge/` avec 14 documents.**

⚠️ **Attention** : Le dossier `/opt/automecanik/app/knowledge/` est VIDE (copie non synchronisee).

---

## Inventaire Corpus RAG

**Chemin**: `/opt/automecanik/rag/knowledge/`

| Categorie | Fichiers | Contenu |
|-----------|----------|---------|
| diagnostic/ | 3 | bruits-freinage.md, temoins-tableau-bord.md, vibrations.md |
| faq/ | 4 | livraison.md, paiement.md, retours.md, suivi-commande.md |
| guides/ | 2 | choisir-plaquettes.md, references-oem.md |
| policies/ | 3 | garantie.md, livraison.md, remboursement.md |
| vehicle/ | 2 | peugeot-206.md, renault-clio-3.md |
| **Total** | **14** | |

---

## Architecture RAG Actuelle

| Composant | Status | Localisation |
|-----------|--------|--------------|
| RagProxyModule | ✅ Existe | `app/backend/src/modules/rag-proxy/` |
| RAG Service Python | ✅ Existe | `/opt/automecanik/rag/` |
| Knowledge corpus | ✅ 14 docs | `/opt/automecanik/rag/knowledge/` |
| Weaviate | ⚠️ A verifier | Docker service |
| Frontend ChatWidget | ⚠️ A verifier | Frontend |

### Flux

```
Frontend → /api/rag/chat → RagProxyService → RAG Python (port 8000)
                                    ↓
                            Weaviate (embeddings)
                                    ↓
                            /rag/knowledge/ (14 docs)
```

---

## Conformite Spec vs Realite

### Format des fichiers knowledge

| Champ | rag-system.md (Spec) | Realite | Status |
|-------|---------------------|---------|--------|
| title | ✅ Requis | ✅ Present | OK |
| source_type | ✅ Requis | ✅ Present | OK |
| category | ✅ Requis | ✅ Present | OK |
| updated_at | ✅ Requis | ✅ Present | OK |
| **truth_level** | ✅ Requis (L1-L4) | ❌ Absent | **GAP** |
| **verification_status** | ✅ Requis | ❌ Absent | **GAP** |

### Exemple actuel (incomplet)

```yaml
---
title: "FAQ - Livraison"
source_type: faq
category: livraison
updated_at: 2026-01-01
# MANQUANT: truth_level: L1
# MANQUANT: verification_status: verified
---
```

---

## Problemes Identifies

### P1. Champs frontmatter manquants (MOYEN)

- **Impact**: Truth Levels L1-L4 non appliques
- **Cause**: Fichiers crees sans champs requis
- **Solution**: Ajouter `truth_level` et `verification_status` aux 14 fichiers

### P2. Dossier app/knowledge vide (BAS)

- **Impact**: Confusion sur emplacement corpus
- **Cause**: Deux dossiers knowledge (app/ et rag/)
- **Solution**: Supprimer `app/knowledge/` ou synchroniser

### P3. Service RAG non verifie (MOYEN)

- **Impact**: Incertain si service repond
- **Solution**: Tester `RAG_SERVICE_URL` et Weaviate

### P4. Gating frontend non confirme (MOYEN)

- **Impact**: Reponses basse confiance peuvent passer
- **Solution**: Verifier implementation `confidence < 0.70 = blocage`

---

## Recommandations

### Immediat (P0)

1. **Ajouter champs manquants** aux 14 fichiers knowledge :
   ```yaml
   truth_level: L1  # ou L2
   verification_status: verified
   ```

2. **Verifier service RAG** :
   ```bash
   curl -X GET http://localhost:8000/health -H "X-API-Key: $RAG_API_KEY"
   ```

### Court terme (P1)

3. **Nettoyer dossiers** :
   - Supprimer `app/knowledge/` (vide, inutile)
   - Documenter que le corpus est dans `rag/knowledge/`

4. **Verifier gating frontend** :
   - Confirmer filtrage `confidence < 0.70`

### Moyen terme (P2)

5. **Enrichir corpus** :
   - Ajouter plus de FAQ (objectif: 50+ docs)
   - Ajouter guides d'achat par gamme

---

## Metriques

| Metrique | Actuel | Cible |
|----------|--------|-------|
| Documents corpus | 14 | 50+ |
| Champs conformes | 4/6 (67%) | 6/6 (100%) |
| Truth Levels actifs | Non | Oui |
| Gating frontend | A verifier | Actif |

---

## Prochaines etapes

1. [x] Identifier corpus RAG (14 docs dans rag/knowledge/)
2. [ ] Ajouter truth_level + verification_status aux 14 fichiers
3. [ ] Tester connexion service RAG
4. [ ] Verifier gating frontend
5. [ ] Supprimer app/knowledge/ (vide)
