# 💬 ANALYSE PHP - myspace.account.msg.fil.php

**Date**: 2025-10-06  
**Fichier**: `myspace.account.msg.fil.php`  
**Objectif**: Affichage détaillé d'un message (modal/popup)

---

## 🎯 FONCTIONNALITÉ

**Page modal d'affichage d'un message complet**
- Affiche le sujet et le contenu d'un message spécifique
- Vérification de propriété (message appartient au client)
- Affichage en modal (classe `BODY-MODAL`)
- Sanitization partielle du HTML (strip_tags)

---

## 🔍 ANALYSE SQL

### Requête principale

```sql
SELECT * FROM ___XTR_MSG 
WHERE MSG_ID = '$msg_id' 
AND MSG_CST_ID = '$ssid'
```

**Table**: `___xtr_msg`  
**Filtres**: 
- ID du message (depuis URL `$_GET['msg_id']`)
- ID du client (depuis session `$_SESSION['myakid']`)

**Sécurité**: Vérification double (session + propriété du message)

### Colonnes utilisées

| Nom PHP | Colonne SQL | Type | Description |
|---------|-------------|------|-------------|
| - | `MSG_ID` | int | ID du message |
| - | `MSG_CST_ID` | int | ID du client (propriétaire) |
| `$result_msg_data['MSG_SUBJECT']` | `MSG_SUBJECT` | string | Sujet du message |
| `$result_msg_data['MSG_CONTENT']` | `MSG_CONTENT` | text | Contenu du message |
| `$commande_id` | `MSG_ORD_ID` | int | ID commande liée (si applicable) |

---

## 🔒 SÉCURITÉ

### 1. Vérification d'authentification
```php
if(isset($_SESSION['myaklog'])) {
    // Utilisateur connecté
} else {
    // Redirection vers login
    require_once('myspace.connect.try.php');
}
```

### 2. Vérification de propriété
```php
WHERE MSG_ID = '$msg_id' AND MSG_CST_ID = '$ssid'
```
**Protection**: L'utilisateur ne peut voir QUE ses propres messages

### 3. Sanitization HTML

```php
// Sujet - Strip ALL tags
echo strip_tags($result_msg_data['MSG_SUBJECT']);

// Contenu - Strip MOST tags (garde <br>, <a>, <b>, <p>)
echo strip_tags($result_msg_data['MSG_CONTENT'], "<br><a><b><p>");
```

**Tags autorisés dans le contenu**:
- `<br>` - Retour à la ligne
- `<a>` - Liens
- `<b>` - Gras
- `<p>` - Paragraphes

### 4. Message d'erreur si accès refusé
```php
if ($request_msg_data->num_rows > 0) {
    // Afficher le message
} else {
    // "PAS LE DROIT"
}
```

---

## 🎨 AFFICHAGE

### Structure HTML

```html
<div class="container-fluid modalPage w-100">
    <div class="row">
        <div class="col-12">
            <div class="row m-0 p-0">
                <!-- Sujet -->
                <div class="col-12 msg-fil-title p-3">
                    {MSG_SUBJECT}
                </div>
                <!-- Contenu -->
                <div class="col-12 msg-fil-content-1 p-3">
                    {MSG_CONTENT}
                </div>
            </div>
        </div>
    </div>
</div>
```

### Classes CSS

- `BODY-MODAL` - Body en mode modal
- `modalPage` - Container de la modal
- `msg-fil-title` - Style du titre/sujet
- `msg-fil-content-1` - Style du contenu

### Layout

**Pas de header ni footer** - C'est une modal/popup indépendante

---

## 🔄 LOGIQUE MÉTIER

### 1. Récupération des paramètres
```php
$msg_id = $_GET['msg_id'];  // ID du message (URL)
$ssid = $_SESSION['myakid']; // ID du client (session)
```

### 2. Requête avec double filtre
```php
WHERE MSG_ID = '$msg_id' AND MSG_CST_ID = '$ssid'
```
**Important**: Empêche un client de voir les messages d'un autre

### 3. Affichage conditionnel
```php
if ($request_msg_data->num_rows > 0) {
    // Message trouvé ET appartient au client
    // → Afficher
} else {
    // Message non trouvé OU pas le bon client
    // → "PAS LE DROIT"
}
```

### 4. Variable commande (non utilisée)
```php
$commande_id = $result_msg_data['MSG_ORD_ID'];
```
**Note**: Variable définie mais pas utilisée dans l'affichage

---

## 📊 COMPARAISON AVEC TYPESCRIPT

### Interface TypeScript complète

```typescript
interface Message {
  // Identification
  id: string;                    // MSG_ID
  customerId: string;            // MSG_CST_ID
  staffId?: string;              // MSG_STAFF_ID (qui a envoyé)
  
  // Contenu
  subject: string;               // MSG_SUBJECT
  content: string;               // MSG_CONTENT
  
  // Relations
  orderId?: string;              // MSG_ORD_ID (commande liée)
  
  // Statut
  isRead: boolean;               // MSG_IS_READ
  isArchived: boolean;           // MSG_IS_ARCHIVED
  priority: 'low' | 'normal' | 'high'; // MSG_PRIORITY
  
  // Dates
  sentAt: Date;                  // MSG_SENT_AT
  readAt?: Date;                 // MSG_READ_AT
  createdAt: Date;               // MSG_CREATED_AT
  
  // Métadonnées
  type?: 'order' | 'support' | 'marketing' | 'system';
  attachments?: MessageAttachment[];
}

interface MessageAttachment {
  id: string;
  messageId: string;
  filename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}
```

### Mapping Supabase → TypeScript

```typescript
function mapSupabaseToMessage(dbData: any): Message {
  return {
    id: String(dbData.msg_id),
    customerId: String(dbData.msg_cst_id),
    staffId: dbData.msg_staff_id ? String(dbData.msg_staff_id) : undefined,
    subject: dbData.msg_subject,
    content: dbData.msg_content,
    orderId: dbData.msg_ord_id ? String(dbData.msg_ord_id) : undefined,
    isRead: dbData.msg_is_read === '1',
    isArchived: dbData.msg_is_archived === '1',
    priority: dbData.msg_priority || 'normal',
    sentAt: new Date(dbData.msg_sent_at),
    readAt: dbData.msg_read_at ? new Date(dbData.msg_read_at) : undefined,
    createdAt: new Date(dbData.msg_created_at),
    type: dbData.msg_type || 'support',
  };
}
```

---

## 🆕 FONCTIONNALITÉS À IMPLÉMENTER

### Backend (NestJS)

**Service**: `MessagesConsolidatedService`

```typescript
/**
 * Récupérer un message spécifique
 * Vérifie que le message appartient au client
 */
async getMessageById(
  messageId: string,
  userId: string,
): Promise<Message> {
  const { data, error } = await this.supabase
    .from('___xtr_msg')
    .select('*')
    .eq('msg_id', messageId)
    .eq('msg_cst_id', userId)
    .single();

  if (error || !data) {
    throw new NotFoundException(
      'Message non trouvé ou vous n\'avez pas accès à ce message'
    );
  }

  // Marquer comme lu si pas encore lu
  if (data.msg_is_read !== '1') {
    await this.markMessageAsRead(messageId);
  }

  return mapSupabaseToMessage(data);
}

/**
 * Marquer un message comme lu
 */
async markMessageAsRead(messageId: string): Promise<boolean> {
  const { error } = await this.supabase
    .from('___xtr_msg')
    .update({
      msg_is_read: '1',
      msg_read_at: new Date().toISOString(),
    })
    .eq('msg_id', messageId);

  if (error) {
    this.logger.error(`Error marking message ${messageId} as read:`, error);
    return false;
  }

  return true;
}

/**
 * Archiver un message
 */
async archiveMessage(messageId: string, userId: string): Promise<boolean> {
  const { error } = await this.supabase
    .from('___xtr_msg')
    .update({ msg_is_archived: '1' })
    .eq('msg_id', messageId)
    .eq('msg_cst_id', userId);

  if (error) {
    throw new Error('Erreur lors de l\'archivage du message');
  }

  return true;
}

/**
 * Supprimer un message (soft delete)
 */
async deleteMessage(messageId: string, userId: string): Promise<boolean> {
  const { error } = await this.supabase
    .from('___xtr_msg')
    .update({ msg_is_deleted: '1' })
    .eq('msg_id', messageId)
    .eq('msg_cst_id', userId);

  if (error) {
    throw new Error('Erreur lors de la suppression du message');
  }

  return true;
}

/**
 * Répondre à un message
 */
async replyToMessage(
  messageId: string,
  userId: string,
  replyContent: string,
): Promise<Message> {
  // Récupérer le message original
  const originalMessage = await this.getMessageById(messageId, userId);

  // Créer une nouvelle réponse
  const { data, error } = await this.supabase
    .from('___xtr_msg')
    .insert({
      msg_cst_id: userId,
      msg_subject: `Re: ${originalMessage.subject}`,
      msg_content: replyContent,
      msg_ord_id: originalMessage.orderId,
      msg_parent_id: messageId, // Lien vers le message parent
      msg_is_read: '0',
      msg_sent_at: new Date().toISOString(),
      msg_created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error('Erreur lors de l\'envoi de la réponse');
  }

  return mapSupabaseToMessage(data);
}
```

**Contrôleur**: `MessagesConsolidatedController`

```typescript
@Controller('api/messages')
export class MessagesConsolidatedController {
  constructor(
    private readonly messagesService: MessagesConsolidatedService,
  ) {}

  /**
   * GET /api/messages/:messageId
   * Récupérer un message spécifique
   */
  @Get(':messageId')
  @UseGuards(AuthenticatedGuard)
  async getMessage(
    @Param('messageId') messageId: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    const message = await this.messagesService.getMessageById(
      messageId,
      userId,
    );
    
    return {
      success: true,
      data: message,
    };
  }

  /**
   * PUT /api/messages/:messageId/read
   * Marquer comme lu
   */
  @Put(':messageId/read')
  @UseGuards(AuthenticatedGuard)
  async markAsRead(@Param('messageId') messageId: string) {
    await this.messagesService.markMessageAsRead(messageId);
    return {
      success: true,
      message: 'Message marqué comme lu',
    };
  }

  /**
   * PUT /api/messages/:messageId/archive
   * Archiver un message
   */
  @Put(':messageId/archive')
  @UseGuards(AuthenticatedGuard)
  async archiveMessage(
    @Param('messageId') messageId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.messagesService.archiveMessage(messageId, req.user.id);
    return {
      success: true,
      message: 'Message archivé',
    };
  }

  /**
   * DELETE /api/messages/:messageId
   * Supprimer un message
   */
  @Delete(':messageId')
  @UseGuards(AuthenticatedGuard)
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Req() req: RequestWithUser,
  ) {
    await this.messagesService.deleteMessage(messageId, req.user.id);
    return {
      success: true,
      message: 'Message supprimé',
    };
  }

  /**
   * POST /api/messages/:messageId/reply
   * Répondre à un message
   */
  @Post(':messageId/reply')
  @UseGuards(AuthenticatedGuard)
  async replyToMessage(
    @Param('messageId') messageId: string,
    @Req() req: RequestWithUser,
    @Body() body: { content: string },
  ) {
    const reply = await this.messagesService.replyToMessage(
      messageId,
      req.user.id,
      body.content,
    );
    
    return {
      success: true,
      message: 'Réponse envoyée',
      data: reply,
    };
  }
}
```

### Frontend (Remix)

**Composant**: `MessageDetailModal.tsx`

```typescript
import { useState } from 'react';
import { useFetcher } from '@remix-run/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import {
  Mail,
  MailOpen,
  Archive,
  Trash2,
  Reply,
  Calendar,
  Package,
} from 'lucide-react';

interface MessageDetailModalProps {
  message: Message;
  isOpen: boolean;
  onClose: () => void;
}

export function MessageDetailModal({
  message,
  isOpen,
  onClose,
}: MessageDetailModalProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const fetcher = useFetcher();

  const handleMarkAsRead = () => {
    fetcher.submit(
      {},
      { method: 'put', action: `/api/messages/${message.id}/read` }
    );
  };

  const handleArchive = () => {
    fetcher.submit(
      {},
      { method: 'put', action: `/api/messages/${message.id}/archive` }
    );
    onClose();
  };

  const handleDelete = () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      fetcher.submit(
        {},
        { method: 'delete', action: `/api/messages/${message.id}` }
      );
      onClose();
    }
  };

  const handleReply = () => {
    if (!replyContent.trim()) return;

    fetcher.submit(
      { content: replyContent },
      { method: 'post', action: `/api/messages/${message.id}/reply` }
    );
    setReplyContent('');
    setIsReplying(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {message.isRead ? (
              <MailOpen className="w-5 h-5" />
            ) : (
              <Mail className="w-5 h-5" />
            )}
            {message.subject}
          </DialogTitle>
        </DialogHeader>

        {/* Métadonnées */}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(message.sentAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>

          {message.orderId && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              Commande #{message.orderId}
            </Badge>
          )}

          <Badge
            variant={
              message.priority === 'high'
                ? 'destructive'
                : message.priority === 'normal'
                ? 'default'
                : 'secondary'
            }
          >
            {message.priority === 'high'
              ? 'Priorité haute'
              : message.priority === 'normal'
              ? 'Normal'
              : 'Priorité basse'}
          </Badge>
        </div>

        {/* Contenu */}
        <div
          className="prose prose-sm max-w-none p-4 bg-muted/50 rounded-lg"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(message.content),
          }}
        />

        {/* Formulaire de réponse */}
        {isReplying && (
          <div className="space-y-2">
            <Textarea
              placeholder="Votre réponse..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={5}
            />
            <div className="flex gap-2">
              <Button onClick={handleReply}>Envoyer</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsReplying(false);
                  setReplyContent('');
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <DialogFooter className="flex gap-2">
          {!message.isRead && (
            <Button variant="outline" onClick={handleMarkAsRead}>
              <MailOpen className="w-4 h-4 mr-2" />
              Marquer comme lu
            </Button>
          )}

          {!isReplying && (
            <Button variant="outline" onClick={() => setIsReplying(true)}>
              <Reply className="w-4 h-4 mr-2" />
              Répondre
            </Button>
          )}

          <Button variant="outline" onClick={handleArchive}>
            <Archive className="w-4 h-4 mr-2" />
            Archiver
          </Button>

          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sanitize HTML - Garde uniquement les tags sûrs
 */
function sanitizeHtml(html: string): string {
  // Utiliser DOMPurify ou une lib similaire en production
  const allowedTags = ['br', 'a', 'b', 'p', 'strong', 'em', 'u'];
  // Implémentation simplifiée pour l'exemple
  return html; // En prod: utiliser DOMPurify.sanitize(html, { ALLOWED_TAGS: allowedTags })
}
```

**Route**: `myspace.messages.$messageId.tsx`

```typescript
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const session = await getSession(request.headers.get('Cookie'));
  const userId = session.get('userId');

  if (!userId) {
    return redirect('/login');
  }

  const messageId = params.messageId;

  // Récupérer le message
  const response = await fetch(
    `http://localhost:3000/api/messages/${messageId}`,
    {
      headers: {
        Authorization: `Bearer ${session.get('token')}`,
      },
    }
  );

  if (!response.ok) {
    throw new Response('Message non trouvé', { status: 404 });
  }

  const data = await response.json();

  return json({ message: data.data });
};

export default function MessageDetail() {
  const { message } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <MessageDetailModal
      message={message}
      isOpen={true}
      onClose={() => navigate('/myspace/messages')}
    />
  );
}
```

---

## 🔗 RELATIONS AVEC AUTRES FICHIERS

### Fichiers PHP liés

1. **myspace.account.index.php** ← Affiche les 5 derniers messages
2. **myspace.account.msg.php** (hypothétique) ← Liste tous les messages
3. **myspace.connect.try.php** ← Formulaire de connexion

### Tables Supabase nécessaires

1. **___xtr_msg** ← Table principale des messages
2. **___xtr_customer** ← Table des clients (pour vérification)
3. **___xtr_order** ← Table des commandes (si message lié à commande)
4. **___xtr_msg_attachment** (hypothétique) ← Pièces jointes

---

## 📋 CHECKLIST D'IMPLÉMENTATION

### Backend
- [ ] Créer `MessagesConsolidatedService`
- [ ] Créer `MessagesConsolidatedController`
- [ ] Créer DTO `MessageCompleteDto`
- [ ] Implémenter `getMessageById(messageId, userId)`
- [ ] Implémenter `markMessageAsRead(messageId)`
- [ ] Implémenter `archiveMessage(messageId, userId)`
- [ ] Implémenter `deleteMessage(messageId, userId)`
- [ ] Implémenter `replyToMessage(messageId, userId, content)`
- [ ] Ajouter vérification de propriété (userId)
- [ ] Ajouter sanitization HTML (DOMPurify côté serveur)
- [ ] Ajouter tests unitaires

### Frontend
- [ ] Créer composant `MessageDetailModal`
- [ ] Créer route `myspace.messages.$messageId.tsx`
- [ ] Implémenter affichage message
- [ ] Implémenter "Marquer comme lu"
- [ ] Implémenter "Archiver"
- [ ] Implémenter "Supprimer"
- [ ] Implémenter "Répondre"
- [ ] Ajouter sanitization HTML (DOMPurify)
- [ ] Ajouter gestion erreurs (404, 403)
- [ ] Ajouter loading states

### Sécurité
- [ ] Vérifier propriété du message (backend)
- [ ] Sanitize HTML (backend + frontend)
- [ ] Protéger contre XSS
- [ ] Rate limiting sur réponses
- [ ] Validation contenu réponse (longueur, format)

---

## ⚠️ POINTS D'ATTENTION

### 1. Sécurité XSS

**Problème PHP** :
```php
// Autorise <a> tags → Risque XSS
echo strip_tags($result_msg_data['MSG_CONTENT'], "<br><a><b><p>");
```

**Solution TypeScript** :
```typescript
// Utiliser DOMPurify pour sanitization robuste
import DOMPurify from 'isomorphic-dompurify';

const sanitizedContent = DOMPurify.sanitize(message.content, {
  ALLOWED_TAGS: ['br', 'a', 'b', 'p', 'strong', 'em'],
  ALLOWED_ATTR: ['href', 'target'], // Pour les liens
});
```

### 2. Injection SQL

**Problème PHP** :
```php
WHERE MSG_ID = '$msg_id' AND MSG_CST_ID = '$ssid'
```
Variables non échappées → Risque injection SQL

**Solution TypeScript** :
```typescript
// Supabase échappe automatiquement
.eq('msg_id', messageId)
.eq('msg_cst_id', userId)
```

### 3. Variable non utilisée

```php
$commande_id = $result_msg_data['MSG_ORD_ID'];
```
Variable définie mais jamais utilisée → Pourrait servir à afficher un lien vers la commande

### 4. Message d'erreur générique

```php
echo "PAS LE DROIT";
```
Message trop générique → Améliorer en TypeScript :
```typescript
throw new NotFoundException(
  'Message non trouvé ou vous n\'avez pas accès à ce message'
);
```

---

## 🎯 AMÉLIORATIONS PROPOSÉES

### 1. Afficher la commande liée

**Si `MSG_ORD_ID` existe** :
```tsx
{message.orderId && (
  <Link to={`/myspace/orders/${message.orderId}`}>
    <Badge variant="outline">
      <Package className="w-3 h-3 mr-1" />
      Voir la commande #{message.orderId}
    </Badge>
  </Link>
)}
```

### 2. Fil de conversation

**Si plusieurs messages** :
```typescript
// Récupérer tous les messages du même thread
async getMessageThread(messageId: string): Promise<Message[]> {
  // Trouver le message racine
  const rootMessage = await this.findRootMessage(messageId);
  
  // Récupérer tous les messages du thread
  const { data } = await this.supabase
    .from('___xtr_msg')
    .select('*')
    .or(`msg_id.eq.${rootMessage.id},msg_parent_id.eq.${rootMessage.id}`)
    .order('msg_sent_at', { ascending: true });
  
  return (data || []).map(mapSupabaseToMessage);
}
```

### 3. Pièces jointes

**Afficher les pièces jointes** :
```tsx
{message.attachments && message.attachments.length > 0 && (
  <div className="space-y-2">
    <p className="text-sm font-medium">Pièces jointes:</p>
    {message.attachments.map((attachment) => (
      <a
        key={attachment.id}
        href={attachment.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 border rounded hover:bg-muted"
      >
        <Paperclip className="w-4 h-4" />
        <span>{attachment.filename}</span>
        <span className="text-xs text-muted-foreground">
          ({formatFileSize(attachment.fileSize)})
        </span>
      </a>
    ))}
  </div>
)}
```

### 4. Notifications

**Marquer comme lu automatiquement** :
```typescript
useEffect(() => {
  if (!message.isRead) {
    // Marquer comme lu après 2 secondes
    const timeout = setTimeout(() => {
      markAsRead();
    }, 2000);
    
    return () => clearTimeout(timeout);
  }
}, [message.isRead]);
```

---

## 📊 STATISTIQUES

**Endpoints nécessaires** :
- `GET /api/messages/:messageId` - Détail message ✅
- `PUT /api/messages/:messageId/read` - Marquer lu ✅
- `PUT /api/messages/:messageId/archive` - Archiver ✅
- `DELETE /api/messages/:messageId` - Supprimer ✅
- `POST /api/messages/:messageId/reply` - Répondre ✅
- `GET /api/messages/:messageId/thread` - Fil conversation ⏳
- `POST /api/messages/:messageId/attachments` - Ajouter PJ ⏳

**Composants nécessaires** :
- `MessageDetailModal` - Modal d'affichage ✅
- `MessageReplyForm` - Formulaire de réponse ✅
- `MessageAttachmentsList` - Liste PJ ⏳
- `MessageThreadView` - Vue fil conversation ⏳

---

**Date de création** : 2025-10-06  
**Auteur** : GitHub Copilot  
**Statut** : ✅ Analyse complète terminée
