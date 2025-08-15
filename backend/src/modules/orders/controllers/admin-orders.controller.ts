/**
 * Contrôleur Admin Orders pour NestJS - Version simplifiée
 * Gestion des commandes côté administration avec privilèges étendus
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Admin Orders')
@Controller('api/admin/orders')
export class AdminOrdersController {
  private readonly logger = new Logger(AdminOrdersController.name);

  @Get()
  async getAllOrders(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    this.logger.log(
      `Admin fetching all orders - Page: ${page}, Limit: ${limit}`,
    );

    try {
      const mockOrders = this.generateMockAdminOrders(
        Number(page),
        Number(limit),
        status,
      );

      return {
        success: true,
        data: {
          orders: mockOrders,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(100 / Number(limit)),
            totalCount: 100,
          },
        },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching admin orders: ${error.message}`);
      throw new HttpException(
        'Erreur lors de la récupération des commandes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':orderId')
  async getOrderDetail(@Param('orderId') orderId: string) {
    this.logger.log(`Admin fetching order detail for order: ${orderId}`);

    try {
      const mockOrder = this.generateMockAdminOrderDetail(orderId);

      if (!mockOrder) {
        throw new HttpException('Commande non trouvée', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: mockOrder,
      };
    } catch (error: any) {
      this.logger.error(
        `Error fetching admin order ${orderId}: ${error.message}`,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erreur lors de la récupération du détail de la commande',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() updateData: { status: number; notes?: string },
  ) {
    this.logger.log(
      `Admin updating order ${orderId} status to ${updateData.status}`,
    );

    try {
      const mockResult = {
        orderId,
        oldStatus: 2,
        newStatus: updateData.status,
        notes: updateData.notes,
        updatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: mockResult,
        message: 'Statut de la commande mis à jour avec succès',
      };
    } catch (error: any) {
      this.logger.error(
        `Error updating order ${orderId} status: ${error.message}`,
      );

      throw new HttpException(
        'Erreur lors de la mise à jour du statut de la commande',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private generateMockAdminOrders(
    page: number,
    limit: number,
    status?: string,
  ) {
    const orders = [];
    const startId = (page - 1) * limit + 1;

    for (let i = 0; i < limit; i++) {
      const orderId = startId + i;
      const orderStatus = status
        ? Number(status)
        : Math.floor(Math.random() * 6) + 1;

      orders.push({
        id: orderId.toString(),
        orderNumber: `CMD-${orderId.toString().padStart(6, '0')}`,
        status: orderStatus,
        totalTTC: Math.round((Math.random() * 500 + 50) * 100) / 100,
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        customerName: `Client ${orderId}`,
        customerEmail: `client${orderId}@example.com`,
        customerId: `user-${orderId}`,
        lines: [
          {
            id: `line-${orderId}-1`,
            productId: `prod-${(orderId % 10) + 1}`,
            productName: `Produit ${(orderId % 10) + 1}`,
            quantity: Math.floor(Math.random() * 3) + 1,
            unitPrice: Math.round(Math.random() * 100 * 100) / 100,
          },
        ],
      });
    }

    return orders;
  }

  private generateMockAdminOrderDetail(orderId: string) {
    if (!orderId || orderId === '0') {
      return null;
    }

    const basePrice = Math.round((Math.random() * 500 + 50) * 100) / 100;
    const shippingFee = 9.99;
    const tva = Math.round(basePrice * 0.2 * 100) / 100;

    return {
      id: orderId,
      orderNumber: `CMD-${orderId.padStart(6, '0')}`,
      status: 2,
      totalTTC: basePrice + shippingFee + tva,
      totalPrice: basePrice + shippingFee + tva,
      subtotalHT: basePrice,
      subtotalPrice: basePrice,
      tva: tva,
      shippingFee: shippingFee,
      deliveryPrice: shippingFee,
      discountAmount: 0,
      createdAt: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      updatedAt: new Date().toISOString(),
      paymentMethod: 'Carte bancaire',
      paymentStatus: 'Payé',
      transactionId: `txn_${Date.now()}`,
      trackingNumber: `FR${Date.now().toString().slice(-8)}`,
      deliveryMethod: 'Colissimo',

      customerName: `Client ${orderId}`,
      customerEmail: `client${orderId}@example.com`,
      customerPhone: '+33 1 23 45 67 89',
      customerId: `user-${orderId}`,

      lines: [
        {
          id: `line-${orderId}-1`,
          productId: `prod-${(Number(orderId) % 10) + 1}`,
          productName: `Produit Premium ${(Number(orderId) % 10) + 1}`,
          productRef: `REF-${(Number(orderId) % 10) + 1}`,
          productImage: '/images/placeholder.jpg',
          quantity: 2,
          unitPrice: Math.round((basePrice / 2) * 100) / 100,
          totalPrice: basePrice,
          status: 2,
        },
      ],

      shippingAddress: {
        firstName: 'Jean',
        lastName: 'Dupont',
        company: 'ACME Corp',
        address1: '123 Rue de la Paix',
        address2: 'Apt 4B',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },

      billingAddress: {
        firstName: 'Jean',
        lastName: 'Dupont',
        company: 'ACME Corp',
        address1: '123 Rue de la Paix',
        address2: 'Apt 4B',
        postalCode: '75001',
        city: 'Paris',
        country: 'France',
      },

      statusHistory: [
        {
          id: '1',
          status: 1,
          statusLabel: 'En attente',
          createdAt: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          notes: 'Commande créée',
          updatedBy: 'system',
        },
        {
          id: '2',
          status: 2,
          statusLabel: 'Confirmée',
          createdAt: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          notes: 'Commande confirmée par le client',
          updatedBy: 'admin',
        },
      ],

      adminNotes: 'Commande prioritaire - Client VIP',
      internalNotes: 'Produit en stock, expédition prévue demain',
    };
  }
}
