import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import {
  buildR2CleanH1,
  buildR2H1VehicleLabel,
  buildR2TitleTypeLabel,
  pickR2TitleMotorCode,
  pickVehicleDisplayName,
  r2TitleCollisionKey,
  resolveR2H1Level,
  type R2H1Level,
  type R2H1Vehicle,
} from '@repo/seo-types';

/** Départage du `<title>` R2 d'une page (gamme, type). */
export interface R2TitleResolution {
  /** Code moteur à ajouter ; vide hors collision ou si aucun ne départage. */
  motorCode: string;
  /**
   * Vrai : servir les noms bruts du modèle et du type au lieu de leurs noms
   * d'affichage (complément 2), parce que ceux-ci confondent la page avec une
   * autre que les codes moteur ne départagent pas.
   */
  rawNames: boolean;
}

const NO_TITLE_RESOLUTION: R2TitleResolution = {
  motorCode: '',
  rawNames: false,
};

/** Niveau du H1 R2 propre et, au niveau 2, départage repris du titre. */
export interface R2HeadingResolution {
  level: R2H1Level;
  title: R2TitleResolution;
}

/** Page R2 dont on construit le H1 (`seo_context` du RPC de page). */
export interface R2HeadingInput {
  pgId: number;
  typeId: number;
  gammeName: string;
  marqueName: string;
  modeleName: string;
  modeleNameMeta?: string | null;
  typeName: string;
  typeNameMeta?: string | null;
  powerPs?: string | null;
  fuel?: string | null;
}

interface TypeRow {
  type_id: string;
  type_modele_id: string | null;
  type_name: string | null;
  type_name_meta: string | null;
  type_power_ps: string | null;
  type_fuel: string | null;
}

interface ModelRow {
  modele_id: number;
  modele_marque_id: number | null;
  modele_name: string | null;
  modele_name_meta: string | null;
}

interface CollisionContext {
  pgId: number;
  typeId: number;
  own: TypeRow;
  /** Modèles de la marque, par modele_id. */
  models: Map<string, ModelRow>;
  /** Types affichés des modèles candidats, hors le type de la page. */
  siblings: TypeRow[];
  /** type_id → pièces dans la gamme (lu une fois par appel). */
  served: Map<string, boolean>;
  /** type_id → codes moteur (lus une fois par appel). */
  codes: Map<string, string[]>;
}

/** Plafond de lignes PostgREST : au-delà, la lecture serait tronquée. */
const ROW_CAP = 1000;

/**
 * Départage du `<title>` R2 des seules pages en collision (complément 1 du
 * mandat DW, 2026-11-19 ; étendu au complément 2).
 *
 * Une page R2 (gamme, type) est en collision quand un autre type affiché a le
 * même titre véhicule — même marque, même nom de modèle (casse et espaces
 * ignorés, `r2TitleCollisionKey`), même libellé `buildR2TitleTypeLabel` — et
 * des pièces dans la même gamme (`pieces_relation_type`, critère du RPC de
 * page). Son titre porte alors le premier code moteur du type, s'il départage
 * (`pickR2TitleMotorCode`).
 *
 * - Hors collision : `motorCode` vide, le titre ne change pas.
 * - Collision non départagée : `motorCode` vide et avertissement journalisé.
 * - Erreur de lecture : levée. `SeoTemplateService` renvoie alors son échec
 *   habituel (page en 503, rien de mis en cache) ; aucun titre dégradé.
 *
 * Complément 2 : `displayNames` vrai → titres comparés sur les noms
 * d'affichage (`modele_name_meta`, `type_name_meta` s'ils sont renseignés),
 * comme le titre servi ; deux modèles distincts peuvent alors porter le même
 * nom (« PASSAT VII B7 » et « PASSAT VII B7 (A32-A33) » → « PASSAT VII »).
 * Si ces noms confondent des pages que les codes moteur ne départagent pas
 * (« 2.0 CRDI » et « 2.0 CRDI Traction Intégrale » → « 2.0 CRDi », code D4EA
 * pour les deux), la page sert ses noms bruts (`rawNames`), départagés à leur
 * tour par code moteur si besoin. `displayNames` faux → noms bruts d'emblée.
 *
 * Appelé seulement quand le gabarit du titre contient
 * `#VTypeCarburantPuissance#`, et seulement en absence du cache
 * `seo:processed:*` (24 h) de `SeoTemplateService`.
 */
@Injectable()
export class R2TitleCollisionService extends SupabaseBaseService {
  protected readonly logger = new Logger(R2TitleCollisionService.name);

  async resolveTitle(
    pgId: number,
    typeId: number,
    displayNames = false,
  ): Promise<R2TitleResolution> {
    const context = await this.loadContext(pgId, typeId, displayNames);
    if (context === null) return NO_TITLE_RESOLUTION;
    return this.resolveInContext(context, displayNames);
  }

  /**
   * Niveau du H1 R2 propre d'une page (mandat EN, 2026-11-20) : le plus bas
   * qui la distingue des autres types affichés ayant des pièces dans la
   * gamme (`resolveR2H1Level`). Comparaison sur les noms d'affichage, entre
   * les modèles de la marque de même nom brut ou d'affichage, comme le titre.
   * Au niveau 2, `title` porte le départage du titre (code moteur, noms
   * bruts) : le H1 reprend alors la partie véhicule du `<title>`.
   *
   * Mêmes lectures et même contrat d'erreur que `resolveTitle` : une erreur
   * de lecture est levée, aucun H1 dégradé n'est produit.
   */
  async resolveHeading(
    pgId: number,
    typeId: number,
  ): Promise<R2HeadingResolution> {
    const context = await this.loadContext(pgId, typeId, true);
    if (context === null) return { level: 0, title: NO_TITLE_RESOLUTION };
    const vehicle = (t: TypeRow): R2H1Vehicle => {
      const m = context.models.get(String(t.type_modele_id));
      return {
        typeId: t.type_id,
        marqueName: '',
        modeleName: m?.modele_name ?? '',
        modeleNameMeta: m?.modele_name_meta,
        typeName: t.type_name ?? '',
        typeNameMeta: t.type_name_meta,
        powerPs: t.type_power_ps,
        fuel: t.type_fuel,
      };
    };
    const own = vehicle(context.own);
    const key0 = (v: R2H1Vehicle) =>
      r2TitleCollisionKey(buildR2H1VehicleLabel(v, 0));
    const same = context.siblings.filter((t) => key0(vehicle(t)) === key0(own));
    await this.loadServed(context, same);
    const level = resolveR2H1Level(
      own,
      same.filter((t) => context.served.get(t.type_id)).map(vehicle),
    );
    return {
      level,
      title:
        level === 2
          ? await this.resolveInContext(context, true)
          : NO_TITLE_RESOLUTION,
    };
  }

  /**
   * H1 R2 propre complet de la page (`buildR2CleanH1`), au niveau donné par
   * `resolveHeading`. Les noms viennent du `seo_context` du RPC de page.
   */
  async buildHeading(input: R2HeadingInput): Promise<string> {
    const { level, title } = await this.resolveHeading(
      input.pgId,
      input.typeId,
    );
    return buildR2CleanH1(
      input.gammeName,
      {
        typeId: String(input.typeId),
        marqueName: input.marqueName,
        modeleName: input.modeleName,
        modeleNameMeta: input.modeleNameMeta,
        typeName: input.typeName,
        typeNameMeta: input.typeNameMeta,
        powerPs: input.powerPs,
        fuel: input.fuel,
      },
      level,
      title,
    );
  }

  /**
   * Type de la page, modèles de la marque et types affichés des modèles de
   * même nom (brut, ou d'affichage si `displayNames`). `null` : type sans
   * modèle connu, rien à départager.
   */
  private async loadContext(
    pgId: number,
    typeId: number,
    displayNames: boolean,
  ): Promise<CollisionContext | null> {
    const own = await this.supabase
      .from(TABLES.auto_type)
      .select(
        'type_id, type_modele_id, type_name, type_name_meta, type_power_ps, type_fuel',
      )
      .eq('type_id', String(typeId))
      .maybeSingle<TypeRow>();
    if (own.error) throw own.error;
    if (!own.data?.type_modele_id) return null;

    const ownModel = await this.supabase
      .from(TABLES.auto_modele)
      .select('modele_id, modele_marque_id, modele_name, modele_name_meta')
      .eq('modele_id', Number(own.data.type_modele_id))
      .maybeSingle<ModelRow>();
    if (ownModel.error) throw ownModel.error;
    if (!ownModel.data) return null;

    // Modèles affichés de la marque (au plus 684 le 2026-11-19).
    const brand = await this.supabase
      .from(TABLES.auto_modele)
      .select('modele_id, modele_marque_id, modele_name, modele_name_meta')
      .eq('modele_marque_id', ownModel.data.modele_marque_id ?? -1)
      .eq('modele_display', 1)
      .returns<ModelRow[]>();
    if (brand.error) throw brand.error;
    if ((brand.data ?? []).length >= ROW_CAP) {
      throw new Error(
        `Titre R2 : modèles de la marque ${ownModel.data.modele_marque_id} au plafond de ${ROW_CAP} lignes, départage incomplet`,
      );
    }
    const models = new Map<string, ModelRow>();
    for (const m of [ownModel.data, ...(brand.data ?? [])]) {
      models.set(String(m.modele_id), m);
    }

    // Modèles dont le nom (brut ou d'affichage) est celui de la page.
    const rawKey = (m: ModelRow) => r2TitleCollisionKey(m.modele_name ?? '');
    const dispKey = (m: ModelRow) =>
      r2TitleCollisionKey(
        pickVehicleDisplayName(m.modele_name_meta, m.modele_name),
      );
    const candidates = [...models.values()]
      .filter(
        (m) =>
          rawKey(m) === rawKey(ownModel.data!) ||
          (displayNames && dispKey(m) === dispKey(ownModel.data!)),
      )
      .map((m) => String(m.modele_id));

    const siblings = await this.supabase
      .from(TABLES.auto_type)
      .select(
        'type_id, type_modele_id, type_name, type_name_meta, type_power_ps, type_fuel',
      )
      .in('type_modele_id', candidates)
      .eq('type_display', '1')
      .neq('type_id', String(typeId))
      .returns<TypeRow[]>();
    if (siblings.error) throw siblings.error;
    if ((siblings.data ?? []).length >= ROW_CAP) {
      throw new Error(
        `Titre R2 : types voisins de ${typeId} au plafond de ${ROW_CAP} lignes, départage incomplet`,
      );
    }

    return {
      pgId,
      typeId,
      own: own.data,
      models,
      siblings: siblings.data ?? [],
      served: new Map(),
      codes: new Map(),
    };
  }

  /** Départage du titre dans un contexte chargé (`resolveTitle`). */
  private async resolveInContext(
    context: CollisionContext,
    displayNames: boolean,
  ): Promise<R2TitleResolution> {
    const { pgId, typeId } = context;
    const first = await this.collide(context, displayNames);
    if (first === null) return NO_TITLE_RESOLUTION;
    if (first.code !== null) return { motorCode: first.code, rawNames: false };
    if (displayNames) {
      const raw = await this.collide(context, false);
      if (raw === null) return { motorCode: '', rawNames: true };
      if (raw.code !== null) return { motorCode: raw.code, rawNames: true };
      this.warnUnresolved(pgId, typeId, raw.colliding);
      return { motorCode: '', rawNames: true };
    }
    this.warnUnresolved(pgId, typeId, first.colliding);
    return NO_TITLE_RESOLUTION;
  }

  /** Lit, une fois par type, si des pièces le relient à la gamme. */
  private async loadServed(c: CollisionContext, types: TypeRow[]) {
    for (const t of types) {
      if (c.served.has(t.type_id)) continue;
      const r = await this.supabase
        .from(TABLES.pieces_relation_type)
        .select('rtp_type_id')
        .eq('rtp_pg_id', c.pgId)
        .eq('rtp_type_id', Number(t.type_id))
        .limit(1);
      if (r.error) throw r.error;
      c.served.set(t.type_id, (r.data ?? []).length > 0);
    }
  }

  /**
   * Types de même titre véhicule ayant des pièces dans la gamme, et code
   * moteur qui départage (`null` si aucun). `null` : pas de collision.
   */
  private async collide(
    c: CollisionContext,
    displayNames: boolean,
  ): Promise<{ colliding: string[]; code: string | null } | null> {
    const title = (t: TypeRow) => {
      const m = c.models.get(String(t.type_modele_id));
      const model = displayNames
        ? pickVehicleDisplayName(m?.modele_name_meta, m?.modele_name)
        : (m?.modele_name ?? '');
      const label = buildR2TitleTypeLabel({
        typeName: displayNames
          ? pickVehicleDisplayName(t.type_name_meta, t.type_name)
          : (t.type_name ?? ''),
        powerPs: t.type_power_ps ?? '',
        fuel: t.type_fuel ?? '',
      });
      return r2TitleCollisionKey(`${model} ${label}`);
    };
    const ownTitle = title(c.own);
    const same = c.siblings.filter((t) => title(t) === ownTitle);
    if (same.length === 0) return null;

    await this.loadServed(c, same);
    const colliding = same
      .map((t) => t.type_id)
      .filter((id) => c.served.get(id));
    if (colliding.length === 0) return null;

    const ids = [String(c.typeId), ...colliding].filter(
      (id) => !c.codes.has(id),
    );
    if (ids.length > 0) {
      const codes = await this.supabase
        .from(TABLES.auto_type_motor_code)
        .select('tmc_type_id, tmc_code')
        .in('tmc_type_id', ids)
        .returns<Array<{ tmc_type_id: string; tmc_code: string | null }>>();
      if (codes.error) throw codes.error;
      for (const id of ids) c.codes.set(id, []);
      for (const row of codes.data ?? []) {
        const id = String(row.tmc_type_id);
        c.codes.set(id, [...(c.codes.get(id) ?? []), row.tmc_code ?? '']);
      }
    }

    const code = pickR2TitleMotorCode(
      c.codes.get(String(c.typeId)) ?? [],
      colliding.map((id) => c.codes.get(id) ?? []),
    );
    return { colliding, code };
  }

  private warnUnresolved(pgId: number, typeId: number, colliding: string[]) {
    this.logger.warn(
      `Titre R2 en collision non départagée : pg=${pgId} type=${typeId} avec type(s) ${colliding.join(', ')}`,
    );
  }
}
