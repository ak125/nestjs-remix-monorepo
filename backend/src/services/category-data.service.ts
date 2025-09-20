/**
 * 🗂️ SERVICE CATÉGORIE BACKEND
 * 
 * Service principal pour récupérer toutes les données d'une page de catégorie
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  CategoryPageData, 
  CategoryQueryParams,
  CategoryBaseData,
  VehicleSelectorData,
  CategoryArticleData,
  RelatedCategoryData,
  PopularMotorizationData,
  EquipmentierData,
  TechnicalInfoData
} from '../types/category-data.types';

@Injectable()
export class CategoryDataService {
  
  constructor(
    // TODO: Injecter les repositories TypeORM quand les entités seront créées
    // @InjectRepository(Category) private categoryRepo: Repository<Category>,
    // @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    // @InjectRepository(Article) private articleRepo: Repository<Article>,
    // @InjectRepository(Brand) private brandRepo: Repository<Brand>,
  ) {}

  /**
   * 🎯 MÉTHODE PRINCIPALE - Récupère toutes les données pour une page de catégorie
   */
  async getCategoryPageData(params: CategoryQueryParams): Promise<CategoryPageData> {
    console.log(`📊 Récupération des données pour la catégorie: ${params.slug}`);
    
    // 1. 🔍 Récupération de la catégorie de base
    const category = await this.getCategoryBase(params.slug);
    
    if (!category) {
      throw new NotFoundException(`Catégorie non trouvée: ${params.slug}`);
    }

    // 2. 🚗 Données en parallèle pour optimiser les performances
    const [
      vehicleSelector,
      article,
      relatedCategories,
      popularMotorizations,
      equipmentiers,
      technicalInfo,
      stats
    ] = await Promise.all([
      this.getVehicleSelectorData(category.id),
      params.includeRelated ? this.getCategoryArticle(category.id) : null,
      params.includeRelated ? this.getRelatedCategories(category.id) : [],
      params.includeMotorizations ? this.getPopularMotorizations(category.id, params.limit, params.offset) : [],
      params.includeEquipmentiers ? this.getEquipementiers(category.id) : [],
      params.includeTechnicalInfo ? this.getTechnicalInfo(category.id) : [],
      params.includeStats ? this.getCategoryStats(category.id) : null,
    ]);

    // 3. 🔗 Construction de l'objet de réponse complet
    const categoryPageData: CategoryPageData = {
      category,
      vehicleSelector,
      article: article || undefined,
      relatedCategories,
      popularMotorizations,
      equipmentiers,
      technicalInfo,
      seo: this.buildSeoData(category),
      stats: stats || undefined,
    };

    console.log(`✅ Données récupérées avec succès pour ${category.name}`);
    return categoryPageData;
  }

  /**
   * 🔍 Récupère les informations de base de la catégorie
   */
  private async getCategoryBase(slug: string): Promise<CategoryBaseData | null> {
    // TODO: Remplacer par vraie requête BDD
    // const category = await this.categoryRepo.findOne({ where: { slug } });
    
    // 🧪 DONNÉES MOCK pour développement
    if (slug === 'filtre-a-huile-7') {
      return {
        id: 'cat-filtre-huile-001',
        name: 'Filtre à huile',
        slug: 'filtre-a-huile-7',
        description: 'Le filtre à huile est un élément essentiel du système de lubrification du moteur. Il permet de filtrer les impuretés présentes dans l\'huile moteur pour protéger les pièces mécaniques.',
        shortDescription: 'Filtre à huile pour tous véhicules - Prix bas garantis',
        seoTitle: 'Filtre à huile pas cher | Automecanik',
        seoDescription: 'Trouvez votre filtre à huile au meilleur prix chez Automecanik. Large choix de marques premium. Livraison rapide.',
        image: 'https://example.com/images/filtre-huile.jpg',
      };
    }
    
    return null;
  }

  /**
   * 🚗 Récupère les données pour le sélecteur de véhicule
   */
  private async getVehicleSelectorData(categoryId: string): Promise<VehicleSelectorData> {
    // TODO: Requête BDD pour récupérer les marques compatibles
    
    // 🧪 DONNÉES MOCK
    return {
      brands: [
        { id: 'brand-renault', name: 'RENAULT' },
        { id: 'brand-peugeot', name: 'PEUGEOT' },
        { id: 'brand-citroen', name: 'CITROËN' },
        { id: 'brand-volkswagen', name: 'VOLKSWAGEN' },
        { id: 'brand-bmw', name: 'BMW' },
        { id: 'brand-mercedes', name: 'MERCEDES-BENZ' },
        { id: 'brand-audi', name: 'AUDI' },
        { id: 'brand-ford', name: 'FORD' },
      ],
      searchByTypemine: true,
    };
  }

  /**
   * 📰 Récupère l'article de blog associé à la catégorie
   */
  private async getCategoryArticle(categoryId: string): Promise<CategoryArticleData | null> {
    // TODO: Requête BDD pour l'article
    
    // 🧪 DONNÉES MOCK
    return {
      id: 'article-filtre-huile-001',
      title: 'Comment changer un filtre à huile',
      slug: 'comment-changer-filtre-huile',
      publishedAt: '2021-06-07',
      content: '<p>Le changement du filtre à huile est une opération de maintenance essentielle...</p>',
      excerpt: 'Apprenez à changer votre filtre à huile en quelques étapes simples avec nos conseils d\'experts.',
      readTime: 5,
    };
  }

  /**
   * 🔗 Récupère les catégories liées
   */
  private async getRelatedCategories(categoryId: string): Promise<RelatedCategoryData[]> {
    // TODO: Requête BDD pour les catégories liées
    
    // 🧪 DONNÉES MOCK
    return [
      {
        id: 'cat-filtre-air',
        name: 'Filtre à air',
        slug: 'filtre-a-air',
        description: 'Filtre à air moteur et habitacle',
        advice: 'Changez votre filtre à air tous les 20 000 km pour maintenir les performances de votre moteur.',
      },
      {
        id: 'cat-filtre-carburant',
        name: 'Filtre à carburant',
        slug: 'filtre-a-carburant',
        description: 'Filtre à carburant essence et diesel',
        advice: 'Le filtre à carburant protège votre système d\'injection. Remplacez-le selon les préconisations constructeur.',
      },
      {
        id: 'cat-bougies',
        name: 'Bougies d\'allumage',
        slug: 'bougies-allumage',
        description: 'Bougies d\'allumage pour moteurs essence',
        advice: 'Des bougies usées peuvent causer des ratés d\'allumage et une surconsommation.',
      },
    ];
  }

  /**
   * 🚗 Récupère les motorisations populaires
   */
  private async getPopularMotorizations(categoryId: string, limit: number, offset: number): Promise<PopularMotorizationData[]> {
    // TODO: Requête BDD avec pagination
    
    // 🧪 DONNÉES MOCK
    const allMotorizations = [
      {
        id: 'motor-clio-dci',
        brand: 'RENAULT',
        model: 'CLIO III',
        engine: '1.5 dCi',
        power: 86,
        unit: 'ch',
        pricePrefix: 'prix bas',
        symptoms: ['changer si encrassé', 'contrôler si témoin allumé'],
        description: 'Moteur diesel économique et fiable de Renault',
        productCount: 15,
      },
      {
        id: 'motor-308-hdi',
        brand: 'PEUGEOT',
        model: '308',
        engine: '1.6 HDi',
        power: 92,
        unit: 'ch',
        pricePrefix: 'tarif réduit',
        symptoms: ['vidange tous les 15 000 km', 'vérifier le niveau régulièrement'],
        description: 'Moteur HDi performant de Peugeot',
        productCount: 12,
      },
      {
        id: 'motor-golf-tdi',
        brand: 'VOLKSWAGEN',
        model: 'GOLF VI',
        engine: '1.6 TDI',
        power: 105,
        unit: 'ch',
        pricePrefix: 'meilleur prix',
        symptoms: ['changement préventif recommandé', 'qualité OEM conseillée'],
        description: 'Moteur TDI robuste de Volkswagen',
        productCount: 18,
      },
    ];
    
    return allMotorizations.slice(offset, offset + limit);
  }

  /**
   * 🏭 Récupère les équipementiers
   */
  private async getEquipementiers(categoryId: string): Promise<EquipementierData[]> {
    // TODO: Requête BDD pour les marques d'équipementiers
    
    // 🧪 DONNÉES MOCK
    return [
      {
        id: 'eq-bosch',
        name: 'BOSCH',
        description: 'Leader mondial des équipements automobiles, Bosch propose des filtres à huile de qualité OEM.',
        qualityLevel: 'OEM',
        technologies: ['Technologie MultiFlow', 'Papier filtrant haute performance'],
      },
      {
        id: 'eq-champion',
        name: 'CHAMPION',
        description: 'Marque reconnue pour ses filtres haute qualité et sa durabilité exceptionnelle.',
        qualityLevel: 'Premium',
        technologies: ['Filtration multicouches', 'Étanchéité renforcée'],
      },
      {
        id: 'eq-mann',
        name: 'MANN-FILTER',
        description: 'Spécialiste de la filtration automobile, fournisseur d\'origine de nombreux constructeurs.',
        qualityLevel: 'OEM',
        technologies: ['CompactBlue', 'FreciousPlus'],
      },
    ];
  }

  /**
   * 📚 Récupère les informations techniques
   */
  private async getTechnicalInfo(categoryId: string): Promise<TechnicalInfoData[]> {
    // TODO: Requête BDD pour les infos techniques
    
    // 🧪 DONNÉES MOCK
    return [
      {
        id: 'tech-role',
        title: 'Rôle du filtre à huile',
        content: 'Le filtre à huile retient les particules métalliques, la suie et autres impuretés présentes dans l\'huile moteur. Il protège ainsi les pièces en mouvement du moteur contre l\'usure prématurée.',
        order: 1,
        isMainInfo: true,
      },
      {
        id: 'tech-changement',
        title: 'Quand changer le filtre à huile ?',
        content: 'Le filtre à huile doit être changé à chaque vidange, soit généralement tous les 10 000 à 15 000 km selon le type de moteur et d\'huile utilisée.',
        order: 2,
        isMainInfo: true,
      },
      {
        id: 'tech-symptomes',
        title: 'Symptômes d\'un filtre usé',
        content: 'Un filtre à huile encrassé peut provoquer une baisse de pression d\'huile, des bruits moteur, une surchauffe ou l\'allumage du voyant d\'huile.',
        order: 3,
        isMainInfo: false,
      },
    ];
  }

  /**
   * 📊 Récupère les statistiques de la catégorie
   */
  private async getCategoryStats(categoryId: string) {
    // TODO: Requête BDD pour les stats
    
    // 🧪 DONNÉES MOCK
    return {
      totalProducts: 1250,
      totalBrands: 25,
      totalVehicles: 850,
      avgPrice: 15.99,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * 🔗 Construit les données SEO
   */
  private buildSeoData(category: CategoryBaseData) {
    return {
      canonicalUrl: `https://automecanik.com/pieces/${category.slug}.html`,
      breadcrumbs: [
        { name: 'Accueil', url: '/' },
        { name: 'Pièces auto', url: '/pieces' },
        { name: category.name, url: `/pieces/${category.slug}.html` },
      ],
    };
  }
}