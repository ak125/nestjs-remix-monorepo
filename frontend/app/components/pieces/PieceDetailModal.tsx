/**
 * 🔍 Modal Détail Pièce
 * 
 * Modal qui s'ouvre au clic sur une pièce pour afficher les détails
 * Sans changer de page (comme PHP legacy)
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { StarRating } from '../common/StarRating';
import { useCart } from '../../hooks/useCart';

interface PieceDetailModalProps {
  pieceId: number | null;
  onClose: () => void;
}

interface PieceDetail {
  id: number;
  nom: string;
  marque: string;
  reference: string;
  prix_ttc: number;
  image: string;
  images?: string[];
  dispo: boolean;
  qualite?: string;
  nb_stars?: number;
  description?: string;
  marque_logo?: string;
  weight?: number;
  hasOem?: boolean;
  criteresTechniques?: Array<{
    id: number;
    name: string;
    value: string;
    unit: string;
  }>;
  vehiclesCompatibles?: Array<{
    marque: string;
    modele: string;
    type: string;
  }>;
}

export function PieceDetailModal({ pieceId, onClose }: PieceDetailModalProps) {
  const [piece, setPiece] = useState<PieceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();
  const [addingToCart, setAddingToCart] = useState(false);

  // Debug
  console.log('🔍 PieceDetailModal render:', { pieceId, isOpen: !!pieceId });

  // Charger les détails de la pièce
  useEffect(() => {
    if (!pieceId) return;

    console.log('📡 Chargement pièce:', pieceId);

    const fetchPieceDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Utiliser window.location pour construire l'URL backend
        const backendUrl = typeof window !== 'undefined' 
          ? `${window.location.protocol}//${window.location.host}`
          : '';
        const response = await fetch(`${backendUrl}/api/catalog/pieces/${pieceId}`, {
          credentials: 'include',
        });

        console.log('📥 Response status:', response.status);

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Data reçue complète:', JSON.stringify(data, null, 2));
        
        // La réponse backend a la structure { success: true, data: {...} }
        const pieceData = data.data || data.piece || data;
        console.log('🔍 pieceData extraite:', pieceData);
        
        if (!pieceData || !pieceData.id) {
          console.error('❌ Données invalides:', pieceData);
          throw new Error('Données de pièce manquantes ou invalides');
        }
        
        console.log('✅ Pièce valide:', {
          id: pieceData.id,
          nom: pieceData.nom,
          marque: pieceData.marque,
          prix: pieceData.prix_ttc
        });
        
        setPiece(pieceData);
        setSelectedImage(pieceData.image || '');
      } catch (err) {
        console.error('❌ Erreur chargement pièce:', err);
        setError('Impossible de charger les détails de la pièce');
      } finally {
        setLoading(false);
      }
    };

    fetchPieceDetail();
  }, [pieceId]);

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Bloquer le scroll body
  useEffect(() => {
    if (pieceId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [pieceId]);

  if (!pieceId) return null;

  console.log('🎨 Rendering modal with pieceId:', pieceId);

  const allImages = piece ? [piece.image, ...(piece.images || [])].filter(Boolean) : [];

  const handleAddToCart = async () => {
    if (!piece) return;
    
    setAddingToCart(true);
    try {
      await addToCart(piece.id, 1);
      // Modal reste ouvert, le panier side s'ouvre automatiquement via useCart
    } catch (error) {
      console.error('❌ Erreur ajout panier:', error);
    } finally {
      setAddingToCart(false);
    }
  };

  // Utiliser un portal pour rendre au niveau body
  if (typeof document === 'undefined' || !pieceId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Overlay backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header avec bouton fermer */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg hover:bg-gray-100 transition-colors flex items-center justify-center group"
            aria-label="Fermer"
          >
            <svg className="w-6 h-6 text-gray-600 group-hover:text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto max-h-[90vh] custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button onClick={onClose} className="text-blue-600 hover:text-blue-700 font-medium">
                Fermer
              </button>
            </div>
          ) : piece ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
              {/* Colonne gauche - Images */}
              <div>
                {/* Image principale */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 mb-4">
                  <div className="aspect-square overflow-hidden rounded-lg">
                    <img
                      src={selectedImage || '/images/no.png'}
                      alt={piece.nom}
                      className="w-full h-full object-contain hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                </div>

                {/* Galerie miniatures */}
                {allImages.length > 1 && (
                  <div className="grid grid-cols-5 gap-2">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(img)}
                        className={`aspect-square bg-white rounded-lg p-2 border-2 transition-all hover:scale-105 ${
                          selectedImage === img
                            ? 'border-blue-500 shadow-md'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`Vue ${idx + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Colonne droite - Informations */}
              <div className="flex flex-col">
                {/* Header avec logo et marque */}
                <div className="flex items-start gap-4 mb-6">
                  {piece.marque_logo && (
                    <div className="w-16 h-16 flex-shrink-0">
                      <img
                        src={`https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/equipementiers-automobiles/${piece.marque_logo}`}
                        alt={`Logo ${piece.marque}`}
                        className="w-full h-full object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{piece.nom}</h2>
                    <div className="flex items-baseline gap-2 text-lg">
                      <span className="font-black text-gray-900 uppercase">{piece.marque}</span>
                      <span className="font-bold text-blue-700 font-mono">{piece.reference}</span>
                    </div>
                  </div>
                </div>

                {/* Badges qualité */}
                <div className="flex items-center gap-3 mb-6">
                  {piece.qualite === 'OES' && (
                    <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
                      🏆 Qualité OES
                    </span>
                  )}
                  {piece.nb_stars && piece.nb_stars > 0 && (
                    <StarRating rating={piece.nb_stars} size="md" showNumber={false} />
                  )}
                </div>

                {/* Prix */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
                  <div className="text-sm text-gray-600 mb-2">Prix TTC</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-blue-600">
                      {piece.prix_ttc.toFixed(2)}
                    </span>
                    <span className="text-2xl font-bold text-gray-500">€</span>
                  </div>
                </div>

                {/* Disponibilité */}
                <div className="mb-6">
                  {piece.dispo ? (
                    <div className="flex items-center gap-2 text-green-600 font-medium text-lg">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      En stock - Livraison rapide
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-orange-600 font-medium text-lg">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      Sur commande - Délai 2-5 jours
                    </div>
                  )}
                </div>

                {/* Bouton ajouter panier */}
                <button 
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 mb-6"
                >
                  {addingToCart ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Ajout en cours...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Ajouter au panier
                    </>
                  )}
                </button>

                {/* Données techniques */}
                <div className="bg-gray-50 rounded-xl p-5 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Données techniques
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Référence</div>
                      <div className="font-mono font-bold text-gray-900">{piece.reference}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Marque</div>
                      <div className="font-bold text-gray-900">{piece.marque}</div>
                    </div>
                    {piece.weight && (
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Poids</div>
                        <div className="font-bold text-gray-900">{piece.weight} kg</div>
                      </div>
                    )}
                    <div className="bg-white rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Qualité</div>
                      <div className="font-bold text-gray-900">
                        {piece.qualite === 'OES' ? (
                          <span className="text-orange-600">OES ⭐</span>
                        ) : (
                          piece.qualite || 'Standard'
                        )}
                      </div>
                    </div>
                    {piece.hasOem && (
                      <div className="bg-white rounded-lg p-3 col-span-2">
                        <div className="text-xs text-gray-500 mb-1">Compatible OEM</div>
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium text-green-700">Pièce d'origine équipementier</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Critères techniques supplémentaires */}
                  {piece.criteresTechniques && piece.criteresTechniques.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm font-semibold text-gray-700 mb-3">Spécifications techniques</div>
                      <div className="grid grid-cols-2 gap-2">
                        {piece.criteresTechniques.map((critere) => (
                          <div key={critere.id} className="bg-white rounded-lg p-2.5">
                            <div className="text-xs text-gray-500 mb-0.5">{critere.name}</div>
                            <div className="text-sm font-semibold text-gray-900">
                              {critere.value} {critere.unit}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {piece.description && (
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Description</h3>
                    <p className="text-gray-700 leading-relaxed text-sm">{piece.description}</p>
                  </div>
                )}

                {/* Véhicules compatibles */}
                {piece.vehiclesCompatibles && piece.vehiclesCompatibles.length > 0 && (
                  <div className="pt-6 border-t border-gray-200 mt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Véhicules compatibles</h3>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {piece.vehiclesCompatibles.slice(0, 10).map((vehicle, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg">
                          <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-700">
                            {vehicle.marque} {vehicle.modele} {vehicle.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
