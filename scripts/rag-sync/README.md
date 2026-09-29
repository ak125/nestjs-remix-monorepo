# scripts/rag-sync/

Sync `automecanik-wiki/exports/rag/` → `automecanik-rag/knowledge/` (mirror read-only).

> Pipeline canon (ADR-031 §D20) :
> `automecanik-wiki/exports/rag/` → **`scripts/rag-sync/`** (CI workflow) → `automecanik-rag/knowledge/` (mirror).

## Scripts hébergés

- `sync-wiki-exports-to-rag.py` (anciennement `scripts/rag/sync-from-wiki.py`) — sync idempotent sha256, refuse toute source autre que `wiki/exports/rag/` (garde D20 enforcement). Mode simulation par défaut, `--apply` explicite.

## Invocation

Manuel (DEV) :
```bash
python3 scripts/rag-sync/sync-wiki-exports-to-rag.py \
  --wiki-repo /opt/automecanik/automecanik-wiki \
  --rag-repo  /opt/automecanik/rag \
  --apply
```

CI workflow (plan v3 §Étape 7, à activer) :
- Trigger : push sur `automecanik-wiki/main` qui modifie `exports/rag/**`
- Action : `repository_dispatch` vers `automecanik-rag` qui exécute le sync
- Commit auto sur `automecanik-rag/main` avec marker `synced-from-wiki: <wiki-sha>`

## Intégrité des écritures

Chaque document est copié dans un emplacement temporaire sur le même système de
fichiers, puis remplace sa destination par renommage atomique. Une erreur pendant
la copie ou le remplacement laisse l’ancienne version intacte; un nouveau document
n’est visible qu’une fois sa copie terminée. Les métadonnées du fichier source
restent conservées. Le manifeste `.last-sync.json` suit le même principe et
conserve ses permissions existantes.

Les fichiers temporaires portent une extension `.tmp`, hors du corpus `.md`/`.json`,
et sont nettoyés à la sortie du bloc, y compris en cas d’erreur gérée. Le mode
simulation ne crée ni fichier temporaire ni manifeste. Une erreur reste un code
retour non nul et n’avance pas la date du dernier succès.

Cette garantie porte sur chaque fichier. Elle ne constitue pas une transaction
sur le corpus entier : si un fichier ultérieur échoue, les fichiers précédents
peuvent déjà avoir été remplacés. L’instantané cohérent du corpus et la concurrence
avec les lecteurs restent à traiter séparément. Le script ne supprime pas les
exports retirés ni les fichiers non réconciliés.

Validation hors ligne :
```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s scripts/rag-sync -p 'test_sync_wiki_exports_to_rag.py' -v
```

## Référence

- ADR-031 §D20 — sync-from-wiki STRICT lit `wiki/exports/rag/` ONLY
- Plan v3 §Étape 5 Groupe C + §Étape 7 (workflow CI)
