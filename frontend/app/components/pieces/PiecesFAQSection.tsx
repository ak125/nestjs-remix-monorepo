/**
 * ❓ Section FAQ pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 * 
 * Questions fréquentes avec schema.org
 */

import React, { useState } from 'react';
import { type FAQItem } from '../../types/pieces-route.types';

interface PiecesFAQSectionProps {
  items: FAQItem[];
}

/**
 * Section FAQ interactive avec accordéon
 */
export function PiecesFAQSection({ items }: PiecesFAQSectionProps) {
  // Use array instead of Set to avoid React hydration issues
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 px-6 py-4 border-b border-green-200">
        <h2 className="text-2xl font-bold text-green-900 flex items-center gap-3">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Questions fréquentes
        </h2>
        <p className="text-sm text-green-700 mt-1">
          {items.length} question{items.length > 1 ? 's' : ''} • Cliquez pour voir les réponses
        </p>
      </div>

      {/* Liste FAQ */}
      <div className="divide-y divide-gray-200">
        {items.map((item, index) => {
          const isOpen = openItems.includes(item.id);
          
          return (
            <div 
              key={item.id}
              className={`transition-colors ${isOpen ? 'bg-success/10' : 'hover:bg-muted'}`}
            >
              <button
                onClick={() => toggleItem(item.id)}
                className="w-full px-6 py-4 flex items-start justify-between gap-4 text-left"
              >
                <div className="flex-1 flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-success/15 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className={`font-semibold text-base leading-tight ${
                      isOpen ? 'text-green-900' : 'text-gray-900'
                    }`}>
                      {item.question}
                    </h3>
                  </div>
                </div>
                <div className={`flex-shrink-0 w-6 h-6 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}>
                  <svg className={`w-6 h-6 ${isOpen ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isOpen && (
                <div className="px-6 pb-4 pl-17">
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                    <p className="text-gray-700 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Schema.org JSON-LD (si activé) */}
      {items.some(item => item.schema) && (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": items
                .filter(item => item.schema)
                .map(item => ({
                  "@type": "Question",
                  "name": item.question,
                  "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.answer
                  }
                }))
            })
          }}
        />
      )}
    </div>
  );
}
