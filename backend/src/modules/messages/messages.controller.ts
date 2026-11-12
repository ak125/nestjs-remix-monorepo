/**
 * Contrôleur API Messages - Table ___xtr_msg
 * Gestion des communications client/staff - Architecture moderne avec Zod
 *
 * Frontière d'accès : toute route exige une session. Un administrateur lit et
 * agit sur tous les messages ; un client seulement sur les siens, et son
 * identifiant vient de sa session, jamais de la requête. Une session du
 * personnel sous le niveau administrateur est refusée : son identifiant n'est
 * pas un identifiant client.
 *
 * Classification exhaustive : backend/tests/unit/messages-routes-authz.test.ts
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  Logger,
  HttpException,
  ForbiddenException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AuthSource, STAFF_LEVEL } from '@auth/session-privilege';
import { MessagesService } from './messages.service';
import {
  OperationFailedException,
  DomainNotFoundException,
  DomainValidationException,
} from '@common/exceptions';

/** Extract message string from an unknown error */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Check if an unknown error has a specific HTTP status */
function hasHttpStatus(error: unknown, status: number): boolean {
  if (error instanceof HttpException) return error.getStatus() === status;
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  ) {
    return (error as Record<string, unknown>).status === status;
  }
  return false;
}

interface SessionUser {
  id?: string | number;
  level?: string | number;
  isAdmin?: boolean;
  authSource?: AuthSource;
}

/** Appelant d'une route : administrateur, ou client titulaire de ses messages. */
interface Caller {
  id: string;
  isAdmin: boolean;
}

/**
 * Lit l'appelant sur la session. Même règle qu'`IsAdminGuard` pour
 * l'administrateur ; sinon seule une session ouverte par un compte client est
 * titulaire de messages.
 */
function resolveCaller(request: Express.Request): Caller {
  const session = (request.user ?? {}) as SessionUser;
  const id = session.id === undefined ? '' : String(session.id);
  const level = parseInt(String(session.level ?? 0), 10) || 0;

  if (session.isAdmin === true || level >= STAFF_LEVEL.ADMIN) {
    return { id, isAdmin: true };
  }
  if (session.authSource === 'customer' && id !== '') {
    return { id, isAdmin: false };
  }
  throw new ForbiddenException('Access denied');
}

/**
 * Client au nom duquel la route agit. Un client n'agit que pour lui-même ; un
 * administrateur nomme le client dans la requête.
 */
function actingCustomerId(
  caller: Caller,
  claimed: string | undefined,
): string | undefined {
  if (caller.isAdmin) return claimed;
  if (claimed !== undefined && String(claimed) !== caller.id) {
    throw new ForbiddenException('Access denied');
  }
  return caller.id;
}

/** Comme `actingCustomerId`, pour une route qui ne peut pas agir sans client. */
function requireActingCustomerId(
  caller: Caller,
  claimed: string | undefined,
  field: string,
): string {
  const customerId = actingCustomerId(caller, claimed);
  if (customerId === undefined || customerId === '') {
    throw new DomainValidationException({
      message: `${field} est requis`,
      field,
    });
  }
  return customerId;
}

/** Le message d'un autre client répond comme un message absent. */
function assertHolder(caller: Caller, message: { customerId: string }): void {
  if (caller.isAdmin) return;
  if (String(message.customerId) !== caller.id) {
    throw new DomainNotFoundException({ message: 'Message non trouvé' });
  }
}

@Controller('api/messages')
@UseGuards(AuthenticatedGuard)
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Récupérer la liste des messages avec filtres
   * GET /api/messages?page=1&limit=20&staff=123&customer=456&status=open
   */
  @Get()
  async getMessages(
    @Req() request: Express.Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('staff') staffId?: string,
    @Query('customer') customerId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log('API Messages: GET /api/messages');

    // Hors du `try` : un refus ne doit pas devenir une erreur serveur.
    const scopedCustomerId = actingCustomerId(
      resolveCaller(request),
      customerId,
    );

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      const filters = {
        page: pageNum,
        limit: limitNum,
        staffId,
        customerId: scopedCustomerId,
        search,
        status: (status as 'open' | 'closed' | 'all') || 'all',
      };

      const result = await this.messagesService.getMessages(filters);

      this.logger.log(`API Messages: ${result.total} messages trouvés`);
      return {
        success: true,
        data: result.messages,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la récupération des messages',
      });
    }
  }

  /**
   * Récupérer un message spécifique
   * GET /api/messages/:id
   */
  @Get(':id')
  async getMessageById(
    @Req() request: Express.Request,
    @Param('id') messageId: string,
  ) {
    this.logger.log(`API Messages: GET /api/messages/${messageId}`);

    const caller = resolveCaller(request);

    try {
      const message = await this.messagesService.getMessageById(messageId);

      assertHolder(caller, message);

      this.logger.log(`API Messages: Message ${messageId} trouvé`);
      return {
        success: true,
        data: message,
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);

      if (hasHttpStatus(error, 404)) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé',
        });
      }

      throw new OperationFailedException({
        message: 'Erreur serveur lors de la récupération du message',
      });
    }
  }

  /**
   * Créer un nouveau message
   * POST /api/messages
   */
  @Post()
  async createMessage(
    @Req() request: Express.Request,
    @Body()
    messageData: {
      customerId?: string;
      staffId: string;
      orderId?: string;
      subject: string;
      content: string;
      priority?: 'low' | 'normal' | 'high';
    },
  ) {
    this.logger.log('API Messages: POST /api/messages');

    const customerId = requireActingCustomerId(
      resolveCaller(request),
      messageData?.customerId,
      'customerId',
    );

    try {
      const newMessage = await this.messagesService.createMessage({
        ...messageData,
        customerId,
      });

      this.logger.log(`API Messages: Nouveau message créé ${newMessage.id}`);
      return {
        success: true,
        data: newMessage,
        message: 'Message créé avec succès',
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la création du message',
      });
    }
  }

  /**
   * Fermer un message
   * PUT /api/messages/:id/close
   */
  @Put(':id/close')
  @UseGuards(IsAdminGuard)
  async closeMessage(@Param('id') messageId: string) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/close`);

    try {
      const message = await this.messagesService.closeMessage(messageId);

      this.logger.log(`API Messages: Message ${messageId} fermé`);
      return {
        success: true,
        data: message,
        message: 'Message fermé avec succès',
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la fermeture du message',
      });
    }
  }

  /**
   * Marquer un message comme lu
   * PUT /api/messages/:id/read
   */
  @Put(':id/read')
  async markAsRead(
    @Req() request: Express.Request,
    @Param('id') messageId: string,
    @Body() body?: { readerId?: string },
  ) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/read`);

    const caller = resolveCaller(request);
    if (!caller.isAdmin) {
      assertHolder(
        caller,
        await this.messagesService.getMessageById(messageId),
      );
    }

    try {
      // Le lecteur d'un client est le client de la session.
      const readerId = caller.isAdmin
        ? body?.readerId || caller.id || 'unknown'
        : caller.id;
      const message = await this.messagesService.markAsRead(
        messageId,
        readerId,
      );

      this.logger.log(
        `API Messages: Message ${messageId} marqué comme lu par ${readerId}`,
      );
      return {
        success: true,
        data: message,
        message: 'Message marqué comme lu',
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors du marquage du message',
      });
    }
  }

  /**
   * Récupérer les statistiques des messages
   * GET /api/messages/stats?customer=123
   */
  @Get('stats')
  async getMessageStats(
    @Req() request: Express.Request,
    @Query('customer') customerId?: string,
  ) {
    this.logger.log('API Messages: GET /api/messages/stats');

    const scopedCustomerId = actingCustomerId(
      resolveCaller(request),
      customerId,
    );

    try {
      const stats = await this.messagesService.getStatistics(scopedCustomerId);

      this.logger.log('API Messages: Statistiques calculées');
      return {
        success: true,
        data: stats,
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Stats Error: ${getErrorMessage(error)}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors du calcul des statistiques',
      });
    }
  }

  /**
   * Récupérer les statistiques des messages visibles par l'appelant :
   * globales pour un administrateur, les siennes pour un client.
   * GET /api/messages/stats/overview
   */
  @Get('stats/overview')
  async getMessageStatsOverview(@Req() request: Express.Request) {
    this.logger.log('API Messages: GET /api/messages/stats/overview');

    const caller = resolveCaller(request);

    try {
      const stats = await this.messagesService.getStatistics(
        caller.isAdmin ? undefined : caller.id,
      );

      this.logger.log('API Messages: Statistiques calculées');
      return {
        success: true,
        data: stats,
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Stats Error: ${getErrorMessage(error)}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors du calcul des statistiques',
      });
    }
  }

  /**
   * Récupérer la liste des clients
   * GET /api/messages/customers
   */
  @Get('customers')
  @UseGuards(IsAdminGuard)
  async getCustomers(@Query('limit') limit?: string) {
    this.logger.log('API Messages: GET /api/messages/customers');

    try {
      const limitNum = parseInt(limit || '100', 10);
      const customers = await this.messagesService.getCustomers(limitNum);

      this.logger.log(`API Messages: ${customers.length} clients trouvés`);
      return {
        success: true,
        data: customers,
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la récupération des clients',
      });
    }
  }

  /**
   * Archiver un message
   * PUT /api/messages/:id/archive
   */
  @Put(':id/archive')
  async archiveMessage(
    @Req() request: Express.Request,
    @Param('id') messageId: string,
    @Body() body?: { userId?: string },
  ) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/archive`);

    const userId = requireActingCustomerId(
      resolveCaller(request),
      body?.userId,
      'userId',
    );

    try {
      const message = await this.messagesService.archiveMessage(
        messageId,
        userId,
      );

      this.logger.log(`API Messages: Message ${messageId} archivé`);
      return {
        success: true,
        data: message,
        message: 'Message archivé avec succès',
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);

      if (hasHttpStatus(error, 404)) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé ou accès refusé',
        });
      }

      throw new OperationFailedException({
        message: "Erreur serveur lors de l'archivage du message",
      });
    }
  }

  /**
   * Supprimer un message
   * PUT /api/messages/:id/delete
   */
  @Put(':id/delete')
  async deleteMessage(
    @Req() request: Express.Request,
    @Param('id') messageId: string,
    @Body() body?: { userId?: string },
  ) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/delete`);

    const userId = requireActingCustomerId(
      resolveCaller(request),
      body?.userId,
      'userId',
    );

    try {
      await this.messagesService.deleteMessage(messageId, userId);

      this.logger.log(`API Messages: Message ${messageId} supprimé`);
      return {
        success: true,
        message: 'Message supprimé avec succès',
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);

      if (hasHttpStatus(error, 404)) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé ou accès refusé',
        });
      }

      throw new OperationFailedException({
        message: 'Erreur serveur lors de la suppression du message',
      });
    }
  }

  /**
   * Répondre à un message
   * POST /api/messages/:id/reply
   */
  @Post(':id/reply')
  async replyToMessage(
    @Req() request: Express.Request,
    @Param('id') messageId: string,
    @Body() body?: { userId?: string; content?: string },
  ) {
    this.logger.log(`API Messages: POST /api/messages/${messageId}/reply`);

    const userId = requireActingCustomerId(
      resolveCaller(request),
      body?.userId,
      'userId',
    );
    const content = body?.content;
    if (typeof content !== 'string' || content === '') {
      throw new DomainValidationException({
        message: 'content est requis',
        field: 'content',
      });
    }

    try {
      const replyMessage = await this.messagesService.replyToMessage(
        messageId,
        userId,
        content,
      );

      this.logger.log(
        `API Messages: Réponse créée ${replyMessage.id} pour message ${messageId}`,
      );
      return {
        success: true,
        data: replyMessage,
        message: 'Réponse envoyée avec succès',
      };
    } catch (error: unknown) {
      this.logger.error(`API Messages Error: ${getErrorMessage(error)}`);

      if (hasHttpStatus(error, 404)) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé ou accès refusé',
        });
      }

      throw new OperationFailedException({
        message: "Erreur serveur lors de l'envoi de la réponse",
      });
    }
  }
}
