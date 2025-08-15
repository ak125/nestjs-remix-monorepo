import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('orders')
@Controller('api/orders')
@UseGuards(AuthenticatedGuard)
export class OrdersSimpleController {
  private readonly logger = new Logger(OrdersSimpleController.name);

  @Get('customer/:userId')
  @ApiOperation({ summary: "Récupérer les commandes d'un utilisateur" })
  @ApiParam({
    name: 'userId',
    description: "ID de l'utilisateur",
    example: 'usr_1752842636126_j88bat3bh',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page",
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Statut des commandes',
    example: 'all',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Année des commandes',
    example: '2024',
  })
  @ApiResponse({
    status: 200,
    description: 'Commandes récupérées avec succès',
  })
  async getUserOrders(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('year') year?: string,
  ) {
    this.logger.log(
      `GET /api/orders/customer/${userId} - Page: ${page}, Limit: ${limit}, Status: ${status}, Year: ${year}`,
    );

    try {
      // Pour l'instant, retournons des données de démonstration
      // TODO: Intégrer avec un vrai service de commandes
      const demoOrders = [
        {
          id: `order_${Date.now()}_1`,
          orderNumber: `CMD-${Date.now()}-001`,
          status: 6, // Livrée
          totalTTC: 89.99,
          createdAt: new Date('2024-01-15').toISOString(),
          lines: [
            {
              id: `line_${Date.now()}_1`,
              productId: 'prod_001',
              productName: 'Produit de démonstration 1',
              productImage:
                'https://via.placeholder.com/150x150/cccccc/666666?text=Produit+1',
              quantity: 2,
              unitPrice: 29.99,
            },
            {
              id: `line_${Date.now()}_2`,
              productId: 'prod_002',
              productName: 'Produit de démonstration 2',
              productImage:
                'https://via.placeholder.com/150x150/cccccc/666666?text=Produit+2',
              quantity: 1,
              unitPrice: 30.01,
            },
          ],
        },
        {
          id: `order_${Date.now()}_2`,
          orderNumber: `CMD-${Date.now()}-002`,
          status: 3, // En préparation
          totalTTC: 45.5,
          createdAt: new Date('2024-01-10').toISOString(),
          lines: [
            {
              id: `line_${Date.now()}_3`,
              productId: 'prod_003',
              productName: 'Produit de démonstration 3',
              productImage:
                'https://via.placeholder.com/150x150/cccccc/666666?text=Produit+3',
              quantity: 1,
              unitPrice: 45.5,
            },
          ],
        },
      ];

      // Filtrage par statut si spécifié
      let filteredOrders = demoOrders;
      if (status && status !== 'all') {
        const statusNum = parseInt(status);
        filteredOrders = demoOrders.filter(
          (order) => order.status === statusNum,
        );
      }

      // Pagination simulée
      const totalCount = filteredOrders.length;
      const totalPages = Math.ceil(totalCount / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

      return {
        success: true,
        orders: paginatedOrders,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching orders for user ${userId}:`, error);

      return {
        success: false,
        orders: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
        },
        error: 'Failed to fetch orders',
      };
    }
  }

  @Get('customer/:userId/:orderId')
  @ApiOperation({ summary: "Récupérer une commande spécifique d'un client" })
  @ApiParam({
    name: 'userId',
    description: "ID de l'utilisateur",
    example: 'usr_1752842636126_j88bat3bh',
  })
  @ApiParam({
    name: 'orderId',
    description: 'ID de la commande',
    example: '12345',
  })
  @ApiResponse({
    status: 200,
    description: 'Commande récupérée avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Commande non trouvée ou accès non autorisé',
  })
  async getCustomerOrder(
    @Param('userId') userId: string,
    @Param('orderId') orderId: string,
  ) {
    try {
      this.logger.log(`GET /api/orders/customer/${userId}/${orderId}`);

      // TODO: Implémenter la récupération d'une commande spécifique
      // Pour l'instant, retourner des données de test
      const mockOrder = {
        id: orderId,
        orderNumber: `CMD-${orderId}`,
        status: 6,
        totalTTC: 299.99,
        createdAt: '2025-01-15T10:30:00Z',
        lines: [
          {
            id: '1',
            productName: 'Produit Test 1',
            productRef: 'REF001',
            quantity: 2,
            unitPrice: 99.99,
            totalPrice: 199.98,
            status: 6,
            productImage:
              'https://via.placeholder.com/150x150/cccccc/666666?text=Produit+1',
          },
          {
            id: '2',
            productName: 'Produit Test 2',
            productRef: 'REF002',
            quantity: 1,
            unitPrice: 100.01,
            totalPrice: 100.01,
            status: 6,
            productImage:
              'https://via.placeholder.com/150x150/cccccc/666666?text=Produit+2',
          },
        ],
        subtotalHT: 250.0,
        tva: 49.99,
        shippingFee: 0.0,
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          address1: '123 Rue de la Paix',
          postalCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        billingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          address1: '123 Rue de la Paix',
          postalCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        paymentMethod: 'Carte bancaire',
        paymentStatus: 'Payé',
        trackingNumber: 'TRK123456789',
        statusHistory: [
          {
            label: 'Commande passée',
            date: '2025-01-15T10:30:00Z',
            isActive: true,
          },
          {
            label: 'Paiement confirmé',
            date: '2025-01-15T10:35:00Z',
            isActive: true,
          },
          {
            label: 'En préparation',
            date: '2025-01-15T14:00:00Z',
            isActive: true,
          },
          {
            label: 'Expédiée',
            date: '2025-01-16T09:00:00Z',
            isActive: true,
          },
          {
            label: 'Livrée',
            date: '2025-01-17T16:30:00Z',
            isActive: true,
          },
        ],
      };

      return {
        success: true,
        data: mockOrder,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de la commande ${orderId} pour l'utilisateur ${userId}:`,
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération de la commande',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
