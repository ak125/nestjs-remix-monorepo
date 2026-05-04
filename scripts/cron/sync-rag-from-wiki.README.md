# sync-rag-from-wiki cron — installation

ADR-031 §D20/D22 : `automecanik-rag/knowledge/` est un mirror read-only de
`automecanik-wiki/exports/rag/`. Cette automation tourne sur **DEV VPS uniquement**
(zéro PAT, zéro hosted runner — voir le knowledge entry vault
`rag-to-wiki-sot-pipeline-20260503.md`).

## Activation

Une seule ligne à ajouter au crontab DEV (`crontab -e`) :

```cron
# Sync rag/knowledge ← wiki/exports/rag/ (toutes les heures, ADR-031 §D20)
0 * * * * /opt/automecanik/app/scripts/cron/sync-rag-from-wiki.sh
```

## Vérification

```bash
# Première run manuelle (pour vérifier les credentials, paths, idempotence)
/opt/automecanik/app/scripts/cron/sync-rag-from-wiki.sh
tail -50 /var/log/automecanik/sync-rag-from-wiki.log

# Status post-run
cd /opt/automecanik/rag && git log --oneline -1
# attendu : "synced-from-wiki: <wiki-sha>" si changes, sinon HEAD inchangé
```

## Désactivation

Retirer la ligne du crontab. Le script est idempotent et ne tourne pas en
arrière-plan — il s'arrête naturellement.

## Pré-requis (déjà en place sur DEV VPS)

| Pré-requis | Vérification |
|---|---|
| Clone `/opt/automecanik/automecanik-wiki/` | `git remote -v` |
| Clone `/opt/automecanik/rag/` | idem |
| Deploy bot SSH key configurée pour push | `ssh -T git@github.com` |
| `python3` + dépendances `sync-wiki-exports-to-rag.py` (stdlib only) | `python3 -c "import hashlib, shutil, pathlib"` |
| `flock` pour le global lock | `which flock` |

## Pourquoi pas GitHub Actions

Cf. discussion architecturale dans le knowledge vault. Résumé :

- 3 clones git déjà locaux → re-checkout via runner = bricolage
- Deploy bot SSH key déjà active → PAT cross-repo = bricolage
- `python3` + stdlib disponibles → setup runner = bricolage
- Cron pattern éprouvé (`qa-audit-cron.sh`, `queue-health.sh`, `health-check.sh`,
  `disk-alert.sh`, `deploy-watcher.sh`) → cohérence > diversité

## Troubleshooting

| Symptôme | Cause probable | Fix |
|---|---|---|
| `ERROR: rag not on main` | Quelqu'un a checkout une branche dans `/opt/automecanik/rag/` | `git checkout main` dans le clone |
| `Another RAG operation active` | `run-phase-f.sh` ou autre opération rag tourne en parallèle | Attendre la fin (lock global `/tmp/rag-global.lock`) |
| Sync produit "No changes" alors qu'on attend des updates | Le contenu de `wiki/exports/rag/` n'a pas changé sur main | Vérifier `cd /opt/automecanik/automecanik-wiki && git log --oneline exports/rag/` |
| Push échoue sur 403/permission denied | Deploy bot SSH key pas dans `~/.ssh/authorized_keys` côté GitHub | Configurer la clé via Settings → Deploy keys |

## Référence

- ADR-031 — Raw / Wiki / RAG / SEO Separation
- Knowledge vault : `rag-to-wiki-sot-pipeline-20260503.md`
- Plan v3 : `/home/deploy/.claude/plans/je-comprend-rien-a-spicy-reddy.md`
