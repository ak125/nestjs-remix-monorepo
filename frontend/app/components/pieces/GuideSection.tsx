import { Link } from '@remix-run/react';
import React from 'react';
import { BookOpen, Calendar, ArrowRight, Sparkles } from 'lucide-react';

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
  familleColor?: string;
  familleName?: string;
}

export default function GuideSection({ guide, familleColor = 'from-emerald-600 to-emerald-700', familleName }: GuideSectionProps) {
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
    <section className="mb-8">
      {/* Conteneur principal avec bordure gradient */}
      <div className="relative rounded-xl overflow-hidden shadow-xl">
        {/* Bordure avec gradient de la famille */}
        <div className={`absolute inset-0 bg-gradient-to-br ${familleColor} rounded-xl`}></div>
        
        {/* Contenu avec fond blanc */}
        <div className="relative bg-white rounded-lg m-0.5">
          
          {/* Header avec gradient de la famille */}
          <div className={`relative bg-gradient-to-br ${familleColor} p-6 overflow-hidden`}>
            {/* Effet de brillance */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                    Guide Expert
                  </h2>
                  <p className="text-white/80 text-sm mt-1">
                    {familleName ? `Spécial ${familleName}` : 'Conseils Pro'}
                  </p>
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">Conseils Pro</span>
              </div>
            </div>
          </div>
          
          {/* Contenu du guide */}
          <div className="p-6 md:p-8">
            <Link
              to={guide.link}
              className="group block"
            >
              {/* Image avec overlay amélioré */}
              <div className="relative overflow-hidden rounded-xl mb-6 shadow-lg">
                <img
                  src={guide.wall || guide.image}
                  alt={guide.title}
                  className="w-full h-56 md:h-64 object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.src = '/images/default-guide.jpg';
                  }}
                />
                <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 transition-all duration-300`}></div>
                
                {/* Titre sur l'image */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg group-hover:text-white/90 transition-colors leading-tight">
                    {guide.title}
                  </h3>
                </div>
                
                {/* Badge "Nouveau" si récent */}
                {(() => {
                  const daysAgo = Math.floor((Date.now() - new Date(guide.date).getTime()) / (1000 * 60 * 60 * 24));
                  return daysAgo < 30 ? (
                    <div className="absolute top-4 right-4 bg-yellow-400 text-gray-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Nouveau
                    </div>
                  ) : null;
                })()}
              </div>
              
              {/* Informations et contenu */}
              <div className="space-y-4">
                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${familleColor} flex items-center justify-center`}>
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <span>Mis à jour le {formatDate(guide.date)}</span>
                </div>
                
                {/* Preview */}
                <p className="text-gray-700 text-base md:text-lg leading-relaxed">
                  {guide.preview}
                </p>
                
                {/* Aperçu du contenu */}
                {guide.h2_content && (
                  <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-5">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${familleColor} flex items-center justify-center`}>
                        <BookOpen className="w-3.5 h-3.5 text-white" />
                      </div>
                      Aperçu du contenu :
                    </h4>
                    <div 
                      className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: guide.h2_content }}
                    />
                  </div>
                )}
                
                {/* CTA */}
                <div className="pt-4 border-t border-gray-200">
                  <div className={`inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r ${familleColor} text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105`}>
                    <BookOpen className="w-5 h-5" />
                    <span>Lire le guide complet</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
          
        </div>
      </div>
    </section>
  );
}