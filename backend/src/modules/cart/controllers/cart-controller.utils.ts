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
 * Resoudre l'identifiant utilisateur pour le panier (userId ou sessionId)
 */
export function getCartUserId(
  req: RequestWithUser,
  logger: Logger,
): { sessionId: string; userId: string | undefined; userIdForCart: string } {
  const sessionId = getSessionId(req, logger);
  const userId = req.user?.id;
  return { sessionId, userId, userIdForCart: userId || sessionId };
}

/**
 * Forcer express-session a persister le cookie connect.sid
 * Appeler apres toute mutation panier pour que le visiteur non connecte
 * conserve son panier entre les requetes (saveUninitialized: false)
 */
export function ensureSessionPersisted(req: RequestWithUser): void {
  if (req.session) {
    const sess = req.session as unknown as Record<string, unknown>;
    if (!sess.cartInitialized) {
      sess.cartInitialized = true;
    }
  }
}

/**
 * Calculer les frais de port et le total coherent a partir des stats du panier
 * shippingCost est fourni par ShippingCalculatorService (grille Colissimo 2026)
 */
export function computeShippingAndTotal(stats: {
  subtotal: number;
  shippingCost: number;
  consigne_total?: number;
  promoDiscount?: number;
}): { shippingFee: number; totalWithShipping: number } {
  const shippingFee = stats.shippingCost;

  const totalWithShipping =
    stats.subtotal +
    (stats.consigne_total || 0) -
    (stats.promoDiscount || 0) +
    shippingFee;

  return {
    shippingFee: Math.round(shippingFee * 100) / 100,
    totalWithShipping: Math.round(totalWithShipping * 100) / 100,
  };
}
