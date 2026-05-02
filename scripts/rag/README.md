# scripts/rag/ — Legacy, en cours de réorganisation (plan v3 ADR-031)

> **Réorganisation 2026-05-03** : ce dossier est en cours de découpage thématique
> selon le plan v3 (`/home/deploy/.claude/plans/je-comprend-rien-a-spicy-reddy.md`).
> Les scripts ont migré vers les sous-dossiers qui correspondent à leur rôle dans
> le pipeline ADR-031 (raw → wiki → wiki/exports/rag → rag).

## Migrations 2026-05-03

| Avant | Maintenant |
|---|---|
| `scripts/rag/build-brand-rag.py` | [`scripts/wiki-generators/brand-fiche-generator.py`](../wiki-generators/) |
| `scripts/rag/rag-enrich-from-web-corpus.py` | [`scripts/wiki-generators/gamme-from-web-corpus-generator.py`](../wiki-generators/) |
| `scripts/rag/enrich-rag-bulk.py` | [`scripts/wiki-generators/gamme-from-db-template-generator.py`](../wiki-generators/) |
| `scripts/rag/download-oem-corpus.py` | [`scripts/raw-downloaders/download-oem-corpus.py`](../raw-downloaders/) |
| `scripts/rag/download-brand-oem-corpus.py` | [`scripts/raw-downloaders/download-brand-oem-corpus.py`](../raw-downloaders/) |
| `scripts/rag/sync-from-wiki.py` | [`scripts/rag-sync/sync-wiki-exports-to-rag.py`](../rag-sync/) |

## Scripts restant ici (legacy, non classifiés)

- `ingest-oem-enriched-gammes.py` — ingester legacy via API `/api/rag/internal/ingest/manual`. Lit `gammes/*.md` avec bloc `phase5_enrichment`. Pas dans la classification du plan v3 (ce n'est ni générateur, ni exporter, ni sync). À déprécier ou reclasser en `scripts/api-clients/` lors d'un prochain chantier.

## Suite (plan v3)

- §Étape 5 commit suivant : redirection OUTPUT path des wiki-generators vers `automecanik-wiki/exports/rag/<cat>/`.
- §Étape 6 : régénération via générateurs refactorisés.
- §Étape 7 : workflow CI sync activé.
- §Étape 8 : cleanup legacy contenu rag/knowledge/.

## Référence

- ADR-031 — Raw / Wiki / RAG / SEO Separation
- Plan v3 — `/home/deploy/.claude/plans/je-comprend-rien-a-spicy-reddy.md`

---

## Historique (Phase F — 2026-04-04, hors-scope ce refactor)

Les 3 scripts qui formaient le pipeline Phase F (`download-oem-corpus.py`,
`rag-enrich-from-web-corpus.py`, `ingest-oem-enriched-gammes.py`) sont
désormais répartis : le 1er dans `raw-downloaders/`, le 2e dans
`wiki-generators/`, le 3e reste ici. Le wrapper
`/opt/automecanik/rag/scripts/pipeline/run-phase-f.sh` doit être mis à jour
pour pointer les nouveaux paths (à faire dans une PR séparée si encore utilisé).
