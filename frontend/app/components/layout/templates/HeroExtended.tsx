/**
 * 🦸 HERO EXTENDED TEMPLATE
 * 
 * Template pour section hero complète avec image et fonctionnalités
 */

import React from 'react';

interface HeroExtendedProps {
  title: string;
  subtitle?: string;
  action?: {
    text: string;
    href: string;
  };
  image?: string;
  features?: string[];
  sectionId: string;
  sectionName: string;
}

export const HeroExtended: React.FC<HeroExtendedProps> = ({
  title,
  subtitle,
  action,
  image,
  features = [],
}) => {
  return (
    <div className="hero-extended">
      <div className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Contenu principal */}
          <div className="hero-content">
            <h1 className="text-5xl lg:text-6xl font-bold mb-6">
              {title}
            </h1>

            {subtitle && (
              <p className="text-xl mb-8 text-gray-600">
                {subtitle}
              </p>
            )}

            {/* Liste des fonctionnalités */}
            {features.length > 0 && (
              <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <svg
                      className="w-5 h-5 text-green-500 mr-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            )}

            {/* Call to Action */}
            {action && (
              <div className="hero-actions">
                <a
                  href={action.href}
                  className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-lg text-lg font-semibold transition-colors shadow-lg"
                >
                  {action.text}
                </a>
              </div>
            )}
          </div>

          {/* Image */}
          {image && (
            <div className="hero-image">
              <img
                src={image}
                alt={title}
                className="w-full h-auto rounded-lg shadow-xl"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
