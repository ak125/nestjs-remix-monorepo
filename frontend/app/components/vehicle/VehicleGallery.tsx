import { useState } from "react";
import  { type VehicleData } from "~/types/vehicle.types";

interface VehicleGalleryProps {
  vehicle: VehicleData;
  images?: string[];
}

export function VehicleGallery({ vehicle, images = [] }: VehicleGalleryProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  
  // Images par défaut si aucune fournie
  const defaultImages = vehicle.imageUrl ? [vehicle.imageUrl] : [];
  const allImages = images.length > 0 ? images : defaultImages;
  
  // Placeholder si aucune image
  if (allImages.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Galerie</h2>
        <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              Aucune image disponible pour ce véhicule
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Galerie - {vehicle.brand} {vehicle.model}
      </h2>
      
      {/* Image principale */}
      <div className="mb-4">
        <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={allImages[selectedImage]}
            alt={`${vehicle.brand} ${vehicle.model} vue ${selectedImage + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {/* Miniatures */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {allImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedImage(index)}
              className={`
                aspect-square rounded-md overflow-hidden border-2 transition-all
                ${selectedImage === index 
                  ? 'border-blue-500 ring-2 ring-blue-200' 
                  : 'border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <img
                src={image}
                alt={`${vehicle.brand} ${vehicle.model} - Miniature ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Informations sur l'image */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        {allImages.length > 1 ? (
          <>Image {selectedImage + 1} sur {allImages.length}</>
        ) : (
          <>1 image disponible</>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-center space-x-3">
        <button
          type="button"
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Télécharger
        </button>
        
        <button
          type="button"
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Partager
        </button>
      </div>
    </div>
  );
}