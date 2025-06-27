/**
 * MCP GENERATED DECORATOR - RESELLER ROLES
 * Généré automatiquement par MCP Context-7
 * Sécurité: Contrôle des rôles revendeurs
 * Source: massdoc security requirements
 */
import { SetMetadata } from '@nestjs/common';

export const RESELLER_ROLES_KEY = 'reseller_roles';

export const ResellerRole = (...roles: string[]) => SetMetadata(RESELLER_ROLES_KEY, roles);

export const ResellerOnly = () => ResellerRole('reseller', 'admin');

export const AdminOnly = () => ResellerRole('admin', 'super_admin');

// Décorateur pour récupérer l'ID revendeur depuis la requête
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ResellerId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.resellerId || request.resellerId;
  },
);

export const ResellerUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
