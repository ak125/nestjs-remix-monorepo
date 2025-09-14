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
}

interface SEOHelmetProps {
  seo: SEOData;
}

export function SEOHelmet({ seo }: SEOHelmetProps) {
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
      
      {/* Schema.org JSON-LD */}
      {seo.schemaData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(seo.schemaData)
          }}
        />
      )}
      
      {/* Additional meta tags for vehicle pages */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="Votre site automobile" />
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