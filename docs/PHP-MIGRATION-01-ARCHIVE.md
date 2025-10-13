# 📋 Analyse PHP → TypeScript : Archives des Commandes

**Fichier source** : `archive.php` (page liste des commandes archivées)  
**Date d'analyse** : 2025-01-06  
**Priorité** : 🔴 HAUTE (fonctionnalité critique)

---

## 1. 🔍 Vue d'Ensemble

### Fonction Principale
Page de consultation de **toutes les commandes** avec :
- Liste complète des commandes (toutes statuts)
- Informations client
- Statuts par département
- Liens vers détails

### Tables Utilisées
```sql
___XTR_ORDER                        → ___xtr_order
___XTR_CUSTOMER                     → ___xtr_customer
___XTR_CUSTOMER_BILLING_ADDRESS     → ___xtr_customer_billing_address
___XTR_CUSTOMER_DELIVERY_ADDRESS    → ___xtr_customer_delivery_address
___CONFIG_ADMIN                     → ___config_admin (authentification)
```

### Système d'Authentification Identifié
```php
// Vérification niveau accès
CNFA_LEVEL > 6          // Niveau minimum requis
CNFA_ACTIV = '1'        // Compte actif
```

---

## 2. 🎯 Logique Métier Extraite

### 2.1 Système de Départements
```php
ORD_DEPT_ID:
  0  → "En attente de paiement" (gris)
  1  → "Département Commercial"  (bleu)
  2  → "Département Expédition"  (vert)
  99 → "Commande Annulée"        (rouge)
```

### 2.2 Système de Suppléments
```php
ORD_PARENT > 0 → Commande supplément liée à une commande parent
```

### 2.3 Champs Affichés
```php
- ORD_ID (ID commande)
- ORD_DATE (Date création)
- ORD_DATE_PAY (Date paiement)
- ORD_IS_PAY (Payée ou non)
- ORD_PARENT (Commande parent si supplément)
- ORD_AMOUNT_TTC (Montant articles TTC)
- ORD_DEPOSIT_TTC (Acompte TTC)
- ORD_SHIPPING_FEE_TTC (Frais de port TTC)
- ORD_TOTAL_TTC (Total TTC)
- Client : Civilité, Nom, Prénom, Téléphones, Email
```

---

## 3. 📊 Requête SQL Complète

### Requête Originale (Optimisée)
```sql
SELECT 
    ORD_ID, ORD_DATE, ORD_DATE_PAY, ORD_INFO,  
    ORD_AMOUNT_TTC, ORD_DEPOSIT_TTC, ORD_SHIPPING_FEE_TTC, ORD_TOTAL_TTC, 
    ORD_CST_ID, ORD_IS_PAY, ORD_DEPT_ID, ORD_PARENT,
    CST_CIVILITY, CST_NAME, CST_FNAME, CST_ADDRESS, CST_ZIP_CODE, 
    CST_CITY, CST_COUNTRY, CST_TEL, CST_GSM, CST_MAIL
FROM ___XTR_ORDER 
JOIN ___XTR_CUSTOMER 
    ON CST_ID = ORD_CST_ID AND CST_ACTIV = 1
JOIN ___XTR_CUSTOMER_BILLING_ADDRESS 
    ON CBA_ID = ORD_CBA_ID 
JOIN ___XTR_CUSTOMER_DELIVERY_ADDRESS 
    ON CDA_ID = ORD_CDA_ID 
ORDER BY ORD_DATE DESC
```

### Points d'Optimisation Identifiés
- ✅ JOIN avec condition `CST_ACTIV = 1` (bonne pratique)
- ⚠️ Pas de LIMIT → peut être lourd avec beaucoup de commandes
- ⚠️ Pas de pagination serveur (DataTables fait côté client)
- ⚠️ Colonnes adresses chargées mais non affichées

---

## 4. 🚀 Migration NestJS/TypeScript

### 4.1 DTOs (Data Transfer Objects)

```typescript
// backend/src/modules/orders/dto/order-archive.dto.ts

export class OrderArchiveDto {
  ord_id: number;
  ord_date: Date;
  ord_date_pay: Date;
  ord_info?: string;
  ord_amount_ttc: number;
  ord_deposit_ttc: number;
  ord_shipping_fee_ttc: number;
  ord_total_ttc: number;
  ord_cst_id: number;
  ord_is_pay: boolean;
  ord_dept_id: number;
  ord_parent: number;
  
  // Relations
  customer: {
    cst_civility: string;
    cst_name: string;
    cst_fname: string;
    cst_tel?: string;
    cst_gsm?: string;
    cst_mail: string;
  };
}

export class OrderArchiveFilterDto {
  @IsOptional()
  @IsEnum(['0', '1', '2', '99'])
  deptId?: string;
  
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
  
  @IsOptional()
  @IsDateString()
  dateFrom?: string;
  
  @IsOptional()
  @IsDateString()
  dateTo?: string;
  
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;
  
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(100)
  limit?: number;
}

export enum OrderDepartment {
  AWAITING_PAYMENT = 0,
  COMMERCIAL = 1,
  EXPEDITION = 2,
  CANCELLED = 99,
}

export const ORDER_DEPARTMENT_LABELS = {
  [OrderDepartment.AWAITING_PAYMENT]: 'En attente de paiement',
  [OrderDepartment.COMMERCIAL]: 'Département Commercial',
  [OrderDepartment.EXPEDITION]: 'Département Expédition',
  [OrderDepartment.CANCELLED]: 'Commande Annulée',
};

export const ORDER_DEPARTMENT_COLORS = {
  [OrderDepartment.AWAITING_PAYMENT]: 'gray',
  [OrderDepartment.COMMERCIAL]: 'blue',
  [OrderDepartment.EXPEDITION]: 'green',
  [OrderDepartment.CANCELLED]: 'red',
};
```

---

### 4.2 Service NestJS

```typescript
// backend/src/modules/orders/orders-archive.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { OrderArchiveDto, OrderArchiveFilterDto } from './dto/order-archive.dto';

@Injectable()
export class OrdersArchiveService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrdersArchiveService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Liste toutes les commandes avec filtres
   */
  async findAll(filters: OrderArchiveFilterDto): Promise<{
    data: OrderArchiveDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const startTime = Date.now();
    this.logger.log('📋 Fetching orders archive with filters:', filters);

    try {
      // Construction de la requête
      let query = this.supabase
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
          ord_is_pay,
          ord_dept_id,
          ord_parent,
          ___xtr_customer!inner (
            cst_id,
            cst_civility,
            cst_name,
            cst_fname,
            cst_tel,
            cst_gsm,
            cst_mail,
            cst_activ
          )
        `, { count: 'exact' });

      // Filtrer uniquement les clients actifs
      query = query.eq('___xtr_customer.cst_activ', 1);

      // Filtres optionnels
      if (filters.deptId !== undefined) {
        query = query.eq('ord_dept_id', filters.deptId);
      }

      if (filters.isPaid !== undefined) {
        query = query.eq('ord_is_pay', filters.isPaid);
      }

      if (filters.dateFrom) {
        query = query.gte('ord_date', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('ord_date', filters.dateTo);
      }

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;

      query = query
        .order('ord_date', { ascending: false })
        .range(offset, offset + limit - 1);

      // Exécution
      const { data, error, count } = await query;

      if (error) {
        this.logger.error('❌ Error fetching orders archive:', error);
        throw new Error(`Failed to fetch orders: ${error.message}`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`✅ Fetched ${data?.length || 0} orders in ${duration}ms`);

      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('❌ Fatal error in findAll:', error);
      throw error;
    }
  }

  /**
   * Statistiques rapides par département
   */
  async getStatsByDepartment(): Promise<{
    awaiting: number;
    commercial: number;
    expedition: number;
    cancelled: number;
    total: number;
  }> {
    this.logger.log('📊 Fetching statistics by department');

    const { data, error } = await this.supabase
      .from('___xtr_order')
      .select('ord_dept_id', { count: 'exact' });

    if (error) {
      this.logger.error('❌ Error fetching stats:', error);
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }

    const stats = {
      awaiting: data?.filter(o => o.ord_dept_id === 0).length || 0,
      commercial: data?.filter(o => o.ord_dept_id === 1).length || 0,
      expedition: data?.filter(o => o.ord_dept_id === 2).length || 0,
      cancelled: data?.filter(o => o.ord_dept_id === 99).length || 0,
      total: data?.length || 0,
    };

    this.logger.log('✅ Stats:', stats);
    return stats;
  }

  /**
   * Exporter les commandes en CSV
   */
  async exportToCSV(filters: OrderArchiveFilterDto): Promise<string> {
    const { data } = await this.findAll({ ...filters, limit: 10000 });
    
    // Génération CSV
    const headers = [
      'ID Commande',
      'Date Création',
      'Date Paiement',
      'Client',
      'Téléphone',
      'Email',
      'Montant TTC',
      'Frais Port',
      'Total TTC',
      'Statut',
      'Département',
    ];

    let csv = headers.join(';') + '\n';

    data.forEach(order => {
      const row = [
        order.ord_id,
        new Date(order.ord_date).toLocaleDateString('fr-FR'),
        new Date(order.ord_date_pay).toLocaleDateString('fr-FR'),
        `${order.customer.cst_civility} ${order.customer.cst_name} ${order.customer.cst_fname}`,
        order.customer.cst_tel || order.customer.cst_gsm || '',
        order.customer.cst_mail,
        order.ord_amount_ttc.toFixed(2),
        order.ord_shipping_fee_ttc.toFixed(2),
        order.ord_total_ttc.toFixed(2),
        order.ord_is_pay ? 'Payée' : 'Non payée',
        this.getDepartmentLabel(order.ord_dept_id),
      ];
      csv += row.join(';') + '\n';
    });

    return csv;
  }

  private getDepartmentLabel(deptId: number): string {
    const labels = {
      0: 'En attente de paiement',
      1: 'Département Commercial',
      2: 'Département Expédition',
      99: 'Commande Annulée',
    };
    return labels[deptId] || 'Inconnu';
  }
}
```

---

### 4.3 Controller NestJS

```typescript
// backend/src/modules/orders/orders-archive.controller.ts

import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { OrdersArchiveService } from './orders-archive.service';
import { OrderArchiveFilterDto } from './dto/order-archive.dto';
import { ModulePermissionGuard } from '../../auth/guards/module-permission.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';

@Controller('admin/orders/archive')
@UseGuards(ModulePermissionGuard)
@RequirePermission('orders', 'read')
export class OrdersArchiveController {
  constructor(
    private readonly ordersArchiveService: OrdersArchiveService,
  ) {}

  /**
   * GET /admin/orders/archive
   * Liste toutes les commandes archivées
   */
  @Get()
  async findAll(@Query() filters: OrderArchiveFilterDto) {
    return this.ordersArchiveService.findAll(filters);
  }

  /**
   * GET /admin/orders/archive/stats
   * Statistiques par département
   */
  @Get('stats')
  async getStats() {
    return this.ordersArchiveService.getStatsByDepartment();
  }

  /**
   * GET /admin/orders/archive/export
   * Export CSV
   */
  @Get('export')
  async exportCSV(
    @Query() filters: OrderArchiveFilterDto,
    @Res() res: Response,
  ) {
    const csv = await this.ordersArchiveService.exportToCSV(filters);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=commandes_archives.csv');
    res.send('\ufeff' + csv); // BOM UTF-8 pour Excel
  }
}
```

---

## 5. 🎨 Interface Frontend Remix

### 5.1 Route Remix

```typescript
// frontend/app/routes/admin.orders.archive._index.tsx

import { json, type LoaderFunction } from '@remix-run/node';
import { useLoaderData, useSearchParams, Link } from '@remix-run/react';
import { useState } from 'react';
import { 
  Calendar, 
  Download, 
  Filter, 
  Package, 
  TrendingUp,
  Users,
  XCircle 
} from 'lucide-react';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const deptId = url.searchParams.get('deptId');
  const isPaid = url.searchParams.get('isPaid');
  const page = url.searchParams.get('page') || '1';
  const limit = url.searchParams.get('limit') || '50';

  const params = new URLSearchParams();
  if (deptId) params.set('deptId', deptId);
  if (isPaid) params.set('isPaid', isPaid);
  params.set('page', page);
  params.set('limit', limit);

  const [ordersRes, statsRes] = await Promise.all([
    fetch(`http://localhost:3000/admin/orders/archive?${params}`),
    fetch('http://localhost:3000/admin/orders/archive/stats'),
  ]);

  const orders = await ordersRes.json();
  const stats = await statsRes.json();

  return json({ orders, stats });
};

export default function OrdersArchive() {
  const { orders, stats } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDept, setSelectedDept] = useState(searchParams.get('deptId') || 'all');

  const handleFilterChange = (deptId: string) => {
    setSelectedDept(deptId);
    const params = new URLSearchParams(searchParams);
    if (deptId === 'all') {
      params.delete('deptId');
    } else {
      params.set('deptId', deptId);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const getDepartmentBadgeClass = (deptId: number) => {
    const classes = {
      0: 'bg-gray-100 text-gray-800',
      1: 'bg-blue-100 text-blue-800',
      2: 'bg-green-100 text-green-800',
      99: 'bg-red-100 text-red-800',
    };
    return classes[deptId] || 'bg-gray-100 text-gray-800';
  };

  const getDepartmentLabel = (deptId: number) => {
    const labels = {
      0: 'En attente de paiement',
      1: 'Département Commercial',
      2: 'Département Expédition',
      99: 'Commande Annulée',
    };
    return labels[deptId] || 'Inconnu';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                📦 Archives des Commandes
              </h1>
              <p className="text-gray-600 mt-1">
                Liste complète de toutes les commandes sur le site
              </p>
            </div>
            
            <Link
              to="/admin/orders/archive/export"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exporter CSV
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Calendar className="w-6 h-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.awaiting}</div>
                <div className="text-sm text-gray-600">En attente</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.commercial}</div>
                <div className="text-sm text-gray-600">Commercial</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.expedition}</div>
                <div className="text-sm text-gray-600">Expédition</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.cancelled}</div>
                <div className="text-sm text-gray-600">Annulées</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filtres</h3>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDept === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Toutes ({stats.total})
            </button>
            <button
              onClick={() => handleFilterChange('0')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDept === '0'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              En attente ({stats.awaiting})
            </button>
            <button
              onClick={() => handleFilterChange('1')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDept === '1'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              Commercial ({stats.commercial})
            </button>
            <button
              onClick={() => handleFilterChange('2')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDept === '2'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              Expédition ({stats.expedition})
            </button>
            <button
              onClick={() => handleFilterChange('99')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedDept === '99'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              Annulées ({stats.cancelled})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.data.map((order: any) => (
                <tr key={order.ord_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {order.ord_id}/A
                    </div>
                    {order.ord_parent > 0 && (
                      <div className="text-xs text-gray-500">
                        Supplément: {order.ord_parent}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div><b>DC:</b> {new Date(order.ord_date).toLocaleDateString('fr-FR')}</div>
                    <div><b>DP:</b> {new Date(order.ord_date_pay).toLocaleDateString('fr-FR')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {order.customer.cst_civility} {order.customer.cst_name} {order.customer.cst_fname}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.customer.cst_tel} / {order.customer.cst_gsm}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.ord_total_ttc.toFixed(2)} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDepartmentBadgeClass(order.ord_dept_id)}`}>
                      {getDepartmentLabel(order.ord_dept_id)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/admin/orders/${order.ord_id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Consulter →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {orders.total > orders.limit && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Affichage de {((orders.page - 1) * orders.limit) + 1} à {Math.min(orders.page * orders.limit, orders.total)} sur {orders.total} commandes
            </div>
            <div className="flex gap-2">
              {orders.page > 1 && (
                <Link
                  to={`?page=${orders.page - 1}${selectedDept !== 'all' ? `&deptId=${selectedDept}` : ''}`}
                  className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Précédent
                </Link>
              )}
              {orders.page * orders.limit < orders.total && (
                <Link
                  to={`?page=${orders.page + 1}${selectedDept !== 'all' ? `&deptId=${selectedDept}` : ''}`}
                  className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Suivant
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 6. ✅ Checklist de Migration

### Backend
- [ ] Créer `OrderArchiveDto`
- [ ] Créer `OrderArchiveFilterDto`
- [ ] Créer `OrdersArchiveService`
- [ ] Créer `OrdersArchiveController`
- [ ] Ajouter tests unitaires
- [ ] Documenter API (Swagger)

### Frontend
- [ ] Créer route `admin.orders.archive._index.tsx`
- [ ] Implémenter filtres département
- [ ] Implémenter pagination
- [ ] Implémenter export CSV
- [ ] Tests E2E

### Validation
- [ ] Tester avec 1000+ commandes
- [ ] Valider performance requêtes
- [ ] Vérifier permissions (niveau > 6)
- [ ] Tester export CSV avec Excel

---

## 7. 🎯 Points d'Attention

### Améliorations vs PHP
✅ **Pagination serveur** (vs client-side DataTables)  
✅ **Typage fort** TypeScript  
✅ **Filtres optimisés** avec Supabase  
✅ **Export CSV** avec BOM UTF-8  
✅ **Stats temps réel** par département  

### Limitations Identifiées
⚠️ Pas de recherche full-text client (à ajouter)  
⚠️ Pas de filtres avancés (montant, dates)  
⚠️ Pas d'actions bulk (annuler plusieurs commandes)  

---

## 8. 📊 Prochaines Étapes

1. **Analyser `order_detail.php`** → Détail commande avec actions
2. **Analyser `order_update.php`** → Changement statut
3. **Analyser `invoice_generate.php`** → Génération factures

**Prêt pour le prochain fichier PHP !** 🚀
