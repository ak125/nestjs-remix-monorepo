/**
 * 🔧 Configuration centralisée du site
 * 
 * Permet de gérer facilement les informations de contact,
 * promotions et autres configurations sans toucher au code
 */

export const SITE_CONFIG = {
  name: "Automecanik",
  tagline: "Pièces auto à prix pas cher",
  
  contact: {
    phone: {
      display: "09 70 XX XX XX", // À remplacer par le vrai numéro
      raw: "+33970XXXXXX",        // Format international
      hours: "Lun-Ven 9h-18h, Sam 9h-13h"
    },
    email: "contact@automecanik.com", // Vérifier si domaine actif
  },
  
  promo: {
    enabled: true,
    icon: "🚚",
    text: "Livraison gratuite dès 100€",
    color: "green" as const,
    // Permet de changer facilement la promo
    // icon: "🎉", text: "-15% sur tout le site", color: "orange"
  },
  
  social: {
    facebook: "https://facebook.com/automecanik",
    instagram: "https://instagram.com/automecanik",
    linkedin: "https://linkedin.com/company/automecanik",
  },
  
  features: {
    blog: {
      enabled: true,
      launchDate: new Date('2025-11-01'), // Date de lancement du blog
      showNewBadge: true, // Affiche "Nouveau" pendant 30 jours
    },
  },
};

// Helper pour vérifier si une feature est nouvelle
export const isFeatureNew = (launchDate: Date, daysThreshold = 30): boolean => {
  const now = Date.now();
  const launch = launchDate.getTime();
  const daysSinceLaunch = (now - launch) / (24 * 60 * 60 * 1000);
  return daysSinceLaunch < daysThreshold && daysSinceLaunch >= 0;
};
