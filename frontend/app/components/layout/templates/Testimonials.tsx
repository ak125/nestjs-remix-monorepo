/**
 * 💬 TESTIMONIALS TEMPLATE
 * 
 * Template pour afficher des témoignages clients
 */

import React from 'react';

interface TestimonialsProps {
  title?: string;
  testimonials: Array<{
    text: string;
    author: string;
    role?: string;
    avatar?: string;
  }>;
  sectionId: string;
  sectionName: string;
}

export const Testimonials: React.FC<TestimonialsProps> = ({
  title,
  testimonials = [],
}) => {
  return (
    <div className="testimonials">
      <div className="container mx-auto px-4 py-16">
        {/* Titre de la section */}
        {title && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">
              {title}
            </h2>
          </div>
        )}

        {/* Grille des témoignages */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="testimonial-item">
              <div className="bg-white rounded-lg shadow-lg p-6 h-full flex flex-col">
                {/* Citation */}
                <blockquote className="flex-1 mb-4">
                  <p className="text-gray-600 italic leading-relaxed">
                    "{testimonial.text}"
                  </p>
                </blockquote>

                {/* Auteur */}
                <div className="flex items-center">
                  {/* Avatar */}
                  {testimonial.avatar ? (
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.author}
                      className="w-12 h-12 rounded-full mr-4 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 rounded-full mr-4 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">
                        {testimonial.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Informations auteur */}
                  <div>
                    <div className="font-semibold text-gray-900">
                      {testimonial.author}
                    </div>
                    {testimonial.role && (
                      <div className="text-sm text-gray-500">
                        {testimonial.role}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message si pas de témoignages */}
        {testimonials.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Aucun témoignage à afficher.</p>
          </div>
        )}
      </div>
    </div>
  );
};
