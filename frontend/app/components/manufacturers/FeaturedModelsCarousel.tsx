/**
 * 🚗 CAROUSEL MODÈLES POPULAIRES
 * 
 * Composant pour afficher les modèles les plus consultés
 * Réplique la section PHP "Modèles populaires"
 */

import { Link } from "@remix-run/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface FeaturedModel {
  type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power: number;
  type_date_range: string;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;
  modele_image_url: string;
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  url: string;
  seo_title: string;
  seo_description: string;
}

interface FeaturedModelsCarouselProps {
  models: FeaturedModel[];
  autoplay?: boolean;
  intervalMs?: number;
}

export function FeaturedModelsCarousel({
  models,
  autoplay = true,
  intervalMs = 5000,
}: FeaturedModelsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const itemsPerPage = 4; // Nombre de modèles visibles à la fois

  // Calculer le nombre total de pages
  const totalPages = Math.ceil(models.length / itemsPerPage);

  // Navigation
  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalPages);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
  };

  // Autoplay
  useState(() => {
    if (autoplay) {
      const interval = setInterval(goToNext, intervalMs);
      return () => clearInterval(interval);
    }
  });

  // Calculer les modèles visibles
  const startIndex = currentIndex * itemsPerPage;
  const visibleModels = models.slice(startIndex, startIndex + itemsPerPage);

  if (models.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            🚗 Modèles les plus consultés
          </h2>
          <p className="text-gray-600 mt-1">
            Découvrez les véhicules les plus recherchés
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            disabled={totalPages <= 1}
            aria-label="Précédent"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNext}
            disabled={totalPages <= 1}
            aria-label="Suivant"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Carousel */}
      <div className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleModels.map((model) => (
            <Link
              key={model.type_id}
              to={model.url}
              className="group"
              prefetch="intent"
            >
              <Card className="h-full transition-all hover:shadow-lg">
                <CardContent className="p-4">
                  {/* Image */}
                  <div className="relative aspect-video mb-4 bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={model.modele_image_url}
                      alt={`${model.marque_name} ${model.modele_name}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback si image manquante
                        e.currentTarget.src =
                          "https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/no.png";
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {model.marque_name} {model.modele_name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {model.type_name_meta} - {model.type_power}ch
                    </p>
                    {model.type_date_range && (
                      <p className="text-xs text-gray-500 mt-1">
                        {model.type_date_range}
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-blue-600 font-medium group-hover:underline">
                      Voir les pièces →
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Pagination dots */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-primary w-8"
                  : "bg-muted/50 hover:bg-gray-400"
              }`}
              aria-label={`Aller à la page ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
