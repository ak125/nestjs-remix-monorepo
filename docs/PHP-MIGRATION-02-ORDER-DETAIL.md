# 📋 Analyse PHP → TypeScript : Détail Commande

**Fichier source** : `order_detail.php` (page détail d'une commande)  
**Date d'analyse** : 2025-01-06  
**Priorité** : 🔴 CRITIQUE (vue complète commande)

---

## 1. 🔍 Vue d'Ensemble

### Fonction Principale
Affichage **complet d'une commande** avec :
- Informations client (commande, facturation, livraison)
- Détails lignes de commande avec prix d'achat/vente
- Système d'équivalences articles
- Statuts par ligne de commande
- Gestion des fournisseurs
- Système de consignes
- Totaux détaillés

### Tables Utilisées
```sql
___XTR_ORDER                        → ___xtr_order
___XTR_ORDER_LINE                   → ___xtr_order_line
___XTR_ORDER_LINE_STATUS            → ___xtr_order_line_status
___XTR_CUSTOMER                     → ___xtr_customer
___XTR_CUSTOMER_BILLING_ADDRESS     → ___xtr_customer_billing_address
___XTR_CUSTOMER_DELIVERY_ADDRESS    → ___xtr_customer_delivery_address
___CONFIG_ADMIN                     → ___config_admin
```

---

## 2. 🎯 Logique Métier Extraite

### 2.1 Structure de Commande Complète

```typescript
interface OrderDetail {
  // En-tête commande
  orderId: number;
  dateCreation: Date;
  datePaiement: Date;
  vehicleInfo: string;
  
  // Montants
  amountTTC: number;      // Sous-total articles
  depositTTC: number;     // Consignes
  shippingFeeTTC: number; // Frais de port
  totalTTC: number;       // Total général
  
  // Client (commandé par)
  customer: {
    civility: string;
    name: string;
    firstName: string;
    address: string;
    zipCode: string;
    city: string;
    country: string;
    tel: string;
    gsm: string;
    email: string;
  };
  
  // Adresse facturation
  billingAddress: {
    civility: string;
    name: string;
    firstName: string;
    address: string;
    zipCode: string;
    city: string;
    country: string;
  };
  
  // Adresse livraison
  deliveryAddress: {
    civility: string;
    name: string;
    firstName: string;
    address: string;
    zipCode: string;
    city: string;
    country: string;
  };
  
  // Paiement
  paymentMethod: 'CB' | 'VIREMENT' | 'CHEQUE';
  paymentType: 'Master Card' | 'Visa' | 'Autre';
  
  // Lignes de commande
  lines: OrderLine[];
}
```

### 2.2 Structure Ligne de Commande

```typescript
interface OrderLine {
  id: number;
  orderId: number;
  
  // Article
  productName: string;        // ORL_PG_NAME (gamme)
  brandName: string;          // ORL_PM_NAME (marque)
  reference: string;          // ORL_ART_REF
  quantity: number;           // ORL_ART_QUANTITY
  
  // Prix
  priceBuyUnitHT: number;     // PA U HT (prix d'achat)
  priceSellUnitTTC: number;   // PV U TTC (prix de vente)
  priceSellTTC: number;       // PT TTC (total ligne)
  depositUnitTTC: number;     // Consigne unitaire
  depositTotalTTC: number;    // Consigne totale (qty * unit)
  
  // Fournisseur
  supplierId: number;         // ORL_SPL_ID
  supplierName: string;       // ORL_SPL_NAME
  supplierPriceBuyUnitHT: number; // Prix fournisseur
  
  // Statut
  statusId: number;           // ORL_ORLS_ID
  statusName: string;         // ORLS_NAME
  statusColor: string;        // ORLS_COLOR (hex)
  
  // Équivalence (si article de remplacement)
  equivId: number;            // ORL_EQUIV_ID
  originalLine?: OrderLine;   // Ligne originale remplacée
  refundAmount?: number;      // Remboursement si changement
}
```

### 2.3 Système d'Équivalences 🔄

**Concept clé identifié** :
```php
// Ligne originale avec ORL_EQUIV_ID = 0
// Si article non disponible → créer ligne équivalente avec ORL_EQUIV_ID = [id ligne originale]

// Statut 93 = "Refus d'équivalence" → ne pas afficher
WHERE ORL_EQUIV_ID = $ord_line_id_this AND ORL_ORLS_ID != 93
```

**Workflow** :
1. Client commande article A (ligne 1, equiv_id=0)
2. Article A indisponible
3. Commercial propose article B équivalent (ligne 2, equiv_id=1)
4. Client accepte → ligne 2 visible avec "Au lieu de..."
5. Client refuse → ligne 2 passe à statut 93 (masqué)

### 2.4 Alertes Système

```php
// Validation code postal
if (zipCode == 65535) {
  // 65535 = code postal invalide/temporaire
  ALERT: "Vérifier le code postal du client !!!"
}
```

### 2.5 Système de Consignes

```php
// Consigne par article
if (ORL_ART_DEPOSIT_UNIT_TTC > 0) {
  depositTotal = quantity * depositUnitTTC
  
  // Ajouté au total commande
  ORD_DEPOSIT_TTC = sum(all deposits)
}
```

---

## 3. 📊 Requêtes SQL Identifiées

### 3.1 Requête Principale (Commande)

```sql
SELECT 
    -- Commande
    ORD_ID, ORD_DATE, ORD_DATE_PAY, ORD_INFO,  
    ORD_AMOUNT_TTC, ORD_DEPOSIT_TTC, ORD_SHIPPING_FEE_TTC, ORD_TOTAL_TTC, 
    ORD_CST_ID, ORD_CBA_ID, ORD_CDA_ID,
    
    -- Client
    CST_CIVILITY, CST_NAME, CST_FNAME, CST_ADDRESS, CST_ZIP_CODE, 
    CST_CITY, CST_COUNTRY, CST_TEL, CST_GSM, CST_MAIL, 
    
    -- Facturation
    CBA_CIVILITY, CBA_NAME, CBA_FNAME, CBA_ADDRESS, 
    CBA_ZIP_CODE, CBA_CITY, CBA_COUNTRY, 
    
    -- Livraison
    CDA_CIVILITY, CDA_NAME, CDA_FNAME, CDA_ADDRESS, 
    CDA_ZIP_CODE, CDA_CITY, CDA_COUNTRY
FROM ___XTR_ORDER 
JOIN ___XTR_CUSTOMER 
    ON CST_ID = ORD_CST_ID AND CST_ACTIV = 1
JOIN ___XTR_CUSTOMER_BILLING_ADDRESS 
    ON CBA_ID = ORD_CBA_ID 
JOIN ___XTR_CUSTOMER_DELIVERY_ADDRESS 
    ON CDA_ID = ORD_CDA_ID 
WHERE ORD_ID = $ord_id
```

### 3.2 Requête Lignes Commande

```sql
SELECT * 
FROM ___XTR_ORDER_LINE 
JOIN ___XTR_ORDER_LINE_STATUS 
    ON ORLS_ID = ORL_ORLS_ID
WHERE ORL_ORD_ID = $ord_id
  AND ORL_EQUIV_ID = 0  -- Seulement lignes principales
ORDER BY ORL_ID
```

### 3.3 Requête Équivalences

```sql
SELECT * 
FROM ___XTR_ORDER_LINE 
JOIN ___XTR_ORDER_LINE_STATUS 
    ON ORLS_ID = ORL_ORLS_ID
WHERE ORL_EQUIV_ID = $ord_line_id  -- Lignes de remplacement
  AND ORL_ORLS_ID != 93             -- Sauf refusées
ORDER BY ORL_ID
```

---

## 4. 🚀 Migration NestJS/TypeScript

### 4.1 DTOs Complets

```typescript
// backend/src/modules/orders/dto/order-detail.dto.ts

export class AddressDto {
  civility: string;
  name: string;
  firstName: string;
  address: string;
  zipCode: string;
  city: string;
  country: string;
}

export class CustomerContactDto extends AddressDto {
  tel?: string;
  gsm?: string;
  email: string;
}

export class OrderLineDto {
  orl_id: number;
  orl_ord_id: number;
  
  // Article
  orl_pg_name: string;
  orl_pm_name: string;
  orl_art_ref: string;
  orl_art_quantity: number;
  
  // Prix
  orl_art_price_buy_unit_ht: number;
  orl_art_price_sell_unit_ttc: number;
  orl_art_price_sell_ttc: number;
  orl_art_deposit_unit_ttc: number;
  orl_art_deposit_total_ttc: number;
  
  // Fournisseur
  orl_spl_id?: number;
  orl_spl_name?: string;
  orl_spl_price_buy_unit_ht?: number;
  
  // Statut
  orl_orls_id: number;
  orls_name: string;
  orls_color: string;
  
  // Équivalence
  orl_equiv_id: number;
  equivalent_line?: OrderLineDto;
  refund_amount?: number;
}

export class OrderDetailDto {
  // Commande
  ord_id: number;
  ord_date: Date;
  ord_date_pay: Date;
  ord_info: string;
  
  // Montants
  ord_amount_ttc: number;
  ord_deposit_ttc: number;
  ord_shipping_fee_ttc: number;
  ord_total_ttc: number;
  
  // Adresses
  customer: CustomerContactDto;
  billing_address: AddressDto;
  delivery_address: AddressDto;
  
  // Paiement
  payment_method: string;
  payment_type: string;
  
  // Lignes
  lines: OrderLineDto[];
  
  // Alertes
  has_invalid_zipcode: boolean;
  alerts: string[];
}

export class OrderLineStatusDto {
  orls_id: number;
  orls_name: string;
  orls_color: string;
  orls_description?: string;
}
```

---

### 4.2 Service NestJS

```typescript
// backend/src/modules/orders/orders-detail.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { OrderDetailDto, OrderLineDto } from './dto/order-detail.dto';

@Injectable()
export class OrdersDetailService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrdersDetailService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Récupère le détail complet d'une commande
   */
  async findOne(orderId: number): Promise<OrderDetailDto> {
    const startTime = Date.now();
    this.logger.log(`📋 Fetching order detail for ID: ${orderId}`);

    try {
      // 1. Récupérer la commande principale
      const { data: orderData, error: orderError } = await this.supabase
        .from('___xtr_order')
        .select(`
          ord_id,
          ord_date,
          ord_date_pay,
          ord_info,
          ord_amount_ttc,
          ord_deposit_ttc,
          ord_shipping_fee_ttc,
          ord_total_ttc,
          ord_cst_id,
          ord_cba_id,
          ord_cda_id,
          ___xtr_customer!inner (
            cst_id,
            cst_civility,
            cst_name,
            cst_fname,
            cst_address,
            cst_zip_code,
            cst_city,
            cst_country,
            cst_tel,
            cst_gsm,
            cst_mail,
            cst_activ
          ),
          ___xtr_customer_billing_address!inner (
            cba_id,
            cba_civility,
            cba_name,
            cba_fname,
            cba_address,
            cba_zip_code,
            cba_city,
            cba_country
          ),
          ___xtr_customer_delivery_address!inner (
            cda_id,
            cda_civility,
            cda_name,
            cda_fname,
            cda_address,
            cda_zip_code,
            cda_city,
            cda_country
          )
        `)
        .eq('ord_id', orderId)
        .eq('___xtr_customer.cst_activ', 1)
        .single();

      if (orderError || !orderData) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      // 2. Récupérer les lignes de commande
      const lines = await this.getOrderLines(orderId);

      // 3. Détecter les alertes
      const alerts = this.detectAlerts(orderData);

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Order ${orderId} fetched in ${duration}ms with ${lines.length} lines`);

      // 4. Construire la réponse
      return {
        ord_id: orderData.ord_id,
        ord_date: new Date(orderData.ord_date),
        ord_date_pay: new Date(orderData.ord_date_pay),
        ord_info: orderData.ord_info,
        ord_amount_ttc: orderData.ord_amount_ttc,
        ord_deposit_ttc: orderData.ord_deposit_ttc,
        ord_shipping_fee_ttc: orderData.ord_shipping_fee_ttc,
        ord_total_ttc: orderData.ord_total_ttc,
        
        customer: {
          civility: orderData.___xtr_customer.cst_civility,
          name: orderData.___xtr_customer.cst_name,
          firstName: orderData.___xtr_customer.cst_fname,
          address: orderData.___xtr_customer.cst_address,
          zipCode: orderData.___xtr_customer.cst_zip_code,
          city: orderData.___xtr_customer.cst_city,
          country: orderData.___xtr_customer.cst_country,
          tel: orderData.___xtr_customer.cst_tel,
          gsm: orderData.___xtr_customer.cst_gsm,
          email: orderData.___xtr_customer.cst_mail,
        },
        
        billing_address: {
          civility: orderData.___xtr_customer_billing_address.cba_civility,
          name: orderData.___xtr_customer_billing_address.cba_name,
          firstName: orderData.___xtr_customer_billing_address.cba_fname,
          address: orderData.___xtr_customer_billing_address.cba_address,
          zipCode: orderData.___xtr_customer_billing_address.cba_zip_code,
          city: orderData.___xtr_customer_billing_address.cba_city,
          country: orderData.___xtr_customer_billing_address.cba_country,
        },
        
        delivery_address: {
          civility: orderData.___xtr_customer_delivery_address.cda_civility,
          name: orderData.___xtr_customer_delivery_address.cda_name,
          firstName: orderData.___xtr_customer_delivery_address.cda_fname,
          address: orderData.___xtr_customer_delivery_address.cda_address,
          zipCode: orderData.___xtr_customer_delivery_address.cda_zip_code,
          city: orderData.___xtr_customer_delivery_address.cda_city,
          country: orderData.___xtr_customer_delivery_address.cda_country,
        },
        
        payment_method: 'CB',
        payment_type: 'Master Card',
        
        lines,
        
        has_invalid_zipcode: alerts.length > 0,
        alerts,
      };
    } catch (error) {
      this.logger.error(`❌ Error fetching order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les lignes de commande avec équivalences
   */
  private async getOrderLines(orderId: number): Promise<OrderLineDto[]> {
    // Récupérer toutes les lignes principales (equiv_id = 0)
    const { data: mainLines, error } = await this.supabase
      .from('___xtr_order_line')
      .select(`
        *,
        ___xtr_order_line_status!inner (
          orls_id,
          orls_name,
          orls_color
        )
      `)
      .eq('orl_ord_id', orderId)
      .eq('orl_equiv_id', 0)
      .order('orl_id', { ascending: true });

    if (error) {
      this.logger.error('❌ Error fetching order lines:', error);
      throw new Error(`Failed to fetch order lines: ${error.message}`);
    }

    // Pour chaque ligne, récupérer les équivalences
    const linesWithEquiv = await Promise.all(
      (mainLines || []).map(async (line) => {
        const equivLine = await this.getEquivalentLine(line.orl_id);
        
        return {
          orl_id: line.orl_id,
          orl_ord_id: line.orl_ord_id,
          orl_pg_name: line.orl_pg_name,
          orl_pm_name: line.orl_pm_name,
          orl_art_ref: line.orl_art_ref,
          orl_art_quantity: line.orl_art_quantity,
          orl_art_price_buy_unit_ht: line.orl_art_price_buy_unit_ht,
          orl_art_price_sell_unit_ttc: line.orl_art_price_sell_unit_ttc,
          orl_art_price_sell_ttc: line.orl_art_price_sell_ttc,
          orl_art_deposit_unit_ttc: line.orl_art_deposit_unit_ttc,
          orl_art_deposit_total_ttc: line.orl_art_quantity * line.orl_art_deposit_unit_ttc,
          orl_spl_id: line.orl_spl_id,
          orl_spl_name: line.orl_spl_name,
          orl_spl_price_buy_unit_ht: line.orl_spl_price_buy_unit_ht,
          orl_orls_id: line.orl_orls_id,
          orls_name: line.___xtr_order_line_status.orls_name,
          orls_color: line.___xtr_order_line_status.orls_color,
          orl_equiv_id: line.orl_equiv_id,
          equivalent_line: equivLine,
          refund_amount: equivLine ? 500.00 : undefined, // TODO: calculer vraiment
        };
      })
    );

    return linesWithEquiv;
  }

  /**
   * Récupère la ligne équivalente (article de remplacement)
   */
  private async getEquivalentLine(originalLineId: number): Promise<OrderLineDto | null> {
    const { data, error } = await this.supabase
      .from('___xtr_order_line')
      .select(`
        *,
        ___xtr_order_line_status!inner (
          orls_id,
          orls_name,
          orls_color
        )
      `)
      .eq('orl_equiv_id', originalLineId)
      .neq('orl_orls_id', 93) // Exclure les refus
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      orl_id: data.orl_id,
      orl_ord_id: data.orl_ord_id,
      orl_pg_name: data.orl_pg_name,
      orl_pm_name: data.orl_pm_name,
      orl_art_ref: data.orl_art_ref,
      orl_art_quantity: data.orl_art_quantity,
      orl_art_price_buy_unit_ht: data.orl_art_price_buy_unit_ht,
      orl_art_price_sell_unit_ttc: data.orl_art_price_sell_unit_ttc,
      orl_art_price_sell_ttc: data.orl_art_price_sell_ttc,
      orl_art_deposit_unit_ttc: data.orl_art_deposit_unit_ttc,
      orl_art_deposit_total_ttc: data.orl_art_quantity * data.orl_art_deposit_unit_ttc,
      orl_spl_id: data.orl_spl_id,
      orl_spl_name: data.orl_spl_name,
      orl_spl_price_buy_unit_ht: data.orl_spl_price_buy_unit_ht,
      orl_orls_id: data.orl_orls_id,
      orls_name: data.___xtr_order_line_status.orls_name,
      orls_color: data.___xtr_order_line_status.orls_color,
      orl_equiv_id: data.orl_equiv_id,
    };
  }

  /**
   * Détecte les alertes (codes postaux invalides)
   */
  private detectAlerts(orderData: any): string[] {
    const alerts: string[] = [];
    const INVALID_ZIPCODE = '65535';

    if (orderData.___xtr_customer.cst_zip_code === INVALID_ZIPCODE) {
      alerts.push('Code postal client invalide (65535)');
    }

    if (orderData.___xtr_customer_billing_address.cba_zip_code === INVALID_ZIPCODE) {
      alerts.push('Code postal facturation invalide (65535)');
    }

    if (orderData.___xtr_customer_delivery_address.cda_zip_code === INVALID_ZIPCODE) {
      alerts.push('Code postal livraison invalide (65535)');
    }

    return alerts;
  }

  /**
   * Récupère tous les statuts de ligne disponibles
   */
  async getOrderLineStatuses(): Promise<OrderLineStatusDto[]> {
    const { data, error } = await this.supabase
      .from('___xtr_order_line_status')
      .select('*')
      .order('orls_id', { ascending: true });

    if (error) {
      this.logger.error('❌ Error fetching statuses:', error);
      throw new Error(`Failed to fetch statuses: ${error.message}`);
    }

    return data || [];
  }
}
```

---

### 4.3 Controller NestJS

```typescript
// backend/src/modules/orders/orders-detail.controller.ts

import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { OrdersDetailService } from './orders-detail.service';
import { ModulePermissionGuard } from '../../auth/guards/module-permission.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';

@Controller('admin/orders')
@UseGuards(ModulePermissionGuard)
@RequirePermission('orders', 'read')
export class OrdersDetailController {
  constructor(
    private readonly ordersDetailService: OrdersDetailService,
  ) {}

  /**
   * GET /admin/orders/:id
   * Détail complet d'une commande
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersDetailService.findOne(id);
  }

  /**
   * GET /admin/orders/:id/statuses
   * Liste des statuts disponibles pour les lignes
   */
  @Get('statuses')
  async getStatuses() {
    return this.ordersDetailService.getOrderLineStatuses();
  }
}
```

---

## 5. 🎨 Interface Frontend Remix

```typescript
// frontend/app/routes/admin.orders.$id.tsx

import { json, type LoaderFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { 
  AlertTriangle, 
  ArrowLeft, 
  Package, 
  User,
  MapPin,
  CreditCard,
  Truck,
  FileText
} from 'lucide-react';

export const loader: LoaderFunction = async ({ params }) => {
  const { id } = params;
  
  const response = await fetch(`http://localhost:3000/admin/orders/${id}`);
  
  if (!response.ok) {
    throw new Response('Commande non trouvée', { status: 404 });
  }
  
  const order = await response.json();
  return json({ order });
};

export default function OrderDetail() {
  const { order } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/admin/orders"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  📦 Commande n° {order.ord_id}/A
                </h1>
                <p className="text-gray-600 mt-1">
                  DC: {new Date(order.ord_date).toLocaleDateString('fr-FR')} • 
                  DP: {new Date(order.ord_date_pay).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <FileText className="w-4 h-4 inline mr-2" />
                Générer Facture
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Package className="w-4 h-4 inline mr-2" />
                Expédier
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Alertes */}
        {order.alerts.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Attention : Vérifications nécessaires
                </h3>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {order.alerts.map((alert, idx) => (
                    <li key={idx}>{alert}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-red-700">
                  En cas d'erreur, contactez le webmaster avant de traiter la commande.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Informations client */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Commandé par */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Commandé par</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-medium">
                {order.customer.civility} {order.customer.name} {order.customer.firstName}
              </p>
              <p>{order.customer.address}</p>
              <p>{order.customer.zipCode} {order.customer.city}</p>
              <p>{order.customer.country}</p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Contact</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-1">
              <p>{order.customer.tel}</p>
              <p>{order.customer.gsm}</p>
              <p className="font-medium">{order.customer.email}</p>
            </div>
          </div>

          {/* Facturation */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Facturée à</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-medium">
                {order.billing_address.civility} {order.billing_address.name} {order.billing_address.firstName}
              </p>
              <p>{order.billing_address.address}</p>
              <p>{order.billing_address.zipCode} {order.billing_address.city}</p>
              <p>{order.billing_address.country}</p>
            </div>
          </div>

          {/* Livraison */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900">Livrée à</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-medium">
                {order.delivery_address.civility} {order.delivery_address.name} {order.delivery_address.firstName}
              </p>
              <p>{order.delivery_address.address}</p>
              <p>{order.delivery_address.zipCode} {order.delivery_address.city}</p>
              <p>{order.delivery_address.country}</p>
            </div>
          </div>
        </div>

        {/* Informations véhicule */}
        {order.ord_info && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              🚗 Informations véhicule
            </h3>
            <p className="text-blue-800 text-sm">
              {order.ord_info.replace(/<br>/g, ' / ')}
            </p>
          </div>
        )}

        {/* Lignes de commande */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900">Articles commandés</h3>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Article
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  PA U HT
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  PV U TTC
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  QTY
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  PT TTC
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.lines.map((line: any) => (
                <tr 
                  key={line.orl_id} 
                  style={{ backgroundColor: `#${line.orls_color}` }}
                  className="hover:opacity-90"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {line.orl_pg_name} {line.orl_pm_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Réf: {line.orl_art_ref}
                      </p>
                      {line.orl_art_deposit_unit_ttc > 0 && (
                        <p className="text-sm text-gray-600">
                          + Consigne {line.orl_art_deposit_total_ttc.toFixed(2)} €
                        </p>
                      )}
                      <p className="text-sm font-medium text-gray-700 mt-2">
                        Statut: {line.orls_name}
                      </p>
                      {line.orl_spl_name && (
                        <p className="text-sm text-red-600 font-medium">
                          Fournisseur: {line.orl_spl_name}
                        </p>
                      )}
                      {line.equivalent_line && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                          <p className="font-medium text-yellow-800">
                            Au lieu de: {line.equivalent_line.orl_pg_name} {line.equivalent_line.orl_pm_name}
                          </p>
                          <p className="text-yellow-700">
                            Réf: {line.equivalent_line.orl_art_ref} • 
                            Remboursement: {line.refund_amount?.toFixed(2)} €
                          </p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    <span className="text-red-600 font-medium">
                      {line.orl_spl_price_buy_unit_ht?.toFixed(2) || line.orl_art_price_buy_unit_ht.toFixed(2)} €
                    </span>
                    {line.orl_spl_name && (
                      <p className="text-xs text-gray-600">{line.orl_spl_name}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium">
                    {line.orl_art_price_sell_unit_ttc.toFixed(2)} €
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium">
                    {line.orl_art_quantity}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium">
                    {line.orl_art_price_sell_ttc.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="max-w-md ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium">{order.ord_amount_ttc.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Consigne</span>
                <span className="font-medium">{order.ord_deposit_ttc.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Frais de port</span>
                <span className="font-medium">{order.ord_shipping_fee_ttc.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span>{order.ord_total_ttc.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. 🔑 Concepts Clés Identifiés

### 1. **Système d'Équivalences** (Remplacement d'articles)
- Article commandé non disponible
- Proposer équivalent avec ORL_EQUIV_ID
- Client accepte (visible) ou refuse (statut 93, masqué)

### 2. **Prix d'Achat vs Fournisseur**
- Prix d'achat par défaut: `ORL_ART_PRICE_BUY_UNIT_HT`
- Si fournisseur spécifique: `ORL_SPL_PRICE_BUY_UNIT_HT` (prioritaire)

### 3. **Consignes**
- Par article: `ORL_ART_DEPOSIT_UNIT_TTC`
- Total ligne: `quantity × deposit_unit`
- Total commande: `ORD_DEPOSIT_TTC`

### 4. **Validation Code Postal**
- `65535` = code invalide temporaire
- Alert critique avant traitement

### 5. **Couleurs de Statut**
- Chaque statut ligne a une couleur hex (`ORLS_COLOR`)
- Affichage visuel dans la liste

---

## 7. ✅ Prochaines Étapes

### Backend
- [ ] Implémenter `OrdersDetailService`
- [ ] Ajouter endpoint GET `/admin/orders/:id`
- [ ] Gérer les équivalences correctement
- [ ] Calculer remboursements automatiques

### Frontend
- [ ] Créer route `/admin/orders/$id`
- [ ] Afficher alertes codes postaux
- [ ] Afficher équivalences avec style
- [ ] Boutons actions (facture, expédition)

### Validation
- [ ] Tester avec commande avec équivalences
- [ ] Tester alertes code postal
- [ ] Vérifier calculs consignes

---

## 8. 📊 Fichier Suivant Recommandé

Pour compléter la gestion des commandes, j'ai maintenant besoin de :

**`order_update.php`** ou fichier d'**actions sur commandes** :
- Changer statut ligne
- Proposer équivalence
- Valider/refuser équivalence
- Expédier commande
- Générer facture

**Prêt pour le prochain fichier !** 🚀
