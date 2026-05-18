# Phase 1b — Vérification RAG (obligatoire si le sujet est une pièce/gamme)

> Référencée depuis `SKILL.md` (Phase 1b). Workflow 4 étapes pour vérifier le corpus RAG avant rédaction.

Avant toute rédaction portant sur une pièce automobile, exécuter ce workflow en 4 étapes :

## Étape 1 — Récupérer le knowledge doc

Construire le slug depuis le nom de la gamme : "Disque de frein" → `disque-de-frein`

```bash
# Recherche RAG avec role targeting (v2.5)
# {ROLE} selon page cible : R1_ROUTER, R3_GUIDE, R4_REFERENCE, R5_DIAGNOSTIC
curl -s -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "{nom_piece}", "limit": 5, "routing": {"target_role": "{ROLE}"}}' \
  | jq '.results[] | {title, truth_level, updated_at, confidence_score, primary_role, purity_score, chunk_kind, source_path, page_contract_id, media_slots_hint}'
```

**Décision selon les résultats :**

| Résultat | truth_level | verification_status | Action |
|----------|-------------|---------------------|--------|
| Doc trouvé | L1 | verified | Fait dur — utiliser directement, citer sans qualification |
| Doc trouvé | L2 | verified | Confirmé — utiliser directement |
| Doc trouvé | L2 | draft | Utilisable avec prudence, vérifier cohérence |
| Doc trouvé | L3 | verified | Curaté — formulation conditionnelle obligatoire |
| Doc trouvé | L3/L4 | draft/pending | **REJETER** — traiter comme non-confirmé |
| 0 résultats | — | — | Signaler l'absence, continuer avec données utilisateur/BDD. Ne rien inventer |

## Étape 2 — Extraire les règles du domaine (v4) / mechanical_rules (legacy)

Chaque knowledge doc gamme contient un frontmatter YAML avec des règles. Détecter la version du schema :

- **v4** : `rendering.quality.version === 'GammeContentContract.v4'` → lire `domain.*`
- **Legacy** (v1/v3) : lire `mechanical_rules.*` + `purchase_guardrails.*`

| Champ v4 | Champ legacy (fallback) | Usage dans la rédaction |
|----------|------------------------|------------------------|
| `domain.must_be_true` | `mechanical_rules.must_be_true` | Ces termes DOIVENT apparaître dans le contenu produit |
| `domain.must_not_contain` | `mechanical_rules.must_not_contain_concepts` | JAMAIS dans le contenu — confusion sémantique |
| `domain.confusion_with` | `mechanical_rules.confusion_with` | Générer un bloc "Ne pas confondre avec..." explicite |
| `domain.role` | `mechanical_rules.role_summary` | Seed pour le H1/intro — reformuler, ne pas copier verbatim |
| `domain.must_not_contain` | `purchase_guardrails.forbidden_terms` | Ajouter aux MOTS INTERDITS du contenu |
| *(v4: implicite si crossGammes)* | `purchase_guardrails.requires_vehicle` | Si true, inclure "vérifiez la compatibilité véhicule" |

**2 formats `confusion_with` (v4 = array uniquement, legacy = array ou map) :**

Format array (v4 + legacy) :
```yaml
confusion_with:
  - term: tambour de frein
    difference: Le tambour utilise des mâchoires internes...
```

Format map (legacy uniquement) :
```yaml
confusion_with:
  batterie:
    key_difference: L'alternateur recharge la batterie...
```

Traiter les deux formats : pour chaque entrée, générer un bloc "Ne pas confondre avec {terme}" dans le contenu.

## Étape 3 — Recherche complémentaire par section

Interroger la section correspondant au rôle de page cible :

```bash
# Recherche complementaire avec role targeting (v2.5)
# Enrichir la query avec des mots-cles de section selon le role cible :
# R6_GUIDE_ACHAT → "guide achat choix selection" (+ injecter template de guide-achat-role.md §7)
# R3_CONSEILS    → "entretien remplacement etapes" (+ injecter template de conseils-role.md §7)
# R4_REFERENCE   → "definition technique composants" (+ injecter concepts partages de r4-reference-role.md §8)
# R5_DIAGNOSTIC  → "symptomes diagnostic panne"
curl -s -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "{nom_piece} {section_keywords}", "limit": 5, "routing": {"target_role": "{ROLE}"}}' \
  | jq '.results[:3] | .[] | {title, truth_level, content, primary_role, chunk_kind}'
```

Consolider les résultats des étapes 1 et 3 pour constituer la base de rédaction.

## Étape 4 — Vérifier la fraîcheur (`updated_at`)

Vérifier le champ `updated_at` dans le frontmatter YAML du knowledge doc :

| Âge du doc | Statut | Action | Annotation |
|------------|--------|--------|------------|
| < 3 mois | Frais | Utiliser directement | Aucune |
| 3-6 mois | Acceptable | Vérifier cohérence | Ajouter date dans provenance |
| 6-12 mois | Stale | Pénalité -6 (STALE_SOURCE) | Annoter `[source datée de {mois}]`, proposer `/rag-ops ingest` |
| > 12 mois | Obsolète | NE PAS utiliser les données chiffrées | **STOP** : proposer `/rag-ops ingest` avant rédaction |
