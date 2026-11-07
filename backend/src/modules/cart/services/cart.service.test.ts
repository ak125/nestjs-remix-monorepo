import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import type { CartDataService } from '../../../database/services/cart-data.service';
import type { PromoService } from '../../promo/promo.service';

jest.mock('../../../database/services/cart-data.service');
jest.mock('../../promo/promo.service');

function subject(owner: string) {
  const item = { id: 'line-owned', product_id: '123', quantity: 2, price: 12 };
  let items = [item];
  const store = {
    getCartWithMetadata: jest.fn(async (key: string) => ({
      items: key === owner ? items : [],
    })),
    addCartItem: jest.fn(
      async (
        key: string,
        product: number,
        quantity: number,
        price: number,
        replace = false,
      ) => {
        if (key !== owner) throw new Error('Wrong cart owner');
        items = [
          { ...item, quantity: replace ? quantity : item.quantity + quantity },
        ];
      },
    ),
    deleteCartItem: jest.fn(async (id: string, key: string) => {
      if (key !== owner) throw new Error('Wrong cart owner');
      items = items.filter((entry) => entry.id !== id);
    }),
  };
  return {
    store,
    service: new CartService(
      {} as PromoService,
      store as unknown as CartDataService,
    ),
  };
}

describe('CartService quantity ownership', () => {
  it.each([1, 2, 4])(
    'updates the authenticated cart to %i despite a different session ID',
    async (quantity) => {
      const { service, store } = subject('customer-1');
      const result = await service.updateQuantity(
        'anonymous-session',
        'line-owned',
        quantity,
        'customer-1',
      );
      expect(result.items[0].quantity).toBe(quantity);
      expect(
        store.getCartWithMetadata.mock.calls.every(
          ([key]) => key === 'customer-1',
        ),
      ).toBe(true);
    },
  );
  it('removes only the authenticated cart line when quantity is zero', async () => {
    const { service, store } = subject('customer-1');
    expect(
      (
        await service.updateQuantity(
          'anonymous-session',
          'line-owned',
          0,
          'customer-1',
        )
      ).items,
    ).toEqual([]);
    expect(store.deleteCartItem).toHaveBeenCalledWith(
      'line-owned',
      'customer-1',
    );
    expect(store.addCartItem).not.toHaveBeenCalled();
  });
  it('keeps anonymous cart updates and deletion working', async () => {
    const { service } = subject('anonymous-session');
    expect(
      (await service.updateQuantity('anonymous-session', 'line-owned', 3))
        .items[0].quantity,
    ).toBe(3);
    expect(
      (await service.updateQuantity('anonymous-session', 'line-owned', 0))
        .items,
    ).toEqual([]);
  });
  it('rejects a line outside the current owner without writing', async () => {
    const { service, store } = subject('customer-1');
    await expect(
      service.updateQuantity(
        'anonymous-session',
        'line-owned',
        3,
        'customer-2',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.addCartItem).not.toHaveBeenCalled();
    expect(store.deleteCartItem).not.toHaveBeenCalled();
  });
});
