/**
 * 🏗️ LAYOUT CONFIGURATION SERVICE
 * Service centralisé pour la gestion des configurations layout
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';

export interface LayoutConfigData {
  id: string;
  name: string;
  type: 'core' | 'massdoc' | 'admin' | 'commercial' | 'public';
  version: string;
  config: any;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class LayoutConfigurationService {
  private readonly logger = new Logger(LayoutConfigurationService.name);

  constructor(private readonly cacheService: CacheService) {}

  async getLayoutConfiguration(
    type: string,
    version: string = 'latest',
  ): Promise<LayoutConfigData | null> {
    const cacheKey = `layout_config:${type}:${version}`;

    try {
      const cached = await this.cacheService.get<LayoutConfigData>(cacheKey);
      if (cached) {
        return cached;
      }

      // Simuler récupération depuis base
      const config = await this.getDefaultConfiguration(type);
      await this.cacheService.set(cacheKey, config, 3600);
      return config;
    } catch (error) {
      this.logger.error(`Erreur getLayoutConfiguration:`, error);
      return await this.getDefaultConfiguration(type);
    }
  }

  async saveConfiguration(
    config: Partial<LayoutConfigData>,
  ): Promise<LayoutConfigData | null> {
    try {
      // Ici on pourrait sauvegarder en base
      await this.invalidateCache(config.type, config.version);
      return config as LayoutConfigData;
    } catch (error) {
      this.logger.error('Erreur saveConfiguration:', error);
      return null;
    }
  }

  async invalidateCache(type?: string, version?: string): Promise<void> {
    try {
      if (type && version) {
        await this.cacheService.del(`layout_config:${type}:${version}`);
      }
    } catch (error) {
      this.logger.error('Erreur invalidateCache:', error);
    }
  }

  private async getDefaultConfiguration(
    type: string,
  ): Promise<LayoutConfigData> {
    const coreConfig: LayoutConfigData = {
      id: 'core-default',
      name: 'Core Layout Default',
      type: 'core',
      version: '1.0',
      config: {
        header: {
          show: true,
          variant: 'minimal',
          logo: { src: '/logo-core.svg', alt: 'Core', link: '/core' },
          navigation: { show: true, style: 'horizontal', items: [] },
          search: { enabled: true, placeholder: 'Rechercher dans Core...' },
        },
        footer: { show: false, variant: 'minimal' },
        widgets: [],
        styles: { theme: 'light', primaryColor: '#3b82f6' },
        features: { darkMode: false, animations: false },
      },
      is_active: true,
    };

    const massdocConfig: LayoutConfigData = {
      id: 'massdoc-default',
      name: 'Massdoc Layout Default',
      type: 'massdoc',
      version: '1.0',
      config: {
        header: {
          show: true,
          variant: 'extended',
          logo: { src: '/logo-massdoc.svg', alt: 'Massdoc', link: '/massdoc' },
          navigation: { show: true, style: 'mega', items: [] },
          search: { enabled: true, placeholder: 'Rechercher dans Massdoc...' },
        },
        footer: { show: true, variant: 'complete' },
        widgets: [],
        styles: { theme: 'light', primaryColor: '#059669' },
        features: { darkMode: true, animations: true },
      },
      is_active: true,
    };

    return type === 'massdoc' ? massdocConfig : coreConfig;
  }
}
