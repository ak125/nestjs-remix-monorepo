import { Link } from '@remix-run/react';
import React from 'react';

interface MotorisationItem {
  title: string;
  marque_name: string;
  modele_name: string;
  type_name: string;
  puissance: string;
  periode: string;
  image: string;
  link: string;
  description: string;
  advice: string;
}

interface MotorisationsSectionProps {
  motorisations?: {
    title: string;
    items: MotorisationItem[];
  };
}

export default function MotorisationsSection({ motorisations }: MotorisationsSectionProps) {
  if (!motorisations?.items || motorisations.items.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          🚗 {motorisations.title}
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            {motorisations.items.length} disponibles
          </span>
        </h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {motorisations.items.map((motorisation, index) => (
            <Link
              key={index}
              to={motorisation.link}
              className="group border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <img
                    src={motorisation.image}
                    alt={`${motorisation.marque_name} ${motorisation.modele_name}`}
                    className="w-16 h-16 object-cover rounded-lg border-2 border-gray-100 group-hover:border-blue-200 transition-colors"
                    onError={(e) => {
                      e.currentTarget.src = '/images/default-car.jpg';
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                    {motorisation.marque_name} {motorisation.modele_name}
                  </h3>
                  
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {motorisation.type_name}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {motorisation.puissance}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{motorisation.periode}</p>
                  </div>
                  
                  <p className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
                    {motorisation.description}
                  </p>
                  
                  <div className="mt-3 flex items-center text-xs text-blue-600 font-medium group-hover:text-blue-700">
                    Voir les pièces compatibles
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}