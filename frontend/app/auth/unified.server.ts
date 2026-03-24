import { redirect, type AppLoadContext } from "@remix-run/node";
import { z } from "zod";
import { logger } from "~/utils/logger";
import { getProxyHeaders } from "~/utils/proxy-headers.server";

/**
 * 🔐 SYSTÈME D'AUTHENTIFICATION UNIFIÉ
 *
 * Combine les meilleures fonctionnalités des deux systèmes précédents :
 * - Support context (pages admin) ET request (pages utilisateur)
 * - Interface cohérente pour toutes les pages
 * - Gestion d'erreurs robuste
 */

// Interface utilisateur unifiée
export interface AuthUser {
  id: string;
  /** Legacy customer ID from the database */
  cst_id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  level?: number;
  isAdmin?: boolean;
  isPro?: boolean;
  isActive?: boolean;
}

/** Shape of the raw user object stored in context by Passport/NestJS session */
interface RawContextUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  level?: number;
  isAdmin?: boolean;
  isPro?: boolean;
  isActive?: boolean;
  error?: string;
}

const authenticatedUserSchema = z.object({
  id: z.coerce.string(),
  email: z.string(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  level: z.number().optional(),
  isAdmin: z.boolean().optional(),
  isPro: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Méthode principale pour récupérer un utilisateur (avec context)
 * Utilisée par les pages admin qui ont accès au context
 */
export const getOptionalUser = async ({
  context,
}: {
  context: AppLoadContext;
}): Promise<AuthUser | null> => {
  try {
    if (context.user && typeof context.user === "object") {
      const rawUser = context.user as RawContextUser;
      if (rawUser.error) {
        return null;
      }
      const user = authenticatedUserSchema
        .optional()
        .nullable()
        .parse(context.user);
      if (user) {
        return {
          id: rawUser.id ?? "",
          email: rawUser.email ?? "",
          firstName: rawUser.firstName,
          lastName: rawUser.lastName || rawUser.name,
          name: rawUser.name,
          level: rawUser.level || 1,
          isAdmin: rawUser.isAdmin || false,
          isPro: rawUser.isPro || false,
          isActive: rawUser.isActive !== false,
        };
      }
    }

    return null;
  } catch (error) {
    logger.error("❌ [Unified Auth] Erreur dans getOptionalUser:", error);
    return null;
  }
};

/**
 * Méthode alternative pour récupérer un utilisateur (avec request)
 * Utilisée par les pages utilisateur qui n'ont que la request
 */
export const getAuthUser = async (
  request: Request,
): Promise<AuthUser | null> => {
  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

    // D'abord, essayer l'endpoint de validation de session (sans guard)
    const validationResponse = await fetch(`${baseUrl}/auth/validate-session`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: request.headers.get("Cookie") || "",
        ...getProxyHeaders(request),
      },
    });

    // Si validation réussit, utiliser ces données
    if (validationResponse.ok) {
      const sessionData = await validationResponse.json();

      if (sessionData.valid && sessionData.user) {
        return {
          id: sessionData.user.id,
          email: sessionData.user.email || sessionData.user.cst_mail,
          firstName: sessionData.user.firstName || sessionData.user.cst_prenom,
          lastName: sessionData.user.lastName || sessionData.user.cst_nom,
          name: sessionData.user.name,
          level: sessionData.user.level || (sessionData.user.isPro ? 5 : 1),
          isAdmin: sessionData.user.isAdmin || false,
          isPro: sessionData.user.isPro || false,
          isActive: sessionData.user.isActive !== false,
        };
      }
    }

    // Si validation échoue, essayer l'endpoint profile (avec guard) pour compatibilité
    logger.log(
      "❌ [Unified Auth] Session validation failed, trying profile endpoint",
    );

    const profileResponse = await fetch(`${baseUrl}/api/users/profile`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: request.headers.get("Cookie") || "",
        ...getProxyHeaders(request),
      },
    });

    // Gérer les erreurs 403/401 comme non-authentifié (pas une vraie erreur)
    if (!profileResponse.ok) {
      if (profileResponse.status === 403 || profileResponse.status === 401) {
        logger.log("❌ [Unified Auth] User not authenticated (403/401)");
        return null;
      }
      logger.log(
        "❌ [Unified Auth] Profile endpoint error:",
        profileResponse.status,
      );
      return null;
    }

    const userData = await profileResponse.json();

    if (userData.error || !userData.id) {
      logger.log("❌ [Unified Auth] Invalid user data:", userData);
      return null;
    }

    return {
      id: userData.id,
      email: userData.email || userData.cst_mail,
      firstName: userData.firstName || userData.cst_prenom,
      lastName: userData.lastName || userData.cst_nom,
      name: userData.name,
      level: userData.level || (userData.isPro ? 5 : 1),
      isAdmin: userData.isAdmin || false,
      isPro: userData.isPro || false,
      isActive: userData.isActive !== false,
    };
  } catch (error) {
    logger.error("❌ [Unified Auth] Erreur dans getAuthUser:", error);
    return null;
  }
};

/**
 * 👤 FONCTIONS POUR PAGES UTILISATEUR (account.*)
 */

export const requireUser = async ({
  context,
  request,
}: {
  context: AppLoadContext;
  request?: Request;
}): Promise<AuthUser> => {
  const user = await getOptionalUser({ context });
  if (!user) {
    // Logs corrélés pour diagnostic boucle auth
    const fromUrl = request?.url || "unknown";
    const referer = request?.headers?.get("referer") || "none";
    const hasCookie =
      request?.headers?.get("cookie")?.includes("connect.sid") || false;
    logger.warn("[Unified Auth] redirect to login", {
      from: fromUrl,
      referer,
      hasCookie,
      cause: hasCookie ? "session_expired_or_invalid" : "no_session",
    });
    throw redirect("/login");
  }
  return user;
};

export const requireAuth = async (
  requestOrOptions:
    | Request
    | { request: Request; context?: AppLoadContext; redirectTo?: string },
): Promise<AuthUser> => {
  let request: Request;
  let redirectTo = "/login";

  if (requestOrOptions instanceof Request) {
    request = requestOrOptions;
  } else {
    request = requestOrOptions.request;
    redirectTo = requestOrOptions.redirectTo || "/login";
  }

  const user = await getAuthUser(request);
  if (!user) {
    logger.log("❌ [Unified Auth] requireAuth: Redirection vers login");
    const url = request.url;
    if (url && url !== "undefined") {
      const pathname = new URL(url).pathname;
      throw redirect(
        `${redirectTo}?redirectTo=` + encodeURIComponent(pathname),
      );
    } else {
      throw redirect(redirectTo);
    }
  }
  return user;
};

export const requireUserWithRedirect = async ({
  request,
  context,
}: {
  request: Request;
  context: AppLoadContext;
}): Promise<AuthUser> => {
  const user = await getOptionalUser({ context });
  if (!user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    logger.log(
      "❌ [Unified Auth] requireUserWithRedirect: Redirection avec URL",
    );
    throw redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }
  return user;
};

/**
 * 👑 FONCTIONS POUR PAGES ADMIN (admin.*)
 */

export const requireAdmin = async ({
  context,
}: {
  context: AppLoadContext;
}): Promise<AuthUser> => {
  const user = await getOptionalUser({ context });

  if (!user) {
    logger.log("❌ [Unified Auth] requireAdmin: Pas d'utilisateur connecté");
    throw redirect("/login");
  }

  // Vérifier si c'est un admin (niveau 7+ ou isAdmin)
  const userLevel = user.level || (user.isPro ? 5 : 1);
  if (!user.isAdmin && userLevel < 7) {
    logger.log("❌ [Unified Auth] requireAdmin: Utilisateur non admin", {
      level: userLevel,
      isAdmin: user.isAdmin,
    });
    throw redirect("/unauthorized");
  }

  logger.log("✅ [Unified Auth] Admin autorisé", {
    level: userLevel,
    isAdmin: user.isAdmin,
  });
  return user;
};

/**
 * 🔄 FONCTIONS UTILITAIRES
 */

export const redirectIfAuthenticated = async ({
  context,
}: {
  context: AppLoadContext;
}) => {
  const user = await getOptionalUser({ context });
  if (user) {
    logger.log(
      "🔄 [Unified Auth] Utilisateur déjà connecté, redirection vers dashboard",
    );
    throw redirect("/");
  }
  return null;
};

// Export par défaut pour faciliter l'import
export default {
  getOptionalUser,
  getAuthUser,
  requireUser,
  requireAuth,
  requireUserWithRedirect,
  requireAdmin,
  redirectIfAuthenticated,
};
