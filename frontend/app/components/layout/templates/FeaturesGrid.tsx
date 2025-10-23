/**
 * 🌟 FEATURES GRID TEMPLATE
 * 
 * Template pour afficher les fonctionnalités en grille
 */

import React from 'react';

interface FeaturesGridProps {
  title: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  sectionId: string;
  sectionName: string;
}

export const FeaturesGrid: React.FC<FeaturesGridProps> = ({
  title,
  features = [],
}) => {
  return (
    <div className="features-grid">
      <div className="container mx-auto px-4 py-16">
        {/* Titre de la section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {title}
          </h2>
        </div>

        {/* Grille des fonctionnalités */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="feature-item text-center group">
              {/* Icône */}
              <div className="feature-icon mb-4">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
              </div>

              {/* Titre */}
              <h3 className="text-xl font-semibold mb-3">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
