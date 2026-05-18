# Phase −1 Smoke-Test Report — Traffic Drop Investigation

**Date** : 2026-05-13
**Operator** : Investigation Phase −1 (HTTP smoke-test + robots/WAF + GSC quick-check)
**Plan ref** : `/home/deploy/.claude/plans/verifier-pourquoi-le-trafic-binary-mist.md`

---

## Verdict Phase −1

**H1 RLS direct, H1bis Security invoker chains, et fallback silencieux `r2_conditions_missing` → TOUS RÉFUTÉS sur PROD pour le périmètre observé.**

PROD `www.automecanik.com` sert ses pages baseline pieces correctement : `index, follow`, canonical OK, prix/stock présents, HTML 200-477 Ko, aucune divergence Googlebot desktop / mobile / humain. La cascade noindex hypothétique du `seo-indexability-policy.service.ts:66-68` n'est pas active sur ces URLs.

**La baisse −40 % organic est réelle mais ce N'EST PAS la racine identifiée par les hypothèses H1/H1bis du plan v3.**

## Cause-racine probable après Phase −1

**Désindexation Google active sur `/pieces/*`** confirmée par GSC, mécanisme externe ou en amont du rendu HTML actuel :

1. **Sitemap stale depuis 2026-04-23** (drapeau rouge fort) — tous les sub-sitemaps ont `<lastmod>2026-04-23</lastmod>` figé sur la date exacte de l'incident, soit 21 jours sans régénération
2. **Désindexation passée déjà actée** — les pages purgées le 22-23/04 (PR #135 + #136) ont été retirées de l'index Google et l'effet long-tail continue à éroder les impressions
3. **Cause externe Google possible** — algo update 22-24 avril 2026, AI Overviews steal, ou pénalité qualité non identifiée

Confiance verdict : **~75 %** (matrice Phase 1 du plan : "Zéro hit significatif + service_role + HTML normal + impressions ↓ = H2 sitemap ou cause externe Google")

## Détail des étapes exécutées

### −1.A — Smoke-test HTTP multi-UA (5 URLs top baseline organic)

URLs testées (extraites de `__seo_ga4_daily` channel='organic search' W16-W17) :
- `/pieces/cardan-13/renault-140/kangoo-ii-140023/1-5-dci-23465.html` (5 sessions baseline)
- `/pieces/courroie-d-accessoire-10.html` (5 sessions, R1 catalogue)
- `/pieces/plaquette-de-frein-402/renault-140/megane-iii-140049/1-5-dci-77310.html` (5)
- `/pieces/plaquette-de-frein-402/mercedes-benz-108/classe-a-w169-108033/a-180-cdi-2-0-18264.html` (4)
- `/pieces/courroie-d-accessoire-10/peugeot-128/301-128023/1-2-vti-58768.html` (3)

Pour chaque URL × {Googlebot Desktop, Googlebot Smartphone, Human}, archive complète des HTML + headers dans `audit-reports/seo-smoke/2026-05-13/`.

Résultat agrégé (5/5 URLs, 3/3 UA) :
- `HTTP/2 200` partout
- `<meta name="robots" content="index, follow"/>` ✅
- Canonical correcte (pointe vers self) ✅
- Titre + prix présents (ex : "à partir de 47.00€") ✅
- `"availability":"https://schema.org/InStock"` (structured data) ✅
- HTML 200-477 Ko (taille normale, pas dégradée)
- Diff Googlebot desktop / mobile / humain = **identique** (aucun cloaking)
- Cache Cloudflare : MISS premier hit, HIT ensuite (normal)

### −1.D — Robots.txt + WAF

- `robots.txt` PROD propre : aucun `Disallow: /pieces/` ni règle UA-restricted pour Googlebot
- Modification PHP→migration aujourd'hui 2026-05-13 (mentionnée in-file) — **après l'incident**, donc pas la cause
- WAF Cloudflare : `cf-cache-status: HIT/MISS` normal, aucun `cf-mitigated`, pas de 403/503/CAPTCHA pour Googlebot
- Sitemap index `/sitemap.xml` :
  - 11 sub-sitemaps référencés
  - 3 sub-sitemaps pieces : **50 000 + 50 000 + 2 395 = 102 395 URLs** → pas amputé
  - **TOUS** les sub-sitemaps ont `<lastmod>2026-04-23</lastmod>` figé → drapeau rouge stale 21 jours

### −1.E — Googlebot Smartphone (mobile-first)

Inclus dans −1.A. **Aucune divergence desktop vs mobile** sur les 5 URLs : même HTML, même taille, même robots, même canonical, même structured data. Mobile-first indexing pas en cause directe.

### −1.B — GSC quick-check (`__seo_gsc_daily`)

Trend hebdo (cf. tableau dans le rapport principal) :

- **`pieces`** : impressions −40 % (3 666 → 2 183), clicks −72 % (18 → 5), CTR −53 % (0.49 → 0.23), position +3 (34 → 37) **W17 → W19**
- **`blog`** : impressions stable (4-5K/sem), clicks/position stables
- **`constructeurs`** : impressions stable (~900-1100/sem), clicks faibles oscillants
- **`home`** : volumes très faibles (36-73 imp/sem) mais CTR élevé (8-15 %), stable

Section `pieces` isolée → baisse spécifique à cette surface, pas un effet global domaine.

## Comparaison GA4 vs GSC W17 → W19

| Métrique | Source | W17 | W19 | Δ |
|----------|--------|-----|-----|---|
| sessions organic pieces | GA4 | 405 | 214 (×7/6) | **−47 %** |
| clicks pieces | GSC | 18 | 5 | **−72 %** |
| impressions pieces | GSC | 3 666 | 2 183 | **−40 %** |
| CTR pieces | GSC | 0.49 % | 0.23 % | **−53 %** |
| position pieces | GSC | 34.16 | 36.94 | **+3 places** |

Les chutes GA4 et GSC convergent. **Le tracking GA4 n'est pas cassé** (H5 réfutée) — c'est bien une vraie désindexation Google.

## Branchement Phase 3 — Fix racine ciblé

Skip Phase 0 (obs-fix) et Phase 1 (script versionné) en bloc bloquant — la racine est externe au verdict noindex. Néanmoins :

- **Phase 0 reste pertinent comme corrective d'observabilité** (incident parallèle) pour futurs incidents R2 silencieux — à programmer mais hors chemin critique
- **Phase 1 script reste utile** comme outil reproductible pour mesurer l'effet de tout fix futur

**Actions Phase 3 prioritaires (ordre)** :

1. **Investiguer pourquoi le sitemap est figé à 2026-04-23** :
   - Auditer `SitemapV2Service`, jobs BullMQ `sitemap:*`, cron de régénération
   - Vérifier état dernière exécution réussie / failed
   - Si PR #136 (purge orphans) a cassé le job → réparer + re-trigger
2. **Régénérer le sitemap manuellement** une fois la cause sitemap identifiée
3. **GSC URL Inspection** pour 10-20 URLs baseline top organic — forcer re-crawl prioritaire (quota ~10/jour user)
4. **Surveiller `__seo_gsc_daily.pieces` impressions** sur 7 j post-fix sitemap (ETA rétablissement crawl Google ~7-14 j)

## Fichiers archivés

```
audit-reports/seo-smoke/2026-05-13/
├── PHASE-MINUS-1-REPORT.md (ce fichier)
├── robots.txt + robots.txt.headers
├── sitemap.xml
├── googlebot-desktop-* (.html + .headers) × 5 URLs
├── googlebot-mobile-* (.html + .headers) × 5 URLs
└── human-* (.html + .headers) × 5 URLs
```

15 paires HTML+headers + 1 robots + 1 sitemap + ce rapport = 33 fichiers, preuve reviewable pour post-mortem.

## Mémoires à actualiser (post-investigation)

- `seo-v9-cascade-state-20260508.md` est **obsolète** — PRs #398/#399/#400 sont MERGED, pas drafts
- Créer mémoire `incident-traffic-drop-2026-04-22-resolved-sitemap-stale.md` post-fix
- Créer mémoire `feedback_smoke_test_http_before_obs_fix.md` — pattern Phase −1 confirmé efficace (15 min pour trancher H1/H1bis)
- Hypothèses H1/H1bis réfutées contredisent la conclusion intuitive initiale → leçon de discipline empirique
