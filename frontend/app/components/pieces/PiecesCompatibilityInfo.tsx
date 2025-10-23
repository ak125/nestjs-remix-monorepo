/**
 * 🔧 Informations de compatibilité pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Affichage des infos de compatibilité moteur/années
 */

import React from 'react';
import { Alert } from '~/components/ui/alert';
import { type CompatibilityInfo } from '../../types/pieces-route.types';

interface PiecesCompatibilityInfoProps {
  compatibility: CompatibilityInfo;
  vehicleName: string;
}

/**
 * Section compatibilité détaillée
 */
export function PiecesCompatibilityInfo({ compatibility, vehicleName }: PiecesCompatibilityInfoProps) {
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-indigo-200">
        <h2 className="text-2xl font-bold text-indigo-900 flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Informations de compatibilité
        </h2>
        <p className="text-sm text-indigo-700 mt-1">
          Pour {vehicleName}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Années de production */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Période de production
            </h3>
            <p className="text-gray-700 text-base">
              {compatibility.years}
            </p>
          </div>
        </div>

        {/* Motorisations compatibles */}
        {compatibility.engines.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Motorisations compatibles
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {compatibility.engines.map((engine, index) => (
                <div 
                  key={index}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {engine}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes importantes */}
        {compatibility.notes.length > 0 && (
<Alert className="rounded-lg p-5" variant="warning">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-yellow-900 mb-2">
                  Notes importantes
                </h4>
                <ul className="space-y-1">
                  {compatibility.notes.map((note, index) => (
                    <li key={index} className="text-sm text-yellow-800 flex items-start gap-2">
                      <span className="text-yellow-600 mt-1">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Alert>
        )}

        {/* CTA Vérification */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-semibold text-lg mb-1">
                Pas sûr de la compatibilité ?
              </h4>
              <p className="text-blue-100 text-sm">
                Notre équipe vérifie gratuitement la compatibilité avec votre véhicule
              </p>
            </div>
            <button className="flex-shrink-0 bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors shadow-lg">
              Vérifier
            </button>
          </div>
        </div>

        {/* Info technique */}
        <div className="border-t pt-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            ℹ️ Les informations de compatibilité sont fournies à titre indicatif. Nous vous recommandons 
            de vérifier la référence d'origine de votre pièce avant commande. En cas de doute, 
            contactez notre service client avec votre numéro de châssis (VIN).
          </p>
        </div>
      </div>
    </div>
  );
}
