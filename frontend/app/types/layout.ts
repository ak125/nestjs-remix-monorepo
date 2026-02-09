/**
 * 🎨 TYPES LAYOUT SYSTEM
 * 
 * Définitions TypeScript pour le système de layout
 */

export interface ModularSection {
  id: string;
  name: string;
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'content' | 'gallery';
  category: 'core' | 'massdoc' | 'shared';
  template: string;
  props: HeroProps | FeaturesProps | CTAProps | ContentProps | GalleryProps | TestimonialsProps | Record<string, unknown>;
  styles: {
    background?: string;
    textColor?: string;
    spacing?: 'tight' | 'normal' | 'relaxed';
    customCSS?: string;
  };
  conditions: {
    pages?: string[];
    contexts?: string[];
    userRoles?: string[];
  };
  position: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LayoutConfig {
  type: 'core' | 'massdoc' | 'admin' | 'commercial' | 'public';
  theme?: 'light' | 'dark' | 'auto';
  version?: string;
  page?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  showSidebar?: boolean;
  showQuickSearch?: boolean;
  context?: Record<string, unknown>;
}

export interface LayoutData {
  header?: HeaderConfig | null;
  footer?: FooterConfig | null;
  navigation?: NavigationItem[] | { main: NavigationItem[]; secondary?: NavigationItem[] };
  quickSearch?: Record<string, unknown>;
  socialShare?: Record<string, unknown>;
  metaTags?: Record<string, unknown>;
  sections?: ModularSection[];
  config?: LayoutConfig;
  widgets?: Record<string, unknown>[];
  performance?: {
    cacheKey: string;
    lastUpdated: string;
    expires: number;
  };
}

export interface SectionTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  component: string;
  defaultProps: Record<string, unknown>;
  requiredProps: string[];
  preview: string;
}

export interface HeaderConfig {
  show: boolean;
  variant?: 'default' | 'minimal' | 'extended';
  logo?: {
    src: string;
    alt: string;
    link: string;
    height?: number;
  };
  navigation?: {
    show: boolean;
    style?: 'horizontal' | 'dropdown' | 'mega';
    items: NavigationItem[];
  };
  search?: {
    enabled: boolean;
    placeholder: string;
  };
}

export interface FooterConfig {
  show: boolean;
  variant?: 'complete' | 'simple' | 'minimal';
  copyright?: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  description?: string;
  children?: NavigationItem[];
}

// Props pour les templates de sections
export interface HeroProps {
  title: string;
  subtitle?: string;
  action?: {
    text: string;
    href: string;
  };
  image?: string;
  features?: string[];
}

export interface FeaturesProps {
  title: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
}

export interface CTAProps {
  title: string;
  subtitle?: string;
  action: {
    text: string;
    href: string;
  };
}

export interface ContentProps {
  title?: string;
  content: string;
  image?: string;
  imagePosition?: 'left' | 'right' | 'top' | 'bottom';
}

export interface GalleryProps {
  title?: string;
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
  }>;
  columns?: number;
}

export interface TestimonialsProps {
  title?: string;
  testimonials: Array<{
    text: string;
    author: string;
    role?: string;
    avatar?: string;
  }>;
}

// Props communes pour tous les templates
export interface TemplateBaseProps {
  sectionId: string;
  sectionName: string;
}
