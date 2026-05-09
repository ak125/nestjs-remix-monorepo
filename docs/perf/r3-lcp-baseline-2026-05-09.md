# R3 LCP Baseline — `/blog-pieces-auto/conseils/*`

> Date mesure : 2026-05-09
> Branche : `feat/lcp-r3-conseils-fix`
> Plan : `/home/deploy/.claude/plans/automecanik-com-confidentialit-condition-greedy-harp.md`

## Contexte

Signal GSC CWV mobile : 50 URLs en LCP > 4 s (zone "Médiocre"), groupe `/blog-pieces-auto/conseils/*`. Plan d'action : Phase 0 mesure baseline → PR-A cache + single-flight → PR-A.1 instrumentation → PR-C web-vitals lib → décision PR-B image conditionnelle.

## Baseline TTFB API backend (prod)

Endpoint : `GET https://www.automecanik.com/api/r3-guide/$pg_alias`

5 URLs sample × 3 runs (cold/warm mix prod) :

| URL | run 1 | run 2 | run 3 |
|---|---|---|---|
| emetteur-d-embrayage | 607 ms | 489 ms | 526 ms |
| support-moteur | 469 ms | 507 ms | 827 ms |
| capteur-abs | 526 ms | 495 ms | 951 ms |
| corps-papillon | 558 ms | 500 ms | 524 ms |
| cable-d-embrayage | 526 ms | 475 ms | 494 ms |

**Statistiques** (15 mesures) :
- p50 ≈ 510 ms
- p75 ≈ 560 ms
- p95 ≈ 820 ms
- p99 ≈ 950 ms
- min = 469 ms / max = 951 ms

Cohérent avec l'hypothèse : 9 round-trips Supabase REST cumulés (1 query bloquante + Promise.all 7 + 1 séquentielle), 500-1000 ms TTFB attendu.

## LCP node mobile (à compléter post-mesure WPT/DevTools)

- Méthode utilisée : _à remplir_ (WebPageTest Moto G4 / Chrome DevTools / Sentry)
- Sample : 5 URLs ci-dessus
- LCP node identifié : _à remplir_ (`<h1>` HeroBlog / `<img>` featuredImage / autre)
- LCP p75 mesuré : _à remplir_
- Décision PR-B (image responsive WebP) : _à remplir_ (skip si `<h1>` = LCP, go si `<img>`)

## Cibles post-PR-A

- TTFB p95 cache-hit < 200 ms (vs 820 ms baseline)
- Hit ratio > 85 % sur 1h prod (50 URLs cohorte)
- Stampede test : 20 requêtes parallèles → 1 seul appel `computeLegacyPayload`
- TTL régression test : passe avec TTL court 100 ms + setTimeout 150 ms
- LCP field p75 (post-PR-C web-vitals lib) ≤ 3,2 s sample

## Cibles post-PR-B (si déclenchée)

- LCP field p75 ≤ 2,5 s sample
- featuredImage poids servi mobile p75 < 80 KB
- Pas de double-fetch image dans waterfall

## Validation finale

GSC CWV report `/blog-pieces-auto/conseils/*` mobile :
- J0 (déploiement) : "Médiocre", LCP p75 ~4,0 s, 50 URLs
- J+14 : sortie attendue de "Médiocre" → "Améliorer"
- J+28 : cible "Bon" (LCP groupe < 2,5 s)
