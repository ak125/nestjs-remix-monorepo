# SEO Vault Verify — Eval Workspace

> Mesures de calibration trigger pour le skill `seo-vault-verify` v1.0.

## Objectif

Mesurer le taux de déclenchement (trigger rate) du skill avec différentes formulations de la `description` frontmatter, sur un panel de 16 queries réalistes (8 should-trigger, 8 should-not-trigger), via `claude -p` (CLI Claude Code).

## Méthode

- Outil : `skill-creator/scripts/run_eval.py`
- Modèle : `claude-sonnet-4-6`
- Runs par query : 3 (mesure stable approchée)
- Workers parallèles : 4
- Eval set : `.claude/skills/seo-vault-verify/evals/trigger-eval-set.json`

## Résultats

### BASELINE — description v1.0 (~860 chars)

| Métrique | Valeur |
|----------|--------|
| Accuracy | 10/16 (62%) |
| Recall | 2/8 (25%) |
| Precision | 100% (0 FP) |
| Avg trigger rate (positives) | 29% |
| Avg trigger rate (negatives) | 0% |

### IMPROVED — description v1.1 (~1408 chars, +keywords FR slang "coffre", "consultant", "freelance", "batches templates")

| Métrique | Valeur |
|----------|--------|
| Accuracy | 9/16 (56%) |
| Recall | 1/8 (12%) |
| Precision | 100% (0 FP) |
| Avg trigger rate (positives) | 21% |

## Décision : reverter à v1.0

L'augmentation du nombre de keywords + la longueur de la description **n'améliore pas** le trigger rate (régression ou stagnation au sein de la variance).

Hypothèse : description plus longue = plus spécifique au yeux de Claude = moins susceptible de matcher les queries génériques. La règle "Claude only consults skills for tasks it can't easily handle on its own" (cf. `skill-creator/SKILL.md`) plafonne le recall sur les queries conversationnelles, indépendamment du wording.

## Constats

- **Précision parfaite** (100%, 0 FP) sur les 8 négatives, peu importe la description : pas de risque de déclenchement intempestif sur audit gamme, content-audit, governance-vault, etc.
- **Recall limité** (~25%) sur queries narratives — Claude estime souvent pouvoir répondre directement sans skill. Limite inhérente du système, pas du wording.
- **Variance run-to-run élevée** avec 3 runs/query — un run peut donner 12/16, un autre 10/16 sur la même description (stochasticité du modèle).

## Recommandations

1. **Garder description v1.0** courte et lisible (cf. SKILL.md actuel)
2. Pour augmenter le trigger rate effectif sans toucher la description :
   - Appel explicite via slash command : `/seo-vault-verify <path>` (recall = 100%)
   - Documentation utilisateur : énoncer clairement qu'un vault Obsidian SEO doit être audité avec ce skill
3. Pour mesures futures :
   - Augmenter à 5+ runs/query pour réduire la variance (coût ~2× appels claude -p)
   - Élargir l'eval set à 30-40 queries pour signal statistique robuste

## Reproduire

```bash
export PATH="/home/deploy/.vscode-server/.vscode-server/extensions/anthropic.claude-code-2.1.120-linux-x64/resources/native-binary:$PATH"
SC=/home/deploy/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator
cd $SC

python3 -m scripts.run_eval \
  --eval-set /opt/automecanik/app/.claude/skills/seo-vault-verify/evals/trigger-eval-set.json \
  --skill-path /opt/automecanik/app/.claude/skills/seo-vault-verify \
  --runs-per-query 5 \
  --num-workers 4 \
  --model claude-sonnet-4-6
```

## Layout

```
.claude/skills/seo-vault-verify-workspace/
├── README.md                          (ce fichier)
├── trigger-eval-baseline/
│   └── results.json                   (description v1.0)
└── trigger-eval-improved/
    └── results.json                   (description v1.1, reverted)
```
