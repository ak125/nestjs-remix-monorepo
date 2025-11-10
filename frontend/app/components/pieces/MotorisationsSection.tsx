import { Badge } from '@fafa/ui';
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
    <section className="bg-white rounded-xl shadow-lg mb-6 md:mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-semantic-info to-semantic-info/90 p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-white flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span>🚗 {motorisations.title}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium w-fit">
            {motorisations.items.length} disponibles
          </span>
        </h2>
      </div>
      
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {motorisations.items.map((motorisation, index) => (
            <Link
              key={index}
              to={motorisation.link}
              className="group border border-neutral-200 rounded-lg p-4 md:p-5 hover:border-semantic-info hover:shadow-md transition-all duration-200 hover:-translate-y-1"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <img
                    src={motorisation.image}
                    alt={`${motorisation.marque_name} ${motorisation.modele_name}`}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border-2 border-neutral-100 group-hover:border-semantic-info/30 transition-colors"
                    onError={(e) => {
                      e.currentTarget.src = '/images/default-car.jpg';
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-neutral-900 group-hover:text-semantic-info transition-colors mb-2 text-sm sm:text-base">
                    {motorisation.marque_name} {motorisation.modele_name}
                  </h3>
                  
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="info">{motorisation.type_name}</Badge>
                      <Badge variant="success">{motorisation.puissance}</Badge>
                    </div>
                    <p className="text-sm text-neutral-600">{motorisation.periode}</p>
                  </div>
                  
                  <p className="text-sm text-neutral-500 group-hover:text-neutral-700 transition-colors line-clamp-2">
                    {motorisation.description}
                  </p>
                  
                  <div className="mt-3 flex items-center text-xs text-semantic-info font-medium group-hover:text-semantic-info/80">
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