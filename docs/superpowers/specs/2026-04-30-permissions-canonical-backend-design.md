# Spec — Source canonique de permissions au backend

> **Date** : 2026-04-30
> **Auteur** : Fafa (avec Claude Code)
> **Statut** : DRAFT — en attente review user
> **Branche cible** : `fix/permissions-canonical-backend`
> **Type** : refactor architectural (auth/permissions)

---

## 1. Contexte & motivation

### 1.1 Bug observé (déclencheur)

Le 2026-04-30, l'utilisateur tente d'annuler la commande `ORD-1777531019900-837` depuis l'interface admin. La commande affiche `Forbidden resource` et reste au statut `3` (Attente frais de port). Audit DB confirme :

```sql
SELECT ord_ords_id, ord_cancel_date, ord_cancel_reason
FROM "___xtr_order"
WHERE ord_id = 'ORD-1777531019900-837';
-- ord_ords_id = '3', ord_cancel_date = NULL, ord_cancel_reason = NULL
```

L'annulation n'a pas eu lieu, aucun email client envoyé, aucun audit trail créé. Cause = HTTP 403 retourné par `IsAdminGuard` sur `POST /api/admin/orders/:id/cancel`.

### 1.2 Cause racine — 3 sources de vérité divergentes

| # | Localisation | Granularité | Verdict pour "commercial peut annuler" |
|---|---|---|---|
| 1 | [`backend/src/auth/auth.service.ts:877-885`](../../../backend/src/auth/auth.service.ts) | Module × `read`/`write` | Indéterminé (ne couvre pas l'action `cancel`) |
| 2 | [`frontend/app/utils/permissions.ts:101-118`](../../../frontend/app/utils/permissions.ts) | Par-action (`canCancel`, `canShip`, …) | **OUI** (level 3-4 → `canCancel: true`) |
| 3 | [`backend/src/auth/is-admin.guard.ts:20`](../../../backend/src/auth/is-admin.guard.ts) | Booléen (`level >= 7`) | **NON** (commercial level 3-6 rejeté) |

Le frontend affiche le bouton "Annuler" au commercial, le backend le bloque. Toute action métier opérationnelle pour le commercial souffre du même symptôme : `canShip`, `canDeliver`, `canMarkPaid`, `canSendEmails`, `canValidate` sont déclarées `true` côté frontend mais le backend les bloque toutes via `IsAdminGuard`.

### 1.3 Pourquoi maintenant, pourquoi structurel

Trois précédents identiques peuvent déjà être ouverts en silence (commercial ne peut effectivement pas valider/expédier/livrer/marquer payé). Une rustine sur cancel reproduirait la dette ailleurs. Le pattern actuel n'est pas réparable par patch — l'architecture suppose un seul niveau de permission (admin/non-admin) alors que le métier en exige cinq (Utilisateur, Commercial, Responsable, Administrateur, Super Admin).

---

## 2. Décision d'architecture

**Le backend devient l'unique source de vérité pour la matrice de permissions par-action.** Le frontend consomme cette matrice via API et n'héberge plus aucune logique de calcul.

### 2.1 Principes appliqués

- **Single source of truth** — une seule matrice, versionnée dans le repo, côté backend.
- **Granularité par-action** — `canCancel`, `canShip`, etc. (modèle déjà existant côté frontend, simplement déplacé).
- **YAGNI** — pas de lib externe (CASL/accesscontrol), pas d'ABAC, pas de DB-driven (la matrice change rarement, du code versionné est plus traçable que des rows).
- **RBAC par level** — modèle existant conservé (level 1-9), seule l'application change.
- **Migration progressive** — `IsAdminGuard` reste en place pour les endpoints réellement admin-only (settings système, audit, configuration). Cette PR ne migre que le module **orders**, l'infrastructure étant réutilisable pour les modules suivants en PRs séparées.

### 2.2 Composants

| Composant | Localisation | Type | Rôle |
|---|---|---|---|
| `PermissionsService` | `backend/src/auth/permissions.service.ts` | nouveau | Détient la matrice canonique. Méthode `getPermissions(userLevel: number): UserPermissions` |
| `UserPermissions` interface | `backend/src/auth/dto/user-permissions.dto.ts` | nouveau | Shape canonique partagée backend/frontend (15 booléens) |
| `@RequirePermission('canCancel')` | `backend/src/auth/decorators/require-permission.decorator.ts` | nouveau | Décorateur de méthode |
| `PermissionsGuard` | `backend/src/auth/guards/permissions.guard.ts` | nouveau | Lit le décorateur, consulte `PermissionsService`, retourne `boolean` |
| `GET /auth/user-permissions/:userId` | `backend/src/auth/controllers/auth-permissions.controller.ts:68` | refactor | Retourne `UserPermissions` complet (au lieu de la matrice module-coarse actuelle) |
| `frontend/app/utils/permissions.ts` | idem | refactor | Devient un thin client qui hit l'endpoint et cache par session ; `getUserPermissions(level)` supprimé |
| Endpoints orders | `backend/src/modules/orders/controllers/order-actions.controller.ts` | refactor | Remplace `IsAdminGuard` par `@RequirePermission(...)` ciblé par méthode |

### 2.3 Matrice canonique (portée à l'identique depuis le frontend)

La matrice est portée **sans modification métier** depuis [`frontend/app/utils/permissions.ts:36-139`](../../../frontend/app/utils/permissions.ts). Cette PR ne renégocie pas les règles — elle les déplace au bon endroit.

| Niveau | Rôle | canCancel | canShip | canDeliver | canMarkPaid | canValidate | canSendEmails | canCreateOrders | canReturn | canRefund |
|---|---|---|---|---|---|---|---|---|---|---|
| 1-2 | Utilisateur | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 3-4 | Commercial | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 5-6 | Responsable | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 7-8 | Administrateur | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 | Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

(15 booléens au total — tableau abrégé. La shape complète est définie dans `UserPermissions`.)

---

## 3. Spécifications techniques

### 3.1 `PermissionsService`

```ts
// backend/src/auth/permissions.service.ts
@Injectable()
export class PermissionsService {
  getPermissions(userLevel: number): UserPermissions {
    if (userLevel >= 9) return SUPER_ADMIN_PERMISSIONS;
    if (userLevel >= 7) return ADMIN_PERMISSIONS;
    if (userLevel >= 5) return MANAGER_PERMISSIONS;
    if (userLevel >= 3) return COMMERCIAL_PERMISSIONS;
    return BASE_USER_PERMISSIONS;
  }

  hasPermission(userLevel: number, action: keyof UserPermissions): boolean {
    return this.getPermissions(userLevel)[action] === true;
  }
}
```

Les 5 constantes sont `as const`, exhaustives, et exportées pour les tests.

### 3.2 Décorateur + Guard

```ts
// backend/src/auth/decorators/require-permission.decorator.ts
export const REQUIRE_PERMISSION_KEY = 'require_permission';
export const RequirePermission = (action: keyof UserPermissions) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, action);
```

```ts
// backend/src/auth/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<keyof UserPermissions>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!action) return true; // pas de décorateur = pas de check (compose avec IsAdminGuard)

    const user = context.switchToHttp().getRequest().user;
    const level = parseInt(String(user?.level ?? 0), 10);
    return this.permissionsService.hasPermission(level, action);
  }
}
```

### 3.3 Endpoint de permissions (refactor)

```ts
// backend/src/auth/controllers/auth-permissions.controller.ts
@Get('auth/user-permissions/:userId')
async getUserPermissions(@Param('userId') userId: string): Promise<UserPermissions> {
  const user = await this.userDataService.findById(userId);
  if (!user || !user.isActive) return BASE_USER_PERMISSIONS;
  return this.permissionsService.getPermissions(user.level);
}
```

**Breaking change** : la shape de réponse change. Le seul consommateur connu est `frontend/app/utils/permissions.ts`, mis à jour dans la même PR. Pas de versionnement nécessaire — break franc.

### 3.4 Migration des endpoints orders

[`backend/src/modules/orders/controllers/order-actions.controller.ts`](../../../backend/src/modules/orders/controllers/order-actions.controller.ts) :

```ts
@Controller('api/admin/orders')
@UseGuards(AuthenticatedGuard, PermissionsGuard) // ← remplace IsAdminGuard par PermissionsGuard
export class OrderActionsController {

  @Post(':orderId/cancel')
  @RequirePermission('canCancel')
  async cancelOrder(...) { /* inchangé */ }

  @Post(':orderId/ship')
  @RequirePermission('canShip')
  async markAsShipped(...) { /* inchangé */ }

  @Post(':orderId/deliver')
  @RequirePermission('canDeliver')
  async markAsDelivered(...) { /* inchangé */ }

  @Post(':orderId/confirm-payment')
  @RequirePermission('canMarkPaid')
  async confirmPayment(...) { /* inchangé */ }

  @Patch(':orderId/lines/:lineId/status/:newStatus')
  @RequirePermission('canValidate') // statut ligne = validation
  async updateLineStatus(...) { /* inchangé */ }

  @Post(':orderId/lines/:lineId/order-from-supplier')
  @RequirePermission('canValidate') // commande fournisseur = action métier opérationnelle
  async orderFromSupplier(...) { /* inchangé */ }
}
```

### 3.5 Frontend — `permissions.ts` thin client

```ts
// frontend/app/utils/permissions.ts (post-refactor)
export interface UserPermissions { /* identique à aujourd'hui */ }

export async function loadUserPermissions(userId: string): Promise<UserPermissions> {
  const res = await fetch(`/api/auth/user-permissions/${userId}`, {
    credentials: 'include',
  });
  if (!res.ok) return BASE_USER_PERMISSIONS;
  return res.json();
}

// SUPPRIMÉ : getUserPermissions(userLevel: number) — le calcul ne vit plus côté frontend
// CONSERVÉ : getUserRole(userLevel) — c'est de l'affichage (label + badge), pas une permission
```

Tous les loaders Remix qui appelaient `getUserPermissions(user.level)` doivent être migrés vers `await loadUserPermissions(user.id)` dans le `loader` Remix puis transmis au composant via `useLoaderData`.

**Caching** : on ne cache pas dans cette PR. La latence d'un appel par page est acceptable (l'endpoint est <50ms). Si nécessaire en suivi, ajouter cache Redis 5min côté backend, ou cache React Query côté frontend.

---

## 4. Sécurité — chaîne d'authz post-fix

```
Browser (commercial level 3) clique "Annuler"
  ↓ fetch POST /api/admin/orders/:id/cancel  (credentials: include)
Backend reçoit la requête
  ↓ AuthenticatedGuard          → session valide ? OK
  ↓ PermissionsGuard            → reflector lit @RequirePermission('canCancel')
                                  → permissionsService.hasPermission(3, 'canCancel') === true
                                  → OK
  ↓ cancelOrder() s'exécute
  ↓ DB : UPDATE ord_ords_id='6', ord_cancel_date=NOW(), ord_cancel_reason=...
  ↓ INSERT ___xtr_order_status_history
  ↓ emit ORDER_EVENTS.CANCELLED
      ├─ OrderAuditListener → INSERT __admin_audit_log (qui/quand/raison)
      └─ OrderEmailListener → mailService.sendCancellationEmail(order, customer, reason)
  → 200 OK { success: true, message: 'Commande annulée et client notifié' }
```

Aucun chemin ne contourne `PermissionsGuard` : tous les endpoints du controller sont décorés.

---

## 5. Tests

### 5.1 Unit `PermissionsService`

Table-driven, 5 niveaux × 15 actions = 75 cas :

```ts
describe('PermissionsService', () => {
  const cases: Array<[number, keyof UserPermissions, boolean]> = [
    [3, 'canCancel', true],   // commercial peut annuler
    [3, 'canRefund', false],  // commercial ne peut pas rembourser
    [5, 'canCancel', false],  // responsable ne peut pas annuler
    [7, 'canCancel', true],   // admin peut annuler
    [0, 'canCancel', false],  // anonymous = base user
    // ... 70 autres cas
  ];
  it.each(cases)('level %i / %s = %s', (level, action, expected) => {
    expect(service.hasPermission(level, action)).toBe(expected);
  });
});
```

### 5.2 Unit `PermissionsGuard`

- Décorateur absent → `canActivate` retourne `true` (compose avec d'autres guards).
- User level 3 + `@RequirePermission('canCancel')` → `true`.
- User level 1 + `@RequirePermission('canCancel')` → `false`.
- User absent (`req.user = undefined`) → `level = 0` → `false` pour toute action métier.

### 5.3 E2E `OrderActionsController`

- `POST /api/admin/orders/:id/cancel` avec session commercial level 3 → **200**, vérifier `___xtr_order.ord_ords_id = '6'` + email envoyé (mock `MailService`).
- Même endpoint avec session level 1 → **403**.
- Même endpoint sans session → **401** (intercepté par `AuthenticatedGuard` avant `PermissionsGuard`).

### 5.4 Régression manuelle (post-déploiement DEV)

Compte test commercial à créer ou identifier (level 3-4). Cycle complet sur une commande de test :
- Annuler → vérifier statut 6 + email reçu + audit log + status history.
- Expédier (sur autre commande) → vérifier statut 4 + email + tracking.
- Livrer → statut 5.
- Confirmer paiement → `payment_confirmed = true`.

---

## 6. Out of scope (suivis explicites)

Ces points ne sont **pas** traités dans cette PR mais sont identifiés et notés :

1. **Migration des autres modules** sous `IsAdminGuard` (blog, advice, seo, vehicles, search, admin-keyword-clusters, configuration, …) — ~25 controllers identifiés. PRs séparées en suivant le même pattern. `IsAdminGuard` reste utilisable et fonctionnel pour ces endpoints.
2. **Caching de la matrice** côté frontend (React Query) ou backend (Redis). À ouvrir si latence devient un problème.
3. **Renégociation des règles métier** (ex : "le commercial devrait-il aussi pouvoir refund jusqu'à X €") — pas de changement métier dans cette PR.
4. **Audit log d'accès refusé** — `PermissionsGuard` peut logger les refus pour observabilité, mais pas de nouvelle table dans cette PR (réutilise les logs NestJS).
5. **Cohérence avec `auth.service.ts:checkModuleAccess`** (matrice module-coarse, ligne 877-885) — cette matrice a des consommateurs distincts (`/auth/module-access`) et n'est pas touchée. À unifier dans une PR ultérieure si nécessaire.

---

## 7. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Commercial existant en prod a un niveau autre que 3-4 (ex : level 0) | Moyenne | Bug "boutons grisés" → escalade support | Audit DB pré-déploiement : `SELECT cst_level, COUNT(*) FROM ___xtr_customer GROUP BY cst_level` |
| Endpoint `/auth/user-permissions/:userId` consommé ailleurs que `permissions.ts` | Faible | Casse silencieuse | `grep -rn "user-permissions" frontend/ backend/` avant merge |
| `PermissionsGuard` empêche un test E2E sans user mocké | Faible | CI rouge | Audit des tests E2E orders existants, ajout fixture user admin |
| Régression sur `IsAdminGuard` (utilisé ailleurs) | Très faible | Aucune — non touché dans cette PR | Vérifier `git diff` ne touche que les fichiers listés en §3 |

---

## 8. Critères d'acceptation

La PR est mergeable si **toutes** ces conditions sont remplies :

- [ ] `PermissionsService`, `PermissionsGuard`, `RequirePermission` décorateur, `UserPermissions` DTO existent et compilent.
- [ ] `OrderActionsController` n'utilise plus `IsAdminGuard`. Tous ses endpoints sont décorés `@RequirePermission(...)`.
- [ ] `frontend/app/utils/permissions.ts` n'exporte plus `getUserPermissions(userLevel)`. Aucun import de cette fonction n'existe dans `frontend/app/`.
- [ ] Endpoint `GET /api/auth/user-permissions/:userId` renvoie une shape `UserPermissions` (15 booléens).
- [ ] 75 cas unit `PermissionsService` passent.
- [ ] E2E `cancelOrder` passe avec session commercial mockée.
- [ ] Smoke test manuel sur DEV : compte commercial annule effectivement la commande de test (vérification triple : statut DB, audit log, email reçu).
- [ ] Aucun fichier modifié hors de la liste §3 (sauf `auth.module.ts` pour DI et tests).
- [ ] CI verte (typecheck, lint, tests, perf-gates).

---

## 9. Plan de rollback

La PR introduit du nouveau code et remplace 6 décorateurs sur `OrderActionsController`. En cas de régression :

1. **Hot-fix immédiat** : `git revert <merge-commit>` sur `main` → redéploie DEV pré-prod en <10min.
2. **Données** : aucune migration DB, aucun changement de schéma. Les commandes annulées par commerciaux entre déploiement et rollback restent valides (statut 6, audit log, email envoyé). Pas de cleanup nécessaire.
3. **Frontend** : `permissions.ts` nouvelle version contient un fallback (`BASE_USER_PERMISSIONS`) si l'endpoint répond 4xx/5xx → boutons grisés mais pas de crash.

---

## 10. Références

- Bug déclencheur : commande `ORD-1777531019900-837` (DB `cxpojprgwgubzjyqzmoq`)
- Frontend matrice originale : [`frontend/app/utils/permissions.ts:36-139`](../../../frontend/app/utils/permissions.ts)
- Backend guard à remplacer : [`backend/src/auth/is-admin.guard.ts`](../../../backend/src/auth/is-admin.guard.ts)
- Endpoint cancel impacté : [`backend/src/modules/orders/controllers/order-actions.controller.ts:246`](../../../backend/src/modules/orders/controllers/order-actions.controller.ts)
- Listeners événement cancel (preserved, non touchés) :
  - [`backend/src/modules/orders/listeners/order-email.listener.ts:48`](../../../backend/src/modules/orders/listeners/order-email.listener.ts)
  - [`backend/src/modules/orders/listeners/order-audit.listener.ts:105`](../../../backend/src/modules/orders/listeners/order-audit.listener.ts)
- CLAUDE.md backend pattern : `.claude/rules/backend.md`
- CLAUDE.md règle "vérifier l'existant" : `CLAUDE.md` §"Vérifier l'existant AVANT d'inventer"
