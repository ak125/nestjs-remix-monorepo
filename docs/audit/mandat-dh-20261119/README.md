# Mandat DH — patchs préparés, non appliqués

Premier lot de défauts moyens du département 13 (tunnel côté site : D3, D4, D6,
D11, D19 de `docs/audit/mandat-cp-codex-contre-verification-20261118/annexe-tri.md`,
PR #2185). Les corrections et leurs tests sont dans la PR de ce mandat. Ce dossier
ne porte que les deux patchs qui visent des fichiers réservés à l'owner
(`.github/CODEOWNERS`) : ils sont préparés, aucun n'est appliqué.

| Patch | Fichier visé | Objet |
|---|---|---|
| `patches/01-cart-recovery-controller-panier-vers-cart.patch` | `backend/src/modules/cart/controllers/cart-recovery.controller.ts` (L55, L64, L95, L98) | Le contrôleur redirige vers `/panier?…`, route qui n'existe pas ; la page du panier est `/cart`. Quatre littéraux remplacés, rien d'autre. |
| `patches/02-ast-grep-commerce-no-panier-path-literal.patch` | `.ast-grep/rules/commerce-no-panier-path-literal.yml` (nouveau) | Règle anti-retour de D19 : signale un littéral `/panier` ou `/panier?…` dans `backend/src` et `frontend/app`. `/panier/recover/…` et `path.startsWith("/panier")` ne sont pas signalés. Sévérité `warning`. |

## Pourquoi le patch 01 n'est pas nécessaire au lot

La route `frontend/app/routes/panier.recover.$token.tsx` ne relaie plus le chemin
rendu par le backend : elle garde ses paramètres et renvoie toujours sur `/cart`.
Le lien de l'e-mail de relance passe par cette route. Le patch 01 aligne le
backend pour un appel direct de `/api/cart/recover/:token`.

## Ordre d'application

Le patch 01 d'abord, le patch 02 ensuite : appliquée seule, la règle signale les
quatre lignes du contrôleur (avertissements, non bloquants).

```bash
git apply --check docs/audit/mandat-dh-20261119/patches/01-cart-recovery-controller-panier-vers-cart.patch
git apply docs/audit/mandat-dh-20261119/patches/01-cart-recovery-controller-panier-vers-cart.patch
git apply docs/audit/mandat-dh-20261119/patches/02-ast-grep-commerce-no-panier-path-literal.patch
npx --no-install ast-grep scan --config sgconfig.yml --filter commerce-no-panier-path-literal
```

## Essais de la règle (19 novembre 2026, worktree du mandat, règle retirée ensuite)

| Arbre analysé | Signalements |
|---|---|
| Candidat du mandat, patch 01 non appliqué | 4 — les quatre lignes du contrôleur backend |
| Candidat du mandat, patch 01 appliqué | 0 |
| Version de `main` de `panier.recover.$token.tsx`, projet temporaire | 3 — L13, L36, L38 |
| `frontend/app/utils/seo.server.ts:35` (`path.startsWith("/panier")`) | 0 |
