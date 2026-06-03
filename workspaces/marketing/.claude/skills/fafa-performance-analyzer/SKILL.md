---
name: fafa-performance-analyzer
description: Use weekly after 10+ videos published to analyze workspaces/marketing/fafa-media-factory/manifests/metrics/video-performance.csv and recommend the next batch (which patterns/hooks/gammes to repeat, which to drop). Triggers — "analyse perf vidéo Fafa", "next batch recommandation", "verdict V2 GO/NO-GO".
---

# Fafa Performance Analyzer — Skill

> Lit le CSV V1 (`manifests/metrics/video-performance.csv`) et recommande le prochain batch. Triggers verdict GO/NO-GO V2 après 1 semaine de mesure.

## Quand invoquer

- J+7 après publication des 10 pilotes V1
- Hebdomadairement post-V1 si V2 lancé (batchs 11-20, etc.)
- Sur demande owner pour pré-arbitrage avant prochaine campagne

## Pré-requis

- Au moins 10 lignes de pilotes publiés dans le CSV (V1 stop)
- Colonnes runtime remplies : `vues`, `retention_3s`, `retention_50`, `clics`, `sessions`, `add_to_cart`
- Owner a renseigné `commentaires_utiles` (comptage manuel)

## KPI thresholds V1

| KPI | Seuil minimum (PASS) | Seuil idéal (STRONG) |
|---|---|---|
| `retention_3s` | ≥ 50% | ≥ 70% |
| `retention_50` | ≥ 20% | ≥ 35% |
| `clics` / `vues` | ≥ 0.5% | ≥ 2% |
| `add_to_cart` / `sessions` | ≥ 1% | ≥ 5% |
| `commentaires_utiles` | ≥ 2 par vidéo | ≥ 10 par vidéo |

## Analyse pattern repeatability

Pour chaque hook / format / gamme :
- STRONG sur ≥2 vidéos → **REPEAT** (refaire pattern, varier angle)
- PASS sur 1 vidéo → **TEST_ONE_MORE** (1 itération pour confirmer)
- FAIL → **DROP** (ne pas refaire le pattern V2)

## Verdict V2 GO/NO-GO

| Condition | Verdict |
|---|---|
| ≥3 vidéos STRONG + 0 violation gouvernance | **GO_V2** (autoriser scope V2 : backend recâblage, 3 templates supplémentaires, batchs 20+) |
| 1-2 vidéos STRONG + reste PASS | **CONTINUE_V1** (refaire 10 pilotes avec patterns gagnants, ne pas scaler) |
| 0 vidéo STRONG | **REWORK** (réviser persona Fafa, formats, scripts) |
| ≥1 violation gouvernance post-publication | **HOLD** (audit incident avant tout V2) |

## Workflow

1. Lire CSV `manifests/metrics/video-performance.csv`
2. Vérifier complétude (10 lignes V1, KPIs runtime renseignés)
3. Agréger par hook / format / gamme
4. Comparer aux thresholds
5. Sortir rapport + recommandation next batch
6. Update CSV `notes` colonne avec verdict per vidéo

## Output (rapport)

```json
{
  "skill": "fafa-performance-analyzer",
  "analyzed_at": "2026-06-04",
  "videos_count": 10,
  "verdict_v2": "GO_V2|CONTINUE_V1|REWORK|HOLD",
  "strong_videos": ["fafa-vanne-egr-001", "fafa-perte-puissance-001"],
  "fail_videos": ["fafa-batterie-001"],
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
      "reason": "retention_3s 28% (< seuil 50%)"
    }
  ],
  "next_batch_size": 10,
  "v2_unlock_criteria_met": false
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
