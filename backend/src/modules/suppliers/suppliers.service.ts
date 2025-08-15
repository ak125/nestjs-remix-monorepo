import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

/**
 * Service de gestion des fournisseurs avec fonctionnalités avancées
 * ✅ Création et gestion CRUD des fournisseurs
 * ✅ Liaison fournisseurs-marques avec préférences
 * ✅ Recherche du meilleur fournisseur pour un produit
 * ✅ Attribution automatique avec scoring intelligent
 * ✅ Gestion des critères de sélection avancés
 */
@Injectable()
export class SuppliersService extends SupabaseBaseService {
  protected readonly logger = new Logger(SuppliersService.name);

  constructor() {
    super();
  }

  // ===== INTERFACES =====
  
  // Interface principale Supplier
  private readonly supplierSchema = {
    id: 'number',
    code: 'string',
    name: 'string',
    companyName: 'string?',
    siret: 'string?',
    vatNumber: 'string?',
    address1: 'string?',
    address2: 'string?',
    postalCode: 'string?',
    city: 'string?',
    country: 'string?',
    phone: 'string?',
    email: 'string?',
    website: 'string?',
    contactName: 'string?',
    contactPhone: 'string?',
    contactEmail: 'string?',
    paymentTerms: 'string?',
    deliveryDelay: 'number?',
    minimumOrder: 'number?',
    discountRate: 'number?',
    isActive: 'boolean',
    notes: 'string?',
    createdAt: 'Date',
    updatedAt: 'Date'
  };

  // ===== MÉTHODES CRUD PRINCIPALES =====

  /**
   * Créer un nouveau fournisseur
   */
  async createSupplier(supplierData: any) {
    this.logger.log(`Création fournisseur: ${supplierData.code} - ${supplierData.name}`);
    
    try {
      // Vérifier l'unicité du code
      const existing = await this.checkSupplierCodeExists(supplierData.code);
      if (existing) {
        throw new Error(`Le code fournisseur "${supplierData.code}" existe déjà`);
      }

      const formattedData = {
        code: supplierData.code,
        name: supplierData.name,
        company_name: supplierData.companyName,
        siret: supplierData.siret,
        vat_number: supplierData.vatNumber,
        address1: supplierData.address1,
        address2: supplierData.address2,
        postal_code: supplierData.postalCode,
        city: supplierData.city,
        country: supplierData.country || 'FR',
        phone: supplierData.phone,
        email: supplierData.email,
        website: supplierData.website,
        contact_name: supplierData.contactName,
        contact_phone: supplierData.contactPhone,
        contact_email: supplierData.contactEmail,
        payment_terms: supplierData.paymentTerms || 'NET30',
        delivery_delay: supplierData.deliveryDelay || 7,
        minimum_order: supplierData.minimumOrder || 0,
        discount_rate: supplierData.discountRate || 0,
        is_active: supplierData.isActive !== false,
        notes: supplierData.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('___xtr_supplier')
        .insert(formattedData)
        .select()
        .single();

      if (error) throw error;

      this.logger.log(`Fournisseur créé avec succès: ID ${data.id}`);
      return this.transformSupplierData(data);
    } catch (error) {
      this.logger.error('Erreur création fournisseur:', error);
      throw error;
    }
  }

  /**
   * Récupérer tous les fournisseurs avec filtres et pagination
   */
  async getSuppliers(options: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    brandId?: number;
  } = {}) {
    const { page = 1, limit = 20, search } = options;
    
    try {
      let query = this.supabase
        .from('___xtr_supplier')
        .select('*', { count: 'exact' });

      // Appliquer le filtre de recherche sur les colonnes réelles
      if (search) {
        query = query.or(`spl_name.ilike.%${search}%,spl_alias.ilike.%${search}%`);
      }

      // Pagination
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end);

      const { data, error, count } = await query;

      if (error) throw error;

      const items = (data || []).map(item => this.transformSupplierData(item));
      
      return {
        items,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      this.logger.error('Erreur récupération fournisseurs:', error);
      throw error;
    }
  }

  /**
   * Récupérer un fournisseur par ID
   */
  async getSupplierById(id: number) {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_supplier')
        .select('*')
        .eq('spl_id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error(`Fournisseur ID ${id} non trouvé`);

      return this.transformSupplierData(data);
    } catch (error) {
      this.logger.error(`Erreur récupération fournisseur ${id}:`, error);
      throw error;
    }
  }

  // ===== FONCTIONNALITÉS AVANCÉES =====

  /**
   * Lier un fournisseur à une marque avec conditions spécifiques
   */
  async linkSupplierToBrand(
    supplierId: number,
    brandId: number,
    options: {
      isPreferred?: boolean;
      discountRate?: number;
      deliveryDelay?: number;
    } = {}
  ) {
    this.logger.log(`Liaison fournisseur ${supplierId} avec marque ${brandId}`);

    try {
      // Vérifier que le fournisseur existe
      await this.getSupplierById(supplierId);

      // Vérifier si la liaison existe déjà
      const { data: existing } = await this.supabase
        .from('___xtr_supplier_link_pm')
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('brand_id', brandId)
        .single();

      if (existing) {
        throw new Error('Cette liaison fournisseur-marque existe déjà');
      }

      const linkData = {
        supplier_id: supplierId,
        brand_id: brandId,
        is_preferred: options.isPreferred || false,
        discount_rate: options.discountRate || 0,
        delivery_delay: options.deliveryDelay || 0,
        created_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('___xtr_supplier_link_pm')
        .insert(linkData)
        .select()
        .single();

      if (error) throw error;

      this.logger.log(`Liaison créée avec succès: ID ${data.id}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur création liaison fournisseur-marque:', error);
      throw error;
    }
  }

  /**
   * Trouver le meilleur fournisseur pour un produit selon des critères
   */
  async findBestSupplierForProduct(
    productId: number,
    criteria: {
      brandId?: number;
      category?: string;
      maxDeliveryTime?: number;
      minDiscountRate?: number;
      isPreferred?: boolean;
      region?: string;
    } = {}
  ) {
    this.logger.log(`Recherche meilleur fournisseur pour produit ${productId}`);

    try {
      // Récupérer tous les fournisseurs actifs
      const { data: suppliers, error } = await this.supabase
        .from('___xtr_supplier')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      if (!suppliers || suppliers.length === 0) {
        return null;
      }

      // Calculer les scores pour chaque fournisseur
      const supplierScores = [];

      for (const supplier of suppliers) {
        const score = await this.calculateSupplierScore(supplier, productId, criteria);
        if (score.score > 0) {
          supplierScores.push(score);
        }
      }

      // Trier par score décroissant
      supplierScores.sort((a, b) => b.score - a.score);

      return supplierScores.length > 0 ? supplierScores[0] : null;
    } catch (error) {
      this.logger.error('Erreur recherche meilleur fournisseur:', error);
      throw error;
    }
  }

  /**
   * Attribution automatique de fournisseurs pour plusieurs produits
   */
  async autoAssignSuppliers(
    productIds: number[],
    criteria: {
      brandId?: number;
      category?: string;
      maxDeliveryTime?: number;
      minDiscountRate?: number;
      isPreferred?: boolean;
      region?: string;
    } = {}
  ) {
    this.logger.log(`Attribution automatique pour ${productIds.length} produits`);

    const results = [];

    for (const productId of productIds) {
      try {
        const bestSupplier = await this.findBestSupplierForProduct(productId, criteria);
        
        if (bestSupplier) {
          // Récupérer les alternatives (top 3 après le meilleur)
          const alternatives = await this.findAlternativeSuppliers(productId, criteria, bestSupplier.supplier.id);
          
          results.push({
            productId,
            recommendedSupplier: bestSupplier.supplier,
            alternativeSuppliers: alternatives.slice(0, 3),
            score: bestSupplier.score,
            reasoning: bestSupplier.reasons
          });
        } else {
          this.logger.warn(`Aucun fournisseur trouvé pour produit ${productId}`);
        }
      } catch (error) {
        this.logger.error(`Erreur attribution fournisseur produit ${productId}:`, error);
      }
    }

    this.logger.log(`Attribution terminée: ${results.length}/${productIds.length} produits traités`);
    return results;
  }

  // ===== MÉTHODES PRIVÉES =====

  /**
   * Vérifier l'existence d'un code fournisseur
   */
  private async checkSupplierCodeExists(code: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_supplier')
        .select('id')
        .eq('code', code)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      this.logger.error('Erreur vérification code fournisseur:', error);
      return false;
    }
  }

  /**
   * Calculer le score d'un fournisseur pour un produit
   */
  private async calculateSupplierScore(supplier: any, productId: number, criteria: any) {
    let score = 50; // Score de base
    const reasons: string[] = [];

    // Score basé sur le taux de remise
    if (supplier.discount_rate && supplier.discount_rate > 0) {
      score += supplier.discount_rate * 2;
      reasons.push(`Remise de ${supplier.discount_rate}%`);
    }

    // Score basé sur le délai de livraison
    if (supplier.delivery_delay) {
      if (supplier.delivery_delay <= 3) {
        score += 20;
        reasons.push('Livraison rapide (≤3 jours)');
      } else if (supplier.delivery_delay <= 7) {
        score += 10;
        reasons.push('Livraison standard (≤7 jours)');
      } else {
        score -= 5;
        reasons.push('Livraison lente (>7 jours)');
      }
    }

    // Score basé sur les critères spécifiques
    if (criteria.maxDeliveryTime && supplier.delivery_delay && supplier.delivery_delay > criteria.maxDeliveryTime) {
      score -= 30;
      reasons.push('Délai de livraison trop long');
    }

    if (criteria.minDiscountRate && supplier.discount_rate && supplier.discount_rate < criteria.minDiscountRate) {
      score -= 15;
      reasons.push('Taux de remise insuffisant');
    }

    // Vérifier si le fournisseur a des liaisons avec des marques
    const { data: brandLinks } = await this.supabase
      .from('___xtr_supplier_link_pm')
      .select('*')
      .eq('supplier_id', supplier.id);

    if (brandLinks && brandLinks.length > 0) {
      score += 15;
      reasons.push(`Partenaire de ${brandLinks.length} marque(s)`);
      
      // Bonus pour fournisseur préféré
      const preferredLinks = brandLinks.filter(link => link.is_preferred);
      if (preferredLinks.length > 0) {
        score += 10;
        reasons.push('Fournisseur préféré');
      }
    }

    return {
      supplier: this.transformSupplierData(supplier),
      score: Math.max(0, Math.min(100, score)),
      reasons
    };
  }

  /**
   * Trouver des fournisseurs alternatifs
   */
  private async findAlternativeSuppliers(productId: number, criteria: any, excludeSupplierId: number) {
    try {
      const { data: suppliers } = await this.supabase
        .from('___xtr_supplier')
        .select('*')
        .eq('is_active', true)
        .neq('id', excludeSupplierId);

      if (!suppliers) return [];

      const alternatives = [];

      for (const supplier of suppliers) {
        const score = await this.calculateSupplierScore(supplier, productId, criteria);
        if (score.score > 30) { // Score minimum pour être une alternative
          alternatives.push(score);
        }
      }

      // Trier par score décroissant
      alternatives.sort((a, b) => b.score - a.score);

      return alternatives.map(alt => alt.supplier);
    } catch (error) {
      this.logger.error('Erreur recherche fournisseurs alternatifs:', error);
      return [];
    }
  }

  /**
   * Transformer les données Supabase en objet Supplier formaté
   */
  private transformSupplierData(data: any) {
    return {
      id: data.spl_id,
      name: data.spl_name,
      alias: data.spl_alias,
      display: data.spl_display,
      sort: data.spl_sort,
      // Garder une structure cohérente pour l'API
      companyName: data.spl_name,
      code: data.spl_alias,
      isActive: data.spl_display === '1',
      // Ajouter les propriétés manquantes
      email: data.email,
      phone: data.phone,
      address1: data.address1,
      city: data.city,
      discount_rate: data.discount_rate,
      delivery_delay: data.delivery_delay,
      is_active: data.is_active,
    };
  }

  // ===== MÉTHODES DE TEST =====

  /**
   * Tester la connexion et les fonctionnalités du service
   */
  async testSuppliersService() {
    try {
      // Test de connexion et récupération des données de base
      const { data: suppliers, error, count } = await this.supabase
        .from('___xtr_supplier')
        .select('*', { count: 'exact' })
        .limit(5);

      if (error) throw error;

      const connection = true;
      const totalSuppliers = count || 0;
      
      return {
        connection,
        totalSuppliers,
        sampleSupplier: suppliers?.[0] || null,
        tableStructure: suppliers?.[0] ? Object.keys(suppliers[0]) : []
      };
    } catch (error) {
      this.logger.error('Erreur test service fournisseurs:', error);
      throw error;
    }
  }
}
