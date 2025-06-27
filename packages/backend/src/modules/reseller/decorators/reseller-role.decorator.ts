/**
 * MCP GENERATED DECORATORS - RESELLER SECURITY
 * Généré automatiquement par MCP Context-7
 * Protection: Décorateurs pour contrôle d'accès revendeurs
 */
import { SetMetadata } from '@nestjs/common';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const RESELLER_ROLES_KEY = 'reseller_roles';

/**
 * Décorateur pour définir les rôles revendeurs autorisés
 */
export const ResellerRole = (...roles: string[]) => SetMetadata(RESELLER_ROLES_KEY, roles);

/**
 * Décorateur pour accès revendeurs uniquement
 */
export const ResellerOnly = () => ResellerRole('reseller', 'admin', 'super_admin');

/**
 * Décorateur pour accès massdoc spécifiquement
 */
export const MassdocAccess = () => SetMetadata('massdoc_required', true);

/**
 * Décorateur pour extraire les données du revendeur connecté
 */
export const CurrentReseller = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

/**
 * Décorateur pour extraire l'ID du revendeur connecté
 */
export const ResellerId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.resellerId;
  },
);

/**
 * Décorateur pour audit automatique des actions revendeurs
 */
export const AuditResellerAction = (action: string) => 
  SetMetadata('audit_action', action);

/**
 * Décorateur pour limitation de débit spécifique revendeurs
 */
export const ResellerRateLimit = (limit: number, windowMs: number = 60000) =>
  SetMetadata('reseller_rate_limit', { limit, windowMs });

/**
 * Décorateur pour validation territoire revendeur
 */
export const TerritoryRestricted = () => 
  SetMetadata('territory_restricted', true);
