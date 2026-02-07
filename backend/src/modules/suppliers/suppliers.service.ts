import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '../../common/exceptions';

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
    updatedAt: 'Date',
  };

  // ===== MÉTHODES CRUD PRINCIPALES =====

  /**
   * Créer un nouveau fournisseur
   */
  async createSupplier(supplierData: any) {
    this.logger.log(
      `Création fournisseur: ${supplierData.code} - ${supplierData.name}`,
    );

    try {
      // Vérifier l'unicité du code
      const existing = await this.checkSupplierCodeExists(supplierData.code);
      if (existing) {
        throw new DatabaseException({
          code: ErrorCodes.SUPPLIER.UPDATE_FAILED,
          message: `Le code fournisseur "${supplierData.code}" existe déjà`,
        });
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
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from(TABLES.xtr_supplier)
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
  async getSuppliers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      brandId?: number;
    } = {},
  ) {
    const { page = 1, limit = 20, search } = options;

    try {
      let query = this.supabase
        .from(TABLES.xtr_supplier)
        .select('*', { count: 'exact' });

      // Appliquer le filtre de recherche sur les colonnes réelles
      if (search) {
        query = query.or(
          `spl_name.ilike.%${search}%,spl_alias.ilike.%${search}%`,
        );
      }

      // Pagination
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end);

      const { data, error, count } = await query;

      if (error) throw error;

      const items = (data || []).map((item) =>
        this.transformSupplierData(item),
      );

      return {
        items,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      };
    } catch (error) {
      this.logger.error('Erreur récupération fournisseurs:', error);
      throw error;
    }
  }

  /**
   * Récupérer un fournisseur par ID
   */
  async getSupplierById(id: string | number) {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_supplier)
        .select('*')
        .eq('spl_id', id.toString())
        .single();

      if (error) throw error;
      if (!data)
        throw new DatabaseException({
          code: ErrorCodes.SUPPLIER.FETCH_FAILED,
          message: `Fournisseur ID ${id} non trouvé`,
        });

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
    } = {},
  ) {
    this.logger.log(`Liaison fournisseur ${supplierId} avec marque ${brandId}`);

    try {
      // Vérifier que le fournisseur existe
      await this.getSupplierById(supplierId);

      // Vérifier si la liaison existe déjà
      const { data: existing } = await this.supabase
        .from(TABLES.xtr_supplier_link_pm)
        .select('id')
        .eq('supplier_id', supplierId)
        .eq('brand_id', brandId)
        .single();

      if (existing) {
        throw new DatabaseException({
          code: ErrorCodes.SUPPLIER.UPDATE_FAILED,
          message: 'Cette liaison fournisseur-marque existe déjà',
        });
      }

      const linkData = {
        supplier_id: supplierId,
        brand_id: brandId,
        is_preferred: options.isPreferred || false,
        discount_rate: options.discountRate || 0,
        delivery_delay: options.deliveryDelay || 0,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from(TABLES.xtr_supplier_link_pm)
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
    } = {},
  ) {
    this.logger.log(`Recherche meilleur fournisseur pour produit ${productId}`);

    try {
      // Récupérer tous les fournisseurs actifs
      const { data: suppliers, error } = await this.supabase
        .from(TABLES.xtr_supplier)
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      if (!suppliers || suppliers.length === 0) {
        return null;
      }

      // Calculer les scores pour chaque fournisseur
      const supplierScores = [];

      for (const supplier of suppliers) {
        const score = await this.calculateSupplierScore(
          supplier,
          productId,
          criteria,
        );
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
    } = {},
  ) {
    this.logger.log(
      `Attribution automatique pour ${productIds.length} produits`,
    );

    const results = [];

    for (const productId of productIds) {
      try {
        const bestSupplier = await this.findBestSupplierForProduct(
          productId,
          criteria,
        );

        if (bestSupplier) {
          // Récupérer les alternatives (top 3 après le meilleur)
          const alternatives = await this.findAlternativeSuppliers(
            productId,
            criteria,
            bestSupplier.supplier.id,
          );

          results.push({
            productId,
            recommendedSupplier: bestSupplier.supplier,
            alternativeSuppliers: alternatives.slice(0, 3),
            score: bestSupplier.score,
            reasoning: bestSupplier.reasons,
          });
        } else {
          this.logger.warn(
            `Aucun fournisseur trouvé pour produit ${productId}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Erreur attribution fournisseur produit ${productId}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Attribution terminée: ${results.length}/${productIds.length} produits traités`,
    );
    return results;
  }

  // ===== MÉTHODES PRIVÉES =====

  /**
   * Vérifier l'existence d'un code fournisseur
   */
  private async checkSupplierCodeExists(code: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_supplier)
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
  private async calculateSupplierScore(
    supplier: any,
    productId: number,
    criteria: any,
  ) {
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
    if (
      criteria.maxDeliveryTime &&
      supplier.delivery_delay &&
      supplier.delivery_delay > criteria.maxDeliveryTime
    ) {
      score -= 30;
      reasons.push('Délai de livraison trop long');
    }

    if (
      criteria.minDiscountRate &&
      supplier.discount_rate &&
      supplier.discount_rate < criteria.minDiscountRate
    ) {
      score -= 15;
      reasons.push('Taux de remise insuffisant');
    }

    // Vérifier si le fournisseur a des liaisons avec des marques
    const { data: brandLinks } = await this.supabase
      .from(TABLES.xtr_supplier_link_pm)
      .select('*')
      .eq('supplier_id', supplier.id);

    if (brandLinks && brandLinks.length > 0) {
      score += 15;
      reasons.push(`Partenaire de ${brandLinks.length} marque(s)`);

      // Bonus pour fournisseur préféré
      const preferredLinks = brandLinks.filter((link) => link.is_preferred);
      if (preferredLinks.length > 0) {
        score += 10;
        reasons.push('Fournisseur préféré');
      }
    }

    return {
      supplier: this.transformSupplierData(supplier),
      score: Math.max(0, Math.min(100, score)),
      reasons,
    };
  }

  /**
   * Trouver des fournisseurs alternatifs
   */
  private async findAlternativeSuppliers(
    productId: number,
    criteria: any,
    excludeSupplierId: number,
  ) {
    try {
      const { data: suppliers } = await this.supabase
        .from(TABLES.xtr_supplier)
        .select('*')
        .eq('is_active', true)
        .neq('id', excludeSupplierId);

      if (!suppliers) return [];

      const alternatives = [];

      for (const supplier of suppliers) {
        const score = await this.calculateSupplierScore(
          supplier,
          productId,
          criteria,
        );
        if (score.score > 30) {
          // Score minimum pour être une alternative
          alternatives.push(score);
        }
      }

      // Trier par score décroissant
      alternatives.sort((a, b) => b.score - a.score);

      return alternatives.map((alt) => alt.supplier);
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
   * Générer un bon de commande fournisseur
   */
  async generatePurchaseOrder(supplierId: number, items: any[]): Promise<any> {
    this.logger.log(
      `Génération bon de commande pour fournisseur ${supplierId}`,
    );

    try {
      const supplier = await this.getSupplierById(supplierId);

      const purchaseOrder = {
        supplier,
        items,
        subtotal: 0,
        discount: 0,
        total: 0,
        generatedAt: new Date(),
        reference: `PO-${supplier.code}-${Date.now()}`,
      };

      // Calculer les totaux
      items.forEach((item) => {
        const lineTotal = item.quantity * (item.purchasePrice || 0);
        purchaseOrder.subtotal += lineTotal;
      });

      // Appliquer la remise si configurée
      if (supplier.discount_rate && supplier.discount_rate > 0) {
        purchaseOrder.discount =
          purchaseOrder.subtotal * (supplier.discount_rate / 100);
      }

      purchaseOrder.total = purchaseOrder.subtotal - purchaseOrder.discount;

      this.logger.log(
        `Bon de commande généré: ${purchaseOrder.reference} - Total: ${purchaseOrder.total}€`,
      );

      return purchaseOrder;
    } catch (error) {
      this.logger.error('Erreur génération bon de commande:', error);
      throw error;
    }
  }

  /**
   * Obtenir les fournisseurs d'un produit avec scoring
   */
  async getProductSuppliers(productId: string): Promise<any[]> {
    this.logger.log(`Recherche fournisseurs pour produit ${productId}`);

    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_supplier_link_pm)
        .select(
          `
          *,
          supplier:___xtr_supplier!inner(*)
        `,
        )
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('is_preferred', { ascending: false });

      if (error) throw error;

      return (data || []).map((link) => ({
        ...this.transformSupplierData(link.supplier),
        linkInfo: {
          isPreferred: link.is_preferred,
          deliveryDelay: link.delivery_delay,
          discountRate: link.discount_rate,
        },
      }));
    } catch (error) {
      this.logger.error('Erreur récupération fournisseurs produit:', error);
      throw error;
    }
  }

  /**
   * Désactiver un fournisseur et ses liaisons
   */
  async deactivateSupplier(id: number): Promise<void> {
    this.logger.log(`Désactivation fournisseur ${id}`);

    try {
      // Désactiver le fournisseur
      const { error: supplierError } = await this.supabase
        .from(TABLES.xtr_supplier)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('spl_id', id);

      if (supplierError) throw supplierError;

      // Désactiver ses liaisons
      const { error: linkError } = await this.supabase
        .from(TABLES.xtr_supplier_link_pm)
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('supplier_id', id);

      if (linkError) throw linkError;

      this.logger.log(`Fournisseur ${id} désactivé avec succès`);
    } catch (error) {
      this.logger.error('Erreur désactivation fournisseur:', error);
      throw error;
    }
  }

  /**
   * Obtenir les liens (marques/articles) d'un fournisseur
   */
  async getSupplierLinks(supplierId: string | number) {
    this.logger.log(`Récupération des liens pour fournisseur ${supplierId}`);

    try {
      // D'abord récupérer les liens
      const { data: linksData, error: linksError } = await this.supabase
        .from(TABLES.xtr_supplier_link_pm)
        .select('*')
        .eq('slpm_spl_id', supplierId.toString())
        .limit(50);

      if (linksError) {
        this.logger.error('Erreur accès table liens:', linksError);
        return [];
      }

      if (!linksData || linksData.length === 0) {
        return [];
      }

      // BATCH 1: Collecter tous les piece IDs uniques
      const pieceIds = [
        ...new Set(
          linksData
            .map((link) => parseInt(link.slpm_pm_id))
            .filter((id) => !isNaN(id)),
        ),
      ];

      // BATCH 1: Fetch all pieces in one query
      const pieceMap = new Map<
        number,
        {
          piece_id: number;
          piece_des: string;
          piece_ref: string;
          piece_name: string;
          piece_display: string;
          piece_pg_id: number;
        }
      >();
      if (pieceIds.length > 0) {
        const { data: piecesData } = await this.supabase
          .from(TABLES.pieces)
          .select(
            'piece_id, piece_des, piece_ref, piece_name, piece_display, piece_pg_id',
          )
          .in('piece_id', pieceIds);

        (piecesData || []).forEach((p) => {
          pieceMap.set(p.piece_id, p);
        });
      }

      // BATCH 2: Collecter tous les pg_ids uniques des pieces trouvées
      const pgIds = [
        ...new Set(
          Array.from(pieceMap.values())
            .map((p) => p.piece_pg_id)
            .filter((id): id is number => id != null),
        ),
      ];

      // BATCH 2: Fetch all gammes in one query
      const gammeMap = new Map<number, string>();
      if (pgIds.length > 0) {
        const { data: gammesData } = await this.supabase
          .from(TABLES.pieces_gamme)
          .select('pg_id, pg_name')
          .in('pg_id', pgIds);

        (gammesData || []).forEach((g) => {
          gammeMap.set(g.pg_id, g.pg_name || 'À déterminer');
        });
      }

      // Assembler les résultats avec Map lookup O(1)
      const enrichedLinks = linksData.map((link) => {
        const pieceData = pieceMap.get(parseInt(link.slpm_pm_id));
        const brandName = pieceData?.piece_pg_id
          ? gammeMap.get(pieceData.piece_pg_id) || 'À déterminer'
          : 'À déterminer';

        return {
          id: link.slpm_id,
          supplierId: link.slpm_spl_id,
          pieceMarketId: link.slpm_pm_id,
          display: link.slpm_display,
          isActive: link.slpm_display === '1',
          type: 'piece',
          productInfo: pieceData
            ? {
                id: pieceData.piece_id,
                designation:
                  pieceData.piece_des ||
                  pieceData.piece_name ||
                  'Produit sans nom',
                reference: pieceData.piece_ref || '',
                brand: brandName,
                isActive: pieceData.piece_display === '1',
              }
            : {
                id: link.slpm_pm_id,
                designation: `Produit #${link.slpm_pm_id}`,
                reference: '',
                brand: 'Marque inconnue',
                isActive: true,
              },
        };
      });

      this.logger.log(
        `Trouvé ${enrichedLinks.length} liens enrichis pour fournisseur ${supplierId}`,
      );
      return enrichedLinks;
    } catch (error) {
      this.logger.error('Erreur récupération liens fournisseur:', error);
      return [];
    }
  }

  /**
   * Obtenir les statistiques d'un fournisseur avec marques enrichies
   */
  async getSupplierStatistics(supplierId: string | number) {
    this.logger.log(`Calcul statistiques fournisseur ${supplierId}`);

    try {
      // Utiliser les liens enrichis pour calculer les vraies statistiques
      const links = await this.getSupplierLinks(supplierId);

      // Compter les marques uniques (en excluant les marques génériques)
      const uniqueBrands = new Set(
        links
          .filter(
            (link) =>
              link.productInfo?.brand &&
              link.productInfo.brand !== 'À déterminer' &&
              link.productInfo.brand !== 'Marque inconnue',
          )
          .map((link) => link.productInfo.brand),
      );

      const totalBrands = uniqueBrands.size;
      const totalPieces = links.length; // Tous les liens sont des pièces dans cette table
      const totalLinks = links.length;
      const activeLinks = links.filter((link) => link.isActive).length;

      return {
        totalBrands,
        totalPieces,
        totalLinks,
        activeLinks,
      };
    } catch (error) {
      this.logger.error('Erreur calcul statistiques fournisseur:', error);
      return {
        totalBrands: 0,
        totalPieces: 0,
        totalLinks: 0,
        activeLinks: 0,
      };
    }
  }

  /**
   * Test de la table pieces_gamme pour debug
   */
  async testPiecesGammeTable() {
    try {
      // Tester la table pieces_gamme
      const { data: gammes, error } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('*')
        .limit(5);

      if (error) {
        return {
          accessible: false,
          error: error.message,
          sampleData: [],
        };
      }

      const columns = gammes && gammes.length > 0 ? Object.keys(gammes[0]) : [];

      return {
        accessible: true,
        sampleData: gammes || [],
        columns,
        totalSamples: gammes?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur test table pieces_gamme:', error);
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sampleData: [],
        columns: [],
      };
    }
  }
  async testPiecesMarqueTable() {
    try {
      // Tester la table pieces_marque
      const { data: marques, error } = await this.supabase
        .from(TABLES.pieces_marque)
        .select('*')
        .limit(5);

      if (error) {
        return {
          accessible: false,
          error: error.message,
          sampleData: [],
        };
      }

      const columns =
        marques && marques.length > 0 ? Object.keys(marques[0]) : [];

      return {
        accessible: true,
        sampleData: marques || [],
        columns,
        totalSamples: marques?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur test table pieces_marque:', error);
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sampleData: [],
        columns: [],
      };
    }
  }
  async testPiecesTable() {
    try {
      // D'abord tester l'accès à la table sans spécifier de colonnes
      const { data: sampleData, error: sampleError } = await this.supabase
        .from(TABLES.pieces)
        .select('*')
        .limit(1);

      if (sampleError) {
        return {
          accessible: false,
          error: sampleError.message,
          sampleData: [],
          columns: [],
          specificTests: [],
        };
      }

      // Récupérer les colonnes disponibles
      const columns =
        sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

      // Tester avec quelques échantillons
      const { data: pieces, error } = await this.supabase
        .from(TABLES.pieces)
        .select('*')
        .limit(5);

      if (error) {
        return {
          accessible: false,
          error: error.message,
          sampleData: [],
          columns,
          specificTests: [],
        };
      }

      return {
        accessible: true,
        sampleData: pieces || [],
        columns,
        totalSamples: pieces?.length || 0,
      };
    } catch (error) {
      this.logger.error('Erreur test table pieces:', error);
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        sampleData: [],
        columns: [],
      };
    }
  }

  /**
   * Test de la table liens pour debug
   */
  async testSupplierLinksTable() {
    this.logger.log('Test de la table ___xtr_supplier_link_pm');

    try {
      // Vérifier la structure et les données de la table
      const {
        data: sampleData,
        error: sampleError,
        count,
      } = await this.supabase
        .from(TABLES.xtr_supplier_link_pm)
        .select('*', { count: 'exact' })
        .limit(10);

      if (sampleError) {
        return {
          tableExists: false,
          error: sampleError.message,
          totalRows: 0,
          sampleData: [],
        };
      }

      // Tester avec quelques fournisseurs
      const testSuppliers = ['1', '2', '3'];
      const supplierTests = await Promise.all(
        testSuppliers.map(async (supplierId) => {
          const links = await this.getSupplierLinks(supplierId);
          const stats = await this.getSupplierStatistics(supplierId);
          return {
            supplierId,
            linksFound: links.length,
            stats,
          };
        }),
      );

      return {
        tableExists: true,
        totalRows: count || 0,
        sampleData: sampleData?.slice(0, 3) || [],
        supplierTests,
      };
    } catch (error) {
      this.logger.error('Erreur test table liens:', error);
      return {
        tableExists: false,
        error: (error as Error).message,
        totalRows: 0,
        sampleData: [],
      };
    }
  }

  /**
   * Test complet du service fournisseurs
   */
  async testSuppliersService() {
    this.logger.log('=== TEST GLOBAL SUPPLIERS SERVICE ===');

    try {
      // Test de connexion
      const { data: connectionTest } = await this.supabase
        .from(TABLES.xtr_supplier)
        .select('count', { count: 'exact', head: true });

      const totalSuppliers = connectionTest || 0;
      this.logger.log(
        `✅ Connexion OK - ${totalSuppliers} fournisseurs trouvés`,
      );

      // Échantillon de données
      const { data: sampleData } = await this.supabase
        .from(TABLES.xtr_supplier)
        .select('*')
        .limit(1)
        .single();

      return {
        connection: true,
        totalSuppliers,
        sampleSupplier: sampleData,
        tableStructure: sampleData ? Object.keys(sampleData) : [],
      };
    } catch (error) {
      this.logger.error('Erreur test service:', error);
      throw error;
    }
  }
}
