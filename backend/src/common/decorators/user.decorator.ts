import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur pour extraire l'utilisateur authentifié de la requête
 * Compatible avec l'authentification JWT/Passport
 */
export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);

// Alias pour compatibilité
export const UserDecorator = User;
