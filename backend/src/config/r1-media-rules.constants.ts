/**
 * R1 Media Rules — regles statiques pour les assets visuels des pages gamme R1.
 * PAS injecte dans les prompts LLM (economie de tokens).
 * Reference pour le pipeline de build d'images et le frontend.
 */
export const R1_MEDIA_RULES = {
  no_wallpaper: true,
  selector_category_image_required: true,
  logos_must_be_official_or_internal: true,
  compat_icons_only: true,
  cross_sell_icons_only: true,
  no_vehicle_photos: true,
  alt_style: 'descriptive_no_hype_no_price' as const,
} as const;
