import { Link } from "@remix-run/react";
import { Fuel, Gauge, Calendar, Car, Package } from "lucide-react";
import { useEffect } from "react";
import { useErrorAutoReport } from "../../hooks/useErrorAutoReport";
import { ErrorSearchBar } from "./ErrorSearchBar";

// Types pour données de substitution (Moteur 200 Always)
// V3: Ajout des métadonnées véhicule
interface VehicleMetadata {
  fuel?: string | null;
  power?: string | null;
  years?: string | null;
  body?: string | null;
}

interface SubstitutionLock {
  type: "vehicle" | "technology" | "ambiguity" | "precision";
  missing: string;
  known: {
    gamme?: { id: number; name: string; alias: string };
    marque?: { id: number; name: string };
    modele?: { id: number; name: string };
    type?: { id: number; name: string };
  };
  options: Array<{
    id: number;
    label: string;
    url: string;
    description?: string;
    metadata?: VehicleMetadata;
  }>;
}

interface SubstitutionSubstitute {
  piece_id: number;
  name: string;
  price: number;
  priceFormatted?: string;
  image?: string;
  brand?: string;
  ref?: string;
  url: string;
}

interface SubstitutionRelatedPart {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_pic?: string;
  url: string;
}

// V3: Gammes compatibles avec le véhicule
interface CompatibleGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_pic?: string;
  total_pieces: number;
  url: string;
}

interface SubstitutionData {
  lock?: SubstitutionLock;
  substitute?: SubstitutionSubstitute;
  relatedParts?: SubstitutionRelatedPart[];
  compatibleGammes?: CompatibleGamme[];
  seo?: {
    title: string;
    description: string;
    h1: string;
  };
}

interface Error412Props {
  url?: string;
  condition?: string;
  requirement?: string;
  userAgent?: string;
  referrer?: string;
  method?: string;
  // Données de substitution (Moteur 200 Always)
  substitution?: SubstitutionData;
}

export function Error412({
  url,
  condition,
  requirement,
  substitution,
}: Error412Props) {
  // Reporting centralisé via hook
  useErrorAutoReport({
    code: 412,
    url,
    message: "Condition préalable échouée",
    metadata: { condition, requirement, hasSubstitution: !!substitution },
  });

  // Déterminer si on a des données de substitution (mode haut funnel)
  const hasSubstitutionData =
    !!substitution?.lock || !!substitution?.substitute;

  // SEO: index, follow pour pages 412 haut funnel (substitution)
  // Ces pages sont indexables car elles offrent du contenu utile
  useEffect(() => {
    const robotsContent = hasSubstitutionData
      ? "index, follow"
      : "noindex, follow";
    const meta = document.querySelector('meta[name="robots"]');
    if (meta) {
      meta.setAttribute("content", robotsContent);
    } else {
      const newMeta = document.createElement("meta");
      newMeta.name = "robots";
      newMeta.content = robotsContent;
      document.head.appendChild(newMeta);
    }
  }, [hasSubstitutionData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section avec Animation 412 */}
          <div className="text-center mb-12">
            <div className="mb-8">
              <div className="relative inline-block">
                <span className="text-9xl font-bold text-yellow-200">412</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-32 h-32 text-yellow-500 animate-pulse"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Condition préalable échouée
            </h1>

            <p className="text-lg text-gray-600 mb-8">
              Une condition préalable spécifiée dans votre requête n'a pas été
              satisfaite.
            </p>

            {/* URL demandée */}
            {url && (
              <div className="mb-8 p-4 bg-white rounded-lg shadow-sm">
                <p className="text-sm text-gray-600 mb-2">URL demandée :</p>
                <p className="font-mono text-sm text-gray-800 break-all">
                  {url}
                </p>
              </div>
            )}

            {/* Barre de recherche */}
            <div className="mb-8">
              <ErrorSearchBar placeholder="Rechercher une pièce, un véhicule..." />
            </div>
          </div>

          {/* ============================================ */}
          {/* SECTION VOTRE RECHERCHE - Véhicule + Gamme  */}
          {/* ============================================ */}

          {/* Affichage du contexte véhicule + gamme recherché */}
          {substitution?.lock?.known &&
            (substitution.lock.known.gamme ||
              substitution.lock.known.marque) && (
              <div className="mb-8 bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg
                    className="w-5 h-5 text-blue-500 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Votre recherche
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gamme/Famille recherchée */}
                  {substitution.lock.known.gamme && (
                    <div className="flex items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <svg
                        className="w-8 h-8 text-amber-600 mr-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      <div>
                        <span className="text-xs text-amber-600 uppercase tracking-wide font-medium">
                          Famille de pièces
                        </span>
                        <p className="font-semibold text-gray-900">
                          {substitution.lock.known.gamme.name}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Véhicule recherché */}
                  {(substitution.lock.known.marque ||
                    substitution.lock.known.modele) && (
                    <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <svg
                        className="w-8 h-8 text-blue-600 mr-3 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                      <div>
                        <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">
                          Véhicule
                        </span>
                        <p className="font-semibold text-gray-900">
                          {substitution.lock.known.marque?.name}
                          {substitution.lock.known.modele &&
                            ` ${substitution.lock.known.modele.name}`}
                          {substitution.lock.known.type &&
                            ` - ${substitution.lock.known.type.name}`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message explicatif */}
                <p className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <span className="font-medium">Aucun produit disponible</span>{" "}
                  pour cette combinaison exacte. Sélectionnez une motorisation
                  ci-dessous pour voir les pièces compatibles.
                </p>
              </div>
            )}

          {/* ============================================ */}
          {/* V3: SECTION CARACTERISTIQUES VEHICULE       */}
          {/* ============================================ */}

          {/* Afficher les caractéristiques du premier véhicule de la liste */}
          {substitution?.lock?.options?.[0]?.metadata && (
            <div className="mb-8 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Car className="w-5 h-5 text-gray-500 mr-2" />
                Caractéristiques du véhicule
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Carburant */}
                <div className="flex items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <Fuel className="w-8 h-8 text-orange-500 mr-3 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-orange-600 uppercase tracking-wide font-medium">
                      Carburant
                    </span>
                    <p className="font-semibold text-gray-900">
                      {substitution.lock.options[0].metadata.fuel || "N/C"}
                    </p>
                  </div>
                </div>
                {/* Puissance */}
                <div className="flex items-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <Gauge className="w-8 h-8 text-red-500 mr-3 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-red-600 uppercase tracking-wide font-medium">
                      Puissance
                    </span>
                    <p className="font-semibold text-gray-900">
                      {substitution.lock.options[0].metadata.power
                        ? `${substitution.lock.options[0].metadata.power} ch`
                        : "N/C"}
                    </p>
                  </div>
                </div>
                {/* Années */}
                <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Calendar className="w-8 h-8 text-blue-500 mr-3 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">
                      Années
                    </span>
                    <p className="font-semibold text-gray-900">
                      {substitution.lock.options[0].metadata.years || "N/C"}
                    </p>
                  </div>
                </div>
                {/* Carrosserie */}
                <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <Car className="w-8 h-8 text-green-500 mr-3 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-green-600 uppercase tracking-wide font-medium">
                      Carrosserie
                    </span>
                    <p className="font-semibold text-gray-900">
                      {substitution.lock.options[0].metadata.body || "N/C"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* SECTION SUBSTITUTION - Moteur 200 Always    */}
          {/* ============================================ */}

          {/* Sélecteur de motorisation (lock.type === 'vehicle') */}
          {substitution?.lock?.type === "vehicle" &&
            substitution.lock.options.length > 0 && (
              <div className="mb-12 bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <svg
                    className="w-6 h-6 text-blue-500 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Sélectionnez votre motorisation
                  {substitution.lock.known.gamme && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      pour {substitution.lock.known.gamme.name}
                    </span>
                  )}
                </h2>
                <p className="text-gray-600 mb-6">
                  Pour afficher les pièces compatibles, veuillez préciser votre
                  véhicule :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {substitution.lock.options.map((option) => (
                    <Link
                      key={option.id}
                      to={option.url}
                      className="group flex flex-col p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
                    >
                      <span className="font-medium text-gray-900 group-hover:text-blue-700">
                        {option.label}
                      </span>
                      {/* V3: Tags détails véhicule */}
                      {option.metadata && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {option.metadata.fuel && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                              {option.metadata.fuel}
                            </span>
                          )}
                          {option.metadata.power && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                              {option.metadata.power} ch
                            </span>
                          )}
                          {option.metadata.years && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                              {option.metadata.years}
                            </span>
                          )}
                          {option.metadata.body && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                              {option.metadata.body}
                            </span>
                          )}
                        </div>
                      )}
                      {option.description && !option.metadata && (
                        <span className="text-sm text-gray-500 mt-1">
                          {option.description}
                        </span>
                      )}
                      <span className="text-xs text-blue-600 mt-2 group-hover:underline">
                        Voir les pièces →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {/* Best-seller / Produit de substitution */}
          {substitution?.substitute && (
            <div className="mb-12 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <svg
                  className="w-6 h-6 text-green-500 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                Notre recommandation
              </h2>
              <Link
                to={substitution.substitute.url}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-white rounded-lg border border-green-200 hover:border-green-400 hover:shadow-lg transition-all duration-200"
              >
                {substitution.substitute.image && (
                  <img
                    src={substitution.substitute.image}
                    alt={substitution.substitute.name}
                    className="w-24 h-24 object-contain rounded-lg bg-gray-50"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {substitution.substitute.name}
                  </h3>
                  {substitution.substitute.brand && (
                    <p className="text-sm text-gray-600">
                      Marque : {substitution.substitute.brand}
                    </p>
                  )}
                  {substitution.substitute.ref && (
                    <p className="text-xs text-gray-500 font-mono">
                      Réf : {substitution.substitute.ref}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {substitution.substitute.priceFormatted ||
                      `${substitution.substitute.price.toFixed(2)} €`}
                  </p>
                  <span className="inline-block mt-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600">
                    Voir le produit
                  </span>
                </div>
              </Link>
            </div>
          )}

          {/* ============================================ */}
          {/* V3: CATALOGUE GAMMES COMPATIBLES            */}
          {/* ============================================ */}

          {/* Gammes compatibles avec le premier véhicule */}
          {substitution?.compatibleGammes &&
            substitution.compatibleGammes.length > 0 && (
              <div className="mb-12 bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Package className="w-6 h-6 text-indigo-500 mr-2" />
                  Catalogue de pièces disponibles
                </h2>
                <p className="text-gray-600 mb-6">
                  {substitution.compatibleGammes.length} familles de pièces
                  compatibles avec ce type de véhicule
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {substitution.compatibleGammes.slice(0, 12).map((gamme) => (
                    <Link
                      key={gamme.pg_id}
                      to={gamme.url}
                      className="group flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200"
                    >
                      {gamme.pg_pic && (
                        <img
                          src={gamme.pg_pic}
                          alt={gamme.pg_name}
                          className="w-12 h-12 object-contain mb-2"
                          loading="lazy"
                        />
                      )}
                      <span className="text-sm text-center text-gray-700 group-hover:text-indigo-700 line-clamp-2">
                        {gamme.pg_name}
                      </span>
                      <span className="text-xs text-gray-400 mt-1">
                        {gamme.total_pieces} pièces
                      </span>
                    </Link>
                  ))}
                </div>
                {substitution.compatibleGammes.length > 12 && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    + {substitution.compatibleGammes.length - 12} autres
                    familles disponibles
                  </p>
                )}
              </div>
            )}

          {/* Pièces connexes / Related parts */}
          {substitution?.relatedParts &&
            substitution.relatedParts.length > 0 && (
              <div className="mb-12 bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <svg
                    className="w-6 h-6 text-purple-500 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  Pièces dans la même catégorie
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {substitution.relatedParts.map((part) => (
                    <Link
                      key={part.pg_id}
                      to={part.url}
                      className="group flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all duration-200"
                    >
                      {part.pg_pic && (
                        <img
                          src={part.pg_pic}
                          alt={part.pg_name}
                          className="w-12 h-12 object-contain mb-2"
                        />
                      )}
                      <span className="text-sm text-center text-gray-700 group-hover:text-purple-700 line-clamp-2">
                        {part.pg_name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {/* ============================================ */}
          {/* FIN SECTION SUBSTITUTION                    */}
          {/* ============================================ */}

          {/* Détails de l'erreur (affiché seulement si pas de substitution) */}
          {!hasSubstitutionData && (
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Condition échouée */}
              {condition && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-yellow-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Condition échouée
                      </h3>
                      <p className="text-gray-600 text-sm">{condition}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Requirement */}
              {requirement && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">
                        Requis
                      </h3>
                      <p className="text-gray-600 text-sm">{requirement}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid d'actions principales (toujours affiché) */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              {hasSubstitutionData ? "Autres options" : "Actions recommandées"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => window.location.reload()}
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-yellow-500 mb-3 group-hover:text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Actualiser
                </span>
              </button>

              <Link
                to="/"
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-blue-500 mb-3 group-hover:text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Accueil
                </span>
              </Link>

              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.history.back();
                  }
                }}
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-green-500 mb-3 group-hover:text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16l-4-4m0 0l4-4m-4 4h18"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Retour
                </span>
              </button>

              <Link
                to="/contact"
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-purple-500 mb-3 group-hover:text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Support
                </span>
              </Link>
            </div>
          </div>

          {/* Sections d'aide (masquées si substitution) */}
          {!hasSubstitutionData && (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Causes communes */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg
                    className="w-5 h-5 text-orange-500 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  Causes communes
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    Version de contenu obsolète ou modifiée
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    En-têtes de cache ou ETags non correspondants
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    Conditions de modification temporelle non satisfaites
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    Permissions ou authentification requises
                  </li>
                </ul>
              </div>

              {/* Solutions */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Solutions suggérées
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    Actualiser la page pour obtenir la dernière version
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    Vider le cache de votre navigateur
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    Vérifier vos autorisations d'accès
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    Réessayer votre requête avec de nouveaux paramètres
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Footer d'assistance */}
          <div className="mt-12 text-center">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-gray-600">
                Si le problème persiste après avoir essayé ces solutions,{" "}
                <Link
                  to="/contact"
                  className="text-yellow-600 hover:text-yellow-700 font-medium"
                >
                  contactez notre support technique
                </Link>{" "}
                avec le code d'erreur{" "}
                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                  412
                </span>
                .
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Notre équipe vous aidera à résoudre ce problème de condition
                préalable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
