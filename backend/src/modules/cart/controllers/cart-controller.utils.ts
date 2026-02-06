import { Logger } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id_utilisateur: number;
  id: string;
  email: string;
  nom?: string;
  prenom?: string;
  role?: string;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  sessionID: string;
}

/**
 * Obtenir l'identifiant de session depuis le cookie userSession
 */
export function getSessionId(req: RequestWithUser, logger: Logger): string {
  // 1. PRIORITÉ : Cookie personnalisé userSession (utilisé par Remix)
  const cookies = req.headers.cookie?.split(';') || [];
  const userSessionCookie = cookies
    .find((c) => c.trim().startsWith('userSession='))
    ?.split('=')[1];

  if (userSessionCookie) {
    return userSessionCookie.trim();
  }

  // 2. Fallback vers express sessionID si disponible
  if (req.sessionID) {
    return req.sessionID;
  }

  // 3. Fallback final : générer un ID temporaire
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.warn(
    `Aucune session trouvée, utilisation d'un ID temporaire: ${tempId}`,
  );
  return tempId;
}

/**
 * Résoudre l'identifiant utilisateur pour le panier (userId ou sessionId)
 */
export function getCartUserId(
  req: RequestWithUser,
  logger: Logger,
): { sessionId: string; userId: string | undefined; userIdForCart: string } {
  const sessionId = getSessionId(req, logger);
  const userId = req.user?.id;
  return { sessionId, userId, userIdForCart: userId || sessionId };
}
