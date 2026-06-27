/**
 * TrustPage - Page confiance e-commerce auto
 * 
 * Composant complet pour renforcer la confiance client avec:
 * - Logos équipementiers reconnus (Bosch, Valeo, etc.)
 * - Badges sécurité (paiement, garantie, retour)
 * - Avis clients avec véhicule affiché
 * 
 * Design System: Primary (CTA), Success (badges verts), Secondary (liens), Neutral (backgrounds)
 * Typographie: font-heading (titres), font-sans (body), font-mono (dates/refs)
 * Espacement: 8px grid (gap-md sections, p-lg cards)
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Équipementier/fournisseur partenaire
 */
export interface PartnerBrand {
  /** Identifiant unique */
  id: string;
  /** Nom de la marque */
  name: string;
  /** URL du logo (PNG/SVG) */
  logoUrl: string;
  /** Description courte (optionnelle) */
  description?: string;
}

/**
 * Badge de sécurité/garantie
 */
export interface SecurityBadge {
  /** Identifiant unique */
  id: string;
  /** Type de badge */
  type: 'payment' | 'warranty' | 'return' | 'delivery' | 'certified';
  /** Titre du badge */
  title: string;
  /** Description détaillée */
  description: string;
  /** Icône (emoji ou React element) */
  icon: string;
  /** Couleur du badge (success, primary, secondary) */
  variant?: 'success' | 'primary' | 'secondary';
}

/**
 * Avis client avec véhicule
 */
export interface CustomerReview {
  /** Identifiant unique */
  id: string;
  /** Nom du client */
  customerName: string;
  /** Photo du client (optionnelle) */
  customerPhoto?: string;
  /** Note sur 5 */
  rating: 1 | 2 | 3 | 4 | 5;
  /** Commentaire */
  comment: string;
  /** Date de l'avis */
  date: string;
  /** Véhicule du client */
  vehicle: {
    brand: string;
    model: string;
    year: number;
    engine?: string;
  };
  /** Avis vérifié (achat confirmé) */
  isVerified?: boolean;
  /** Produit acheté (optionnel) */
  productName?: string;
}

/**
 * Props du composant TrustPage
 */
export interface TrustPageProps {
  /** Liste des marques partenaires */
  partnerBrands?: PartnerBrand[];
  /** Liste des badges sécurité */
  securityBadges?: SecurityBadge[];
  /** Liste des avis clients */
  customerReviews?: CustomerReview[];
  /** Titre de la section partenaires */
  partnersTitle?: string;
  /** Titre de la section sécurité */
  securityTitle?: string;
  /** Titre de la section avis */
  reviewsTitle?: string;
  /** Afficher uniquement certaines sections */
  showSections?: {
    partners?: boolean;
    security?: boolean;
    reviews?: boolean;
  };
  /** Callback quand on clique sur "Voir tous les avis" */
  onViewAllReviews?: () => void;
}

// ============================================================================
// Données par défaut
// ============================================================================

const DEFAULT_PARTNER_BRANDS: PartnerBrand[] = [
  {
    id: 'bosch',
    name: 'Bosch',
    logoUrl: '/images/brands/bosch.png',
    description: 'Leader mondial équipements auto',
  },
  {
    id: 'valeo',
    name: 'Valeo',
    logoUrl: '/images/brands/valeo.png',
    description: 'Expert systèmes automobiles',
  },
  {
    id: 'mann',
    name: 'MANN-FILTER',
    logoUrl: '/images/brands/mann.png',
    description: 'Spécialiste filtration',
  },
  {
    id: 'sachs',
    name: 'Sachs',
    logoUrl: '/images/brands/sachs.png',
    description: 'Expert embrayage et suspension',
  },
  {
    id: 'brembo',
    name: 'Brembo',
    logoUrl: '/images/brands/brembo.png',
    description: 'Référence freinage haute performance',
  },
  {
    id: 'ngk',
    name: 'NGK',
    logoUrl: '/images/brands/ngk.png',
    description: 'N°1 mondial bougies allumage',
  },
];

const DEFAULT_SECURITY_BADGES: SecurityBadge[] = [
  {
    id: 'payment',
    type: 'payment',
    title: 'Paiement 100% sécurisé',
    description: 'Transactions cryptées SSL. Carte bancaire, PayPal, virement.',
    icon: '🔒',
    variant: 'success',
  },
  {
    id: 'warranty',
    type: 'warranty',
    title: 'Garantie 1 an',
    description: 'Toutes nos pièces sont garanties constructeur 1 an.',
    icon: '✓',
    variant: 'success',
  },
  {
    id: 'return',
    type: 'return',
    title: 'Retour sous 30 jours',
    description: 'Satisfait ou remboursé. Retour gratuit sous 30 jours.',
    icon: '↩',
    variant: 'primary',
  },
  {
    id: 'delivery',
    type: 'delivery',
    title: 'Livraison Express',
    description: 'Expédition en 24h. Livraison en 1-2 jours ouvrés.',
    icon: '🚚',
    variant: 'primary',
  },
  {
    id: 'certified',
    type: 'certified',
    title: 'Pièces certifiées',
    description: 'Pièces d\'origine ou équivalentes qualité constructeur.',
    icon: '⭐',
    variant: 'secondary',
  },
];

const DEFAULT_CUSTOMER_REVIEWS: CustomerReview[] = [
  {
    id: 'review-1',
    customerName: 'Marc D.',
    customerPhoto: '/images/avatars/marc.jpg',
    rating: 5,
    comment:
      'Plaquettes de frein Bosch reçues en 24h. Montage facile, freinage nickel. Parfait pour ma 208 !',
    date: '2025-10-15',
    vehicle: {
      brand: 'Peugeot',
      model: '208',
      year: 2016,
      engine: '1.6 HDi',
    },
    isVerified: true,
    productName: 'Plaquettes de frein avant Bosch',
  },
  {
    id: 'review-2',
    customerName: 'Sophie L.',
    customerPhoto: '/images/avatars/sophie.jpg',
    rating: 5,
    comment:
      'Filtre à air MANN parfaitement compatible. Prix imbattable, livraison rapide. Je recommande !',
    date: '2025-10-12',
    vehicle: {
      brand: 'Renault',
      model: 'Clio IV',
      year: 2018,
    },
    isVerified: true,
    productName: 'Filtre à air MANN C 25 114',
  },
  {
    id: 'review-3',
    customerName: 'Thomas B.',
    customerPhoto: '/images/avatars/thomas.jpg',
    rating: 4,
    comment:
      'Kit embrayage Sachs de qualité. Notice de montage claire. Seul bémol : délai 3 jours au lieu de 2.',
    date: '2025-10-08',
    vehicle: {
      brand: 'Volkswagen',
      model: 'Golf VII',
      year: 2015,
      engine: '1.6 TDI',
    },
    isVerified: true,
    productName: 'Kit embrayage Sachs',
  },
];

// ============================================================================
// Composant principal
// ============================================================================

export const TrustPage: React.FC<TrustPageProps> = ({
  partnerBrands = DEFAULT_PARTNER_BRANDS,
  securityBadges = DEFAULT_SECURITY_BADGES,
  customerReviews = DEFAULT_CUSTOMER_REVIEWS,
  partnersTitle = 'Nos marques partenaires',
  securityTitle = 'Vos garanties',
  reviewsTitle = 'Avis clients vérifiés',
  showSections = {
    partners: true,
    security: true,
    reviews: true,
  },
  onViewAllReviews,
}) => {
  return (
    <div className="w-full space-y-2xl">
      {/* Section Logos Équipementiers */}
      {showSections.partners && (
        <section className="w-full bg-neutral-50 py-2xl">
          <div className="container mx-auto px-md">
            <h2 className="font-heading text-3xl text-neutral-900 text-center mb-xl">
              {partnersTitle}
            </h2>
            <p className="font-sans text-neutral-600 text-center mb-2xl max-w-2xl mx-auto">
              Nous travaillons avec les plus grands équipementiers automobiles pour vous garantir
              des pièces de qualité d'origine constructeur.
            </p>

            {/* Grid logos */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-lg">
              {partnerBrands.map((brand) => (
                <div
                  key={brand.id}
                  className="bg-white p-lg rounded-lg border border-neutral-200 hover:border-secondary-500 hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center group"
                >
                  {/* Placeholder logo (à remplacer par une vraie image en production) */}
                  <div className="w-full h-20 flex items-center justify-center mb-sm">
                    <div className="font-heading text-xl text-neutral-700 group-hover:text-secondary-500 transition-colors">
                      {brand.name}
                    </div>
                  </div>
                  {brand.description && (
                    <p className="font-sans text-xs text-neutral-500 text-center">
                      {brand.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section Badges Sécurité */}
      {showSections.security && (
        <section className="w-full py-2xl">
          <div className="container mx-auto px-md">
            <h2 className="font-heading text-3xl text-neutral-900 text-center mb-xl">
              {securityTitle}
            </h2>

            {/* Grid badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-lg">
              {securityBadges.map((badge) => {
                const bgColorClass =
                  badge.variant === 'success'
                    ? 'bg-success-50 border-success-500'
                    : badge.variant === 'primary'
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-secondary-50 border-secondary-500';

                const iconColorClass =
                  badge.variant === 'success'
                    ? 'text-success-500'
                    : badge.variant === 'primary'
                      ? 'text-primary-500'
                      : 'text-secondary-500';

                return (
                  <div
                    key={badge.id}
                    className={`${bgColorClass} border-2 rounded-lg p-lg flex flex-col items-center text-center hover:shadow-lg transition-shadow duration-300`}
                  >
                    {/* Icône */}
                    <div className={`text-4xl mb-sm ${iconColorClass}`}>{badge.icon}</div>

                    {/* Titre */}
                    <h3 className="font-heading text-lg text-neutral-900 mb-xs">
                      {badge.title}
                    </h3>

                    {/* Description */}
                    <p className="font-sans text-sm text-neutral-600">{badge.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Section Avis Clients avec Véhicule */}
      {showSections.reviews && (
        <section className="w-full bg-neutral-50 py-2xl">
          <div className="container mx-auto px-md">
            <h2 className="font-heading text-3xl text-neutral-900 text-center mb-xl">
              {reviewsTitle}
            </h2>
            <p className="font-sans text-neutral-600 text-center mb-2xl max-w-2xl mx-auto">
              Découvrez les retours d'expérience de nos clients sur leurs véhicules.
            </p>

            {/* Grid avis */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg mb-xl">
              {customerReviews.map((review) => (
                <CustomerReviewCard key={review.id} review={review} />
              ))}
            </div>

            {/* Bouton voir tous les avis */}
            {onViewAllReviews && (
              <div className="text-center">
                <button
                  onClick={onViewAllReviews}
                  className="bg-secondary-500 hover:bg-secondary-600 text-white font-heading px-xl py-md rounded-lg transition-colors duration-200"
                >
                  Voir tous les avis clients
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

// ============================================================================
// Sous-composants
// ============================================================================

/**
 * Carte avis client avec véhicule
 */
const CustomerReviewCard: React.FC<{ review: CustomerReview }> = ({ review }) => {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-lg hover:shadow-lg transition-shadow duration-300">
      {/* Header: Avatar + Nom + Date */}
      <div className="flex items-start gap-sm mb-md">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center shrink-0 overflow-hidden">
          {review.customerPhoto ? (
            <img
              src={review.customerPhoto}
              alt={review.customerName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-heading text-neutral-600 text-lg">
              {review.customerName.charAt(0)}
            </span>
          )}
        </div>

        {/* Nom + Date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-xs">
            <h4 className="font-heading text-neutral-900">{review.customerName}</h4>
            {review.isVerified && (
              <span className="bg-success-500 text-white text-xs px-xs py-0.5 rounded">
                ✓ Vérifié
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-neutral-500">
            {new Date(review.date).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Note étoiles */}
      <div className="flex items-center gap-xs mb-md">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= review.rating ? 'text-warning-500' : 'text-neutral-300'}
          >
            ★
          </span>
        ))}
      </div>

      {/* Commentaire */}
      <p className="font-sans text-neutral-700 mb-md leading-relaxed">{review.comment}</p>

      {/* Véhicule */}
      <div className="bg-secondary-50 border border-secondary-200 rounded-md p-sm">
        <div className="flex items-center gap-xs mb-xs">
          <span className="text-secondary-500">🚗</span>
          <span className="font-heading text-sm text-secondary-700">Véhicule du client</span>
        </div>
        <p className="font-sans text-sm text-neutral-900">
          {review.vehicle.brand} {review.vehicle.model} ({review.vehicle.year})
          {review.vehicle.engine && (
            <span className="font-mono text-xs text-neutral-600 ml-xs">
              · {review.vehicle.engine}
            </span>
          )}
        </p>
      </div>

      {/* Produit acheté (optionnel) */}
      {review.productName && (
        <p className="font-sans text-xs text-neutral-500 mt-sm">
          Produit : <span className="text-neutral-700">{review.productName}</span>
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Export
// ============================================================================

export default TrustPage;
