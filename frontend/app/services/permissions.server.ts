// app/services/permissions.server.ts
// Service optimisé utilisant le backend NestJS existant
// Applique "vérifier existant et utiliser le meilleur"

import { logger } from "~/utils/logger";

interface ModuleAccessResult {
  hasAccess: boolean;
  reason?: string;
  requiredRole?: string;
}

/**
 * Vérifier l'accès à un module via l'API backend optimisée
 * Utilise le système AuthService existant (plus performant que Supabase direct)
 */
export async function checkModuleAccess(
  userId: string,
  module: string,
  action: string = "read",
): Promise<boolean> {
  try {
    // Utiliser l'API backend existante plutôt que Supabase direct
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/auth/module-access`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`, // Token interne
        },
        body: JSON.stringify({
          userId,
          module,
          action,
        }),
      },
    );

    if (!response.ok) {
      logger.error(`Module access check failed: ${response.status}`);
      return false;
    }

    const result: ModuleAccessResult = await response.json();
    return result.hasAccess;
  } catch (error) {
    logger.error("Error checking module access:", error);
    return false; // Échec sécurisé
  }
}

/**
 * Enregistrer un accès via l'API backend optimisée
 * Utilise le système de logging existant (plus performant et structuré)
 */
export async function logAccess(
  userId: string,
  action: string,
  resource: string,
  module: string,
  statusCode: number,
): Promise<void> {
  try {
    // Utiliser l'API backend existante avec Redis cache
    await fetch(`${process.env.BACKEND_URL}/api/auth/log-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        userId,
        action,
        resource,
        module,
        statusCode,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    logger.error("Error logging access:", error);
    // Ne pas faire échouer la requête pour des erreurs de logging
  }
}

/**
 * Helper avancé : Vérifier plusieurs modules à la fois
 * Optimisé avec une seule requête API
 */
export async function checkMultipleModuleAccess(
  userId: string,
  modules: { module: string; action?: string }[],
): Promise<Record<string, boolean>> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/auth/bulk-module-access`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          userId,
          modules,
        }),
      },
    );

    if (!response.ok) {
      logger.error(`Bulk module access check failed: ${response.status}`);
      return {};
    }

    return await response.json();
  } catch (error) {
    logger.error("Error checking multiple module access:", error);
    return {};
  }
}

/**
 * Helper Remix : Vérifier l'accès depuis un loader
 * Usage dans les routes Remix
 */
export async function requireModuleAccess(
  request: Request,
  module: string,
  action: string = "read",
): Promise<void> {
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const hasAccess = await checkModuleAccess(userId, module, action);

  if (!hasAccess) {
    // Logger automatiquement l'accès refusé
    await logAccess(userId, action, module, module, 403);
    throw new Response("Forbidden", { status: 403 });
  }

  // Logger l'accès réussi
  await logAccess(userId, action, module, module, 200);
}

/**
 * Helper : Extraire l'ID utilisateur de la requête Remix
 * Compatible avec le système d'authentification existant
 */
async function getUserIdFromRequest(request: Request): Promise<string | null> {
  try {
    // Extraire le token JWT de la requête
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return null;

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer") return null;

    // Décoder le token (ou utiliser une session cookie)
    // Implémentation spécifique selon votre système auth
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/auth/validate-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      },
    );

    if (!response.ok) return null;

    const { userId } = await response.json();
    return userId;
  } catch (error) {
    logger.error("Error extracting user ID from request:", error);
    return null;
  }
}

/**
 * Helper avancé : Obtenir les permissions utilisateur pour le frontend
 * Optimisé pour le cache côté client
 */
export async function getUserModulePermissions(
  userId: string,
): Promise<Record<string, { read: boolean; write: boolean }>> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/auth/user-permissions/${userId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
      },
    );

    if (!response.ok) {
      logger.error(`User permissions fetch failed: ${response.status}`);
      return {};
    }

    return await response.json();
  } catch (error) {
    logger.error("Error fetching user permissions:", error);
    return {};
  }
}

// Exemple d'utilisation dans une route Remix:
/*
export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier l'accès requis
  await requireModuleAccess(request, 'admin', 'read');
  
  // Votre logique de loader...
  return json({ data: 'sensitive admin data' });
}
*/
