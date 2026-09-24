/**
 * OrderActionsController (admin) — expédition et annulation ne déclenchent
 * qu'un seul e-mail client.
 *
 * shipOrder / cancelOrder émettent ORDER_EVENTS.SHIPPED / CANCELLED, que
 * OrderEmailListener transforme en e-mail. Le contrôleur envoyait en plus
 * l'e-mail directement : tant que le listener était cassé, cela masquait le
 * défaut ; une fois le listener réparé, le client en aurait reçu deux.
 *
 * @see backend/src/modules/orders/controllers/order-actions.controller.ts
 * @see backend/src/modules/orders/listeners/order-email.listener.ts
 */

import { OrderActionsController } from '../../src/modules/orders/controllers/order-actions.controller';

function makeController() {
  const orderActionsService = {
    shipOrder: jest.fn().mockResolvedValue({
      success: true,
      newStatus: '4',
      trackingNumber: 'T',
    }),
    cancelOrder: jest
      .fn()
      .mockResolvedValue({ success: true, newStatus: '6', reason: 'r' }),
    getOrder: jest.fn(),
    getCustomer: jest.fn(),
  };
  const mailService = {
    sendShippingNotification: jest.fn(),
    sendCancellationEmail: jest.fn(),
  };
  const controller = new OrderActionsController(
    orderActionsService as never,
    mailService as never,
  );
  return { controller, orderActionsService, mailService };
}

describe('OrderActionsController — un seul e-mail par action', () => {
  it('expédition : délègue au service, sans e-mail direct', async () => {
    const { controller, orderActionsService, mailService } = makeController();

    const res = await controller.shipOrder('ORD-1', {
      trackingNumber: 'TRACK-1',
    });

    expect(res.success).toBe(true);
    expect(orderActionsService.shipOrder).toHaveBeenCalledWith(
      'ORD-1',
      'TRACK-1',
    );
    expect(mailService.sendShippingNotification).not.toHaveBeenCalled();
  });

  it('annulation : délègue au service, sans e-mail direct', async () => {
    const { controller, orderActionsService, mailService } = makeController();

    const res = await controller.cancelOrder('ORD-1', { reason: 'Rupture' });

    expect(res.success).toBe(true);
    expect(orderActionsService.cancelOrder).toHaveBeenCalledWith(
      'ORD-1',
      'Rupture',
    );
    expect(mailService.sendCancellationEmail).not.toHaveBeenCalled();
  });
});
