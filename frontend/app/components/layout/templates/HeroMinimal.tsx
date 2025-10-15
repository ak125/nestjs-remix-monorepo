/**
 * 🦸 HERO MINIMAL TEMPLATE
 * 
 * Template pour section hero simple et efficace
 */

import React from 'react';
import  { type HeroProps, type TemplateBaseProps } from '../../types/layout';

interface HeroMinimalProps extends HeroProps, TemplateBaseProps {}

export const HeroMinimal: React.FC<HeroMinimalProps> = ({
  title,
  subtitle,
  action,
  sectionId,
}) => {
  return (
    <div className="hero-minimal">
      <div className="container mx-auto px-4 py-16 text-center">
        {/* Titre principal */}
        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
          {title}
        </h1>

        {/* Sous-titre */}
        {subtitle && (
          <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-3xl mx-auto">
            {subtitle}
          </p>
        )}

        {/* Call to Action */}
        {action && (
          <div className="hero-actions">
            <a
              href={action.href}
              className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
            >
              {action.text}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
