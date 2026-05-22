/**
 * OrderStatusService — Unit tests.
 *
 * F3 (audit runtime-truth 2026-05-22, governance-vault PR #301) : le doublon cassé
 * (enum modèle-colis faux `OrderLineStatusCode`, state-machine `updateLineStatus` sur
 * colonnes inexistantes, helpers + controller `/order-status/*` inutilisés) a été RETIRÉ.
 * SoT statut ligne = `OrderActionsService`. Seul `createStatusHistory` subsiste ici
 * (consommé par `OrdersService`) — c'est ce qui est testé.
 *
 * @see backend/src/modules/orders/services/order-status.service.ts
 */

import { OrderStatusService } from '../../src/modules/orders/services/order-status.service';

// ─── Chain mock builder ──────────────────────────────────────

function chainMock(result: { error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockResolvedValue(result);
  return chain;
}

// ─── Tests ───────────────────────────────────────────────────

describe('OrderStatusService.createStatusHistory', () => {
  let service: OrderStatusService;

  beforeEach(() => {
    service = new OrderStatusService();
  });

  it('insère un historique de statut commande (succès)', async () => {
    const chain = chainMock({ error: null });
    Object.defineProperty(service, 'supabase', {
      get: () => chain,
      configurable: true,
    });

    await expect(
      service.createStatusHistory(100, 2, 'test comment', 1),
    ).resolves.toBeUndefined();
    expect(chain.insert).toHaveBeenCalledTimes(1);
  });

  it('génère un commentaire par défaut depuis le libellé si absent', async () => {
    const chain = chainMock({ error: null });
    Object.defineProperty(service, 'supabase', {
      get: () => chain,
      configurable: true,
    });

    await service.createStatusHistory(100, 91);

    const payload = chain.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(String(payload.comment)).toContain('Annulée client');
    expect(payload.order_id).toBe(100);
    expect(payload.status).toBe(91);
  });

  it('propage l’erreur si l’insert échoue', async () => {
    const chain = chainMock({ error: { message: 'boom' } });
    Object.defineProperty(service, 'supabase', {
      get: () => chain,
      configurable: true,
    });

    await expect(service.createStatusHistory(100, 2)).rejects.toBeDefined();
  });
});
