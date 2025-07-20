/**
 * Service d'intégration entre le module Orders existant et les fonctionnalités automobiles
 * 
 * Responsabilités:
 * - Intégration avec tables legacy (___xtr_order, ___xtr_order_line)
 * - Conversion entre formats legacy et moderne via SupabaseRestService
 * - Orchestration des services automobiles existants
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
import { OrdersService } from '../orders.service';
import { OrdersCompleteService } from '../orders-complete.service';

// Import des types personnalisés
import { 
  OrderStatus, 
  PaymentMethod, 
  PaymentStatus,
  AutomotiveOrder, 
  AutomotiveOrderLine, 
  VehicleData,
  validateAutomotiveOrder 
} from '../dto/automotive-orders.dto';

@Injectable()
export class OrdersAutomotiveIntegrationService {
  private readonly logger = new Logger(OrdersAutomotiveIntegrationService.name);

  constructor(
    private readonly supabaseService: SupabaseRestService,
    private readonly ordersService: OrdersService,
    private readonly ordersCompleteService: OrdersCompleteService,
  ) {}

  /**
   * Crée une commande automobile en utilisant à la fois Prisma et les tables legacy
   */
  async createAutomotiveOrder(orderData: AutomotiveOrder): Promise<{
    prismaOrder: any;
    legacyOrder: any;
    orderNumber: string;
  }> {
    this.logger.log('Création d\'une commande automobile hybride');

    // Validation Zod
    const validatedData = validateAutomotiveOrder(orderData);

    // Générer un numéro de commande unique
    const orderNumber = await this.generateOrderNumber();

    try {
      // 1. Créer la commande dans Prisma (moderne)
      const prismaOrder = await this.createPrismaOrder(validatedData, orderNumber);

      // 2. Créer la commande dans les tables legacy
      const legacyOrder = await this.createLegacyOrder(validatedData, orderNumber, prismaOrder.id);

      // 3. Synchroniser les IDs entre les deux systèmes
      await this.syncOrderIds(prismaOrder.id, legacyOrder.ord_id);

      this.logger.log(`Commande automobile créée: ${orderNumber}`, {
        prismaId: prismaOrder.id,
        legacyId: legacyOrder.ord_id
      });

      return {
        prismaOrder,
        legacyOrder,
        orderNumber,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors de la création';
      this.logger.error('Erreur lors de la création de commande automobile', error);
      throw new BadRequestException(`Erreur de création: ${errorMessage}`);
    }
  }

  /**
   * Récupère une commande automobile avec données des deux systèmes
   */
  async getAutomotiveOrderById(orderId: string): Promise<{
    prismaOrder: any;
    legacyOrder: any;
    vehicleData: any;
    automotiveMetadata: any;
  } | null> {
    try {
      // Récupérer de Prisma
      const prismaOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderLines: true,
        },
      });

      if (!prismaOrder) {
        return null;
      }

      // Récupérer des tables legacy via le service existant
      const legacyOrder = await this.ordersCompleteService.getCompleteOrderById(
        orderId
      );

      // Extraire les données véhicule des orderLines
      const vehicleData = this.extractVehicleDataFromOrder(prismaOrder);

      // Construire les métadonnées automobiles
      const automotiveMetadata = this.buildAutomotiveMetadata(prismaOrder, legacyOrder);

      return {
        prismaOrder,
        legacyOrder,
        vehicleData,
        automotiveMetadata,
      };

    } catch (error) {
      this.logger.error(`Erreur lors de la récupération de commande: ${orderId}`, error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une commande automobile dans les deux systèmes
   */
  async updateAutomotiveOrderStatus(
    orderId: string, 
    newStatus: OrderStatus,
    reason?: string
  ): Promise<{ prismaUpdated: boolean; legacyUpdated: boolean }> {
    this.logger.log(`Mise à jour statut commande automobile: ${orderId} -> ${newStatus}`);

    try {
      // Mettre à jour dans Prisma
      const prismaUpdate = await this.prisma.order.update({
        where: { id: orderId },
        data: { 
          status: newStatus,
          updatedAt: new Date(),
          internalNotes: reason ? `Status updated: ${reason}` : undefined,
        },
      });

      // Mettre à jour dans les tables legacy
      const legacyUpdate = await this.updateLegacyOrderStatus(
        orderId,
        this.mapStatusToLegacy(newStatus)
      );

      return {
        prismaUpdated: !!prismaUpdate,
        legacyUpdated: legacyUpdate,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors de la mise à jour';
      this.logger.error('Erreur lors de la mise à jour du statut', error);
      throw new BadRequestException(`Erreur de mise à jour: ${errorMessage}`);
    }
  }

  /**
   * Recherche des commandes automobiles avec critères avancés
   */
  async searchAutomotiveOrders(filters: {
    customerId?: string;
    hasVehicleData?: boolean;
    vinNumber?: string;
    registrationNumber?: string;
    oemCode?: string;
    dateFrom?: Date;
    dateTo?: Date;
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    orders: any[];
    total: number;
    hasVehicleDataCount: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;

    try {
      // Construire la requête Prisma avec filtres automobiles
      const whereClause: any = {};

      if (filters.customerId) {
        whereClause.customerId = filters.customerId;
      }

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.dateFrom || filters.dateTo) {
        whereClause.createdAt = {};
        if (filters.dateFrom) whereClause.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) whereClause.createdAt.lte = filters.dateTo;
      }

      // Filtres spécifiques automobiles
      if (filters.hasVehicleData || filters.vinNumber || filters.registrationNumber || filters.oemCode) {
        whereClause.orderLines = {
          some: this.buildVehicleDataFilter(filters),
        };
      }

      // Compter le total
      const total = await this.prisma.order.count({ where: whereClause });

      // Récupérer les commandes avec pagination
      const orders = await this.prisma.order.findMany({
        where: whereClause,
        include: {
          orderLines: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Enrichir avec les données legacy et automobiles
      const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
          const automotiveData = await this.getAutomotiveOrderById(order.id);
          return {
            ...order,
            automotiveData: automotiveData?.automotiveMetadata,
            vehicleDataSummary: automotiveData?.vehicleData,
          };
        })
      );

      // Compter les commandes avec données véhicule
      const hasVehicleDataCount = await this.prisma.order.count({
        where: {
          ...whereClause,
          orderLines: {
            some: {
              OR: [
                { productName: { contains: 'VIN' } },
                { productReference: { contains: 'AUTO' } },
                // Autres critères pour détecter les données véhicule
              ],
            },
          },
        },
      });

      return {
        orders: enrichedOrders,
        total,
        hasVehicleDataCount,
      };

    } catch (error) {
      this.logger.error('Erreur lors de la recherche automobile', error);
      throw error;
    }
  }

  // === Méthodes privées d'assistance ===

  private async generateOrderNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Compter les commandes du mois
    const count = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(year, now.getMonth(), 1),
          lt: new Date(year, now.getMonth() + 1, 1),
        },
      },
    });

    return `AUTO-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }

  private async createPrismaOrder(orderData: AutomotiveOrder, orderNumber: string): Promise<any> {
    return await this.prisma.order.create({
      data: {
        orderNumber,
        customerId: orderData.customerId,
        status: OrderStatus.PENDING,
        paymentMethod: orderData.paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        billingAddress: orderData.billingAddress,
        deliveryAddress: orderData.deliveryAddress,
        totalAmountHT: orderData.orderLines.reduce((sum, line) => sum + line.totalPrice, 0),
        taxAmount: 0, // Calculé séparément
        totalAmountTTC: orderData.orderLines.reduce((sum, line) => sum + line.totalPrice, 0),
        shippingCost: 0, // Calculé séparément
        customerNotes: orderData.customerNotes,
        internalNotes: orderData.internalNotes,
        orderLines: {
          create: orderData.orderLines.map(line => ({
            productId: line.productId,
            productName: line.productName,
            productReference: line.productReference,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
          })),
        },
      },
      include: {
        orderLines: true,
      },
    });
  }

  private async createLegacyOrder(orderData: AutomotiveOrder, orderNumber: string, prismaId: string): Promise<any> {
    // Utiliser le service Supabase pour créer dans les tables legacy
    const legacyOrderData = {
      ord_number: orderNumber,
      ord_cst_id: orderData.customerId,
      ord_date: new Date().toISOString(),
      ord_ords_id: '1', // Status initial
      ord_total_ht: orderData.orderLines.reduce((sum, line) => sum + line.totalPrice, 0),
      ord_total_ttc: orderData.orderLines.reduce((sum, line) => sum + line.totalPrice, 0),
      ord_notes: orderData.customerNotes,
      ord_internal_notes: orderData.internalNotes,
      ord_prisma_id: prismaId, // Référence vers Prisma
    };

    return await this.supabaseService.createOrder(legacyOrderData);
  }

  private async syncOrderIds(prismaId: string, legacyId: string): Promise<void> {
    // Mettre à jour Prisma avec l'ID legacy
    await this.prisma.order.update({
      where: { id: prismaId },
      data: {
        internalNotes: `Legacy ID: ${legacyId}`,
      },
    });
  }

  private async updateLegacyOrderStatus(legacyOrderId: string, statusId: string): Promise<boolean> {
    try {
      // Utiliser Supabase pour mettre à jour le statut legacy
      const result = await this.supabaseService.updateOrder(legacyOrderId, { orderStatusId: statusId });
      return !!result;
    } catch (error) {
      this.logger.error('Erreur mise à jour statut legacy', error);
      return false;
    }
  }

  private mapStatusToLegacy(status: OrderStatus): string {
    const statusMapping = {
      [OrderStatus.PENDING]: '1',
      [OrderStatus.VALIDATED]: '2',
      [OrderStatus.PROCESSING]: '3',
      [OrderStatus.SHIPPED]: '4',
      [OrderStatus.DELIVERED]: '5',
      [OrderStatus.CANCELLED]: '6',
      [OrderStatus.REFUNDED]: '7',
    };

    return statusMapping[status] || '1';
  }

  private extractVehicleDataFromOrder(order: any): any {
    const vehicleLines = order.orderLines.filter((line: any) => 
      line.productName.includes('VIN') || 
      line.productReference.includes('AUTO') ||
      line.productName.includes('VEHIC')
    );

    return {
      hasVehicleData: vehicleLines.length > 0,
      vehicleCount: vehicleLines.length,
      lines: vehicleLines,
    };
  }

  private buildAutomotiveMetadata(prismaOrder: any, legacyOrder: any): any {
    return {
      orderType: 'automotive',
      hasVehicleData: this.extractVehicleDataFromOrder(prismaOrder).hasVehicleData,
      legacyIntegration: {
        legacyId: legacyOrder?.ord_id,
        syncStatus: 'synced',
        lastSync: new Date(),
      },
      metadata: {
        createdSource: 'automotive_module',
        processingFlags: {
          requiresVinValidation: false,
          requiresOemLookup: false,
          requiresShippingCalculation: true,
        },
      },
    };
  }

  private buildVehicleDataFilter(filters: any): any {
    const orConditions = [];

    if (filters.vinNumber) {
      orConditions.push({
        productName: { contains: filters.vinNumber },
      });
    }

    if (filters.registrationNumber) {
      orConditions.push({
        productReference: { contains: filters.registrationNumber },
      });
    }

    if (filters.oemCode) {
      orConditions.push({
        productReference: { contains: filters.oemCode },
      });
    }

    if (filters.hasVehicleData) {
      orConditions.push({
        OR: [
          { productName: { contains: 'VIN' } },
          { productName: { contains: 'VEHIC' } },
          { productReference: { contains: 'AUTO' } },
        ],
      });
    }

    return orConditions.length > 0 ? { OR: orConditions } : {};
  }
}
