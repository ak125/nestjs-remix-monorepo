/**
 * Tests P2-R3-D — chaîne de décision DARK du consumer R3.
 *
 * Prouve l'ORDRE imposé (entityKey → master flag → allowlist rôle+entité → reader → mapper →
 * ready → projectionStatus) et surtout l'invariant : master flag OFF **ou** paire non allowlistée
 * ⇒ **0 appel RPC**. Les flags sont OFF par défaut → tout le monde reste sur le legacy.
 */
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from '@config/feature-flags.service';
import { PACK_DEFINITIONS } from '@config/conseil-pack.constants';
import { SeoProjectionReaderService } from '@modules/seo-projection/seo-projection-reader.service';
import type { ProjectionEnvelope } from '@modules/seo-projection/seo-projection-reader.service';
import type { R3InvalidEntry } from '@modules/seo-projection/projection-r3.mapper';
import {
  classifyMapperFallback,
  R3ProjectionDecisionService,
  R3_PROJECTION_ROLE,
} from './r3-projection-decision.service';

const PILOT_ALIAS = 'filtre-a-huile';
const PILOT_ENTITY_KEY = `gamme:${PILOT_ALIAS}`;
const PILOT_TOKEN = `${R3_PROJECTION_ROLE}@${PILOT_ENTITY_KEY}`;

/** Bloc R3 conforme au contrat d'export (exports-seo.schema.json v1.1.0). */
function r3Block(
  section: string,
  content_md: string,
  source_ids: string[] = ['db:pieces_gamme'],
  truth_level = 'db_owned',
) {
  return {
    role: R3_PROJECTION_ROLE,
    content: {
      content_md,
      source_ids,
      truth_level,
      section,
      usefulness_target: null,
    },
  };
}

/** Enveloppe couvrant TOUTES les sections requises du pack `standard`. */
function completeEnvelope(): ProjectionEnvelope {
  return {
    entity_id: PILOT_ENTITY_KEY,
    entity_type: 'gamme',
    slug: PILOT_ALIAS,
    facts: [],
    blocks: PACK_DEFINITIONS.standard.requiredSections.map((s) =>
      r3Block(s, `# ${s}\n\nContenu **verbatim** de ${s}.`),
    ) as ProjectionEnvelope['blocks'],
  };
}

describe('R3ProjectionDecisionService (P2-R3-D, dark)', () => {
  let service: R3ProjectionDecisionService;
  let reader: { readActiveProjection: jest.Mock };
  let flags: {
    seoProjectionReadV1: boolean;
    seoProjectionReadCanary: string[];
  };

  beforeEach(async () => {
    reader = { readActiveProjection: jest.fn() };
    flags = { seoProjectionReadV1: false, seoProjectionReadCanary: [] };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        R3ProjectionDecisionService,
        { provide: SeoProjectionReaderService, useValue: reader },
        { provide: FeatureFlagsService, useValue: flags },
      ],
    }).compile();

    service = moduleRef.get(R3ProjectionDecisionService);
  });

  // ── 1. Master flag ────────────────────────────────────────────────────────

  it('flag OFF (défaut) → legacy + MASTER_OFF, sans AUCUN appel RPC', async () => {
    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.projectionStatus).toBe('FALLBACK');
    expect(decision.servedBodySource).toBe('legacy');
    expect(decision.fallbackReason).toBe('MASTER_OFF');
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  it('flag OFF alors même que la paire est allowlistée → MASTER_OFF, 0 RPC (le master prime)', async () => {
    flags.seoProjectionReadCanary = [PILOT_TOKEN];

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.fallbackReason).toBe('MASTER_OFF');
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  // ── 2. Allowlist rôle + entité ────────────────────────────────────────────

  it('flag ON + allowlist vide → legacy + NOT_ALLOWLISTED, 0 RPC', async () => {
    flags.seoProjectionReadV1 = true;

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.projectionStatus).toBe('FALLBACK');
    expect(decision.servedBodySource).toBe('legacy');
    expect(decision.fallbackReason).toBe('NOT_ALLOWLISTED');
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  it('flag ON + autre ENTITÉ allowlistée → NOT_ALLOWLISTED, 0 RPC', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [
      `${R3_PROJECTION_ROLE}@gamme:plaquette-de-frein`,
    ];

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.fallbackReason).toBe('NOT_ALLOWLISTED');
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  it("un GO R4 sur la MÊME gamme n'active JAMAIS R3 (allowlist role-scoped)", async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [`R4_REFERENCE@${PILOT_ENTITY_KEY}`];

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.fallbackReason).toBe('NOT_ALLOWLISTED');
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  it("l'entité seule (sans rôle) dans l'allowlist n'active PAS la lecture", async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_ENTITY_KEY];

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.fallbackReason).toBe('NOT_ALLOWLISTED');
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  // ── 3. Identité canonique + appel du reader ───────────────────────────────

  it('paire allowlistée → lit avec entityKey namespacé `gamme:<alias>` et le rôle R3_CONSEILS', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    reader.readActiveProjection.mockResolvedValue({
      envelope: completeEnvelope(),
      degradeReason: null,
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(reader.readActiveProjection).toHaveBeenCalledTimes(1);
    expect(reader.readActiveProjection).toHaveBeenCalledWith(
      PILOT_ENTITY_KEY,
      R3_PROJECTION_ROLE,
    );
    expect(decision.entityKey).toBe(PILOT_ENTITY_KEY);
    expect(decision.projectionRole).toBe(R3_PROJECTION_ROLE);
  });

  // ── 4. Dégradations observables du reader ─────────────────────────────────

  it.each([
    ['RPC error: permission denied', 'RPC_ERROR'],
    ['RPC exception', 'RPC_EXCEPTION'],
    ['projection absente', 'PROJECTION_ABSENT'],
  ])(
    'dégradation reader « %s » → legacy + %s',
    async (degradeReason, expected) => {
      flags.seoProjectionReadV1 = true;
      flags.seoProjectionReadCanary = [PILOT_TOKEN];
      reader.readActiveProjection.mockResolvedValue({
        envelope: null,
        degradeReason,
      });

      const decision = await service.decide(PILOT_ALIAS);

      expect(decision.projectionStatus).toBe('FALLBACK');
      expect(decision.servedBodySource).toBe('legacy');
      expect(decision.fallbackReason).toBe(expected);
    },
  );

  // ── 5. Verdicts du mapper ─────────────────────────────────────────────────

  it('bloc hors contrat → legacy + MAPPER_INVALID (jamais de projection partielle)', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    const envelope = completeEnvelope();
    // content_md absent → block_contract_invalid côté mapper
    (envelope.blocks as unknown[])[0] = {
      role: R3_PROJECTION_ROLE,
      content: { section: 'S1', source_ids: [], truth_level: 'db_owned' },
    };
    reader.readActiveProjection.mockResolvedValue({
      envelope,
      degradeReason: null,
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.projectionStatus).toBe('FALLBACK');
    expect(decision.servedBodySource).toBe('legacy');
    expect(decision.fallbackReason).toBe('MAPPER_INVALID');
    expect(decision.invalidCount).toBeGreaterThan(0);
  });

  it('section requise du pack absente → legacy + MAPPER_INCOMPLETE', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    const envelope = completeEnvelope();
    envelope.blocks = (envelope.blocks as unknown[]).slice(
      1,
    ) as ProjectionEnvelope['blocks']; // retire S1 (requis)
    reader.readActiveProjection.mockResolvedValue({
      envelope,
      degradeReason: null,
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.projectionStatus).toBe('FALLBACK');
    expect(decision.servedBodySource).toBe('legacy');
    expect(decision.fallbackReason).toBe('MAPPER_INCOMPLETE');
  });

  it('enveloppe sans aucun bloc R3 → legacy + MAPPER_INCOMPLETE (jamais une page vide)', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    reader.readActiveProjection.mockResolvedValue({
      envelope: { ...completeEnvelope(), blocks: [] },
      degradeReason: null,
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.projectionStatus).toBe('FALLBACK');
    expect(decision.servedBodySource).toBe('legacy');
    expect(decision.fallbackReason).toBe('MAPPER_INCOMPLETE');
  });

  // ── 6. Chemin nominal + complétude via le pack `standard` ─────────────────

  it('projection complète (pack standard satisfait) → READY_FOR_RENDER, 0 fallback', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    reader.readActiveProjection.mockResolvedValue({
      envelope: completeEnvelope(),
      degradeReason: null,
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.projectionStatus).toBe('READY_FOR_RENDER');
    expect(decision.fallbackReason).toBeNull();
    // Prête ≠ servie : D n'a pas de renderer, le BODY reste legacy.
    expect(decision.servedBodySource).toBe('legacy');
    expect(decision.invalidCount).toBe(0);
    expect(decision.mappedCount).toBe(
      PACK_DEFINITIONS.standard.requiredSections.length,
    );
  });

  it('la complétude est jugée sur les sections requises du pack `standard`', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    // Une seule section présente : suffisant pour le mapper, PAS pour le pack.
    reader.readActiveProjection.mockResolvedValue({
      envelope: {
        ...completeEnvelope(),
        blocks: [r3Block('S1', '# S1')] as never,
      },
      degradeReason: null,
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.fallbackReason).toBe('MAPPER_INCOMPLETE');
    expect(decision.projectionStatus).toBe('FALLBACK');
    expect(decision.servedBodySource).toBe('legacy');
  });

  // ── 7. Caractérisation : 0 reformulation intermédiaire ────────────────────

  it('le DTO projeté transporte le content_md du mapper byte-for-byte', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    const envelope = completeEnvelope();
    reader.readActiveProjection.mockResolvedValue({
      envelope,
      degradeReason: null,
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.slots).not.toBeNull();
    for (const block of envelope.blocks as unknown as Array<{
      content: { section: string; content_md: string };
    }>) {
      expect(decision.slots?.[block.content.section].content_md).toBe(
        block.content.content_md,
      );
    }
  });

  it('aucun slot exposé quand le BODY servi est legacy (pas de fuite de projection partielle)', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    reader.readActiveProjection.mockResolvedValue({
      envelope: null,
      degradeReason: 'projection absente',
    });

    const decision = await service.decide(PILOT_ALIAS);

    expect(decision.slots).toBeNull();
  });

  // ── 8. Signal de ciblage (bypass cache) — sans RPC ────────────────────────

  it('isTargeted : false quand le flag est OFF, sans appel RPC', () => {
    flags.seoProjectionReadCanary = [PILOT_TOKEN];

    expect(service.isTargeted(PILOT_ALIAS)).toBe(false);
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  it('isTargeted : true seulement pour la paire exacte rôle+entité, sans appel RPC', () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];

    expect(service.isTargeted(PILOT_ALIAS)).toBe(true);
    expect(service.isTargeted('plaquette-de-frein')).toBe(false);
    expect(reader.readActiveProjection).not.toHaveBeenCalled();
  });

  // ── 9. Observabilité ──────────────────────────────────────────────────────

  it('journalise la décision avec les champs de diagnostic exigés', async () => {
    flags.seoProjectionReadV1 = true;
    flags.seoProjectionReadCanary = [PILOT_TOKEN];
    reader.readActiveProjection.mockResolvedValue({
      envelope: null,
      degradeReason: 'projection absente',
    });
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    await service.decide(PILOT_ALIAS);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_key: PILOT_ENTITY_KEY,
        projection_role: R3_PROJECTION_ROLE,
        projection_status: 'FALLBACK',
        served_body_source: 'legacy',
        fallback_reason: 'PROJECTION_ABSENT',
        mapped_count: 0,
        invalid_count: 0,
      }),
    );
    logSpy.mockRestore();
  });
});

// ── 10. Classification fail-closed des verdicts mapper (fonction pure) ──────
//
// Testée directement : `requiredSections` est typé `PlannableSection[]`, donc un
// `required_section_unknown` est INATTEIGNABLE via le pack canonique — le prouver au niveau du
// service exigerait de casser le typage. La fonction pure est le vrai point de contrat.
describe('classifyMapperFallback (fail-closed)', () => {
  const entry = (kind: R3InvalidEntry['kind']): R3InvalidEntry => ({
    kind,
    section: 'S1',
    detail: 'peu importe',
  });

  it('required_slot_missing uniquement → MAPPER_INCOMPLETE (seul vrai manque de contenu)', () => {
    expect(
      classifyMapperFallback([
        entry('required_slot_missing'),
        entry('required_slot_missing'),
      ]),
    ).toBe('MAPPER_INCOMPLETE');
  });

  it.each<[R3InvalidEntry['kind']]>([
    ['block_contract_invalid'],
    ['slot_collision'],
    ['required_section_unknown'],
  ])('%s → MAPPER_INVALID', (kind) => {
    expect(classifyMapperFallback([entry(kind)])).toBe('MAPPER_INVALID');
  });

  it('required_section_unknown = faute de CONFIGURATION, jamais un contenu manquant', () => {
    // Mélangé à de vrais manques de contenu, il doit continuer de dominer : sinon un
    // S2_DIAGNOSTIC mal orthographié se lirait comme « en attente de rédaction », et on
    // attendrait indéfiniment un contenu impossible à produire.
    expect(
      classifyMapperFallback([
        entry('required_slot_missing'),
        entry('required_section_unknown'),
      ]),
    ).toBe('MAPPER_INVALID');
  });

  it('aucune entrée invalide (ready=false inattendu) → MAPPER_INVALID, jamais INCOMPLETE', () => {
    expect(classifyMapperFallback([])).toBe('MAPPER_INVALID');
  });

  it('invalidité FUTURE inconnue → MAPPER_INVALID (fail-closed par défaut)', () => {
    const future = {
      kind: 'some_future_kind',
      section: 'S1',
      detail: '',
    } as unknown as R3InvalidEntry;
    expect(classifyMapperFallback([future])).toBe('MAPPER_INVALID');
  });
});
