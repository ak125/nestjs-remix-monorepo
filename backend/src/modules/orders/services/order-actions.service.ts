import { randomUUID } from 'crypto';
import { TABLES } from '@repo/database-types';
import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { OrdersService } from './orders.service';
import {
  OrderLineSupplierService,
  type PropositionLigne,
} from './order-line-supplier.service';
import { PROCEDURE_RUPTURE } from './order-line-supplier-proposal';
import {
  ACTION_EQUIVALENT_RETENU,
  RuptureEquivalentsService,
  type EquivalentRetenu,
  type VueEquivalents,
} from './rupture-equivalents.service';
import {
  ORDER_EVENTS,
  type OrderStatusChangedEvent,
  type OrderShippedEvent,
  type OrderDeliveredEvent,
  type OrderCancelledEvent,
  type OrderLineStatusChangedEvent,
  type OrderLineSupplierConfirmedEvent,
} from '../events/order.events';
import type { OrderRecord, CustomerRecord } from '../types/order.types';

/**
 * 🚀 Service Actions Commandes - Version Moderne
 *
 * Gère TOUTES les actions sur lignes de commande :
 * - Changements statuts (1-6)
 * - Workflow équivalences (91-94)
 * - Commande fournisseur
 */
/** Statut de ligne « Pièce non disponible » (`___xtr_order_line_status`). */
export const STATUT_RUPTURE = '4';
/** Statuts lus en texte ; NULL et '' = pas encore traité. */
const statutTexte = (s: string | null): string => (s ?? '').trim();
/** Non traitée, en attente (1), disponible (5) : fournisseur confirmable. */
const STATUTS_CONFIRMABLES = new Set(['', '0', '1', '5']);
/** + commandée chez le fournisseur (6) : la rupture peut être annoncée après. */
const STATUTS_RUPTURE_POSSIBLE = new Set(['', '0', '1', '5', '6']);

@Injectable()
export class OrderActionsService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderActionsService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly ordersService: OrdersService,
    private readonly lineSupplier: OrderLineSupplierService,
    private readonly ruptureEquivalents: RuptureEquivalentsService,
  ) {
    super();
  }

  /**
   * Décision 50 — confirmation en un geste du fournisseur proposé.
   *
   * La proposition est RECALCULÉE au moment du clic : si elle a changé depuis
   * l'affichage (tarif, dispo, annuaire), la confirmation est refusée (409) avec
   * la nouvelle proposition, jamais appliquée sur une valeur périmée.
   * N'écrit que les colonnes fournisseur de la ligne (`orl_spl_*`) ; aucun
   * statut de ligne, aucun prix de vente, aucun tarif. TTC calculé sur le taux
   * de l'offre retenue (`pri_tva_n`), laissé vide s'il est inconnu.
   * Mise à jour conditionnelle sur l'état lu (fournisseur non posé, statut
   * inchangé) : deux confirmations concurrentes n'écrivent qu'une fois.
   */
  async confirmLineSupplier(
    orderId: string,
    lineId: string,
    attendu: { splId: string; prixAchatUnitHt: number },
    confirmedBy?: string,
  ): Promise<{
    success: true;
    orderId: string;
    lineId: string;
    splId: string;
    supplierName: string;
    unitPurchaseHt: number;
    quantity: number;
    purchaseHt: number;
  }> {
    const lue = await this.lineSupplier.getProposal(orderId, lineId);
    const p = lue.proposition;
    if (lue.fournisseurConfirme) {
      throw new ConflictException({
        message: 'Fournisseur déjà posé sur cette ligne',
        current: lue,
      });
    }
    if (!STATUTS_CONFIRMABLES.has(statutTexte(lue.statutLigne))) {
      throw new ConflictException({
        message: `Ligne au statut ${lue.statutLigne} : confirmation fournisseur fermée`,
        current: lue,
      });
    }
    if (
      p.statut !== 'PROPOSE' ||
      p.splId !== attendu.splId ||
      p.prixAchatUnitHt !== attendu.prixAchatUnitHt
    ) {
      throw new ConflictException({
        message: 'La proposition a changé depuis son affichage',
        current: lue,
      });
    }

    const ttc = (ht: number) =>
      p.tauxTva == null
        ? null
        : (Math.round(ht * (1 + p.tauxTva) * 100) / 100).toString();
    let maj = this.supabase
      .from(TABLES.xtr_order_line)
      .update({
        orl_spl_id: p.splId,
        orl_spl_name: p.nomFournisseur,
        orl_spl_date: new Date().toISOString(),
        orl_spl_price_buy_unit_ht: p.prixAchatUnitHt.toString(),
        orl_spl_price_buy_ht: p.prixAchatHt.toString(),
        orl_spl_price_buy_unit_ttc: ttc(p.prixAchatUnitHt),
        orl_spl_price_buy_ttc: ttc(p.prixAchatHt),
      })
      .eq('orl_id', lue.lineId)
      .eq('orl_ord_id', lue.orderId)
      .or('orl_spl_id.is.null,orl_spl_id.in.("","0")');
    maj =
      lue.statutLigne == null
        ? maj.is('orl_orls_id', null)
        : maj.eq('orl_orls_id', lue.statutLigne);
    const { data, error } = await maj.select('orl_id');
    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data || data.length !== 1) {
      throw new ConflictException(
        'Ligne modifiée pendant la confirmation : recharger la proposition',
      );
    }

    this.eventEmitter.emit(ORDER_EVENTS.LINE_SUPPLIER_CONFIRMED, {
      orderId: lue.orderId,
      lineId: lue.lineId,
      pieceId: lue.pieceId,
      splId: p.splId,
      supplierName: p.nomFournisseur,
      unitPurchaseHt: p.prixAchatUnitHt,
      quantity: p.quantite,
      purchaseHt: p.prixAchatHt,
      confirmedBy,
      timestamp: new Date().toISOString(),
    } satisfies OrderLineSupplierConfirmedEvent);
    this.logger.log(
      `Ligne ${lue.lineId} : fournisseur ${p.splId} confirmé (décision 50)`,
    );
    return {
      success: true,
      orderId: lue.orderId,
      lineId: lue.lineId,
      splId: p.splId,
      supplierName: p.nomFournisseur,
      unitPurchaseHt: p.prixAchatUnitHt,
      quantity: p.quantite,
      purchaseHt: p.prixAchatHt,
    };
  }

  /**
   * Décision 50 — marquage de rupture : statut de ligne 4 « Pièce non
   * disponible ». Déclaration de l'administrateur (la rupture annoncée par le
   * fournisseur n'est pas en base), possible que la proposition soit RUPTURE ou
   * non. N'écrit que `orl_orls_id`, conditionnellement au statut lu. La suite
   * (équivalent, supplément, annulation, mail client) suit la procédure
   * `order-rupture-equivalence` ; rien n'est envoyé ni annulé ici.
   */
  async markLineRupture(
    orderId: string,
    lineId: string,
    changedBy?: string,
    comment?: string,
  ): Promise<{
    success: true;
    lineId: string;
    newStatus: string;
    procedure: string;
    proposition: PropositionLigne['proposition'];
  }> {
    const lue = await this.lineSupplier.getProposal(orderId, lineId);
    if (!STATUTS_RUPTURE_POSSIBLE.has(statutTexte(lue.statutLigne))) {
      throw new ConflictException({
        message: `Ligne au statut ${lue.statutLigne} : marquage de rupture fermé`,
        current: lue,
      });
    }
    let maj = this.supabase
      .from(TABLES.xtr_order_line)
      .update({ orl_orls_id: STATUT_RUPTURE })
      .eq('orl_id', lue.lineId)
      .eq('orl_ord_id', lue.orderId);
    maj =
      lue.statutLigne == null
        ? maj.is('orl_orls_id', null)
        : maj.eq('orl_orls_id', lue.statutLigne);
    const { data, error } = await maj.select('orl_id');
    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data || data.length !== 1) {
      throw new ConflictException(
        'Ligne modifiée pendant le marquage : recharger la ligne',
      );
    }

    this.eventEmitter.emit(ORDER_EVENTS.LINE_STATUS_CHANGED, {
      orderId: lue.orderId,
      lineId: lue.lineId,
      previousStatus: lue.statutLigne,
      newStatus: Number(STATUT_RUPTURE),
      changedBy,
      comment:
        comment ?? `rupture (décision 50) — procédure ${PROCEDURE_RUPTURE}`,
      timestamp: new Date().toISOString(),
    } satisfies OrderLineStatusChangedEvent);
    return {
      success: true,
      lineId: lue.lineId,
      newStatus: STATUT_RUPTURE,
      procedure: PROCEDURE_RUPTURE,
      proposition: lue.proposition,
    };
  }

  /**
   * Mandat CL — équivalent retenu en un clic sur une ligne en rupture.
   *
   * Les équivalents sont RECALCULÉS au clic : l'équivalent demandé doit être
   * encore proposé, RETENABLE (sans perte au prix payé), au même fournisseur et
   * au même prix d'achat, sinon 409 avec la vue à jour. La ligne garde le prix
   * payé ; seules ses colonnes fournisseur (`orl_spl_*`) sont écrites (décision
   * 50), conditionnellement au statut 4 et à un fournisseur non posé. La pièce
   * retenue est enregistrée par une trace `__admin_audit_log` : la ligne n'a pas
   * de colonne pour elle (`orl_equiv_id` désigne une ligne, flux 91–94 hors
   * service). Si la trace échoue, l'écriture de la ligne est annulée.
   * Aucun statut de ligne, aucun prix de vente, aucun mail, aucune commande
   * fournisseur : l'accord du client reste à obtenir (texte à copier).
   */
  async retainRuptureEquivalent(
    orderId: string,
    lineId: string,
    attendu: { pieceId: number; splId: string; prixAchatUnitHt: number },
    retainedBy?: string,
  ): Promise<{ success: true; retenu: EquivalentRetenu }> {
    const vue = await this.ruptureEquivalents.getEquivalents(orderId, lineId);
    const refus = (message: string): never => {
      throw new ConflictException({ message, current: vue });
    };
    if (statutTexte(vue.statutLigne) !== STATUT_RUPTURE) {
      refus(
        `Ligne au statut ${vue.statutLigne} : seule une rupture (4) reçoit un équivalent`,
      );
    }
    if (vue.fournisseurPose || vue.retenu) {
      refus('Fournisseur ou équivalent déjà posé sur cette ligne');
    }
    const e = vue.resultat?.equivalents.find(
      (x) => x.pieceId === attendu.pieceId,
    );
    if (
      !e ||
      e.statut !== 'RETENABLE' ||
      e.achat.splId !== attendu.splId ||
      e.achat.prixAchatUnitHt !== attendu.prixAchatUnitHt
    ) {
      return refus("L'équivalent a changé depuis son affichage");
    }

    const a = e.achat;
    const ttc = (ht: number) =>
      a.tauxTva == null
        ? null
        : (Math.round(ht * (1 + a.tauxTva) * 100) / 100).toString();
    const ecritLe = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order_line)
      .update({
        orl_spl_id: a.splId,
        orl_spl_name: a.fournisseur,
        orl_spl_date: ecritLe,
        orl_spl_price_buy_unit_ht: a.prixAchatUnitHt.toString(),
        orl_spl_price_buy_ht: a.prixAchatHt.toString(),
        orl_spl_price_buy_unit_ttc: ttc(a.prixAchatUnitHt),
        orl_spl_price_buy_ttc: ttc(a.prixAchatHt),
      })
      .eq('orl_id', vue.lineId)
      .eq('orl_ord_id', vue.orderId)
      .eq('orl_orls_id', STATUT_RUPTURE)
      .or('orl_spl_id.is.null,orl_spl_id.in.("","0")')
      .select('orl_id');
    if (error) {
      throw new BadRequestException(error.message);
    }
    if (!data || data.length !== 1) {
      throw new ConflictException(
        'Ligne modifiée pendant le choix : recharger les équivalents',
      );
    }

    const valeur: Omit<EquivalentRetenu, 'traceId' | 'le' | 'par'> = {
      pieceId: e.pieceId,
      marque: e.marque,
      ref: e.ref,
      splId: a.splId,
      fournisseur: a.fournisseur,
      prixAchatUnitHt: a.prixAchatUnitHt,
      prixAchatHt: a.prixAchatHt,
      quantite: a.quantite,
      dateTarif: a.origine.dateTarif,
    };
    const trace = await this.supabase
      .from('__admin_audit_log')
      .insert({
        aal_action: ACTION_EQUIVALENT_RETENU,
        aal_entity_type: 'order_line',
        aal_entity_id: vue.lineId,
        aal_user_id: retainedBy ?? null,
        aal_old_value: {
          pieceId: vue.pieceId,
          marque: vue.commandee.marque,
          ref: vue.commandee.ref,
        },
        aal_new_value: valeur,
        aal_metadata: {
          orderId: vue.orderId,
          preuve: e.preuve,
          margeAuPrixPaye: e.margeAuPrixPaye,
          origine: a.origine,
          toleranceMm: vue.toleranceMm,
        },
      })
      .select('aal_id, aal_created_at')
      .single();
    if (trace.error || !trace.data) {
      // Sans trace, la pièce retenue serait perdue : on défait l'écriture.
      const retour = await this.supabase
        .from(TABLES.xtr_order_line)
        .update({
          orl_spl_id: null,
          orl_spl_name: null,
          orl_spl_date: null,
          orl_spl_price_buy_unit_ht: null,
          orl_spl_price_buy_ht: null,
          orl_spl_price_buy_unit_ttc: null,
          orl_spl_price_buy_ttc: null,
        })
        .eq('orl_id', vue.lineId)
        .eq('orl_ord_id', vue.orderId)
        .eq('orl_spl_id', a.splId)
        .eq('orl_spl_date', ecritLe)
        .select('orl_id');
      this.logger.error(
        `Ligne ${vue.lineId} : trace d'équivalent impossible (${trace.error?.message ?? 'vide'}), écriture annulée : ${retour.error ? `ÉCHEC ${retour.error.message}` : `${retour.data?.length ?? 0} ligne(s)`}`,
      );
      throw new InternalServerErrorException(
        "Trace de l'équivalent impossible : rien n'est retenu",
      );
    }
    const t = trace.data as { aal_id: string | number; aal_created_at: string };
    this.logger.log(
      `Ligne ${vue.lineId} : équivalent ${e.pieceId} retenu chez ${a.splId} (mandat CL)`,
    );
    return {
      success: true,
      retenu: {
        traceId: String(t.aal_id),
        le: t.aal_created_at,
        par: retainedBy ?? null,
        ...valeur,
      },
    };
  }

  /** Mandat CL — lecture des équivalents d'une ligne en rupture. */
  getRuptureEquivalents(
    orderId: string,
    lineId: string,
  ): Promise<VueEquivalents> {
    return this.ruptureEquivalents.getEquivalents(orderId, lineId);
  }

  /**
   * ⚡ Action universelle : Changer statut ligne
   */
  async updateLineStatus(
    orderId: number,
    lineId: number,
    newStatus: number,
    options?: {
      comment?: string;
      userId?: number;
      resetEquiv?: boolean;
      supplierData?: {
        splId: number;
        splName: string;
        priceHT: number;
        qty: number;
      };
    },
  ): Promise<{ success: boolean; lineId: number; newStatus: number }> {
    const { comment, userId, resetEquiv, supplierData } = options || {};

    try {
      this.logger.log(`🔄 Ligne ${lineId} → Statut ${newStatus}`);

      // Récupérer ligne actuelle
      const { data: line, error } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('*')
        .eq('orl_id', lineId)
        .eq('orl_ord_id', orderId)
        .single();

      if (error || !line) {
        throw new BadRequestException('Ligne introuvable');
      }

      // Préparer mise à jour
      const updateData: Record<string, unknown> = {
        orl_orls_id: newStatus,
        orl_updated_at: new Date().toISOString(),
      };

      // Reset équivalence si demandé (statut 1)
      if (resetEquiv || newStatus === 1) {
        updateData.orl_equiv_id = 0;
      }

      // Statut 6 : Commander fournisseur
      if (newStatus === 6 && supplierData) {
        const { splId, splName, priceHT, qty } = supplierData;
        const TVA = 1.2; // TODO: récupérer taux réel

        // 1. Passer en statut 5 d'abord
        await this.supabase
          .from(TABLES.xtr_order_line)
          .update({ orl_orls_id: 5 })
          .eq('orl_id', lineId);

        // 2. Enregistrer fournisseur
        updateData.orl_spl_id = splId;
        updateData.orl_spl_name = splName;
        updateData.orl_spl_date = new Date().toISOString();
        updateData.orl_spl_price_buy_unit_ht = priceHT;
        updateData.orl_spl_price_buy_unit_ttc = priceHT * TVA;
        updateData.orl_spl_price_buy_ht = priceHT * qty;
        updateData.orl_spl_price_buy_ttc = priceHT * qty * TVA;
      }

      // Mettre à jour
      const { error: updateError } = await this.supabase
        .from(TABLES.xtr_order_line)
        .update(updateData)
        .eq('orl_id', lineId);

      if (updateError) {
        throw new BadRequestException(updateError.message);
      }

      // Audit trail
      await this.createAudit(orderId, lineId, 'update_status', {
        oldStatus: line.orl_orls_id,
        newStatus,
        comment,
        userId,
      });

      this.eventEmitter.emit(ORDER_EVENTS.LINE_STATUS_CHANGED, {
        orderId,
        lineId,
        previousStatus: line.orl_orls_id,
        newStatus,
        changedBy: userId,
        comment,
        timestamp: new Date().toISOString(),
      } satisfies OrderLineStatusChangedEvent);

      this.logger.log(`✅ Ligne ${lineId} mise à jour`);
      return { success: true, lineId, newStatus };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur updateLineStatus:`, message);
      throw error;
    }
  }

  /**
   * ✅ Accepter équivalence (statut 92)
   */
  async acceptEquivalent(
    orderId: number,
    equivalentLineId: number,
  ): Promise<{ success: boolean }> {
    try {
      // Passer ligne équivalente en statut 92
      await this.supabase
        .from(TABLES.xtr_order_line)
        .update({ orl_orls_id: 92 })
        .eq('orl_id', equivalentLineId)
        .eq('orl_ord_id', orderId);

      this.logger.log(`✅ Équivalence ${equivalentLineId} acceptée`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur acceptEquivalent:`, message);
      throw error;
    }
  }

  /**
   * ❌ Refuser équivalence (statut 93)
   */
  async rejectEquivalent(
    orderId: number,
    equivalentLineId: number,
  ): Promise<{ success: boolean }> {
    try {
      // Récupérer ligne équivalente pour trouver l'originale
      const { data: equivLine } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('orl_id')
        .eq('orl_ord_id', orderId)
        .eq('orl_equiv_id', equivalentLineId)
        .single();

      if (!equivLine) {
        throw new BadRequestException('Ligne originale introuvable');
      }

      // 1. Marquer équiv comme refusée (statut 93 + equiv_id vers originale)
      await this.supabase
        .from(TABLES.xtr_order_line)
        .update({
          orl_orls_id: 93,
          orl_equiv_id: equivLine.orl_id,
        })
        .eq('orl_id', equivalentLineId);

      // 2. Reset equiv_id de la ligne originale
      await this.supabase
        .from(TABLES.xtr_order_line)
        .update({ orl_equiv_id: 0 })
        .eq('orl_id', equivLine.orl_id);

      this.logger.log(`✅ Équivalence ${equivalentLineId} refusée`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur rejectEquivalent:`, message);
      throw error;
    }
  }

  /**
   * 📊 Audit trail
   */
  private async createAudit(
    orderId: number,
    lineId: number,
    action: string,
    data: {
      oldStatus?: number;
      newStatus?: number;
      comment?: string;
      userId?: number;
    },
  ): Promise<void> {
    try {
      await this.supabase.from('___xtr_order_line_audit').insert({
        orl_ord_id: orderId,
        orl_id: lineId,
        action,
        old_status: data.oldStatus,
        new_status: data.newStatus,
        comment: data.comment || '',
        user_id: data.userId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn('⚠️ Erreur audit:', error);
    }
  }

  // ============================================================
  // ACTIONS GLOBALES SUR COMMANDES (Nouveau)
  // ============================================================

  /**
   * 📦 Récupérer une commande complète
   */
  async getOrder(orderId: string): Promise<OrderRecord> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select('*')
      .eq('ord_id', orderId)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Commande ${orderId} introuvable`);
    }

    return data as OrderRecord;
  }

  /**
   * 👤 Récupérer client d'une commande
   */
  async getCustomer(customerId: string): Promise<CustomerRecord> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('*')
      .eq('cst_id', customerId)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Client ${customerId} introuvable`);
    }

    return data as CustomerRecord;
  }

  /**
   * ✅ Valider commande (statut 2 → 3)
   */
  async validateOrder(
    orderId: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string }> {
    try {
      this.logger.log(`✅ Validation commande ${orderId}`);

      const order = await this.getOrder(orderId);

      // Vérifier que commande est payée
      if (order.ord_is_pay !== '1') {
        throw new BadRequestException(
          'Commande non payée, validation impossible',
        );
      }

      // Vérifier statut actuel = 2 (Confirmée)
      if (order.ord_ords_id !== '2') {
        throw new BadRequestException(
          `Statut invalide: ${order.ord_ords_id}, attendu: 2 (Confirmée)`,
        );
      }

      // Mettre à jour statut → 3 (En cours)
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '3', // En cours
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      // Historique
      await this.createOrderStatusHistory(
        orderId,
        '3',
        'Commande validée par admin',
        userId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.VALIDATED, {
        orderId,
        previousStatus: '2',
        newStatus: '3',
        changedBy: userId ? String(userId) : undefined,
        comment: 'Commande validée par admin',
        timestamp: new Date().toISOString(),
      } satisfies OrderStatusChangedEvent);

      this.logger.log(`✅ Commande ${orderId} validée (statut 3)`);
      return { success: true, newStatus: '3' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur validation commande:`, message);
      throw error;
    }
  }

  /**
   * 📦 Expédier commande (statut 3 → 4)
   */
  async shipOrder(
    orderId: string,
    trackingNumber: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string; trackingNumber: string }> {
    try {
      this.logger.log(
        `📦 Expédition commande ${orderId} - Suivi: ${trackingNumber}`,
      );

      const order = await this.getOrder(orderId);

      // Vérifier statut actuel = 3 (En cours)
      if (order.ord_ords_id !== '3') {
        throw new BadRequestException(
          `Statut invalide: ${order.ord_ords_id}, attendu: 3 (En cours)`,
        );
      }

      // Generer URL tracking automatique
      const trackingUrl = this.buildTrackingUrl(trackingNumber);

      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '4',
          ord_date_ship: new Date().toISOString(),
          ord_tracking: trackingNumber,
          ord_tracking_url: trackingUrl,
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      await this.createOrderStatusHistory(
        orderId,
        '4',
        `Commande expédiée - Suivi: ${trackingNumber}`,
        userId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.SHIPPED, {
        orderId,
        customerId: order.ord_cst_id,
        trackingNumber,
        changedBy: userId ? String(userId) : undefined,
        timestamp: new Date().toISOString(),
      } satisfies OrderShippedEvent);

      this.logger.log(`✅ Commande ${orderId} expédiée`);
      return { success: true, newStatus: '4', trackingNumber };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur expédition commande:`, message);
      throw error;
    }
  }

  /**
   * 🚚 Marquer comme livrée (statut 4 → 5)
   */
  async markAsDelivered(
    orderId: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string }> {
    try {
      this.logger.log(`🚚 Livraison commande ${orderId}`);

      const order = await this.getOrder(orderId);

      // Vérifier statut actuel = 4 (Expédiée)
      if (order.ord_ords_id !== '4') {
        throw new BadRequestException(
          `Statut invalide: ${order.ord_ords_id}, attendu: 4 (Expédiée)`,
        );
      }

      // Mettre à jour
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '5', // Livrée
          ord_date_deliv: new Date().toISOString(),
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      // Historique
      await this.createOrderStatusHistory(
        orderId,
        '5',
        'Commande livrée',
        userId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.DELIVERED, {
        orderId,
        customerId: order.ord_cst_id,
        changedBy: userId ? String(userId) : undefined,
        timestamp: new Date().toISOString(),
      } satisfies OrderDeliveredEvent);

      this.logger.log(`✅ Commande ${orderId} livrée`);
      return { success: true, newStatus: '5' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur livraison commande:`, message);
      throw error;
    }
  }

  /**
   * 💰 Confirmer paiement manuellement (admin)
   */
  async confirmPaymentManual(orderId: string): Promise<{ success: boolean }> {
    try {
      this.logger.log(`💰 Confirmation paiement manuel: ${orderId}`);

      const order = await this.getOrder(orderId);

      if (order.ord_is_pay === '1') {
        throw new BadRequestException('Commande deja payee');
      }

      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_is_pay: '1',
          ord_date_pay: new Date().toISOString(),
          ord_ords_id: '5', // Payee — En preparation
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      this.logger.log(`✅ Paiement confirme manuellement: ${orderId}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur confirmation paiement:`, message);
      throw error;
    }
  }

  /**
   * ❌ Annuler commande (→ statut 2)
   *
   * Délègue à OrdersService.cancelOrder, seul propriétaire de
   * cancel_order_atomic (authority-graph.yaml, order_lifecycle.cancellation) :
   * la RPC décide sur la ligne verrouillée (refus d'une commande payée, seules
   * les transitions 1|3|4 → 2) et journalise ORDER_CANCELLED dans
   * ___xtr_order_history. L'événement émis ensuite porte la même corrélation ;
   * ses écouteurs envoient l'unique mail d'annulation et l'audit admin.
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string; reason: string }> {
    try {
      this.logger.log(`❌ Annulation commande ${orderId} - Raison: ${reason}`);

      const order = await this.getOrder(orderId);
      const correlationId = randomUUID();

      await this.ordersService.cancelOrder(
        orderId,
        reason,
        userId,
        correlationId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.CANCELLED, {
        orderId,
        customerId: order.ord_cst_id,
        reason,
        changedBy: userId ? String(userId) : undefined,
        correlationId,
        timestamp: new Date().toISOString(),
      } satisfies OrderCancelledEvent);

      this.logger.log(`✅ Commande ${orderId} annulée`);
      return { success: true, newStatus: '2', reason };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur annulation commande:`, message);
      throw error;
    }
  }

  private buildTrackingUrl(trackingNumber: string): string {
    const num = trackingNumber.trim();
    if (/^\d{11,15}$/.test(num))
      return `https://www.laposte.fr/outils/suivre-vos-envois?code=${num}`;
    if (num.startsWith('1Z'))
      return `https://www.ups.com/track?tracknum=${num}`;
    if (/^\d{14}$/.test(num)) return `https://trace.dpd.fr/fr/trace/${num}`;
    return `https://www.laposte.fr/outils/suivre-vos-envois?code=${num}`;
  }

  /**
   * 📝 Créer entrée historique statuts
   */
  private async createOrderStatusHistory(
    orderId: string,
    newStatus: string,
    comment: string,
    userId?: number,
  ): Promise<void> {
    try {
      await this.supabase.from('___xtr_order_status_history').insert({
        osh_ord_id: orderId,
        osh_ords_id: newStatus,
        osh_date: new Date().toISOString(),
        osh_admin_id: userId ? `adm_${userId}` : null,
        osh_comment: comment,
      });
    } catch (error) {
      this.logger.warn('⚠️ Erreur historique statuts:', error);
    }
  }
}
