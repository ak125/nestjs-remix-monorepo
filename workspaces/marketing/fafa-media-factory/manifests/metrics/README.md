# Metrics — CSV V1 only

> **MVP V1 — outil de saisie/export temporaire, PAS source de vérité.**

## Pourquoi CSV en V1

V1 = 10 pilotes pour valider la chaîne éditoriale. À cette échelle :
- Aucune table DB justifiée (overkill)
- Aucun dashboard automatisé (premature)
- Owner remplit manuellement après publication (J+7 minimum)

Pour V1, ce CSV est suffisant. Pour V2+ (volume scalé), migration obligatoire vers :
- Table Supabase `__video_kpi_*` (avec RLS admin-only)
- OU manifest JSON structuré par vidéo dans `manifests/metrics/<video_id>.json`

## Colonnes V1

| Colonne | Type | Notes |
|---|---|---|
| `video_id` | string | FK vers `scripts/published/<video_id>/` |
| `plateforme` | enum | tiktok / instagram_reels / youtube_shorts / facebook_reels |
| `format` | enum | ne-change-pas-trop-vite / symptome-3-causes / piece-expliquee |
| `gamme` | string | slug gamme AutoMecanik |
| `hook` | string | premiers 80 chars du hook (pour analyse pattern) |
| `duree_sec` | int | durée finale rendue |
| `url_cible` | string | URL canonique promue |
| `date_publication` | date | YYYY-MM-DD |
| `vues` | int | snapshot J+7 |
| `retention_3s` | float | % audience à 3 secondes |
| `retention_50` | float | % audience à 50% durée |
| `clics` | int | clics sortants vers `url_cible` (UTM) |
| `sessions` | int | sessions GA4 attribuables UTM |
| `add_to_cart` | int | événements ATC GA4 attribuables |
| `commentaires_utiles` | int | comptage manuel commentaires avec vrai symptôme/question |
| `notes` | string | free-form observations owner |

## Workflow

1. Owner publie vidéo manuellement avec UTM (`utm_source=fafa&utm_medium=video&utm_campaign=<video_id>`)
2. J+7 minimum : owner remplit ligne CSV depuis :
   - Plateforme native (vues, retention)
   - GA4 (clics, sessions, ATC via UTM)
   - Comptage manuel (commentaires utiles)
3. Skill `fafa-performance-analyzer` lit CSV → recommande next batch

## Anti-régression

- **NE PAS** transformer ce CSV en SoT permanente
- **NE PAS** y stocker plus de 30-50 lignes (migration V2 obligatoire au-delà)
- **NE PAS** y mettre de données sensibles (UTM publics OK, PII NON)
- **NE PAS** automatiser ingestion depuis ce CSV vers DB (architecture V2 dédiée)
