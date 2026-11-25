/**
 * Sources d'achat d'une marque (mandat DQ) : fonction pure, sans accès aux
 * tables. Le dépôt lit les liens `___xtr_supplier_link_pm` et le résumé des
 * fiches ; cette fonction les classe et dit, pour chaque source, où la pièce
 * arrive, comment, et à quel surcoût fixe.
 *
 * Décisions de Marwane (19/11) reprises par les cas de test :
 *  - CEVAM : stock chez EXADIS (rang 1), sinon commande en ligne chez CEVAM,
 *    livrée en France par transporteur (rang 2) ;
 *  - MEAT & DORIA : OTTOGO (rang 1), sinon M&D en direct livré chez CS avec
 *    un supplément de 3 € (rang 2) ;
 *  - SASIC : en direct, stock chez BG et chez DCA.
 *
 * Hors périmètre : prix, remises (supplier_price_profiles, par fournisseur ×
 * marque, jamais recopiées ici) et choix automatique d'une source. Rien n'est
 * branché au calcul des prix ni au panier.
 */

export const BRAND_SOURCE_STOCK_KINDS = ['stock', 'commande'] as const;
export type BrandSourceStockKind = (typeof BRAND_SOURCE_STOCK_KINDS)[number];

/** Lien marque × fournisseur tel que lu (colonnes slpm_*). */
export interface BrandSourceLinkInput {
  linkId: string;
  splId: string;
  displayed: boolean;
  rank: number | null;
  deliverySplId: string | null;
  stockKind: string | null;
  surchargeCents: number | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/** Résumé d'une fiche fournisseur (colonnes spl_*). */
export interface BrandSourceCardInput {
  splId: string;
  name: string | null;
  type: string | null;
  status: string | null;
  supplyMode: string | null;
  fallbackMode: string | null;
}

export interface ResolvedBrandSource {
  rank: number;
  linkId: string;
  source: { splId: string; name: string | null; type: string | null };
  /** Fiche où la pièce arrive : la source elle-même si aucun point n'est saisi. */
  delivery: { splId: string; name: string | null; isSource: boolean };
  stockKind: BrandSourceStockKind | null;
  surchargeCents: number | null;
  /** Mode d'approvisionnement de la fiche d'arrivée (spl_supply_mode). */
  supplyMode: string | null;
  /** Repli si la pièce n'est pas au dépôt, porté par la fiche source. */
  fallbackMode: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type BrandSourceIssueCode =
  | 'duplicate_rank'
  | 'unknown_supplier'
  | 'inactive_source'
  | 'inactive_delivery'
  | 'hidden_link'
  | 'negative_surcharge'
  | 'missing_stock_kind';

export interface BrandSourceIssue {
  code: BrandSourceIssueCode;
  rank: number;
  linkId: string;
  message: string;
}

/** Statut d'une fiche utilisable comme source ou point de livraison. */
export const ACTIVE_SUPPLIER_STATUS = 'actif';

/**
 * Sources classées de la marque, par rang croissant (à rang égal, par id de
 * lien, pour un ordre stable). Les liens sans rang ne sont pas des sources.
 * Les anomalies sont rendues, jamais corrigées : rang en double, source ou
 * point de livraison non actif ou inconnu, lien masqué, surcoût négatif,
 * nature absente. L'écriture (`supplier_brand_sources_put`) refuse déjà ces
 * cas ; la lecture les signale pour une donnée écrite hors de l'écran.
 */
export function orderBrandSources(
  links: readonly BrandSourceLinkInput[],
  cards: readonly BrandSourceCardInput[],
): { sources: ResolvedBrandSource[]; issues: BrandSourceIssue[] } {
  const bySplId = new Map(cards.map((c) => [c.splId, c]));
  const ranked = links
    .filter(
      (l): l is BrandSourceLinkInput & { rank: number } => l.rank !== null,
    )
    .slice()
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.linkId.localeCompare(b.linkId, 'en', { numeric: true }),
    );

  const issues: BrandSourceIssue[] = [];
  const seenRanks = new Set<number>();
  const sources = ranked.map((link): ResolvedBrandSource => {
    const issue = (code: BrandSourceIssueCode, message: string) =>
      issues.push({ code, rank: link.rank, linkId: link.linkId, message });

    if (seenRanks.has(link.rank))
      issue('duplicate_rank', `Rang ${link.rank} porté par plusieurs sources`);
    seenRanks.add(link.rank);

    const source = bySplId.get(link.splId);
    if (!source) issue('unknown_supplier', `Fournisseur ${link.splId} inconnu`);
    else if (source.status !== ACTIVE_SUPPLIER_STATUS)
      issue(
        'inactive_source',
        `Source ${link.splId} non active (${source.status ?? 'sans statut'})`,
      );

    const deliveryId = link.deliverySplId ?? link.splId;
    const delivery = bySplId.get(deliveryId);
    if (link.deliverySplId !== null) {
      if (!delivery)
        issue('unknown_supplier', `Point de livraison ${deliveryId} inconnu`);
      else if (delivery.status !== ACTIVE_SUPPLIER_STATUS)
        issue(
          'inactive_delivery',
          `Point de livraison ${deliveryId} non actif (${delivery.status ?? 'sans statut'})`,
        );
    }

    if (!link.displayed) issue('hidden_link', `Lien ${link.linkId} masqué`);
    if (link.surchargeCents !== null && link.surchargeCents < 0)
      issue('negative_surcharge', `Surcoût négatif (${link.surchargeCents})`);
    const stockKind = isStockKind(link.stockKind) ? link.stockKind : null;
    if (stockKind === null)
      issue('missing_stock_kind', 'Nature stock ou commande absente');

    return {
      rank: link.rank,
      linkId: link.linkId,
      source: {
        splId: link.splId,
        name: source?.name ?? null,
        type: source?.type ?? null,
      },
      delivery: {
        splId: deliveryId,
        name: delivery?.name ?? null,
        isSource: deliveryId === link.splId,
      },
      stockKind,
      surchargeCents: link.surchargeCents,
      supplyMode: delivery?.supplyMode ?? null,
      fallbackMode: source?.fallbackMode ?? null,
      updatedAt: link.updatedAt ?? null,
      updatedBy: link.updatedBy ?? null,
    };
  });
  return { sources, issues };
}

function isStockKind(v: string | null): v is BrandSourceStockKind {
  return (BRAND_SOURCE_STOCK_KINDS as readonly string[]).includes(v ?? '');
}
