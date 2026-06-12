# Decision : Synthetic monitoring de /admin/seo-control — déféré V1.5+ (PR-SBD-1 Task 6)

> **Date** : 2026-05-18
> **Status** : DECISION canon-aligned
> **Plan ref** : `.claude/plans/verifier-existant-avant-et-ethereal-firefly.md` Task 6
> **PR** : PR-SBD-1.A

---

## Contexte

Le plan Task 6 prévoyait d'ajouter `/admin/seo-control?range=7d` comme cible synthetic au crawler L1 existant
(`backend/src/modules/seo-control-plane/collectors/synthetic-crawler/`).

## Découverte canon

Le fichier `.spec/00-canon/repository-registry/seo-criticality.yaml` (L4 governance, lu par le crawler L1)
**exclut explicitement** `admin/*` :

```yaml
excluded:
  routes:
    - admin/*               # auth-only, jamais indexé
    - api/*                 # contrat backend, monitoring séparé
    - __test/*              # routes E2E DEV-only
    - _build/*              # assets Vite
    - healthz
    - robots.txt
    - sitemap*.xml
    - .well-known/*
```

Le commentaire en-tête du fichier renforce le principe :

> Anti-pattern : ne JAMAIS classer admin/* en tier2 ("ancillary"). admin/*
> est sous authentification, jamais indexé → excluded, point.

Source : `feedback_seo_routes_need_criticality_tiers` (2026-05-14).

## Analyse

Le crawler L1 est conçu pour **SEO public** (pages indexées par Google). Sa logique de sampling stratifié,
SLO 4-source, et alerting PagerDuty visent le revenu organique direct. Ajouter une route admin
authentifiée à cette pipeline :

1. Casserait le principe canon explicite (admin = excluded, point)
2. Nécessiterait un mécanisme d'authentification synthetic (contradiction avec "auth-only")
3. Mélangerait deux disciplines de monitoring (SEO public vs API availability admin)

## Décision

**Skip Task 6 en Phase A.** Pas d'ajout de cible synthetic. Document la décision explicitement.

## Mécanisme de monitoring effectif en Phase A

L'usage manuel quotidien de `/admin/seo-control` par l'admin Fafa **constitue le canary humain** :

- Audit log dedupé Redis SET NX 15min → `__seo_event_log.event_type='dashboard_view'`
- Gate Phase B = ≥ 5 jours d'usage / 10 (SQL count distinct dates sur 14 derniers jours)
- Si l'endpoint casse → admin le voit immédiatement en navigant
- Dette ops Phase A = 0 condition de sortie Phase B

Pas besoin de synthetic supplémentaire pour Phase A. **Si Phase B révèle un besoin
(ex: alerte automatique si dashboard inaccessible), V1.5+ ajoutera un mécanisme dédié**
distinct du crawler L1 SEO public.

## V1.5+ — Si signal Phase B explicite

Options de monitoring admin authentifié (à concevoir si signal Phase B le justifie) :

1. **Health endpoint séparé** : `GET /api/admin/seo-control/health` (no auth required, returns
   `{ ready: bool, last_snapshot_at: ISO }`)
   → monitoré par un crawler distinct ou cron simple
2. **BullMQ self-check** : étendre `SeoControlRefresherService` pour logger un event si refresh
   fail répétitif (3 failures consécutifs)
3. **GitHub Actions cron** : workflow `.github/workflows/seo-control-availability.yml` qui ping
   l'endpoint avec un service account token et alerte sur 5xx

**Aucune de ces options n'est implémentée V1.** Décision d'activation = signal empirique Phase B.

## Anti-régression — règles MEMORY appliquées

- `feedback_verify_existing_first` : grep canon avant proposer (criticality.yaml lu)
- `feedback_no_bricolage_align_existing_contract` : align sur principe canon "admin excluded"
                                                    plutôt que contourner
- `feedback_optional_phase_must_be_evidence_driven` : Task 6 → V1.5+ gated empirique
- `feedback_v1_first_dont_build_ultimate_engine_too_early` : Phase A reste minimal
                                                              (canary humain suffisant)
- Plan principe directeur n°4 : "Si gates non atteints : STOP" — applicable même au scope
                                  d'une task individuelle (pas la peine d'inventer ce qui
                                  n'est pas justifié)
