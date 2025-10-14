# 🚀 Guide de Mise en Place - Système de Traitement des Commandes

> **Date :** 12 octobre 2025  
> **Objectif :** Guide pratique pour activer et configurer le système de traitement des commandes  
> **Niveau :** Implémentation technique

---

## 📋 Prérequis

### ✅ Infrastructure
- [x] Backend NestJS opérationnel (localhost:3000)
- [x] Frontend Remix opérationnel (localhost:5173)
- [x] Base de données Supabase configurée
- [x] Redis installé (optionnel, pour cache)

### ✅ Tables Existantes
```sql
___xtr_order                        -- ✅ Commandes
___xtr_order_line                   -- ✅ Lignes de commande
___xtr_order_status                 -- ✅ Référentiel statuts
___xtr_order_status_history         -- ✅ Historique
___xtr_customer                     -- ✅ Clients
___xtr_customer_billing_address     -- ✅ Adresses facturation
___xtr_customer_delivery_address    -- ✅ Adresses livraison
ic_postback                         -- ✅ Transactions paiement
```

### ✅ Modules Backend Existants
```
backend/src/modules/orders/
├── controllers/
│   ├── order-actions.controller.ts      ✅ Actions (valider, expédier)
│   ├── order-status.controller.ts       ✅ Gestion statuts
│   └── orders.controller.ts             ✅ CRUD commandes
├── services/
│   ├── order-actions.service.ts         ✅ Logique métier
│   └── order-status.service.ts          ✅ Machine à états
└── orders.module.ts                     ✅ Module NestJS
```

---

## 🔧 Étape 1 : Configuration Backend

### 1.1 - Variables d'Environnement

**Fichier :** `backend/.env`

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...

# Paiements
PAYMENT_SECRET=your_payment_secret_key_here
CYBERPLUS_MERCHANT_ID=your_merchant_id
CYBERPLUS_API_KEY=your_api_key
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_SECRET=your_paypal_secret

# Email (Resend - Moderne et Simple)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=notifications@votre-domaine.com

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Redis (optionnel)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Webhook URLs (production)
PAYMENT_CALLBACK_URL=https://api.yourdomain.com/api/payments/callback
ORDER_WEBHOOK_URL=https://api.yourdomain.com/api/orders/webhook
```

---

### 1.2 - Activation des Guards (Sécurité)

**Fichier :** `backend/src/modules/orders/controllers/order-actions.controller.ts`

```typescript
import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminLevelGuard } from '../../auth/guards/admin-level.guard';
import { RequireAdminLevel } from '../../auth/decorators/admin-level.decorator';

@Controller('api/admin/orders')
@UseGuards(JwtAuthGuard, AdminLevelGuard) // ✅ Activer
@RequireAdminLevel(7) // Niveau admin requis: 7
export class OrderActionsController {
  // ... rest of code
}
```

**Faire de même pour tous les controllers admin.**

---

### 1.3 - Vérification du Module Orders

**Fichier :** `backend/src/modules/orders/orders.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { OrdersController } from './controllers/orders.controller';
import { OrderActionsController } from './controllers/order-actions.controller';
import { OrderStatusController } from './controllers/order-status.controller';
import { OrderActionsService } from './services/order-actions.service';
import { OrderStatusService } from './services/order-status.service';
import { LegacyOrderService } from '../../database/services/legacy-order.service';

@Module({
  controllers: [
    OrdersController,
    OrderActionsController,
    OrderStatusController,
  ],
  providers: [
    OrderActionsService,
    OrderStatusService,
    LegacyOrderService,
  ],
  exports: [
    OrderActionsService,
    OrderStatusService,
    LegacyOrderService,
  ],
})
export class OrdersModule {}
```

**Vérifier import dans `app.module.ts` :**

```typescript
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    // ... autres modules
    OrdersModule, // ✅ Vérifier présent
  ],
})
export class AppModule {}
```

---

### 1.4 - Test des Endpoints

**Terminal Backend :**
```bash
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev
```

**Test API :**
```bash
# 1. Lister les statuts disponibles
curl http://localhost:3000/order-status/all

# 2. Info statut spécifique
curl http://localhost:3000/order-status/info/2

# 3. Récupérer commandes (avec auth)
curl http://localhost:3000/api/legacy-orders \
  -H "Cookie: connect.sid=your_session_cookie"
```

**Réponse attendue :**
```json
{
  "success": true,
  "statuses": [
    {
      "code": 1,
      "label": "En attente",
      "category": "pending",
      "color": "yellow"
    },
    // ...
  ]
}
```

---

## 🎨 Étape 2 : Configuration Frontend

### 2.1 - Page Admin Commandes

**Fichier :** `frontend/app/routes/admin.orders._index.tsx`

**Vérifier présence boutons d'action :**

```tsx
// Ligne ~1100-1200
<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
  <div className="flex items-center justify-end gap-2">
    {/* Bouton Voir détails */}
    <Link
      to={`/admin/orders/${order.ord_id}`}
      className="text-blue-600 hover:text-blue-900"
    >
      <Eye className="h-5 w-5" />
    </Link>

    {/* Bouton Infos (modal) */}
    <button
      onClick={() => setSelectedOrder(order)}
      className="text-gray-600 hover:text-gray-900"
    >
      <Info className="h-5 w-5" />
    </button>

    {/* ✨ À AJOUTER: Boutons d'action selon statut */}
    {order.ord_ords_id === '1' && ( // En attente
      <button
        onClick={() => handleSendPaymentReminder(order.ord_id)}
        className="text-orange-600 hover:text-orange-900"
        title="Relancer paiement"
      >
        <Mail className="h-5 w-5" />
      </button>
    )}

    {order.ord_ords_id === '2' && ( // Confirmée
      <button
        onClick={() => handleValidateOrder(order.ord_id)}
        className="text-green-600 hover:text-green-900"
        title="Valider commande"
      >
        <CheckCircle className="h-5 w-5" />
      </button>
    )}

    {order.ord_ords_id === '3' && ( // En cours
      <button
        onClick={() => handleShipOrder(order.ord_id)}
        className="text-blue-600 hover:text-blue-900"
        title="Expédier"
      >
        <Truck className="h-5 w-5" />
      </button>
    )}

    {/* Bouton Annuler (si pas expédiée/livrée) */}
    {!['4', '5', '6'].includes(order.ord_ords_id) && (
      <button
        onClick={() => handleCancelOrder(order.ord_id)}
        className="text-red-600 hover:text-red-900"
        title="Annuler"
      >
        <XCircle className="h-5 w-5" />
      </button>
    )}
  </div>
</td>
```

---

### 2.2 - Handlers Actions

**Ajouter dans le composant :**

```tsx
import { useFetcher } from "@remix-run/react";

export default function AdminOrders() {
  const fetcher = useFetcher();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Handler: Valider commande (statut 2 → 3)
  const handleValidateOrder = async (orderId: string) => {
    if (!confirm('Valider cette commande ?')) return;
    
    setActionLoading(orderId);
    try {
      const response = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': document.cookie, // Session auth
        },
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Commande validée !');
        // Recharger la page
        window.location.reload();
      } else {
        throw new Error('Erreur validation');
      }
    } catch (error) {
      toast.error('Échec validation commande');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Expédier commande (statut 3 → 4)
  const handleShipOrder = async (orderId: string) => {
    const trackingNumber = prompt('Numéro de suivi :');
    if (!trackingNumber) return;

    setActionLoading(orderId);
    try {
      const response = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trackingNumber }),
      });

      if (response.ok) {
        toast.success('Commande expédiée !');
        window.location.reload();
      } else {
        throw new Error('Erreur expédition');
      }
    } catch (error) {
      toast.error('Échec expédition commande');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Annuler commande
  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt('Raison de l\'annulation :');
    if (!reason) return;

    setActionLoading(orderId);
    try {
      const response = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        toast.success('Commande annulée');
        window.location.reload();
      } else {
        throw new Error('Erreur annulation');
      }
    } catch (error) {
      toast.error('Échec annulation commande');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Relancer paiement
  const handleSendPaymentReminder = async (orderId: string) => {
    if (!confirm('Envoyer un rappel de paiement au client ?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/admin/orders/${orderId}/payment-reminder`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Email envoyé au client');
      }
    } catch (error) {
      toast.error('Échec envoi email');
    }
  };

  // ... rest of component
}
```

---

### 2.3 - Installation Notifications Toast

**Si pas déjà installé :**

```bash
cd /workspaces/nestjs-remix-monorepo/frontend
npm install react-hot-toast
```

**Ajouter dans layout :**

**Fichier :** `frontend/app/root.tsx`

```tsx
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <html>
      <body>
        <Outlet />
        <Toaster position="top-right" /> {/* ✨ Ajouter */}
      </body>
    </html>
  );
}
```

---

## 📧 Étape 3 : Configuration Emails

### 3.1 - Service Email

**Fichier :** `backend/src/services/email.service.ts` (créer si n'existe pas)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOrderConfirmation(order: any, customer: any) {
    const html = `
      <h1>Commande ${order.ord_id} confirmée</h1>
      <p>Bonjour ${customer.cst_fname} ${customer.cst_name},</p>
      <p>Votre commande a été validée et est en cours de préparation.</p>
      <h2>Détails :</h2>
      <ul>
        <li>Numéro : ${order.ord_id}</li>
        <li>Montant : ${order.ord_total_ttc} €</li>
        <li>Date : ${new Date(order.ord_date).toLocaleDateString('fr-FR')}</li>
      </ul>
      <p>Vous recevrez un email dès l'expédition de votre colis.</p>
    `;

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: customer.cst_mail,
      subject: `Commande ${order.ord_id} confirmée`,
      html,
    });

    this.logger.log(`✉️ Email confirmation envoyé à ${customer.cst_mail}`);
  }

  async sendShippingNotification(order: any, customer: any, trackingNumber: string) {
    const html = `
      <h1>Votre commande ${order.ord_id} est expédiée ! 📦</h1>
      <p>Bonjour ${customer.cst_fname},</p>
      <p>Votre colis a été confié au transporteur.</p>
      <h2>Suivi :</h2>
      <p>Numéro de suivi : <strong>${trackingNumber}</strong></p>
      <p><a href="https://tracking.laposte.fr/${trackingNumber}">Suivre mon colis</a></p>
      <p>Livraison estimée : 2-3 jours ouvrés</p>
    `;

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: customer.cst_mail,
      subject: `📦 Commande ${order.ord_id} expédiée`,
      html,
    });

    this.logger.log(`✉️ Email expédition envoyé à ${customer.cst_mail}`);
  }

  async sendPaymentReminder(order: any, customer: any) {
    const paymentUrl = `${process.env.FRONTEND_URL}/payment/${order.ord_id}`;
    
    const html = `
      <h1>Commande ${order.ord_id} en attente de paiement</h1>
      <p>Bonjour ${customer.cst_fname},</p>
      <p>Votre commande n'a pas encore été payée.</p>
      <p>Montant : <strong>${order.ord_total_ttc} €</strong></p>
      <p><a href="${paymentUrl}">Finaliser mon paiement</a></p>
      <p>Cette commande sera annulée automatiquement dans 7 jours si aucun paiement n'est effectué.</p>
    `;

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: customer.cst_mail,
      subject: `Rappel : Paiement commande ${order.ord_id}`,
      html,
    });

    this.logger.log(`✉️ Email rappel paiement envoyé à ${customer.cst_mail}`);
  }
}
```

**Ajouter dans `orders.module.ts` :**

```typescript
import { EmailService } from '../../services/email.service';

@Module({
  providers: [
    // ...
    EmailService, // ✅ Ajouter
  ],
})
export class OrdersModule {}
```

---

## 🔌 Étape 4 : Endpoints Actions Manquants

### 4.1 - Créer Endpoints Manquants

**Fichier :** `backend/src/modules/orders/controllers/order-actions.controller.ts`

**Ajouter ces endpoints :**

```typescript
import { EmailService } from '../../../services/email.service';

@Controller('api/admin/orders')
export class OrderActionsController {
  constructor(
    private readonly orderActionsService: OrderActionsService,
    private readonly emailService: EmailService, // ✅ Injecter
  ) {}

  /**
   * POST /api/admin/orders/:orderId/validate
   * Valider commande (statut 2 → 3)
   */
  @Post(':orderId/validate')
  async validateOrder(@Param('orderId') orderId: string) {
    // 1. Vérifier paiement
    const order = await this.orderActionsService.getOrder(orderId);
    if (order.ord_is_pay !== '1') {
      throw new BadRequestException('Commande non payée');
    }

    // 2. Changer statut
    await this.orderActionsService.updateOrderStatus(orderId, '3');

    // 3. Email confirmation
    const customer = await this.orderActionsService.getCustomer(order.ord_cst_id);
    await this.emailService.sendOrderConfirmation(order, customer);

    return {
      success: true,
      message: 'Commande validée',
      order: { ...order, ord_ords_id: '3' },
    };
  }

  /**
   * POST /api/admin/orders/:orderId/ship
   * Expédier commande (statut 3 → 4)
   */
  @Post(':orderId/ship')
  async shipOrder(
    @Param('orderId') orderId: string,
    @Body() body: { trackingNumber: string },
  ) {
    if (!body.trackingNumber) {
      throw new BadRequestException('Numéro de suivi requis');
    }

    // 1. Récupérer commande
    const order = await this.orderActionsService.getOrder(orderId);

    // 2. Mettre à jour
    await this.orderActionsService.shipOrder(orderId, body.trackingNumber);

    // 3. Email client
    const customer = await this.orderActionsService.getCustomer(order.ord_cst_id);
    await this.emailService.sendShippingNotification(
      order,
      customer,
      body.trackingNumber,
    );

    return {
      success: true,
      message: 'Commande expédiée',
      trackingNumber: body.trackingNumber,
    };
  }

  /**
   * POST /api/admin/orders/:orderId/cancel
   * Annuler commande
   */
  @Post(':orderId/cancel')
  async cancelOrder(
    @Param('orderId') orderId: string,
    @Body() body: { reason: string },
  ) {
    await this.orderActionsService.cancelOrder(orderId, body.reason);

    return {
      success: true,
      message: 'Commande annulée',
    };
  }

  /**
   * POST /api/admin/orders/:orderId/payment-reminder
   * Relancer paiement
   */
  @Post(':orderId/payment-reminder')
  async sendPaymentReminder(@Param('orderId') orderId: string) {
    const order = await this.orderActionsService.getOrder(orderId);
    
    if (order.ord_is_pay === '1') {
      throw new BadRequestException('Commande déjà payée');
    }

    const customer = await this.orderActionsService.getCustomer(order.ord_cst_id);
    await this.emailService.sendPaymentReminder(order, customer);

    return {
      success: true,
      message: 'Email de rappel envoyé',
    };
  }
}
```

---

### 4.2 - Compléter Service Actions

**Fichier :** `backend/src/modules/orders/services/order-actions.service.ts`

**Ajouter méthodes manquantes :**

```typescript
import { Injectable } from '@nestjs/common';
import { LegacyOrderService } from '../../../database/services/legacy-order.service';

@Injectable()
export class OrderActionsService {
  constructor(private readonly legacyOrderService: LegacyOrderService) {}

  async getOrder(orderId: string) {
    return this.legacyOrderService.getOrderById(orderId);
  }

  async getCustomer(customerId: string) {
    // Utiliser le service existant
    return this.legacyOrderService['supabase']
      .from('___xtr_customer')
      .select('*')
      .eq('cst_id', customerId)
      .single();
  }

  async updateOrderStatus(orderId: string, newStatus: string) {
    return this.legacyOrderService['supabase']
      .from('___xtr_order')
      .update({
        ord_ords_id: newStatus,
      })
      .eq('ord_id', orderId);
  }

  async shipOrder(orderId: string, trackingNumber: string) {
    return this.legacyOrderService['supabase']
      .from('___xtr_order')
      .update({
        ord_ords_id: '4', // Expédiée
        ord_date_ship: new Date().toISOString(),
        ord_tracking: trackingNumber,
      })
      .eq('ord_id', orderId);
  }

  async cancelOrder(orderId: string, reason: string) {
    return this.legacyOrderService['supabase']
      .from('___xtr_order')
      .update({
        ord_ords_id: '6', // Annulée
        ord_cancel_date: new Date().toISOString(),
        ord_cancel_reason: reason,
      })
      .eq('ord_id', orderId);
  }
}
```

---

## ✅ Étape 5 : Tests de Validation

### 5.1 - Checklist Tests Backend

```bash
# Terminal 1: Backend
cd /workspaces/nestjs-remix-monorepo/backend
npm run dev

# Terminal 2: Tests
# 1. Lister statuts
curl http://localhost:3000/order-status/all | jq

# 2. Récupérer commandes (avec session)
curl http://localhost:3000/api/legacy-orders \
  -H "Cookie: connect.sid=your_session" | jq

# 3. Tester validation (avec orderId réel)
curl -X POST http://localhost:3000/api/admin/orders/278383/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session"

# 4. Tester expédition
curl -X POST http://localhost:3000/api/admin/orders/278383/ship \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session" \
  -d '{"trackingNumber": "FR123456789"}'
```

---

### 5.2 - Checklist Tests Frontend

**Page `/admin/orders` :**
- [ ] Tableau affiche toutes les commandes
- [ ] Filtres par statut fonctionnent
- [ ] Boutons d'action apparaissent selon statut
- [ ] Clic "Valider" → Confirmation → API call → Reload
- [ ] Clic "Expédier" → Prompt suivi → API call → Toast
- [ ] Clic "Annuler" → Prompt raison → API call → Reload
- [ ] Toast notifications affichées correctement

**Page `/admin/payments` :**
- [ ] Liste paiements avec méthodes (CB/PayPal)
- [ ] Filtres fonctionnent
- [ ] Pagination 1/18 pages

---

## 📊 Étape 6 : Monitoring & Logs

### 6.1 - Logs Backend

**Ajouter dans chaque action :**

```typescript
@Post(':orderId/validate')
async validateOrder(@Param('orderId') orderId: string) {
  this.logger.log(`🔍 Validation commande ${orderId} démarrée`);
  
  try {
    // ... logique
    this.logger.log(`✅ Commande ${orderId} validée avec succès`);
    return { success: true };
  } catch (error) {
    this.logger.error(`❌ Échec validation ${orderId}:`, error);
    throw error;
  }
}
```

**Logs dans console :**
```
[OrderActionsController] 🔍 Validation commande 278383 démarrée
[EmailService] ✉️ Email confirmation envoyé à client@email.com
[OrderActionsController] ✅ Commande 278383 validée avec succès
```

---

### 6.2 - Dashboard Statistiques

**Ajouter dans `/admin/dashboard` :**

```tsx
// Statistiques commandes par statut
const stats = {
  pending: orders.filter(o => o.ord_ords_id === '1').length,
  confirmed: orders.filter(o => o.ord_ords_id === '2').length,
  processing: orders.filter(o => o.ord_ords_id === '3').length,
  shipped: orders.filter(o => o.ord_ords_id === '4').length,
  delivered: orders.filter(o => o.ord_ords_id === '5').length,
  cancelled: orders.filter(o => o.ord_ords_id === '6').length,
};

return (
  <div className="grid grid-cols-3 gap-4">
    <StatCard
      title="En attente"
      value={stats.pending}
      color="yellow"
      icon={<Clock />}
    />
    <StatCard
      title="À traiter"
      value={stats.confirmed + stats.processing}
      color="blue"
      icon={<Package />}
    />
    <StatCard
      title="Expédiées"
      value={stats.shipped}
      color="orange"
      icon={<Truck />}
    />
  </div>
);
```

---

## 🎯 Résumé Final

### ✅ Ce qui est fait
- [x] Tables BDD configurées
- [x] Services backend existants
- [x] Controllers API existants
- [x] Page admin commandes enrichie
- [x] Pagination et filtres paiements

### 🚀 À activer maintenant
1. **Décommenter guards** dans controllers (sécurité)
2. **Ajouter boutons d'action** dans page admin
3. **Créer EmailService** pour notifications
4. **Ajouter endpoints** (validate, ship, cancel)
5. **Installer react-hot-toast** pour UI feedback
6. **Tester workflow** complet avec commande réelle

### 📝 Commandes à exécuter

```bash
# Backend
cd backend
npm install nodemailer @types/nodemailer
npm run dev

# Frontend
cd frontend
npm install react-hot-toast
npm run dev

# Test
curl http://localhost:3000/order-status/all
```

---

**🚀 Système de traitement des commandes prêt à être activé !**

**Temps d'activation estimé :** 2-3 heures  
**Niveau technique requis :** Intermédiaire  
**Documentation :** PROCESSUS-TRAITEMENT-COMMANDES.md
