/**
 * 📖 Guide d'achat pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Guide détaillé pour aider à l'achat
 */

import React from 'react';
import { type GuideContent } from '../../types/pieces-route.types';

interface PiecesBuyingGuideProps {
  guide: GuideContent;
}

/**
 * Composant Guide d'achat structuré
 */
export function PiecesBuyingGuide({ guide }: PiecesBuyingGuideProps) {
  
  return (
    <div className="relative overflow-hidden bg-white rounded-3xl shadow-2xl shadow-slate-900/10">
      {/* ✨ Effet de bordure gradient animé */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-[0.03]"></div>
      
      {/* 📘 En-tête Premium */}
      <div className="relative overflow-hidden">
        {/* Background avec mesh gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]"></div>
        
        {/* Cercles décoratifs */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 px-8 py-8">
          <div className="flex items-center gap-4">
            {/* Icône avec glassmorphism */}
            <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {guide.title}
              </h2>
              <p className="text-white/60 text-sm mt-1">
                Tout ce que vous devez savoir avant d'acheter
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* 📝 Contenu principal - Style magazine */}
        <div className="relative">
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 rounded-full"></div>
          <p className="text-slate-700 leading-relaxed text-lg pl-6 font-medium">
            {guide.content}
          </p>
        </div>

        {/* 💡 Conseils d'expert - Cards modernes */}
        {guide.tips.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Conseils d'expert
              </h3>
            </div>
            
            <div className="grid gap-3">
              {guide.tips.map((tip, index) => (
                <div 
                  key={index} 
                  className="group relative bg-gradient-to-r from-slate-50 to-white rounded-2xl p-5 border border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300"
                >
                  {/* Numéro avec effet glass */}
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-xl group-hover:bg-emerald-500 group-hover:scale-110 transition-all">
                    {index + 1}
                  </div>
                  
                  <p className="text-slate-700 leading-relaxed pl-6">
                    {tip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ⚠️ Avertissements - Style alerte moderne */}
        {guide.warnings && guide.warnings.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50"></div>
            
            {/* Pattern */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-400 to-red-500 rounded-full blur-3xl opacity-20"></div>
            </div>
            
            <div className="relative z-10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-amber-900">
                  Points d'attention
                </h3>
              </div>
              
              <ul className="space-y-3">
                {guide.warnings.map((warning, index) => (
                  <li 
                    key={index} 
                    className="flex items-start gap-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-amber-200/50"
                  >
                    <span className="flex-shrink-0 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <span className="text-amber-900 font-medium">{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 📞 CTA - Design conversion premium */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* Background avec dégradé animé */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0ic3RhcnMiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iMSIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC4yIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3N0YXJzKSIvPjwvc3ZnPg==')]"></div>
          
          {/* Effet de flou décoratif */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/30 rounded-full blur-2xl"></div>
          
          <div className="relative z-10 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h4 className="text-xl font-bold text-white mb-2">
              Besoin d'aide pour choisir ?
            </h4>
            <p className="text-white/70 text-sm mb-6">
              Nos experts sont là pour vous accompagner
            </p>
            
            <div className="flex gap-4 justify-center flex-wrap">
              {/* Bouton principal - CTA fort */}
              <button className="group relative overflow-hidden bg-white text-slate-900 px-8 py-4 rounded-xl font-bold shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:-translate-y-1">
                {/* Effet shimmer */}
                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-slate-200/50 to-transparent"></div>
                <span className="relative flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Contacter un expert
                </span>
              </button>
              
              {/* Bouton secondaire */}
              <button className="group bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-bold border border-white/20 hover:bg-white/20 transition-all duration-300">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Voir les avis clients
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
