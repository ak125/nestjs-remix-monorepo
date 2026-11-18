/**
 * Mandat BM — frontière d'accès des routes de facturation.
 *
 * Admin `api/admin/orders/:orderId/billing/*` : AuthenticatedGuard +
 * PermissionsGuard, permission par route. Client `api/orders/:orderId/
 * invoice.pdf` : AuthenticatedGuard, propriétaire seul (contrôle dans le
 * service), 404 tant que le drapeau est éteint.
 *
 * La carte route → permission est EXHAUSTIVE : une route ajoutée sans
 * classement fait échouer le test.
 */
import 'reflect-metadata';
import {
  BadRequestException,
  NotFoundException,
  RequestMethod,
  UnauthorizedException,
  type Type,
} from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { REQUIRE_PERMISSION_KEY } from '../../src/auth/decorators/require-permission.decorator';
import {
  OrderBillingAdminController,
  OrderInvoiceCustomerController,
} from '../../src/modules/orders/controllers/order-billing.controller';

const GUARDS_METADATA = '__guards__';

function routes(controller: Type<unknown>) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter(
      (n) =>
        n !== 'constructor' &&
        Reflect.getMetadata(METHOD_METADATA, proto[n] as object) !== undefined,
    )
    .map((n) => ({
      name: n,
      method: Reflect.getMetadata(METHOD_METADATA, proto[n] as object),
      path: Reflect.getMetadata(PATH_METADATA, proto[n] as object),
      permission: Reflect.getMetadata(
        REQUIRE_PERMISSION_KEY,
        proto[n] as object,
      ),
      guards: Reflect.getMetadata(GUARDS_METADATA, proto[n] as object),
    }));
}

describe('routes de facturation (mandat BM)', () => {
  it('admin : gardes de classe et permission par route (carte exhaustive)', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, OrderBillingAdminController),
    ).toBe('api/admin/orders');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, OrderBillingAdminController),
    ).toEqual([AuthenticatedGuard, PermissionsGuard]);
    const table = routes(OrderBillingAdminController).map(
      ({ method, path, permission, guards }) => [
        method,
        path,
        permission,
        guards,
      ],
    );
    expect(table).toEqual([
      // Complément BM n° 2 : marques « paiement annulé / remboursé ».
      [RequestMethod.GET, 'billing/payment-voids', 'canValidate', undefined],
      [
        RequestMethod.GET,
        ':orderId/billing/payment-void',
        'canValidate',
        undefined,
      ],
      [RequestMethod.GET, ':orderId/billing', 'canMarkPaid', undefined],
      [
        RequestMethod.POST,
        ':orderId/billing/reduction',
        'canMarkPaid',
        undefined,
      ],
      [
        RequestMethod.POST,
        ':orderId/billing/supplement',
        'canCreateOrders',
        undefined,
      ],
      [
        RequestMethod.POST,
        ':orderId/billing/capture-state',
        'canMarkPaid',
        undefined,
      ],
      [
        RequestMethod.POST,
        ':orderId/billing/issue-invoice',
        'canShip',
        undefined,
      ],
      [
        RequestMethod.GET,
        ':orderId/billing/invoice.pdf',
        'canMarkPaid',
        undefined,
      ],
    ]);
  });

  it('client : connecté obligatoire, deux routes en lecture', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, OrderInvoiceCustomerController),
    ).toBe('api/orders');
    expect(
      Reflect.getMetadata(GUARDS_METADATA, OrderInvoiceCustomerController),
    ).toEqual([AuthenticatedGuard]);
    expect(
      routes(OrderInvoiceCustomerController).map((r) => [r.method, r.path]),
    ).toEqual([
      [RequestMethod.GET, ':orderId/invoice'],
      [RequestMethod.GET, ':orderId/invoice.pdf'],
    ]);
  });

  describe('client : comportement', () => {
    const res = () => {
      const headers: Record<string, string> = {};
      return {
        headers,
        setHeader: (k: string, v: string) => (headers[k] = v),
        send: jest.fn(),
      };
    };

    it('sans utilisateur : 401', async () => {
      const ctrl = new OrderInvoiceCustomerController({
        isEnabled: () => true,
        renderPdf: jest.fn(),
      } as never);
      await expect(
        ctrl.invoicePdf('ORD-1', {} as never, res() as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('drapeau éteint : 404, aucun rendu', async () => {
      const renderPdf = jest.fn();
      const ctrl = new OrderInvoiceCustomerController({
        isEnabled: () => false,
        renderPdf,
      } as never);
      await expect(
        ctrl.invoicePdf(
          'ORD-1',
          { user: { id: 81500 } } as never,
          res() as never,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(renderPdf).not.toHaveBeenCalled();
    });

    it('numéro de facture : 401 sans utilisateur, sinon délégué au service', async () => {
      const findCustomerInvoice = jest
        .fn()
        .mockResolvedValue({ invoiceNumber: 'F2026-000001', issuedAt: null });
      const ctrl = new OrderInvoiceCustomerController({
        findCustomerInvoice,
      } as never);
      await expect(ctrl.invoice('ORD-1', {} as never)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        ctrl.invoice('ORD-1', { user: { id: 81500 } } as never),
      ).resolves.toEqual({
        invoice: { invoiceNumber: 'F2026-000001', issuedAt: null },
      });
      expect(findCustomerInvoice).toHaveBeenCalledWith('ORD-1', '81500');
    });

    it('rend le PDF du client connecté (contrôle propriétaire délégué)', async () => {
      const renderPdf = jest.fn().mockResolvedValue({
        filename: 'facture-F2026-000001.pdf',
        content: Buffer.from('%PDF-1.4'),
      });
      const ctrl = new OrderInvoiceCustomerController({
        isEnabled: () => true,
        renderPdf,
      } as never);
      const r = res();
      await ctrl.invoicePdf(
        'ORD-1',
        { user: { id: 81500 } } as never,
        r as never,
      );
      expect(renderPdf).toHaveBeenCalledWith('ORD-1', '81500');
      expect(r.headers['Content-Type']).toBe('application/pdf');
      expect(r.headers['Content-Disposition']).toBe(
        'attachment; filename="facture-F2026-000001.pdf"',
      );
      expect(r.headers['Cache-Control']).toBe('private, no-store');
    });
  });

  describe('admin : validation des saisies', () => {
    const billing = {
      recordReduction: jest.fn().mockResolvedValue({}),
      requestSupplement: jest.fn().mockResolvedValue({}),
      recordCaptureState: jest.fn().mockResolvedValue({}),
    };
    const ctrl = new OrderBillingAdminController(billing as never);
    const req = { user: { id: 7 } } as never;

    beforeEach(() => jest.clearAllMocks());

    it('montant en euros (virgule ou point) → centimes, motif rogné', async () => {
      await ctrl.recordReduction(
        'ORD-1',
        { amountTtc: '12,5', reason: '  Moins cher  ' },
        req,
      );
      expect(billing.recordReduction).toHaveBeenCalledWith(
        'ORD-1',
        { amountTtcCents: 1250, reason: 'Moins cher' },
        '7',
      );
      await ctrl.requestSupplement(
        'ORD-1',
        { amountTtc: 9.99, reason: 'Plus cher' },
        req,
      );
      expect(billing.requestSupplement).toHaveBeenCalledWith(
        'ORD-1',
        { amountTtcCents: 999, reason: 'Plus cher' },
        '7',
      );
    });

    it.each([
      [{ amountTtc: '0', reason: 'abc' }],
      [{ amountTtc: '-5', reason: 'abc' }],
      [{ amountTtc: '1.234', reason: 'abc' }],
      [{ amountTtc: '12', reason: 'ab' }],
      [{ amountTtc: '12' }],
      [{ amountTtc: '12', reason: 'abc', extra: 1 }],
    ])('refuse %j (400 avant tout appel)', (body) => {
      expect(() => ctrl.recordReduction('ORD-1', body, req)).toThrow(
        BadRequestException,
      );
      expect(billing.recordReduction).not.toHaveBeenCalled();
    });

    it('état « captured » exige le montant encaissé', async () => {
      expect(() =>
        ctrl.recordCaptureState('ORD-1', { state: 'captured' }, req),
      ).toThrow(BadRequestException);
      expect(() =>
        ctrl.recordCaptureState('ORD-1', { state: 'paid' }, req),
      ).toThrow(BadRequestException);
      await ctrl.recordCaptureState(
        'ORD-1',
        { state: 'captured', capturedAmountTtc: '109,90' },
        req,
      );
      expect(billing.recordCaptureState).toHaveBeenCalledWith(
        'ORD-1',
        { state: 'captured', capturedAmountCents: 10990 },
        '7',
      );
    });
  });
});
