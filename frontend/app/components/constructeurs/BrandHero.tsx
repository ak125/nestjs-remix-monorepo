import { Badge } from '@fafa/ui';
// 🏭 BrandHero - Section héro moderne pour page constructeur
// Design moderne avec informations marque et VehicleSelector intégré

import { Link } from '@remix-run/react';
import { Car, Home, ChevronRight } from 'lucide-react';
import VehicleSelectorV2 from '../vehicle/VehicleSelectorV2';

interface BrandHeroProps {
  brand: {
    marque_id: number;
    marque_alias: string;
    marque_name: string;
    marque_name_meta: string;
    marque_name_meta_title: string;
    marque_logo: string;
    marque_country?: string;
  };
  seo: {
    h1?: string;
    title?: string;
    descrip?: string;
  };
  className?: string;
}

const BrandHero: React.FC<BrandHeroProps> = ({ brand, seo, className = "" }) => {
  return (
    <div className={`bg-gradient-to-br from-blue-50 via-white to-gray-50 border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
        
        {/* 🍞 Fil d'Ariane moderne */}
        <nav className="flex items-center space-x-2 text-sm mb-8" aria-label="Fil d'Ariane">
          <Link 
            to="/" 
            className="flex items-center text-gray-600 hover:text-blue-600 transition-colors duration-200"
          >
            <Home className="w-4 h-4 mr-1" />
            Accueil
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <Link 
            to="/constructeurs" 
            className="text-gray-600 hover:text-blue-600 transition-colors duration-200"
          >
            Constructeurs
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-blue-600 font-semibold">
            {brand.marque_name}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* 📝 Section informations marque */}
          <div className="space-y-6">
            
            {/* 🏷️ En-tête marque */}
            <div className="flex items-center space-x-4">
              {/* Logo marque */}
              <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center p-3">
                {brand.marque_logo ? (
                  <img
                    src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${brand.marque_logo}`}
                    alt={`Logo ${brand.marque_name}`}
                    className="w-full h-full object-contain"
                    loading="eager"
                  />
                ) : (
                  <Car className="w-12 h-12 text-gray-400" />
                )}
              </div>
              
              {/* Informations marque */}
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                  {seo.h1 || `Pièces auto ${brand.marque_name}`}
                </h1>
                <p className="text-lg text-gray-600">
                  {brand.marque_country && (
                    <Badge variant="info">{brand.marque_country}</Badge>
                  )}
                  Constructeur automobile
                </p>
              </div>
            </div>

            {/* 📄 Description */}
            <div className="prose prose-gray">
              <p className="text-gray-600 leading-relaxed">
                {seo.descrip || 
                  `Découvrez notre catalogue complet de pièces détachées pour véhicules ${brand.marque_name}. 
                   Pièces d'origine et compatibles, livraison rapide, garantie constructeur.`
                }
              </p>
            </div>

            {/* 📊 Statistiques ou features */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="text-2xl font-bold text-blue-600 mb-1">1000+</div>
                <div className="text-sm text-gray-600">Pièces disponibles</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="text-2xl font-bold text-green-600 mb-1">24H</div>
                <div className="text-sm text-gray-600">Livraison express</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="text-2xl font-bold text-purple-600 mb-1">2 ans</div>
                <div className="text-sm text-gray-600">Garantie</div>
              </div>
            </div>
          </div>

          {/* 🚗 Section VehicleSelector */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 lg:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Trouvez vos pièces {brand.marque_name}
              </h2>
              <p className="text-gray-600">
                Sélectionnez votre modèle pour découvrir les pièces compatibles
              </p>
            </div>
            
            {/* 🔍 Indicateur véhicule actuel */}
<Alert className="rounded-xl p-4 mb-6" variant="info">
              <div className="flex items-center text-blue-800">
                <Car className="w-5 h-5 mr-2" />
                <span className="font-medium">Marque sélectionnée :</span>
                <strong className="ml-2">{brand.marque_name}</strong>
              </div>
            </Alert>
            
            {/* 🚗 VehicleSelector intégré */}
            <VehicleSelectorV2 
              context="homepage"
              mode="full"
              variant="card"
              redirectOnSelect={true}
              redirectTo="vehicle-page"
              onVehicleSelect={(selection) => {
                console.log("🚗 Sélection véhicule depuis page marque:", selection);
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'vehicle_selection', {
                    brand: selection.brand.marque_name,
                    model: selection.model.modele_name,
                    type: selection.type.type_name,
                    context: 'brand_page',
                    brand_page: brand.marque_name,
                    page_location: window.location.pathname
                  });
                }
              }}
              className="w-full"
            />
            
            {/* 💡 Conseils */}
            <div className="mt-6 p-4 bg-success/5 border border-green-200 rounded-lg">
              <div className="flex items-center text-green-800 text-sm">
                <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                <span className="font-medium">Conseil :</span>
              </div>
              <div className="mt-1 text-sm text-green-700">
                Utilisez le numéro VIN de votre véhicule pour une compatibilité garantie à 100%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandHero;