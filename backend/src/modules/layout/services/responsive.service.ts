import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';

export interface ResponsiveConfig {
  device: 'mobile' | 'tablet' | 'desktop' | 'wide';
  breakpoint: string;
  layout: {
    columns: number;
    gridGap: string;
    maxWidth: string;
    padding: string;
  };
  components: {
    header: {
      height: string;
      logoSize: string;
      navigationDisplay: 'full' | 'collapsed' | 'hamburger';
    };
    sidebar: {
      width: string;
      display: 'visible' | 'collapsed' | 'hidden';
    };
    content: {
      padding: string;
      fontSize: string;
    };
    footer: {
      layout: 'full' | 'stacked' | 'minimal';
    };
  };
  typography: {
    scale: number;
    lineHeight: number;
  };
}

@Injectable()
export class ResponsiveService {
  private readonly logger = new Logger(ResponsiveService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Obtient la configuration responsive basée sur la largeur d'écran
   */
  async getResponsiveConfig(width: number): Promise<ResponsiveConfig> {
    try {
      const device = this.detectDevice(width);
      const cacheKey = `responsive_${device}`;
      const cached = await this.cacheService.get<ResponsiveConfig>(cacheKey);

      if (cached) {
        this.logger.debug(`Responsive config cache hit for: ${device}`);
        return cached;
      }

      const config = this.generateResponsiveConfig(device);
      await this.cacheService.set(cacheKey, config, 3600); // 1 heure

      return config;
    } catch (error) {
      this.logger.error(
        `Error getting responsive config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return this.generateResponsiveConfig('desktop');
    }
  }

  /**
   * Obtient toutes les configurations responsive
   */
  async getAllResponsiveConfigs(): Promise<Record<string, ResponsiveConfig>> {
    const devices: Array<'mobile' | 'tablet' | 'desktop' | 'wide'> = [
      'mobile',
      'tablet',
      'desktop',
      'wide',
    ];

    const configs: Record<string, ResponsiveConfig> = {};

    for (const device of devices) {
      configs[device] = this.generateResponsiveConfig(device);
    }

    return configs;
  }

  /**
   * Détecte le type d'appareil basé sur la largeur
   */
  private detectDevice(
    width: number,
  ): 'mobile' | 'tablet' | 'desktop' | 'wide' {
    if (width < 640) return 'mobile';
    if (width < 768) return 'tablet';
    if (width < 1280) return 'desktop';
    return 'wide';
  }

  /**
   * Génère la configuration responsive pour un appareil
   */
  private generateResponsiveConfig(
    device: 'mobile' | 'tablet' | 'desktop' | 'wide',
  ): ResponsiveConfig {
    const configs = {
      mobile: this.getMobileConfig(),
      tablet: this.getTabletConfig(),
      desktop: this.getDesktopConfig(),
      wide: this.getWideConfig(),
    };

    return configs[device];
  }

  /**
   * Configuration mobile
   */
  private getMobileConfig(): ResponsiveConfig {
    return {
      device: 'mobile',
      breakpoint: '640px',
      layout: {
        columns: 1,
        gridGap: '0.5rem',
        maxWidth: '100%',
        padding: '1rem',
      },
      components: {
        header: {
          height: '3.5rem',
          logoSize: '1.5rem',
          navigationDisplay: 'hamburger',
        },
        sidebar: {
          width: '100%',
          display: 'hidden',
        },
        content: {
          padding: '1rem',
          fontSize: '0.875rem',
        },
        footer: {
          layout: 'stacked',
        },
      },
      typography: {
        scale: 0.9,
        lineHeight: 1.5,
      },
    };
  }

  /**
   * Configuration tablette
   */
  private getTabletConfig(): ResponsiveConfig {
    return {
      device: 'tablet',
      breakpoint: '768px',
      layout: {
        columns: 2,
        gridGap: '1rem',
        maxWidth: '100%',
        padding: '1.5rem',
      },
      components: {
        header: {
          height: '4rem',
          logoSize: '1.75rem',
          navigationDisplay: 'collapsed',
        },
        sidebar: {
          width: '16rem',
          display: 'collapsed',
        },
        content: {
          padding: '1.5rem',
          fontSize: '1rem',
        },
        footer: {
          layout: 'stacked',
        },
      },
      typography: {
        scale: 0.95,
        lineHeight: 1.6,
      },
    };
  }

  /**
   * Configuration desktop
   */
  private getDesktopConfig(): ResponsiveConfig {
    return {
      device: 'desktop',
      breakpoint: '1024px',
      layout: {
        columns: 3,
        gridGap: '1.5rem',
        maxWidth: '1200px',
        padding: '2rem',
      },
      components: {
        header: {
          height: '4.5rem',
          logoSize: '2rem',
          navigationDisplay: 'full',
        },
        sidebar: {
          width: '18rem',
          display: 'visible',
        },
        content: {
          padding: '2rem',
          fontSize: '1rem',
        },
        footer: {
          layout: 'full',
        },
      },
      typography: {
        scale: 1,
        lineHeight: 1.6,
      },
    };
  }

  /**
   * Configuration grand écran
   */
  private getWideConfig(): ResponsiveConfig {
    return {
      device: 'wide',
      breakpoint: '1280px',
      layout: {
        columns: 4,
        gridGap: '2rem',
        maxWidth: '1400px',
        padding: '3rem',
      },
      components: {
        header: {
          height: '5rem',
          logoSize: '2.25rem',
          navigationDisplay: 'full',
        },
        sidebar: {
          width: '20rem',
          display: 'visible',
        },
        content: {
          padding: '3rem',
          fontSize: '1.125rem',
        },
        footer: {
          layout: 'full',
        },
      },
      typography: {
        scale: 1.1,
        lineHeight: 1.7,
      },
    };
  }
}
