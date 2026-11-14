/**
 * AdminOrInternalKeyGuard — frontière des déclencheurs de maintenance.
 *
 * Deux identités sont admises, chacune portée par une garde atomique
 * existante, composées par `AnyOf` :
 *   - une session administrateur (`AdminSessionGuard`) : l'administration ;
 *   - la clé interne `X-Internal-Key` (`InternalApiKeyGuard`) : une tâche
 *     planifiée ou un script de l'exploitation.
 *
 * Fermé par défaut : sans `INTERNAL_API_KEY` configurée, seule la session
 * administrateur ouvre la route.
 *
 * Les deux gardes sont fournies et exportées par `AuthModule`.
 */
import { AdminSessionGuard } from './admin-session.guard';
import { AnyOf } from './any-of.guard';
import { InternalApiKeyGuard } from './internal-api-key.guard';

export const AdminOrInternalKeyGuard = AnyOf(
  AdminSessionGuard,
  InternalApiKeyGuard,
);
