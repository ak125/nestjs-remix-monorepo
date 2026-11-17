import { TABLES } from '@repo/database-types';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  NOMBRE_COMMANDES_ESSAI,
  PLAFOND_COMMANDE_FOURNISSEUR_HT,
  SEUIL_ECART_ACHAT_LIVE,
  isSupplierOrderSendEnabled,
} from '../config/supplier-order-preparation.config';
import {
  SupplierLiveQuoteService,
  type ResultatLecture,
} from '../../supplier-truth';
import { OrderLineSupplierService } from './order-line-supplier.service';
import {
  evaluerControles,
  type DecisionPreparation,
  type ResultatControle,
} from './supplier-order-controls';

/**
 * Commande fournisseur PRÉPARÉE, jamais envoyée (mandat BK, mode essai).
 *
 * Au clic de Marwane : relecture live du portail du fournisseur proposé, les
 * 8 contrôles, puis une trace dans `__admin_audit_log` (journal d'audit
 * existant), sur l'entité `order_line`. Ce service n'appelle aucune méthode de
 * mise au panier ni de commande : il n'en existe pas. Il ne modifie ni la ligne
 * ni la commande ; le statut de ligne reste l'affaire d'`OrderActionsService`.
 */

export const ACTION_PREPAREE = 'supplier_order_prepared';
export const ACTION_REFUSEE = 'supplier_order_preparation_refused';
const ENTITE = 'order_line';
const PG_UNIQUE_VIOLATION = '23505';

export interface DemandePreparation {
  compatibiliteVerifiee: boolean;
  confirmationPlafond?: boolean;
}

export interface CommandeFournisseurPreparee {
  mode: 'ESSAI';
  numeroEssai: number;
  envoyee: false;
  fournisseur: { splId: string; nom: string };
  refFournisseur: string;
  marque: string | null;
  quantite: number;
  prixPublicHt: number | null;
  remisePct: number | null;
  remise2Pct: number | null;
  prixNetUnitHt: number | null;
  montantNetHt: number | null;
  prixAchatBaseUnitHt: number;
  disponibilite: string;
  lueA: string;
  /** Fournisseur et prix posés à la main sur la ligne au moment du clic. */
  commandeManuelle: { splId: string; prixAchatUnitHt: string | null } | null;
}

export interface ResultatPreparation {
  orderId: string;
  lineId: string;
  decision: DecisionPreparation;
  controles: ResultatControle[];
  lecture: ResultatLecture | null;
  preparation: CommandeFournisseurPreparee | null;
  envoi: { flagActif: boolean; effectue: false; motif: string };
  traceId: string | null;
}

interface CommandeLue {
  ord_id: string;
  ord_is_pay: string | null;
  ord_ords_id: string | null;
}
interface LigneLue {
  orl_id: string;
  orl_ord_id: string;
  orl_art_ref: string | null;
  orl_pm_name: string | null;
  orl_art_quantity: string | null;
  orl_art_price_sell_unit_ttc: string | null;
  orl_orls_id: string | null;
  orl_spl_id: string | null;
  orl_spl_price_buy_unit_ht: string | null;
}
interface TraceLue {
  aal_id: string;
  aal_new_value: CommandeFournisseurPreparee | null;
  aal_metadata: Record<string, unknown> | null;
  aal_created_at: string;
}

const MOTIF_SANS_ENVOI =
  "mode essai : aucun code d'envoi n'existe, l'envoi réel relève d'un mandat distinct";

@Injectable()
export class SupplierOrderPreparationService extends SupabaseBaseService {
  protected readonly logger = new Logger(SupplierOrderPreparationService.name);
  /** Verrou en mémoire par ligne : un double clic concurrent attend le premier. */
  private readonly enCours = new Map<string, Promise<ResultatPreparation>>();

  constructor(
    private readonly lineSupplier: OrderLineSupplierService,
    private readonly liveQuote: SupplierLiveQuoteService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  prepare(
    orderId: string,
    lineId: string,
    demande: DemandePreparation,
    userId: string | null,
  ): Promise<ResultatPreparation> {
    const cle = `${orderId}:${lineId}`;
    const courant = this.enCours.get(cle);
    if (courant) return courant;
    const p = this.preparer(orderId, lineId, demande, userId).finally(() =>
      this.enCours.delete(cle),
    );
    this.enCours.set(cle, p);
    return p;
  }

  /** Préparation enregistrée et dernière tentative refusée, pour l'écran. */
  async getPrepared(orderId: string, lineId: string) {
    const ligne = await this.lireLigne(orderId, lineId);
    const [preparee, refus] = await Promise.all([
      this.derniereTrace(lineId, ACTION_PREPAREE),
      this.derniereTrace(lineId, ACTION_REFUSEE),
    ]);
    const p = preparee?.aal_new_value ?? null;
    const manuelle = ligne.orl_spl_id?.trim();
    const prixManuel =
      ligne.orl_spl_price_buy_unit_ht != null
        ? Number(ligne.orl_spl_price_buy_unit_ht)
        : null;
    return {
      orderId,
      lineId,
      preparee: preparee
        ? { traceId: preparee.aal_id, le: preparee.aal_created_at, ...p }
        : null,
      derniereTentativeRefusee:
        refus && (!preparee || refus.aal_created_at > preparee.aal_created_at)
          ? {
              traceId: refus.aal_id,
              le: refus.aal_created_at,
              ...(refus.aal_metadata ?? {}),
            }
          : null,
      // Contrôle 8 : comparaison avec la commande passée à la main.
      comparaisonManuelle:
        p && manuelle && manuelle !== '0'
          ? {
              splIdManuel: manuelle,
              memeFournisseur: manuelle === p.fournisseur.splId,
              prixManuelUnitHt: prixManuel,
              ecartUnitHt:
                prixManuel != null && p.prixNetUnitHt != null
                  ? Math.round((p.prixNetUnitHt - prixManuel) * 100) / 100
                  : null,
            }
          : null,
      envoi: this.envoi(),
    };
  }

  private envoi(): ResultatPreparation['envoi'] {
    return {
      flagActif: isSupplierOrderSendEnabled(this.config),
      effectue: false,
      motif: MOTIF_SANS_ENVOI,
    };
  }

  private async preparer(
    orderId: string,
    lineId: string,
    demande: DemandePreparation,
    userId: string | null,
  ): Promise<ResultatPreparation> {
    const [commande, ligne] = await Promise.all([
      this.lireCommande(orderId),
      this.lireLigne(orderId, lineId),
    ]);
    const existante = await this.derniereTrace(lineId, ACTION_PREPAREE);
    const proposition = (await this.lineSupplier.getProposal(orderId, lineId))
      .proposition;
    const marque = (ligne.orl_pm_name ?? '').trim();
    const ref = (ligne.orl_art_ref ?? '').trim();

    // Déjà préparée : aucune relecture, aucun appel au portail.
    const lecture =
      !existante && proposition.statut === 'PROPOSE' && ref
        ? await this.liveQuote.lire(proposition.splId, ref, marque)
        : null;

    const sortie = evaluerControles({
      commande: {
        estPayee: commande.ord_is_pay === '1',
        statut: commande.ord_ords_id,
      },
      ligne: {
        quantite: ligne.orl_art_quantity,
        venteUnitTtc: ligne.orl_art_price_sell_unit_ttc,
        statut: ligne.orl_orls_id,
      },
      proposition,
      lecture,
      demande: {
        compatibiliteVerifiee: demande.compatibiliteVerifiee === true,
        confirmationPlafond: demande.confirmationPlafond === true,
      },
      dejaPreparee: existante != null,
      essaisDejaPrepares: await this.compterPreparations(),
      seuils: {
        ecartAchatLive: SEUIL_ECART_ACHAT_LIVE,
        plafondHt: PLAFOND_COMMANDE_FOURNISSEUR_HT,
        nombreEssais: NOMBRE_COMMANDES_ESSAI,
      },
    });

    const base = {
      orderId,
      lineId,
      controles: sortie.controles,
      lecture,
      envoi: this.envoi(),
    };

    if (sortie.decision === 'DEJA_PREPAREE') {
      return {
        ...base,
        decision: 'DEJA_PREPAREE',
        preparation: existante?.aal_new_value ?? null,
        traceId: existante?.aal_id ?? null,
      };
    }

    const live = lecture?.ok ? lecture : null;
    const preparation: CommandeFournisseurPreparee | null =
      sortie.decision === 'PREPAREE' && proposition.statut === 'PROPOSE'
        ? {
            mode: 'ESSAI',
            numeroEssai: sortie.numeroEssai,
            envoyee: false,
            fournisseur: {
              splId: proposition.splId,
              nom: proposition.nomFournisseur,
            },
            refFournisseur: live?.refFournisseur ?? ref,
            marque: marque || null,
            quantite: proposition.quantite,
            prixPublicHt: live?.prixPublicHt ?? null,
            remisePct: live?.remisePct ?? null,
            remise2Pct: live?.remise2Pct ?? null,
            prixNetUnitHt: live?.prixNetHt ?? null,
            montantNetHt: sortie.montantNetHt,
            prixAchatBaseUnitHt: proposition.prixAchatUnitHt,
            disponibilite: live?.detailDispo ?? 'inconnue',
            lueA: live?.lueA ?? new Date().toISOString(),
            commandeManuelle:
              ligne.orl_spl_id?.trim() && ligne.orl_spl_id.trim() !== '0'
                ? {
                    splId: ligne.orl_spl_id.trim(),
                    prixAchatUnitHt: ligne.orl_spl_price_buy_unit_ht,
                  }
                : null,
          }
        : null;

    // Contrôle 7 : la trace est écrite AVANT la réponse ; un échec lève.
    const { data, error } = await this.supabase
      .from('__admin_audit_log')
      .insert({
        aal_action: preparation ? ACTION_PREPAREE : ACTION_REFUSEE,
        aal_entity_type: ENTITE,
        aal_entity_id: lineId,
        aal_user_id: userId,
        aal_old_value: null,
        aal_new_value: preparation,
        aal_metadata: {
          orderId,
          decision: sortie.decision,
          controles: sortie.controles,
          lecture,
          envoi: base.envoi,
        },
      })
      .select('aal_id')
      .single();

    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        // Course entre deux processus : l'autre a préparé la ligne.
        const gagnante = await this.derniereTrace(lineId, ACTION_PREPAREE);
        return {
          ...base,
          decision: 'DEJA_PREPAREE',
          preparation: gagnante?.aal_new_value ?? null,
          traceId: gagnante?.aal_id ?? null,
        };
      }
      this.logger.error(`trace de préparation impossible : ${error.message}`);
      throw new InternalServerErrorException(
        "Trace impossible : la commande fournisseur n'est pas préparée",
      );
    }

    return {
      ...base,
      decision: sortie.decision,
      preparation,
      traceId: (data as { aal_id: string }).aal_id,
    };
  }

  private async lireCommande(orderId: string): Promise<CommandeLue> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select('ord_id, ord_is_pay, ord_ords_id')
      .eq('ord_id', orderId)
      .maybeSingle();
    if (error)
      throw new Error(`Lecture de la commande impossible : ${error.message}`);
    if (!data) throw new NotFoundException('Commande introuvable');
    return data as unknown as CommandeLue;
  }

  private async lireLigne(orderId: string, lineId: string): Promise<LigneLue> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order_line)
      .select(
        'orl_id, orl_ord_id, orl_art_ref, orl_pm_name, orl_art_quantity, orl_art_price_sell_unit_ttc, orl_orls_id, orl_spl_id, orl_spl_price_buy_unit_ht',
      )
      .eq('orl_id', lineId)
      .eq('orl_ord_id', orderId)
      .maybeSingle();
    if (error)
      throw new Error(`Lecture de la ligne impossible : ${error.message}`);
    if (!data) throw new NotFoundException('Ligne de commande introuvable');
    return data as unknown as LigneLue;
  }

  private async derniereTrace(
    lineId: string,
    action: string,
  ): Promise<TraceLue | null> {
    const { data, error } = await this.supabase
      .from('__admin_audit_log')
      .select('aal_id, aal_new_value, aal_metadata, aal_created_at')
      .eq('aal_entity_type', ENTITE)
      .eq('aal_entity_id', lineId)
      .eq('aal_action', action)
      .order('aal_created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      throw new Error(`Lecture du journal impossible : ${error.message}`);
    return (data as unknown as TraceLue) ?? null;
  }

  private async compterPreparations(): Promise<number> {
    const { count, error } = await this.supabase
      .from('__admin_audit_log')
      .select('aal_id', { count: 'exact', head: true })
      .eq('aal_action', ACTION_PREPAREE);
    if (error)
      throw new Error(`Comptage des essais impossible : ${error.message}`);
    return count ?? 0;
  }
}
