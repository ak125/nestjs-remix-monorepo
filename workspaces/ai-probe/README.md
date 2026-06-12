# AI Probe — workspace

Probe manuelle mensuelle de présence/citation AutoMecanik dans les LLMs grand public.
**Zéro API payant. Zéro infra. ~1h/mois.**

## Pourquoi

Mesurer empiriquement la visibilité d'AutoMecanik dans les réponses des LLMs grand public, sans construire de plateforme. Cadence + volume calibrés pour rester soutenable (~1h/mois) et observable (CSV git-tracké).

Cf. spec `docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md` §4.3.
Cf. mémoires `[[project_a_b_c_surfaces_distinction]]`, `[[feedback_more_seo_engineering_not_equal_more_business]]`.

## Protocole mensuel

1. Dupliquer `template.csv` → `cycles/YYYY-MM.csv` (créer le dossier `cycles/` s'il n'existe pas)
2. Pour chaque ligne `prompt × provider` :
   - Ouvrir l'UI web du LLM (non-payant)
     - ChatGPT : <https://chat.openai.com>
     - Perplexity : <https://www.perplexity.ai>
     - Gemini : <https://gemini.google.com>
     - Claude : <https://claude.ai>
   - Coller le prompt
   - Remplir les colonnes du CSV :
     - `brand_mentioned` : `O` / `N`
     - `url_cited` : URL exacte si la réponse cite un lien automecanik.com (vide sinon)
     - `type_de_contenu_cite` : `R5` / `R3` / `R2` / `Local` / `Autre` (ou vide si pas de citation)
     - `concurrents_co_cites` : liste CSV des concurrents auto cités (Oscaro, Mister Auto, Autodoc, Norauto, Carter-Cash, etc.)
     - `sentiment` : `positif` / `neutre` / `négatif`
     - `source_vue` : URL de la source utilisée par le LLM si visible (Perplexity affiche les sources)
     - `gsc_present` : `O` / `N` (à comparer ensuite via GSC — workspace `seo-analytics`)
     - `notes` : observations libres
3. Commit le CSV signé du mois dans `cycles/YYYY-MM.csv`
4. Si signal AI-citation observable (≥1 url_cited automecanik.com sur le cycle), partager une note dans le digest hebdo.

## Cadence

**1×/mois.** Date cible : 1er lundi du mois. Volume cible : 10-20 prompts × 4 providers = 40-80 lignes.

## Source des prompts

Le registre canonique des prompts vit dans `prompts.yaml` (Task 1.7). Le template ci-dessous montre la structure CSV — les vrais prompts viennent de `prompts.yaml`.

## Hors-scope (V1)

- Pas d'API LLM payant (`feedback` user explicite : "pas de payant")
- Pas de scraping automatique
- Pas de dashboard
- Pas de moteur de scoring
- Pas d'auto-ingestion dans une DB
- Pas de notification automatique

## Quand re-évaluer

Quand 6 cycles consécutifs ont accumulé baseline AI-citation stable + au moins 1 trafic LLM-referrer mesuré dans GA4 → re-évaluer si une infra légère devient justifiée.

## Mémoires liées

- `[[project_a_b_c_surfaces_distinction]]`
- `[[feedback_more_seo_engineering_not_equal_more_business]]`
- `[[feedback_seo_is_not_the_product_acquisition_serves_conversion]]`
