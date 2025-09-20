/**
 * 🖼️ GALLERY TEMPLATE
 * 
 * Template pour galerie d'images responsive
 */

import React from 'react';

interface GalleryProps {
  title?: string;
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  columns?: number;
  sectionId: string;
  sectionName: string;
}

export const Gallery: React.FC<GalleryProps> = ({
  title,
  images = [],
  columns = 3,
}) => {
  const getGridCols = () => {
    switch (columns) {
      case 2:
        return 'grid-cols-1 md:grid-cols-2';
      case 4:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
      case 5:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
      default:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  };

  return (
    <div className="gallery">
      <div className="container mx-auto px-4 py-16">
        {/* Titre de la galerie */}
        {title && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">
              {title}
            </h2>
          </div>
        )}

        {/* Grille d'images */}
        <div className={`grid gap-6 ${getGridCols()}`}>
          {images.map((image, index) => (
            <div key={index} className="gallery-item group">
              <div className="relative overflow-hidden rounded-lg shadow-lg">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Overlay avec caption */}
                {image.caption && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-end">
                    <p className="text-white p-4 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      {image.caption}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Message si pas d'images */}
        {images.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>Aucune image à afficher dans cette galerie.</p>
          </div>
        )}
      </div>
    </div>
  );
};
