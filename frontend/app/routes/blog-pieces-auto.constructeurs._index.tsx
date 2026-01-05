import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams, useNavigation } from "@remix-run/react";
import React, { useState, useMemo } from 'react';
import { BlogNavigation } from "~/components/blog/BlogNavigation";
import { Badge } from "~/components/ui";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// ⚠️ NOTE: Backend API tourne sur port 3000, Frontend sur port 5173

// Liste complète des constructeurs (pour la sidebar)
const ALL_BRANDS = [
  'ALFA ROMEO', 'AUDI', 'BMW', 'CHEVROLET', 'CHRYSLER', 'CITROËN', 'DACIA', 'DAEWOO',
  'FIAT', 'FORD', 'HONDA', 'HYUNDAI', 'IVECO', 'JEEP', 'KIA', 'LADA', 'LANCIA',
  'LAND ROVER', 'MAZDA', 'MERCEDES', 'MINI', 'MITSUBISHI', 'NISSAN', 'OPEL', 'PEUGEOT',
  'PORSCHE', 'RENAULT', 'SAAB', 'SEAT', 'SKODA', 'SMART', 'SUZUKI', 'TOYOTA',
  'VOLKSWAGEN', 'VOLVO'
].sort();

// Données de démo FALLBACK si API fail
const DEMO_CONSTRUCTEURS = [
  {
    id: "constructeur_1",
    type: "constructeur",
    title: "BMW - Bayerische Motoren Werke",
    slug: "bmw-histoire-modeles",
    excerpt: "Découvrez l'histoire de BMW, marque allemande emblématique du luxe et de la performance automobile depuis 1916.",
    content: "BMW, fondée en 1916, est devenue synonyme d'innovation et de plaisir de conduire...",
    h1: "BMW - Histoire et Modèles Emblématiques",
    h2: "L'Excellence Automobile Allemande",
    keywords: ["BMW", "constructeur allemand", "série 3", "série 5", "X5", "M3"],
    tags: ["BMW", "Allemagne", "Luxe", "Performance"],
    publishedAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
    viewsCount: 15430,
    readingTime: 8,
    brand: "BMW",
    modelsCount: 24,
    sections: [],
    legacy_id: 1,
    legacy_table: "__blog_constructeur",
    seo_data: {
      meta_title: "BMW - Histoire et Modèles Emblématiques de la Marque Allemande",
      meta_description: "Découvrez l'histoire fascinante de BMW, ses modèles emblématiques et son évolution depuis 1916.",
      keywords: ["BMW", "constructeur", "histoire automobile"]
    }
  },
  {
    id: "constructeur_2",
    type: "constructeur",
    title: "Audi - Vorsprung durch Technik",
    slug: "audi-innovation-technique",
    excerpt: "Audi, marque premium allemande reconnue pour ses innovations technologiques et son design avant-gardiste.",
    content: "Audi, marque aux quatre anneaux, symbolise l'excellence technique allemande...",
    h1: "Audi - Innovation et Design Allemand",
    h2: "La Technologie au Service de l'Automobile",
    keywords: ["Audi", "quattro", "A4", "A6", "Q7", "RS"],
    tags: ["Audi", "Allemagne", "Innovation", "Design"],
    publishedAt: "2024-01-10T14:30:00.000Z",
    updatedAt: "2024-01-10T14:30:00.000Z",
    viewsCount: 12890,
    readingTime: 6,
    brand: "Audi",
    modelsCount: 21,
    sections: [],
    legacy_id: 2,
    legacy_table: "__blog_constructeur",
    seo_data: {
      meta_title: "Audi - Innovation Technique et Design Premium",
      meta_description: "Explorez l'univers d'Audi, marque premium reconnue pour ses innovations et son design.",
      keywords: ["Audi", "innovation", "design automobile"]
    }
  },
  {
    id: "constructeur_3",
    type: "constructeur",
    title: "Mercedes-Benz - The Best or Nothing",
    slug: "mercedes-benz-luxe-heritage",
    excerpt: "Mercedes-Benz, pionnier de l'automobile de luxe, continue d'innover depuis plus de 130 ans.",
    content: "Mercedes-Benz, inventeur de l'automobile moderne, incarne le luxe et l'innovation...",
    h1: "Mercedes-Benz - Luxe et Héritage Automobile",
    h2: "L'Inventeur de l'Automobile Moderne",
    keywords: ["Mercedes", "Classe C", "Classe E", "GLE", "AMG", "luxe"],
    tags: ["Mercedes", "Allemagne", "Luxe", "Héritage"],
    publishedAt: "2024-01-05T09:15:00.000Z",
    updatedAt: "2024-01-05T09:15:00.000Z",
    viewsCount: 18750,
    readingTime: 10,
    brand: "Mercedes-Benz",
    modelsCount: 28,
    sections: [],
    legacy_id: 3,
    legacy_table: "__blog_constructeur",
    seo_data: {
      meta_title: "Mercedes-Benz - Luxe et Innovation Automobile depuis 1886",
      meta_description: "Découvrez Mercedes-Benz, pionnier de l'automobile et symbole du luxe allemand.",
      keywords: ["Mercedes", "luxe", "automobile premium"]
    }
  },
  {
    id: "constructeur_4",
    type: "constructeur",
    title: "Toyota - Moving Forward",
    slug: "toyota-fiabilite-innovation",
    excerpt: "Toyota, géant japonais de l'automobile, leader mondial en matière de fiabilité et d'innovation hybride.",
    content: "Toyota, fondée en 1937, est devenue le symbole de la fiabilité automobile japonaise...",
    h1: "Toyota - Fiabilité et Innovation Japonaise",
    h2: "Le Leader Mondial de l'Automobile",
    keywords: ["Toyota", "Corolla", "Camry", "Prius", "hybride", "fiabilité"],
    tags: ["Toyota", "Japon", "Fiabilité", "Hybride"],
    publishedAt: "2024-01-08T16:20:00.000Z",
    updatedAt: "2024-01-08T16:20:00.000Z",
    viewsCount: 14250,
    readingTime: 7,
    brand: "Toyota",
    modelsCount: 35,
    sections: [],
    legacy_id: 4,
    legacy_table: "__blog_constructeur",
    seo_data: {
      meta_title: "Toyota - Leader Mondial de l'Automobile Fiable",
      meta_description: "Explorez l'univers Toyota, synonyme de fiabilité et d'innovation hybride.",
      keywords: ["Toyota", "fiabilité", "hybride"]
    }
  },
  {
    id: "constructeur_5",
    type: "constructeur",
    title: "Volkswagen - Das Auto",
    slug: "volkswagen-automobile-populaire",
    excerpt: "Volkswagen, la marque du peuple devenue géant mondial, symbole de l'automobile accessible et qualitative.",
    content: "Volkswagen, littéralement 'voiture du peuple', a révolutionné l'automobile...",
    h1: "Volkswagen - L'Automobile pour Tous",
    h2: "Du Peuple au Premium",
    keywords: ["Volkswagen", "Golf", "Passat", "Tiguan", "ID", "électrique"],
    tags: ["Volkswagen", "Allemagne", "Accessible", "Électrique"],
    publishedAt: "2024-01-12T11:45:00.000Z",
    updatedAt: "2024-01-12T11:45:00.000Z",
    viewsCount: 11680,
    readingTime: 5,
    brand: "Volkswagen",
    modelsCount: 19,
    sections: [],
    legacy_id: 5,
    legacy_table: "__blog_constructeur",
    seo_data: {
      meta_title: "Volkswagen - L'Automobile du Peuple Devenue Globale",
      meta_description: "Découvrez Volkswagen, de la Coccinelle aux véhicules électriques ID.",
      keywords: ["Volkswagen", "accessible", "électrique"]
    }
  },
  {
    id: "constructeur_6",
    type: "constructeur",
    title: "Ferrari - The Prancing Horse",
    slug: "ferrari-passion-performance",
    excerpt: "Ferrari, symbole ultime de la passion automobile italienne et de la performance sur circuit.",
    content: "Ferrari, fondée par Enzo Ferrari, incarne la passion pure de l'automobile...",
    h1: "Ferrari - La Passion Automobile Italienne",
    h2: "Performance et Émotion Pure",
    keywords: ["Ferrari", "F40", "488", "SF90", "LaFerrari", "sport"],
    tags: ["Ferrari", "Italie", "Sport", "Passion"],
    publishedAt: "2024-01-18T13:00:00.000Z",
    updatedAt: "2024-01-18T13:00:00.000Z",
    viewsCount: 22350,
    readingTime: 9,
    brand: "Ferrari",
    modelsCount: 12,
    sections: [],
    legacy_id: 6,
    legacy_table: "__blog_constructeur",
    seo_data: {
      meta_title: "Ferrari - Passion et Performance Automobile Italienne",
      meta_description: "Plongez dans l'univers Ferrari, symbole de la passion automobile et de la performance.",
      keywords: ["Ferrari", "sport", "performance"]
    }
  }
];

interface ConstructeurArticle {
  id: string;
  type: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  h1: string;
  h2: string;
  keywords: string[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  viewsCount: number;
  readingTime: number;
  brand: string;
  modelsCount: number;
  sections: Array<{
    level: number;
    title: string;
    content: string;
    anchor: string;
  }>;
  legacy_id: number;
  legacy_table: string;
  seo_data: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
  };
}

interface LoaderData {
  constructeurs: ConstructeurArticle[];
  total: number;
  page: number;
  totalPages: number;
  success: boolean;
  search: string;
  letter: string;
  brand: string;
  sortBy: string;
  letters: string[];
  featuredConstructeurs: ConstructeurArticle[];
  popularBrands: Array<{ name: string; count: number; totalViews: number }>;
  stats: {
    totalViews: number;
    avgViews: number;
    totalConstructeurs: number;
    totalModels: number;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const search = url.searchParams.get('search') || '';
  const letter = url.searchParams.get('letter') || '';
  const brand = url.searchParams.get('brand') || '';
  const sortBy = url.searchParams.get('sortBy') || 'name';
  const limit = 24;

  console.log('[API] Constructeurs loader with params:', { page, search, letter, brand, sortBy });

  // Essayer de récupérer depuis l'API brands (catalogue technique)
  try {
    const apiUrl = new URL(`${API_BASE_URL}/api/brands`);
    if (search) apiUrl.searchParams.set('search', search);
    if (letter) apiUrl.searchParams.set('letter', letter);
    // Pagination gérée côté client pour l'instant
    apiUrl.searchParams.set('limit', '200'); // Récupérer toutes les marques

    const response = await fetch(apiUrl.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000) // 5s timeout
    });

    if (response.ok) {
      const apiData = await response.json();
      
      // Convertir les données manufacturers en format constructeurs
      const manufacturers = apiData.data || [];
      console.log('[API] Success:', manufacturers.length, 'constructeurs');
      
      // Filtrer localement
      let filtered = manufacturers;
      if (letter) {
        filtered = filtered.filter((m: any) => m.name.charAt(0).toUpperCase() === letter);
      }
      if (brand) {
        filtered = filtered.filter((m: any) => m.name.toLowerCase().includes(brand.toLowerCase()));
      }
      
      // Pagination locale
      const startIndex = (page - 1) * limit;
      const paginatedItems = filtered.slice(startIndex, startIndex + limit);
      
      // Enrichir avec les données manquantes
      return json({
        constructeurs: paginatedItems.map((m: any) => ({
          id: m.id,
          title: m.name,
          slug: m.slug,
          brand: m.name,
          logo: m.logo,
          excerpt: `Pièces auto ${m.name} - Catalogue complet`,
          is_active: m.is_active,
        })),
        total: filtered.length,
        page,
        totalPages: Math.ceil(filtered.length / limit),
        search,
        letter,
        brand,
        sortBy,
        letters: Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
        featuredConstructeurs: (apiData.items || []).slice(0, 6),
        popularBrands: ALL_BRANDS.slice(0, 10).map(name => ({ name, count: 1, totalViews: 0 })),
        stats: {
          totalViews: (apiData.total || 0) * 1500,
          avgViews: 1500,
          totalConstructeurs: apiData.total || 0,
          totalModels: (apiData.total || 0) * 15
        },
        success: true,
        source: 'api'
      });
    }
  } catch (error) {
    console.warn('[API] Error, using fallback data:', error);
  }

  // FALLBACK: Utiliser les données de démo
  console.log('[DEMO] Using fallback data');

  // Filtrage des données de démo
  let filteredConstructeurs = DEMO_CONSTRUCTEURS;

  // Filtre par recherche
  if (search) {
    const searchLower = search.toLowerCase();
    filteredConstructeurs = filteredConstructeurs.filter(c => 
      c.title.toLowerCase().includes(searchLower) || 
      c.excerpt.toLowerCase().includes(searchLower) ||
      c.brand.toLowerCase().includes(searchLower)
    );
  }

  // Filtre par lettre
  if (letter) {
    filteredConstructeurs = filteredConstructeurs.filter(c => 
      c.title.charAt(0).toUpperCase() === letter
    );
  }

  // Filtre par marque
  if (brand) {
    filteredConstructeurs = filteredConstructeurs.filter(c => c.brand === brand);
  }

  // Tri
  filteredConstructeurs.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.title.localeCompare(b.title);
      case 'views':
        return b.viewsCount - a.viewsCount;
      case 'date':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'models':
        return b.modelsCount - a.modelsCount;
      default:
        return a.title.localeCompare(b.title);
    }
  });

  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedConstructeurs = filteredConstructeurs.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredConstructeurs.length / limit);

  // Génération des lettres A-Z disponibles
  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  
  // Constructeurs en vedette (les 6 plus populaires)
  const featuredConstructeurs = DEMO_CONSTRUCTEURS
    .sort((a, b) => b.viewsCount - a.viewsCount)
    .slice(0, 6);

  // Marques populaires
  const brandStats = DEMO_CONSTRUCTEURS.reduce((acc: any, constructeur) => {
    const brandName = constructeur.brand;
    if (!acc[brandName]) {
      acc[brandName] = { count: 0, totalViews: 0 };
    }
    acc[brandName].count++;
    acc[brandName].totalViews += constructeur.viewsCount;
    return acc;
  }, {});

  const popularBrands = Object.entries(brandStats)
    .map(([name, stats]: [string, any]) => ({
      name,
      count: stats.count,
      totalViews: stats.totalViews
    }))
    .sort((a, b) => b.totalViews - a.totalViews);

  // Statistiques globales
  const stats = {
    totalViews: DEMO_CONSTRUCTEURS.reduce((sum, c) => sum + c.viewsCount, 0),
    avgViews: Math.round(DEMO_CONSTRUCTEURS.reduce((sum, c) => sum + c.viewsCount, 0) / DEMO_CONSTRUCTEURS.length),
    totalConstructeurs: DEMO_CONSTRUCTEURS.length,
    totalModels: DEMO_CONSTRUCTEURS.reduce((sum, c) => sum + c.modelsCount, 0)
  };

  return json({
    constructeurs: paginatedConstructeurs,
    total: filteredConstructeurs.length,
    page,
    totalPages,
    search,
    letter,
    brand,
    sortBy,
    letters,
    featuredConstructeurs,
    popularBrands,
    stats,
    success: true
  });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.search
    ? `Constructeurs Automobiles - Recherche: ${data.search}`
    : data?.letter
    ? `Constructeurs Automobiles - Lettre ${data.letter}`
    : "Constructeurs Automobiles - Marques et Histoire Auto";

  const description = data?.search
    ? `Découvrez les constructeurs automobiles correspondant à "${data.search}". Histoire, innovations et modèles emblématiques.`
    : data?.letter
    ? `Constructeurs automobiles commençant par ${data.letter}. Découvrez l'histoire et les modèles de ces marques légendaires.`
    : "Explorez l'univers des constructeurs automobiles. Histoire, innovations, modèles emblématiques des plus grandes marques mondiales.";

  return [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: "constructeurs automobiles, marques auto, histoire automobile, modèles voiture, innovation auto" },
    { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/blog-pieces-auto/constructeurs" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "AutoMecanik" }
  ];
};

// Icônes SVG personnalisées
const SearchIcon = () => (
  <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const BrandIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const TrendingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const ModelIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ViewIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Composant BrandGrid optimisé
const BrandGrid: React.FC<{ constructeurs: ConstructeurArticle[] }> = ({ constructeurs }) => {
  if (constructeurs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="flex justify-center mb-4">
          <BrandIcon />
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun constructeur trouvé</h3>
        <p className="mt-1 text-sm text-gray-500">Essayez de modifier vos critères de recherche.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {constructeurs.map((constructeur) => (
        <Link
          key={constructeur.id}
          to={`/blog-pieces-auto/constructeurs/${constructeur.slug}`}
          className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200 hover:border-blue-300"
        >
          <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-gray-100 to-gray-200 h-32 flex items-center justify-center">
            <BrandIcon />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
              {constructeur.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {constructeur.excerpt}
            </p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <ModelIcon />
                {constructeur.modelsCount || 0} modèles
              </span>
              <span className="flex items-center gap-1">
                <ViewIcon />
                {(constructeur.viewsCount || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

// Composant ArticleCarousel optimisé
const ArticleCarousel: React.FC<{ constructeurs: ConstructeurArticle[] }> = ({ constructeurs }) => {
  if (constructeurs.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {constructeurs.map((constructeur) => (
        <Link
          key={constructeur.id}
          to={`/blog-pieces-auto/constructeurs/${constructeur.slug}`}
          className="group bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
        >
          <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-blue-100 to-blue-200 h-32 flex items-center justify-center">
            <BrandIcon />
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="info">
                {constructeur.brand || 'Constructeur'}
              </Badge>
              <span className="flex items-center text-sm text-gray-500">
                <TrendingIcon />
                <span className="ml-1">{constructeur.viewsCount.toLocaleString()}</span>
              </span>
            </div>
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
              {constructeur.title}
            </h3>
            <p className="text-gray-600 text-sm line-clamp-3 mb-4">
              {constructeur.excerpt}
            </p>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <CalendarIcon />
                {new Date(constructeur.updatedAt).toLocaleDateString('fr-FR')}
              </span>
              <span className="flex items-center gap-1">
                <ModelIcon />
                {constructeur.modelsCount || 0} modèles
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default function ConstructeursHomePage() {
  const { 
    constructeurs, 
    total, 
    page, 
    totalPages, 
    search, 
    letter, 
    brand, 
    sortBy, 
    letters,
    featuredConstructeurs, 
    popularBrands, 
    stats 
  } = useLoaderData<LoaderData>();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  // État local pour les filtres
  const [localSearch, setLocalSearch] = useState(search);
  
  // Debounce pour la recherche
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (localSearch !== search) {
        const newParams = new URLSearchParams(searchParams);
        if (localSearch) {
          newParams.set('search', localSearch);
        } else {
          newParams.delete('search');
        }
        newParams.delete('page'); // Reset page lors de nouvelle recherche
        setSearchParams(newParams);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [localSearch, search, searchParams, setSearchParams]);

  // Fonction pour changer les filtres
  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.delete('page'); // Reset page lors de changement de filtre
    setSearchParams(newParams);
  };

  // Pagination
  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', newPage.toString());
    setSearchParams(newParams);
  };

  const paginationItems = useMemo(() => {
    const items: number[] = [];
    const maxVisible = 5;
    const start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    return items;
  }, [page, totalPages]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Blog */}
      <BlogNavigation />
      
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <PublicBreadcrumb items={[
            { label: "Blog", href: "/blog-pieces-auto" },
            { label: "Constructeurs" }
          ]} />
        </div>
      </div>

      {/* Header avec gradient */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-4">Constructeurs Automobiles</h1>
          <p className="text-xl text-blue-100 mb-6">
            Découvrez l'histoire, les innovations et les modèles emblématiques des plus grandes marques mondiales
          </p>
          
          {/* Statistiques rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{stats.totalConstructeurs}</div>
              <div className="text-sm text-blue-100">Constructeurs</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{(stats.totalModels || 0).toLocaleString()}</div>
              <div className="text-sm text-blue-100">Modèles</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{Math.round((stats.totalViews || 0) / 1000)}K</div>
              <div className="text-sm text-blue-100">Vues totales</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{(stats.avgViews || 0).toLocaleString()}</div>
              <div className="text-sm text-blue-100">Vues moyenne</div>
            </div>
          </div>
        </div>
      </div>

      {/* Articles en vedette */}
      {featuredConstructeurs.length > 0 && (
        <section className="container mx-auto px-4 py-12">
          <div className="flex items-center gap-2 mb-6">
            <TrendingIcon />
            <h2 className="text-2xl font-bold">Constructeurs en vedette</h2>
          </div>
          <ArticleCarousel constructeurs={featuredConstructeurs} />
        </section>
      )}

      <div className="container mx-auto px-4 py-8 lg:flex lg:gap-8">
        {/* Sidebar avec toutes les marques */}
        <aside className="hidden lg:block lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
            <h3 className="font-bold text-lg mb-4 uppercase">Marques des constructeurs</h3>
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {ALL_BRANDS.map((brandName) => (
                <button
                  key={brandName}
                  onClick={() => handleFilterChange('brand', brandName)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors text-sm ${
                    brand === brandName
                      ? 'bg-primary text-white font-semibold'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {brandName}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Contenu principal */}
        <div className="flex-1">
        {/* Barre de recherche et filtres */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1">
              <div className="relative">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Rechercher un constructeur..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filtre par lettre */}
            <div className="flex-shrink-0">
              <select
                value={letter}
                onChange={(e) => handleFilterChange('letter', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Toutes les lettres</option>
                {letters.map((l) => (
                  <option key={l} value={l}>Lettre {l}</option>
                ))}
              </select>
            </div>

            {/* Filtre par marque */}
            <div className="flex-shrink-0">
              <select
                value={brand}
                onChange={(e) => handleFilterChange('brand', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Toutes les marques</option>
                {popularBrands.slice(0, 10).map((b) => (
                  <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
                ))}
              </select>
            </div>

            {/* Tri */}
            <div className="flex-shrink-0">
              <select
                value={sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="name">Nom A-Z</option>
                <option value="views">Popularité</option>
                <option value="date">Dernière mise à jour</option>
                <option value="models">Nombre de modèles</option>
              </select>
            </div>
          </div>

          {/* Filtres alphabétiques rapides */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => handleFilterChange('letter', '')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                !letter 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous
            </button>
            {letters.slice(0, 13).map((l) => (
              <button
                key={l}
                onClick={() => handleFilterChange('letter', l)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  letter === l 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Résultats */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {search ? `Résultats pour "${search}"` : 
             letter ? `Constructeurs - Lettre ${letter}` : 
             'Tous les constructeurs'}
          </h2>
          <p className="text-gray-600">
            {total.toLocaleString()} constructeur{total !== 1 ? 's' : ''}
            {isLoading && <span className="ml-2 text-blue-500">Chargement...</span>}
          </p>
        </div>

        {/* Grille des constructeurs */}
        <div className={`transition-opacity duration-200 ${isLoading ? 'opacity-50' : ''}`}>
          <BrandGrid constructeurs={constructeurs} />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center mt-12 space-x-2">
            <button
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            
            {paginationItems.map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  pageNum === page
                    ? 'bg-primary text-white'
                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </nav>
        )}
      </div>

      {/* Section concepts et prototypes */}
      <section className="bg-white py-12 mt-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8 text-center">Univers Automobile</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              to="/blog-pieces-auto/constructeurs/concepts/electriques"
              className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300"
            >
              <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-green-400 to-green-600 h-48 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                <div className="p-6 text-white">
                  <h3 className="font-semibold text-lg mb-1">Véhicules Électriques</h3>
                  <p className="text-sm opacity-90">Le futur de l'automobile durable</p>
                </div>
              </div>
            </Link>

            <Link
              to="/blog-pieces-auto/constructeurs/concepts/autonomes"
              className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300"
            >
              <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-purple-400 to-purple-600 h-48 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                <div className="p-6 text-white">
                  <h3 className="font-semibold text-lg mb-1">Conduite Autonome</h3>
                  <p className="text-sm opacity-90">L'innovation technologique</p>
                </div>
              </div>
            </Link>

            <Link
              to="/blog-pieces-auto/constructeurs/concepts/sportives"
              className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all duration-300"
            >
              <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-red-400 to-red-600 h-48 flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end">
                <div className="p-6 text-white">
                  <h3 className="font-semibold text-lg mb-1">Supercars</h3>
                  <p className="text-sm opacity-90">Performance et élégance extrême</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

        {/* Section marques populaires */}
        {popularBrands.length > 0 && (
          <section className="py-12">
            <h2 className="text-2xl font-bold mb-6">Marques les plus consultées</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {popularBrands.slice(0, 10).map((brand) => (
                <button
                  key={brand.name}
                  onClick={() => handleFilterChange('brand', brand.name)}
                  className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-center border border-gray-200 hover:border-blue-300"
                >
                  <div className="font-semibold text-gray-900">{brand.name}</div>
                  <div className="text-sm text-gray-600">{brand.count} articles</div>
                  <div className="text-xs text-gray-500">{brand.totalViews.toLocaleString()} vues</div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      
      {/* Section OEM comme sur la page actuelle */}
      <section className="bg-white py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Les pièces autos d'origine OEM</h2>
            <div className="prose prose-lg max-w-none text-gray-700 space-y-4">
              <p className="text-lg">
                <strong>OEM</strong> abréviation de : <em>Original Equipment Manufacturer</em>.
              </p>
              <p>
                Un producteur tiers sous contrat fournit des pièces OEM qui portent la marque du constructeur automobile. 
                Le fabricant OEM procède au poinçonnage de l'article avec le logo de la marque du manufacturier, 
                puis emballé et étiqueté dans le packaging de ce dernier.
              </p>
              <p>
                Les pièces OEM en tout point identiques aux pièces notifiées première monte, c'est-à-dire celle qui 
                équipait votre véhicule à sa sortie d'usine après la chaîne d'assemblage se vend exclusivement à travers 
                le réseau des manufacturiers automobiles. Elles sont les seules à être conditionnées dans un emballage 
                de la marque avec le logo du constructeur en question.
              </p>
              <p>
                Dans le cadre du contrat entre le constructeur et l'équipementier, le producteur est autorisé par son 
                partenaire à composer sa propre gamme de pièces auto. Cependant, les articles n'endossent pas le label 
                du constructeur automobile. Au lieu de cela, ils portent la marque de l'équipementier auto qui les a élaborés.
              </p>
              <p>
                Le composant à l'identique sans le logo constructeur, fabriqué par la même usine d'équipement, est disponible 
                dans le commerce. Ces accessoires sont connus sous le nom de <strong>pièces OES</strong>. Les pièces détachées 
                OES sont des pièces d'origine sans la marque du constructeur automobile et sont fabriquées avec les machines 
                et la même précision que les pièces d'origine, ce qui garantit un fonctionnement parfait.
              </p>
              <p className="text-sm text-gray-600 italic">
                Il est à noter que les concessionnaires se réservent une gamme nommée : pièces captives, 
                affectées uniquement aux concessionnaires automobiles.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
