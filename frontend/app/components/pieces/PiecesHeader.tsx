/**
 * 🎨 Header Moderne pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * ⚠️ URLS PRÉSERVÉES - Breadcrumb et navigation inchangés
 */

import React from 'react';
import { type VehicleData, type GammeData, type PerformanceInfo } from '../../types/pieces-route.types';

interface PiecesHeaderProps {
  vehicle: VehicleData;
  gamme: GammeData;
  count: number;
  performance?: PerformanceInfo;
}

/**
 * Header moderne avec gradient bleu (style route actuelle)
 * ⚠️ URLs breadcrumb strictement préservées
 */
export function PiecesHeader({ vehicle, gamme, count, performance }: PiecesHeaderProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Gradient de fond (identique à la route actuelle) */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800"></div>
      <div className="absolute inset-0 opacity-10">
        <div 
          className="w-full h-full" 
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 2px, transparent 2px)', 
            backgroundSize: '30px 30px'
          }}
        ></div>
      </div>
      
      {/* Contenu du header */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            {/* Breadcrumb moderne - ⚠️ URLs PRÉSERVÉES */}
            <nav className="flex items-center space-x-2 text-sm text-blue-100 mb-4">
              <a href="/" className="hover:text-white transition-colors flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                </svg>
                Accueil
              </a>
              <span className="text-blue-300">→</span>
              <a href="/pieces" className="hover:text-white transition-colors">Pièces</a>
              <span className="text-blue-300">→</span>
              {/* ⚠️ URL PRÉSERVÉE: /pieces/{gamme} */}
              <a 
                href={`/pieces/${gamme.alias}`} 
                className="text-white font-medium hover:text-blue-200 transition-colors"
              >
                {gamme.name}
              </a>
              <span className="text-blue-300">→</span>
              <span className="text-blue-200">{vehicle.marque} {vehicle.modele}</span>
            </nav>
            
            {/* Titre principal */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
                  <span className="text-white text-sm font-medium">Pièces automobile</span>
                </div>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                {gamme.name}
              </h1>
              <p className="text-xl text-blue-100 mb-4">
                Pour <span className="font-semibold text-white">{vehicle.marque} {vehicle.modele}</span>
                <span className="text-blue-200"> • {vehicle.type}</span>
              </p>
            </div>
            
            {/* Badges informatifs */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-white font-medium">{count} pièces</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-white font-medium">Qualité garantie</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-white font-medium">Livraison rapide</span>
              </div>
              {performance && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                  <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-white text-sm">
                    {performance.source} • {performance.loadTime}ms
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-4">
            <button className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/20 transition-all duration-200 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Changer de véhicule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
