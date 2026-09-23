/**
 * Une erreur du client sur le panier doit répondre 4xx, pas 500.
 *
 * Épisode du 22/09/2026 : un scanner automatisé a obtenu trois 500 sur
 * `POST /api/cart/items`. Le `catch` du contrôleur convertissait toute erreur
 * autre qu'un `BadRequestException` en `OperationFailedException` (500), y
 * compris l'échec de validation Zod et les refus métier du service (produit
 * introuvable, pièce sans tarif vendable). Ces tests verrouillent la
 * séparation : erreur du client → 4xx transmis tel quel, défaillance interne
 * → 500 inchangé, sans détail interne exposé.
 */

// getAppConfig() lit process.env à la construction des services importés.
process.env.SUPABASE_URL ||= 'https://exemple.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'cle-de-service-factice';

import { BadRequestException, HttpException } from '@nestjs/common';
import {
  BusinessRuleException,
  DomainNotFoundException,
  ErrorCodes,
  OperationFailedException,
} from '@common/exceptions';
import type { CartService } from '../services/cart.service';
import type { CartDataService } from '../../../database/services/cart-data.service';
import type { StockService } from '../../products/services/stock.service';
import { CartItemsController } from './cart-items.controller';
import type { RequestWithUser } from './cart-controller.utils';

const PANIER = {
  items: [],
  stats: {
    totalQuantity: 1,
    subtotal: 10,
    total: 10,
    shippingCost: 0,
    promoDiscount: 0,
    consigne_total: 0,
  },
};

function sujet() {
  const cartDataService = {
    addCartItem: jest.fn().mockResolvedValue({ id: 'ligne-1' }),
    getCartWithMetadata: jest.fn().mockResolvedValue(PANIER),
    removeCartItem: jest.fn().mockResolvedValue(undefined),
    deleteCartItem: jest.fn().mockResolvedValue(undefined),
  };
  const cartService = {
    updateQuantity: jest.fn().mockResolvedValue(PANIER),
  };
  const controller = new CartItemsController(
    cartService as unknown as CartService,
    cartDataService as unknown as CartDataService,
    {} as StockService,
  );
  return { controller, cartDataService, cartService };
}

const req = {
  headers: {},
  sessionID: 'session-test',
  session: {},
} as unknown as RequestWithUser;

/** Exception levée par l'appel, pour en lire le statut HTTP. */
async function exceptionDe(appel: Promise<unknown>): Promise<HttpException> {
  try {
    await appel;
  } catch (e) {
    if (e instanceof HttpException) return e;
    throw e;
  }
  throw new Error('aucune exception levée');
}

describe('CartItemsController — ajout (POST /api/cart/items)', () => {
  it.each([
    ['sans identifiant produit', { quantity: 1 }],
    ['identifiant produit injecté', { product_id: `1'"2000`, quantity: 1 }],
    ['quantité non numérique', { product_id: 12345, quantity: 'beaucoup' }],
  ])(
    'répond 400 sur un corps invalide (%s), sans toucher au panier',
    async (_cas, corps) => {
      const { controller, cartDataService } = sujet();

      const erreur = await exceptionDe(controller.addItem(corps, req));

      expect(erreur).toBeInstanceOf(BadRequestException);
      expect(erreur.getStatus()).toBe(400);
      // Même forme de réponse que `ZodValidationPipe`.
      expect(erreur.getResponse()).toMatchObject({
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String),
          }),
        ]),
      });
      expect(cartDataService.addCartItem).not.toHaveBeenCalled();
    },
  );

  it('transmet le 404 du service quand le produit est introuvable', async () => {
    const { controller, cartDataService } = sujet();
    cartDataService.addCartItem.mockRejectedValue(
      new DomainNotFoundException({
        code: ErrorCodes.CART.PRODUCT_NOT_FOUND,
        message: 'Produit 999 introuvable',
      }),
    );

    const erreur = await exceptionDe(
      controller.addItem({ product_id: 999, quantity: 1 }, req),
    );

    expect(erreur.getStatus()).toBe(404);
    expect(erreur).toMatchObject({ code: ErrorCodes.CART.PRODUCT_NOT_FOUND });
  });

  it('transmet le 422 du service quand la pièce n’a pas de tarif vendable', async () => {
    const { controller, cartDataService } = sujet();
    cartDataService.addCartItem.mockRejectedValue(
      new BusinessRuleException({
        code: ErrorCodes.CART.NOT_SELLABLE,
        message: "La pièce 123 n'a pas de prix disponible à la vente",
      }),
    );

    const erreur = await exceptionDe(
      controller.addItem({ product_id: 123, quantity: 1 }, req),
    );

    expect(erreur.getStatus()).toBe(422);
    expect(erreur).toMatchObject({ code: ErrorCodes.CART.NOT_SELLABLE });
  });

  it('garde un 500 générique sur une défaillance interne, sans en exposer le détail', async () => {
    const { controller, cartDataService } = sujet();
    cartDataService.addCartItem.mockRejectedValue(
      new Error('Redis injoignable'),
    );

    const erreur = await exceptionDe(
      controller.addItem({ product_id: 123, quantity: 1 }, req),
    );

    expect(erreur).toBeInstanceOf(OperationFailedException);
    expect(erreur.getStatus()).toBe(500);
    expect(erreur.message).not.toContain('Redis');
  });

  it('renvoie le panier quand l’ajout réussit', async () => {
    const { controller, cartDataService } = sujet();

    const reponse = await controller.addItem(
      { product_id: 123, quantity: 2 },
      req,
    );

    expect(reponse).toMatchObject({ success: true, productId: 123 });
    expect(cartDataService.addCartItem).toHaveBeenCalledTimes(1);
  });
});

describe('CartItemsController — quantité (PUT /api/cart/items/:itemId)', () => {
  it.each([
    ['quantité négative', { quantity: -1 }],
    ['quantité absente', {}],
  ])('répond 400 sur un corps invalide (%s)', async (_cas, corps) => {
    const { controller, cartService } = sujet();

    const erreur = await exceptionDe(
      controller.updateItem('ligne-1', corps, req),
    );

    expect(erreur).toBeInstanceOf(BadRequestException);
    expect(erreur.getStatus()).toBe(400);
    expect(cartService.updateQuantity).not.toHaveBeenCalled();
  });

  it('transmet le 400 « article introuvable dans le panier » du service', async () => {
    const { controller, cartService } = sujet();
    cartService.updateQuantity.mockRejectedValue(
      new BadRequestException('Article introuvable dans le panier'),
    );

    const erreur = await exceptionDe(
      controller.updateItem('ligne-1', { quantity: 2 }, req),
    );

    expect(erreur.getStatus()).toBe(400);
  });

  it('garde un 500 générique sur une défaillance interne', async () => {
    const { controller, cartService } = sujet();
    cartService.updateQuantity.mockRejectedValue(new Error('timeout'));

    const erreur = await exceptionDe(
      controller.updateItem('ligne-1', { quantity: 2 }, req),
    );

    expect(erreur).toBeInstanceOf(OperationFailedException);
    expect(erreur.getStatus()).toBe(500);
  });
});

describe('CartItemsController — suppression (DELETE /api/cart/items/:itemId)', () => {
  it('répond 400 sur un identifiant vide', async () => {
    const { controller } = sujet();

    const erreur = await exceptionDe(controller.removeItem('  ', req));

    expect(erreur.getStatus()).toBe(400);
  });

  it('garde un 500 générique sur une défaillance interne', async () => {
    const { controller, cartDataService } = sujet();
    cartDataService.removeCartItem.mockRejectedValue(new Error('timeout'));

    const erreur = await exceptionDe(controller.removeItem('123', req));

    expect(erreur).toBeInstanceOf(OperationFailedException);
    expect(erreur.getStatus()).toBe(500);
  });
});
