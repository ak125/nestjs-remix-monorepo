---
scope: Ops / Cleanup safety
audience: human + Claude
sources:
  - scripts/cleanup/validate-before-delete.sh
  - audit/README.md
  - audit/cleanup/README.md
  - scripts/cleanup/audit-compare-baseline.js
last_scan: 2026-10-21
---

# Safe Delete Procedure

> **Règle cardinale** : `knip` dit "unused" ≠ "safe to delete". Le chargement
> dynamique, la DI NestJS et les conventions de routes peuvent expliquer un signal.
> Les [conditions de suppression #0–#8](../../../audit/README.md) portent le contrat ;
> cette procédure guide son application sans remplacer les preuves requises.

## Procédure en 4 étapes

### 1. Sélectionner un candidat

Lister avec :
```bash
npm run audit:knip 2>&1 | awk '/^Unused files/{f=1;next} /^Unused (dep|export|type)|^Unlisted|^Duplicate/{f=0} f'
```

Ou consulter directement `.claude/knowledge/ops/cleanup-targets.md` → section "Obsolètes évidents" / "Dead frontend components".

### 2. Valider avec le safety probe

```bash
./scripts/cleanup/validate-before-delete.sh <path>
```

Le probe est une dernière garde locale, pas une réexécution de l'audit.
Pour un lot PR-8b, appliquer aussi le [protocole de consommation](../../../audit/cleanup/README.md) :
candidat éligible, contrôle d'invariance ciblé avant suppression et preuves dans la PR.
Respecter son périmètre ; ne pas y faire entrer du code runtime ou des modules NestJS
par un assouplissement des gardes.

### 3. Agir selon le verdict

- **SAFE (exit 0)** : aucun usage détecté dans la surface du probe. Vérifier les
  conditions #0–#6 et les limites ci-dessous avant `git rm <path>` ; après suppression,
  exécuter la validation de la condition #7 et soumettre la revue humaine #8.
  SAFE seul ne suffit pas à autoriser la suppression ou la fusion.
- **BLOCKED (exit 1)** : examiner chaque hit. Un blocage portant sur un sous-arbre
  ne prouve pas que chaque fichier est vivant (voir [guardrails](../../rules/guardrails.md)).
  Si une référence semble elle-même morte, lui appliquer les mêmes conditions avant
  toute suppression bottom-up, puis relancer le probe. Un simple signal `unused`
  ne suffit pas. Si l'usage est confirmé, conserver le fichier et documenter la raison
  dans le backlog ; ne pas classer automatiquement tout BLOCKED en `wontfix`.
- **Refus / INCONCLUSIVE (exit 2)** : ne pas supprimer. Diagnostiquer la cause et
  rétablir les preuves ou outils requis avant de relancer. Une cible hors périmètre
  reste hors périmètre ; ne pas contourner le refus.

### 4. Batch + regression gate

Les PRs de cleanup doivent :
- **Rester petites** (5 à 30 fichiers par PR max pour review fluide)
- **Regrouper par cohérence** (ex : tout `frontend/app/components/admin/` dans 1 PR, pas mélanger avec `/cart/`)
- **Ne pas régresser la baseline** : le CI `audit.yml` lance `audit:baseline` qui bloque si les counts régressent au-delà des seuils.

Le renouvellement de la baseline est une décision de maintenance distincte, pas une
étape automatique après chaque fusion. Comparer d'abord les résultats à la baseline
existante avec `npm run audit:baseline` et expliquer les deltas ; ne pas régénérer la
référence pour faire passer une régression.

Si sa mise à jour est décidée après une fusion mainteneur :
```bash
npm run audit:baseline:refresh
git diff -- audit-reports/phase0-baseline.json
```

Le générateur existant réexécute les quatre audits et préserve `thresholds`, `notes`,
`version` et les sous-champs non extraits. Il écrit directement le JSON ; son warning
n'est ni une confirmation interactive ni un arrêt avant écriture. Examiner les deltas
**avant** le refresh, puis vérifier le diff produit et ne sélectionner que les changements
approuvés pour le commit. Éviter `git commit -am`, qui embarquerait les autres travaux.
Les dépendances requises sont contrôlées par `ensureDepsInstalled()` ; en cas d'absence,
préparer l'environnement de validation prévu par le dépôt avant de relancer.

## Limites honnêtes de `validate-before-delete.sh`

**Ne détecte PAS** :
- Chargement via `require(dynamicPath)` où `dynamicPath` est construit runtime
- DI NestJS custom providers via `useFactory` / `useClass` passé par variable
- Routes Angular / custom frameworks qui scannent le FS
- Références dans Docker volumes / CI workflows tiers
- `@import` / `url()` depuis une autre feuille de style (seuls les importeurs TS/JS sont lus)
- Source d'un paquet importé par son nom (`@repo/x` → `dist/index.js` → `src/index.ts`)
- Spécificateurs hors `import`/`from`/`require(` : `require.resolve('…')`, `vi.mock('…')`, `jest.mock('…')`

**Détecte depuis 2026-10-11** (répondaient SAFE à tort) : import avec suffixe de requête Vite
(`./styles/animations.css?url`, importé par `root.tsx`), fichier `index.*` importé par son dossier
(`~/lib/widgets`, `../widgets/`) ou par `'.'` / `'../'` depuis ce dossier ; classe enregistrée dans
un tableau `@Module` écrit sur plusieurs lignes (130 des 270 tableaux, 52 des 76 fichiers
`*.module.ts`) — `[NESTJS-DI]` cherche le nom de classe deviné en **mot entier** dans les
`*.module.ts` (`ThingServiceFactory` n'est pas `ThingService`). Bruit assumé, jamais un faux SAFE :
le nom deviné d'un fichier frontend peut coïncider avec une classe backend (`orders.service.ts`
→ `OrdersService`).

**Surface de recherche** (depuis 2026-10-11) : toutes les recherches passent par `git grep` et
lisent les sources telles que git les voit — **tout fichier suivi**, même sous un motif
`.gitignore` (`backend/src/modules/commercial/archives/` relève de `archives/`,
`…/services/data/` de `data/`), plus le travail en cours non suivi et non ignoré. Jamais les
fichiers non suivis ignorés (`node_modules/`, `build/`, `dist/`) : un verdict ne dépend plus de ce
qui est compilé ou installé dans le checkout (12 des 108 candidats PR-8 avaient un hit venu du
seul `packages/database-types/dist/`). `git grep --untracked` n'est **pas** cette surface : il
applique `.gitignore` aux fichiers suivis aussi — d'où deux passes disjointes (l'index, puis
`git ls-files --others --exclude-standard`).

**Refuse (exit 2, jamais SAFE)** — depuis 2026-10-11, tests `scripts/cleanup/validate-before-delete.test.ts` :
- cible hors dépôt (y compris via `..` ou un répertoire symlinké), symlink, fichier de sous-module,
  fichier non suivi ou modifié non commité ;
- fichier de déclaration TypeScript (`*.d.ts`, `.d.mts`, `.d.cts`) : tsc le charge par `include`/`types`
  du tsconfig (`declare module`, `declare global`), jamais par un import — seule la condition #7 le juge ;
- `audit/runtime-entrypoints.json` / `audit/dynamic-import-edges.json` absents, non commités ou
  mal formés, `node` absent, recherche `git grep` / `git ls-files` en échec → `VERDICT: INCONCLUSIVE`.

Un hit l'emporte toujours (exit 1), même si un autre contrôle n'a pas pu tourner.

Pour une suppression, conserver la validation build/tests exigée par la condition #7.
Un succès de compilation ou de tests ne prouve pas une validation runtime en PREPROD
ou en PROD ; restituer séparément ces niveaux de preuve.

## Anti-patterns

- ❌ Supprimer **en batch** sans passer par `validate-before-delete.sh`
- ❌ Ignorer un BLOCKED en argumentant "je connais, c'est safe"
- ❌ Supprimer un fichier sous `frontend/app/routes/` (convention-loaded par React Router)
- ❌ Commit sans `npm test` passant
- ❌ PR qui mélange cleanup + refactor + feature — scope séparé

## Références

- Script : `scripts/cleanup/validate-before-delete.sh`
- Baseline numérique : `audit-reports/phase0-baseline.json`
- Backlog : `.claude/knowledge/ops/cleanup-targets.md`
- Cycles : `.claude/knowledge/ops/cycle-resolution-playbook.md`
- Comparaison / refresh : `scripts/cleanup/audit-compare-baseline.js`
