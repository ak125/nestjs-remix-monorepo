/**
 * Messages Module - Index d'exports
 * Facilite l'importation des composants du module depuis d'autres modules
 */

// Module principal
export { MessagesModule } from './messages.module';

// Services
export { MessagesService } from './messages.service';
export { MessageDataService } from './repositories/message-data.service';

// Controller
export { MessagesController } from './messages.controller';

// WebSocket Gateway
export { MessagingGateway } from './messaging.gateway';

// Types et interfaces
export type { ModernMessage, MessageFilters } from './repositories/message-data.service';
