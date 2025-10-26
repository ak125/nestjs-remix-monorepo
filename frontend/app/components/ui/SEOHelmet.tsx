import React from "react";

export interface SEOData {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: "summary" | "summary_large_image";
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  schemaData?: any;
  // Nouveaux schemas enrichis
  breadcrumbs?: BreadcrumbItem[];
  reviews?: ReviewData[];
  organization?: OrganizationData;
}

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface ReviewData {
  author: string;
  rating: number;
  date: string;
  comment: string;
}

export interface OrganizationData {
  name: string;
  logo?: string;
  url?: string;
  contactPoint?: {
    telephone: string;
    email: string;
    contactType: string;
  };
  sameAs?: string[]; // Social media URLs
}

interface SEOHelmetProps {
  seo: SEOData;
}

export function SEOHelmet({ seo }: SEOHelmetProps) {
  // Générer schemas JSON-LD enrichis
  const schemas: any[] = [];

  // 1. Schema principal (Product ou custom)
  if (seo.schemaData) {
    schemas.push(seo.schemaData);
  }

  // 2. BreadcrumbList schema
  if (seo.breadcrumbs && seo.breadcrumbs.length > 0) {
    schemas.push(generateBreadcrumbSchema(seo.breadcrumbs));
  }

  // 3. Organization schema (global)
  if (seo.organization) {
    schemas.push(generateOrganizationSchema(seo.organization));
  }

  // 4. Reviews + AggregateRating
  if (seo.reviews && seo.reviews.length > 0) {
    const reviewSchemas = generateReviewSchemas(seo.reviews);
    schemas.push(...reviewSchemas);
  }

  return (
    <>
      {/* Title */}
      <title>{seo.title}</title>
      
      {/* Meta description */}
      <meta name="description" content={seo.description} />
      
      {/* Keywords */}
      {seo.keywords && seo.keywords.length > 0 && (
        <meta name="keywords" content={seo.keywords.join(", ")} />
      )}
      
      {/* Canonical URL */}
      {seo.canonicalUrl && (
        <link rel="canonical" href={seo.canonicalUrl} />
      )}
      
      {/* Open Graph */}
      <meta property="og:title" content={seo.ogTitle || seo.title} />
      <meta property="og:description" content={seo.ogDescription || seo.description} />
      <meta property="og:type" content="website" />
      {seo.ogUrl && <meta property="og:url" content={seo.ogUrl} />}
      {seo.ogImage && <meta property="og:image" content={seo.ogImage} />}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={seo.twitterCard || "summary"} />
      <meta name="twitter:title" content={seo.twitterTitle || seo.title} />
      <meta name="twitter:description" content={seo.twitterDescription || seo.description} />
      {seo.twitterImage && <meta name="twitter:image" content={seo.twitterImage} />}
      
      {/* Schema.org JSON-LD enrichis */}
      {schemas.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema)
          }}
        />
      ))}
      
      {/* Additional meta tags */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="AutoMecanik" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </>
  );
}

// Hook pour génération automatique de SEO pour véhicules
export function useVehicleSEO(vehicle: {
  brand: string;
  model: string;
  type: string;
  year?: number;
  partsCount?: number;
}) {
  const seoData: SEOData = {
    title: `Pièces ${vehicle.brand} ${vehicle.model} ${vehicle.type} | Pièces Auto`,
    description: `Découvrez notre sélection de pièces détachées pour ${vehicle.brand} ${vehicle.model} ${vehicle.type}${vehicle.year ? ` ${vehicle.year}` : ''}. Livraison rapide et garantie qualité.`,
    keywords: [
      vehicle.brand.toLowerCase(),
      vehicle.model.toLowerCase(),
      vehicle.type.toLowerCase(),
      "pièces détachées",
      "pièces auto",
      "automobile",
      "garage",
      "réparation"
    ],
    canonicalUrl: `/enhanced-vehicle-catalog/${vehicle.brand.toLowerCase()}/${vehicle.model.toLowerCase()}/${vehicle.type.toLowerCase()}`,
    ogTitle: `Pièces ${vehicle.brand} ${vehicle.model} ${vehicle.type}`,
    ogDescription: `${vehicle.partsCount || 0} pièces disponibles pour votre ${vehicle.brand} ${vehicle.model} ${vehicle.type}`,
    twitterCard: "summary_large_image",
    schemaData: {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": `Pièces ${vehicle.brand} ${vehicle.model} ${vehicle.type}`,
      "description": `Pièces détachées pour ${vehicle.brand} ${vehicle.model} ${vehicle.type}`,
      "brand": {
        "@type": "Brand",
        "name": vehicle.brand
      },
      "model": vehicle.model,
      "vehicleEngine": vehicle.type,
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock",
        "offerCount": vehicle.partsCount || 0
      }
    }
  };

  return seoData;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 SCHEMA GENERATORS - Helpers pour JSON-LD enrichis
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Génère BreadcrumbList schema.org
 */
function generateBreadcrumbSchema(breadcrumbs: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": item.href
    }))
  };
}

/**
 * Génère Organization schema.org (entreprise)
 */
function generateOrganizationSchema(org: OrganizationData) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": org.name,
    "url": org.url || "https://automecanik.com",
    "logo": org.logo || "https://automecanik.com/logo.png",
    ...(org.contactPoint && {
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": org.contactPoint.telephone,
        "email": org.contactPoint.email,
        "contactType": org.contactPoint.contactType,
        "areaServed": "FR",
        "availableLanguage": ["French"]
      }
    }),
    ...(org.sameAs && { "sameAs": org.sameAs })
  };
}

/**
 * Génère Review + AggregateRating schemas
 */
function generateReviewSchemas(reviews: ReviewData[]) {
  const schemas: any[] = [];

  // Calculer rating moyen
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = totalRating / reviews.length;

  // AggregateRating
  schemas.push({
    "@context": "https://schema.org",
    "@type": "AggregateRating",
    "ratingValue": avgRating.toFixed(1),
    "reviewCount": reviews.length,
    "bestRating": 5,
    "worstRating": 1
  });

  // Individual Reviews
  reviews.slice(0, 5).forEach((review) => {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.author
      },
      "datePublished": review.date,
      "reviewBody": review.comment,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating,
        "bestRating": 5,
        "worstRating": 1
      }
    });
  });

  return schemas;
}