# 🔄 Analyse PHP → TypeScript : Changement Statut Ligne Commande

**Fichier source** : `commande.line.status.1.php`  
**Date d'analyse** : 2025-01-06  
**Priorité** : 🔴 CRITIQUE (action commande)

---

## 1. 🔍 Ce que fait le PHP

### Action
**Réinitialiser une ligne de commande au statut 1** (En attente)

### Requête SQL
```sql
UPDATE ___XTR_ORDER_LINE 
SET ORL_ORLS_ID = 1,      -- Statut → 1 (En attente)
    ORL_EQUIV_ID = 0      -- Reset équivalence
WHERE ORL_ORD_ID = $ord_id 
  AND ORL_ID = $orl_id
```

### Sécurité PHP
```php
// Niveau admin requis > 6
$query_log = "SELECT * FROM ___CONFIG_ADMIN 
    WHERE CNFA_LOGIN='$log' 
      AND CNFA_KEYLOG='$mykey' 
      AND CNFA_LEVEL > 6";
```

### Interface
- Confirmation avant action
- Message succès/erreur
- Modal popup
- Retour immédiat

---

## 2. ✅ Ce qui EXISTE déjà dans NestJS

### Service OrderStatusService
```typescript
// ✅ Méthode existante
async updateLineStatus(
  lineId: number,
  newStatus: number,
  comment?: string,
  userId?: number
): Promise<any>
```

### Controller OrderStatusController
```typescript
// ✅ Endpoint existant
@Patch('line/:lineId')
async updateLineStatus(
  @Param('lineId') lineId: string,
  @Body() body: { status: number; comment?: string; userId?: number }
)
```

### Machine d'État
```typescript
// ✅ Validation transitions automatique
private readonly statusTransitions = new Map<number, number[]>([
  [1, [2, 91, 92]], // En attente → Confirmée, Annulée
  // ...
]);
```

---

## 3. 🚀 Ce qu'il faut AMÉLIORER

### ❌ Problème 1 : Reset Équivalence Manquant

**PHP fait** :
```sql
UPDATE ___XTR_ORDER_LINE 
SET ORL_ORLS_ID = 1, ORL_EQUIV_ID = 0  -- ⚠️ Reset équivalence
```

**NestJS fait** :
```typescript
// ❌ NE reset PAS l'équivalence
const { data: updatedLine, error: updateError } = await this.supabase
  .from('___xtr_order_line')
  .update({
    status: newStatus,  // ✅ OK
    updated_at: new Date().toISOString(),
    // ❌ MANQUE: orl_equiv_id: 0
  })
```

### ❌ Problème 2 : Noms de Colonnes Incorrects

**Supabase utilise lowercase** :
```typescript
// ❌ ERREUR (n'existe pas)
.update({ status: newStatus })

// ✅ CORRECT
.update({ orl_orls_id: newStatus })
```

### ❌ Problème 3 : Identification Ligne

**PHP utilise** : `ORL_ORD_ID` + `ORL_ID`  
**NestJS utilise** : Seulement `id` (générique)

```typescript
// ❌ Requête incorrecte
.eq('id', lineId)

// ✅ Requête correcte
.eq('orl_id', lineId)
```

### ❌ Problème 4 : Pas de Guard NestJS

**PHP vérifie** : `CNFA_LEVEL > 6`  
**NestJS** : Aucune vérification niveau admin

### ❌ Problème 5 : Pas de Logging Audit

**Besoin** :
- Qui a fait l'action ?
- Quand ?
- Pourquoi ?
- Valeur avant/après

---

## 4. 🎯 Solution Moderne NestJS

### 4.1 Améliorer OrderStatusService

```typescript
// backend/src/modules/orders/services/order-status.service.ts

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface UpdateLineStatusOptions {
  lineId: number;
  orderId: number;
  newStatus: number;
  comment?: string;
  userId: number; // ⚠️ OBLIGATOIRE (audit trail)
  resetEquivalence?: boolean; // Par défaut true pour statut 1
}

@Injectable()
export class OrderStatusService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderStatusService.name);

  /**
   * ✅ Méthode améliorée avec reset équivalence
   */
  async updateLineStatus(options: UpdateLineStatusOptions): Promise<any> {
    const { lineId, orderId, newStatus, comment, userId, resetEquivalence } = options;

    try {
      this.logger.log(`🔄 Changement statut ligne ${lineId} → ${newStatus}`);

      // 1. Récupérer ligne actuelle avec VRAIS noms de colonnes
      const { data: currentLine, error: fetchError } = await this.supabase
        .from('___xtr_order_line')
        .select('*')
        .eq('orl_id', lineId)
        .eq('orl_ord_id', orderId) // ⚠️ Sécurité : vérifier que ligne appartient bien à cette commande
        .single();

      if (fetchError || !currentLine) {
        throw new BadRequestException(
          `Ligne ${lineId} de commande ${orderId} introuvable`
        );
      }

      // 2. Vérifier transition autorisée
      const oldStatus = currentLine.orl_orls_id;
      if (!this.canTransition(oldStatus, newStatus)) {
        throw new BadRequestException(
          `Transition impossible: ${this.getStatusLabel(oldStatus)} → ${this.getStatusLabel(newStatus)}`
        );
      }

      // 3. Préparer mise à jour
      const updateData: any = {
        orl_orls_id: newStatus,
        orl_updated_at: new Date().toISOString(),
      };

      // ⚠️ NOUVEAU : Reset équivalence pour statut 1
      if (resetEquivalence !== false && newStatus === 1) {
        updateData.orl_equiv_id = 0;
        this.logger.log(`🔄 Reset équivalence pour ligne ${lineId}`);
      }

      // 4. Mettre à jour avec VRAIS noms de colonnes
      const { data: updatedLine, error: updateError } = await this.supabase
        .from('___xtr_order_line')
        .update(updateData)
        .eq('orl_id', lineId)
        .eq('orl_ord_id', orderId)
        .select()
        .single();

      if (updateError) {
        this.logger.error('❌ Erreur mise à jour ligne:', updateError);
        throw new BadRequestException(
          `Échec mise à jour: ${updateError.message}`
        );
      }

      // 5. ⚠️ NOUVEAU : Créer audit trail complet
      await this.createAuditLog({
        orderId,
        lineId,
        action: 'update_status',
        oldStatus,
        newStatus,
        oldEquivId: currentLine.orl_equiv_id,
        newEquivId: updateData.orl_equiv_id || currentLine.orl_equiv_id,
        comment,
        userId,
      });

      // 6. Mettre à jour statut global commande si nécessaire
      await this.checkAndUpdateOrderStatus(orderId);

      this.logger.log(`✅ Ligne ${lineId} mise à jour: ${oldStatus} → ${newStatus}`);

      return {
        success: true,
        line: updatedLine,
        message: `Statut changé: ${this.getStatusLabel(oldStatus)} → ${this.getStatusLabel(newStatus)}`,
      };

    } catch (error: any) {
      this.logger.error('❌ Erreur updateLineStatus:', error);
      throw error;
    }
  }

  /**
   * ⚠️ NOUVEAU : Créer audit trail complet
   */
  private async createAuditLog(data: {
    orderId: number;
    lineId: number;
    action: string;
    oldStatus: number;
    newStatus: number;
    oldEquivId: number;
    newEquivId: number;
    comment?: string;
    userId: number;
  }): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('___xtr_order_line_audit')
        .insert({
          orl_ord_id: data.orderId,
          orl_id: data.lineId,
          action: data.action,
          old_status: data.oldStatus,
          new_status: data.newStatus,
          old_equiv_id: data.oldEquivId,
          new_equiv_id: data.newEquivId,
          comment: data.comment || '',
          user_id: data.userId,
          created_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.warn('⚠️ Erreur création audit log:', error);
        // Ne pas bloquer l'opération principale
      }
    } catch (error) {
      this.logger.warn('⚠️ Erreur createAuditLog:', error);
    }
  }

  /**
   * ⚠️ NOUVEAU : Vérifier statut global commande
   */
  private async checkAndUpdateOrderStatus(orderId: number): Promise<void> {
    try {
      // Récupérer toutes les lignes de la commande
      const { data: lines, error } = await this.supabase
        .from('___xtr_order_line')
        .select('orl_orls_id, orl_equiv_id')
        .eq('orl_ord_id', orderId)
        .eq('orl_equiv_id', 0); // Seulement lignes principales

      if (error || !lines || lines.length === 0) {
        return;
      }

      // Si toutes les lignes ont le même statut
      const allStatuses = lines.map(l => l.orl_orls_id);
      const uniqueStatuses = [...new Set(allStatuses)];

      if (uniqueStatuses.length === 1) {
        const globalStatus = this.mapLineStatusToOrderStatus(uniqueStatuses[0]);

        const { error: updateError } = await this.supabase
          .from('___xtr_order')
          .update({
            ord_ords_id: globalStatus,
            ord_updated_at: new Date().toISOString(),
          })
          .eq('ord_id', orderId);

        if (updateError) {
          this.logger.warn('⚠️ Erreur MAJ statut commande:', updateError);
        } else {
          this.logger.log(`✅ Statut commande ${orderId} mis à jour → ${globalStatus}`);
        }
      }
    } catch (error) {
      this.logger.warn('⚠️ Erreur checkAndUpdateOrderStatus:', error);
    }
  }

  /**
   * Mapper statut ligne → statut commande
   */
  private mapLineStatusToOrderStatus(lineStatus: number): number {
    const mapping: Record<number, number> = {
      1: 1,  // En attente
      2: 2,  // Confirmée
      3: 3,  // En préparation
      4: 3,  // En préparation (prête)
      5: 4,  // Expédiée
      6: 5,  // Livrée
      91: 91, // Annulée client
      92: 91, // Annulée stock
      93: 93, // Retour
      94: 94, // Remboursée
    };
    return mapping[lineStatus] || lineStatus;
  }

  /**
   * Vérifier si transition autorisée
   */
  private canTransition(currentStatus: number, targetStatus: number): boolean {
    // Statut 1 est toujours accessible (reset)
    if (targetStatus === 1) {
      return true;
    }

    const allowedTransitions = this.statusTransitions.get(currentStatus);
    return allowedTransitions?.includes(targetStatus) || false;
  }

  private readonly statusTransitions = new Map<number, number[]>([
    [1, [2, 91, 92]], // En attente → Confirmée, Annulée
    [2, [3, 91, 92]], // Confirmée → En préparation, Annulée
    [3, [4, 91, 92]], // En préparation → Prête, Annulée
    [4, [5, 91]],     // Prête → Expédiée, Annulée client
    [5, [6, 93]],     // Expédiée → Livrée, Retour
    [6, [93]],        // Livrée → Retour
    [91, []],         // Annulée client → Terminal
    [92, []],         // Annulée stock → Terminal
    [93, [94]],       // Retour → Remboursée
    [94, []],         // Remboursée → Terminal
  ]);

  /**
   * Libellés statuts
   */
  private getStatusLabel(status: number): string {
    const labels: Record<number, string> = {
      1: 'En attente',
      2: 'Confirmée',
      3: 'En préparation',
      4: 'Prête',
      5: 'Expédiée',
      6: 'Livrée',
      91: 'Annulée client',
      92: 'Annulée stock',
      93: 'Retour',
      94: 'Remboursée',
    };
    return labels[status] || `Statut ${status}`;
  }
}
```

---

### 4.2 Améliorer Controller avec Guard Admin

```typescript
// backend/src/modules/orders/controllers/order-status.controller.ts

import {
  Controller,
  Patch,
  Param,
  Body,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrderStatusService } from '../services/order-status.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { AdminLevelGuard } from '../../../auth/guards/admin-level.guard';
import { RequireAdminLevel } from '../../../auth/decorators/require-admin-level.decorator';

/**
 * ⚠️ NOUVEAU : Guard admin niveau 7+ requis
 */
@Controller('api/admin/orders')
@UseGuards(JwtAuthGuard, AdminLevelGuard)
@RequireAdminLevel(7) // Équivalent PHP: CNFA_LEVEL > 6
export class OrderStatusController {
  constructor(private readonly orderStatusService: OrderStatusService) {}

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/status
   * Changer le statut d'une ligne de commande
   */
  @Patch(':orderId/lines/:lineId/status')
  async updateLineStatus(
    @Param('orderId') orderId: string,
    @Param('lineId') lineId: string,
    @Body() body: {
      status: number;
      comment?: string;
      resetEquivalence?: boolean;
    },
    @Request() req: any, // User JWT décodé
  ) {
    try {
      const orderIdNum = parseInt(orderId);
      const lineIdNum = parseInt(lineId);

      if (isNaN(orderIdNum) || isNaN(lineIdNum)) {
        throw new BadRequestException('IDs invalides');
      }

      if (!body.status || body.status < 1) {
        throw new BadRequestException('Statut requis et valide');
      }

      // ⚠️ NOUVEAU : Passer userId depuis JWT
      const result = await this.orderStatusService.updateLineStatus({
        lineId: lineIdNum,
        orderId: orderIdNum,
        newStatus: body.status,
        comment: body.comment,
        userId: req.user.id, // ⚠️ Audit trail
        resetEquivalence: body.resetEquivalence,
      });

      return {
        success: true,
        message: result.message,
        data: result.line,
        timestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * ⚠️ NOUVEAU : Reset rapide au statut 1 (équivalent commande.line.status.1.php)
   */
  @Patch(':orderId/lines/:lineId/reset')
  async resetLineToStatusOne(
    @Param('orderId') orderId: string,
    @Param('lineId') lineId: string,
    @Body() body: { comment?: string },
    @Request() req: any,
  ) {
    try {
      const orderIdNum = parseInt(orderId);
      const lineIdNum = parseInt(lineId);

      if (isNaN(orderIdNum) || isNaN(lineIdNum)) {
        throw new BadRequestException('IDs invalides');
      }

      // Reset au statut 1 avec reset équivalence
      const result = await this.orderStatusService.updateLineStatus({
        lineId: lineIdNum,
        orderId: orderIdNum,
        newStatus: 1, // ⚠️ Reset à "En attente"
        comment: body.comment || 'Réinitialisation ligne',
        userId: req.user.id,
        resetEquivalence: true, // ⚠️ Reset équivalence
      });

      return {
        success: true,
        message: 'Ligne réinitialisée au statut "En attente"',
        data: result.line,
        timestamp: new Date().toISOString(),
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
```

---

### 4.3 Créer Guard Admin Level

```typescript
// backend/src/auth/guards/admin-level.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_LEVEL_KEY } from '../decorators/require-admin-level.decorator';

@Injectable()
export class AdminLevelGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredLevel = this.reflector.getAllAndOverride<number>(
      ADMIN_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredLevel) {
      return true; // Pas de niveau requis
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.adminLevel) {
      throw new ForbiddenException('Accès admin requis');
    }

    if (user.adminLevel < requiredLevel) {
      throw new ForbiddenException(
        `Niveau admin ${requiredLevel}+ requis (vous: ${user.adminLevel})`,
      );
    }

    return true;
  }
}
```

```typescript
// backend/src/auth/decorators/require-admin-level.decorator.ts

import { SetMetadata } from '@nestjs/common';

export const ADMIN_LEVEL_KEY = 'adminLevel';
export const RequireAdminLevel = (level: number) =>
  SetMetadata(ADMIN_LEVEL_KEY, level);
```

---

### 4.4 Interface Frontend Remix

```typescript
// frontend/app/routes/admin.orders.$id.tsx

import { useState } from 'react';
import { useFetcher } from '@remix-run/react';

export default function OrderDetailWithActions() {
  const fetcher = useFetcher();
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [selectedLine, setSelectedLine] = useState<any>(null);

  const handleResetLine = async (orderId: number, lineId: number) => {
    setShowConfirmReset(true);
    setSelectedLine({ orderId, lineId });
  };

  const confirmReset = async () => {
    if (!selectedLine) return;

    fetcher.submit(
      {
        action: 'reset',
        comment: 'Réinitialisation manuelle par admin',
      },
      {
        method: 'PATCH',
        action: `/api/admin/orders/${selectedLine.orderId}/lines/${selectedLine.lineId}/reset`,
      },
    );

    setShowConfirmReset(false);
  };

  return (
    <div>
      {/* Liste lignes de commande */}
      {order.lines.map((line: any) => (
        <div key={line.orl_id} className="order-line">
          <div className="line-info">
            {line.orl_pg_name} {line.orl_pm_name}
          </div>
          <div className="line-actions">
            <button
              onClick={() => handleResetLine(order.ord_id, line.orl_id)}
              className="btn-reset"
            >
              🔄 Réinitialiser
            </button>
          </div>
        </div>
      ))}

      {/* Modal confirmation */}
      {showConfirmReset && (
        <div className="modal">
          <div className="modal-content">
            <h2>Confirmation</h2>
            <p>
              Êtes-vous sûr de vouloir réinitialiser cette ligne au statut "En
              attente" ?
            </p>
            <p className="warning">Cette opération est irréversible.</p>
            <div className="modal-actions">
              <button onClick={confirmReset} className="btn-confirm">
                ✅ Confirmer
              </button>
              <button
                onClick={() => setShowConfirmReset(false)}
                className="btn-cancel"
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affichage résultat */}
      {fetcher.data && (
        <div
          className={
            fetcher.data.success ? 'alert-success' : 'alert-error'
          }
        >
          {fetcher.data.message || fetcher.data.error}
        </div>
      )}
    </div>
  );
}
```

---

## 5. ✅ Améliorations vs PHP

| Fonctionnalité | PHP | NestJS Moderne |
|----------------|-----|----------------|
| **Reset équivalence** | ✅ `ORL_EQUIV_ID = 0` | ✅ Automatique si `resetEquivalence=true` |
| **Audit trail** | ❌ Aucun | ✅ Complet (qui, quand, avant/après) |
| **Validation transitions** | ❌ Aucune | ✅ Machine d'état stricte |
| **Sécurité niveau admin** | ✅ `CNFA_LEVEL > 6` | ✅ Guard `@RequireAdminLevel(7)` |
| **Noms colonnes** | ✅ Corrects | ✅ Vrais noms Supabase (orl_*) |
| **Vérification commande** | ❌ Aucune | ✅ `eq('orl_ord_id', orderId)` |
| **Statut global commande** | ❌ Manuel | ✅ Automatique |
| **Logging** | ❌ Aucun | ✅ Logger NestJS complet |
| **Type safety** | ❌ PHP dynamique | ✅ TypeScript strict |
| **Tests** | ❌ Impossible | ✅ Testable automatiquement |

---

## 6. 📋 Migration Table Audit

```sql
-- Créer table audit trail
CREATE TABLE IF NOT EXISTS ___xtr_order_line_audit (
  id SERIAL PRIMARY KEY,
  orl_ord_id INTEGER NOT NULL,
  orl_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_status INTEGER,
  new_status INTEGER,
  old_equiv_id INTEGER,
  new_equiv_id INTEGER,
  comment TEXT,
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (orl_ord_id) REFERENCES ___xtr_order(ord_id),
  FOREIGN KEY (orl_id) REFERENCES ___xtr_order_line(orl_id)
);

CREATE INDEX idx_audit_ord_id ON ___xtr_order_line_audit(orl_ord_id);
CREATE INDEX idx_audit_line_id ON ___xtr_order_line_audit(orl_id);
CREATE INDEX idx_audit_created ON ___xtr_order_line_audit(created_at DESC);
```

---

## 7. 🚀 Prochaines Étapes

### ✅ À Faire
1. Implémenter `AdminLevelGuard` + décorateur
2. Mettre à jour `OrderStatusService` avec reset équivalence
3. Créer table audit `___xtr_order_line_audit`
4. Ajouter endpoint `/reset` dans controller
5. Créer interface frontend avec confirmation
6. Tests unitaires + E2E

### 📋 Fichiers Suivants
- `commande.line.status.2.php` → Statut 2
- `commande.line.status.3.php` → Statut 3
- `commande.line.status.91.php` → Proposer équivalence
- `commande.line.status.92.php` → Accepter équivalence
- `commande.line.status.93.php` → Refuser équivalence

---

## 8. 🎯 Résumé

**Ce fichier PHP** : Simple reset statut 1 + equiv 0  
**Solution NestJS** : 
- ✅ Reset statut + équivalence
- ✅ Audit trail complet
- ✅ Machine d'état validée
- ✅ Sécurité admin niveau 7+
- ✅ Logging complet
- ✅ Type safety TypeScript
- ✅ Testable
- ✅ Scalable

**Gain** : 10x plus robuste, sécurisé, maintenable ! 🚀
