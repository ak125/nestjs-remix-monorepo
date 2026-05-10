import {
  SeoRoleTemplateSelector,
  type SeoR8MetaSlot,
} from '../seo-role-template-selector.service';
import type { SeoSwitchSelector } from '../seo-switch-selector.service';

/**
 * Stub minimal de SeoSwitchSelector qui retourne une variant fixe (ou null
 * pour tester le fallback). On capture aussi les inputs pour vérifier que
 * le seed `surfaceKey` est bien salé par slot.
 */
function makeStubSwitchSelector(
  variantToReturn: Record<string, unknown> | null,
) {
  const callLog: Array<{
    family: string;
    where: Record<string, unknown>;
    seed: Record<string, unknown>;
  }> = [];
  return {
    stub: {
      pickVariant: async (input: {
        family: string;
        where: Record<string, unknown>;
        seed: Record<string, unknown>;
      }) => {
        callLog.push({
          family: input.family,
          where: input.where,
          seed: input.seed,
        });
        return variantToReturn;
      },
    } as unknown as SeoSwitchSelector,
    callLog,
  };
}

describe('SeoRoleTemplateSelector', () => {
  it('renvoie {id, rendered} avec template substitué et tronqué à srtp_max_length', async () => {
    const { stub } = makeStubSwitchSelector({
      srtp_id: '11111111-1111-1111-1111-111111111111',
      srtp_template:
        'Pièces {brand} {model} {type} {power}ch — Catalogue compatible',
      srtp_max_length: 75,
    });
    const selector = new SeoRoleTemplateSelector(stub);

    const result = await selector.pick({
      role: 'R8_VEHICLE',
      slot: 'meta_title',
      seed: { vehicleId: 12345 },
      placeholders: {
        brand: 'Renault',
        model: 'Clio III',
        type: '1.5 dCi',
        power: '90',
      },
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(result!.rendered).toBe(
      'Pièces Renault Clio III 1.5 dCi 90ch — Catalogue compatible',
    );
    expect(result!.rendered.length).toBeLessThanOrEqual(75);
  });

  it('renvoie null si pickVariant retourne null (pool vide / erreur DB)', async () => {
    const { stub } = makeStubSwitchSelector(null);
    const selector = new SeoRoleTemplateSelector(stub);

    const result = await selector.pick({
      role: 'R8_VEHICLE',
      slot: 'meta_title',
      seed: { vehicleId: 999 },
      placeholders: { brand: 'X' },
    });

    expect(result).toBeNull();
  });

  it('renvoie null si srtp_template est null (type narrowing safety)', async () => {
    const { stub } = makeStubSwitchSelector({
      srtp_id: '11111111-1111-1111-1111-111111111111',
      srtp_template: null, // ← guard explicite contre String(null)='"null"' literal
      srtp_max_length: 75,
    });
    const selector = new SeoRoleTemplateSelector(stub);

    const result = await selector.pick({
      role: 'R8_VEHICLE',
      slot: 'meta_title',
      seed: { vehicleId: 12345 },
      placeholders: { brand: 'Renault' },
    });

    expect(result).toBeNull();
  });

  it('sale le surfaceKey par slot — entropie indépendante par slot', async () => {
    const { stub, callLog } = makeStubSwitchSelector({
      srtp_id: '00000000-0000-0000-0000-000000000000',
      srtp_template: 'X',
      srtp_max_length: null,
    });
    const selector = new SeoRoleTemplateSelector(stub);

    const slots: SeoR8MetaSlot[] = ['meta_title', 'meta_description'];
    for (const slot of slots) {
      await selector.pick({
        role: 'R8_VEHICLE',
        slot,
        seed: { vehicleId: 42 },
        placeholders: {},
      });
    }

    const surfaceKeys = callLog.map((c) => c.seed.surfaceKey);
    expect(surfaceKeys).toEqual([
      'R8_VEHICLE:meta_title',
      'R8_VEHICLE:meta_description',
    ]);
    // Doivent être distincts pour entropie indépendante par slot
    expect(new Set(surfaceKeys).size).toBe(2);
  });

  it('passe role=R8_VEHICLE et status=active dans le where', async () => {
    const { stub, callLog } = makeStubSwitchSelector({
      srtp_id: '00000000-0000-0000-0000-000000000000',
      srtp_template: 'X',
      srtp_max_length: null,
    });
    const selector = new SeoRoleTemplateSelector(stub);

    await selector.pick({
      role: 'R8_VEHICLE',
      slot: 'meta_title',
      seed: { vehicleId: 1 },
      placeholders: {},
    });

    expect(callLog[0].where).toEqual({
      srtp_role: 'R8_VEHICLE',
      srtp_slot: 'meta_title',
      srtp_lang: 'fr',
      srtp_status: 'active',
    });
  });

  it('respecte le cap srtp_max_length sur le rendu', async () => {
    const { stub } = makeStubSwitchSelector({
      srtp_id: '00000000-0000-0000-0000-000000000000',
      srtp_template:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      srtp_max_length: 30,
    });
    const selector = new SeoRoleTemplateSelector(stub);
    const result = await selector.pick({
      role: 'R8_VEHICLE',
      slot: 'meta_title',
      seed: { vehicleId: 1 },
      placeholders: {},
    });
    expect(result!.rendered.length).toBeLessThanOrEqual(30);
  });
});
