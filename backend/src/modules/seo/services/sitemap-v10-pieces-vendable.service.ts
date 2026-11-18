/**
 * SERVICE PIECES SITEMAP V10 — source « vendable » (décisions 48 et 118)
 *
 * Seconde source du sitemap gamme × véhicule, choisie par le réglage
 * SITEMAP_R2_SOURCE=vendable (défaut `legacy` : table figée __sitemap_p_link et
 * seuil map_has_item, service SitemapV10PiecesService, inchangé).
 *
 * Une URL est déclarée si :
 *   - la gamme est indexable selon la règle actuelle, lue par
 *     SitemapV10DataService.getIndexGammeIds (inchangée) ;
 *   - le véhicule est affiché (auto_type.type_display = '1') ;
 *   - la gamme porte, pour ce véhicule, au moins une pièce vendable selon la
 *     fonction SQL unique public.est_vendable, lue par
 *     get_sitemap_r2_types_vendables (migration
 *     20261118_est_vendable_definition_unique.sql).
 * Ni __sitemap_p_link ni map_has_item ne sont lus ici.
 *
 * Ordre : gamme croissante puis type croissant, tranches de 50 000 URL. Deux
 * générations sur les mêmes données rendent les mêmes fichiers.
 *
 * Publication en deux temps : le lot s'écrit dans un dossier d'attente, hors
 * des chemins servis. Il ne remplace les fichiers en place qu'après le
 * garde-fou : si plus de 5 % des URL du sitemap précédent cliquées sur
 * 28 jours (Search Console en base) en sortent, rien n'est publié. Toute
 * erreur de lecture arrête de la même façon : les fichiers précédents restent
 * en place et dans l'index, la génération est signalée en échec.
 *
 * Les robots des pages ne sont ni lus ni modifiés ici.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import {
  evaluerGardeFou,
  type GardeFouSortie,
} from '../../pricing/config/supplier-sale-rules';
import { SitemapV10DataService } from './sitemap-v10-data.service';
import { pieceShardUrls } from './sitemap-v10-pieces.service';
import { SitemapV10XmlService } from './sitemap-v10-xml.service';
import {
  BUCKET_CONFIG,
  MAX_URLS_PER_FILE,
  type PieceV9,
  type SitemapUrl,
  type TemperatureBucket,
} from './sitemap-v10.types';

/** Part maximale des URL cliquées qu'une génération peut retirer (mandat CT §6.5). */
export const SEUIL_RETRAIT_URL_CLIQUEES = 0.05;

/** Fenêtre de clics Search Console du garde-fou, en jours. */
export const JOURS_CLICS_GARDE_FOU = 28;

/** Dossier d'attente, sous le dossier des sitemaps, hors des chemins servis. */
export const DOSSIER_ATTENTE_PIECES = '.attente-sitemap-pieces';

/**
 * Types demandés par appel. Mesuré le 2026-11-18 : la gamme la plus lourde,
 * tous types confondus, répond en 25,5 s ; une fenêtre de 5 000 types reste
 * loin du délai de 60 s du rôle de service.
 */
const TYPES_PAR_APPEL = 5000;

/** En dessous, un dépassement de délai n'est plus rejoué : la génération s'arrête. */
const TYPES_PAR_APPEL_MIN = 250;

/** SQLSTATE d'une requête annulée par statement_timeout. */
const CODE_DELAI_DEPASSE = '57014';

const PAGE_LECTURE = 1000;
const FICHIER_PIECES = /^sitemap-pieces(-(\d+))?\.xml$/;
const CHEMIN_R2 = /^\/pieces\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html$/;
const RPC_TYPES_VENDABLES = 'get_sitemap_r2_types_vendables';

/**
 * Génération arrêtée sans publication. `keptFilePaths` : les fichiers pièces
 * en place, que l'orchestrateur garde dans l'index.
 */
export class SitemapR2NonPublieError extends Error {
  constructor(
    message: string,
    readonly keptFilePaths: string[],
  ) {
    super(message);
    this.name = 'SitemapR2NonPublieError';
  }
}

export interface BilanGardeFouR2 extends GardeFouSortie {
  /** Fenêtre de clics lue, bornes incluses (AAAA-MM-JJ). */
  du: string;
  au: string;
  /** Clics de la fenêtre portés par les URL retirées. */
  clicsRetires: number;
  /** URL retirées, des plus cliquées aux moins cliquées. */
  retirees: string[];
}

/**
 * Chemin d'une page gamme × véhicule, ou null. Accepte une URL complète (ligne
 * Search Console, <loc> du sitemap) ou un chemin ; paramètres et ancre ignorés.
 */
export function cheminR2(urlOuChemin: string): string | null {
  let chemin: string;
  try {
    chemin = new URL(urlOuChemin, 'https://x.invalid').pathname;
  } catch {
    return null;
  }
  return CHEMIN_R2.test(chemin) ? chemin : null;
}

/** Découpe une liste triée en fenêtres consécutives d'au plus `taille` éléments. */
export function fenetres(tries: number[], taille: number): number[][] {
  const lots: number[][] = [];
  for (let i = 0; i < tries.length; i += taille) {
    lots.push(tries.slice(i, i + taille));
  }
  return lots;
}

/**
 * Garde-fou pur. `cliqueesAvant` : URL du sitemap précédent ayant reçu au moins
 * un clic sur la fenêtre, avec leurs clics. `retrouvees` : celles que le
 * nouveau lot contient encore.
 */
export function evaluerRetraitUrlCliquees(
  cliqueesAvant: ReadonlyMap<string, number>,
  retrouvees: ReadonlySet<string>,
  fenetre: { du: string; au: string },
  seuil: number = SEUIL_RETRAIT_URL_CLIQUEES,
): BilanGardeFouR2 {
  const retirees = [...cliqueesAvant.keys()]
    .filter((u) => !retrouvees.has(u))
    .sort(
      (a, b) =>
        (cliqueesAvant.get(b) ?? 0) - (cliqueesAvant.get(a) ?? 0) ||
        (a < b ? -1 : 1),
    );
  return {
    ...evaluerGardeFou(retirees.length, cliqueesAvant.size, seuil),
    ...fenetre,
    clicsRetires: retirees.reduce(
      (somme, u) => somme + (cliqueesAvant.get(u) ?? 0),
      0,
    ),
    retirees,
  };
}

interface Vehicule {
  typeAlias: string | null;
  modeleId: number;
  modeleAlias: string | null;
  marqueId: number;
  marqueAlias: string | null;
}

interface GammeIndexable {
  pgId: number;
  pgAlias: string | null;
}

interface Pagine {
  order(
    colonne: string,
    options: { ascending: boolean },
  ): {
    range(
      debut: number,
      fin: number,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
}

function jourMoins(jour: string, jours: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class SitemapV10PiecesVendableService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    SitemapV10PiecesVendableService.name,
  );

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly dataService: SitemapV10DataService,
    private readonly xmlService: SitemapV10XmlService,
  ) {
    super(configService);
    this.rpcGate = rpcGate;
  }

  /**
   * Génère le sitemap gamme × véhicule depuis la règle « vendable ».
   * Lève SitemapR2NonPublieError si rien n'a pu être publié.
   */
  async generatePiecesSitemapsFromVendable(
    bucket: TemperatureBucket,
  ): Promise<{ filePaths: string[]; totalCount: number }> {
    // Comme la source figée : un seul bucket porte les URL.
    if (bucket !== 'stable') {
      return { filePaths: [], totalCount: 0 };
    }

    try {
      return await this.genererPuisPublier(bucket);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await fs.rm(this.dossierAttente(), { recursive: true, force: true });
      const gardes = await this.fichiersEnPlace();
      this.logger.error(
        `❌ Sitemap gamme × véhicule NON publié (source vendable) : ${message} — ${gardes.length} fichier(s) précédent(s) gardé(s)`,
      );
      throw new SitemapR2NonPublieError(
        `sitemap gamme × véhicule non publié (source vendable) : ${message}`,
        gardes,
      );
    }
  }

  private dossierAttente(): string {
    return path.join(this.xmlService.OUTPUT_DIR, DOSSIER_ATTENTE_PIECES);
  }

  /** Fichiers pièces présents dans le dossier publié, dans l'ordre des tranches. */
  private async fichiersEnPlace(): Promise<string[]> {
    let noms: string[];
    try {
      noms = await fs.readdir(this.xmlService.OUTPUT_DIR);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const rang = (nom: string) => Number(FICHIER_PIECES.exec(nom)?.[2] ?? 0);
    return noms
      .filter((nom) => FICHIER_PIECES.test(nom))
      .sort((a, b) => rang(a) - rang(b))
      .map((nom) => path.join(this.xmlService.OUTPUT_DIR, nom));
  }

  private async genererPuisPublier(
    bucket: TemperatureBucket,
  ): Promise<{ filePaths: string[]; totalCount: number }> {
    const debut = Date.now();
    const changefreq = BUCKET_CONFIG[bucket].changefreq;

    // 1. Ce que le garde-fou doit protéger, lu AVANT de produire quoi que ce soit.
    const clics = await this.lireClicsR2();
    const precedent = await this.lirePrecedent(clics.parChemin);
    this.logger.log(
      `  Sitemap précédent : ${precedent.total.toLocaleString()} URL dans ${precedent.fichiers.length} fichier(s), dont ${precedent.cliquees.size.toLocaleString()} cliquées du ${clics.du} au ${clics.au}`,
    );
    if (precedent.fichiers.length === 0) {
      this.logger.warn(
        '  Aucun sitemap pièces précédent dans le dossier : le garde-fou est sans objet pour cette génération',
      );
    }

    // 2. Gammes indexables (règle actuelle) et véhicules affichés.
    const gammes = await this.lireGammesIndexables();
    const vehicules = await this.lireVehiculesAffiches();
    const lots = fenetres(
      [...vehicules.keys()].sort((a, b) => a - b),
      TYPES_PAR_APPEL,
    );
    this.logger.log(
      `  ${gammes.length} gammes indexables × ${vehicules.size.toLocaleString()} véhicules affichés, ${lots.length} fenêtre(s) de types par gamme`,
    );

    // 3. Production dans le dossier d'attente.
    const attente = this.dossierAttente();
    await fs.rm(attente, { recursive: true, force: true });
    await fs.mkdir(attente, { recursive: true });

    const noms: string[] = [];
    const retrouvees = new Set<string>();
    let tampon: SitemapUrl[] = [];
    let total = 0;
    let malFormees = 0;
    let horsReleve = 0;

    const ecrire = async (urls: SitemapUrl[], derniere: boolean) => {
      const nom =
        derniere && noms.length === 0
          ? 'sitemap-pieces.xml'
          : `sitemap-pieces-${noms.length + 1}.xml`;
      await this.xmlService.writeStaticSitemapFile(
        path.join(attente, nom),
        urls,
      );
      noms.push(nom);
    };

    for (const gamme of gammes) {
      for (const lot of lots) {
        const types = await this.typesVendables(gamme.pgId, lot);
        const pieces: PieceV9[] = [];
        for (const typeId of types) {
          const v = vehicules.get(typeId);
          if (!v) {
            horsReleve++;
            continue;
          }
          pieces.push({
            map_pg_alias: gamme.pgAlias ?? '',
            map_pg_id: String(gamme.pgId),
            map_marque_alias: v.marqueAlias ?? '',
            map_marque_id: String(v.marqueId),
            map_modele_alias: v.modeleAlias ?? '',
            map_modele_id: String(v.modeleId),
            map_type_alias: v.typeAlias ?? '',
            map_type_id: String(typeId),
          });
        }
        const { urls, skipped } = pieceShardUrls(pieces, 'piece', changefreq);
        malFormees += skipped;
        total += urls.length;
        for (const u of urls) {
          if (precedent.cliquees.has(u.url)) retrouvees.add(u.url);
          tampon.push(u);
        }
        while (tampon.length >= MAX_URLS_PER_FILE) {
          await ecrire(tampon.slice(0, MAX_URLS_PER_FILE), false);
          tampon = tampon.slice(MAX_URLS_PER_FILE);
        }
      }
    }
    if (tampon.length > 0) await ecrire(tampon, true);

    if (horsReleve > 0) {
      this.logger.warn(
        `  ${horsReleve.toLocaleString()} couple(s) écarté(s) : véhicule sans modèle ou sans marque lisible, ou affiché après le relevé des véhicules`,
      );
    }
    if (malFormees > 0) {
      this.logger.warn(
        `  ${malFormees.toLocaleString()} URL mal formée(s) écartée(s) (alias vide, « type » ou égal à l'identifiant)`,
      );
    }
    if (total === 0) {
      throw new Error(
        'aucune URL produite : un sitemap vide ne remplace pas le précédent',
      );
    }

    // 4. Garde-fou.
    const bilan = evaluerRetraitUrlCliquees(precedent.cliquees, retrouvees, {
      du: clics.du,
      au: clics.au,
    });
    const part = (bilan.part * 100).toFixed(2);
    this.logger.log(
      `  Garde-fou : ${bilan.sortantes} URL cliquée(s) sur ${bilan.vendablesAvant} sortirai(en)t (${part} %, seuil ${bilan.seuil * 100} %), ${bilan.clicsRetires} clic(s) du ${bilan.du} au ${bilan.au}`,
    );
    if (bilan.arret) {
      throw new Error(
        `garde-fou : ${bilan.sortantes} URL cliquées sur ${bilan.vendablesAvant} (${part} %) sortiraient du sitemap, seuil ${bilan.seuil * 100} % ; ${bilan.clicsRetires} clics du ${bilan.du} au ${bilan.au} ; premières : ${bilan.retirees.slice(0, 5).join(' ')}`,
      );
    }
    for (const u of bilan.retirees) {
      this.logger.warn(`  URL cliquée sortie du sitemap : ${u}`);
    }

    // 5. Publication : le lot remplace les fichiers en place.
    const publies: string[] = [];
    for (const nom of noms) {
      const cible = path.join(this.xmlService.OUTPUT_DIR, nom);
      await fs.rename(path.join(attente, nom), cible);
      publies.push(cible);
    }
    for (const ancien of precedent.fichiers) {
      if (!noms.includes(path.basename(ancien))) await fs.unlink(ancien);
    }
    await fs.rm(attente, { recursive: true, force: true });

    this.logger.log(
      `  ${total.toLocaleString()} URL gamme × véhicule (source vendable) -> ${publies.length} fichier(s) en ${Date.now() - debut} ms`,
    );
    return { filePaths: publies, totalCount: total };
  }

  /**
   * Types affichés de la fenêtre qui portent, pour la gamme, au moins une pièce
   * vendable. Un dépassement de délai est rejoué sur deux demi-fenêtres ; toute
   * autre erreur, ou une réponse inattendue, arrête la génération.
   */
  private async typesVendables(pgId: number, lot: number[]): Promise<number[]> {
    const min = lot[0];
    const max = lot[lot.length - 1];
    const { data, error } = await this.callRpc<number[]>(
      RPC_TYPES_VENDABLES,
      { p_pg_id: pgId, p_type_min: min, p_type_max: max },
      { source: 'cron', role: 'service_role' },
    );

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === CODE_DELAI_DEPASSE && lot.length > TYPES_PAR_APPEL_MIN) {
        const milieu = Math.ceil(lot.length / 2);
        this.logger.warn(
          `  Délai dépassé (gamme ${pgId}, types ${min}–${max}) : rejoué en deux demi-fenêtres`,
        );
        const debut = await this.typesVendables(pgId, lot.slice(0, milieu));
        const fin = await this.typesVendables(pgId, lot.slice(milieu));
        return [...debut, ...fin];
      }
      throw new Error(
        `${RPC_TYPES_VENDABLES}(gamme ${pgId}, types ${min}–${max}) : ${error.message}`,
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        `${RPC_TYPES_VENDABLES}(gamme ${pgId}, types ${min}–${max}) : réponse qui n'est pas un tableau`,
      );
    }
    let precedent = min - 1;
    for (const typeId of data) {
      if (!Number.isInteger(typeId) || typeId <= precedent || typeId > max) {
        throw new Error(
          `${RPC_TYPES_VENDABLES}(gamme ${pgId}, types ${min}–${max}) : type ${String(typeId)} hors fenêtre ou hors ordre`,
        );
      }
      precedent = typeId;
    }
    return data;
  }

  /** Lecture paginée, triée, qui lève à la première erreur. */
  private async lireTout<T>(
    quoi: string,
    requete: () => Pagine,
    tri: string[],
  ): Promise<T[]> {
    const lignes: T[] = [];
    for (let debut = 0; ; debut += PAGE_LECTURE) {
      let q = requete();
      for (const colonne of tri.slice(0, -1)) {
        q = q.order(colonne, { ascending: true }) as unknown as Pagine;
      }
      const { data, error } = await q
        .order(tri[tri.length - 1], { ascending: true })
        .range(debut, debut + PAGE_LECTURE - 1);
      if (error) {
        throw new Error(`lecture ${quoi} (ligne ${debut}) : ${error.message}`);
      }
      const page = (data ?? []) as T[];
      lignes.push(...page);
      if (page.length < PAGE_LECTURE) return lignes;
    }
  }

  /** Gammes indexables selon la règle actuelle, avec leur alias, triées. */
  private async lireGammesIndexables(): Promise<GammeIndexable[]> {
    const ids = [...(await this.dataService.getIndexGammeIds())]
      .map(Number)
      .sort((a, b) => a - b);
    if (ids.length === 0) {
      throw new Error('aucune gamme indexable lue (lecture vide ou en erreur)');
    }
    const lignes = await this.lireTout<{
      pg_id: number;
      pg_alias: string | null;
    }>(
      'pieces_gamme',
      () =>
        this.supabase
          .from('pieces_gamme')
          .select('pg_id, pg_alias')
          .in('pg_id', ids) as unknown as Pagine,
      ['pg_id'],
    );
    const alias = new Map(lignes.map((l) => [Number(l.pg_id), l.pg_alias]));
    return ids.map((pgId) => {
      if (!alias.has(pgId)) {
        throw new Error(`gamme indexable ${pgId} absente de pieces_gamme`);
      }
      return { pgId, pgAlias: alias.get(pgId) ?? null };
    });
  }

  /**
   * Véhicules affichés, avec les alias vivants de leur modèle et de la marque
   * de ce modèle : la forme d'URL que la page sert en canonique.
   */
  private async lireVehiculesAffiches(): Promise<Map<number, Vehicule>> {
    const types = await this.lireTout<{
      type_id_i: number | null;
      type_alias: string | null;
      type_modele_id_i: number | null;
    }>(
      'auto_type',
      () =>
        this.supabase
          .from('auto_type')
          .select('type_id_i, type_alias, type_modele_id_i')
          .eq('type_display', '1') as unknown as Pagine,
      ['type_id_i'],
    );
    const modeles = await this.lireTout<{
      modele_id: number;
      modele_alias: string | null;
      modele_marque_id: number | null;
    }>(
      'auto_modele',
      () =>
        this.supabase
          .from('auto_modele')
          .select(
            'modele_id, modele_alias, modele_marque_id',
          ) as unknown as Pagine,
      ['modele_id'],
    );
    const marques = await this.lireTout<{
      marque_id: number;
      marque_alias: string | null;
    }>(
      'auto_marque',
      () =>
        this.supabase
          .from('auto_marque')
          .select('marque_id, marque_alias') as unknown as Pagine,
      ['marque_id'],
    );
    if (types.length === 0 || modeles.length === 0 || marques.length === 0) {
      throw new Error(
        `véhicules illisibles : ${types.length} types affichés, ${modeles.length} modèles, ${marques.length} marques`,
      );
    }

    const modeleParId = new Map(modeles.map((m) => [Number(m.modele_id), m]));
    const marqueParId = new Map(marques.map((m) => [Number(m.marque_id), m]));
    const vehicules = new Map<number, Vehicule>();
    for (const t of types) {
      if (t.type_id_i === null || t.type_modele_id_i === null) continue;
      const modele = modeleParId.get(Number(t.type_modele_id_i));
      if (!modele || modele.modele_marque_id === null) continue;
      const marque = marqueParId.get(Number(modele.modele_marque_id));
      if (!marque) continue;
      vehicules.set(Number(t.type_id_i), {
        typeAlias: t.type_alias,
        modeleId: Number(modele.modele_id),
        modeleAlias: modele.modele_alias,
        marqueId: Number(marque.marque_id),
        marqueAlias: marque.marque_alias,
      });
    }
    return vehicules;
  }

  /**
   * Clics Search Console des pages gamme × véhicule sur les 28 derniers jours
   * connus de la base. Table vide ou illisible : la génération s'arrête.
   */
  private async lireClicsR2(): Promise<{
    du: string;
    au: string;
    parChemin: Map<string, number>;
  }> {
    const { data: dernier, error } = await this.supabase
      .from('__seo_gsc_daily_page_totals')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);
    if (error) {
      throw new Error(`lecture Search Console : ${error.message}`);
    }
    const au = dernier?.[0]?.date as string | undefined;
    if (!au) {
      throw new Error(
        'Search Console vide en base : le garde-fou ne peut pas être évalué',
      );
    }
    const du = jourMoins(au, JOURS_CLICS_GARDE_FOU - 1);

    const lignes = await this.lireTout<{ page: string; clicks: number }>(
      'Search Console',
      () =>
        this.supabase
          .from('__seo_gsc_daily_page_totals')
          .select('date, page, clicks')
          .gte('date', du)
          .lte('date', au)
          .gt('clicks', 0)
          .like('page', '%/pieces/%') as unknown as Pagine,
      ['date', 'page'],
    );
    const parChemin = new Map<string, number>();
    for (const ligne of lignes) {
      const chemin = cheminR2(ligne.page);
      if (!chemin) continue;
      parChemin.set(
        chemin,
        (parChemin.get(chemin) ?? 0) + Number(ligne.clicks),
      );
    }
    return { du, au, parChemin };
  }

  /**
   * Sitemap précédent : ses fichiers, son nombre d'URL, et celles de ses URL
   * qui ont reçu au moins un clic sur la fenêtre. Les fichiers sont lus un à
   * un ; seules les URL cliquées sont gardées en mémoire.
   */
  private async lirePrecedent(clics: ReadonlyMap<string, number>): Promise<{
    fichiers: string[];
    total: number;
    cliquees: Map<string, number>;
  }> {
    const fichiers = await this.fichiersEnPlace();
    const cliquees = new Map<string, number>();
    let total = 0;
    for (const fichier of fichiers) {
      const xml = await fs.readFile(fichier, 'utf8');
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        total++;
        const chemin = cheminR2(m[1]);
        const n = chemin ? clics.get(chemin) : undefined;
        if (chemin && n !== undefined) cliquees.set(chemin, n);
      }
    }
    return { fichiers, total, cliquees };
  }
}
