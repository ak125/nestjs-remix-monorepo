# R2 OPA (ADR-066 Gate 4) — la question tranchée : jamais câblé, pas seulement « dépendance manquante »

_2026-09-09 · découvert hors périmètre depuis la machine DEV_

## La question posée

`backend/src/modules/seo/r2/services/r2-opa-evaluator.service.ts:114` attrapait l'échec de
chargement et posait `fallbackDenyAll = true`. `@open-policy-agent/opa-wasm` n'est déclaré dans
**aucun** `package.json` et absent de `node_modules`. Fallback fail-closed, donc pas de faille —
mais : ce chemin est-il **censé** être actif ?

## Réponse : il était voulu, il n'a jamais été terminé — et la dépendance n'est pas le vrai manque

Trois faits mesurés, dont le troisième est décisif.

**1. Les politiques existent et sont à jour.** Le bundle attendu est bien là, compilé :

```
$ ls -la /opt/automecanik/governance-vault/dist/policies/
-rw-rw-r-- 1 deploy deploy 156080 mai   16 14:11 r2-content-write.wasm
-rw-rw-r-- 1 deploy deploy 175976 mai   16 10:06 r2-cluster-health.wasm
-rw-rw-r-- 1 deploy deploy 143602 mai   16 10:06 h1-write.wasm
```

L'intention était donc réelle : quelqu'un a écrit et compilé ces politiques.

**2. La dépendance runtime n'a jamais été déclarée.**

```
$ grep -rn "opa-wasm" **/package.json        -> aucun résultat
$ grep -c "opa-wasm" package-lock.json       -> 0
$ ls node_modules/@open-policy-agent          -> absent
```

Le commentaire du service annonçait « peer-installed in PR 2 V1.5 » ; cette PR n'a pas été mergée.

**3. `evaluateContentWrite()` n'a AUCUN appelant.** C'est le point qui tranche :

```
$ grep -rn "R2OpaEvaluatorService|evaluateContentWrite" backend/src/ --include=*.ts
backend/src/modules/seo/r2/r2-v2.module.ts:43   import { R2OpaEvaluatorService } ...
backend/src/modules/seo/r2/r2-v2.module.ts:76       R2OpaEvaluatorService,      (providers)
backend/src/modules/seo/r2/r2-v2.module.ts:110      R2OpaEvaluatorService,      (exports)
```

Trois lignes de **câblage DI**, zéro **site d'appel**. Aucun test non plus.

### Conséquence : « installer la dépendance » aurait été un faux correctif

Le service est bien instancié au runtime (`R2V2Module` est chargé sans condition), son
`onModuleInit` échoue et pose `fallbackDenyAll = true`… puis **plus personne ne l'interroge**.
Le mode deny-all ne refuse donc rien : il n'y a aucune écriture à refuser par ce chemin.

Ajouter `@open-policy-agent/opa-wasm` aurait fait disparaître le log d'erreur et donné
l'apparence d'un gate fonctionnel, **sans qu'aucun invariant ne soit appliqué**. C'est
exactement la fausse assurance que le canon interdit.

### Quelle branche s'exécute où

| Environnement | vault monté ? | `existsSync(wasm)` | Branche | Résultat |
|---|---|---|---|---|
| DEV | oui (`/opt/automecanik/governance-vault`) | **true** | `require()` échoue → `catch` | `logger.error` + deny-all |
| PREPROD / PROD (containers) | non | false | retour anticipé | `logger.warn` + deny-all |

PREPROD/PROD ne peuvent pas l'avoir : le `Dockerfile` fait `npm ci` depuis le lockfile
(qui ne contient pas le paquet) et ne copie aucun `.wasm`. Rien n'est extrapolé depuis DEV —
l'absence y est structurelle, pas accidentelle.

## Disposition retenue

Retrait de la coquille inerte : le service et ses 3 lignes de câblage.

- **Comportement runtime inchangé** — on retire du code à zéro appelant. `tsc --noEmit` passe,
  zéro référence résiduelle.
- **Un log d'ERREUR de moins à chaque boot sur DEV**, pour une condition que personne ne peut traiter.
- **Les politiques restent dans le vault**, intactes. Rien n'est détruit.

Ce que ce retrait **ne** fait **pas** : décider que Gate 4 n'est pas souhaitable. Il supprime
l'artefact qui faisait croire qu'il existait.

## Ce qui reste à décider (owner)

**ADR-066 Gate 4 est non implémenté.** Le retrait de la coquille ne change pas ce fait, il le
rend visible. Si le gate est voulu, il doit revenir **complet** : dépendance déclarée, sites
d'appel câblés sur le chemin d'écriture R2, tests, et une distribution du bundle qui fonctionne
en container (le chemin vault par défaut n'existe pas en PREPROD/PROD).

La mise à jour du statut d'ADR-066 relève du **vault** (`ak125/governance-vault`) — aucune ADR ne
naît dans ce monorepo. Non fait ici.
