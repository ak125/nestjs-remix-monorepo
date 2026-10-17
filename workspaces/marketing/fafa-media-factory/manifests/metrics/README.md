# Metrics — CSV V1 only

> **MVP V1 — outil de saisie/export temporaire, PAS source de vérité.**
>
> `video-performance.csv` est ignoré par git (`*.csv`, `.gitignore:211`) : absent du dépôt, il reste local à la machine de
> l'owner. Ce README en décrit seulement les colonnes.

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

1. Owner publie vidéo manuellement avec UTM (`utm_source=<plateforme>&utm_medium=social&utm_campaign=<video_id>`), où
   `<plateforme>` s'écrit sans suffixe : `tiktok`, `instagram`, `youtube`, `facebook`.
   - `utm_source` (canal) et `utm_medium` suivent `UTMBuilderService`
     (`backend/src/modules/marketing/services/utm-builder.service.ts:46-51`) ; l'ancien `utm_source=fafa` ne disait pas la
     plateforme. `tiktok` n'est pas dans `SocialChannel` (`backend/src/modules/marketing/interfaces/marketing-hub.interfaces.ts:5`) :
     le backend ne produit pas ce lien.
   - L'attribution d'atterrissage du site ne lit que `utm_source` et `utm_medium`
     (`backend/src/modules/analytics/controllers/landing-attribution.controller.ts:59-68`). Avec `utm_medium=social`, la visite
     est classée `social` quel que soit le referer (`backend/src/modules/analytics/landing-source.classifier.ts:71`) ; l'ancienne
     valeur `video` la classait selon le referer (`social`, `organic` ou `campaign`, l.72-79).
   - `utm_campaign` n'y est pas capté : le détail par vidéo ne vient que de GA4. La convention de campagne commune relève du lot
     L04 du dossier `workspaces/marketing/README.md`.
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
