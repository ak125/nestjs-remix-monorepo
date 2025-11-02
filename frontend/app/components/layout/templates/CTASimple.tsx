/**
 * 📢 CTA SIMPLE TEMPLATE
 * 
 * Template pour call-to-action simple et efficace
 */

import React from 'react';

interface CTASimpleProps {
  title: string;
  subtitle?: string;
  action: {
    text: string;
    href: string;
  };
  sectionId: string;
  sectionName: string;
}

export const CTASimple: React.FC<CTASimpleProps> = ({
  title,
  subtitle,
  action,
}) => {
  return (
    <div className="cta-simple">
      <div className="container mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl text-white text-center py-16 px-8">
          {/* Titre */}
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {title}
          </h2>

          {/* Sous-titre */}
          {subtitle && (
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}

          {/* Call to Action */}
          <div className="cta-actions">
            <a
              href={action.href}
              className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-info/20 transition-colors shadow-lg"
            >
              {action.text}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
