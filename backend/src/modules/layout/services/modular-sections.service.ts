/**
 * 🧩 MODULAR SECTIONS SERVICE
 * Service pour gérer les sections modulaires et réutilisables
 */

import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';

export interface ModularSection {
  id: string;
  name: string;
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'content' | 'gallery';
  category: 'core' | 'massdoc' | 'shared';
  template: string;
  props: any;
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

export interface SectionTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  component: string;
  defaultProps: any;
  requiredProps: string[];
  preview: string;
}

@Injectable()
export class ModularSectionsService {
  private readonly logger = new Logger(ModularSectionsService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Récupère les sections pour un contexte donné
   */
  async getSectionsForContext(
    context: string,
    page?: string,
    userRole?: string,
  ): Promise<ModularSection[]> {
    const cacheKey = `sections:${context}:${page || 'all'}:${userRole || 'anonymous'}`;

    try {
      const cached = await this.cacheService.get<ModularSection[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // Simuler récupération depuis base
      const allSections = await this.getAllSections();
      const filteredSections = allSections.filter((section) =>
        this.matchesConditions(section, context, page, userRole),
      );

      // Trier par position
      filteredSections.sort((a, b) => a.position - b.position);

      await this.cacheService.set(cacheKey, filteredSections, 900);
      return filteredSections;
    } catch (error) {
      this.logger.error('Erreur getSectionsForContext:', error);
      return [];
    }
  }

  /**
   * Récupère une section par ID
   */
  async getSectionById(id: string): Promise<ModularSection | null> {
    const cacheKey = `section:${id}`;

    try {
      const cached = await this.cacheService.get<ModularSection>(cacheKey);
      if (cached) {
        return cached;
      }

      const allSections = await this.getAllSections();
      const section = allSections.find((s) => s.id === id);

      if (section) {
        await this.cacheService.set(cacheKey, section, 1800);
      }

      return section || null;
    } catch (error) {
      this.logger.error('Erreur getSectionById:', error);
      return null;
    }
  }

  /**
   * Sauvegarde une section
   */
  async saveSection(
    section: Partial<ModularSection>,
  ): Promise<ModularSection | null> {
    try {
      // Ici on sauvegarderait en base
      const savedSection = {
        ...section,
        id: section.id || Date.now().toString(),
      } as ModularSection;

      await this.invalidateCache();
      this.logger.log(`Section ${savedSection.name} sauvegardée`);

      return savedSection;
    } catch (error) {
      this.logger.error('Erreur saveSection:', error);
      return null;
    }
  }

  /**
   * Récupère les templates disponibles
   */
  async getAvailableTemplates(): Promise<SectionTemplate[]> {
    return this.getDefaultTemplates();
  }

  /**
   * Invalide le cache des sections
   */
  async invalidateCache(context?: string): Promise<void> {
    try {
      if (context) {
        // Invalider le cache pour un contexte spécifique
        await this.cacheService.del(`sections:${context}:*`);
      } else {
        // Invalider tout le cache des sections
        await this.cacheService.del('sections:*');
      }
    } catch (error) {
      this.logger.error('Erreur invalidateCache:', error);
    }
  }

  /**
   * Vérifie si une section correspond aux conditions
   */
  private matchesConditions(
    section: ModularSection,
    context: string,
    page?: string,
    userRole?: string,
  ): boolean {
    if (!section.is_active) {
      return false;
    }

    // Vérifier les contextes
    if (
      section.conditions.contexts &&
      !section.conditions.contexts.includes(context)
    ) {
      return false;
    }

    // Vérifier les pages
    if (
      page &&
      section.conditions.pages &&
      !section.conditions.pages.includes(page)
    ) {
      return false;
    }

    // Vérifier les rôles
    if (
      userRole &&
      section.conditions.userRoles &&
      !section.conditions.userRoles.includes(userRole)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Récupère toutes les sections (simulation)
   */
  private async getAllSections(): Promise<ModularSection[]> {
    return [
      {
        id: 'hero-core-1',
        name: 'Hero Core Dashboard',
        type: 'hero',
        category: 'core',
        template: 'HeroMinimal',
        props: {
          title: 'Bienvenue dans Core',
          subtitle: 'Votre système de gestion centralisé',
          action: { text: 'Commencer', href: '/core/dashboard' },
        },
        styles: {
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          textColor: 'white',
          spacing: 'normal',
        },
        conditions: {
          contexts: ['core'],
          pages: ['dashboard', 'home'],
        },
        position: 1,
        is_active: true,
      },
      {
        id: 'hero-massdoc-1',
        name: 'Hero Massdoc',
        type: 'hero',
        category: 'massdoc',
        template: 'HeroExtended',
        props: {
          title: 'Massdoc Solutions',
          subtitle: 'Votre partenaire pour la documentation technique',
          features: ['Catalogue complet', 'Support expert', 'Livraison rapide'],
          action: { text: 'Découvrir', href: '/massdoc/catalogue' },
          image: '/images/massdoc-hero.jpg',
        },
        styles: {
          background: '#f8fafc',
          textColor: '#1f2937',
          spacing: 'relaxed',
        },
        conditions: {
          contexts: ['massdoc'],
          pages: ['home', 'catalogue'],
        },
        position: 1,
        is_active: true,
      },
      {
        id: 'features-core-1',
        name: 'Fonctionnalités Core',
        type: 'features',
        category: 'core',
        template: 'FeaturesGrid',
        props: {
          title: 'Fonctionnalités principales',
          features: [
            {
              icon: 'document',
              title: 'Gestion de documents',
              description: 'Organisez et gérez vos documents facilement',
            },
            {
              icon: 'users',
              title: 'Gestion des utilisateurs',
              description: 'Contrôlez les accès et permissions',
            },
            {
              icon: 'analytics',
              title: 'Analytics',
              description: 'Suivez les performances en temps réel',
            },
          ],
        },
        styles: {
          spacing: 'normal',
        },
        conditions: {
          contexts: ['core'],
        },
        position: 2,
        is_active: true,
      },
      {
        id: 'cta-shared-1',
        name: 'CTA Contact',
        type: 'cta',
        category: 'shared',
        template: 'CTASimple',
        props: {
          title: "Besoin d'aide ?",
          subtitle: 'Notre équipe est là pour vous accompagner',
          action: { text: 'Nous contacter', href: '/contact' },
        },
        styles: {
          background: '#059669',
          textColor: 'white',
          spacing: 'tight',
        },
        conditions: {
          contexts: ['core', 'massdoc'],
        },
        position: 10,
        is_active: true,
      },
    ];
  }

  /**
   * Templates par défaut
   */
  private getDefaultTemplates(): SectionTemplate[] {
    return [
      {
        id: 'hero-minimal',
        name: 'Hero Minimal',
        description: 'Section hero simple avec titre, sous-titre et bouton',
        type: 'hero',
        component: 'HeroMinimal',
        defaultProps: {
          title: 'Titre principal',
          subtitle: 'Sous-titre descriptif',
          action: { text: 'Action', href: '#' },
        },
        requiredProps: ['title'],
        preview: '/previews/hero-minimal.jpg',
      },
      {
        id: 'hero-extended',
        name: 'Hero Extended',
        description:
          'Section hero complète avec image et liste de fonctionnalités',
        type: 'hero',
        component: 'HeroExtended',
        defaultProps: {
          title: 'Titre principal',
          subtitle: 'Sous-titre descriptif',
          features: [],
          action: { text: 'Action', href: '#' },
          image: '',
        },
        requiredProps: ['title'],
        preview: '/previews/hero-extended.jpg',
      },
      {
        id: 'features-grid',
        name: 'Grille de fonctionnalités',
        description: 'Affichage des fonctionnalités en grille',
        type: 'features',
        component: 'FeaturesGrid',
        defaultProps: {
          title: 'Fonctionnalités',
          features: [],
        },
        requiredProps: ['features'],
        preview: '/previews/features-grid.jpg',
      },
      {
        id: 'cta-simple',
        name: 'Call to Action Simple',
        description: 'Section CTA avec titre et bouton',
        type: 'cta',
        component: 'CTASimple',
        defaultProps: {
          title: 'Titre CTA',
          subtitle: '',
          action: { text: 'Action', href: '#' },
        },
        requiredProps: ['title', 'action'],
        preview: '/previews/cta-simple.jpg',
      },
    ];
  }
}
