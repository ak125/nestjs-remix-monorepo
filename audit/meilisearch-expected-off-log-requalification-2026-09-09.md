# Meilisearch sur DEV : non-problème de service, vrai défaut de classification de log

_2026-09-09 · machine DEV_

## Verdict

**Meilisearch éteint sur DEV est ATTENDU** — ce n'est pas une panne. Le défaut réel est que cette
condition normale était signalée en **ERROR à chaque boot, deux fois**, par deux services distincts.

## Mesure — pourquoi « attendu »

Meilisearch n'est démarré par **aucun** compose de déploiement, **aucun** workflow CI, **aucun**
Dockerfile. Il n'existe que dans un compose opt-in :

```
$ grep -il "meili" docker-compose.yml docker-compose.dev.yml \
      docker-compose.preprod.yml docker-compose.prod.yml Dockerfile*
(aucun résultat)
$ grep -rl "meili" .github/workflows/
(aucun résultat)
$ grep -rln "meili" --include="docker-compose*.yml" .
./docker-compose.meilisearch.yml      <-- opt-in, lancé à la main
./docker-compose.vector.yml
```

Et aucune variable n'est renseignée sur DEV :

```
$ grep -oE '^[A-Z_]*MEILI[A-Z_]*' backend/.env | sort -u
(aucun résultat)
```

Le code, lui, faisait comme si l'absence de configuration était une configuration :

```ts
host: this.configService.get('MEILISEARCH_HOST') || 'http://localhost:7700'
```

Ce défaut substitué **détruisait le seul signal** qui distingue « pas déployé sur cet
environnement » de « déployé mais en panne ». Les deux cas convergeaient vers le même
`localhost:7700` injoignable, donc vers la même branche d'échec, donc vers le même ERROR.

## Mesure AVANT — le bruit, deux fois par boot

```
$ grep -aiE "Meilisearch" /tmp/dev-server.log | grep -i ERROR | tail -4
@fafa/backend:dev: [08:53:02] ERROR: ❌ Erreur init Meilisearch:            (log-ingestion.service.ts:129)
@fafa/backend:dev: [08:53:02] ❌ Failed to initialize Meilisearch           (meilisearch.service.ts:53)
```

Un ERROR récurrent pour une condition **normale et non actionnable** apprend à ignorer les ERROR.
C'est le défaut : pas le service éteint.

## Correction — cause racine, pas le niveau de log

On ne baisse pas la sévérité : on **rétablit la distinction** que le défaut substitué effaçait.
Lecture de `MEILISEARCH_HOST` **sans défaut** d'abord, pour décider de l'état, puis :

| État | Comportement |
|---|---|
| `MEILISEARCH_HOST` **absent** | une ligne **WARN** déclarant la dégradation, sa portée et le remède ; init sautée |
| `MEILISEARCH_HOST` **présent** mais injoignable | chemin inchangé → **ERROR** (vrai problème, vraie action) |

Ce n'est **pas un repli silencieux** (canon `no-silent-fallback`) : la dégradation est déclarée,
datée au boot, avec sa conséquence et sa commande de remise en service.

## Preuve APRÈS — services patchés réellement instanciés

```
=== A. MEILISEARCH_HOST unset — DEV / CI / PREPROD / PROD (expected-off) ===
  WARN  MEILISEARCH_HOST non défini → indexation/recherche Meilisearch DÉSACTIVÉE sur cet
        environnement (dégradation assumée). Pour l'activer : `docker compose -f
        docker-compose.meilisearch.yml up -d` puis renseigner MEILISEARCH_HOST.
  WARN  MEILISEARCH_HOST non défini → indexation des access logs DÉSACTIVÉE sur cet
        environnement (dégradation assumée). L'ingestion Loki/Caddy n'est pas affectée.

=== B. MEILISEARCH_HOST set — un opérateur l'a délibérément configuré ===
  LOG   🚀 Init MeilisearchService — initialisation des index en arrière-plan
  LOG   🚀 Init LogIngestionService — config Meilisearch en arrière-plan
```

Zéro ERROR en A ; en B le chemin nominal est **intact**, donc un Meilisearch réellement configuré
et en panne produit toujours un ERROR. `tsc --noEmit` passe.

## Trouvés en chemin, NON corrigés ici (hors périmètre, signalés pour ne pas les perdre)

1. **`GET /api/pieces/index` renvoie HTTP 200 sur échec.** La route appelle l'indexation
   Meilisearch ; `pieces.controller.ts` attrape toute exception dans le handler et retourne un
   objet, si bien que l'échec sort en `200` avec une `TypeError` brute :
   `{"success":false,"error":"Cannot read properties of undefined (reading 'addDocuments')"}`.
   Corriger le code HTTP demande de toucher le contrôleur — défaut distinct, PR distincte.
2. **Contrat d'env incohérent** : `MEILISEARCH_MASTER_KEY` (1 lecteur, `search/`) vs
   `MEILISEARCH_API_KEY` (plusieurs lecteurs, `seo-logs/`, `seo/`). Deux noms pour la même chose.
3. **Identifiant par défaut en dur** : `|| 'masterKey123'` subsiste dans `meilisearch.service.ts`.
   **Volontairement non modifié** : `docker-compose.meilisearch.yml` utilise la même valeur par
   défaut (`MEILI_MASTER_KEY=${MEILISEARCH_MASTER_KEY:-masterKey123}`), donc la changer casserait
   le chemin opt-in local. C'est une décision à part, pas un effet de bord de cette PR.
