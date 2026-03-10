/**
 * 🔄 ROUTE DE MIGRATION AUTOMATIQUE - ANCIENNES URLs PIÈCES
 *
 * Route catch-all pour intercepter les anciennes URLs de pièces
 * et effectuer des redirections 301 automatiques vers la nouvelle structure
 *
 * Pattern capturé: /pieces/{category-name-id}/{brand-brandId}/{model-modelId}/{type-typeId}.html
 *
 * @version 1.0.0
 * @since 2025-09-14
 * @author SEO Migration Team
 */

import {
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";

// ====================================
// 🎯 INTERFACES & TYPES
// ====================================

interface MigrationResult {
  success: boolean;
  legacy_url: string;
  new_url?: string;
  metadata?: {
    migration_type: string;
    legacy_category: string;
    modern_category: string;
    vehicle_brand: string;
    vehicle_model: string;
    vehicle_type: string;
    seo_keywords: string[];
  };
  error?: string;
}

function buildNoindexNotFoundResponse(message: string): Response {
  return new Response(message, {
    status: 404,
    headers: { "X-Robots-Tag": "noindex, follow" },
  });
}

// ====================================
// 🔧 UTILITAIRES DE MIGRATION
// ====================================

/**
 * Appelle l'API de migration backend pour tester une URL
 * @param legacyUrl - L'URL legacy à tester
 * @param baseUrl - L'URL de base de l'API (passée depuis le loader)
 */
async function testUrlMigration(
  legacyUrl: string,
  baseUrl: string,
): Promise<MigrationResult> {
  try {
    const encodedUrl = encodeURIComponent(legacyUrl);
    const response = await fetch(
      `${baseUrl}/api/vehicles/migration/test/${encodedUrl}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      legacy_url: legacyUrl,
      new_url: data.migration?.new_url,
      metadata: data.migration?.metadata,
    };
  } catch (error) {
    logger.error("Erreur test migration:", error);
    return {
      success: false,
      legacy_url: legacyUrl,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

/**
 * Effectue une redirection 301 si la migration est possible
 */
async function _performRedirection(
  legacyUrl: string,
  baseUrl: string,
): Promise<Response | null> {
  const migration = await testUrlMigration(legacyUrl, baseUrl);

  if (migration.success && migration.new_url) {
    // Redirection 301 permanente pour le SEO
    return redirect(migration.new_url, { status: 301 });
  }

  return null;
}

// ====================================
// 📡 LOADER FUNCTION
// ====================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const legacyUrl = url.pathname;
  // Get base URL from request origin (server-side only)
  const baseUrl = url.origin;

  logger.log(`🔄 Interception URL: ${legacyUrl}`);

  // Vérifier si c'est bien une URL de pièce
  if (!legacyUrl.includes("/pieces/") || !legacyUrl.endsWith(".html")) {
    throw buildNoindexNotFoundResponse("URL non reconnue comme URL de pièce");
  }

  // Vérifier si c'est une URL de pièces avec véhicule (4 segments)
  const vehiclePattern = /^\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+$/;
  if (vehiclePattern.test(legacyUrl)) {
    logger.log(
      "🔧 [PIECES V4] URL pièces avec véhicule détectée, laissant passer pour pieces.$gamme.$marque.$modele.$type.tsx",
    );
    throw buildNoindexNotFoundResponse(
      "URL pièces avec véhicule - gérée par la route spécialisée",
    );
  }

  // Pattern pour nos nouvelles URLs gamme simple: /pieces/{alias}-{id}.html
  const newPatternMatch = legacyUrl.match(/\/pieces\/(.+)-(\d+)\.html$/);

  if (newPatternMatch) {
    const [, alias, gammeId] = newPatternMatch;
    logger.log(
      `✅ [PIECES V4] URL gamme simple détectée: alias=${alias}, gammeId=${gammeId}`,
    );
    // URL gamme simple - rediriger vers pieces.$slug.tsx
    throw buildNoindexNotFoundResponse(
      "URL gamme simple - gérée par pieces.$slug.tsx",
    );
  }

  // Sinon, tenter la migration avec l'ancien système
  const migration = await testUrlMigration(legacyUrl, baseUrl);

  // Si migration réussie, redirection 301 immédiate (tous environnements)
  if (migration.success && migration.new_url) {
    return redirect(migration.new_url, { status: 301 });
  }

  // Si migration échouée, rediriger vers l'accueil
  // Cela évite que Google indexe des pages "Page déplacée" ou "undefined"
  return redirect("/", { status: 301 });
};

// ====================================
// 🎯 META FUNCTION
// ====================================

export const meta: MetaFunction<typeof loader> = () => {
  // Cette route fait toujours un 301 redirect, donc le meta ne sera jamais visible.
  // Mais on garde un fallback propre au cas où.
  return [
    { title: "Redirection - Pièces Auto | Automecanik" },
    {
      name: "description",
      content: "Cette page a été déplacée. Redirection automatique en cours.",
    },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export function headers({
  loaderHeaders,
  errorHeaders,
}: {
  loaderHeaders: Headers;
  errorHeaders: Headers | undefined;
}) {
  const robotsTag =
    errorHeaders?.get("X-Robots-Tag") || loaderHeaders.get("X-Robots-Tag");

  return robotsTag ? { "X-Robots-Tag": robotsTag } : {};
}

// ====================================
// 🎨 COMPOSANT PRINCIPAL
// ====================================

export default function LegacyPartUrlMigrationPage() {
  // Le loader fait toujours un 301 redirect, ce composant ne devrait jamais s'afficher.
  // Fallback de sécurité uniquement.
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Redirection en cours...
        </h1>
        <p className="text-gray-600">
          Si vous n'êtes pas redirigé automatiquement,{" "}
          <Link to="/" className="text-blue-600 underline">
            cliquez ici
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP avec composants
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
