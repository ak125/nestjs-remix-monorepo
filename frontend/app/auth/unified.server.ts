import { redirect, type AppLoadContext } from "@remix-run/node";
import { z } from "zod";

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
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  level?: number;
  isAdmin?: boolean;
  isPro?: boolean;
  isActive?: boolean;
}

const authenticatedUserSchema = z.object({
  id: z.coerce.string(),
  email: z.string(),
  name: z.string().optional(),
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
    if (
      context.user &&
      typeof context.user === "object" &&
      !(context.user as any).error
    ) {
      const user = authenticatedUserSchema
        .optional()
        .nullable()
        .parse(context.user);
      if (user) {
        // Debug log désactivé pour éviter spam
        // console.log('✅ [Unified Auth] Utilisateur trouvé dans la session via context');

        return {
          id: (context.user as any).id,
          email: (context.user as any).email,
          firstName: (context.user as any).firstName,
          lastName:
            (context.user as any).lastName || (context.user as any).name,
          name: (context.user as any).name,
          level: (context.user as any).level || 1,
          isAdmin: (context.user as any).isAdmin || false,
          isPro: (context.user as any).isPro || false,
          isActive: (context.user as any).isActive !== false,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("❌ [Unified Auth] Erreur dans getOptionalUser:", error);
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
      },
    });

    // Si validation réussit, utiliser ces données
    if (validationResponse.ok) {
      const sessionData = await validationResponse.json();

      if (sessionData.valid && sessionData.user) {
        // Debug log désactivé pour éviter spam
        // console.log('✅ [Unified Auth] Utilisateur trouvé via session validation');

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
    console.log(
      "❌ [Unified Auth] Session validation failed, trying profile endpoint",
    );

    const profileResponse = await fetch(`${baseUrl}/api/users/profile`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    // Gérer les erreurs 403/401 comme non-authentifié (pas une vraie erreur)
    if (!profileResponse.ok) {
      if (profileResponse.status === 403 || profileResponse.status === 401) {
        console.log("❌ [Unified Auth] User not authenticated (403/401)");
        return null;
      }
      console.log(
        "❌ [Unified Auth] Profile endpoint error:",
        profileResponse.status,
      );
      return null;
    }

    const userData = await profileResponse.json();

    if (userData.error || !userData.id) {
      console.log("❌ [Unified Auth] Invalid user data:", userData);
      return null;
    }

    // Debug log désactivé pour éviter spam
    // console.log('✅ [Unified Auth] Utilisateur trouvé via profile endpoint');

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
    console.error("❌ [Unified Auth] Erreur dans getAuthUser:", error);
    return null;
  }
};

/**
 * 👤 FONCTIONS POUR PAGES UTILISATEUR (account.*)
 */

export const requireUser = async ({
  context,
}: {
  context: AppLoadContext;
}): Promise<AuthUser> => {
  const user = await getOptionalUser({ context });
  if (!user) {
    console.log("❌ [Unified Auth] requireUser: Pas d'utilisateur connecté");
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
    console.log("❌ [Unified Auth] requireAuth: Redirection vers login");
    const url = request.url;
    if (url && url !== "undefined") {
      const pathname = new URL(url).pathname;
      throw redirect(`${redirectTo}?redirect=` + encodeURIComponent(pathname));
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
    console.log(
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
    console.log("❌ [Unified Auth] requireAdmin: Pas d'utilisateur connecté");
    throw redirect("/login");
  }

  // Vérifier si c'est un admin (niveau 7+ ou isAdmin)
  const userLevel = user.level || (user.isPro ? 5 : 1);
  if (!user.isAdmin && userLevel < 7) {
    console.log("❌ [Unified Auth] requireAdmin: Utilisateur non admin", {
      level: userLevel,
      isAdmin: user.isAdmin,
    });
    throw redirect("/unauthorized");
  }

  console.log("✅ [Unified Auth] Admin autorisé", {
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
    console.log(
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
