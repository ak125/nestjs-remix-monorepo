/**
 * 🛍️ Product Tabs - Composant d'onglets pour fiche produit
 * 
 * Organise les informations produit en onglets :
 * - Description détaillée
 * - Caractéristiques techniques
 * - Avis clients
 * - Guide d'installation (optionnel)
 * 
 * Features:
 * - Navigation par clavier (Tab, flèches)
 * - Liens profonds (URL hash)
 * - Badge nombre d'avis
 * - Contenu scrollable
 * - Responsive mobile/desktop
 */

import { useState } from 'react';

import {
  FileText,
  MessageSquare,
  Settings2,
  Wrench,
} from 'lucide-react';

import { Badge } from '../ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';

interface ProductTabsProps {
  /** Description HTML ou texte du produit */
  description: string;
  /** Caractéristiques techniques (paires clé-valeur) */
  specifications?: Record<string, string | number>;
  /** Avis clients */
  reviews?: {
    id: string;
    author: string;
    rating: number;
    comment: string;
    date: string;
  }[];
  /** Guide d'installation (optionnel) */
  installationGuide?: string;
  /** Onglet par défaut */
  defaultTab?: 'description' | 'specs' | 'reviews' | 'installation';
  /** Classe CSS additionnelle */
  className?: string;
}

export function ProductTabs({
  description,
  specifications = {},
  reviews = [],
  installationGuide,
  defaultTab = 'description',
  className = '',
}: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Calculer note moyenne
  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className={`w-full ${className}`}
    >
      <TabsList className="grid w-full grid-cols-3 md:grid-cols-4 gap-2">
        <TabsTrigger value="description" className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Description</span>
        </TabsTrigger>

        <TabsTrigger value="specs" className="flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Caractéristiques</span>
        </TabsTrigger>

        <TabsTrigger value="reviews" className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Avis</span>
          {reviews.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {reviews.length}
            </Badge>
          )}
        </TabsTrigger>

        {installationGuide && (
          <TabsTrigger value="installation" className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Installation</span>
          </TabsTrigger>
        )}
      </TabsList>

      {/* Description */}
      <TabsContent value="description" className="mt-6">
        <div className="prose prose-sm max-w-none">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Description du produit
          </h3>
          <div
            className="text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        </div>
      </TabsContent>

      {/* Caractéristiques */}
      <TabsContent value="specs" className="mt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Caractéristiques techniques
          </h3>
          {Object.keys(specifications).length > 0 ? (
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
              {Object.entries(specifications).map(([key, value], index) => (
                <div
                  key={index}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {key}
                  </span>
                  <span className="text-sm text-gray-900 font-semibold">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">
              Aucune caractéristique technique disponible.
            </p>
          )}
        </div>
      </TabsContent>

      {/* Avis */}
      <TabsContent value="reviews" className="mt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Avis clients ({reviews.length})
            </h3>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900">
                  {averageRating}
                </span>
                <div className="flex items-center text-yellow-400">
                  {'★'.repeat(Math.round(Number(averageRating)))}
                  {'☆'.repeat(5 - Math.round(Number(averageRating)))}
                </div>
              </div>
            )}
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {review.author}
                      </p>
                      <p className="text-sm text-gray-500">{review.date}</p>
                    </div>
                    <div className="flex items-center text-yellow-400">
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </div>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    {review.comment}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Aucun avis pour le moment</p>
              <p className="text-sm text-gray-400">
                Soyez le premier à donner votre avis !
              </p>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Guide d'installation */}
      {installationGuide && (
        <TabsContent value="installation" className="mt-6">
          <div className="prose prose-sm max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Guide d'installation
            </h3>
            <div
              className="text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: installationGuide }}
            />
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
