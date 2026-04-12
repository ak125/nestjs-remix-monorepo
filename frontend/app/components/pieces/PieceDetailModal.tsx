/**
 * Modal Detail Piece - Radix Dialog
 *
 * Modal qui s'ouvre au clic sur une piece pour afficher les details
 * Sans changer de page (comme PHP legacy)
 *
 * Utilise Radix Dialog pour :
 * - Portal automatique (pas de createPortal custom)
 * - Focus trap
 * - Scroll lock
 * - Fermeture Escape
 * - Accessibilite (aria-modal, role=dialog)
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ShoppingCart, ClipboardList, Shield, X } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { logger } from "~/utils/logger";
import { useCart } from "../../hooks/useCart";
import { trackViewItem, trackAddToCart } from "../../utils/analytics";
import { getOptimizedRackImageUrl } from "../../utils/image-optimizer";
import { StarRating } from "../common/StarRating";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { BrandLogo } from "../ui/BrandLogo";

// Helper pour les images rack via imgproxy
const getRackImageUrl = (path: string, width: number = 400) => {
  // path format: "260/6216001.JPG" -> folder/filename
  const parts = path.split("/");
  if (parts.length >= 2) {
    const folder = parts.slice(0, -1).join("/");
    const filename = parts[parts.length - 1];
    return getOptimizedRackImageUrl(folder, filename, width);
  }
  return getOptimizedRackImageUrl("", path, width);
};

interface PieceDetailModalProps {
  pieceId: number | null;
  onClose: () => void;
  vehicleMarque?: string;
  typeId?: number;
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
    level?: number;
  }>;
  referencesOem?: Record<string, string[]>;
  vehiclesCompatibles?: Array<{
    marque: string;
    modele: string;
    type: string;
  }>;
}

export const PieceDetailModal = memo(function PieceDetailModal({
  pieceId,
  onClose,
  vehicleMarque,
  typeId,
}: PieceDetailModalProps) {
  const [piece, setPiece] = useState<PieceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();
  const [addingToCart, setAddingToCart] = useState(false);

  // Charger les details de la piece
  useEffect(() => {
    if (!pieceId) return;

    const fetchPieceDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/catalog/pieces/${pieceId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`);
        }

        const data = await response.json();

        // La reponse backend a la structure { success: true, data: {...} }
        const pieceData = data.data || data.piece || data;

        if (!pieceData || !pieceData.id) {
          throw new Error("Donnees de piece manquantes ou invalides");
        }

        setPiece(pieceData);

        // GA4: Tracker la vue du produit
        trackViewItem({
          id: String(pieceData.id),
          name: pieceData.nom,
          price: pieceData.prix_ttc,
          brand: pieceData.marque,
        });
        setSelectedImage(pieceData.image || "");
      } catch (err) {
        logger.error("Erreur chargement piece:", err);
        setError("Impossible de charger les details de la piece");
      } finally {
        setLoading(false);
      }
    };

    fetchPieceDetail();
  }, [pieceId]);

  const isOpen = !!pieceId;

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  const handleAddToCart = async () => {
    if (!piece) return;

    trackAddToCart(
      {
        id: String(piece.id),
        name: piece.nom,
        price: piece.prix_ttc,
        brand: piece.marque,
      },
      1,
    );

    setAddingToCart(true);
    try {
      await addToCart(piece.id, 1, typeId);
    } catch (error) {
      logger.error("Erreur ajout panier:", error);
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
          aria-describedby={undefined}
        >
          {/* Clic sur la zone vide ferme le modal */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Modal content */}
          <div className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
            {/* Titre accessible (sr-only) */}
            <DialogPrimitive.Title className="sr-only">
              {piece
                ? `${piece.nom} - ${piece.marque} ${piece.reference}`
                : "Detail piece"}
            </DialogPrimitive.Title>

            {/* Header avec bouton fermer */}
            <div className="absolute top-4 right-4 z-20">
              <DialogPrimitive.Close
                className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg hover:bg-gray-100 transition-colors flex items-center justify-center group"
                aria-label="Fermer"
              >
                <X className="w-6 h-6 text-gray-600 group-hover:text-gray-900" />
              </DialogPrimitive.Close>
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
                  <button
                    onClick={onClose}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Fermer
                  </button>
                </div>
              ) : piece ? (
                <div className="p-8">
                  {/* Header avec logo, marque et titre - Pleine largeur */}
                  <div className="flex items-start gap-4 mb-6">
                    <BrandLogo
                      logoPath={piece.marque_logo || null}
                      brandName={piece.marque}
                      type="equipementier"
                      size={64}
                    />
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {piece.nom}
                      </h2>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-gray-600 uppercase">
                          {piece.marque}
                        </span>
                        <span className="text-base font-mono font-bold text-blue-700">
                          {piece.reference}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges qualite */}
                  <div className="flex items-center gap-3 mb-6">
                    {piece.qualite === "OES" && (
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-sm">
                        Qualite OES
                      </span>
                    )}
                    {piece.nb_stars && piece.nb_stars > 0 && (
                      <StarRating
                        rating={piece.nb_stars}
                        size="md"
                        showNumber={false}
                      />
                    )}
                  </div>

                  {/* Layout 2 colonnes: Images + Donnees techniques */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                    {/* Colonne gauche - Images */}
                    <div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 mb-4">
                        <div className="aspect-square overflow-hidden rounded-lg">
                          <img
                            src={
                              selectedImage
                                ? getRackImageUrl(selectedImage)
                                : piece.image
                                  ? getRackImageUrl(piece.image)
                                  : "/images/no.png"
                            }
                            alt={piece.nom}
                            width={400}
                            height={400}
                            className="w-full h-full object-contain hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      </div>

                      {piece.images && piece.images.length > 0 && (
                        <div className="grid grid-cols-5 gap-2">
                          {piece.images.map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedImage(img)}
                              className={`aspect-square bg-white rounded-lg p-2 border-2 transition-all hover:scale-105 ${
                                selectedImage === img
                                  ? "border-blue-500 shadow-md"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <img
                                src={getRackImageUrl(img)}
                                alt={`Vue ${idx + 1}`}
                                width={64}
                                height={64}
                                className="w-full h-full object-contain"
                                loading="lazy"
                                decoding="async"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Colonne droite - Donnees techniques */}
                    {/* Mobile: Accordion collapsible */}
                    <div className="md:hidden">
                      <Accordion
                        type="single"
                        collapsible
                        className="bg-gray-50 rounded-xl"
                      >
                        <AccordionItem value="specs" className="border-none">
                          <AccordionTrigger className="px-5 py-4 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="w-5 h-5 text-blue-600" />
                              <span className="text-lg font-bold text-gray-900">
                                Donnees techniques
                                {piece.criteresTechniques &&
                                  piece.criteresTechniques.length > 0 && (
                                    <span className="ml-2 text-sm font-normal text-gray-500">
                                      ({piece.criteresTechniques.length})
                                    </span>
                                  )}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-5 pb-5">
                            {piece.criteresTechniques &&
                            piece.criteresTechniques.length > 0 ? (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {piece.criteresTechniques
                                  .sort(
                                    (a, b) => (a.level || 5) - (b.level || 5),
                                  )
                                  .map((critere) => (
                                    <div
                                      key={critere.id}
                                      className="bg-white rounded-lg px-4 py-3 border border-gray-200"
                                    >
                                      <div className="flex justify-between items-start gap-3">
                                        <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                                          {critere.name}
                                        </span>
                                        <span className="text-sm text-gray-900 font-medium text-right">
                                          {critere.value} {critere.unit}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm">
                                Aucune donnee technique disponible
                              </p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

                    {/* Desktop: Always visible */}
                    <div className="hidden md:block bg-gray-50 rounded-xl p-5">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        Donnees techniques
                      </h3>

                      {piece.criteresTechniques &&
                      piece.criteresTechniques.length > 0 ? (
                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                          {piece.criteresTechniques
                            .sort((a, b) => (a.level || 5) - (b.level || 5))
                            .map((critere) => (
                              <div
                                key={critere.id}
                                className="bg-white rounded-lg px-4 py-3 hover:shadow-md transition-shadow border border-gray-200"
                              >
                                <div className="flex justify-between items-start gap-3">
                                  <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                                    {critere.name}
                                  </span>
                                  <span className="text-sm text-gray-900 font-medium text-right">
                                    {critere.value} {critere.unit}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">
                          Aucune donnee technique disponible
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Prix, disponibilite et bouton panier */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
                      <div className="text-sm text-gray-600 mb-2">Prix TTC</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-blue-600">
                          {piece.prix_ttc.toFixed(2)}
                        </span>
                        <span className="text-2xl font-bold text-gray-500">
                          €
                        </span>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 flex items-center justify-center">
                      {piece.dispo ? (
                        <div className="flex items-center gap-2 text-green-600 font-medium text-base">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <span>En stock - Livraison rapide</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-orange-600 font-medium text-base">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span>Sur commande - Delai 2-5 jours</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleAddToCart}
                      disabled={addingToCart}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      {addingToCart ? (
                        <>
                          <svg
                            className="w-5 h-5 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span className="hidden sm:inline">Ajout...</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5" />
                          <span className="hidden sm:inline">
                            Ajouter au panier
                          </span>
                          <span className="sm:hidden">Panier</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* References OEM constructeurs */}
                  {piece.referencesOem &&
                    Object.keys(piece.referencesOem).length > 0 &&
                    (() => {
                      const filteredOemEntries = Object.entries(
                        piece.referencesOem,
                      ).filter(
                        ([marque]) =>
                          !vehicleMarque ||
                          marque.toUpperCase() === vehicleMarque.toUpperCase(),
                      );

                      if (filteredOemEntries.length === 0) return null;

                      const totalRefs = filteredOemEntries.reduce(
                        (acc, [, refs]) => acc + refs.length,
                        0,
                      );

                      return (
                        <>
                          {/* Mobile: Accordion */}
                          <div className="md:hidden mb-6">
                            <Accordion
                              type="single"
                              collapsible
                              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200"
                            >
                              <AccordionItem
                                value="oem"
                                className="border-none"
                              >
                                <AccordionTrigger className="px-5 py-4 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-green-600" />
                                    <span className="text-lg font-bold text-gray-900">
                                      Ref. OEM{" "}
                                      {vehicleMarque || "Constructeurs"}
                                      <span className="ml-2 text-sm font-normal text-gray-500">
                                        ({totalRefs})
                                      </span>
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 pb-5">
                                  <div className="space-y-3">
                                    {filteredOemEntries.map(
                                      ([marque, refs]) => (
                                        <div
                                          key={marque}
                                          className="bg-white rounded-lg p-3 border border-green-100"
                                        >
                                          <div className="font-bold text-gray-900 mb-2 uppercase text-sm">
                                            {marque}
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {refs.map((ref, idx) => (
                                              <span
                                                key={idx}
                                                className="inline-block bg-green-100 text-green-800 text-xs font-mono font-semibold px-2.5 py-1 rounded"
                                              >
                                                {ref}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>

                          {/* Desktop: Always visible */}
                          <div className="hidden md:block bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 mb-6 border border-green-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                              <Shield className="w-5 h-5 text-green-600" />
                              Ref. OEM {vehicleMarque || "Constructeurs"}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {filteredOemEntries.map(([marque, refs]) => (
                                <div
                                  key={marque}
                                  className="bg-white rounded-lg p-3 border border-green-100"
                                >
                                  <div className="font-bold text-gray-900 mb-2 uppercase text-sm">
                                    {marque}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {refs.map((ref, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-block bg-green-100 text-green-800 text-xs font-mono font-semibold px-2.5 py-1 rounded"
                                      >
                                        {ref}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                </div>
              ) : null}
            </div>

            {/* Mobile Sticky CTA with Price */}
            {piece && (
              <div className="md:hidden sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center gap-3 touch-target-lg"
                >
                  {addingToCart ? (
                    <>
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Ajout...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Ajouter au panier</span>
                      <span className="font-bold">
                        · {piece.prix_ttc.toFixed(2)}€
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});
