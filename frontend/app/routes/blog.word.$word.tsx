/**
 * Route optimisée pour les définitions du glossaire automobile
 * Affiche une définition complète avec synonymes, termes liés et articles connexes
 * @route /blog/word/$word
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";

import { glossaryApi, type GlossaryDefinition, type RelatedArticle } from "../services/api/glossary.api";

// Icons simplifiés sans heroicons pour éviter les dépendances
const BookOpenIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0118 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const TagIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
  </svg>
);

const EyeIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const MagnifyingGlassIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const ShareIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
);

const StarIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
);

const BookmarkIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
  </svg>
);

const BookmarkIconSolid = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
  </svg>
);

const CalendarIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5m-18 0h18" />
  </svg>
);

const ArrowLeftIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const LightBulbIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m4.5 0a12.06 12.06 0 00-1.5-1.5m-3 3a12.06 12.06 0 00-1.5-1.5m4.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

const ClockIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HashtagIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
  </svg>
);

const LinkIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const PrinterIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18.129A2.25 2.25 0 018.25 21h7.5a2.25 2.25 0 001.91-2.871L18 13.829m-8.457 0h8.457m-8.457 0V9a2.25 2.25 0 012.25-2.25h4.5A2.25 2.25 0 0118 9v4.829" />
  </svg>
);

const BookOpenIconSolid = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
  </svg>
);

// Types pour les données de la page
interface LoaderData {
  definition: GlossaryDefinition | null;
  relatedArticles: RelatedArticle[];
  relatedTerms: GlossaryDefinition[];
  word: string;
  meta: {
    title: string;
    description: string;
    keywords: string[];
    canonicalUrl: string;
  };
  error?: string;
}

// Loader pour récupérer les données
export async function loader({ params, request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const word = params.word;

  if (!word) {
    throw new Response("Mot non spécifié", { status: 400 });
  }

  try {
    console.log(`[LOADER] Chargement définition pour: ${word}`);

    // Récupération parallèle des données
    const [definition, relatedArticles] = await Promise.all([
      glossaryApi.getWordDefinition(word),
      glossaryApi.getRelatedArticles(word, 6)
    ]);

    if (!definition) {
      console.log(`[LOADER] Définition non trouvée pour: ${word}`);
      // Redirection vers la liste du glossaire avec recherche
      throw new Response("Terme non trouvé", { status: 404 });
    }

    // Termes liés basés sur la catégorie ou les mots-clés
    let relatedTerms: GlossaryDefinition[] = [];
    if (definition.relatedTerms?.length) {
      const searchPromises = definition.relatedTerms.slice(0, 4).map(term => 
        glossaryApi.getWordDefinition(term)
      );
      const relatedResults = await Promise.all(searchPromises);
      relatedTerms = relatedResults.filter(Boolean) as GlossaryDefinition[];
    }

    // Métadonnées SEO
    const meta = {
      title: definition.seo_data?.meta_title || `${definition.word} - Définition Glossaire Automobile`,
      description: definition.seo_data?.meta_description || definition.definition.substring(0, 160),
      keywords: definition.seo_data?.keywords || [definition.word, ...(definition.synonyms || [])],
      canonicalUrl: `${url.origin}/blog/word/${word}`
    };

    return json<LoaderData>({
      definition,
      relatedArticles,
      relatedTerms,
      word,
      meta
    });

  } catch (error) {
    console.error(`[LOADER ERROR] Erreur pour ${word}:`, error);
    
    return json<LoaderData>({
      definition: null,
      relatedArticles: [],
      relatedTerms: [],
      word,
      meta: {
        title: `Terme non trouvé - ${word}`,
        description: `Le terme "${word}" n'a pas été trouvé dans notre glossaire automobile.`,
        keywords: [word, "glossaire", "automobile"],
        canonicalUrl: `${url.origin}/blog/word/${word}`
      },
      error: error instanceof Error ? error.message : "Terme non trouvé"
    });
  }
}

// Métadonnées pour le SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Erreur - Glossaire Automobile" },
      { name: "description", content: "Une erreur est survenue lors du chargement de la définition." }
    ];
  }

  const { meta: metaData, definition, error } = data;

  if (error || !definition) {
    return [
      { title: metaData.title },
      { name: "description", content: metaData.description },
      { name: "robots", content: "noindex, nofollow" }
    ];
  }

  return [
    { title: metaData.title },
    { name: "description", content: metaData.description },
    { name: "keywords", content: metaData.keywords.join(", ") },
    { property: "og:title", content: metaData.title },
    { property: "og:description", content: metaData.description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: metaData.canonicalUrl },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: metaData.title },
    { name: "twitter:description", content: metaData.description },
    { tagName: "link", rel: "canonical", href: metaData.canonicalUrl }
  ];
};

// Composant principal
export default function GlossaryWordPage() {
  const { definition, relatedArticles, relatedTerms, word, error } = useLoaderData<LoaderData>();

  // États pour les interactions
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Vérification des favoris au chargement
  useEffect(() => {
    if (definition) {
      const bookmarks = JSON.parse(localStorage.getItem('glossary-bookmarks') || '[]');
      setIsBookmarked(bookmarks.includes(definition.id));
    }
  }, [definition]);

  // Gestion des favoris
  const toggleBookmark = () => {
    if (!definition) return;

    const bookmarks = JSON.parse(localStorage.getItem('glossary-bookmarks') || '[]');
    let newBookmarks;

    if (isBookmarked) {
      newBookmarks = bookmarks.filter((id: string) => id !== definition.id);
    } else {
      newBookmarks = [...bookmarks, definition.id];
    }

    localStorage.setItem('glossary-bookmarks', JSON.stringify(newBookmarks));
    setIsBookmarked(!isBookmarked);
  };

  // Partage
  const handleShare = async () => {
    if (!definition) return;

    const shareData = {
      title: definition.word,
      text: definition.definition.substring(0, 100) + "...",
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Partage annulé');
      }
    } else {
      // Fallback : copie du lien
      await navigator.clipboard.writeText(window.location.href);
      alert('Lien copié dans le presse-papier !');
    }
    setShowShareMenu(false);
  };

  // Impression
  const handlePrint = () => {
    window.print();
  };

  // Difficulté badge
  const getDifficultyBadge = (difficulty?: string) => {
    const colors = {
      basic: "bg-green-100 text-green-800 border-green-200",
      intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200", 
      advanced: "bg-red-100 text-red-800 border-red-200"
    };

    const labels = {
      basic: "Débutant",
      intermediate: "Intermédiaire",
      advanced: "Avancé"
    };

    if (!difficulty) return null;

    return (
      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${colors[difficulty as keyof typeof colors]}`}>
        <StarIcon className="w-3 h-3 mr-1" />
        {labels[difficulty as keyof typeof labels]}
      </span>
    );
  };

  // Formatage de date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Recherche rapide memoized
  const quickSearchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    // Simulation de résultats de recherche
    const mockTerms = ['ABS', 'ESP', 'Turbo', 'FAP', 'DSG', 'AdBlue'];
    return mockTerms
      .filter(term => term.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 5);
  }, [searchQuery]);

  // Affichage d'erreur
  if (error || !definition) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Fil d'Ariane */}
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-8">
            <Link to="/blog" className="hover:text-gray-700">Blog</Link>
            <ChevronRightIcon className="w-4 h-4" />
            <Link to="/blog/glossaire" className="hover:text-gray-700">Glossaire</Link>
            <ChevronRightIcon className="w-4 h-4" />
            <span className="text-gray-900 font-medium">{word}</span>
          </nav>

          {/* Message d'erreur */}
          <div className="text-center py-12">
            <BookOpenIcon className="w-16 h-16 text-gray-300 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Terme non trouvé</h1>
            <p className="text-lg text-gray-600 mb-8">
              Le terme "{word}" n'a pas été trouvé dans notre glossaire.
            </p>
            
            {/* Recherche alternative */}
            <div className="max-w-md mx-auto mb-8">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un autre terme..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Suggestions rapides */}
              {quickSearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200">
                  {quickSearchResults.map((term, index) => (
                    <Link
                      key={index}
                      to={`/blog/word/${term.toLowerCase()}`}
                      className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center">
                        <BookOpenIcon className="w-4 h-4 text-gray-400 mr-3" />
                        <span className="font-medium">{term}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/blog/glossaire"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Retour au glossaire
              </Link>
              <Link
                to="/blog"
                className="inline-flex items-center px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Voir tous les articles
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête avec actions */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Fil d'Ariane */}
            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              <Link to="/blog" className="hover:text-gray-700">Blog</Link>
              <ChevronRightIcon className="w-4 h-4" />
              <Link to="/blog/glossaire" className="hover:text-gray-700">Glossaire</Link>
              <ChevronRightIcon className="w-4 h-4" />
              <span className="text-gray-900 font-medium">{definition.word}</span>
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleBookmark}
                className={`p-2 rounded-lg transition-colors ${
                  isBookmarked 
                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isBookmarked ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                {isBookmarked ? (
                  <BookmarkIconSolid className="w-5 h-5" />
                ) : (
                  <BookmarkIcon className="w-5 h-5" />
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Partager"
                >
                  <ShareIcon className="w-5 h-5" />
                </button>

                {showShareMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={handleShare}
                      className="block w-full px-4 py-3 text-left hover:bg-gray-50 text-sm"
                    >
                      <ShareIcon className="w-4 h-4 inline mr-3" />
                      Partager le lien
                    </button>
                    <button
                      onClick={handlePrint}
                      className="block w-full px-4 py-3 text-left hover:bg-gray-50 text-sm border-t border-gray-100"
                    >
                      <PrinterIcon className="w-4 h-4 inline mr-3" />
                      Imprimer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* En-tête du terme */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                {definition.word}
              </h1>
              
              <div className="flex items-center flex-wrap gap-3 mb-4">
                {definition.category && (
                  <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    <TagIcon className="w-4 h-4 mr-1" />
                    {definition.category}
                  </span>
                )}
                
                {getDifficultyBadge(definition.difficulty)}
                
                <div className="flex items-center text-sm text-gray-500">
                  <EyeIcon className="w-4 h-4 mr-1" />
                  {definition.viewsCount.toLocaleString()} vues
                </div>
              </div>
            </div>
          </div>

          {/* Définition principale */}
          <div className="prose prose-lg prose-blue max-w-none mb-6">
            <p className="text-lg leading-relaxed text-gray-700">
              {definition.definition}
            </p>
          </div>

          {/* Synonymes */}
          {definition.synonyms && definition.synonyms.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                <LinkIcon className="w-4 h-4 mr-2" />
                Synonymes
              </h3>
              <div className="flex flex-wrap gap-2">
                {definition.synonyms.map((synonym, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 bg-white text-blue-700 text-sm rounded-full border border-blue-200"
                  >
                    {synonym}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Exemples */}
          {definition.examples && definition.examples.length > 0 && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-100">
              <h3 className="text-sm font-semibold text-green-900 mb-2 flex items-center">
                <LightBulbIcon className="w-4 h-4 mr-2" />
                Exemples d'usage
              </h3>
              <ul className="space-y-1">
                {definition.examples.map((example, index) => (
                  <li key={index} className="text-sm text-green-700">
                    • {example}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Métadonnées */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-100 text-sm text-gray-500">
            <div className="flex items-center">
              <CalendarIcon className="w-4 h-4 mr-1" />
              Mis à jour le {formatDate(definition.updatedAt)}
            </div>
          </div>
        </div>

        {/* Contenu en deux colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-8">
            {/* Voir aussi */}
            {definition.seeAlso && definition.seeAlso.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <HashtagIcon className="w-5 h-5 mr-2 text-blue-600" />
                  Voir aussi
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {definition.seeAlso.map((term, index) => (
                    <Link
                      key={index}
                      to={`/blog/word/${term.toLowerCase()}`}
                      className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                    >
                      <div className="flex items-center">
                        <BookOpenIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-600 mr-3" />
                        <span className="font-medium text-gray-900 group-hover:text-blue-700">
                          {term}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Articles liés */}
            {relatedArticles.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <BookOpenIconSolid className="w-5 h-5 mr-2 text-blue-600" />
                  Articles liés
                </h2>
                <div className="space-y-4">
                  {relatedArticles.map((article, index) => (
                    <Link
                      key={index}
                      to={`/blog/${article.type}/${article.slug}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 group-hover:text-blue-700 mb-2">
                            {article.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {article.excerpt}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center">
                              <ClockIcon className="w-3 h-3 mr-1" />
                              {article.readingTime} min
                            </span>
                            <span className="flex items-center">
                              <EyeIcon className="w-3 h-3 mr-1" />
                              {article.viewsCount.toLocaleString()}
                            </span>
                            <span>
                              {formatDate(article.publishedAt)}
                            </span>
                          </div>
                        </div>
                        <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-600 ml-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Termes liés */}
            {relatedTerms.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TagIcon className="w-4 h-4 mr-2 text-purple-600" />
                  Termes liés
                </h3>
                <div className="space-y-3">
                  {relatedTerms.map((term, index) => (
                    <Link
                      key={index}
                      to={`/blog/word/${term.word.toLowerCase()}`}
                      className="block p-3 rounded-lg hover:bg-purple-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 group-hover:text-purple-700">
                            {term.word}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {term.definition.substring(0, 60)}...
                          </p>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-gray-400 group-hover:text-purple-600" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recherche rapide */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MagnifyingGlassIcon className="w-4 h-4 mr-2 text-green-600" />
                Recherche rapide
              </h3>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un terme..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {quickSearchResults.length > 0 && (
                <div className="mt-3 space-y-1">
                  {quickSearchResults.map((term, index) => (
                    <Link
                      key={index}
                      to={`/blog/word/${term.toLowerCase()}`}
                      className="block px-3 py-2 hover:bg-green-50 rounded transition-colors text-sm"
                      onClick={() => setSearchQuery("")}
                    >
                      <span className="font-medium text-green-700">{term}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Navigation</h3>
              <div className="space-y-2">
                <Link
                  to="/blog/glossaire"
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                >
                  → Tous les termes
                </Link>
                <Link
                  to="/blog"
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                >
                  → Articles du blog
                </Link>
                <Link
                  to="/blog/advice"
                  className="block px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                >
                  → Conseils automobile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
