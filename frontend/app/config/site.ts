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
      display: "01 48 47 96 27",
      raw: "+33148479627",
      hours: "Lun-Ven 9h-18h, Sam 9h-13h",
    },
    email: "contact@automecanik.com", // Vérifier si domaine actif
  },

  promo: {
    enabled: true,
    icon: "🚚",
    text: "Livraison gratuite dès 150€",
    color: "green" as const,
    // Permet de changer facilement la promo
    // icon: "🎉", text: "-15% sur tout le site", color: "orange"
  },

  social: {
    facebook: "https://www.facebook.com/Automecanik63",
    instagram: "https://www.instagram.com/automecanik.co",
    youtube: "https://www.youtube.com/@automecanik8508",
  },

  features: {
    blog: {
      enabled: true,
      launchDate: new Date("2025-11-01"), // Date de lancement du blog
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
