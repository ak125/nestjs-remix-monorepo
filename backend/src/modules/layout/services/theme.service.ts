import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';

export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
  layout: {
    borderRadius: string;
    spacing: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
  responsive: {
    breakpoints: {
      mobile: string;
      tablet: string;
      desktop: string;
      wide: string;
    };
  };
}

@Injectable()
export class ThemeService {
  private readonly logger = new Logger(ThemeService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Obtient la configuration du thème
   */
  async getTheme(themeName: string = 'default'): Promise<ThemeConfig> {
    try {
      const cacheKey = `theme_${themeName}`;
      const cached = await this.cacheService.get<ThemeConfig>(cacheKey);
      
      if (cached) {
        this.logger.debug(`Theme cache hit for: ${themeName}`);
        return cached;
      }

      const theme = this.generateTheme(themeName);
      await this.cacheService.set(cacheKey, theme, 3600); // 1 heure
      
      return theme;
    } catch (error) {
      this.logger.error(`Error getting theme: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.generateTheme('default');
    }
  }

  /**
   * Liste tous les thèmes disponibles
   */
  async getAvailableThemes(): Promise<string[]> {
    return ['default', 'dark', 'automotive', 'professional', 'modern'];
  }

  /**
   * Génère la configuration d'un thème
   */
  private generateTheme(themeName: string): ThemeConfig {
    const themes = {
      default: this.getDefaultTheme(),
      dark: this.getDarkTheme(),
      automotive: this.getAutomotiveTheme(),
      professional: this.getProfessionalTheme(),
      modern: this.getModernTheme(),
    };

    return themes[themeName as keyof typeof themes] || themes.default;
  }

  /**
   * Thème par défaut
   */
  private getDefaultTheme(): ThemeConfig {
    return {
      name: 'default',
      colors: {
        primary: '#2563eb',
        secondary: '#64748b',
        accent: '#f59e0b',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#1e293b',
        textSecondary: '#64748b',
      },
      typography: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          md: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
        },
      },
      layout: {
        borderRadius: '0.5rem',
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '3rem',
        },
      },
      responsive: {
        breakpoints: {
          mobile: '640px',
          tablet: '768px',
          desktop: '1024px',
          wide: '1280px',
        },
      },
    };
  }

  /**
   * Thème sombre
   */
  private getDarkTheme(): ThemeConfig {
    return {
      name: 'dark',
      colors: {
        primary: '#3b82f6',
        secondary: '#6b7280',
        accent: '#fbbf24',
        background: '#111827',
        surface: '#1f2937',
        text: '#f9fafb',
        textSecondary: '#d1d5db',
      },
      typography: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          md: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
        },
      },
      layout: {
        borderRadius: '0.5rem',
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '3rem',
        },
      },
      responsive: {
        breakpoints: {
          mobile: '640px',
          tablet: '768px',
          desktop: '1024px',
          wide: '1280px',
        },
      },
    };
  }

  /**
   * Thème automobile
   */
  private getAutomotiveTheme(): ThemeConfig {
    return {
      name: 'automotive',
      colors: {
        primary: '#dc2626',
        secondary: '#374151',
        accent: '#f59e0b',
        background: '#f9fafb',
        surface: '#ffffff',
        text: '#111827',
        textSecondary: '#6b7280',
      },
      typography: {
        fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          md: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
        },
      },
      layout: {
        borderRadius: '0.25rem',
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '3rem',
        },
      },
      responsive: {
        breakpoints: {
          mobile: '640px',
          tablet: '768px',
          desktop: '1024px',
          wide: '1280px',
        },
      },
    };
  }

  /**
   * Thème professionnel
   */
  private getProfessionalTheme(): ThemeConfig {
    return {
      name: 'professional',
      colors: {
        primary: '#059669',
        secondary: '#4b5563',
        accent: '#0891b2',
        background: '#ffffff',
        surface: '#f3f4f6',
        text: '#1f2937',
        textSecondary: '#6b7280',
      },
      typography: {
        fontFamily: 'Source Sans Pro, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          md: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
        },
      },
      layout: {
        borderRadius: '0.375rem',
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '3rem',
        },
      },
      responsive: {
        breakpoints: {
          mobile: '640px',
          tablet: '768px',
          desktop: '1024px',
          wide: '1280px',
        },
      },
    };
  }

  /**
   * Thème moderne
   */
  private getModernTheme(): ThemeConfig {
    return {
      name: 'modern',
      colors: {
        primary: '#8b5cf6',
        secondary: '#64748b',
        accent: '#06b6d4',
        background: '#fafafa',
        surface: '#ffffff',
        text: '#0f172a',
        textSecondary: '#64748b',
      },
      typography: {
        fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          md: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
        },
      },
      layout: {
        borderRadius: '0.75rem',
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '3rem',
        },
      },
      responsive: {
        breakpoints: {
          mobile: '640px',
          tablet: '768px',
          desktop: '1024px',
          wide: '1280px',
        },
      },
    };
  }
}
