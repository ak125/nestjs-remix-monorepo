/**
 * R6GuideService — mention « Vérifié par nos experts » (champ `sourceVerified`).
 *
 * Constat du 2026-11-11 : tous les guides marqués vérifiés en base le sont par
 * le pipeline qui les a produits. La mention n'est servie que pour une
 * vérification qui ne vient pas de ce pipeline. Aucun guide n'est retiré.
 *
 * Pas d'I/O réseau ; les deux constructeurs de payload sont appelés directement.
 */

import { R6GuideService } from './r6-guide.service';

type Row = Record<string, unknown>;
type Payload = { sourceVerified: boolean; sourceType: string | null };
type Builders = {
  buildV1Payload(page: unknown, row: Row, alias: string): Promise<Payload>;
  buildV2Payload(page: unknown, row: Row, alias: string): Promise<Payload>;
};

const service = new R6GuideService(
  {} as never,
  {} as never,
  { processLinkGamme: async (html: string) => html } as never,
  {} as never,
) as unknown as Builders;

const page = {
  pg_alias: 'disque-de-frein',
  pg_id: 82,
  title: 'Disque de frein',
};

const build = (version: 'v1' | 'v2', row: Row) =>
  version === 'v2'
    ? service.buildV2Payload(page, row, 'disque-de-frein')
    : service.buildV1Payload(page, row, 'disque-de-frein');

describe.each(['v1', 'v2'] as const)(
  'R6GuideService — sourceVerified (payload %s)',
  (version) => {
    it.each([
      {
        sgpg_source_type: 'rag',
        sgpg_source_verified_by: 'pipeline:rag-enrich',
      },
      { sgpg_source_type: 'rag-legacy', sgpg_source_verified_by: null },
      { sgpg_source_type: 'rag' },
      {
        sgpg_source_type: 'wiki',
        sgpg_source_verified_by: 'pipeline:rag-enrich',
      },
    ])(
      'marque posée par le pipeline producteur (%o) → non affichée',
      async (provenance) => {
        const payload = await build(version, {
          sgpg_source_verified: true,
          sgpg_source_ref: 'gammes/disque-de-frein.md',
          ...provenance,
        });

        expect(payload.sourceVerified).toBe(false);
        // Le guide reste servi, avec son libellé de source.
        expect(payload.sourceType).not.toBeNull();
      },
    );

    it.each([
      { sgpg_source_type: 'wiki', sgpg_source_verified_by: 'owner' },
      { sgpg_source_type: 'manual', sgpg_source_verified_by: null },
      { sgpg_source_type: 'pdf' },
    ])('vérification hors pipeline (%o) → affichée', async (provenance) => {
      const payload = await build(version, {
        sgpg_source_verified: true,
        ...provenance,
      });

      expect(payload.sourceVerified).toBe(true);
    });

    it.each([false, null, undefined, 'true', 1])(
      'marque absente ou non booléenne (%p) → non affichée',
      async (verified) => {
        const payload = await build(version, {
          sgpg_source_type: 'wiki',
          sgpg_source_verified: verified,
          sgpg_source_verified_by: 'owner',
        });

        expect(payload.sourceVerified).toBe(false);
      },
    );

    it('ligne sans aucune colonne de source → non affichée, sans erreur', async () => {
      const payload = await build(version, {});

      expect(payload.sourceVerified).toBe(false);
      expect(payload.sourceType).toBeNull();
    });
  },
);
