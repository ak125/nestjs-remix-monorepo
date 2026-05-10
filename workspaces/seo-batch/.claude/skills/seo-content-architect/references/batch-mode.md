# Mode Batch (multi-gammes)

> Référencée depuis `SKILL.md`. Utiliser pour traiter plusieurs gammes en série.

## Pré-check RAG (OBLIGATOIRE avant la boucle)

Pour chaque gamme cible, vérifier AVANT de lancer la rédaction :

```bash
# Pour chaque gamme, récupérer le knowledge doc via POST /api/rag/search (RAG v2.5)
# target_role = R3_GUIDE pour batch guide-achat (les conseils partagent le rôle R3)
curl -s -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "{nom_gamme}", "limit": 1, "routing": {"target_role": "R3_GUIDE"}}' \
  | jq '.results[0] | {title, truth_level, updated_at, primary_role, purity_score}'
```

**Critères de pré-qualification :**

| Critère | Seuil | Si échec |
|---------|-------|----------|
| Knowledge doc existe | Obligatoire | SKIP — "No knowledge doc" |
| `truth_level` | ≥ L2 | SKIP — "Low truth level (L3/L4)" |
| `updated_at` | < 6 mois | SKIP — "Stale source, `/rag-ops ingest` recommandé" |
| `domain.must_be_true` (v4) ou `mechanical_rules.must_be_true` (legacy) | Non vide | WARNING — "No domain rules, manual review needed" |

**Pré-requis supplémentaires si rôle = guide-achat :**

| Critère | Seuil | Si échec |
|---------|-------|----------|
| Champ `howToChoose` (RAG) | Non vide | SKIP — "Pas de données guide-achat (howToChoose manquant)" |
| Champ `antiMistakes` (RAG) | Non vide | WARNING — "antiMistakes vide, S5/S6 dégradés" |
| `sgpg_selection_criteria` (BDD) | ≥ 1 critère | WARNING — "Pas de critères sélection, S3 simplifié" |
| `sgpg_use_cases` (BDD) | ≥ 1 profil | WARNING — "Pas de use cases, S4 sans profils conducteur" |
| Word count cible | 600-900 mots | Ajuster si hors fourchette — voir `quality-scoring.md` |

## Workflow batch

1. **Pré-check** : pour chaque gamme cible, exécuter le pré-check RAG. Constituer PROCESS list et SKIP list
2. **Exécuter** : workflow 4 phases complet pour chaque gamme de la PROCESS list
3. **Variables template** : `{gamme}`, `{famille}`, `{pg_id}`, `{v_level}`, `{slug}`
4. **Gate qualité** : si score < 80 après Phase 4, marquer REVIEW (ne pas publier)

**Format de sortie batch :**

| Gamme | Slug | Score | Status | Sources | Issues |
|-------|------|-------|--------|---------|--------|
| disque de frein | disque-de-frein | 88 | OK | rag://gammes.disque-de-frein | — |
| plaquette de frein | plaquette-de-frein | 82 | OK | rag://gammes.plaquette-de-frein | mechanical_rules partielles |
| étrier de frein | etrier-de-frein | SKIP | — | — | truth_level L3, updated_at > 6 mois |
| flexible de frein | flexible-de-frein | 74 | REVIEW | rag://gammes.flexible-de-frein | score < 80, proposer `/content-audit` |

**Règles batch :**
- Ne jamais baisser la qualité pour aller plus vite — chaque gamme suit le workflow complet
- Signaler les gammes SKIP en fin de batch avec la raison + action recommandée
- Signaler les gammes REVIEW avec le score et les issues détectées
- Si > 30% des gammes sont SKIP : proposer `/rag-ops audit` pour vérifier la santé du corpus
