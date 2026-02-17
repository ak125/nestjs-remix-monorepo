# Truth Levels Reference

Guide d'attribution des niveaux de confiance pour le corpus RAG AutoMecanik.

---

## 4 Niveaux de Confiance

| Level | Label | Couleur | Description |
|-------|-------|---------|-------------|
| **L1** | Officiel | 🟢 Vert | Documents OEM, normes certifiees, rappels constructeurs |
| **L2** | Technique verifie | 🔵 Bleu | Guides techniques aftermarket verifies, docs internes |
| **L3** | Generique cure | 🟡 Ambre | Web cure, FAQ communaute, articles de qualite |
| **L4** | Non verifie | 🔴 Rouge | Forums, contenus bruts, sources non validees |

---

## Criteres d'Attribution

### L1 — Officiel

**Criteres :**
- Document OEM (constructeur automobile)
- Norme technique certifiee (ECE R90, ISO, NF)
- Bulletin de rappel officiel (RAPEX, NHTSA)
- Spec technique constructeur avec numero de reference

**Exemples :**
- Manuel d'atelier Renault pour Clio 3
- Norme ECE R90 (homologation plaquettes)
- Bulletin de rappel PSA ref. ABC-123

**Provenance requise :**
- `metadata.oem_doc_id` obligatoire
- `metadata.source_url` pointant vers source officielle
- `metadata.verified_by` avec nom du verificateur

**REGLE : JAMAIS assigner L1 sans verification de provenance OEM.**

### L2 — Technique verifie

**Criteres :**
- Guide technique aftermarket reconnu (Bosch, ATE, Brembo, Valeo, SKF)
- Brochure fabricant avec donnees techniques verifiables
- Documentation interne AutoMecanik verifiee par l'equipe technique
- Catalogues TecDoc avec references croisees

**Exemples :**
- Brochure Bosch freinage FAD 2020
- Guide technique ATE plaquettes ceramiques
- Fiche gamme AutoMecanik "disque-de-frein.md" (verifiee)

**Provenance :**
- `metadata.verified_by` recommande
- `metadata.source_url` ou `metadata.source_ref`

**Defaut pour ingestion PDF.**

### L3 — Generique cure

**Criteres :**
- Article web de source reputee (magazine auto, site specialise)
- FAQ communaute moderee
- Contenu analyse et cure par l'equipe
- Informations generales coherentes mais non verificables unitairement

**Exemples :**
- Article Oscaro "Comment choisir ses plaquettes"
- Guide vroomly.com sur l'entretien
- FAQ AutoMecanik generee

**Formulation requise dans le contenu :**
- Utiliser des formulations conditionnelles ("selon le modele", "generalement")
- Ne pas citer comme fait absolu

**Defaut pour ingestion Web.**

### L4 — Non verifie

**Criteres :**
- Forum automobile sans moderation technique
- Post utilisateur non verifie
- Contenu brut avant curation
- Source inconnue ou douteuse

**Exemples :**
- Post forum-auto.com sans verification
- Commentaire YouTube sur le freinage
- Document sans source identifiable

**Restrictions :**
- NE PAS utiliser directement dans le contenu SEO
- NE PAS citer sans qualification ("source non verifiee")
- Utilisation uniquement pour enrichissement futur apres verification

---

## Regles d'Upgrade / Downgrade

| Action | Condition | Nouveau level |
|--------|-----------|---------------|
| Upgrade L3 → L2 | Contenu verifie par l'equipe technique + source identifiee | L2 |
| Upgrade L4 → L3 | Contenu cure + modere + coherent avec L1/L2 | L3 |
| Downgrade L2 → L3 | Source non retrouvable + pas de verification recente | L3 |
| Downgrade L2 → L4 | Contenu contredit par une source L1 | L4 |
| Downgrade L3 → L4 | Information erronee detectee | L4 |

**REGLE : On ne downgrade JAMAIS L1.** Si un L1 est errone, signaler pour retrait complet.

---

## Mapping Truth Level → Actions

| truth_level | verification_status | Action redactionnelle |
|-------------|--------------------|-----------------------|
| L1 | verified | Fait dur — citer directement sans qualification |
| L2 | verified | Confirme — citer directement |
| L2 | draft | Utilisable avec prudence, verifier coherence |
| L3 | verified | Cure — formulation conditionnelle requise |
| L3 | draft | Prudent — verifier avant utilisation |
| L3/L4 | pending | **REJETER** — traiter comme non-confirme |
| L4 | * | **NE PAS utiliser** dans le contenu public |

---

## Valeurs par Defaut dans le Code

| Context | Default | Source |
|---------|---------|--------|
| PDF ingestion | `L2` | `pdf-ingest.dto.ts` → `truthLevel.default('L2')` |
| Web ingestion | `L3` | `web-ingest.dto.ts` → `truthLevel.default('L3')` |
| Manuel (sans precision) | `L3` | Regle conservative |

---

## Requetes de Verification

```sql
-- Distribution des truth levels dans le corpus
SELECT truth_level, COUNT(*) AS total,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) AS pct
FROM __rag_knowledge
GROUP BY truth_level
ORDER BY truth_level;

-- Documents L4 (a surveiller)
SELECT id, title, domain, category, created_at
FROM __rag_knowledge
WHERE truth_level = 'L4'
ORDER BY created_at DESC;

-- Documents sans truth_level (anomalie)
SELECT id, title, domain
FROM __rag_knowledge
WHERE truth_level IS NULL OR truth_level = '';
```

Toutes les requetes via MCP Supabase (project: `cxpojprgwgubzjyqzmoq`).
