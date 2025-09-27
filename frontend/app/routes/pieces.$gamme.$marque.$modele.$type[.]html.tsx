// 🔧 Route pièces avec véhicule - Format: /pieces/{gamme}/{marque}/{modele}/{type}.html

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useLocation } from "@remix-run/react";
import React, { useMemo, useState } from "react";
import { unifiedCatalogApi } from "../services/api/unified-catalog.api";

import type { UnifiedPiece } from "@monorepo/shared-types";

// -----------------------------
// Types locaux (déduits/affichages)
// -----------------------------
type Quality = "OES" | "AFTERMARKET" | "Echange Standard";

interface VehicleData {
  marqueId: number;
  modeleId: number;
  typeId: number;
  marque: string;
  modele: string;
  type: string;
  marqueAlias: string;
  modeleAlias: string;
  typeAlias: string;
}

interface GammeData {
  id: number;
  name: string;
  alias: string;
  image: string;
  description: string;
}

interface PieceData {
  id: number;
  name: string;
  price: string; // ex: "19.90€"
  brand: string;
  stock: "En stock" | "Sur commande";
  reference: string;
  qualite?: Quality;
  delaiLivraison?: number;
}

interface Performance {
  articleCount: number;
  minPrice: number;
  avgDeliveryDays: number;
  availability: string;
}

interface LoaderData {
  vehicle: VehicleData;
  gamme: GammeData;
  pieces: PieceData[];
  performance: Performance;
  seo: {
    title: string;
    h1: string;
    description: string;
    keywords: string;
    content?: string;
    generatedAt?: string;
  };
  responseTime: number;
  loadTime: string;
  canonical: string;
}

// -----------------------------
// Utils
// -----------------------------
function parseSlugWithId(param: string): { alias: string; id: number } {
  // "filtre-a-huile-123" -> { alias: "filtre-a-huile", id: 123 }
  const parts = param.split("-");
  const id = Number(parts.pop());
  const alias = parts.join("-");
  if (!Number.isFinite(id) || id <= 0) {
    throw new Response("Paramètre invalide", { status: 400 });
  }
  return { alias, id };
}

function toTitleCaseFromSlug(slug: string) {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

// -----------------------------
// Loader
// -----------------------------
export async function loader({ params, request }: LoaderFunctionArgs) {
  const t0 = Date.now();

  const { gamme, marque, modele, type } = params;
  if (!gamme || !marque || !modele || !type) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  // 🔐 Parsing robuste
  const { alias: gammeAlias, id: pgId } = parseSlugWithId(gamme);
  const { alias: marqueAlias, id: marqueId } = parseSlugWithId(marque);
  const { alias: modeleAlias, id: modeleId } = parseSlugWithId(modele);
  const { alias: typeAlias, id: typeId } = parseSlugWithId(type);

  // 🧩 Données véhicule (affichage)
  const vehicle: VehicleData = {
    marqueId,
    modeleId,
    typeId,
    marque: marqueAlias.toUpperCase(),
    modele: modeleAlias.replace(/-/g, " ").toUpperCase(),
    type: typeAlias.replace(/-/g, " ").toUpperCase(),
    marqueAlias,
    modeleAlias,
    typeAlias,
  };

  // 🧩 Données gamme (affichage)
  const gammeData: GammeData = {
    id: pgId,
    name: toTitleCaseFromSlug(gammeAlias),
    alias: gammeAlias,
    image: `pieces-${pgId}.webp`,
    description: `Pièces ${gammeAlias.replace(/-/g, " ")} de qualité pour ${vehicle.marque} ${vehicle.modele}`,
  };

  // 🗄️ Récupération catalogue unifié
  let pieces: PieceData[] = [];
  let articleCount = 0;
  let minPrice = 0;

  try {
    const res = await unifiedCatalogApi.getPiecesUnified(typeId, pgId);
    if (res.success && res.pieces?.length) {
      pieces = res.pieces.map((p: UnifiedPiece): PieceData => ({
        id: p.id,
        name: p.nom,
        price:
          p.prix_unitaire && p.prix_unitaire > 0
            ? `${p.prix_unitaire.toFixed(2)}€`
            : "Prix sur demande",
        brand: p.marque,
        stock: p.prix_unitaire && p.prix_unitaire > 0 ? "En stock" : "Sur commande",
        reference: p.reference,
        qualite: p.qualite as Quality | undefined,
        delaiLivraison: 2,
      }));
      articleCount = res.count ?? pieces.length;
      minPrice = res.minPrice ?? 0;
    }
  } catch (e) {
    // Log silencieux : on ne révèle pas l’implémentation interne en prod
    console.warn("[UNIFIED-CATALOG] erreur:", e);
  }

  // ❌ Pas de fallback : on respecte l’état réel
  if (pieces.length === 0) {
    // validations minimales
    if (!typeId) throw new Response("Type de véhicule invalide", { status: 412 });
    if (!pgId) throw new Response("Gamme de pièces non trouvée", { status: 404 });

    throw new Response(`Aucune pièce ${gammeData.name} compatible avec ce véhicule`, {
      status: 410,
      statusText: "Pièces non compatibles",
    });
  }

  // 🎯 SEO Enhanced Service Integration
  let seo;
  try {
    const seoResponse = await fetch('/api/seo-enhanced/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pgId: pgId,
        typeId: typeId,
        variables: {
          gamme: gammeAlias,
          marque: vehicle.marque,
          modele: vehicle.modele,
          type: vehicle.type,
          minPrice: minPrice.toString(),
          articlesCount: pieces.length.toString()
        }
      })
    });
    
    if (seoResponse.ok) {
      const seoData = await seoResponse.json();
      if (seoData.success) {
        seo = {
          title: seoData.data.title,
          h1: seoData.data.h1,
          description: seoData.data.description,
          keywords: seoData.data.keywords,
          content: seoData.data.content,
          generatedAt: seoData.generatedAt
        };
        console.log('✅ SEO Enhanced utilisé pour:', { pgId, typeId });
      } else {
        throw new Error('SEO Enhanced failed');
      }
    } else {
      throw new Error('SEO Enhanced service unavailable');
    }
  } catch (error: any) {
    console.warn('⚠️ SEO Enhanced fallback:', error?.message || 'Unknown error');
    // 🔄 Fallback vers SEO classique amélioré
    seo = {
      title: `${gammeData.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} - Pièces détachées`,
      h1: `${gammeData.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type}`,
      description: `${gammeData.name} compatibles ${vehicle.marque} ${vehicle.modele} ${vehicle.type}. ${pieces.length} pièces à partir de ${minPrice}€, livraison rapide. ✅ Stock réel, prix compétitifs.`,
      keywords: `${gammeData.name}, ${vehicle.marque}, ${vehicle.modele}, ${vehicle.type}, pièces auto, ${gammeData.alias}, pièces détachées`,
      content: `Découvrez notre sélection de ${gammeData.name.toLowerCase()} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type}. Pièces compatibles de qualité avec ${pieces.length} références en stock.`,
      generatedAt: new Date().toISOString()
    };
  }

  const responseTime = Date.now() - t0;

  // 🌐 URL canonique
  let canonical;
  try {
    const url = new URL(request.url);
    canonical = `${url.origin}/pieces/${gamme}/${marque}/${modele}/${type}.html`;
  } catch (error) {
    // Fallback si erreur URL
    canonical = `/pieces/${gamme}/${marque}/${modele}/${type}.html`;
  }

  return json<LoaderData>({
    vehicle,
    gamme: gammeData,
    pieces,
    performance: {
      articleCount: articleCount,
      minPrice: minPrice,
      avgDeliveryDays: 2,
      availability: "En stock",
    },
    seo,
    responseTime,
    loadTime: `${responseTime}ms`,
    canonical,
  });
}

// -----------------------------
// Meta
// -----------------------------
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [{ title: "Pièces non trouvées" }];
  
  const metaTags = [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "keywords", content: data.seo.keywords },
    { name: "robots", content: "index, follow" },
    { tagName: 'link', rel: 'canonical', href: data.canonical },
  ];
  
  return metaTags;
};

// -----------------------------
// Page
// -----------------------------
export default function PiecesVehiculePage() {
  const data = useLoaderData<LoaderData>();
  const { vehicle, gamme, pieces, seo, performance, responseTime } = data;

  const [activeFilters, setActiveFilters] = useState({
    brands: [] as string[],
    priceRange: "all" as "all" | "low" | "medium" | "high",
    quality: "all" as "all" | Quality,
    availability: "all" as "all" | "stock" | "order",
    searchText: "",
  });
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc" | "brand">("name");

  const filteredPieces = useMemo(() => {
    let result = pieces.filter((piece) => {
      // Recherche plein-texte
      if (activeFilters.searchText.trim()) {
        const q = activeFilters.searchText.toLowerCase();
        if (
          !piece.name.toLowerCase().includes(q) &&
          !piece.brand.toLowerCase().includes(q) &&
          !piece.reference.toLowerCase().includes(q)
        )
          return false;
      }
      // Marque
      if (activeFilters.brands.length && !activeFilters.brands.includes(piece.brand)) return false;

      // Prix
      const price = Number(piece.price.replace("€", "").replace(",", "."));
      if (activeFilters.priceRange === "low" && price > 30) return false;
      if (activeFilters.priceRange === "medium" && (price < 30 || price > 60)) return false;
      if (activeFilters.priceRange === "high" && price < 60) return false;

      // Qualité
      if (activeFilters.quality !== "all" && piece.qualite !== activeFilters.quality) return false;

      // Dispo
      if (activeFilters.availability === "stock" && piece.stock !== "En stock") return false;
      if (activeFilters.availability === "order" && piece.stock === "En stock") return false;

      return true;
    });

    result.sort((a, b) => {
      const pa = Number(a.price.replace("€", "").replace(",", "."));
      const pb = Number(b.price.replace("€", "").replace(",", "."));
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "price-asc":
          return pa - pb;
        case "price-desc":
          return pb - pa;
        case "brand":
          return a.brand.localeCompare(b.brand);
        default:
          return 0;
      }
    });

    return result;
  }, [pieces, activeFilters, sortBy]);

  const resetAllFilters = () =>
    setActiveFilters({ brands: [], priceRange: "all", quality: "all", availability: "all", searchText: "" });

  const hasActiveFilters =
    activeFilters.brands.length > 0 ||
    activeFilters.priceRange !== "all" ||
    activeFilters.quality !== "all" ||
    activeFilters.availability !== "all" ||
    activeFilters.searchText.trim() !== "";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <nav className="text-blue-200 text-sm mb-4">
            <span>Constructeurs</span> → <span className="mx-1">{vehicle.marque}</span> →{" "}
            <span className="mx-1">{vehicle.modele}</span> → <span className="mx-1">{vehicle.type}</span> →{" "}
            <span className="text-white">{gamme.name}</span>
          </nav>

          <h1 className="text-3xl font-bold mb-4">{seo.h1}</h1>

          <div className="flex flex-wrap gap-4 text-blue-100 mb-4">
            <span>🏭 {vehicle.marque}</span>
            <span>🚗 {vehicle.modele}</span>
            <span>⚡ {vehicle.type}</span>
            <span>🔧 {gamme.name}</span>
          </div>

          <div className="bg-white/10 rounded-lg p-3 inline-block">
            <div className="text-sm flex gap-4 flex-wrap">
              <span>⚡ {responseTime}ms</span>
              <span className="text-green-300">🔧 PIÈCES RÉELLES</span>
              <span>🔢 {performance.articleCount} articles</span>
              <span>💰 À partir de {performance.minPrice}€</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bandeau compteur + action */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex justify-between items-center">
          <div>
            <span className="font-bold text-lg">{filteredPieces.length}</span> produits disponibles
            {filteredPieces.length !== pieces.length && (
              <span className="text-gray-500 ml-2">• sur {pieces.length} au total</span>
            )}
            <span className="text-gray-500 ml-2">• Prix minimum: {performance.minPrice}€</span>
            <span className="text-green-600 ml-2 font-medium">🔧 DONNÉES RÉELLES</span>
          </div>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
            onClick={resetAllFilters}
          >
            {hasActiveFilters ? "Réinitialiser filtres" : "Modifier véhicule"}
          </button>
        </div>

        {/* Filtres et tri */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Recherche */}
          <div>
            <input
              type="text"
              placeholder="Rechercher..."
              value={activeFilters.searchText}
              onChange={(e) => setActiveFilters(prev => ({...prev, searchText: e.target.value}))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tri */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Trier par nom</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="brand">Par marque</option>
            </select>
          </div>

          {/* Filtres prix */}
          <div>
            <select
              value={activeFilters.priceRange}
              onChange={(e) => setActiveFilters(prev => ({...prev, priceRange: e.target.value as any}))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les prix</option>
              <option value="low">Jusqu'à 30€</option>
              <option value="medium">30€ - 60€</option>
              <option value="high">Plus de 60€</option>
            </select>
          </div>

          {/* Filtre qualité */}
          <div>
            <select
              value={activeFilters.quality}
              onChange={(e) => setActiveFilters(prev => ({...prev, quality: e.target.value as any}))}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toutes qualités</option>
              <option value="OES">OES</option>
              <option value="AFTERMARKET">Aftermarket</option>
              <option value="Echange Standard">Echange Standard</option>
            </select>
          </div>
        </div>

        {/* Grille de produits */}
        {filteredPieces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPieces.map((piece) => (
              <div key={piece.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
                <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  <div className="text-4xl text-gray-400">🔧</div>
                </div>
                
                <h3 className="font-medium text-lg mb-2 line-clamp-2">{piece.name}</h3>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div>Réf: {piece.reference}</div>
                  <div>Marque: {piece.brand}</div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      piece.stock === "En stock" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {piece.stock}
                    </span>
                    {piece.qualite && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {piece.qualite}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-blue-600">{piece.price}</div>
                  <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                    Ajouter
                  </button>
                </div>
                
                {piece.delaiLivraison && (
                  <div className="text-xs text-gray-500 mt-2">
                    Livraison: {piece.delaiLivraison} jours
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">Aucun produit trouvé</h3>
            <p className="text-gray-600 mb-4">
              Essayez de modifier vos filtres ou votre recherche.
            </p>
            <button
              onClick={resetAllFilters}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* 📝 Contenu SEO enrichi */}
        {data.seo.content && (
          <div className="mt-12 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">
              À propos des {data.gamme.name.toLowerCase()} pour {data.vehicle.marque} {data.vehicle.modele} {data.vehicle.type}
            </h2>
            <div 
              className="prose max-w-none prose-blue"
              dangerouslySetInnerHTML={{ __html: data.seo.content }}
            />
            {data.seo.generatedAt && (
              <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
                <span>🤖 Contenu généré le {new Date(data.seo.generatedAt).toLocaleDateString('fr-FR')}</span>
                <span>•</span>
                <span>⚡ {data.loadTime}</span>
                <span>•</span>
                <span>🔢 {data.performance.articleCount} articles</span>
              </div>
            )}
          </div>
        )}

        {/* … (tes blocs filtres + grille produits restent identiques à ta version ; tu peux garder ton JSX actuel) … */}
      </div>
    </div>
  );
}

// -----------------------------
// ErrorBoundary
// -----------------------------
export function ErrorBoundary() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Pièces non disponibles</h1>
          <p className="text-gray-600 mb-6">
            Aucune pièce compatible n'a été trouvée pour cette combinaison véhicule/gamme.
          </p>
          <ul className="text-left text-sm text-gray-500 mb-6 space-y-2">
            <li>• La pièce n'est pas compatible avec ce véhicule</li>
            <li>• La gamme a été discontinuée</li>
            <li>• Le modèle n'existe pas dans notre base</li>
          </ul>
          <div className="space-y-3">
            <a href="/" className="block w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors">
              🏠 Retour à l'accueil
            </a>
            <a href="/contact" className="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition-colors">
              💬 Nous contacter
            </a>
          </div>
          <div className="mt-4 text-xs text-gray-400">URL: {location.pathname}</div>
        </div>
      </div>
    </div>
  );
}
