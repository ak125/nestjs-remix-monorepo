/**
 * TrustPageExamples - Exemples d'utilisation de TrustPage
 * 
 * Démontre les différentes configurations possibles:
 * 1. Page complète (logos + badges + avis)
 * 2. Section logos seule
 * 3. Section avis seule
 * 4. Configuration personnalisée
 */

import React, { useState } from 'react';
import {
  TrustPage,
  type PartnerBrand,
  type SecurityBadge,
  type CustomerReview,
} from './TrustPage';

// ============================================================================
// Exemple 1: Page Complète
// ============================================================================

/**
 * Exemple complet avec toutes les sections
 */
export const TrustPageComplete: React.FC = () => {
  const handleViewAllReviews = () => {
    console.log('Navigation vers page avis complets');
    // router.push('/avis-clients');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-md py-2xl">
        <h1 className="font-heading text-4xl text-neutral-900 text-center mb-md">
          Pourquoi nous faire confiance ?
        </h1>
        <p className="font-sans text-lg text-neutral-600 text-center mb-2xl max-w-3xl mx-auto">
          Des pièces de qualité, des garanties solides, et des milliers de clients satisfaits.
        </p>

        <TrustPage onViewAllReviews={handleViewAllReviews} />
      </div>
    </div>
  );
};

// ============================================================================
// Exemple 2: Section Logos Seule (Footer ou Page Partenaires)
// ============================================================================

/**
 * Affichage uniquement des logos partenaires
 * Utile pour footer ou page dédiée partenaires
 */
export const TrustPagePartnersOnly: React.FC = () => {
  const customBrands: PartnerBrand[] = [
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
    {
      id: 'continental',
      name: 'Continental',
      logoUrl: '/images/brands/continental.png',
      description: 'Expert pneumatiques et freinage',
    },
    {
      id: 'liqui-moly',
      name: 'Liqui Moly',
      logoUrl: '/images/brands/liqui-moly.png',
      description: 'Spécialiste lubrifiants premium',
    },
  ];

  return (
    <div className="bg-neutral-50 py-2xl">
      <TrustPage
        partnerBrands={customBrands}
        partnersTitle="Nos équipementiers de confiance"
        showSections={{
          partners: true,
          security: false,
          reviews: false,
        }}
      />
    </div>
  );
};

// ============================================================================
// Exemple 3: Section Avis Seule (Page Produit ou Catégorie)
// ============================================================================

/**
 * Affichage uniquement des avis clients
 * Utile pour page produit ou catégorie
 */
export const TrustPageReviewsOnly: React.FC = () => {
  const productReviews: CustomerReview[] = [
    {
      id: 'review-p1',
      customerName: 'Jean-Luc M.',
      customerPhoto: '/images/avatars/jeanluc.jpg',
      rating: 5,
      comment:
        'Disques de frein Brembo au top ! Freinage progressif et puissant. Compatible parfaitement avec ma Golf GTI.',
      date: '2025-10-20',
      vehicle: {
        brand: 'Volkswagen',
        model: 'Golf GTI',
        year: 2017,
        engine: '2.0 TSI',
      },
      isVerified: true,
      productName: 'Kit disques de frein avant Brembo',
    },
    {
      id: 'review-p2',
      customerName: 'Céline R.',
      customerPhoto: '/images/avatars/celine.jpg',
      rating: 5,
      comment:
        'Amortisseurs Sachs installés sur ma Megane. Confort retrouvé, tenue de route améliorée. Excellent rapport qualité/prix.',
      date: '2025-10-18',
      vehicle: {
        brand: 'Renault',
        model: 'Megane III',
        year: 2014,
        engine: '1.5 dCi',
      },
      isVerified: true,
      productName: 'Amortisseurs avant Sachs',
    },
    {
      id: 'review-p3',
      customerName: 'Pierre D.',
      customerPhoto: '/images/avatars/pierre.jpg',
      rating: 4,
      comment:
        'Kit distribution Bosch de qualité. Notice claire, pièces bien emballées. Installation nickel par mon garagiste.',
      date: '2025-10-14',
      vehicle: {
        brand: 'Peugeot',
        model: '308',
        year: 2016,
        engine: '1.6 BlueHDi',
      },
      isVerified: true,
      productName: 'Kit distribution Bosch',
    },
    {
      id: 'review-p4',
      customerName: 'Nathalie B.',
      rating: 5,
      comment:
        'Parfait ! Filtre à huile MANN + huile Liqui Moly. Livraison rapide, prix compétitif. Ma 208 ronronne.',
      date: '2025-10-10',
      vehicle: {
        brand: 'Peugeot',
        model: '208',
        year: 2019,
        engine: '1.2 PureTech',
      },
      isVerified: true,
      productName: 'Kit vidange MANN + Liqui Moly',
    },
    {
      id: 'review-p5',
      customerName: 'Alexandre T.',
      customerPhoto: '/images/avatars/alex.jpg',
      rating: 5,
      comment:
        'Bougies NGK pour ma Civic Type R. Démarrage immédiat, moteur plus nerveux. Compatible OEM, qualité irréprochable.',
      date: '2025-10-05',
      vehicle: {
        brand: 'Honda',
        model: 'Civic Type R',
        year: 2018,
        engine: '2.0 VTEC Turbo',
      },
      isVerified: true,
      productName: 'Bougies allumage NGK Iridium',
    },
    {
      id: 'review-p6',
      customerName: 'Isabelle G.',
      rating: 4,
      comment:
        'Batterie Bosch pour ma Clio. Très bon rapport qualité/prix. Garantie 2 ans rassurante. Délai de livraison respecté.',
      date: '2025-10-01',
      vehicle: {
        brand: 'Renault',
        model: 'Clio IV',
        year: 2015,
      },
      isVerified: true,
      productName: 'Batterie Bosch S4',
    },
  ];

  return (
    <div className="bg-white py-2xl">
      <TrustPage
        customerReviews={productReviews}
        reviewsTitle="Ce que disent nos clients"
        showSections={{
          partners: false,
          security: false,
          reviews: true,
        }}
        onViewAllReviews={() => console.log('Voir tous les avis')}
      />
    </div>
  );
};

// ============================================================================
// Exemple 4: Configuration Personnalisée
// ============================================================================

/**
 * Configuration avancée avec badges personnalisés
 */
export const TrustPageCustomConfig: React.FC = () => {
  const customSecurityBadges: SecurityBadge[] = [
    {
      id: 'eco-payment',
      type: 'payment',
      title: 'Paiement en 3x sans frais',
      description: 'Répartissez vos achats sur 3 mois sans frais supplémentaires.',
      icon: '💳',
      variant: 'primary',
    },
    {
      id: 'expert-warranty',
      type: 'warranty',
      title: 'Garantie Expert 3 ans',
      description: 'Garantie étendue 3 ans pour tous les kits distribution.',
      icon: '🛡️',
      variant: 'success',
    },
    {
      id: 'mounting-guide',
      type: 'certified',
      title: 'Notice montage incluse',
      description: 'Guides techniques détaillés pour faciliter l\'installation.',
      icon: '📋',
      variant: 'secondary',
    },
    {
      id: 'hotline',
      type: 'certified',
      title: 'Hotline technique gratuite',
      description: 'Nos experts répondent à vos questions par téléphone.',
      icon: '📞',
      variant: 'secondary',
    },
  ];

  const [selectedSection, setSelectedSection] = useState<
    'all' | 'partners' | 'security' | 'reviews'
  >('all');

  const showSectionsConfig = {
    partners: selectedSection === 'all' || selectedSection === 'partners',
    security: selectedSection === 'all' || selectedSection === 'security',
    reviews: selectedSection === 'all' || selectedSection === 'reviews',
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-md py-2xl">
        <h1 className="font-heading text-4xl text-neutral-900 text-center mb-xl">
          Configurateur de page confiance
        </h1>

        {/* Sélecteur de sections */}
        <div className="flex justify-center gap-md mb-2xl flex-wrap">
          <button
            onClick={() => setSelectedSection('all')}
            className={`font-heading px-lg py-md rounded-lg transition-colors ${
              selectedSection === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Toutes les sections
          </button>
          <button
            onClick={() => setSelectedSection('partners')}
            className={`font-heading px-lg py-md rounded-lg transition-colors ${
              selectedSection === 'partners'
                ? 'bg-secondary-500 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Logos uniquement
          </button>
          <button
            onClick={() => setSelectedSection('security')}
            className={`font-heading px-lg py-md rounded-lg transition-colors ${
              selectedSection === 'security'
                ? 'bg-success-500 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Badges uniquement
          </button>
          <button
            onClick={() => setSelectedSection('reviews')}
            className={`font-heading px-lg py-md rounded-lg transition-colors ${
              selectedSection === 'reviews'
                ? 'bg-warning-500 text-white'
                : 'bg-white text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            Avis uniquement
          </button>
        </div>

        {/* TrustPage avec configuration dynamique */}
        <TrustPage
          securityBadges={customSecurityBadges}
          showSections={showSectionsConfig}
          onViewAllReviews={() => alert('Navigation vers tous les avis')}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Exemple 5: Intégration dans Footer
// ============================================================================

/**
 * Version compacte pour footer
 */
export const TrustPageFooter: React.FC = () => {
  const compactBrands: PartnerBrand[] = [
    { id: 'bosch', name: 'Bosch', logoUrl: '/images/brands/bosch.png' },
    { id: 'valeo', name: 'Valeo', logoUrl: '/images/brands/valeo.png' },
    { id: 'mann', name: 'MANN', logoUrl: '/images/brands/mann.png' },
    { id: 'brembo', name: 'Brembo', logoUrl: '/images/brands/brembo.png' },
  ];

  const compactBadges: SecurityBadge[] = [
    {
      id: 'payment',
      type: 'payment',
      title: 'Paiement sécurisé',
      description: 'SSL + 3D Secure',
      icon: '🔒',
      variant: 'success',
    },
    {
      id: 'warranty',
      type: 'warranty',
      title: 'Garantie 2 ans',
      description: 'Sur toutes nos pièces',
      icon: '✓',
      variant: 'success',
    },
    {
      id: 'delivery',
      type: 'delivery',
      title: 'Livraison 24h',
      description: 'Expédition express',
      icon: '🚚',
      variant: 'primary',
    },
  ];

  return (
    <footer className="bg-neutral-900 text-white py-xl">
      <div className="container mx-auto px-md">
        <TrustPage
          partnerBrands={compactBrands}
          securityBadges={compactBadges}
          partnersTitle="Nos marques"
          securityTitle="Nos garanties"
          showSections={{
            partners: true,
            security: true,
            reviews: false,
          }}
        />
      </div>
    </footer>
  );
};

// ============================================================================
// Export par défaut: Showcase de tous les exemples
// ============================================================================

export const TrustPageShowcase: React.FC = () => {
  return (
    <div className="w-full space-y-4xl">
      {/* Exemple 1 */}
      <div>
        <div className="bg-primary-500 text-white py-md px-lg mb-md">
          <h2 className="font-heading text-2xl">Exemple 1: Page complète</h2>
        </div>
        <TrustPageComplete />
      </div>

      {/* Exemple 2 */}
      <div>
        <div className="bg-secondary-500 text-white py-md px-lg mb-md">
          <h2 className="font-heading text-2xl">Exemple 2: Section logos seule</h2>
        </div>
        <TrustPagePartnersOnly />
      </div>

      {/* Exemple 3 */}
      <div>
        <div className="bg-success-500 text-white py-md px-lg mb-md">
          <h2 className="font-heading text-2xl">Exemple 3: Section avis seule</h2>
        </div>
        <TrustPageReviewsOnly />
      </div>

      {/* Exemple 4 */}
      <div>
        <div className="bg-warning-500 text-white py-md px-lg mb-md">
          <h2 className="font-heading text-2xl">Exemple 4: Configuration personnalisée</h2>
        </div>
        <TrustPageCustomConfig />
      </div>

      {/* Exemple 5 */}
      <div>
        <div className="bg-neutral-700 text-white py-md px-lg mb-md">
          <h2 className="font-heading text-2xl">Exemple 5: Version footer</h2>
        </div>
        <TrustPageFooter />
      </div>
    </div>
  );
};

export default TrustPageShowcase;
