import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import { buildR2TitleTypeLabel, pickR2TitleMotorCode } from '@repo/seo-types';

interface TypeRow {
  type_id: string;
  type_modele_id: string | null;
  type_name: string | null;
  type_power_ps: string | null;
  type_fuel: string | null;
}

/**
 * Code moteur du `<title>` R2 pour les seules pages en collision
 * (complément 1 du mandat DW, 2026-11-19).
 *
 * Une page R2 (gamme, type) est en collision quand un autre type affiché du
 * même modèle a le même libellé `buildR2TitleTypeLabel` et des pièces dans la
 * même gamme (`pieces_relation_type`, critère du RPC de page). Son titre porte
 * alors le premier code moteur du type, s'il départage (`pickR2TitleMotorCode`).
 *
 * - Hors collision : chaîne vide, le titre ne change pas.
 * - Collision non départagée : chaîne vide et avertissement journalisé.
 * - Erreur de lecture : levée. `SeoTemplateService` renvoie alors son échec
 *   habituel (page en 503, rien de mis en cache) ; aucun titre dégradé.
 *
 * Appelé seulement quand le gabarit du titre contient
 * `#VTypeCarburantPuissance#`, et seulement en absence du cache
 * `seo:processed:*` (24 h) de `SeoTemplateService`.
 */
@Injectable()
export class R2TitleCollisionService extends SupabaseBaseService {
  protected readonly logger = new Logger(R2TitleCollisionService.name);

  async resolveMotorCode(pgId: number, typeId: number): Promise<string> {
    const own = await this.supabase
      .from(TABLES.auto_type)
      .select('type_id, type_modele_id, type_name, type_power_ps, type_fuel')
      .eq('type_id', String(typeId))
      .maybeSingle<TypeRow>();
    if (own.error) throw own.error;
    if (!own.data?.type_modele_id) return '';

    const siblings = await this.supabase
      .from(TABLES.auto_type)
      .select('type_id, type_modele_id, type_name, type_power_ps, type_fuel')
      .eq('type_modele_id', own.data.type_modele_id)
      .eq('type_display', '1')
      .neq('type_id', String(typeId))
      .returns<TypeRow[]>();
    if (siblings.error) throw siblings.error;

    const label = (t: TypeRow) =>
      buildR2TitleTypeLabel({
        typeName: t.type_name ?? '',
        powerPs: t.type_power_ps ?? '',
        fuel: t.type_fuel ?? '',
      });
    const ownLabel = label(own.data);
    const sameLabel = (siblings.data ?? []).filter(
      (t) => label(t) === ownLabel,
    );
    if (sameLabel.length === 0) return '';

    const served = await Promise.all(
      sameLabel.map(async (t) => {
        const r = await this.supabase
          .from(TABLES.pieces_relation_type)
          .select('rtp_type_id')
          .eq('rtp_pg_id', pgId)
          .eq('rtp_type_id', Number(t.type_id))
          .limit(1);
        if (r.error) throw r.error;
        return (r.data ?? []).length > 0 ? t.type_id : null;
      }),
    );
    const colliding = served.filter((id): id is string => id !== null);
    if (colliding.length === 0) return '';

    const codes = await this.supabase
      .from(TABLES.auto_type_motor_code)
      .select('tmc_type_id, tmc_code')
      .in('tmc_type_id', [String(typeId), ...colliding])
      .returns<Array<{ tmc_type_id: string; tmc_code: string | null }>>();
    if (codes.error) throw codes.error;
    const byType = new Map<string, string[]>();
    for (const row of codes.data ?? []) {
      const id = String(row.tmc_type_id);
      byType.set(id, [...(byType.get(id) ?? []), row.tmc_code ?? '']);
    }

    const code = pickR2TitleMotorCode(
      byType.get(String(typeId)) ?? [],
      colliding.map((id) => byType.get(id) ?? []),
    );
    if (code === null) {
      this.logger.warn(
        `Titre R2 en collision non départagée : pg=${pgId} type=${typeId} avec type(s) ${colliding.join(', ')}`,
      );
      return '';
    }
    return code;
  }
}
