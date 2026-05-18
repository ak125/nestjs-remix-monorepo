// backend/src/modules/rm/services/gamme-clusters.const.ts
/**
 * Clusters de gammes (V1 statique).
 *
 * - `parent_pg_id` : pg_id de la gamme "parent système" (ex. système freinage complet).
 *   Si null, on ignore le tier 2 pour ce cluster.
 * - `member_pg_ids` : gammes du même cluster (tier 1).
 *
 * Pre-merge action : confirmer les member_pg_ids avec le pôle catalogue via :
 *   SELECT pg_id, pg_name FROM pieces_gamme WHERE pg_name ILIKE '%frein%' ORDER BY pg_name;
 *
 * Une gamme absente de tous les clusters retombe sur le tier 3 (popularité catalogue).
 * Dégradation gracieuse : pas d'erreur, juste un ranking moins pertinent.
 *
 * V1.5 : envisager une colonne `pg_cluster TEXT` dans `pieces_gamme` si la liste devient ingérable.
 */
export interface GammeCluster {
  readonly parent_pg_id: number | null;
  readonly member_pg_ids: readonly number[];
}

export const GAMME_CLUSTERS: Readonly<Record<string, GammeCluster>> = Object.freeze({
  // Cluster freinage arrière (pg_id 3859 confirmé : Kit de freins arrière)
  'freinage-arriere': {
    parent_pg_id: null, // à confirmer pre-merge (gamme "système freinage" si existe)
    member_pg_ids: [3859],
  },
  // Cluster freinage avant
  'freinage-avant': {
    parent_pg_id: null,
    member_pg_ids: [],
  },
  // Autres clusters macro à valider pre-merge :
  'allumage': { parent_pg_id: null, member_pg_ids: [] },
  'distribution': { parent_pg_id: null, member_pg_ids: [] },
  'filtration': { parent_pg_id: null, member_pg_ids: [] },
  'refroidissement': { parent_pg_id: null, member_pg_ids: [] },
  'suspension': { parent_pg_id: null, member_pg_ids: [] },
  'transmission': { parent_pg_id: null, member_pg_ids: [] },
});

/**
 * Renvoie le cluster auquel appartient un pg_id, ou null si aucun match.
 */
export function findClusterFor(pg_id: number): GammeCluster | null {
  for (const cluster of Object.values(GAMME_CLUSTERS)) {
    if (cluster.member_pg_ids.includes(pg_id)) {
      return cluster;
    }
  }
  return null;
}
