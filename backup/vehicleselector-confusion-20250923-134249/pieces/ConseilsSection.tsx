import React, { useState } from 'react';

interface ConseilItem {
  id: number;
  title: string;
  content: string;
}

interface ConseilsSectionProps {
  conseils?: {
    title: string;
    content: string;
    items: ConseilItem[];
  };
}

export default function ConseilsSection({ conseils }: ConseilsSectionProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  if (!conseils?.items || conseils.items.length === 0) {
    return null;
  }

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          💡 {conseils.title}
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            {conseils.items.length} conseils
          </span>
        </h2>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {conseils.items.map((conseil) => {
            const isExpanded = expandedItems.has(conseil.id);
            const preview = conseil.content.substring(0, 150);
            const needsExpansion = conseil.content.length > 150;
            
            return (
              <div
                key={conseil.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-green-300 transition-colors"
              >
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-sm font-medium">
                      {conseil.id}
                    </span>
                    {conseil.title}
                  </h3>
                  
                  <div className="text-gray-700 leading-relaxed">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: isExpanded ? conseil.content : preview + (needsExpansion ? '...' : '')
                      }} 
                    />
                    
                    {needsExpansion && (
                      <button
                        onClick={() => toggleExpanded(conseil.id)}
                        className="mt-2 inline-flex items-center text-green-600 hover:text-green-700 font-medium text-sm transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            Voir moins
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            Lire la suite
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}