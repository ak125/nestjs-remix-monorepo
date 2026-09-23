import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { TABLES } from '@repo/database-types';
import { z } from 'zod';
import { CacheService } from '@cache/cache.service';
import {
  BusinessRuleException,
  DomainNotFoundException,
  ErrorCodes,
} from '@common/exceptions';
import { buildRackImageUrl } from '../../modules/catalog/utils/image-urls.utils';
import { PiecePriceDataService } from './piece-price-data.service';

/**
 * 📊 INTERFACES ET TYPES OPTIMISÉS
 */

export const CartItemSchema = z.object({
  id: z.string().optional(), // UUID
  user_id: z.string(), // TEXT - peut être UUID ou chaîne
  product_id: z.string(), // TEXT - ID produit converti en string
  quantity: z.number().min(1).max(99),
  price: z.number().min(0),
  created_at: z.string().optional(), // ISO timestamp
  updated_at: z.string().optional(), // ISO timestamp
  options: z.record(z.string(), z.any()).optional(),
  product_name: z.string().optional(),
  product_sku: z.string().optional(),
  product_brand: z.string().optional(), // Marque du produit
  product_description: z.string().optional(), // Description
  product_image: z.string().optional(), // URL image
  weight: z.number().min(0).optional(),
  type_id: z.number().int().positive().optional(), // Vehicle type_id (contexte vehicule a l'ajout)
  website_url: z.string().optional(), // F1 attribution : source d'ajout (URL/chemin de la page) → orl_website_url
});

export const CartMetadataSchema = z.object({
  user_id: z.number(),
  promo_code: z.string().optional(),
  promo_discount: z.number().min(0).default(0),
  shipping_cost: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  subtotal: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  currency: z.string().length(3).default('EUR'),
});

export type CartItem = z.infer<typeof CartItemSchema>;
export type CartMetadata = z.infer<typeof CartMetadataSchema>;

/**
 * 🎫 INTERFACE PROMO APPLIQUÉ
 */
export interface AppliedPromo {
  code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  promo_id: number;
  applied_at: string;
}

/**
 * 🔧 CONSTANTES REDIS POUR LES PANIERS
 */

const CART_REDIS_PREFIX = 'cart:';
const CART_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 jours comme les sessions PHP

/**
 * 🛒 CART DATA SERVICE OPTIMISÉ
 *
 * Service reproduisant l'ancien système PHP:
 * - Panier géré en session (pas de tables dédiées)
 * - Utilisation directe des tables existantes
 * - Validation produits via table 'pieces'
 * - Calculs en temps réel comme l'ancien système
 */
@Injectable()
export class CartDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(CartDataService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly piecePriceData: PiecePriceDataService,
  ) {
    super();
  }

  /**
   * 🔑 Générer la clé Redis pour un panier
   */
  private getCartKey(sessionId: string): string {
    return `${CART_REDIS_PREFIX}${sessionId}`;
  }

  /**
   * 🔑 Générer la clé Redis pour un code promo appliqué
   */
  private getPromoKey(sessionId: string): string {
    return `cart:promo:${sessionId}`;
  }

  /**
   * 💾 Sauvegarder le panier dans Redis via CacheService (avec TTL)
   */
  private async saveCartToRedis(
    sessionId: string,
    cartItems: CartItem[],
  ): Promise<void> {
    const key = this.getCartKey(sessionId);
    this.logger.log(
      `💾 Sauvegarde Redis: clé="${key}", items=${cartItems.length}`,
    );
    await this.cacheService.set(key, cartItems, CART_EXPIRY_SECONDS);
    this.logger.log(`✅ Panier sauvegardé dans Redis: ${sessionId}`);
  }

  /**
   * 🔍 Récupérer le panier depuis Redis via CacheService
   */
  private async getCartFromRedis(sessionId: string): Promise<CartItem[]> {
    const key = this.getCartKey(sessionId);
    try {
      const data = await this.cacheService.get<CartItem[]>(key);
      return data || [];
    } catch (error) {
      this.logger.error(`❌ Erreur parsing panier Redis ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * 🛒 Récupérer le panier depuis Redis (comme l'ancien système PHP mais persistant)
   */
  async getCartWithMetadata(sessionId: string) {
    try {
      // 1. Récupérer items Redis + promo + shipping en parallèle (3 Redis GET simultanés)
      const [cartItems, appliedPromo, appliedShipping] = await Promise.all([
        this.getCartFromRedis(sessionId),
        this.getAppliedPromo(sessionId),
        this.getAppliedShipping(sessionId),
      ]);

      if (cartItems.length === 0) {
        const emptyStats = {
          itemCount: 0,
          totalQuantity: 0,
          subtotal: 0,
          consigne_total: 0,
          total: 0,
          hasPromo: false,
          promoDiscount: 0,
          promoCode: undefined as string | undefined,
          hasShipping: false,
          shippingCost: 0,
          shippingMethod: undefined as string | undefined,
          totalWeightG: 0,
        };
        return {
          metadata: {
            user_id: sessionId,
            subtotal: 0,
            total: 0,
            promo_code: undefined as string | undefined,
            promo_discount: 0,
          },
          items: [] as any[],
          stats: emptyStats,
          appliedPromo,
        };
      }

      // 2. Batch enrichment : 3 requêtes DB parallèles au lieu de 3N séquentielles
      const productIds = cartItems.map((item) => parseInt(item.product_id));
      const productMap = await this.enrichCartItemsBatch(productIds);

      // 3. Mapper les items enrichis
      const enrichedItems = cartItems.map((item) => {
        const productId = parseInt(item.product_id);
        const product = productMap.get(productId);

        if (!product) {
          const fallbackBrand =
            item.product_brand && item.product_brand !== 'MARQUE INCONNUE'
              ? item.product_brand
              : 'Non spécifiée';
          return {
            ...item,
            product_brand: fallbackBrand,
            consigne_unit: 0,
            has_consigne: false,
            consigne_total: 0,
            weight_g: 0,
          };
        }

        const brandName =
          product.brand_name && product.brand_name !== 'MARQUE INCONNUE'
            ? product.brand_name
            : 'Non spécifiée';

        const consigneUnit = product.consigne_ttc || 0;
        const hasConsigne = consigneUnit > 0;

        return {
          ...item,
          product_name: product.piece_name || item.product_name,
          product_sku: product.piece_ref || item.product_sku,
          product_brand: brandName,
          product_description: product.piece_des || item.product_description,
          product_image: product.piece_image || item.product_image || undefined,
          weight: product.piece_weight_kgm || item.weight,
          price: item.price || product.price_ttc || 0,
          pg_id: product.piece_pg_id || undefined,
          consigne_unit: consigneUnit,
          has_consigne: hasConsigne,
          consigne_total: consigneUnit * item.quantity,
          // Poids en grammes pré-calculé (élimine la double requête du ShippingCalculator)
          weight_g: product.weight_g || 0,
        };
      });

      // 4. Calculs statistiques
      const consigneTotal = enrichedItems.reduce(
        (sum, item) => sum + (item.consigne_total || 0),
        0,
      );

      // Fallback 1000g/article si poids inconnu (cohérent avec ShippingCalculatorService)
      const DEFAULT_ITEM_WEIGHT_G = 1000;
      const totalWeightG = enrichedItems.reduce(
        (sum, item) =>
          sum +
          (item.weight_g > 0 ? item.weight_g : DEFAULT_ITEM_WEIGHT_G) *
            item.quantity,
        0,
      );

      const stats = {
        itemCount: enrichedItems.length,
        totalQuantity: enrichedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        subtotal: enrichedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        ),
        consigne_total: consigneTotal,
        total: 0,
        hasPromo: !!appliedPromo,
        promoDiscount: appliedPromo?.discount_amount || 0,
        promoCode: appliedPromo?.code,
        hasShipping: !!appliedShipping,
        shippingCost: appliedShipping?.cost || 0,
        shippingMethod: appliedShipping?.method_name,
        // Poids total pré-calculé pour le controller (évite re-fetch)
        totalWeightG,
      };

      stats.total =
        stats.subtotal +
        consigneTotal -
        stats.promoDiscount +
        stats.shippingCost;

      return {
        metadata: {
          user_id: sessionId,
          subtotal: stats.subtotal,
          total: stats.total,
          promo_code: appliedPromo?.code,
          promo_discount: stats.promoDiscount,
        },
        items: enrichedItems,
        stats,
        appliedPromo,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération panier session ${sessionId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * 📋 Récupérer items du panier depuis Redis (comme l'ancien système PHP mais persistant)
   */
  async getCartItems(sessionId: string): Promise<CartItem[]> {
    try {
      this.logger.log(`🛒 Récupération items panier Redis: ${sessionId}`);

      const cartItems = await this.getCartFromRedis(sessionId);
      this.logger.log(`✅ Panier trouvé: ${cartItems.length} items`);

      return cartItems;
    } catch (error) {
      this.logger.error('Erreur getCartItems:', error);
      return [];
    }
  }

  /**
   * ➕ Ajouter un item au panier en session (reproduction système PHP)
   */
  async addCartItem(
    sessionId: string,
    productId: number,
    quantity: number,
    customPrice?: number,
    replace: boolean = false,
    typeId?: number,
    sourceUrl?: string, // F1 attribution : page d'où l'article a été ajouté → orl_website_url
  ): Promise<CartItem> {
    try {
      // 1. Récupérer le produit avec TOUTES les vraies données
      const product = await this.getProductWithAllData(productId);
      if (!product) {
        throw new DomainNotFoundException({
          code: ErrorCodes.CART.PRODUCT_NOT_FOUND,
          message: `Produit ${productId} introuvable`,
        });
      }

      // Refus explicite plutôt que prix inventé. `customPrice` n'est jamais fourni
      // par un client (le contrôleur impose l'autorité serveur, F5) : il ne porte
      // que le prix déjà convenu d'un article présent au panier dont on modifie la
      // quantité. Cette voie-là reste ouverte, y compris pour retirer un article
      // devenu indisponible ; seul un AJOUT sans tarif vendable est refusé.
      const sansTarifVendable = !(product as { sellable?: boolean }).sellable;
      if (sansTarifVendable && customPrice === undefined) {
        this.logger.warn(
          `Ajout refusé — pièce ${productId} sans tarif vendable (session ${sessionId})`,
        );
        throw new BusinessRuleException({
          code: ErrorCodes.CART.NOT_SELLABLE,
          message: `La pièce ${productId} n'a pas de prix disponible à la vente`,
        });
      }

      this.logger.log(
        `💰 Prix produit ${productId}: customPrice=${customPrice}, product.price_ttc=${(product as unknown as Record<string, unknown>).price_ttc}`,
      );

      // 2. Récupérer le panier existant depuis Redis
      const cartItems = await this.getCartFromRedis(sessionId);

      // 3. Vérifier si le produit est déjà dans le panier
      const existingItemIndex = cartItems.findIndex(
        (item) => item.product_id === productId.toString(),
      );

      const newItem: CartItem = {
        id: `${sessionId}-${productId}-${Date.now()}`,
        user_id: sessionId,
        product_id: productId.toString(),
        quantity: quantity,
        price:
          customPrice ||
          (product as unknown as Record<string, number>).price_ttc ||
          0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        product_name: product.piece_name,
        product_sku: product.piece_ref,
        product_brand: product.piece_marque || 'Non spécifiée', // S'assurer qu'il y a toujours une valeur
        product_description: product.piece_des,
        product_image: product.piece_image || undefined,
        weight: product.piece_weight_kgm,
        ...(typeId && { type_id: typeId }),
        ...(sourceUrl && { website_url: sourceUrl }),
      };

      if (existingItemIndex >= 0) {
        // 4a. Mettre à jour la quantité si produit déjà présent
        const updatedItems = [...cartItems];

        if (replace) {
          // Remplacer la quantité (pour les contrôles +/- du frontend)
          updatedItems[existingItemIndex].quantity = quantity;
          this.logger.log(
            `🔄 Quantité remplacée Redis: ${product.piece_name} (${quantity})`,
          );
        } else {
          // Additionner la quantité (pour l'ajout de nouveaux articles)
          updatedItems[existingItemIndex].quantity += quantity;
          this.logger.log(
            `🔄 Quantité additionnée Redis: ${product.piece_name} (${updatedItems[existingItemIndex].quantity})`,
          );
        }

        updatedItems[existingItemIndex].updated_at = new Date().toISOString();
        if (typeId) updatedItems[existingItemIndex].type_id = typeId;
        await this.saveCartToRedis(sessionId, updatedItems);
        return updatedItems[existingItemIndex];
      } else {
        // 4b. Ajouter nouveau produit
        const updatedItems = [...cartItems, newItem];
        this.logger.log(`📝 Items à sauvegarder: ${updatedItems.length}`);
        await this.saveCartToRedis(sessionId, updatedItems);
        this.logger.log(
          `➕ Nouveau produit ajouté Redis: ${product.piece_name} (${quantity})`,
        );

        // VÉRIFICATION: relire immédiatement pour confirmer
        const verification = await this.getCartFromRedis(sessionId);
        this.logger.log(
          `🔍 Vérification immédiate: ${verification.length} items trouvés`,
        );

        return newItem;
      }
    } catch (error) {
      this.logger.error('Erreur addCartItem:', error);
      throw error;
    }
  }
  /**
   * 🚀 Enrichir N produits en 1 seule requête DB (batch JOIN)
   * Remplace N × getProductWithAllData (qui faisait 3N requêtes séquentielles)
   *
   * Retourne une Map<productId, enrichedData> pour lookup O(1)
   */
  async enrichCartItemsBatch(productIds: number[]): Promise<
    Map<
      number,
      {
        piece_name: string;
        piece_ref: string;
        piece_des: string;
        piece_image: string | null;
        piece_weight_kgm: number;
        piece_pg_id: number | null;
        piece_pm_id: number | null;
        piece_price_ttc: number;
        brand_name: string;
        price_ttc: number;
        consigne_ttc: number;
        weight_g: number;
        /** `false` quand aucune ligne de tarif vendable n'existe : le prix rendu
         * vaut alors 0 et ne doit pas être présenté comme un prix de vente. */
        sellable: boolean;
      }
    >
  > {
    const result = new Map<number, any>();
    if (productIds.length === 0) return result;

    // Dédupliquer les IDs
    const uniqueIds = [...new Set(productIds)];

    try {
      // 3 requêtes parallèles (pieces + prix + images) puis 1 requête marques après collecte des pm_ids
      const [piecesResult, tarifs, imagesResult] = await Promise.all([
        // Batch pieces — seulement les colonnes nécessaires
        this.client
          .from(TABLES.pieces)
          .select(
            'piece_id, piece_name, piece_ref, piece_des, piece_has_img, piece_weight_kgm, piece_pm_id, piece_pg_id',
          )
          .in('piece_id', uniqueIds),

        // Prix ET poids en une seule requête, via l'autorité unique. C'est en
        // requêtant pieces_price ici que l'affichage du panier avait fini par
        // retenir une autre ligne que l'ajout au panier, pour la même pièce.
        this.piecePriceData.findTariffs(uniqueIds),

        // Batch images — images avec folder valide (triées par pmi_sort)
        this.client
          .from(TABLES.pieces_media_img)
          .select('pmi_piece_id_i, pmi_folder, pmi_name')
          .in('pmi_piece_id_i', uniqueIds)
          .neq('pmi_folder', '')
          .order('pmi_sort', { ascending: true }),
      ]);

      if (piecesResult.error) {
        this.logger.error(`Batch pieces error: ${piecesResult.error.message}`);
        return result;
      }

      // Index images par product_id (prendre la 1ère image triée par sort)
      const imageMap = new Map<
        number,
        { pmi_folder: string; pmi_name: string }
      >();
      if (!imagesResult.error && imagesResult.data) {
        for (const row of imagesResult.data) {
          if (!imageMap.has(row.pmi_piece_id_i)) {
            imageMap.set(row.pmi_piece_id_i, {
              pmi_folder: row.pmi_folder,
              pmi_name: row.pmi_name,
            });
          }
        }
      }

      // Collecter les pm_ids uniques pour batch les marques
      const pmIds = new Set<string>();
      for (const piece of piecesResult.data || []) {
        if (piece.piece_pm_id) {
          pmIds.add(piece.piece_pm_id.toString());
        }
      }

      // Batch marques en 1 requête
      const brandMap = new Map<string, string>();
      if (pmIds.size > 0) {
        const { data: brandData, error: brandError } = await this.client
          .from(TABLES.pieces_marque)
          .select('pm_id, pm_name, pm_alias')
          .in('pm_id', [...pmIds]);

        if (!brandError && brandData) {
          for (const brand of brandData) {
            brandMap.set(
              brand.pm_id?.toString(),
              brand.pm_name || brand.pm_alias || `ID-${brand.pm_id}`,
            );
          }
        }
      }

      // Assembler la Map de résultats
      for (const piece of piecesResult.data || []) {
        const priceRow = tarifs.vendables.get(piece.piece_id);
        // Pas de tarif vendable => 0 €, mais SIGNALÉ (`sellable: false`) et
        // journalisé. Un 0 € muet se confond avec un article gratuit ; l'appelant
        // doit pouvoir distinguer les deux.
        if (!priceRow) {
          this.logger.warn(
            `Article ${piece.piece_id} sans tarif vendable (aucune ligne pri_dispo='1' à prix positif) — affiché non vendable`,
          );
        }
        const priceTTC = Number(priceRow?.pri_vente_ttc_n) || 0;
        const consigneTTC = Number(priceRow?.pri_consigne_ttc_n) || 0;
        // Le poids ne suit PAS la disponibilité : une pièce pèse le même poids
        // que son tarif soit à la vente ou non. Conversion en grammes faite une
        // seule fois, dans PiecePriceDataService, partagée avec les frais de port.
        const weightG = tarifs.poidsEnGrammes.get(piece.piece_id) ?? 0;

        const brandName =
          piece.piece_pm_id && brandMap.has(piece.piece_pm_id.toString())
            ? brandMap.get(piece.piece_pm_id.toString())!
            : 'MARQUE INCONNUE';

        result.set(piece.piece_id, {
          piece_name: piece.piece_name,
          piece_ref: piece.piece_ref,
          piece_des: piece.piece_des,
          piece_image: piece.piece_has_img
            ? buildRackImageUrl(imageMap.get(piece.piece_id))
            : null,
          piece_weight_kgm: piece.piece_weight_kgm,
          piece_pg_id: piece.piece_pg_id
            ? parseInt(String(piece.piece_pg_id), 10)
            : null,
          piece_pm_id: piece.piece_pm_id,
          piece_price_ttc: priceTTC,
          brand_name: brandName,
          price_ttc: priceTTC,
          consigne_ttc: consigneTTC,
          weight_g: weightG,
          sellable: Boolean(priceRow),
        });
      }

      this.logger.debug(
        `Batch enrichment: ${uniqueIds.length} produits → ${result.size} trouvés (3 queries parallèles)`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Erreur enrichCartItemsBatch:`, error);
      return result;
    }
  }

  /**
   * 🔍 Récupérer un produit avec TOUTES ses données (marque, prix, etc.)
   * @deprecated Utiliser enrichCartItemsBatch pour les opérations batch (panier)
   */
  async getProductWithAllData(productId: number) {
    try {
      // this.logger.log(`🔍 Récupération complète produit ID ${productId}...`);

      // REQUÊTE SIMPLE POUR RÉCUPÉRER LA PIÈCE
      const { data: pieceData, error: pieceError } = await this.client
        .from(TABLES.pieces)
        .select('*')
        .eq('piece_id', productId)
        .single();

      // Seul PGRST116 (`.single()` sans ligne) prouve l'absence de la pièce ;
      // toute autre erreur est une panne, qui ne doit pas devenir un 404.
      if (pieceError && pieceError.code !== 'PGRST116') {
        throw pieceError;
      }
      if (!pieceData) {
        this.logger.warn(`⚠️ Pièce ${productId} introuvable`);
        return null;
      }

      // LOG DEBUG pour voir les vraies valeurs de marque
      // this.logger.log(`🔍 DONNÉES MARQUE pour ${productId}:`, {
      //   piece_pm_id: pieceData.piece_pm_id,
      //   type_piece_pm_id: typeof pieceData.piece_pm_id,
      // });

      // Tarif vendable : même règle que l'affichage du panier et que la page
      // catalogue, portée par PiecePriceDataService. `null` signifie « pièce non
      // vendable » — surtout pas « prends la première ligne venue ».
      const tarif = await this.piecePriceData.findSellablePrice(productId);

      // REQUÊTE POUR LA MARQUE SI piece_pm_id existe
      let brandName = 'MARQUE INCONNUE'; // fallback par défaut

      if (pieceData.piece_pm_id) {
        try {
          // this.logger.log(
          //   `🔍 Recherche marque pour piece_pm_id: ${pieceData.piece_pm_id}`,
          // );

          // Rechercher dans pieces_marque avec pm_id
          const { data: brandData, error: brandError } = await this.client
            .from(TABLES.pieces_marque)
            .select('pm_name, pm_alias, pm_id, pm_sort')
            .eq('pm_id', pieceData.piece_pm_id.toString())
            .single();

          // this.logger.log(`🔍 Résultat recherche marque:`, {
          //   piece_pm_id: pieceData.piece_pm_id,
          //   brandData,
          //   brandError,
          // });

          if (!brandError && brandData) {
            brandName =
              brandData.pm_name ||
              brandData.pm_alias ||
              `ID-${pieceData.piece_pm_id}`;
            // this.logger.log(
            //   `🏷️ Marque trouvée: ${brandName} (ID: ${brandData.pm_id}, Sort: ${brandData.pm_sort})`,
            // );
          } else {
            this.logger.warn(
              `⚠️ Marque non trouvée pour piece_pm_id: ${pieceData.piece_pm_id}`,
              brandError,
            );
            brandName = `ID-${pieceData.piece_pm_id}`; // Utiliser l'ID comme nom de fallback
          }
        } catch (brandError) {
          this.logger.warn(
            `⚠️ Erreur recherche marque piece_pm_id ${pieceData.piece_pm_id}:`,
            brandError,
          );
          brandName = `ID-${pieceData.piece_pm_id}`; // Utiliser l'ID comme nom de fallback
        }
      } else {
        // this.logger.log(
        //   `🔍 Aucun piece_pm_id défini pour le produit ${productId}`,
        // );
      }

      // Aucun prix de repli. Un repli à 99,99 € vivait ici, commenté « prix par
      // défaut pour tests » : il s'appliquait au vrai chemin d'ajout au panier et
      // faisait payer un montant qu'aucune donnée ne justifiait. Une pièce sans
      // tarif ressort désormais marquée non vendable, et `addCartItem` la refuse.
      const priceTTC = Number(tarif?.pri_vente_ttc_n) || 0;
      const consigneTTC = Number(tarif?.pri_consigne_ttc_n) || 0;

      if (!tarif) {
        this.logger.warn(
          `Pièce ${productId} sans tarif vendable (aucune ligne pri_dispo='1' à prix positif)`,
        );
      }

      // Récupérer l'image depuis pieces_media_img (1ère image triée par sort)
      let pieceImage: string | null = null;
      if (pieceData.piece_has_img) {
        const { data: imgData } = await this.client
          .from(TABLES.pieces_media_img)
          .select('pmi_folder, pmi_name')
          .eq('pmi_piece_id_i', productId)
          .neq('pmi_folder', '')
          .order('pmi_sort', { ascending: true })
          .limit(1)
          .single();

        if (imgData) {
          pieceImage = buildRackImageUrl(imgData);
        }
      }

      return {
        ...pieceData,
        piece_marque: brandName, // Nom de marque complet
        piece_image: pieceImage, // URL construite depuis pieces_media_img
        price_ttc: priceTTC,
        consigne_ttc: consigneTTC, // ✅ PHASE 4: Consigne unitaire
        sellable: Boolean(tarif),
        pieces_price: tarif ? [tarif] : [],
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération produit ${productId}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprimer un item du panier Redis
   */
  async deleteCartItem(itemId: string, sessionId: string) {
    const cartItems = await this.getCartFromRedis(sessionId);
    const filteredItems = cartItems.filter((item) => item.id !== itemId);
    await this.saveCartToRedis(sessionId, filteredItems);
    this.logger.log(`🗑️ Item supprimé Redis: ${itemId}`);
    return true;
  }

  /**
   * 🧹 Vider le panier Redis d'une session via CacheService
   */
  async clearUserCart(sessionId: string) {
    const key = this.getCartKey(sessionId);
    await this.cacheService.del(key);
    this.logger.log(`🧹 Panier vidé Redis: ${sessionId}`);
    return true;
  }

  /**
   * �️ Supprimer un item du panier basé sur l'ID produit
   */
  async removeCartItem(sessionId: string, productId: number): Promise<void> {
    try {
      this.logger.log(
        `🗑️ Suppression produit ${productId} du panier session: ${sessionId}`,
      );

      // Récupérer le panier existant
      const cartItems = await this.getCartFromRedis(sessionId);

      // Filtrer pour retirer le produit
      const updatedItems = cartItems.filter(
        (item) => item.product_id !== productId.toString(),
      );

      // Sauvegarder le panier mis à jour
      await this.saveCartToRedis(sessionId, updatedItems);

      this.logger.log(
        `✅ Produit ${productId} supprimé du panier ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Erreur suppression produit ${productId}:`, error);
      throw error;
    }
  }

  /**
   * �📊 Calculer les totaux du panier (comme l'ancien système PHP)
   */
  async calculateCartTotals(sessionId: string) {
    try {
      const cart = await this.getCartWithMetadata(sessionId);
      const items = cart.items;

      // Calculs comme l'ancien système PHP
      const subtotal = (items as any[]).reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0,
      );

      const tax = subtotal * 0.2; // TVA 20%
      const shipping = subtotal >= 50 ? 0 : 6.9; // Gratuit > 50€
      const total = subtotal + tax + shipping;

      return {
        user_id: sessionId,
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        shipping: Math.round(shipping * 100) / 100,
        total: Math.round(total * 100) / 100,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur calcul totaux panier session ${sessionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 🎫 Appliquer un code promo au panier
   */
  async applyPromoCode(sessionId: string, promo: AppliedPromo): Promise<void> {
    try {
      const key = `${CART_REDIS_PREFIX}promo:${sessionId}`;
      await this.cacheService.set(key, promo, CART_EXPIRY_SECONDS);
      this.logger.log(
        `🎫 Code promo appliqué: ${promo.code} (-${promo.discount_amount}€)`,
      );
    } catch (error) {
      this.logger.error(`❌ Erreur application promo:`, error);
      throw error;
    }
  }

  /**
   * 🔍 Récupérer le code promo appliqué
   */
  async getAppliedPromo(sessionId: string): Promise<AppliedPromo | null> {
    try {
      const key = `${CART_REDIS_PREFIX}promo:${sessionId}`;
      return await this.cacheService.get<AppliedPromo>(key);
    } catch (error) {
      this.logger.error(`❌ Erreur récupération promo:`, error);
      return null;
    }
  }

  /**
   * 🗑️ Retirer le code promo appliqué
   */
  async removePromoCode(sessionId: string): Promise<void> {
    try {
      const key = `${CART_REDIS_PREFIX}promo:${sessionId}`;
      await this.cacheService.del(key);
      this.logger.log(`🗑️ Code promo retiré du panier ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Erreur suppression promo:`, error);
      throw error;
    }
  }

  // ============================================================
  // 🚚 GESTION SHIPPING
  // ============================================================

  /**
   * Clé Redis pour le shipping
   */
  private getShippingKey(sessionId: string): string {
    return `${CART_REDIS_PREFIX}shipping:${sessionId}`;
  }

  /**
   * 🚚 Appliquer une méthode de livraison
   */
  async applyShipping(
    sessionId: string,
    shipping: {
      method_id: number;
      method_name: string;
      zone: string;
      cost: number;
      estimated_days: number;
      postal_code?: string;
      address?: string;
    },
  ): Promise<void> {
    try {
      const key = this.getShippingKey(sessionId);
      const shippingData = {
        ...shipping,
        applied_at: new Date().toISOString(),
      };

      await this.cacheService.set(key, shippingData, CART_EXPIRY_SECONDS);
      this.logger.log(
        `🚚 Méthode livraison appliquée: ${shipping.method_name} (${shipping.cost}€) pour ${sessionId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Erreur application shipping:`, error);
      throw error;
    }
  }

  /**
   * 🔍 Récupérer la méthode de livraison appliquée
   */
  async getAppliedShipping(sessionId: string): Promise<any | null> {
    try {
      const key = this.getShippingKey(sessionId);
      return await this.cacheService.get<any>(key);
    } catch (error) {
      this.logger.error(`❌ Erreur récupération shipping:`, error);
      return null;
    }
  }

  /**
   * 🗑️ Retirer la méthode de livraison
   */
  async removeShipping(sessionId: string): Promise<void> {
    try {
      const key = this.getShippingKey(sessionId);
      await this.cacheService.del(key);
      this.logger.log(`🗑️ Méthode livraison retirée du panier ${sessionId}`);
    } catch (error) {
      this.logger.error(`❌ Erreur suppression shipping:`, error);
      throw error;
    }
  }

  // ============================================================
  // 🔄 FUSION DE PANIER (CART MERGE)
  // ============================================================

  /**
   * 🔄 Fusionner deux paniers lors de l'authentification
   *
   * Cas d'usage: L'utilisateur a ajouté des articles en navigation anonyme,
   * puis se connecte. On doit transférer son panier anonyme vers sa session authentifiée.
   *
   * Stratégie de fusion:
   * - Si un produit existe dans les deux paniers, on additionne les quantités
   * - On préserve le prix le plus récent (celui du panier source/anonyme)
   * - On transfère également les codes promo et méthodes de livraison
   * - On nettoie le panier source après la fusion
   *
   * @param sourceSessionId - Session anonyme (source des articles à transférer)
   * @param targetSessionId - Session authentifiée (destination)
   * @returns Nombre d'articles fusionnés
   */
  async mergeCart(
    sourceSessionId: string,
    targetSessionId: string,
  ): Promise<number> {
    try {
      this.logger.log(
        `🔄 Fusion de panier: ${sourceSessionId} → ${targetSessionId}`,
      );

      // 1. Récupérer les deux paniers
      const sourceItems = await this.getCartFromRedis(sourceSessionId);
      const targetItems = await this.getCartFromRedis(targetSessionId);

      if (sourceItems.length === 0) {
        this.logger.log(`ℹ️ Panier source vide, aucune fusion nécessaire`);
        return 0;
      }

      this.logger.log(
        `📦 Fusion: ${sourceItems.length} items source + ${targetItems.length} items target`,
      );

      // 2. Créer une map des produits existants dans le panier cible
      const targetMap = new Map<string, CartItem>();
      targetItems.forEach((item) => {
        targetMap.set(item.product_id, item);
      });

      // 3. Fusionner les items
      let mergedCount = 0;
      const mergedItems = [...targetItems];

      for (const sourceItem of sourceItems) {
        const existingItem = targetMap.get(sourceItem.product_id);

        if (existingItem) {
          // Produit existe déjà: additionner les quantités
          existingItem.quantity += sourceItem.quantity;
          existingItem.updated_at = new Date().toISOString();
          // Garder le prix le plus récent (celui du panier source)
          existingItem.price = sourceItem.price;
          existingItem.type_id = sourceItem.type_id || existingItem.type_id;
          this.logger.log(
            `➕ Fusion produit ${sourceItem.product_name}: ${existingItem.quantity} total`,
          );
        } else {
          // Nouveau produit: l'ajouter au panier cible
          const newItem = {
            ...sourceItem,
            id: `${targetSessionId}-${sourceItem.product_id}-${Date.now()}`,
            user_id: targetSessionId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          mergedItems.push(newItem);
          targetMap.set(sourceItem.product_id, newItem);
          this.logger.log(
            `✨ Ajout nouveau produit: ${sourceItem.product_name}`,
          );
        }
        mergedCount++;
      }

      // 4. Sauvegarder le panier fusionné
      await this.saveCartToRedis(targetSessionId, mergedItems);

      // 5. Transférer le code promo si le panier cible n'en a pas
      const sourcePromo = await this.getAppliedPromo(sourceSessionId);
      const targetPromo = await this.getAppliedPromo(targetSessionId);

      if (sourcePromo && !targetPromo) {
        await this.applyPromoCode(targetSessionId, sourcePromo);
        this.logger.log(`🎫 Code promo transféré: ${sourcePromo.code}`);
      }

      // 6. Transférer la méthode de livraison si le panier cible n'en a pas
      const sourceShipping = await this.getAppliedShipping(sourceSessionId);
      const targetShipping = await this.getAppliedShipping(targetSessionId);

      if (sourceShipping && !targetShipping) {
        await this.applyShipping(targetSessionId, sourceShipping);
        this.logger.log(
          `🚚 Méthode livraison transférée: ${sourceShipping.method_name}`,
        );
      }

      // 7. Nettoyer le panier source (optionnel mais recommandé)
      await this.clearUserCart(sourceSessionId);
      this.logger.log(`🧹 Panier source nettoyé: ${sourceSessionId}`);

      this.logger.log(
        `✅ Fusion terminée: ${mergedCount} articles fusionnés, ${mergedItems.length} total dans le panier`,
      );

      return mergedCount;
    } catch (error) {
      this.logger.error(
        `❌ Erreur fusion paniers ${sourceSessionId} → ${targetSessionId}:`,
        error,
      );
      // Ne pas throw l'erreur pour ne pas bloquer le login
      // L'utilisateur pourra toujours réajouter ses articles
      return 0;
    }
  }
}
