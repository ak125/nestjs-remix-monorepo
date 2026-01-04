/**
 * 📱 Vue Grid pour Route Pièces
 * Extrait de pieces.$gamme.$marque.$modele.$type[.]html.tsx
 *
 * ⚡ OPTIMISÉ INP v2:
 * - PieceCard mémorisé avec React.memo
 * - Mappings de couleurs pré-calculés (hors composant)
 * - Handlers mémorisés avec useCallback
 * - Set pour lookups O(1) sur selectedPieces
 */

import { Truck } from "lucide-react";
import React, { useState, useMemo, useCallback, memo } from "react";

import { useCart } from "../../hooks/useCart";
import { type PieceData } from "../../types/pieces-route.types";
import { trackAddToCart } from "../../utils/analytics";
import { hasStockAvailable } from "../../utils/stock.utils";
import { BrandLogo } from "../ui/BrandLogo";
import { PieceDetailModal } from "./PieceDetailModal";
import { ProductGallery } from "./ProductGallery";

// ⚡ Mappings de couleurs pré-calculés (hors du render loop)
const RELIABILITY_COLORS = [
  { min: 10, gradient: "from-cyan-400 via-teal-500 to-emerald-500", text: "text-teal-600" },
  { min: 8, gradient: "from-emerald-400 via-green-500 to-lime-500", text: "text-emerald-600" },
  { min: 7, gradient: "from-blue-400 via-sky-500 to-cyan-500", text: "text-blue-600" },
  { min: 5, gradient: "from-yellow-400 via-amber-500 to-orange-400", text: "text-amber-600" },
  { min: 3, gradient: "from-orange-400 via-rose-500 to-red-400", text: "text-rose-600" },
  { min: 0, gradient: "from-slate-400 via-gray-500 to-zinc-500", text: "text-slate-500" },
] as const;

// ⚡ Helper fonction pré-calculée
function getReliabilityColors(score: number) {
  for (const color of RELIABILITY_COLORS) {
    if (score >= color.min) return color;
  }
  return RELIABILITY_COLORS[RELIABILITY_COLORS.length - 1];
}

// ⚡ Helper pour formater le prix (évite recalcul dans le render)
function formatPrice(price: number | undefined, priceFormatted: string | undefined) {
  if (typeof price === "number") {
    return {
      whole: Math.floor(price).toString(),
      cents: (price % 1).toFixed(2).substring(2),
    };
  }
  const parts = priceFormatted?.split(",") || ["0", "00"];
  return {
    whole: parts[0] || "0",
    cents: parts[1]?.replace("€", "") || "00",
  };
}

interface PiecesGridViewProps {
  pieces: PieceData[];
  onSelectPiece?: (pieceId: number) => void;
  selectedPieces?: number[];
  vehicleMarque?: string;
}

// ⚡ Composant PieceCard mémorisé
interface PieceCardProps {
  piece: PieceData;
  isSelected: boolean;
  isLoading: boolean;
  onSelect?: (id: number) => void;
  onAddToCart: (id: number) => void;
  onOpenDetail: (id: number) => void;
}

const PieceCard = memo(function PieceCard({
  piece,
  isSelected,
  isLoading,
  onSelect,
  onAddToCart,
  onOpenDetail,
}: PieceCardProps) {
  const hasStock = hasStockAvailable(piece.stock);

  // ⚡ Pré-calculer valeurs une seule fois par piece
  const { whole: priceWhole, cents: priceCents } = useMemo(
    () => formatPrice(piece.price, piece.priceFormatted),
    [piece.price, piece.priceFormatted]
  );

  const { reliability, colors } = useMemo(() => {
    const stars = piece.stars || 3;
    const rel = Math.round((stars / 6) * 10);
    return { reliability: rel, colors: getReliabilityColors(rel) };
  }, [piece.stars]);

  // ⚡ Handlers mémorisés
  const handleClick = useCallback(() => onOpenDetail(piece.id), [piece.id, onOpenDetail]);
  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.(piece.id);
    },
    [piece.id, onSelect]
  );
  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasStock) onAddToCart(piece.id);
    },
    [piece.id, hasStock, onAddToCart]
  );

  // ⚡ Images filtrées mémorisées
  const galleryImages = useMemo(
    () =>
      piece.images
        ?.filter((url): url is string => typeof url === "string" && url.trim() !== "")
        .map((url, idx) => ({
          id: `${piece.id}-${idx}`,
          url,
          sort: idx,
          alt: `${piece.name} ${piece.brand} - Image ${idx + 1}`,
        })),
    [piece.images, piece.id, piece.name, piece.brand]
  );

  return (
    <div
      className={`group relative bg-white rounded-xl transition-all duration-300 cursor-pointer flex flex-col ${
        isSelected
          ? "ring-2 ring-indigo-500 shadow-xl shadow-indigo-500/20"
          : "shadow-sm hover:shadow-lg hover:-translate-y-0.5"
      }`}
      onClick={handleClick}
    >
      {/* Header: Logo + Barre Fiabilité */}
      <div className="flex items-center justify-between gap-2 p-2.5 pb-1">
        <BrandLogo
          logoPath={piece.marque_logo || null}
          brandName={piece.brand}
          type="equipementier"
          size="xl"
          className="drop-shadow-md"
        />

        <div className="flex-1 flex items-center justify-end gap-1.5">
          <div className="w-full max-w-[60px] h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full transition-all duration-500`}
              style={{ width: `${reliability * 10}%` }}
            />
          </div>
          <span className={`text-xs font-black ${colors.text} min-w-[16px]`}>
            {reliability}
          </span>
        </div>
      </div>

      {/* Image Zone */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 flex-1">
        <div className="absolute inset-2 flex items-center justify-center">
          <div className="relative w-full h-full">
            <ProductGallery
              images={galleryImages}
              mainImage={piece.image}
              alt={`${piece.name} ${piece.brand}${piece.reference ? ` - Réf ${piece.reference}` : ""}`}
            />
          </div>
        </div>

        {/* Overlay gradient au hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Indicateur photos */}
        {piece.images && piece.images.length > 1 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur-sm text-slate-700 text-xs font-bold px-2 py-1 rounded-md shadow-md border border-slate-200 z-10">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{piece.images.length}</span>
          </div>
        )}

        {/* Badge disponibilité */}
        {hasStock ? (
          <span className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-white text-xs font-semibold rounded shadow-md z-10">
            En stock
          </span>
        ) : (
          <span className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-semibold rounded shadow-md z-10">
            Rupture
          </span>
        )}

        {/* Checkbox sélection */}
        {onSelect && (
          <button
            type="button"
            aria-label={isSelected ? `Désélectionner ${piece.name}` : `Sélectionner ${piece.name}`}
            onClick={handleSelect}
            className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-300 z-20 ${
              isSelected
                ? "bg-indigo-600 shadow-lg shadow-indigo-500/50 scale-110"
                : "bg-white/90 backdrop-blur-sm border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50"
            }`}
          >
            {isSelected ? (
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <div className="w-2.5 h-2.5 rounded border-2 border-slate-300" />
            )}
          </button>
        )}
      </div>

      {/* Footer: Marque + Référence + Prix + Bouton */}
      <div className="p-2.5 pt-2 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50/50">
        <div className="flex items-center gap-1.5 mb-2 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wide flex-shrink-0">
            {piece.brand}
          </span>
          <span className="text-slate-300 flex-shrink-0">|</span>
          <code className="text-sm sm:text-base font-mono font-bold text-indigo-700 truncate">
            {piece.reference}
          </code>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                {priceWhole}
              </span>
              <span className="text-sm sm:text-base font-bold text-slate-400">
                ,{priceCents}€
              </span>
            </div>
            {/* Info livraison */}
            {hasStock && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 mt-0.5">
                <Truck className="w-3 h-3" />
                <span>Livré 24-48h</span>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label={hasStock ? `Ajouter ${piece.name} au panier` : `${piece.name} indisponible`}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 ${
              !isLoading
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30"
                : "bg-indigo-300 text-white cursor-wait"
            }`}
            disabled={isLoading}
            onClick={handleAddToCart}
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : hasStock ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Ajouter</span>
              </>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Barre couleur au hover */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-b-xl" />

      {/* Bordure subtile */}
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-slate-200/80 group-hover:ring-indigo-400/30 transition-all duration-300 pointer-events-none" />
    </div>
  );
});

/**
 * Vue Grid avec cartes pièces
 * ⚡ Optimisé avec React.memo pour éviter re-renders inutiles
 */
export function PiecesGridView({
  pieces,
  onSelectPiece,
  selectedPieces = [],
  vehicleMarque,
}: PiecesGridViewProps) {
  const { addToCart } = useCart();

  // État pour gérer le loading par produit (anti-double-clic)
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());

  // État pour le modal de détail
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);

  // ⚡ Pré-calculer Set pour lookups O(1)
  const selectedSet = useMemo(() => new Set(selectedPieces), [selectedPieces]);

  // ⚡ Handler mémorisé pour ajout panier
  const handleAddToCart = useCallback(
    async (pieceId: number) => {
      if (loadingItems.has(pieceId)) return;

      const piece = pieces.find((p) => p.id === pieceId);
      if (piece) {
        trackAddToCart(
          {
            id: String(piece.id),
            name: piece.name,
            price: piece.price,
            brand: piece.brand,
          },
          1
        );
      }

      setLoadingItems((prev) => new Set(prev).add(pieceId));

      try {
        await addToCart(pieceId, 1);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error("❌ Erreur ajout panier:", error);
      } finally {
        setLoadingItems((prev) => {
          const next = new Set(prev);
          next.delete(pieceId);
          return next;
        });
      }
    },
    [pieces, addToCart, loadingItems]
  );

  // ⚡ Handler mémorisé pour ouvrir détail
  const handleOpenDetail = useCallback((id: number) => {
    setSelectedPieceId(id);
  }, []);

  // ⚡ Handler mémorisé pour fermer modal
  const handleCloseModal = useCallback(() => {
    setSelectedPieceId(null);
  }, []);

  if (pieces.length === 0) {
    return (
      <div className="text-center py-20 bg-gradient-to-br from-background via-muted/50 to-muted rounded-2xl border-2 border-dashed border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE0YzIuMiAwIDQgMS44IDQgNHMtMS44IDQtNCA0LTQtMS44LTQtNGMwLTIuMiAxLjgtNCA0LTR6bTAgNDBjMi4yIDAgNCAxLjggNCA0cy0xLjggNC00IDQtNC0xLjgtNC00YzAtMi4yIDEuOC00IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
        <div className="relative z-10 max-w-md mx-auto px-4">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-6 animate-bounce-slow">
            <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-3">Aucune pièce trouvée</h3>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Essayez de modifier vos filtres ou d'élargir vos critères de recherche pour découvrir plus de résultats.
          </p>
          <div className="inline-flex flex-col gap-2 text-sm text-left bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-foreground">Vérifiez vos filtres de marque et qualité</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-foreground">Essayez une recherche plus large</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-foreground">Réinitialisez tous les filtres</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <PieceDetailModal pieceId={selectedPieceId} vehicleMarque={vehicleMarque} onClose={handleCloseModal} />

        {pieces.map((piece) => (
          <PieceCard
            key={piece.id}
            piece={piece}
            isSelected={selectedSet.has(piece.id)}
            isLoading={loadingItems.has(piece.id)}
            onSelect={onSelectPiece}
            onAddToCart={handleAddToCart}
            onOpenDetail={handleOpenDetail}
          />
        ))}
      </div>
    </>
  );
}
