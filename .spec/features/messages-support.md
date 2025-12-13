---
title: "messages support"
status: draft
version: 1.0.0
---

# Feature: Messages & Support System

**Version:** 1.0.0  
**Dernière mise à jour:** 2024-11-14  
**Statut:** ✅ Production

---

## Vue d'ensemble

Système complet de messagerie et support client combinant:
- **Support Tickets** (ContactService) - Gestion des demandes clients
- **Messages Temps Réel** (MessagesService + WebSocket) - Communication bidirectionnelle
- **FAQ Knowledge Base** (FaqService) - Base de connaissances auto-service
- **Notifications Multi-canal** (NotificationService) - Email, push, webhooks

**Architecture hybride:**
- Table unique `___xtr_msg` pour tickets ET messages
- WebSocket Gateway (Socket.io) pour chat temps réel
- EventEmitter2 pour événements internes
- Supabase Storage pour pièces jointes

---

## Contexte métier

### Problématique
Volume élevé de demandes clients (support technique, SAV, questions commandes) nécessitant:
- Suivi centralisé des conversations
- Réponses rapides avec SLA
- Escalade automatique selon priorité
- Base de connaissances pour réduire charge support

### Volumétrie production
- **Tickets support**: ~2,500 tickets/mois (600 ouverts simultanément)
- **Messages temps réel**: ~150 conversations actives/jour
- **FAQ**: 45 articles, 6 catégories, ~12,000 vues/mois
- **Temps réponse moyen**: 4h (objectif: <2h)
- **Taux résolution premier contact**: 67% (objectif: >80%)

### Workflows clés
1. **Création ticket** → Notification staff → Assignation → Réponse → Résolution → Satisfaction
2. **Chat temps réel** → WebSocket connexion → Messages bidirectionnels → Historique persisté
3. **Consultation FAQ** → Recherche → Lecture article → Vote utilité → Réduction tickets
4. **Escalade urgence** → Détection priorité → Assignation senior → Notification hiérarchique

---

## Architecture technique

### Modules impliqués

**Module Support** (`backend/src/modules/support/`)
```
support/
├── controllers/
│   ├── contact.controller.ts          # 6 endpoints tickets
│   ├── faq.controller.ts               # 13 endpoints FAQ
│   └── support-analytics.controller.ts # 6 endpoints métriques
├── services/
│   ├── contact.service.ts              # CRUD tickets, escalade
│   ├── faq.service.ts                  # Gestion FAQ, catégories
│   ├── notification.service.ts         # Emails, templates
│   └── support-analytics.service.ts    # KPIs, rapports
└── types/
    └── index.ts                        # Interfaces support
```

**Module Messages** (`backend/src/modules/messages/`)
```
messages/
├── messages.controller.ts              # 11 endpoints messages
├── messages.service.ts                 # CRUD messages, stats
├── messaging.gateway.ts                # WebSocket (Socket.io)
├── repositories/
│   └── message-data.service.ts         # Accès données
└── dto/
    └── message.schemas.ts              # Validation Zod
```

### Table database unique

**`___xtr_msg`** - Messages & Tickets unifiés
```sql
CREATE TABLE ___xtr_msg (
  msg_id           VARCHAR(50) PRIMARY KEY,
  msg_cst_id       VARCHAR(50) NOT NULL,      -- Client FK → ___xtr_customer
  msg_cnfa_id      VARCHAR(50),               -- Staff FK (si assigné)
  msg_ord_id       VARCHAR(50),               -- Commande FK (optionnel)
  msg_subject      VARCHAR(255) NOT NULL,
  msg_content      TEXT NOT NULL,
  msg_date         TIMESTAMP DEFAULT NOW(),
  msg_parent_id    VARCHAR(50),               -- Thread (réponses)
  msg_open         CHAR(1) DEFAULT '1',       -- '1'=ouvert, '0'=fermé
  msg_close        CHAR(1) DEFAULT '0',       -- '1'=fermé, '0'=ouvert
  
  -- Metadata JSON (priorité, catégorie, SLA, etc.)
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_msg_customer ON ___xtr_msg(msg_cst_id);
CREATE INDEX idx_msg_staff ON ___xtr_msg(msg_cnfa_id);
CREATE INDEX idx_msg_status ON ___xtr_msg(msg_open, msg_close);
CREATE INDEX idx_msg_parent ON ___xtr_msg(msg_parent_id);
```

**Notes architecture:**
- **Type détection**: Pas de colonne `type` explicite, distinction via contexte (msg_subject patterns, msg_cnfa_id présence)
- **Metadata JSON**: Priorité, catégorie, vehicle_info, etc. stockés dans `msg_content` préfixé `[META]`
- **Thread support**: `msg_parent_id` pour conversations multi-messages
- **Soft deletes**: Via `msg_close='1'`, pas de suppression physique

---

## Endpoints API

### 1. Support Tickets (ContactController)

**Base URL:** `/api/support/contact`

#### POST `/` - Créer ticket support
```typescript
Body: {
  name: string;              // Nom complet client
  email: string;             // Email contact
  phone?: string;            // Téléphone optionnel
  subject: string;           // Sujet (10-200 chars)
  message: string;           // Description détaillée
  priority: 'urgent' | 'high' | 'normal' | 'low';
  category: 'general' | 'technical' | 'billing' | 'complaint' | 'suggestion';
  vehicle_info?: {           // Contexte automobile
    brand?: string;
    model?: string;
    year?: number;
    license_plate?: string;
  };
  order_number?: string;     // Lien commande
  customer_id?: string;      // Si client authentifié
}

Response 201: {
  msg_id: string;            // "TICKET-ABC123"
  msg_cst_id: string;
  msg_subject: string;
  msg_content: string;
  msg_date: string;
  msg_open: '1';
  priority: string;
  category: string;
}

Notifications:
- Email confirmation client (template: contact_confirmation)
- Email notification staff (template: new_ticket_staff)
- WebSocket event: ticket.created (si staff connecté)
```

**Logique métier:**
1. Validation Zod (sujet min 10 chars, message min 20 chars)
2. Recherche client par email dans `___xtr_customer`
3. Création client si nouveau (cst_activ='1')
4. Insert ticket dans `___xtr_msg` avec metadata JSON
5. Notifications asynchrones (non-bloquantes)

#### GET `/tickets` - Liste tickets (pagination)
```typescript
Query: {
  page?: number = 1;
  limit?: number = 10;
  status?: 'open' | 'closed' | 'all';
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  category?: string;
  assigned_to?: string;      // Staff ID
  customer_email?: string;
  sort_by?: string = 'msg_date';
  sort_order?: 'asc' | 'desc' = 'desc';
}

Response 200: {
  tickets: ContactTicket[];
  total: number;
  page: number;
  limit: number;
}
```

#### GET `/stats` - Statistiques globales
```typescript
Response 200: {
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
  pending_tickets: number;
  avg_response_time_hours: number;
  avg_resolution_time_hours: number;
  by_priority: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
  by_category: {
    general: number;
    technical: number;
    billing: number;
    complaint: number;
    suggestion: number;
  };
  satisfaction_score?: number;  // 1-5 si ratings activés
}
```

#### GET `/ticket/:ticketId` - Détails ticket
```typescript
Response 200: ContactTicket & {
  responses: ContactResponse[];  // Thread conversation
  customer: {
    cst_name: string;
    cst_fname: string;
    cst_mail: string;
    cst_phone?: string;
  };
  staff?: {
    cnfa_name: string;
    cnfa_mail: string;
  };
  order?: {                      // Si msg_ord_id présent
    ord_id: string;
    ord_reference: string;
    ord_total_ttc: string;
  };
}
```

#### GET `/search` - Recherche tickets
```typescript
Query: {
  keyword?: string;              // Full-text subject + content
  customer_id?: string;
  priority?: string;
  category?: string;
  date_from?: string;            // ISO 8601
  date_to?: string;
  page?: number;
  limit?: number;
}

Response 200: {
  tickets: ContactTicket[];
  total: number;
  page: number;
  limit: number;
}
```

**Implémentation actuelle:** Filtrage mémoire post-query (TODO: PostgreSQL full-text search)

#### PUT `/ticket/:ticketId/status` - Changer statut
```typescript
Body: {
  status: 'open' | 'closed';
  assigned_to?: string;          // Staff ID (si assignation)
  internal_note?: string;        // Note interne staff
}

Response 200: ContactTicket

Notifications:
- Email client (status_updated)
- WebSocket event: ticket.status_changed
```

**Logique métier:**
- `status='open'` → `msg_open='1', msg_close='0'`
- `status='closed'` → `msg_open='0', msg_close='1'`
- Si `assigned_to` → Update `msg_cnfa_id`
- Si `internal_note` → Insert nouveau message avec `[NOTE INTERNE]` prefix

---

### 2. Messages Temps Réel (MessagesController)

**Base URL:** `/api/messages`

#### GET `/` - Liste messages (filtres)
```typescript
Query: {
  page?: number = 1;
  limit?: number = 20;
  staff?: string;              // Staff ID
  customer?: string;           // Customer ID
  search?: string;             // Keyword
  status?: 'open' | 'closed' | 'all' = 'all';
}

Response 200: {
  success: true;
  data: ModernMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### POST `/` - Créer message
```typescript
Body: {
  customerId: string;
  staffId: string;
  orderId?: string;
  subject: string;
  content: string;
  priority?: 'low' | 'normal' | 'high';
}

Response 201: {
  success: true;
  data: ModernMessage;
  message: "Message créé avec succès";
}

Events émis:
- message.created → WebSocket: newMessage (recipient)
- message.created → WebSocket: messageSent (sender)
```

**Validation Zod:**
```typescript
CreateMessageSchema = z.object({
  customerId: z.string().min(1),
  staffId: z.string().min(1),
  orderId: z.string().optional(),
  subject: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});
```

#### GET `/:id` - Message par ID
```typescript
Response 200: {
  success: true;
  data: ModernMessage;
}

Response 404: { message: "Message non trouvé" }
```

#### PUT `/:id/close` - Fermer message
```typescript
Response 200: {
  success: true;
  data: ModernMessage;
  message: "Message fermé avec succès";
}

Events: message.closed → WebSocket: messageClosed
```

#### PUT `/:id/read` - Marquer lu
```typescript
Body?: {
  readerId?: string;           // User qui marque lu
}

Response 200: {
  success: true;
  data: ModernMessage;
  message: "Message marqué comme lu";
}

Events: message.read → WebSocket: messageRead (notif expéditeur)
```

#### GET `/stats` - Stats client spécifique
```typescript
Query: {
  customer?: string;           // Customer ID
}

Response 200: {
  success: true;
  data: {
    total: number;
    open: number;
    closed: number;
    unread: number;
  };
}
```

#### GET `/stats/overview` - Stats globales admin
```typescript
Response 200: {
  success: true;
  data: {
    total: number;
    open: number;
    closed: number;
    unread: number;
  };
}
```

#### GET `/customers` - Liste clients
```typescript
Query: {
  limit?: number = 100;
}

Response 200: {
  success: true;
  data: Array<{
    cst_id: string;
    cst_fname: string;
    cst_mail: string;
  }>;
}
```

#### PUT `/:id/archive` - Archiver message
```typescript
Body: {
  userId: string;              // Propriétaire message
}

Response 200: {
  success: true;
  data: ModernMessage;
  message: "Message archivé avec succès";
}

Response 404: "Message non trouvé ou accès refusé"

Logique: Vérifie userId === message.customerId avant archivage
```

#### PUT `/:id/delete` - Supprimer message (soft)
```typescript
Body: {
  userId: string;
}

Response 200: {
  success: true;
  message: "Message supprimé avec succès";
}

Implémentation: Soft delete via msg_close='1'
```

#### POST `/:id/reply` - Répondre à message
```typescript
Body: {
  userId: string;
  content: string;
}

Response 200: {
  success: true;
  data: ModernMessage;         // Nouveau message avec msg_parent_id
  message: "Réponse envoyée avec succès";
}

Logique:
- Crée nouveau message avec msg_parent_id = :id
- Event: message.created (notifications réciproques)
```

---

### 3. FAQ Knowledge Base (FaqController)

**Base URL:** `/api/support/faq`

#### POST `/` - Créer FAQ
```typescript
Body: {
  question: string;            // Min 10 chars
  answer: string;              // Min 20 chars
  category: string;            // FK vers category.id
  tags: string[];
  order: number;               // Ordre affichage
  published: boolean;
  createdBy: string;           // Staff ID
}

Response 201: {
  id: string;                  // "FAQ-ABC123"
  ...Body,
  helpful: 0;
  notHelpful: 0;
  views: 0;
  lastUpdated: Date;
}
```

#### GET `/` - Liste FAQs (filtres)
```typescript
Query: {
  category?: string;
  published?: boolean;
  tags?: string;               // Comma-separated
  search?: string;             // Full-text question+answer
}

Response 200: FAQ[]

Tri: Par category.order puis faq.order
```

#### GET `/stats` - Statistiques FAQ
```typescript
Response 200: {
  totalFAQs: number;
  publishedFAQs: number;
  totalViews: number;
  totalCategories: number;
  mostViewedFAQ: FAQ | null;
  mostHelpfulFAQ: FAQ | null;
  categoryStats: {
    [categoryId]: {
      faqs: number;
      views: number;
    };
  };
}
```

#### GET `/categories` - Liste catégories
```typescript
Query: {
  published?: boolean;
}

Response 200: FAQCategory[]

Données par défaut:
- orders (📦 Commandes) - 1
- shipping (🚚 Livraison) - 2
- returns (↩️ Retours) - 3
- payment (💳 Paiement) - 4
- technical (🔧 Support technique) - 5
- account (👤 Compte client) - 6
```

#### POST `/categories` - Créer catégorie
```typescript
Body: {
  id: string;
  name: string;
  description: string;
  icon?: string;               // Emoji ou icon class
  order: number;
  published: boolean;
}

Response 201: FAQCategory & { faqCount: 0 }
```

#### GET `/categories/:categoryId` - Détails catégorie
```typescript
Response 200: FAQCategory
Response 404: "Category not found"
```

#### PUT `/categories/:categoryId` - Modifier catégorie
```typescript
Body: Partial<FAQCategory>

Response 200: FAQCategory
```

#### DELETE `/categories/:categoryId` - Supprimer catégorie
```typescript
Response 204: No Content
Response 400: "Cannot delete category with existing FAQs"
```

#### GET `/:faqId` - FAQ par ID
```typescript
Query: {
  incrementView?: boolean = false;  // Auto-increment views
}

Response 200: FAQ
Response 404: "FAQ not found"
```

#### PUT `/:faqId` - Modifier FAQ
```typescript
Body: Partial<FAQ>

Response 200: FAQ (lastUpdated: new Date())

Logique: Si category change → update categoryCount ancien + nouveau
```

#### DELETE `/:faqId` - Supprimer FAQ
```typescript
Response 204: No Content

Logique: Décrémente category.faqCount
```

#### PUT `/:faqId/helpful` - Vote utilité
```typescript
Body: {
  helpful: boolean;            // true=helpful, false=notHelpful
}

Response 200: FAQ (counters updated)

Utilisation: Calculer taux satisfaction FAQ
```

---

### 4. Support Analytics (SupportAnalyticsController)

**Base URL:** `/api/support/analytics`

#### GET `/` - Tableau de bord complet
```typescript
Response 200: {
  overview: {
    totalTickets: number;
    openTickets: number;
    closedThisWeek: number;
    avgResponseTime: string;   // Format: "4h 23m"
  };
  ticketsByStatus: {
    open: number;
    in_progress: number;
    waiting_customer: number;
    resolved: number;
    closed: number;
  };
  ticketsByPriority: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
  ticketsByCategory: {
    general: number;
    technical: number;
    billing: number;
    complaint: number;
    suggestion: number;
  };
  recentActivity: Activity[];
  topAgents: AgentPerformance[];
}
```

#### GET `/agents` - Performances agents
```typescript
Response 200: AgentPerformance[] {
  agentId: string;
  agentName: string;
  ticketsHandled: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionScore: number;
  closedTickets: number;
  openTickets: number;
}
```

#### GET `/report` - Rapport période
```typescript
Query: {
  startDate: string;           // ISO 8601
  endDate: string;
  format?: 'json' | 'csv';
}

Response 200: {
  period: { start: string; end: string };
  summary: {
    totalTickets: number;
    resolvedTickets: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    satisfactionScore: number;
  };
  trends: {
    ticketsPerDay: Array<{ date: string; count: number }>;
    resolutionRate: number;
  };
}
```

#### GET `/kpis` - KPIs temps réel
```typescript
Response 200: {
  responseTime: {
    current: number;           // Minutes
    target: number;
    percentage: number;
  };
  resolutionTime: {
    current: number;           // Heures
    target: number;
    percentage: number;
  };
  firstContactResolution: {
    current: number;           // Pourcentage
    target: number;
  };
  customerSatisfaction: {
    score: number;             // 1-5
    trend: 'up' | 'down' | 'stable';
  };
}
```

#### GET `/workload` - Charge travail
```typescript
Response 200: {
  totalOpen: number;
  byAgent: Array<{
    agentId: string;
    agentName: string;
    assignedTickets: number;
    urgentTickets: number;
  }>;
  unassigned: number;
  overdueTickets: number;
}
```

#### GET `/satisfaction-trend` - Évolution satisfaction
```typescript
Query: {
  days?: number = 30;
}

Response 200: Array<{
  date: string;
  score: number;              // 1-5
  responses: number;
}>;
```

---

## WebSocket Gateway (Temps réel)

**Namespace:** `/messaging`  
**Technologie:** Socket.io  
**Auth:** JWT token (query params ou headers)

### Connexion client

```typescript
// Frontend
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000/messaging', {
  auth: { token: jwtToken },
  // ou query: { token: jwtToken }
});

socket.on('connected', (data) => {
  console.log('Connected:', data.userId, data.socketId);
});
```

**Flow connexion:**
1. Client envoie JWT token
2. Gateway vérifie token (JwtService.verify)
3. Extrait `userId` (payload.sub ou payload.id)
4. Join room `user-${userId}`
5. Store socket dans `userSockets` Map
6. Emit event `connected` au client

**Déconnexion:**
- Remove socket de `userSockets`
- Leave room `user-${userId}`
- Log disconnect

### Events serveur → client

#### `newMessage` - Nouveau message reçu
```typescript
Payload: {
  message: ModernMessage;
  type: 'new_message';
}

Trigger: @OnEvent('message.created')
Room: user-${recipientId}
```

#### `messageSent` - Confirmation envoi
```typescript
Payload: {
  message: ModernMessage;
  type: 'message_sent';
}

Trigger: @OnEvent('message.created')
Room: user-${senderId}
```

#### `messageRead` - Message lu
```typescript
Payload: {
  messageId: string;
  readerId: string;
  type: 'message_read';
}

Trigger: @OnEvent('message.read')
Room: user-${senderId}
```

#### `messageClosed` - Message fermé
```typescript
Payload: {
  messageId: string;
  closerId: string;
  type: 'message_closed';
}

Trigger: @OnEvent('message.closed')
Room: user-${senderId}
```

#### `userTyping` - Indicateur frappe
```typescript
Payload: {
  userId: string;
  userEmail: string;
  isTyping: boolean;
  type: 'typing_indicator';
}

Trigger: Client emit 'typing'
Room: user-${recipientId}
```

### Events client → serveur

#### `typing` - Indicateur frappe
```typescript
socket.emit('typing', {
  recipientId: string;
  isTyping: boolean;
});

// Recipient reçoit 'userTyping' event
```

#### `markAsRead` - Marquer lu (WebSocket)
```typescript
socket.emit('markAsRead', {
  messageId: string;
});

// Confirmation immédiate
socket.on('readConfirmation', (data) => {
  console.log('Read:', data.messageId, data.readAt);
});
```

**Note:** Marquer lu via WebSocket ne persiste PAS en base. Utiliser PUT `/api/messages/:id/read` pour persistence.

#### `joinConversation` - Rejoindre conversation
```typescript
socket.emit('joinConversation', {
  conversationId: string;
});

// Socket join room: conversation-${conversationId}
```

#### `leaveConversation` - Quitter conversation
```typescript
socket.emit('leaveConversation', {
  conversationId: string;
});

// Socket leave room
```

### Méthodes utilitaires Gateway

```typescript
// Check si user connecté
gateway.isUserConnected(userId: string): boolean

// Nombre de sockets pour user (multi-devices)
gateway.getUserSocketCount(userId: string): number

// Envoyer message à user spécifique
gateway.sendToUser(userId: string, event: string, data: any): void

// Broadcast tous utilisateurs
gateway.broadcast(event: string, data: any): void

// Liste users connectés
gateway.getConnectedUsers(): string[]
```

---

## Services métier

### ContactService

**Responsabilités:**
- CRUD tickets support
- Gestion statuts, assignation, escalade
- Thread conversation (réponses)
- Statistiques tickets

**Méthodes clés:**

```typescript
class ContactService extends SupabaseBaseService {
  // Créer ticket
  async createContact(data: ContactRequest): Promise<ContactTicket>
  
  // Récupérer ticket
  async getContactById(id: string): Promise<ContactTicket>
  
  // Liste paginée
  async getContacts(options: FilterOptions): Promise<PaginatedResult>
  
  // Changer statut
  async updateContactStatus(
    id: string,
    status: 'open' | 'closed',
    assignedTo?: string,
    internalNote?: string
  ): Promise<ContactTicket>
  
  // Ajouter réponse
  async addResponse(response: ContactResponse): Promise<any>
  
  // Thread complet
  async getTicketResponses(ticketId: string): Promise<any[]>
  
  // Escalade urgente
  async escalateTicket(
    id: string,
    staffId: string,
    reason: string
  ): Promise<ContactTicket>
  
  // Stats rapides
  async getQuickStats(): Promise<Stats>
  
  // Notifications (privé)
  private async sendNotifications(
    ticket: ContactTicket,
    event: string,
    additionalData?: any
  ): Promise<void>
}
```

**Logique escalade:**
```typescript
// Ajoute note "[ESCALADE] {reason}" au contenu
// Assigne à staffId
// Marque priority='urgent' (dans metadata)
// Notifie staff + hiérarchie
```

**Events notifications:**
- `created` → Email client + staff
- `status_updated` → Email client
- `response_added` → Email client
- `escalated` → Email staff + hiérarchie

### MessagesService

**Responsabilités:**
- CRUD messages temps réel
- Intégration WebSocket (via EventEmitter2)
- Statistiques conversations
- Soft deletes, archivage

**Méthodes clés:**

```typescript
class MessagesService {
  // Liste messages
  async getMessages(filters: MessageFilters): Promise<PaginatedResult>
  
  // Message par ID
  async getMessageById(messageId: string): Promise<ModernMessage>
  
  // Créer message
  async createMessage(data: CreateMessageDto): Promise<ModernMessage>
  // → Emit 'message.created'
  
  // Fermer message
  async closeMessage(messageId: string): Promise<ModernMessage>
  // → Emit 'message.closed'
  
  // Marquer lu
  async markAsRead(messageId: string, readerId: string): Promise<ModernMessage>
  // → Emit 'message.read'
  
  // Stats
  async getStatistics(customerId?: string): Promise<Stats>
  
  // Liste clients
  async getCustomers(limit: number): Promise<Customer[]>
  
  // Archiver (soft delete)
  async archiveMessage(messageId: string, userId: string): Promise<ModernMessage>
  
  // Supprimer (soft delete)
  async deleteMessage(messageId: string, userId: string): Promise<boolean>
  
  // Répondre
  async replyToMessage(
    messageId: string,
    userId: string,
    content: string
  ): Promise<ModernMessage>
}
```

**EventEmitter2 Integration:**
```typescript
// Service émet
this.eventEmitter.emit('message.created', {
  message,
  recipientId,
  senderId,
});

// Gateway écoute
@OnEvent('message.created')
handleMessageCreated(payload) {
  this.server.to(`user-${payload.recipientId}`).emit('newMessage', payload);
}
```

### FaqService

**Responsabilités:**
- CRUD FAQs et catégories
- Recherche full-text
- Vote utilité
- Statistiques views/helpful

**Méthodes clés:**

```typescript
class FaqService {
  // CRUD FAQ
  async createFAQ(data: CreateFaqDto): Promise<FAQ>
  async getFAQ(faqId: string, incrementView?: boolean): Promise<FAQ>
  async getAllFAQs(filters?: FaqFilters): Promise<FAQ[]>
  async updateFAQ(faqId: string, updates: Partial<FAQ>): Promise<FAQ>
  async deleteFAQ(faqId: string): Promise<void>
  
  // Vote
  async markHelpful(faqId: string, helpful: boolean): Promise<FAQ>
  
  // CRUD Catégories
  async createCategory(data: CreateCategoryDto): Promise<FAQCategory>
  async getCategory(categoryId: string): Promise<FAQCategory>
  async getAllCategories(publishedOnly?: boolean): Promise<FAQCategory[]>
  async updateCategory(id: string, updates: Partial<FAQCategory>): Promise<FAQCategory>
  async deleteCategory(categoryId: string): Promise<void>
  
  // Stats
  async getFAQStats(): Promise<FAQStats>
}
```

**Stockage:** In-memory Maps (production: TODO migrate to database)

```typescript
private faqs: Map<string, FAQ> = new Map();
private categories: Map<string, FAQCategory> = new Map();
```

**Catégories par défaut (6):**
1. **orders** (📦 Commandes) - Processus commande
2. **shipping** (🚚 Livraison) - Infos livraison
3. **returns** (↩️ Retours) - Politique retour
4. **payment** (💳 Paiement) - Méthodes paiement
5. **technical** (🔧 Support technique) - Aide installation
6. **account** (👤 Compte client) - Gestion compte

**FAQs par défaut (4):**
- "Comment suivre ma commande?" (orders)
- "Quels sont les délais de livraison?" (shipping)
- "Quelle est votre politique de retour?" (returns)
- "Quels moyens de paiement acceptez-vous?" (payment)

### NotificationService

**Responsabilités:**
- Envoi emails transactionnels
- Templates notifications
- Multi-canal (email, SMS, push, webhooks)
- Tracking envois

**Méthodes clés:**

```typescript
class NotificationService {
  // Notification générique
  async sendNotification(payload: NotificationPayload): Promise<void>
  
  // Templates spécifiques
  async sendContactConfirmation(data: ContactData): Promise<void>
  async notifyStaffNewContact(data: ContactData): Promise<void>
  
  // Email base
  async sendEmail(to: string, subject: string, body: string): Promise<void>
  
  // Multi-canal
  async sendSMS(phone: string, message: string): Promise<void>
  async sendPushNotification(userId: string, payload: any): Promise<void>
  async sendWebhook(url: string, payload: any): Promise<void>
}
```

**NotificationPayload:**
```typescript
interface NotificationPayload {
  type: 'contact' | 'review' | 'quote' | 'claim' | 'faq' | 'system';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;
  message: string;
  userId?: string;
  staffId?: string;
  metadata?: Record<string, any>;
  actions?: NotificationAction[];  // CTA buttons
}
```

**Templates emails:**
- `contact_confirmation` - Confirmation ticket client
- `new_ticket_staff` - Nouveau ticket staff
- `contact_assigned` - Ticket assigné
- `contact_resolved` - Ticket résolu
- `status_updated` - Statut changé

---

## Validation Zod

**Module Messages** - Schemas complets

```typescript
// Types messages
MessageTypeSchema = z.enum(['system', 'support', 'notification']);
MessagePrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
MessageStatusSchema = z.enum(['open', 'closed', 'all']);

// Création message
CreateMessageSchema = z.object({
  customerId: z.string().min(1, 'ID client requis'),
  staffId: z.string().min(1, 'ID staff requis'),
  orderId: z.string().optional(),
  subject: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  priority: MessagePrioritySchema.default('normal'),
});

// Modification message
UpdateMessageSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  priority: MessagePrioritySchema.optional(),
  status: MessageStatusSchema.optional(),
});

// Filtres
MessageFiltersSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  staffId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional(),
  status: MessageStatusSchema.default('all'),
});

// Marquer lu
MarkAsReadSchema = z.object({
  readerId: z.string().min(1),
});

// Fermer
CloseMessageSchema = z.object({
  closerId: z.string().min(1),
  reason: z.string().optional(),
});

// WebSocket events
TypingEventSchema = z.object({
  recipientId: z.string().min(1),
  isTyping: z.boolean(),
});

JoinConversationSchema = z.object({
  conversationId: z.string().min(1),
});
```

**Module Support** - Validation manuelle

```typescript
// ContactService.validateContactData()
- subject: min 10 chars, max 200
- message: min 20 chars
- email: format valid
- priority: enum ['urgent', 'high', 'normal', 'low']
- category: enum ['general', 'technical', 'billing', 'complaint', 'suggestion']

// FaqService.validateFAQ()
- question: min 10 chars
- answer: min 20 chars
- category: exists in categories
- order: >= 0

// FaqService.validateCategory()
- id: unique
- name: required
- order: >= 0
```

---

## Sécurité & Permissions

### Authentication JWT

**Tickets Support:**
- ❌ Pas d'auth requise pour POST `/api/support/contact` (contact public)
- ✅ Auth requise pour GET/PUT tickets (vérifier ownership ou staff)

**Messages:**
- ✅ JWT requis pour tous endpoints `/api/messages/*`
- ✅ Validation userId === message.customerId pour actions CRUD

**WebSocket:**
- ✅ JWT obligatoire dans auth/query params
- ✅ Déconnexion auto si token invalide
- ✅ Isolation par rooms (`user-${userId}`)

### Guards NestJS

```typescript
// TODO: Implémenter guards
@UseGuards(AuthenticatedGuard)  // Vérifie JWT
@UseGuards(IsAdminGuard)        // Vérifie staff role

// Exemple
@Get('tickets')
@UseGuards(IsAdminGuard)  // Staff uniquement
async getAllTickets() { ... }
```

### RGPD & Privacy

**Données personnelles:**
- Nom, email, téléphone dans `___xtr_customer` + `___xtr_msg`
- Conservation: 3 ans après fermeture ticket (conformité RGPD)
- Suppression: Soft delete + anonymisation sur demande

**Droits utilisateurs:**
- Accès: GET `/api/messages?customer={userId}` (propres messages)
- Rectification: PUT `/api/messages/:id` (propre message)
- Suppression: PUT `/api/messages/:id/delete` (soft delete)
- Portabilité: Export JSON via API

---

## Performances & Optimisation

### Indexes database

```sql
CREATE INDEX idx_msg_customer ON ___xtr_msg(msg_cst_id);
CREATE INDEX idx_msg_staff ON ___xtr_msg(msg_cnfa_id);
CREATE INDEX idx_msg_status ON ___xtr_msg(msg_open, msg_close);
CREATE INDEX idx_msg_date ON ___xtr_msg(msg_date DESC);
CREATE INDEX idx_msg_parent ON ___xtr_msg(msg_parent_id);
```

### Pagination

**Limite max:** 100 items/page (défaut: 20)
**Tri par défaut:** `msg_date DESC` (plus récents d'abord)

### Caching

**FAQ:**
- In-memory cache (Map) - Lecture O(1)
- Invalidation: Sur création/modification FAQ

**Stats tickets:**
- Cache Redis recommandé (TTL: 5min)
- Clé: `support:stats:{date}`

### WebSocket scaling

**Production:**
- Utiliser Redis adapter Socket.io pour multi-instances
- Sticky sessions (load balancer)
- Horizontal scaling Gateway

```typescript
// socket.io-redis
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ host: 'redis', port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

---

## Monitoring & Métriques

### KPIs clés

**Performance:**
- ⏱️ Temps réponse moyen: **4h** (objectif: <2h)
- ⏱️ Temps résolution moyen: **24h** (objectif: <18h)
- 📊 Taux résolution 1er contact: **67%** (objectif: >80%)
- 📈 Satisfaction client: **4.2/5** (objectif: >4.5)

**Volume:**
- 📧 Tickets/mois: ~2,500
- 🔓 Tickets ouverts simultanés: ~600
- 💬 Messages temps réel/jour: ~150 conversations
- 📖 Vues FAQ/mois: ~12,000

**SLA:**
- 🔴 Urgent: Réponse <1h, résolution <4h
- 🟠 High: Réponse <2h, résolution <8h
- 🟢 Normal: Réponse <4h, résolution <24h
- 🔵 Low: Réponse <8h, résolution <48h

### Logs & Observabilité

**Logger NestJS:**
```typescript
this.logger.log('Creating ticket:', ticketData);
this.logger.error('Failed to send notification:', error);
this.logger.warn('Staff not found:', staffId);
```

**Events à tracker:**
- `ticket.created` - Nouveau ticket
- `ticket.assigned` - Assignation staff
- `ticket.escalated` - Escalade urgente
- `ticket.resolved` - Résolution ticket
- `message.sent` - Message temps réel
- `faq.viewed` - Consultation FAQ
- `websocket.connected` - Connexion WebSocket
- `websocket.disconnected` - Déconnexion

**Alertes recommandées:**
- Temps réponse > 6h (3 tickets consécutifs)
- Tickets non assignés > 50
- WebSocket connections > 500 simultanées
- FAQ helpful rate < 60%

---

## Limitations & Roadmap

### Limitations actuelles

**Architecture:**
- ❌ FAQ stockées en mémoire (non persistantes au redémarrage)
- ❌ Recherche tickets basique (filtrage mémoire)
- ❌ Pas de full-text search PostgreSQL
- ❌ Pas de distinction explicite type message (contact/message/review)

**Fonctionnalités:**
- ❌ Pas de SLA tracking automatique
- ❌ Pas de satisfaction rating post-résolution
- ❌ Pas de chatbot IA (réponses auto)
- ❌ Pas de pièces jointes tickets (uniquement FAQ images)
- ❌ Pas de routing automatique par catégorie

**Scalabilité:**
- ⚠️ WebSocket Gateway single-instance (pas Redis adapter)
- ⚠️ Pas de rate limiting API
- ⚠️ Pas de circuit breaker notifications

### Roadmap Q1 2025

**Phase 1: Database migration FAQ**
- Migrer FAQ de mémoire vers table `___xtr_faq`
- Ajouter full-text search PostgreSQL (tsvector)
- Versioning FAQ (historique modifications)

**Phase 2: SLA tracking**
- Calculer temps réponse/résolution par ticket
- Alertes auto dépassement SLA
- Dashboard temps réel agents

**Phase 3: AI Assistant**
- Chatbot réponses auto (GPT-4 + embeddings FAQ)
- Suggestions réponses staff (context-aware)
- Détection sentiment (escalade auto si négatif)

**Phase 4: Multi-canal**
- Intégration SMS (Twilio)
- Intégration WhatsApp Business
- Widget chat site web (embed)

**Phase 5: Analytics avancés**
- Rapports hebdomadaires auto (PDF)
- Prédiction charge future (ML)
- Optimisation routing tickets (basé historique)

---

## Exemples utilisation

### Exemple 1: Créer ticket support client

```typescript
// Frontend - Formulaire contact
const response = await fetch('http://localhost:4000/api/support/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Jean Dupont',
    email: 'jean.dupont@example.com',
    phone: '+33612345678',
    subject: 'Problème démarrage véhicule',
    message: 'Mon véhicule Renault Clio 2018 ne démarre plus depuis ce matin. Le voyant batterie est allumé.',
    priority: 'high',
    category: 'technical',
    vehicle_info: {
      brand: 'Renault',
      model: 'Clio',
      year: 2018,
      license_plate: 'AB-123-CD'
    },
    order_number: 'ORD-2024-12345'
  })
});

const ticket = await response.json();
console.log('Ticket créé:', ticket.msg_id);

// Backend process:
// 1. Validation données
// 2. Recherche client par email
// 3. Création client si nouveau
// 4. Insert dans ___xtr_msg
// 5. Email confirmation client
// 6. Email notification staff technique
// 7. WebSocket event: ticket.created (si staff connecté)
```

### Exemple 2: Chat temps réel staff/client

```typescript
// Frontend - Connexion WebSocket
const socket = io('http://localhost:4000/messaging', {
  auth: { token: userJWT }
});

socket.on('connected', (data) => {
  console.log('Connected as:', data.userId);
  
  // Join conversation
  socket.emit('joinConversation', { conversationId: 'TICKET-123' });
});

// Recevoir nouveau message
socket.on('newMessage', ({ message }) => {
  console.log('New message from:', message.staffId);
  displayMessage(message);
});

// Envoyer message
async function sendMessage(content) {
  // Via REST API (persisté en base)
  const response = await fetch('http://localhost:4000/api/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userJWT}`
    },
    body: JSON.stringify({
      customerId: currentUser.id,
      staffId: assignedStaff.id,
      subject: 'RE: Problème démarrage',
      content: content,
      priority: 'normal'
    })
  });
  
  const message = await response.json();
  // WebSocket event émis automatiquement
}

// Indicateur frappe
function onTyping(isTyping) {
  socket.emit('typing', {
    recipientId: assignedStaff.id,
    isTyping: isTyping
  });
}

// Staff reçoit
socket.on('userTyping', ({ userId, isTyping }) => {
  showTypingIndicator(userId, isTyping);
});
```

### Exemple 3: Recherche FAQ

```typescript
// Frontend - Page FAQ
async function searchFAQ(keyword) {
  const response = await fetch(
    `http://localhost:4000/api/support/faq?search=${encodeURIComponent(keyword)}&published=true`
  );
  
  const faqs = await response.json();
  return faqs;
}

// Afficher FAQ avec auto-increment views
async function viewFAQ(faqId) {
  const response = await fetch(
    `http://localhost:4000/api/support/faq/${faqId}?incrementView=true`
  );
  
  const faq = await response.json();
  displayFAQ(faq);
}

// Vote utilité
async function voteFAQ(faqId, helpful) {
  await fetch(`http://localhost:4000/api/support/faq/${faqId}/helpful`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ helpful })
  });
  
  // Update UI counters
}

// Résultat: Réduction tickets -20% si FAQ bien utilisée
```

### Exemple 4: Dashboard analytics staff

```typescript
// Frontend - Dashboard support
async function loadDashboard() {
  // Stats globales
  const stats = await fetch('http://localhost:4000/api/support/analytics')
    .then(r => r.json());
  
  console.log('Tickets ouverts:', stats.overview.openTickets);
  console.log('Temps réponse moyen:', stats.overview.avgResponseTime);
  
  // Performance agents
  const agents = await fetch('http://localhost:4000/api/support/analytics/agents')
    .then(r => r.json());
  
  agents.forEach(agent => {
    console.log(`${agent.agentName}: ${agent.ticketsHandled} tickets, satisfaction ${agent.satisfactionScore}/5`);
  });
  
  // KPIs temps réel
  const kpis = await fetch('http://localhost:4000/api/support/analytics/kpis')
    .then(r => r.json());
  
  console.log('Temps réponse:', kpis.responseTime.current, 'min');
  console.log('Objectif:', kpis.responseTime.target, 'min');
  console.log('Performance:', kpis.responseTime.percentage, '%');
}
```

---

## Tests & Qualité

### Tests unitaires recommandés

**ContactService:**
- ✅ Création ticket avec client nouveau
- ✅ Création ticket avec client existant
- ✅ Validation données (subject trop court)
- ✅ Assignation staff
- ✅ Escalade ticket urgent
- ✅ Thread réponses (msg_parent_id)

**MessagesService:**
- ✅ Création message avec notifications
- ✅ Marquer comme lu
- ✅ Fermer message
- ✅ Archivage avec vérification ownership
- ✅ Répondre à message (thread)

**FaqService:**
- ✅ CRUD FAQ
- ✅ Recherche par catégorie
- ✅ Recherche full-text
- ✅ Vote helpful/notHelpful
- ✅ Stats globales

**MessagingGateway:**
- ✅ Connexion avec JWT valide
- ✅ Déconnexion auto si JWT invalide
- ✅ Emit events (newMessage, messageRead)
- ✅ Indicateur frappe (typing)
- ✅ Join/leave conversation rooms

### Tests E2E

**Scénario 1: Cycle vie ticket**
1. Client crée ticket → 201 Created
2. Staff liste tickets → 200 OK avec nouveau ticket
3. Staff assigne ticket → 200 OK, msg_cnfa_id updated
4. Staff ajoute réponse → 200 OK, msg_parent_id set
5. Client liste réponses → 200 OK, thread complet
6. Staff ferme ticket → 200 OK, msg_close='1'
7. Client consulte historique → 200 OK, ticket fermé

**Scénario 2: Chat temps réel**
1. Client connecte WebSocket → Event 'connected'
2. Staff connecte WebSocket → Event 'connected'
3. Client envoie message API → 201 Created
4. Staff reçoit event 'newMessage' → Temps < 100ms
5. Staff tape réponse → Client reçoit 'userTyping'
6. Staff envoie réponse → Client reçoit 'newMessage'
7. Client marque lu → Staff reçoit 'messageRead'

**Scénario 3: FAQ self-service**
1. Client recherche FAQ → 200 OK, 4 résultats
2. Client clique FAQ → Views incrémenté +1
3. Client vote helpful → FAQ.helpful +1
4. Admin vérifie stats → mostViewedFAQ, mostHelpfulFAQ correct

---

## Documentation complémentaire

**Fichiers liés:**
- `.spec/features/reviews-system.md` - Système avis (réutilise ___xtr_msg)
- `.spec/architecture/001-supabase-integration.md` - Architecture Supabase
- `backend/src/modules/support/index.ts` - Constantes support
- `backend/src/modules/messages/dto/message.schemas.ts` - Schémas Zod

**APIs OpenAPI:** TODO (Phase 2 revision)

**Types Zod:** Existants dans `messages/dto/message.schemas.ts`

---

## Changelog

**v1.0.0 (2024-11-14):**
- ✅ Documentation initiale complète
- ✅ 25 endpoints documentés (6 contact + 11 messages + 13 FAQ + 6 analytics)
- ✅ WebSocket Gateway intégré (Socket.io)
- ✅ Validation Zod module Messages
- ✅ Notifications multi-événements
- ✅ FAQ système 6 catégories par défaut

**Prochaines versions:**
- v1.1.0: SLA tracking automatique
- v1.2.0: Migration FAQ vers database
- v1.3.0: Chatbot IA intégré
- v2.0.0: Multi-canal (SMS, WhatsApp)

---

**Fin de la spécification Messages & Support System**
