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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-200">
        <h2 className="text-2xl font-bold text-purple-900 flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {guide.title}
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Contenu principal */}
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-700 leading-relaxed text-base">
            {guide.content}
          </p>
        </div>

        {/* Conseils pratiques */}
        {guide.tips.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Conseils d'expert
            </h3>
            <div className="space-y-3">
              {guide.tips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed flex-1">
                    {tip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Avertissements */}
        {guide.warnings && guide.warnings.length > 0 && (
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-6 border-2 border-red-200">
            <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Points d'attention
            </h3>
            <ul className="space-y-2">
              {guide.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-red-800 bg-white rounded p-2">
                  <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-5 text-center border border-purple-200">
          <p className="text-purple-900 font-medium mb-3">
            Besoin d'aide pour choisir la bonne pièce ?
          </p>
          <div className="flex gap-3 justify-center">
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm">
              Contacter un expert
            </button>
            <button className="bg-white hover:bg-gray-50 text-purple-600 px-6 py-2 rounded-lg font-medium transition-colors border border-purple-300">
              Voir les avis clients
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
