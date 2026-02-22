// app/routes/$.tsx - Catch-all route pour 404 - Version Optimisée
import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { Error404 } from "~/components/errors/Error404";
import { Error410 } from "~/components/errors/Error410";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => [
  { title: "Page non trouvée | Automecanik" },
  {
    name: "description",
    content: "La page que vous recherchez n'existe pas ou a été déplacée.",
  },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 0a. Short-circuit URLs garbage (base64 spam, bots) — évite 3 appels API inutiles
  if (isGarbageUrl(pathname)) {
    throw json(
      { url: pathname, message: "Contenu supprimé" },
      {
        status: 410,
        headers: {
          "Cache-Control": "public, max-age=86400",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }

  // 0b. Redirections rapides pour patterns connus (évite l'appel API)
  const quickRedirect = resolveKnownPattern(pathname);
  if (quickRedirect) {
    return redirect(quickRedirect, 301);
  }

  try {
    // 1. Logger l'erreur 404 avec métadonnées enrichies
    const errorData = {
      code: 404,
      url: pathname,
      userAgent: request.headers.get("user-agent") || undefined,
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      referrer: request.headers.get("referer") || undefined,
      metadata: {
        method: request.method,
        query: Object.fromEntries(url.searchParams),
        timestamp: new Date().toISOString(),
        originalUrl: request.url,
      },
    };

    // Log via l'API interne optimisée
    try {
      await fetch(
        `${process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:3000"}/api/errors/log`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Internal-Call": "true",
          },
          body: JSON.stringify(errorData),
        },
      );
    } catch (logError) {
      logger.error("Erreur lors du logging 404:", logError);
      // Continue malgré l'erreur de logging
    }

    // 2. Vérifier s'il existe une redirection via API optimisée
    try {
      const redirectResponse = await fetch(
        `${process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:3000"}/api/redirects/check?url=${encodeURIComponent(pathname)}`,
        {
          headers: { "Internal-Call": "true" },
        },
      );

      if (redirectResponse.ok) {
        const redirectData = await redirectResponse.json();
        if (redirectData.found && redirectData.destination) {
          // Redirection trouvée - appliquer immédiatement
          throw new Response(null, {
            status: redirectData.permanent ? 301 : 302,
            headers: {
              Location: redirectData.destination,
              "Cache-Control": redirectData.permanent
                ? "public, max-age=31536000"
                : "no-cache",
            },
          });
        }
      }
    } catch (redirectError) {
      if (redirectError instanceof Response) {
        // Re-throw les redirections valides
        throw redirectError;
      }
      logger.error(
        "Erreur lors de la vérification de redirection:",
        redirectError,
      );
      // Continue malgré l'erreur de redirection
    }

    // 2.5 Gérer les URLs legacy /pieces-auto/{alias}
    // Si l'alias correspond à une gamme existante → 301 redirect
    // Sinon → 410 Gone
    if (pathname.startsWith("/pieces-auto/")) {
      try {
        const legacyResponse = await fetch(
          `${process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:3000"}/api/redirects/resolve-legacy?url=${encodeURIComponent(pathname)}`,
          {
            headers: { "Internal-Call": "true" },
          },
        );

        if (legacyResponse.ok) {
          const legacyData = await legacyResponse.json();

          if (legacyData.found && legacyData.destination) {
            // Gamme trouvée - 301 redirect vers la nouvelle URL
            logger.log(
              `[SEO] Legacy URL resolved: ${pathname} → ${legacyData.destination}`,
            );
            throw new Response(null, {
              status: 301,
              headers: {
                Location: legacyData.destination,
                "Cache-Control": "public, max-age=31536000",
                "X-Redirect-Reason": "legacy-pieces-auto-resolved",
              },
            });
          } else {
            // Gamme non trouvée - 410 Gone
            logger.log(
              `[SEO] Legacy URL not resolved, returning 410: ${pathname}`,
            );
            throw json(
              {
                url: pathname,
                message:
                  "Cette page a été définitivement supprimée. Le contenu n'est plus disponible.",
                isOldLink: true,
                reason: legacyData.reason || "URL legacy non résolue",
              },
              {
                status: 410,
                headers: {
                  "Cache-Control": "public, max-age=86400", // Cache 24h
                  "X-Robots-Tag": "noindex, follow",
                },
              },
            );
          }
        }
      } catch (legacyError) {
        if (legacyError instanceof Response) {
          throw legacyError;
        }
        logger.error("Erreur résolution URL legacy:", legacyError);
        // En cas d'erreur, continuer vers le 404 standard
      }
    }

    // 3. Récupérer des suggestions intelligentes
    let suggestions: string[] = [];
    try {
      const suggestionsResponse = await fetch(
        `${process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:3000"}/api/errors/suggestions?url=${encodeURIComponent(pathname)}`,
        {
          headers: { "Internal-Call": "true" },
        },
      );

      if (suggestionsResponse.ok) {
        const suggestionsData = await suggestionsResponse.json();
        suggestions = suggestionsData.suggestions || [];
      }
    } catch (suggestionsError) {
      logger.error(
        "Erreur lors de la récupération des suggestions:",
        suggestionsError,
      );
      // Continue avec suggestions vides
    }

    // 4. Déterminer le type d'erreur et les données à retourner
    const errorResponseData = {
      url: pathname,
      suggestions,
      isOldLink: await checkIfOldLink(pathname),
      context: {
        userAgent: errorData.userAgent,
        referrer: errorData.referrer,
        timestamp: errorData.metadata.timestamp,
        method: request.method,
      },
    };

    // 5. Vérifier si c'est un ancien lien connu (logique 410)
    if (errorResponseData.isOldLink) {
      throw json(
        {
          ...errorResponseData,
          message: "Ce contenu a été définitivement supprimé ou déplacé",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "public, max-age=86400", // Cache 24h pour accélérer la désindexation
            "X-Robots-Tag": "noindex",
          },
        },
      );
    }

    // 6. Retourner erreur 404 enrichie avec suggestions
    throw json(
      {
        ...errorResponseData,
        message: "Page non trouvée",
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-cache", // Ne pas cacher les 404
        },
      },
    );
  } catch (error) {
    // Si c'est une Response (redirection ou erreur JSON), la re-lancer
    if (error instanceof Response) {
      throw error;
    }

    // Pour toute autre erreur, fallback vers 404 basique
    logger.error("Erreur dans catch-all route:", error);
    throw json(
      {
        url: pathname,
        message: "Page non trouvée",
        error: "Une erreur technique s'est produite lors de la vérification",
      },
      { status: 404 },
    );
  }
}

/**
 * Détecte les URLs manifestement non-valides (base64 spam, bots, tokens).
 * Retourne true pour court-circuiter AVANT tout appel API (économie de 3 fetch/requête).
 */
function isGarbageUrl(pathname: string): boolean {
  // Base64-encoded strings: /wl8k5m6HsSkVW3cXi61ZQ==
  if (/^\/[A-Za-z0-9+/]{8,}={1,2}$/.test(pathname)) return true;

  // Base64-like with special chars in path: /RusC1gZF2/22ANy4XK+TA==
  if (/[+]/.test(pathname) && /={1,2}$/.test(pathname)) return true;

  // Single segment with no extension, > 20 chars, mostly alphanumeric (hash/token)
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length === 1 &&
    segments[0].length > 20 &&
    !/\./.test(segments[0]) &&
    /^[A-Za-z0-9+/=]+$/.test(segments[0])
  ) {
    return true;
  }

  return false;
}

/**
 * Résout les patterns d'URLs connus vers leur nouvelle destination.
 * Exécuté AVANT l'appel API pour une résolution instantanée.
 */
function resolveKnownPattern(pathname: string): string | null {
  // /blog-pieces-auto/guide/* → /blog-pieces-auto/guide-achat/* (manque le "-achat")
  if (
    pathname.startsWith("/blog-pieces-auto/guide/") &&
    !pathname.startsWith("/blog-pieces-auto/guide-achat/")
  ) {
    return pathname.replace(
      "/blog-pieces-auto/guide/",
      "/blog-pieces-auto/guide-achat/",
    );
  }

  // /blog/* → /blog-pieces-auto/* (legacy blog URLs)
  if (
    pathname.startsWith("/blog/") &&
    !pathname.startsWith("/blog-pieces-auto/")
  ) {
    return "/blog-pieces-auto" + pathname.slice(5);
  }

  // /blog → /blog-pieces-auto
  if (pathname === "/blog") {
    return "/blog-pieces-auto";
  }

  // /conseils/* → /blog-pieces-auto/conseils/*
  if (pathname.startsWith("/conseils/")) {
    return "/blog-pieces-auto" + pathname;
  }

  // /guide/* → /blog-pieces-auto/guide-achat/*
  if (pathname.startsWith("/guide/") || pathname.startsWith("/guides/")) {
    const rest = pathname.replace(/^\/guides?\//, "/guide-achat/");
    return "/blog-pieces-auto" + rest;
  }

  // /constructeur/* → /constructeurs/* (singulier → pluriel)
  if (
    pathname.startsWith("/constructeur/") &&
    !pathname.startsWith("/constructeurs/")
  ) {
    return "/constructeurs/" + pathname.slice(14);
  }

  // Trailing .html sur des URLs non-pièces → retirer le .html
  if (pathname.endsWith(".html") && !pathname.startsWith("/pieces/")) {
    return pathname.slice(0, -5);
  }

  // Double slashes → normaliser
  if (pathname.includes("//")) {
    return pathname.replace(/\/+/g, "/");
  }

  return null;
}

/**
 * Vérifie si une URL correspond à un ancien lien connu
 * Logique métier pour détecter les liens obsolètes (410)
 */
async function checkIfOldLink(pathname: string): Promise<boolean> {
  try {
    // Patterns d'anciens liens connus qui devraient retourner 410
    const oldLinkPatterns = [
      /^\/old-/, // URLs commençant par /old-
      /^\/archive\//, // URLs d'archive
      /^\/legacy\//, // URLs legacy
      /^\/deprecated\//, // URLs dépréciées
      /\.old$/, // URLs finissant par .old
      /\/[0-9]{4}\/old\//, // Patterns avec année et "old"
      /^\/piece\//, // URLs legacy /piece/* (~90K URLs à désindexer)
      /^\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html\//, // Extra segments après .html (legacy pagination)
      /^\/reference-auto\//, // Anciennes pages référence
    ];

    // Vérifier si l'URL match un pattern d'ancien lien
    const isOldPattern = oldLinkPatterns.some((pattern) =>
      pattern.test(pathname),
    );

    if (isOldPattern) {
      return true;
    }

    // Vérifier dans une liste d'URLs spécifiques connues comme obsolètes
    // (Cette liste pourrait venir d'une API ou base de données)
    const knownOldLinks = [
      "/old-contact",
      "/old-about",
      "/old-products",
      "/contact-old",
      "/about-old",
    ];

    return knownOldLinks.includes(pathname);
  } catch (error) {
    logger.error("Erreur lors de la vérification ancien lien:", error);
    return false; // En cas d'erreur, on assume que ce n'est pas un ancien lien
  }
}

// ============================================================
// COMPOSANT + ERROR BOUNDARY LOCAL (Requis pour HTML rendering)
// ============================================================

/**
 * Composant par défaut (jamais rendu car le loader throw toujours)
 * Requis par Remix pour activer l'ErrorBoundary
 */
export default function CatchAllRoute() {
  return null;
}

/**
 * ErrorBoundary locale - Capture les erreurs du loader et rend HTML
 * Plus robuste que de dépendre de root.tsx ErrorBoundary
 */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const data = error.data || {};

    // 410 Gone - Contenu supprimé
    if (error.status === 410) {
      return (
        <Error410
          url={data.url}
          isOldLink={data.isOldLink}
          redirectTo={data.redirectTo}
        />
      );
    }

    // 404 Not Found (default)
    return <Error404 url={data.url} suggestions={data.suggestions} />;
  }

  // Erreur JavaScript non-Response (fallback)
  return (
    <Error404
      url={typeof window !== "undefined" ? window.location.pathname : ""}
    />
  );
}
