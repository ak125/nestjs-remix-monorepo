/**
 * SeoProjectionReaderService — propriétaire UNIQUE de la lecture d'enveloppe de projection SEO
 * (RPC `get_active_seo_projection`, ADR-059 PR-7). Extraction behavior-identical depuis
 * `SeoBriefService` (C0) : découple le READ du WRITE (moindre-privilège — le module lourd
 * `SeoProjectionModule` exporte le WRITER + Gate `service_role` + queues, dont un consommateur
 * de lecture n'a pas besoin).
 *
 * **Flag-neutre** : ne consulte AUCUN feature flag (le gating d'activation appartient à l'appelant).
 * **Dégradation observable** (CLAUDE.md no-silent-fallback) : RPC en erreur / exception / projection
 * absente → `{ envelope: null, degradeReason }` + log, JAMAIS de fabrication ni de repli silencieux.
 * L'appelant décide quoi faire du null (SeoBriefService retombe sur son chemin keyword-first).
 *
 * **DARK** : aucun consumer public ne l'utilise encore (aucune route/loader ne sert la projection) ;
 * ce module ne fait qu'unifier la lecture existante côté admin. Pas de flag de lecture, pas de canary.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';

/** Bloc de contenu projeté (forme réglée par PR-0 : champs dans `content`). `truth_level` brut RPC. */
export interface ProjectionBlock {
  role?: string;
  block_kind?: string;
  content?: {
    content_md?: string;
    source_ids?: string[];
    /** Brut depuis la RPC ; l'appelant (brief) le re-narrow en son propre `BlockTruthLevel`. */
    truth_level?: string;
    section?: string;
    usefulness_target?: string;
  } | null;
}

/** Enveloppe renvoyée par `get_active_seo_projection` (forme PR-7). */
export interface ProjectionEnvelope {
  entity_id: string;
  entity_type: string;
  slug: string;
  facts: unknown[];
  blocks: ProjectionBlock[];
}

/**
 * Résultat de lecture. `envelope` non-null ⟺ `degradeReason` null. Sinon `degradeReason` porte la
 * cause OBSERVABLE (`RPC error: <msg>` | `RPC exception` | `projection absente`) — jamais un null muet.
 */
export interface ProjectionReadResult {
  envelope: ProjectionEnvelope | null;
  degradeReason: string | null;
}

@Injectable()
export class SeoProjectionReaderService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    SeoProjectionReaderService.name,
  );

  constructor(
    configService: ConfigService,
    @Optional() rpcGate?: RpcGateService,
  ) {
    super(configService);
    if (rpcGate) this.rpcGate = rpcGate;
  }

  /**
   * Lit la projection active pour `(entityId, role)` via la RPC `get_active_seo_projection`.
   * Dégrade **observable** (null + `degradeReason` + log) sur erreur / exception / absence. Flag-neutre.
   */
  async readActiveProjection(
    entityId: string,
    role: string,
  ): Promise<ProjectionReadResult> {
    try {
      const { data, error } = await this.callRpc<ProjectionEnvelope | null>(
        'get_active_seo_projection',
        { p_entity_id: entityId, p_role: role },
        { source: 'api' },
      );
      if (error) {
        this.logger.warn(
          `projection RPC error ${entityId}: ${error.message} → dégradé (observable)`,
        );
        return { envelope: null, degradeReason: `RPC error: ${error.message}` };
      }
      const envelope = (data as ProjectionEnvelope | null) ?? null;
      if (!envelope) {
        this.logger.log(
          `projection vide ${entityId} (non projetée) → dégradé (observable)`,
        );
        return { envelope: null, degradeReason: 'projection absente' };
      }
      return { envelope, degradeReason: null };
    } catch (e) {
      this.logger.warn(
        `projection RPC exception ${entityId}: ${String(e)} → dégradé (observable)`,
      );
      return { envelope: null, degradeReason: 'RPC exception' };
    }
  }
}
