import { Badge } from '@fafa/ui';
import React from 'react';

interface EquipementierItem {
  pm_id: number;
  pm_name: string;
  pm_logo: string;
  title: string;
  image: string;
  description: string;
}

interface EquipementiersSectionProps {
  equipementiers?: {
    title: string;
    items: EquipementierItem[];
  };
}

export default function EquipementiersSection({ equipementiers }: EquipementiersSectionProps) {
  if (!equipementiers?.items || equipementiers.items.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl shadow-lg mb-8 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 p-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          🏭 {equipementiers.title}
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            {equipementiers.items.length} marques
          </span>
        </h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {equipementiers.items.map((equipementier) => (
            <div
              key={equipementier.pm_id}
              className="border border-gray-200 rounded-lg p-5 hover:border-orange-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <img
                    src={equipementier.pm_logo || equipementier.image}
                    alt={`Logo ${equipementier.pm_name}`}
                    className="w-16 h-16 object-contain rounded-lg border-2 border-gray-100 p-2"
                    onError={(e) => {
                      e.currentTarget.src = '/images/default-brand.jpg';
                    }}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    {equipementier.pm_name}
                    <Badge variant="warning">Équipementier</Badge>
                  </h3>
                  
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {equipementier.description}
                  </p>
                  
                  <div className="mt-3 flex items-center text-xs text-orange-600 font-medium">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Marque de confiance
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}