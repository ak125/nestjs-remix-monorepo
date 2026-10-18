---
name: fafa-performance-analyzer
description: Use weekly after 10+ videos published to analyze workspaces/marketing/fafa-media-factory/manifests/metrics/video-performance.csv and recommend the next batch (which patterns/hooks/gammes to repeat, which to drop). Triggers — "analyse perf vidéo Fafa", "next batch recommandation", "verdict V2 GO/NO-GO".
---

# Fafa Performance Analyzer — Skill

> Lit le CSV V1 (`manifests/metrics/video-performance.csv`) et recommande le prochain batch. Propose à l'owner un verdict GO/NO-GO V2 après 1 semaine de mesure.

## Quand invoquer

- J+7 après publication des 10 pilotes V1
- Hebdomadairement post-V1 si V2 lancé (batchs 11-20, etc.)
- Sur demande owner pour pré-arbitrage avant prochaine campagne

## Pré-requis

- Au moins 10 lignes de pilotes publiés dans le CSV (V1 stop)
- Colonnes runtime remplies : `vues`, `retention_3s`, `retention_50`, `clics`, `sessions`, `add_to_cart`
- Owner a renseigné `commentaires_utiles` (comptage manuel)
- Le CSV est local : `*.csv` est ignoré par git (`.gitignore:211`), le fichier n'existe pas dans le dépôt et ne se lit que là où
  l'owner le tient. Le skill le lit sans le modifier.

## KPI thresholds V1

| KPI | Seuil minimum (PASS) | Seuil idéal (STRONG) |
|---|---|---|
| `retention_3s` | ≥ 50% | ≥ 70% |
| `retention_50` | ≥ 20% | ≥ 35% |
| `clics` / `vues` | ≥ 0.5% | ≥ 2% |
| `add_to_cart` / `sessions` | ≥ 1% | ≥ 5% |
| `commentaires_utiles` | ≥ 2 par vidéo | ≥ 10 par vidéo |

Avant de comparer aux seuils :

- Colonne vide ou absente → KPI **UNKNOWN**, jamais 0.
- Un taux n'est classé que si son dénominateur atteint 30 : `vues` pour les deux rétentions et `clics` / `vues`, `sessions`
  pour `add_to_cart` / `sessions`. En dessous → UNKNOWN, motif `insufficient_sample`. 30 est le plancher par groupe
  d'`experimentReport` (`backend/src/modules/marketing/services/marketing-measurement.ts:261`), repris ici plutôt qu'un seuil local.
- `clics` / `vues` et `add_to_cart` / `sessions` sont rapportés avec numérateur, dénominateur et intervalle de Wilson à 95 %,
  calculé comme dans `experimentReport` (l.283-301). Les rétentions sont reprises telles que la plateforme les affiche, avec `vues`.
- Un KPI UNKNOWN ne compte ni comme PASS, ni comme STRONG, ni comme FAIL.

## Analyse pattern repeatability

Pour chaque hook / format / gamme :
- STRONG sur ≥2 vidéos → **REPEAT** (refaire pattern, varier angle)
- PASS sur 1 vidéo → **TEST_ONE_MORE** (1 itération pour confirmer)
- FAIL → **DROP** (ne pas refaire le pattern V2)

Comparaison observationnelle : d'une vidéo à l'autre, hook, format, gamme et plateforme changent ensemble, sans répartition ni
témoin. REPEAT, TEST_ONE_MORE et DROP sont des hypothèses pour le lot suivant, jamais une cause ni un gagnant (`experimentReport` :
`winner: null`, `causal_claim: false`). Tester une accroche exige une répartition (`assignExperiment`, même fichier, l.231-250).

## Verdict V2 GO/NO-GO

| Condition | Verdict |
|---|---|
| ≥3 vidéos STRONG + 0 violation gouvernance | **GO_V2** (proposer à l'owner le scope V2 : backend recâblage, 3 templates supplémentaires, batchs 20+) |
| 1-2 vidéos STRONG + reste PASS | **CONTINUE_V1** (refaire 10 pilotes avec les patterns REPEAT, ne pas scaler) |
| 0 vidéo STRONG | **REWORK** (réviser persona Fafa, formats, scripts) |
| ≥1 violation gouvernance post-publication | **HOLD** (audit incident avant tout V2) |
| Aucune condition ci-dessus n'est établie sans un KPI UNKNOWN | **UNKNOWN** (mesure insuffisante ; ni REWORK, ni CONTINUE_V1) |

Le verdict est une proposition remise à l'owner. Le skill n'autorise aucun scope : le passage en V2 est une décision de l'owner,
et toute activation runtime suit son propre circuit (drapeau, PR, revue).

## Workflow

1. Lire CSV `manifests/metrics/video-performance.csv`
2. Vérifier complétude (10 lignes V1, KPIs runtime renseignés) ; colonne vide → UNKNOWN
3. Agréger par hook / format / gamme
4. Comparer aux thresholds
5. Sortir rapport + recommandation next batch
6. Écrire le verdict par vidéo dans le rapport ; le CSV reste en lecture seule (la colonne `notes` est celle de l'owner)

## Output (rapport)

```json
{
  "skill": "fafa-performance-analyzer",
  "analyzed_at": "2026-06-04",
  "videos_count": 10,
  "verdict_v2": "GO_V2|CONTINUE_V1|REWORK|HOLD|UNKNOWN",
  "strong_videos": ["fafa-vanne-egr-001", "fafa-perte-puissance-001"],
  "fail_videos": ["fafa-batterie-001"],
  "unknown_kpis": [
    {
      "video_id": "fafa-thermostat-001",
      "kpi": "add_to_cart / sessions",
      "reason": "insufficient_sample",
      "denominator": 12
    }
  ],
  "repeat_patterns": [
    {
      "pattern": "ne-change-pas-trop-vite + vanne-egr",
      "score": "STRONG",
      "recommendation": "refaire avec angle 'symptômes hivernaux'"
    }
  ],
  "drop_patterns": [
    {
      "pattern": "symptome-3-causes + bruit-démarrage",
      "score": "FAIL",
      "reason": "retention_3s 28 % sur 1 450 vues (< seuil 50 %)"
    }
  ],
  "next_batch_size": 10,
  "v2_unlock_criteria_met": false,
  "causal_claim": false,
  "attribution_is_not_incrementality": true
}
```

## Anti-régression V1

- **NE PAS** prendre de décision V2 sur <7 jours de mesure
- **NE PAS** dépasser 10 pilotes V1 (stop strict)
- **NE PAS** auto-publier le batch suivant (owner GO obligatoire chaque batch)
- **NE PAS** transformer ce CSV en SoT permanente (V2 obligatoire si >30 lignes)

## Voir aussi

- `workspaces/marketing/fafa-media-factory/manifests/metrics/video-performance.csv`
- `workspaces/marketing/fafa-media-factory/manifests/metrics/README.md`
- `[[creative-pattern-extractor]]` (input next batch)
- `[[fafa-script-generator]]` (génération next batch)
