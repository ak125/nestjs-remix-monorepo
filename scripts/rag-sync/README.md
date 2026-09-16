# scripts/rag-sync/

Sync `automecanik-wiki/exports/rag/` → `automecanik-rag/knowledge/` (mirror read-only).

> Pipeline canon (ADR-031 §D20) :
> `automecanik-wiki/exports/rag/` → **`scripts/rag-sync/`** (CI workflow) → `automecanik-rag/knowledge/` (mirror).

## Scripts hébergés

- `sync-wiki-exports-to-rag.py` (anciennement `scripts/rag/sync-from-wiki.py`) — sync idempotent sha256, refuse toute source autre que `wiki/exports/rag/` (garde D20 enforcement). Mode `--dry-run` par défaut, `--apply` explicite.

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

## Référence

- ADR-031 §D20 — sync-from-wiki STRICT lit `wiki/exports/rag/` ONLY
- Plan v3 §Étape 5 Groupe C + §Étape 7 (workflow CI)

## Contrat de provenance et de fraîcheur

Le chemin source doit appartenir à `exports/rag/` du dépôt passé par `--wiki-repo`.
Les chemins résolus des fichiers sont vérifiés avant toute copie ; un lien symbolique
sortant du dépôt est refusé. Une source absente ou vide produit un échec observable.
Un échec de copie conserve la date du dernier succès ; un échec d'écriture du manifest
fait échouer la commande. Les fichiers déjà identiques restent inchangés.

Le cron exige une source WIKI sur `main` avant de mettre à jour le miroir. Un checkout
de travail doit être conservé et une source de synchronisation conforme préparée
séparément. Ce contrôle ne reconstruit pas les exports et ne prouve pas leur fraîcheur
par rapport aux fiches WIKI ; cette validation reste une étape distincte.

Tests hors réseau et hors corpus réel :

```bash
python3 scripts/rag-sync/test_sync_wiki_exports_to_rag.py
```

Le contrôle préalable compare aussi le périmètre complet des exports aux fichiers
Markdown/JSON du miroir. Un fichier miroir absent de la source fait échouer la
synchronisation avec `UNRECONCILED`, avant toute copie et sans avancer le dernier
succès. Le fichier reste intact : son absence n'autorise pas une suppression.
Un sous-dossier source ou un lien symbolique côté miroir est également refusé.
Ce contrôle révèle les retraits non réconciliés ; il ne propage ni suppression
Weaviate, ni invalidation DB/SEO, ni retrait de page publique.
