import { Link } from '@remix-run/react';
import React from 'react';

interface CatalogueItem {
  name: string;
  link: string;
  image: string;
  description: string;
  meta_description: string;
}

interface CatalogueSectionProps {
  catalogueMameFamille?: {
    title: string;
    items: CatalogueItem[];
  };
}

export default function CatalogueSection({ catalogueMameFamille }: CatalogueSectionProps) {
  if (!catalogueMameFamille?.items || catalogueMameFamille.items.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          📦 {catalogueMameFamille.title}
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            {catalogueMameFamille.items.length} produits
          </span>
        </h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalogueMameFamille.items.map((item, index) => (
            <Link
              key={index}
              to={item.link}
              className="group bg-gray-50 rounded-lg p-4 hover:bg-white hover:shadow-md border border-gray-200 hover:border-purple-300 transition-all duration-200 hover:-translate-y-1"
            >
              <div className="text-center">
                <div className="relative mb-4">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-32 object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      e.currentTarget.src = '/images/default-piece.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </div>
                
                <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors mb-2 line-clamp-2">
                  {item.name}
                </h3>
                
                <p className="text-sm text-gray-600 group-hover:text-gray-700 transition-colors mb-3 line-clamp-3">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-center text-xs text-purple-600 font-medium group-hover:text-purple-700">
                  Découvrir
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}