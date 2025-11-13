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
    <section className="bg-white rounded-xl shadow-lg mb-6 md:mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-semantic-action to-semantic-action/90 p-4 md:p-6">
        <h2 className="text-xl md:text-2xl font-bold text-white flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <span>📦 {catalogueMameFamille.title}</span>
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium w-fit">
            {catalogueMameFamille.items.length} produits
          </span>
        </h2>
      </div>
      
      <div className="p-3 md:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
          {catalogueMameFamille.items.map((item, index) => (
            <Link
              key={index}
              to={item.link}
              className="group bg-neutral-50 rounded-lg p-3 hover:bg-white hover:shadow-md border border-neutral-200 hover:border-semantic-action transition-all duration-200 hover:-translate-y-1"
            >
              <div className="text-center">
                <div className="relative mb-2">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-20 md:h-24 object-contain rounded group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      e.currentTarget.src = '/images/default-piece.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </div>
                
                <h3 className="font-semibold text-xs md:text-sm text-neutral-900 group-hover:text-semantic-action transition-colors mb-1.5 line-clamp-2 leading-tight">
                  {item.name}
                </h3>
                
                <p className="text-[10px] md:text-xs text-neutral-600 group-hover:text-neutral-700 transition-colors mb-2 line-clamp-2 leading-snug">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-center text-[10px] md:text-xs text-semantic-action font-medium group-hover:text-semantic-action/80">
                  Découvrir
                  <svg className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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