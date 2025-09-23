import { Link } from '@remix-run/react';
import React from 'react';

interface GuideItem {
  id: number;
  title: string;
  alias: string;
  preview: string;
  wall: string;
  date: string;
  image: string;
  link: string;
  h2_content?: string;
}

interface GuideSectionProps {
  guide?: GuideItem;
}

export default function GuideSection({ guide }: GuideSectionProps) {
  if (!guide) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          📖 Guide Expert
          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
            Conseils Pro
          </span>
        </h2>
      </div>
      
      <div className="p-6">
        <Link
          to={guide.link}
          className="group block"
        >
          <div className="relative overflow-hidden rounded-lg mb-4">
            <img
              src={guide.wall || guide.image}
              alt={guide.title}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.currentTarget.src = '/images/default-guide.jpg';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-xl font-bold text-white group-hover:text-emerald-200 transition-colors">
                {guide.title}
              </h3>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Mis à jour le {formatDate(guide.date)}
            </div>
            
            <p className="text-gray-700 leading-relaxed group-hover:text-gray-800 transition-colors">
              {guide.preview}
            </p>
            
            {guide.h2_content && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Aperçu du contenu :</h4>
                <p className="text-sm text-gray-600">{guide.h2_content}</p>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center text-emerald-600 font-medium group-hover:text-emerald-700 transition-colors">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Lire le guide complet
              </div>
              
              <svg className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}