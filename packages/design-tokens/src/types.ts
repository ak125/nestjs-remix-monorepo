/**
 * 🎨 Design Tokens TypeScript Types
 * 
 * Types générés automatiquement pour autocomplete parfait dans l'IDE
 * Synchronisé avec design-tokens.json
 */

// ==========================================
// COULEURS SÉMANTIQUES
// ==========================================

/**
 * Couleurs sémantiques pour les actions et états
 * @example
 * ```tsx
 * <button className="bg-semantic-action text-semantic-action-contrast">
 *   Call to Action
 * </button>
 * ```
 */
export type SemanticColor =
  | 'action'      // CTA principaux (rouge #D63027)
  | 'info'        // Navigation, liens (bleu #0F4C81)
  | 'success'     // Validations (vert #1E8449)
  | 'warning'     // Avertissements (orange #D68910)
  | 'danger'      // Erreurs (rouge foncé #C0392B)
  | 'neutral';    // États neutres (gris #4B5563)

/**
 * Couleurs sémantiques avec contrast
 */
export type SemanticColorWithContrast =
  | `semantic-${SemanticColor}`
  | `semantic-${SemanticColor}-contrast`;

// ==========================================
// ESPACEMENTS
// ==========================================

/**
 * Espacements basés sur la grille 8px
 * @example
 * ```tsx
 * <div className="p-md m-lg gap-sm">
 *   Content
 * </div>
 * ```
 */
export type Spacing =
  | '0'
  | 'xs'   // 4px
  | 'sm'   // 8px
  | 'md'   // 16px (défaut)
  | 'lg'   // 24px
  | 'xl'   // 32px
  | '2xl'  // 40px
  | '3xl'  // 48px
  | '4xl'  // 64px
  | '5xl'  // 80px
  | '6xl'  // 96px
  | '1'    // 0.25rem
  | '2'    // 0.5rem
  | '3'    // 0.75rem
  | '4'    // 1rem
  | '6'    // 1.5rem
  | '8'    // 2rem
  | '10'   // 2.5rem
  | '12'   // 3rem
  | '16'   // 4rem
  | '20'   // 5rem
  | '24'   // 6rem
  | '32';  // 8rem

/**
 * Espacements fluides/responsive
 */
export type SpacingFluid =
  | 'section-xs'  // clamp(1.5rem, 4vw, 2rem)
  | 'section-sm'  // clamp(2rem, 5vw, 3rem)
  | 'section-md'  // clamp(3rem, 6vw, 4rem)
  | 'section-lg'  // clamp(4rem, 8vw, 6rem)
  | 'section-xl'  // clamp(6rem, 10vw, 8rem)
  | 'section-2xl' // clamp(8rem, 12vw, 10rem)
  | 'gap-xs'      // clamp(0.5rem, 1vw, 0.75rem)
  | 'gap-sm'      // clamp(0.75rem, 1.5vw, 1rem)
  | 'gap-md'      // clamp(1rem, 2vw, 1.5rem)
  | 'gap-lg'      // clamp(1.5rem, 2.5vw, 2rem)
  | 'gap-xl';     // clamp(2rem, 3vw, 2.5rem)

// ==========================================
// TYPOGRAPHIE
// ==========================================

/**
 * Familles de police
 * @example
 * ```tsx
 * <h1 className="font-heading">Titre</h1>
 * <p className="font-sans">Texte</p>
 * <code className="font-mono">Code</code>
 * ```
 */
export type FontFamily =
  | 'heading'  // Montserrat (titres)
  | 'body'     // Inter (texte standard)
  | 'data'     // Roboto Mono (données techniques)
  | 'sans'     // Inter (fallback)
  | 'serif'    // Georgia (texte élégant)
  | 'mono';    // Roboto Mono (code)

/**
 * Tailles de police
 */
export type FontSize =
  | 'xs'   // 0.75rem
  | 'sm'   // 0.875rem
  | 'base' // 1rem (défaut)
  | 'lg'   // 1.125rem
  | 'xl'   // 1.25rem
  | '2xl'  // 1.5rem
  | '3xl'  // 1.875rem
  | '4xl'  // 2.25rem
  | '5xl'  // 3rem
  | '6xl'; // 3.75rem

/**
 * Line heights
 */
export type LineHeight =
  | 'none'    // 1
  | 'tight'   // 1.2
  | 'snug'    // 1.375
  | 'normal'  // 1.5 (défaut)
  | 'relaxed' // 1.6
  | 'loose';  // 1.8

/**
 * Letter spacing
 */
export type LetterSpacing =
  | 'tighter' // -0.05em
  | 'tight'   // -0.025em
  | 'normal'  // 0 (défaut)
  | 'wide'    // 0.025em
  | 'wider'   // 0.05em
  | 'widest'; // 0.1em

/**
 * Font weights
 */
export type FontWeight =
  | 'thin'       // 100
  | 'extralight' // 200
  | 'light'      // 300
  | 'normal'     // 400 (défaut)
  | 'medium'     // 500
  | 'semibold'   // 600
  | 'bold'       // 700
  | 'extrabold'  // 800
  | 'black';     // 900

// ==========================================
// EFFETS
// ==========================================

/**
 * Ombres (box-shadow)
 */
export type Shadow =
  | 'none'  // Pas d'ombre
  | 'sm'    // Légère
  | 'base'  // Standard
  | 'md'    // Moyenne
  | 'lg'    // Grande
  | 'xl'    // Très grande
  | '2xl'   // Énorme
  | 'inner'; // Intérieure

/**
 * Border radius
 */
export type BorderRadius =
  | 'none'  // 0
  | 'sm'    // 0.125rem
  | 'base'  // 0.25rem (défaut)
  | 'md'    // 0.375rem
  | 'lg'    // 0.5rem
  | 'xl'    // 0.75rem
  | '2xl'   // 1rem
  | '3xl'   // 1.5rem
  | 'full'; // 9999px (cercle)

/**
 * Transitions
 */
export type Transition =
  | 'fast'   // 150ms
  | 'base'   // 200ms (défaut)
  | 'slow'   // 250ms
  | 'slower'; // 300ms

/**
 * Z-index
 */
export type ZIndex =
  | 'dropdown'      // 1000
  | 'sticky'        // 1020
  | 'fixed'         // 1030
  | 'modalBackdrop' // 1040
  | 'modal'         // 1050
  | 'popover'       // 1060
  | 'tooltip';      // 1070

// ==========================================
// ANIMATIONS (NOUVEAUX)
// ==========================================

/**
 * Durées d'animation
 */
export type AnimationDuration =
  | 'instant'  // 100ms
  | 'fast'     // 150ms
  | 'normal'   // 200ms (défaut)
  | 'slow'     // 250ms
  | 'slower'   // 300ms
  | 'slowest'; // 700ms

/**
 * Easing functions
 */
export type AnimationEasing =
  | 'linear'    // linear
  | 'ease'      // ease
  | 'easeIn'    // cubic-bezier(0.4, 0, 1, 1)
  | 'easeOut'   // cubic-bezier(0, 0, 0.2, 1)
  | 'easeInOut' // cubic-bezier(0.4, 0, 0.2, 1)
  | 'spring';   // cubic-bezier(0.68, -0.55, 0.265, 1.55)

/**
 * Scale transforms
 */
export type AnimationScale =
  | '95'   // 0.95
  | '100'  // 1 (défaut)
  | '105'  // 1.05
  | '110'; // 1.1

// ==========================================
// ÉTATS (NOUVEAUX)
// ==========================================

/**
 * Opacity pour les états
 */
export type StateOpacity =
  | 'disabled' // 0.4
  | 'hover'    // 0.8
  | 'active'   // 0.6
  | 'loading'; // 0.5

/**
 * Cursors
 */
export type StateCursor =
  | 'default'     // default
  | 'pointer'     // pointer
  | 'notAllowed'  // not-allowed
  | 'wait';       // wait

// ==========================================
// HELPERS TYPES
// ==========================================

/**
 * Type pour les tokens de couleur
 */
export interface ColorToken {
  value: string;
  description: string;
  wcag?: 'AA' | 'AAA';
}

/**
 * Type pour les tokens d'espacement
 */
export interface SpacingToken {
  value: string;
  description: string;
  usage: string;
}

/**
 * Type pour les tokens de typographie
 */
export interface TypographyToken {
  value: string;
  description: string;
  lineHeight?: string;
}

// ==========================================
// CONSTANTES UTILES
// ==========================================

/**
 * Liste des couleurs sémantiques
 */
export const SEMANTIC_COLORS: SemanticColor[] = [
  'action',
  'info',
  'success',
  'warning',
  'danger',
  'neutral'
];

/**
 * Liste des espacements standard
 */
export const STANDARD_SPACING: Spacing[] = [
  'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'
];

/**
 * Liste des fonts
 */
export const FONT_FAMILIES: FontFamily[] = [
  'heading', 'body', 'data', 'sans', 'serif', 'mono'
];

// ==========================================
// TYPES POUR COMPOSANTS
// ==========================================

/**
 * Props pour un bouton avec design tokens
 */
export interface ButtonTokenProps {
  color?: SemanticColor;
  size?: 'sm' | 'md' | 'lg';
  rounded?: BorderRadius;
  shadow?: Shadow;
}

/**
 * Props pour un texte avec design tokens
 */
export interface TextTokenProps {
  font?: FontFamily;
  size?: FontSize;
  weight?: FontWeight;
  lineHeight?: LineHeight;
  spacing?: LetterSpacing;
}

/**
 * Props pour un container avec design tokens
 */
export interface ContainerTokenProps {
  padding?: Spacing;
  margin?: Spacing;
  gap?: Spacing;
  rounded?: BorderRadius;
  shadow?: Shadow;
}
