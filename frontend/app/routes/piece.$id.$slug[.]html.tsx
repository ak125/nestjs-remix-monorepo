/**
 * 🛠️ Route Détail Pièce
 * URL: /piece/{id}/{slug}.html
 *
 * Page détail d'une pièce automobile avec toutes les informations :
 * - Images produit
 * - Prix et disponibilité
 * - Compatibilités véhicules
 * - Cross-selling
 * - SEO optimisé
 */

import {
  type LoaderFunctionArgs,
  json,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";

// Types
interface PieceDetail {
  id: number;
  nom: string;
  marque: string;
  reference: string;
  prix_ttc: number;
  image: string;
  images: string[];
  dispo: boolean;
  qualite: string;
  nb_stars?: number;
  description?: string;
  marque_logo?: string;
}

interface LoaderData {
  piece: PieceDetail;
  vehiclesCompatibles: any[];
  crossSelling: any[];
}

/**
 * 📥 Loader - Récupération des données pièce
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { id, slug: _slug } = params;

  if (!id) {
    throw new Response("ID de pièce manquant", { status: 400 });
  }

  const _url = new URL(request.url);
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

  try {
    // Appel API backend pour récupérer la pièce
    const response = await fetch(`${backendUrl}/api/catalog/pieces/${id}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    if (!response.ok) {
      throw new Response(`Pièce ${id} introuvable`, { status: 404 });
    }

    const data = await response.json();

    return json<LoaderData>({
      piece: data.piece,
      vehiclesCompatibles: data.vehiclesCompatibles || [],
      crossSelling: data.crossSelling || [],
    });
  } catch (error) {
    console.error("❌ Erreur chargement pièce:", error);
    throw new Response("Erreur lors du chargement de la pièce", {
      status: 500,
    });
  }
}

/**
 * 🎯 Meta - SEO dynamique
 */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Pièce introuvable" },
      { name: "robots", content: "noindex, nofollow" },
    ];
  }

  const { piece } = data;
  const title = `${piece.nom} ${piece.marque} ${piece.reference} - Pièce Auto`;
  const description =
    piece.description ||
    `${piece.nom} de marque ${piece.marque}, référence ${piece.reference}. ${piece.dispo ? "En stock" : "Sur commande"}.`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "product" },
    { property: "product:price:amount", content: String(piece.prix_ttc) },
    { property: "product:price:currency", content: "EUR" },
    { name: "robots", content: "index, follow" },
  ];
};

/**
 * 🎨 Composant Page Détail Pièce
 */
export default function PieceDetailPage() {
  const { piece, vehiclesCompatibles, crossSelling } =
    useLoaderData<typeof loader>();
  const [selectedImage, setSelectedImage] = useState(piece.image);

  const allImages = [piece.image, ...(piece.images || [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-600">
            <Link to="/" className="hover:text-blue-600">
              Accueil
            </Link>
            <span>›</span>
            <Link to="/pieces/catalogue" className="hover:text-blue-600">
              Pièces
            </Link>
            <span>›</span>
            <span className="text-gray-900 font-medium">{piece.nom}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonne gauche - Images */}
          <div>
            {/* Image principale */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-4">
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden">
                <img
                  src={selectedImage || "/images/no.png"}
                  alt={piece.nom}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Galerie miniatures */}
            {allImages.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`aspect-square bg-white rounded-lg p-2 border-2 transition-all ${
                      selectedImage === img
                        ? "border-blue-500 shadow-md"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${piece.nom} - vue ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Colonne droite - Informations */}
          <div>
            <div className="bg-white rounded-2xl shadow-lg p-8">
              {/* Marque + Logo */}
              <div className="flex items-center gap-4 mb-6">
                {piece.marque_logo && (
                  <img
                    src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${piece.marque_logo}`}
                    alt={`Logo ${piece.marque}`}
                    className="w-16 h-16 object-contain"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {piece.nom}
                  </h1>
                  <p className="text-lg text-gray-600 mt-1">
                    {piece.marque} - Réf: {piece.reference}
                  </p>
                </div>
              </div>

              {/* Badges qualité */}
              <div className="flex items-center gap-3 mb-6">
                {piece.qualite === "OES" && (
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
                    🏆 Qualité OES
                  </span>
                )}
                {piece.nb_stars && piece.nb_stars > 0 && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: piece.nb_stars }, (_, i) => (
                      <span key={i} className="text-yellow-400 text-lg">
                        ★
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Prix */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
                <div className="text-sm text-gray-600 mb-2">Prix TTC</div>
                <div className="text-4xl font-black text-blue-600">
                  {piece.prix_ttc.toFixed(2)} €
                </div>
              </div>

              {/* Disponibilité */}
              <div className="mb-6">
                {piece.dispo ? (
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    En stock - Livraison rapide
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-orange-600 font-medium">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    Sur commande - Délai 2-5 jours
                  </div>
                )}
              </div>

              {/* Bouton ajouter panier */}
              <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Ajouter au panier
              </button>

              {/* Description */}
              {piece.description && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Description
                  </h2>
                  <p className="text-gray-700 leading-relaxed">
                    {piece.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Véhicules compatibles */}
        {vehiclesCompatibles.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Véhicules compatibles
            </h2>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehiclesCompatibles
                  .slice(0, 9)
                  .map((vehicle: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <svg
                        className="w-5 h-5 text-blue-600 flex-shrink-0"
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
                      <span className="text-sm text-gray-700">
                        {vehicle.marque} {vehicle.modele} {vehicle.type}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
