/**
 * 📦 CONTRÔLEUR ORDERS UNIFIÉ
 *
 * Contrôleur principal consolidé pour toutes les opérations liées aux commandes.
 * Remplace 6 contrôleurs obsolètes pour une architecture claire et maintenable.
 *
 * Architecture organisée en 4 sections :
 * 1. Routes CLIENT  : Authentification utilisateur (AuthenticatedGuard)
 * 2. Routes ADMIN   : Authentification + privilèges admin (IsAdminGuard)
 * 3. Routes LEGACY  : Compatibilité rétroactive (@deprecated)
 * 4. Routes TEST    : Endpoints de développement et tests
 *
 * Routes :
 * - Client  : /api/orders/* (AuthenticatedGuard)
 * - Admin   : /api/orders/admin/* (AuthenticatedGuard + IsAdminGuard)
 * - Legacy  : /api/orders/legacy/* (Compatibilité - à déprécier)
 * - Test    : /api/orders/test/* (Développement uniquement)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  Req,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import * as crypto from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { OptionalAuthGuard } from '../../../auth/guards/optional-auth.guard';
import { AuthService } from '../../../auth/auth.service';
import { MailService } from '../../../services/mail.service';
import { CacheService } from '../../../cache/cache.service';
import {
  OrdersService,
  CreateOrderData,
  OrderFilters,
} from '../services/orders.service';
import {
  promisifyLoginNoRegenerate,
  promisifySessionRegenerate,
  promisifySessionSave,
} from '../../../utils/promise-helpers';

/** Query parameters for order listing */
interface OrderListQuery {
  page?: string;
  limit?: string;
  status?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  customerId?: string;
}

/** Express session with Passport data */
interface PassportSession {
  passport?: { user?: { id: string } };
}

/** Authenticated request with user and session data */
type AuthenticatedRequest = ExpressRequest & {
  user?: {
    id?: string;
    id_utilisateur?: string;
    email?: string;
    [key: string]: unknown;
  };
};

/** Helper to extract userId from Passport-augmented request */
function getUserId(req: AuthenticatedRequest): string | undefined {
  const session = req.session as unknown as PassportSession | undefined;
  return req.user?.id || session?.passport?.user?.id;
}

@ApiTags('orders')
@Controller('api/orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly cacheService: CacheService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // 🔵 SECTION 1: ROUTES CLIENT (Authentification requise)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 📋 Lister les commandes de l'utilisateur connecté
   * GET /api/orders
   */
  @Get()
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Lister les commandes de l'utilisateur" })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'status', required: false, example: '6' })
  @ApiQuery({ name: 'year', required: false, example: '2025' })
  @ApiResponse({ status: 200, description: 'Liste des commandes' })
  async listMyOrders(
    @Query() query: OrderListQuery,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = getUserId(req);

      if (!userId) {
        throw new BadRequestException('Utilisateur non authentifié');
      }

      this.logger.log(`Listing orders for user ${userId}`);

      const filters: OrderFilters = {
        customerId: userId,
        status: query.status ? parseInt(query.status) : undefined,
        startDate: query.year
          ? new Date(`${query.year}-01-01`)
          : query.startDate
            ? new Date(query.startDate)
            : undefined,
        endDate: query.year
          ? new Date(`${query.year}-12-31`)
          : query.endDate
            ? new Date(query.endDate)
            : undefined,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
      };

      return await this.ordersService.listOrders(filters);
    } catch (error) {
      this.logger.error('Error listing user orders:', error);
      throw error;
    }
  }

  /**
   * 📖 Récupérer une commande spécifique
   * GET /api/orders/:id
   */
  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une commande par ID' })
  @ApiParam({ name: 'id', description: 'ID de la commande (string)' })
  @ApiResponse({ status: 200, description: 'Détails de la commande' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async getOrderById(
    @Param('id') orderId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = getUserId(req);
      this.logger.log(
        `Getting order ${orderId} for user ${userId || 'guest-session'}`,
      );

      const order = await this.ordersService.getOrderById(orderId);

      if (!order) {
        throw new NotFoundException('Commande non trouvée');
      }

      // Ownership check: user must own the order
      if (userId) {
        const orderCustomerId = String(order.ord_cst_id);
        const requestUserId = String(userId);
        if (orderCustomerId !== requestUserId) {
          this.logger.warn(
            `Access denied: user ${requestUserId} tried to access order ${orderId} owned by ${orderCustomerId}`,
          );
          throw new NotFoundException('Commande non trouvée');
        }
      } else {
        this.logger.warn(`Unauthenticated access attempt for order ${orderId}`);
        throw new NotFoundException('Commande non trouvée');
      }

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 🆕 Créer une nouvelle commande
   * POST /api/orders
   */
  @Post()
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une nouvelle commande' })
  @ApiResponse({ status: 201, description: 'Commande créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async createOrder(
    @Body() orderData: CreateOrderData,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = getUserId(req);

      if (!userId) {
        throw new BadRequestException('Utilisateur non authentifié');
      }

      this.logger.log(`Creating order for user ${userId}`);

      // S'assurer que le customerId correspond à l'utilisateur connecté
      const dataWithUserId = {
        ...orderData,
        customerId: userId,
      };

      return await this.ordersService.createOrder(dataWithUserId);
    } catch (error) {
      this.logger.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * 🆕 Guest checkout - Créer commande sans compte
   * POST /api/orders/guest
   */
  @Post('guest')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Créer une commande en tant qu'invité (guest checkout)",
  })
  @ApiResponse({ status: 201, description: 'Commande créée avec succès' })
  @ApiResponse({ status: 400, description: 'Email invalide' })
  @ApiResponse({
    status: 409,
    description: 'Email déjà enregistré - connexion requise',
  })
  async createGuestOrder(
    @Body() body: CreateOrderData & { guestEmail?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      // Si déjà authentifié, déléguer au flow normal
      const existingUserId = getUserId(req);
      if (existingUserId) {
        this.logger.log(
          `Guest checkout: user already authenticated (${existingUserId}), delegating to normal flow`,
        );
        return this.createOrder(body, req);
      }

      const { guestEmail, ...orderData } = body;

      if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
        throw new BadRequestException('Adresse email invalide');
      }

      this.logger.log(`Guest checkout for email: ${guestEmail}`);

      // Vérifier si l'email existe déjà
      const existingUser = await this.authService.checkIfUserExists({
        email: guestEmail,
      });
      if (existingUser) {
        throw new ConflictException(
          'Un compte existe déjà avec cet email. Veuillez vous connecter.',
        );
      }

      // Créer un compte silencieux avec mot de passe aléatoire
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const newUser = await this.authService.register({
        email: guestEmail,
        password: randomPassword,
        firstName: 'Invité',
        lastName: '',
      });

      this.logger.log(`Guest account created: ${newUser.id} for ${guestEmail}`);

      // Passport 0.7 + connect-redis 5.x compat
      await promisifySessionRegenerate(req.session);
      await promisifyLoginNoRegenerate(req as unknown as ExpressRequest, {
        id: newUser.id,
        email: newUser.email,
      });
      await promisifySessionSave(req.session);

      this.logger.log(`Guest session established for user ${newUser.id}`);

      // Créer la commande avec le nouveau userId
      const dataWithUserId = {
        ...orderData,
        customerId: newUser.id,
      };

      const order = await this.ordersService.createOrder(dataWithUserId);

      // Envoyer email d'activation compte guest (non bloquant)
      try {
        const activationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto
          .createHash('sha256')
          .update(activationToken)
          .digest('hex');

        // Stocker le token dans Redis (7 jours TTL)
        await this.cacheService.set(
          `guest_activation:${hashedToken}`,
          JSON.stringify({ userId: newUser.id, email: guestEmail }),
          7 * 24 * 60 * 60, // 7 jours
        );

        const orderRecord = order as Record<string, unknown>;
        const orderData = orderRecord?.data as
          | Record<string, unknown>
          | undefined;
        const orderId = (orderData?.ord_id || orderRecord?.ord_id) as
          | string
          | undefined;
        await this.mailService.sendGuestAccountActivation(
          guestEmail,
          activationToken,
          orderId,
        );
        this.logger.log(`📧 Email activation envoyé à ${guestEmail}`);
      } catch (emailError: unknown) {
        const errMsg =
          emailError instanceof Error ? emailError.message : String(emailError);
        this.logger.error(
          `Erreur envoi email activation (non bloquant): ${errMsg}`,
        );
      }

      return order;
    } catch (error) {
      this.logger.error('Error in guest checkout:', error);

      // Race condition: le compte a été créé entre checkIfUserExists et register
      if (error instanceof Error && error.message.includes('déjà utilisé')) {
        throw new ConflictException(
          'Un compte existe déjà avec cet email. Veuillez vous connecter.',
        );
      }

      throw error;
    }
  }

  /**
   * 🔄 Mettre à jour une commande (status, etc.)
   * PATCH /api/orders/:id
   */
  @Patch(':id')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour une commande' })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Commande mise à jour' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async updateOrder(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() updateData: { status?: number; comment?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = getUserId(req);
      this.logger.log(`Updating order ${orderId} by user ${userId}`);

      // TODO: Vérifier que l'utilisateur possède cette commande

      return await this.ordersService.updateOrder(String(orderId), updateData);
    } catch (error) {
      this.logger.error(`Error updating order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * ❌ Annuler une commande
   * DELETE /api/orders/:id
   */
  @Delete(':id')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Annuler une commande' })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 204, description: 'Commande annulée' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async cancelOrder(
    @Param('id', ParseIntPipe) orderId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const userId = getUserId(req);
      this.logger.log(`Cancelling order ${orderId} by user ${userId}`);

      // TODO: Vérifier que l'utilisateur possède cette commande

      await this.ordersService.cancelOrder(String(orderId));
    } catch (error) {
      this.logger.error(`Error cancelling order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 📊 Statistiques utilisateur
   * GET /api/orders/stats
   */
  @Get('customer/stats')
  @UseGuards(AuthenticatedGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Statistiques des commandes de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées' })
  async getMyStats(@Req() req: AuthenticatedRequest) {
    try {
      const userId = getUserId(req);

      if (!userId) {
        throw new BadRequestException('Utilisateur non authentifié');
      }

      this.logger.log(`Getting stats for user ${userId}`);

      const allOrders = await this.ordersService.listOrders({
        customerId: userId,
        limit: 1000,
      });

      const recentOrders = await this.ordersService.listOrders({
        customerId: userId,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        limit: 1000,
      });

      return {
        totalOrders: allOrders.pagination.total,
        recentOrders: recentOrders.data.length,
        lastWeekOrders: recentOrders.pagination.total,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔴 SECTION 2: ROUTES ADMIN (Authentification + IsAdmin requis)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 📋 Lister TOUTES les commandes (Admin)
   * GET /api/orders/admin/all
   */
  @Get('admin/all')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister toutes les commandes (Admin)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, example: '1' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiResponse({ status: 200, description: 'Liste complète des commandes' })
  async getAllOrders(@Query() query: OrderListQuery) {
    try {
      this.logger.log('Admin listing all orders with filters:', query);

      const filters: OrderFilters = {
        customerId: query.customerId || undefined,
        status: query.status ? parseInt(query.status) : undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      };

      return await this.ordersService.listOrders(filters);
    } catch (error) {
      this.logger.error('Error listing all orders (admin):', error);
      throw error;
    }
  }

  /**
   * 📖 Récupérer une commande (Admin - sans restriction)
   * GET /api/orders/admin/:id
   */
  @Get('admin/:id')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une commande (Admin)' })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Détails de la commande' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async getOrderByIdAdmin(@Param('id', ParseIntPipe) orderId: number) {
    try {
      this.logger.log(`Admin getting order ${orderId}`);
      const order = await this.ordersService.getOrderById(String(orderId));

      if (!order) {
        throw new NotFoundException('Commande non trouvée');
      }

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting order ${orderId} (admin):`, error);
      throw error;
    }
  }

  /**
   * 🔄 Changer le statut d'une commande (Admin)
   * PATCH /api/orders/admin/:id/status
   */
  @Patch('admin/:id/status')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Changer le statut d'une commande (Admin)" })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async updateOrderStatusAdmin(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() updateData: { status: number; comment?: string },
  ) {
    try {
      this.logger.log(
        `Admin updating order ${orderId} status to ${updateData.status}`,
      );
      return await this.ordersService.updateOrder(String(orderId), {
        status: updateData.status,
      });
    } catch (error) {
      this.logger.error(
        `Error updating order ${orderId} status (admin):`,
        error,
      );
      throw error;
    }
  }

  /**
   * 📊 Statistiques globales (Admin)
   * GET /api/orders/admin/stats
   */
  @Get('admin/stats/global')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Statistiques globales des commandes (Admin)' })
  @ApiResponse({ status: 200, description: 'Statistiques globales' })
  async getGlobalStats() {
    try {
      this.logger.log('Admin getting global stats');

      const allOrders = await this.ordersService.listOrders({ limit: 10000 });
      const recentOrders = await this.ordersService.listOrders({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
        limit: 10000,
      });

      return {
        totalOrders: allOrders.pagination.total,
        last30DaysOrders: recentOrders.pagination.total,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting global stats:', error);
      throw error;
    }
  }

  /**
   * 📋 Commandes d'un client spécifique (Admin)
   * GET /api/orders/admin/customer/:customerId
   */
  @Get('admin/customer/:customerId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Commandes d'un client (Admin)" })
  @ApiParam({ name: 'customerId', description: 'ID du client' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Commandes du client' })
  async getCustomerOrders(
    @Param('customerId') customerId: string,
    @Query() query: OrderListQuery,
  ) {
    try {
      this.logger.log(`Admin getting orders for customer ${customerId}`);

      const filters: OrderFilters = {
        customerId,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      };

      return await this.ordersService.listOrders(filters);
    } catch (error) {
      this.logger.error(
        `Error getting orders for customer ${customerId}:`,
        error,
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🟡 SECTION 3: ROUTES LEGACY (Compatibilité - À déprécier)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 📋 Liste legacy (compatibilité)
   * GET /api/orders/legacy
   */
  @Get('legacy/list')
  @ApiOperation({
    summary: 'Liste commandes (Legacy - à déprécier)',
    deprecated: true,
  })
  @ApiResponse({ status: 200, description: 'Liste legacy' })
  async listOrdersLegacy(@Query() query: OrderListQuery) {
    try {
      this.logger.warn('LEGACY endpoint called: GET /api/orders/legacy/list');

      const filters: OrderFilters = {
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      };

      return await this.ordersService.listOrders(filters);
    } catch (error) {
      this.logger.error('Error in legacy list:', error);
      throw error;
    }
  }

  /**
   * 📖 Détail legacy
   * GET /api/orders/legacy/:id/details
   */
  @Get('legacy/:id/details')
  @ApiOperation({
    summary: 'Détail commande (Legacy - à déprécier)',
    deprecated: true,
  })
  @ApiParam({ name: 'id', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Détails legacy' })
  async getOrderDetailsLegacy(@Param('id', ParseIntPipe) orderId: number) {
    try {
      this.logger.warn(
        `LEGACY endpoint called: GET /api/orders/legacy/${orderId}/details`,
      );
      return await this.ordersService.getOrderById(String(orderId));
    } catch (error) {
      this.logger.error(`Error in legacy detail for ${orderId}:`, error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 SECTION 4: ROUTES DE TEST (Développement uniquement)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 🧪 Endpoint de test - Créer commande mock
   * POST /api/orders/test/create
   */
  @Post('test/create')
  @ApiOperation({ summary: 'Créer commande de test (DEV)' })
  @ApiResponse({ status: 201, description: 'Commande test créée' })
  async testCreateOrder(@Body() testData?: { customerId?: string | number }) {
    try {
      // Utiliser customerId fourni ou celui de monia123@gmail.com par défaut
      const customerId = testData?.customerId || 'usr_1759774640723_njikmiz59';

      this.logger.log(
        `Creating test order with mock data for customer ${customerId}`,
      );

      const mockOrderData: CreateOrderData = {
        customerId: String(customerId),
        orderLines: [
          {
            productId: 'TEST001',
            productName: 'Produit Test Phase 3',
            productReference: 'REF-P3-001',
            quantity: 2,
            unitPrice: 49.99,
            vatRate: 20,
            discount: 0,
          },
          {
            productId: 'TEST002',
            productName: 'Produit Test Phase 3 - 2',
            productReference: 'REF-P3-002',
            quantity: 1,
            unitPrice: 29.99,
            vatRate: 20,
            discount: 10,
          },
        ],
        billingAddress: {
          firstName: 'Test',
          lastName: 'Phase3',
          address: '123 rue Consolidation',
          zipCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        shippingAddress: {
          firstName: 'Test',
          lastName: 'Phase3',
          address: '123 rue Consolidation',
          zipCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        customerNote: 'Commande test Phase 3 - Consolidation contrôleurs',
        shippingMethod: 'standard',
      };

      const result = await this.ordersService.createOrder(mockOrderData);

      return {
        message: '✅ Commande test Phase 3 créée avec succès',
        order: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error creating test order:', error);
      throw error;
    }
  }

  /**
   * 🆕 Phase 5: Créer commande test AVEC CONSIGNES
   * POST /api/orders/test/create-with-consignes
   */
  @Post('test/create-with-consignes')
  @ApiOperation({ summary: 'Créer commande test avec consignes (Phase 5)' })
  @ApiResponse({ status: 201, description: 'Commande avec consignes créée' })
  async testCreateOrderWithConsignes(
    @Body() testData?: { customerId?: string | number },
  ) {
    try {
      const customerId = testData?.customerId || 'usr_1759774640723_njikmiz59';

      this.logger.log(
        `✅ Phase 5: Creating test order WITH CONSIGNES for customer ${customerId}`,
      );

      const mockOrderData: CreateOrderData = {
        customerId: String(customerId),
        orderLines: [
          {
            productId: '3047339',
            productName: 'Alternateur CEVAM',
            productReference: '4561',
            quantity: 2,
            unitPrice: 168.59,
            vatRate: 20,
            discount: 0,
            consigne_unit: 72, // ✅ Consigne unitaire
            has_consigne: true, // ✅ Produit avec consigne
          },
        ],
        billingAddress: {
          firstName: 'Test',
          lastName: 'Phase5',
          address: '123 rue Consignes',
          zipCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        shippingAddress: {
          firstName: 'Test',
          lastName: 'Phase5',
          address: '123 rue Consignes',
          zipCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        customerNote:
          '✅ Phase 5: Test commande avec consignes alternateur (2x 72€ = 144€)',
        shippingMethod: 'standard',
      };

      const result = await this.ordersService.createOrder(mockOrderData);

      return {
        message: '✅ Phase 5: Commande avec consignes créée avec succès',
        order: result,
        consignes_info: {
          consigne_unit: 72,
          quantity: 2,
          consigne_total: 144,
          note: 'Les consignes sont stockées dans ord_deposit_ttc',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error creating test order with consignes:', error);
      throw error;
    }
  }

  /**
   * 📊 Statistiques rapides (test)
   * GET /api/orders/test/stats
   */
  @Get('test/stats')
  @ApiOperation({ summary: 'Statistiques de test (DEV)' })
  @ApiResponse({ status: 200, description: 'Stats de test' })
  async testStats() {
    try {
      this.logger.log('Getting test stats');

      const allOrders = await this.ordersService.listOrders({ limit: 1000 });

      return {
        message: '✅ Stats Phase 3',
        total: allOrders.pagination.total,
        retrieved: allOrders.data.length,
        pagination: allOrders.pagination,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting test stats:', error);
      throw error;
    }
  }
}
