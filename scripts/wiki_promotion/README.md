# wiki-promotion — Pipeline déterministe raw → proposal

Pipeline Python qui transforme une **URL web** en **proposal markdown frontmatter v1.0.0**
prête à atterrir dans `automecanik-wiki/proposals/<slug>.md`. Aucune écriture dans le wiki canon,
aucune base de données, aucun LLM.

Référence : [ADR-059 SEO Runtime Projection](https://github.com/ak125/governance-vault/blob/main/ledger/decisions/adr/ADR-059-seo-runtime-projection.md) — Phase B PR-3a.

## Chaîne d'extraction

```
URL → Playwright capture → automecanik-raw/sources/web-corpus/<date>/<sha256>.html
                                                                          + .manifest.yaml
       ↓
       extract-claims (déterministe local, 0 LLM)
         1. Schema.org JSON-LD direct lift (Product / Article / FAQPage / BreadcrumbList)
         2. Readability (article body + titre sémantique)
         3. Trafilatura (texte propre, boilerplate stripped, favor_precision)
         4. DOM selectors typés (meta[name=description], og:title, h1)
       ↓ claims.yaml
       build-source-map (claims indexés par claim_id avec provenance)
       ↓ source_map.yaml
       render-proposal (frontmatter v1.0.0 validé canon)
       ↓
       automecanik-wiki/proposals/<slug>.md     ← seule destination autorisée
```

## Garde-fous (vérifiés par tests statiques)

- **0 LLM** : aucun import `anthropic` / `openai` / `groq` / `cohere` / `mistralai` / `google.generativeai`
- **0 DB** : aucun import `psycopg` / `asyncpg` / `supabase` / `sqlalchemy` / `django`
- **0 écriture wiki canon** : `render_proposal._refuse_wiki_canon_write()` lève
  `ClickException` si target est sous `wiki/<entity_type>/`. Seule `proposals/` (ou
  chemin hors `wiki_root`) est acceptée.

## Installation

```bash
cd /opt/automecanik/app/scripts/wiki_promotion
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python3 -m playwright install chromium
```

## Usage end-to-end (pilote `gamme:filtre-a-huile`)

```bash
# 1. Capture web (content-addressed storage)
python3 -m scripts.wiki_promotion.capture_web_to_raw \
  --url https://www.example.com/filtre-a-huile \
  --raw-root /opt/automecanik/automecanik-raw \
  --trust-level 2_medium_concordant

# 2. Extraction claims (déterministe local)
python3 -m scripts.wiki_promotion.extract_claims \
  --raw-html /opt/automecanik/automecanik-raw/sources/web-corpus/2026-05-13/<hash>.html \
  --out /tmp/claims.yaml

# 3. Build source map
python3 -m scripts.wiki_promotion.build_source_map \
  --claims /tmp/claims.yaml \
  --entity-type gamme \
  --slug filtre-a-huile \
  --title "Filtre à huile" \
  --out /tmp/source_map.yaml

# 4. Render proposal (écrit dans wiki/proposals/, JAMAIS wiki/<entity_type>/)
python3 -m scripts.wiki_promotion.render_proposal \
  --source-map /tmp/source_map.yaml \
  --wiki-root /opt/automecanik/automecanik-wiki
```

## Tests

```bash
cd /opt/automecanik/app
pytest tests/wiki_promotion/ -v
```

Couverture (23 tests) :
- Models : round-trip Pydantic, patterns enforcés, validation Hypothesis property-based
- Extract claims : JSON-LD direct lift, DOM selectors fallback, zero-content rejection, garde-fou no-LLM-import
- Build source map : projection 1:1, YAML round-trip Hypothesis-property-tested
- Render proposal : 11 champs requis v1.0.0, garde-fou wiki canon refusal, garde-fou no-LLM/no-DB

## Hors scope PR-3a (Phase B, ADR-059)

- PR-3b wiki repo : bridge `recycle-from-rag.py` ↔ ce pipeline
- PR-4 : 5 wrappers de quality gates (`source/claim/contradiction/risk/confidence`)
- PR-5a/5b : exports SEO JSON builder + cron systemd timer
- PR-6 : projection DB versionnée (7 tables + 2 MVs CONCURRENT REFRESH + 2 queues BullMQ + replay_projection.py)
- PR-7 : RPC `get_active_seo_projection` + adapter pages + guards depcruise/ast-grep

Ces composants attendent l'instruction explicite séparée (`go Phase B PR-N`).
