/**
 * Visual Intent System — Config centrale.
 *
 * Source unique pour les choix visuels par type de page :
 * - Tier visuel (neutral / pedagogical / alert)
 * - Niveau d'animation
 * - Slogan template avec interpolation {gamme}
 * - Ambiance (temperature couleur, contraste)
 * - Config image par section de contenu
 *
 * @see .spec/00-canon/image-matrix-v1.md
 * @see frontend/app/components/heroes/_hero.contract.md
 */

import { type IntentClass } from "~/utils/og-constants";

// ─── Visual Tier ───

export type VisualTier = "neutral" | "pedagogical" | "alert";

// ─── Animation Level ───
// Contraint par _hero.contract.md : max transition-[opacity,transform] duration-200

export type AnimationLevel = "none" | "subtle" | "moderate";

// ─── Ambiance Tokens ───

export interface AmbianceTokens {
  /** Temperature couleur : warm (orange/amber) | cool (blue/slate) | neutral */
  temperature: "warm" | "cool" | "neutral";
  /** Niveau de contraste visuel */
  contrast: "low" | "medium" | "high";
  /** Opacite overlay hero (Tailwind class) */
  overlayOpacity: string;
}

// ─── Section Image Config ───

export type ImagePlacement = "left" | "right" | "full" | "center";
export type ImageSize = "sm" | "md" | "lg";

export interface SectionImageRule {
  /** Position dans la section */
  placement: ImagePlacement;
  /** Taille de l'image */
  size: ImageSize;
  /** Source par defaut : pg_img (gamme), supabase (storage), static (illustration), ou aucune */
  defaultSource: "pg_img" | "supabase" | "static" | "none";
  /** Chemin illustration statique (fallback si pas d'image specifique) */
  staticFallback?: string;
}

// ─── Visual Intent Config ───

export type HeroPolicy =
  | "photo"
  | "gradient"
  | "illustration"
  | "none"
  | "ui-screenshot";

export interface VisualIntentConfig {
  tier: VisualTier;
  animationLevel: AnimationLevel;
  sloganTemplate: string;
  ambiance: AmbianceTokens;
  heroComponent: string;
  heroPolicy: HeroPolicy;
  /** Budget : nombre max d'images section par page (hors hero) */
  maxSectionImages: number;
  /** Template alt-text SEO pour Google Images (avec {gamme}) */
  altTextTemplate: string;
  /** Config image par section (cle = nom de section) */
  sectionImages: Record<string, SectionImageRule>;
}

// ─── Matrice principale ───

const VISUAL_INTENT_MAP: Record<IntentClass, VisualIntentConfig> = {
  transaction: {
    tier: "neutral",
    animationLevel: "moderate",
    sloganTemplate: "{gamme} au meilleur prix — livraison rapide",
    ambiance: {
      temperature: "neutral",
      contrast: "medium",
      overlayOpacity: "bg-black/40",
    },
    heroComponent: "HeroTransaction",
    heroPolicy: "photo",
    maxSectionImages: 1,
    altTextTemplate: "{gamme} — vue produit",
    sectionImages: {
      buyingGuide: {
        placement: "right",
        size: "md",
        defaultSource: "pg_img",
      },
    },
  },

  selection: {
    tier: "neutral",
    animationLevel: "subtle",
    sloganTemplate: "Trouvez les {gamme} compatibles avec votre vehicule",
    ambiance: {
      temperature: "cool",
      contrast: "low",
      overlayOpacity: "bg-black/0",
    },
    heroComponent: "HeroSelection",
    heroPolicy: "gradient",
    maxSectionImages: 0,
    altTextTemplate: "{gamme} — selection vehicule",
    sectionImages: {},
  },

  "guide-achat": {
    tier: "pedagogical",
    animationLevel: "subtle",
    sloganTemplate: "Comment bien choisir vos {gamme}",
    ambiance: {
      temperature: "warm",
      contrast: "medium",
      overlayOpacity: "bg-black/60",
    },
    heroComponent: "HeroGuide",
    heroPolicy: "photo",
    maxSectionImages: 3,
    altTextTemplate: "Comparaison de {gamme} — criteres de choix",
    sectionImages: {
      intro: {
        placement: "right",
        size: "md",
        defaultSource: "pg_img",
      },
      risk: {
        placement: "left",
        size: "sm",
        defaultSource: "static",
        staticFallback: "/images/sections/risk-alert.svg",
      },
      howToChoose: {
        placement: "full",
        size: "lg",
        defaultSource: "pg_img",
      },
      symptoms: {
        placement: "left",
        size: "sm",
        defaultSource: "static",
        staticFallback: "/images/sections/symptoms-check.svg",
      },
    },
  },

  "blog-conseil": {
    tier: "pedagogical",
    animationLevel: "subtle",
    sloganTemplate: "Tout savoir sur les {gamme}",
    ambiance: {
      temperature: "warm",
      contrast: "medium",
      overlayOpacity: "bg-black/60",
    },
    heroComponent: "HeroBlog",
    heroPolicy: "photo",
    maxSectionImages: 2,
    altTextTemplate: "{gamme} — conseil d'entretien",
    sectionImages: {
      signsOfWear: {
        placement: "right",
        size: "md",
        defaultSource: "pg_img",
      },
      removal: {
        placement: "full",
        size: "lg",
        defaultSource: "static",
        staticFallback: "/images/sections/step-by-step.svg",
      },
      reassembly: {
        placement: "full",
        size: "lg",
        defaultSource: "static",
        staticFallback: "/images/sections/step-by-step.svg",
      },
    },
  },

  diagnostic: {
    tier: "alert",
    animationLevel: "none",
    sloganTemplate: "Diagnostic {gamme} — identifiez la cause",
    ambiance: {
      temperature: "cool",
      contrast: "high",
      overlayOpacity: "bg-black/0",
    },
    heroComponent: "HeroDiagnostic",
    heroPolicy: "illustration",
    maxSectionImages: 2,
    altTextTemplate: "Zone du vehicule affectee par une panne de {gamme}",
    sectionImages: {
      symptom: {
        placement: "right",
        size: "md",
        defaultSource: "static",
        staticFallback: "/images/sections/vehicle-zone.svg",
      },
      technicianCheck: {
        placement: "left",
        size: "md",
        defaultSource: "static",
        staticFallback: "/images/sections/inspection.svg",
      },
      recommendedActions: {
        placement: "left",
        size: "sm",
        defaultSource: "static",
        staticFallback: "/images/sections/tool-action.svg",
      },
    },
  },

  "panne-symptome": {
    tier: "alert",
    animationLevel: "none",
    sloganTemplate: "{gamme} en panne — agissez vite",
    ambiance: {
      temperature: "cool",
      contrast: "high",
      overlayOpacity: "bg-black/0",
    },
    heroComponent: "HeroDiagnostic",
    heroPolicy: "illustration",
    maxSectionImages: 1,
    altTextTemplate: "Symptomes de panne {gamme}",
    sectionImages: {
      symptom: {
        placement: "right",
        size: "md",
        defaultSource: "static",
        staticFallback: "/images/sections/vehicle-zone.svg",
      },
    },
  },

  "role-piece": {
    tier: "pedagogical",
    animationLevel: "subtle",
    sloganTemplate: "Comprendre le role des {gamme}",
    ambiance: {
      temperature: "warm",
      contrast: "medium",
      overlayOpacity: "bg-black/40",
    },
    heroComponent: "HeroRole",
    heroPolicy: "illustration",
    maxSectionImages: 3,
    altTextTemplate: "{gamme} — role dans le vehicule",
    sectionImages: {
      roleInVehicle: {
        placement: "right",
        size: "lg",
        defaultSource: "pg_img",
      },
      mechanicalInteractions: {
        placement: "center",
        size: "md",
        defaultSource: "static",
        staticFallback: "/images/sections/system-schema.svg",
      },
      checkpoints: {
        placement: "left",
        size: "sm",
        defaultSource: "static",
        staticFallback: "/images/sections/checkpoint.svg",
      },
    },
  },

  "glossaire-reference": {
    tier: "neutral",
    animationLevel: "none",
    sloganTemplate: "",
    ambiance: {
      temperature: "neutral",
      contrast: "low",
      overlayOpacity: "bg-black/0",
    },
    heroComponent: "HeroReference",
    heroPolicy: "none",
    maxSectionImages: 3,
    altTextTemplate: "{gamme} — schema de fonctionnement",
    sectionImages: {
      roleMecanique: {
        placement: "right",
        size: "md",
        defaultSource: "pg_img",
      },
      composition: {
        placement: "left",
        size: "md",
        defaultSource: "static",
        staticFallback: "/images/sections/exploded-view.svg",
      },
      confusions: {
        placement: "center",
        size: "md",
        defaultSource: "static",
        staticFallback: "/images/sections/comparison-ab.svg",
      },
      installation: {
        placement: "full",
        size: "lg",
        defaultSource: "static",
        staticFallback: "/images/sections/step-by-step.svg",
      },
    },
  },

  outil: {
    tier: "neutral",
    animationLevel: "subtle",
    sloganTemplate: "Outil {gamme}",
    ambiance: {
      temperature: "neutral",
      contrast: "low",
      overlayOpacity: "bg-black/0",
    },
    heroComponent: "HeroOutil",
    heroPolicy: "ui-screenshot",
    maxSectionImages: 0,
    altTextTemplate: "Outil {gamme}",
    sectionImages: {},
  },
};

// ─── API publique ───

/**
 * Retourne la config visuelle complete pour un intent class.
 */
export function getVisualIntent(intentClass: IntentClass): VisualIntentConfig {
  return VISUAL_INTENT_MAP[intentClass];
}

/**
 * Interpole le slogan avec le nom de gamme.
 * Si gammeName absent, {gamme} → "pieces auto".
 */
export function resolveSlogan(
  intentClass: IntentClass,
  gammeName?: string | null,
): string {
  const config = VISUAL_INTENT_MAP[intentClass];
  if (!config.sloganTemplate) return "";
  const name = gammeName?.trim() || "pieces auto";
  return config.sloganTemplate.replace(/\{gamme\}/g, name);
}

/**
 * Retourne les classes Tailwind pour un niveau d'animation.
 * Respecte _hero.contract.md : max transition-[opacity,transform] duration-200.
 */
export function getAnimationClasses(level: AnimationLevel): string {
  switch (level) {
    case "none":
      return "";
    case "subtle":
      return "transition-opacity duration-200";
    case "moderate":
      return "transition-[opacity,transform] duration-200";
  }
}

/**
 * Retourne la config image pour une section donnee.
 * Retourne undefined si la section n'a pas d'image prevue.
 */
export function getSectionImageConfig(
  intentClass: IntentClass,
  sectionType: string,
): SectionImageRule | undefined {
  const config = VISUAL_INTENT_MAP[intentClass];
  return config.sectionImages[sectionType];
}

/**
 * Genere un alt-text SEO structure pour une section image.
 * Combine le template de l'intent class avec le nom de gamme.
 */
export function resolveAltText(
  intentClass: IntentClass,
  gammeName?: string | null,
): string {
  const config = VISUAL_INTENT_MAP[intentClass];
  if (!config.altTextTemplate) return gammeName?.trim() || "piece auto";
  const name = gammeName?.trim() || "pieces auto";
  return config.altTextTemplate.replace(/\{gamme\}/g, name);
}

// ─── Tailles en pixels (pour SectionImage) ───

export const IMAGE_SIZES: Record<ImageSize, number> = {
  sm: 160,
  md: 240,
  lg: 400,
};
