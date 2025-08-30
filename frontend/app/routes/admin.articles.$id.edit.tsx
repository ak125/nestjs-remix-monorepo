/**
 * Interface d'Édition d'Article
 * Permet de créer ou modifier un article
 * @route /admin/articles/new ou /admin/articles/:id/edit
 */

import { json, redirect, type LoaderFunctionArgs, type MetaFunction, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, Link, useNavigation, useActionData } from "@remix-run/react";
import { useState, useEffect } from "react";

// Icons
const ArrowLeftIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

const SaveIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const EyeIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Types
interface Article {
  id?: string;
  titre: string;
  contenu: string;
  meta_description: string;
  slug: string;
  type: 'advice' | 'guide';
  created_at?: string;
  updated_at?: string;
}

interface LoaderData {
  article?: Article;
  isNew: boolean;
  isError: boolean;
  errorMessage?: string;
}

interface ActionData {
  success: boolean;
  message: string;
  articleId?: string;
}

// Loader pour récupérer l'article à modifier
export async function loader({ params }: LoaderFunctionArgs) {
  const articleId = params.id;
  const isNew = !articleId || articleId === 'new';

  if (isNew) {
    return json<LoaderData>({
      article: {
        titre: '',
        contenu: '',
        meta_description: '',
        slug: '',
        type: 'advice'
      },
      isNew: true,
      isError: false
    });
  }

  try {
    // Simulation de récupération d'article existant
    const demoArticle: Article = {
      id: articleId,
      titre: "Comment choisir ses plaquettes de frein",
      contenu: `# Comment choisir ses plaquettes de frein

## Introduction
Le choix des plaquettes de frein est crucial pour la sécurité de votre véhicule. Ce guide vous aidera à faire le bon choix.

## Critères de sélection

### 1. Type de conduite
- **Conduite urbaine** : Plaquettes organiques ou semi-métalliques
- **Conduite sportive** : Plaquettes céramiques ou métalliques
- **Conduite mixte** : Plaquettes semi-métalliques

### 2. Matériaux disponibles
- **Organiques** : Silencieuses, peu abrasives pour les disques
- **Semi-métalliques** : Bon compromis performance/prix
- **Céramiques** : Performances élevées, durée de vie longue
- **Métalliques** : Performance maximale, usage intensif

### 3. Compatibilité véhicule
Vérifiez toujours la compatibilité avec votre modèle de véhicule.

## Installation et entretien
Il est recommandé de faire installer vos plaquettes par un professionnel pour garantir votre sécurité.

## Conclusion
Le choix des plaquettes dépend de votre style de conduite et de votre budget. N'hésitez pas à demander conseil à un professionnel.`,
      meta_description: "Découvrez comment choisir les plaquettes de frein adaptées à votre voiture",
      slug: "comment-choisir-plaquettes-frein",
      type: "advice",
      created_at: "2025-08-25T10:00:00Z",
      updated_at: "2025-08-30T14:00:00Z"
    };

    return json<LoaderData>({
      article: demoArticle,
      isNew: false,
      isError: false
    });

  } catch (error) {
    return json<LoaderData>({
      isNew: false,
      isError: true,
      errorMessage: error instanceof Error ? error.message : "Erreur lors du chargement de l'article"
    });
  }
}

// Action pour sauvegarder l'article
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const articleId = params.id;
  const isNew = !articleId || articleId === 'new';

  const article = {
    titre: formData.get('titre') as string,
    contenu: formData.get('contenu') as string,
    meta_description: formData.get('meta_description') as string,
    slug: formData.get('slug') as string,
    type: formData.get('type') as 'advice' | 'guide'
  };

  // Validation simple
  if (!article.titre || !article.contenu || !article.slug) {
    return json<ActionData>({
      success: false,
      message: "Veuillez remplir tous les champs obligatoires"
    });
  }

  try {
    // Simulation de sauvegarde
    await new Promise(resolve => setTimeout(resolve, 500));

    if (isNew) {
      const newId = `${article.type}_${Date.now()}`;
      return json<ActionData>({
        success: true,
        message: "Article créé avec succès !",
        articleId: newId
      });
    } else {
      return json<ActionData>({
        success: true,
        message: "Article mis à jour avec succès !",
        articleId: articleId
      });
    }

  } catch (error) {
    return json<ActionData>({
      success: false,
      message: error instanceof Error ? error.message : "Erreur lors de la sauvegarde"
    });
  }
}

// Métadonnées
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const isNew = data?.isNew;
  const title = isNew ? "Créer un article" : "Modifier l'article";
  
  return [
    { title: `Administration - ${title}` },
    { name: "description", content: "Interface de création et modification d'articles." },
    { name: "robots", content: "noindex, nofollow" }
  ];
};

// Fonction pour générer un slug à partir du titre
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Composant principal
export default function AdminArticleEditPage() {
  const { article, isNew, isError, errorMessage } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  
  const [formData, setFormData] = useState({
    titre: article?.titre || '',
    contenu: article?.contenu || '',
    meta_description: article?.meta_description || '',
    slug: article?.slug || '',
    type: article?.type || 'advice'
  });

  const [previewMode, setPreviewMode] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Auto-génération du slug
  useEffect(() => {
    if (formData.titre && (!formData.slug || isNew)) {
      setFormData(prev => ({
        ...prev,
        slug: generateSlug(formData.titre)
      }));
    }
  }, [formData.titre, isNew]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Redirect après succès
  useEffect(() => {
    if (actionData?.success && actionData?.articleId) {
      // Redirection après succès (simulée)
      setTimeout(() => {
        window.location.href = '/admin/articles';
      }, 2000);
    }
  }, [actionData]);

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-600 mb-4">Erreur</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <Link
              to="/admin/articles"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Retour aux articles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/admin/articles"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isNew ? 'Créer un article' : 'Modifier l\'article'}
                </h1>
                <p className="text-gray-600">
                  {isNew ? 'Rédigez un nouveau contenu pour votre blog' : 'Modifiez le contenu existant'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  previewMode 
                    ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <EyeIcon className="w-5 h-5" />
                <span>{previewMode ? 'Éditer' : 'Aperçu'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages de retour */}
      {actionData && (
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4`}>
          <div className={`p-4 rounded-lg ${
            actionData.success 
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="font-medium">{actionData.message}</p>
            {actionData.success && (
              <p className="text-sm mt-1">Redirection vers la liste des articles...</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {previewMode ? (
          /* Mode Aperçu */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  formData.type === 'guide' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {formData.type === 'advice' ? 'Conseil' : 'Guide'}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{formData.titre || 'Titre de l\'article'}</h1>
              <p className="text-lg text-gray-600 mb-8">{formData.meta_description || 'Description de l\'article'}</p>
              <div className="prose max-w-none">
                <div className="whitespace-pre-wrap">{formData.contenu || 'Contenu de l\'article...'}</div>
              </div>
            </div>
          </div>
        ) : (
          /* Mode Édition */
          <Form method="post" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Colonne principale - Contenu */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Contenu de l'article</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="titre" className="block text-sm font-medium text-gray-700 mb-2">
                        Titre *
                      </label>
                      <input
                        type="text"
                        id="titre"
                        name="titre"
                        value={formData.titre}
                        onChange={(e) => handleInputChange('titre', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Entrez le titre de votre article"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="contenu" className="block text-sm font-medium text-gray-700 mb-2">
                        Contenu *
                      </label>
                      <textarea
                        id="contenu"
                        name="contenu"
                        value={formData.contenu}
                        onChange={(e) => handleInputChange('contenu', e.target.value)}
                        rows={20}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="Rédigez votre article en Markdown..."
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Vous pouvez utiliser le format Markdown pour structurer votre contenu
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colonne latérale - Métadonnées */}
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Paramètres</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                        Type d'article
                      </label>
                      <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={(e) => handleInputChange('type', e.target.value as 'advice' | 'guide')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="advice">Conseil</option>
                        <option value="guide">Guide</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-2">
                        Slug (URL) *
                      </label>
                      <input
                        type="text"
                        id="slug"
                        name="slug"
                        value={formData.slug}
                        onChange={(e) => handleInputChange('slug', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        placeholder="url-de-larticle"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        L'URL sera: /blog/{formData.slug || 'slug-article'}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="meta_description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description SEO *
                      </label>
                      <textarea
                        id="meta_description"
                        name="meta_description"
                        value={formData.meta_description}
                        onChange={(e) => handleInputChange('meta_description', e.target.value)}
                        rows={3}
                        maxLength={160}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Description qui apparaîtra dans les résultats de recherche"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.meta_description.length}/160 caractères
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="space-y-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded-lg flex items-center justify-center space-x-2 font-medium transition-colors"
                    >
                      <SaveIcon className="w-5 h-5" />
                      <span>
                        {isSubmitting 
                          ? 'Sauvegarde...' 
                          : isNew 
                            ? 'Créer l\'article' 
                            : 'Mettre à jour'
                        }
                      </span>
                    </button>
                    
                    <Link
                      to="/admin/articles"
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg text-center block font-medium transition-colors"
                    >
                      Annuler
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
}
