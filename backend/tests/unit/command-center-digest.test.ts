/**
 * Digest Command Center pour le superviseur Hermes — GET /api/internal/command-center/digest.
 *
 * Garanties :
 *   1. le digest respecte le contrat @repo/registry (borné, strict) ;
 *   2. il projette la réponse du cockpit, sans second calcul : mêmes rapports,
 *      actions « feu vert owner » seulement, sans `details`, ordre conservé ;
 *   3. le drapeau COMMAND_CENTER_MODE n'est jamais contourné : `disabled` → 404
 *      sans lecture, `light` → aucun rapport ni action.
 */
import { NotFoundException } from '@nestjs/common';
import {
  CommandCenterDigestSchema,
  DIGEST_MAX_OWNER_GO_ACTIONS,
} from '@repo/registry';
import { InternalCommandCenterController } from '../../src/modules/admin/controllers/internal-command-center.controller';
import type { OwnerActionV2 } from '../../src/modules/admin/services/command-center-action-rules/score-action';
import {
  toCommandCenterDigest,
  type CommandCenterResponse,
} from '../../src/modules/admin/services/command-center-reader.service';

function action(
  id: string,
  owner_go_required: boolean,
  score: number,
): OwnerActionV2 {
  return {
    id,
    title: `titre ${id}`,
    department: 'pricing',
    source: 'pricing',
    action_type: 'business',
    impact: 6,
    urgency: 6,
    data_confidence: 90,
    effort: 4,
    risk: 2,
    score,
    reason: `raison ${id}`,
    evidence: [`preuve ${id}`],
    next_step: `étape ${id}`,
    details: null,
    owner_go_required,
  };
}

const REPORT = {
  department: 'pricing',
  label: 'Prix',
  priority: 'P0' as const,
  period: { as_of: '2026-10-05T10:00:00.000Z', window_days: null },
  kpi: {
    id: 'margin_ok',
    label: null,
    measure: 'SANS_PRODUCTEUR' as const,
    value: null,
    unit: null,
    previous_value: null,
  },
  score: 'NON_MESURE' as const,
  evolution: 'INCONNUE' as const,
  evidence: ['preuve go-0'],
  gap: 'titre go-0',
  probable_cause: 'raison go-0',
  decision: 'IMPROVE' as const,
  risk: 'FAIBLE' as const,
  owner_go_required: true,
  next_evidence: 'étape go-0',
  open_action_ids: ['go-0'],
};

function response(
  over: Partial<CommandCenterResponse> = {},
): CommandCenterResponse {
  return {
    degraded: false,
    mode: 'full',
    generated_at: '2026-10-05T10:00:00.000Z',
    git_sha: 'abc123',
    stale_status: 'FRESH',
    validation_status: 'VALIDATED',
    global_status: {
      level: 'WARNING',
      verdict: 'PARTIAL_READY',
      reasons: ['r'],
    },
    action_queue: [],
    department_reports: [REPORT],
    ...over,
  } as unknown as CommandCenterResponse;
}

describe('toCommandCenterDigest', () => {
  const queue = [
    ...Array.from({ length: 12 }, (_, i) => action(`go-${i}`, true, 30 - i)),
    action('free-1', false, 40),
  ];
  queue[0] = {
    ...queue[0],
    details: [
      {
        url: '/x',
        page_kind: 'other',
        impressions: 1,
        clicks: 0,
        ctr: 0,
        position: null,
        next_step: 'n',
      },
    ],
  };

  it('respecte le contrat @repo/registry', () => {
    const digest = toCommandCenterDigest(response({ action_queue: queue }));
    expect(CommandCenterDigestSchema.parse(digest)).toEqual(digest);
  });

  it('feu vert owner seulement, borné, ordre conservé, total avant la borne', () => {
    const digest = toCommandCenterDigest(response({ action_queue: queue }));
    expect(digest.owner_go_actions_total).toBe(12);
    expect(digest.owner_go_actions).toHaveLength(DIGEST_MAX_OWNER_GO_ACTIONS);
    expect(digest.owner_go_actions.map((a) => a.id)).toEqual(
      Array.from({ length: DIGEST_MAX_OWNER_GO_ACTIONS }, (_, i) => `go-${i}`),
    );
  });

  it('retire les détails par URL', () => {
    const digest = toCommandCenterDigest(response({ action_queue: queue }));
    for (const a of digest.owner_go_actions)
      expect(a).not.toHaveProperty('details');
  });

  it('reprend les rapports et l’enveloppe du cockpit tels quels', () => {
    const digest = toCommandCenterDigest(response());
    expect(digest).toMatchObject({
      schema_version: 'command-center-digest.v1',
      mode: 'full',
      generated_at: '2026-10-05T10:00:00.000Z',
      department_reports: [REPORT],
      owner_go_actions_total: 0,
      owner_go_actions: [],
    });
  });

  it('mode light : aucun rapport ni action (projection de la réponse déjà dépouillée)', () => {
    const digest = toCommandCenterDigest(
      response({
        mode: 'light',
        department_reports: [],
        action_queue: [],
        git_sha: null,
      }),
    );
    expect(digest).toMatchObject({
      mode: 'light',
      department_reports: [],
      owner_go_actions: [],
    });
  });
});

describe('InternalCommandCenterController', () => {
  function make(mode: 'full' | 'light' | 'disabled') {
    const getCommandCenter = jest.fn().mockResolvedValue(response({ mode }));
    const reader = { getMode: () => mode, getCommandCenter } as never;
    return {
      controller: new InternalCommandCenterController(reader),
      getCommandCenter,
    };
  }

  it('disabled → 404, aucune lecture', async () => {
    const { controller, getCommandCenter } = make('disabled');
    await expect(controller.digest()).rejects.toBeInstanceOf(NotFoundException);
    expect(getCommandCenter).not.toHaveBeenCalled();
  });

  it('full → digest de la réponse du cockpit', async () => {
    const { controller, getCommandCenter } = make('full');
    const digest = await controller.digest();
    expect(getCommandCenter).toHaveBeenCalledTimes(1);
    expect(digest.department_reports).toEqual([REPORT]);
  });
});
