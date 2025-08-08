import { Injectable } from '@nestjs/common';

export interface Order {
  ord_id: string;
  ord_total_ttc: string;
  ord_amount_ttc?: string;
  ord_is_pay: string;
  ord_date: string;
  ord_info?: string;
  customer?: {
    cst_fname?: string;
    cst_name?: string;
  };
}

export interface OrdersResult {
  orders: Order[];
  total: number;
}

export interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalRevenue: number;
}

@Injectable()
export class OrdersService {
  async findAll(options: {
    page: number;
    limit: number;
  }): Promise<OrdersResult> {
    // Pour l'instant, retournons des données de test
    // À remplacer par la vraie logique de base de données

    const testOrders: Order[] = [
      {
        ord_id: '1',
        ord_total_ttc: '299.99',
        ord_is_pay: '1',
        ord_date: '2025-07-24T10:30:00Z',
        ord_info: JSON.stringify({
          payment_gateway: 'stripe',
          transaction_id: 'txn_1234567890',
        }),
        customer: {
          cst_fname: 'Jean',
          cst_name: 'Dupont',
        },
      },
      {
        ord_id: '2',
        ord_total_ttc: '159.50',
        ord_is_pay: '0',
        ord_date: '2025-07-24T09:15:00Z',
        ord_info: JSON.stringify({
          payment_gateway: 'paypal',
          transaction_id: 'txn_0987654321',
        }),
        customer: {
          cst_fname: 'Marie',
          cst_name: 'Martin',
        },
      },
      {
        ord_id: '3',
        ord_total_ttc: '89.99',
        ord_is_pay: '1',
        ord_date: '2025-07-24T08:45:00Z',
        ord_info: JSON.stringify({
          payment_gateway: 'stripe',
          transaction_id: 'txn_1122334455',
        }),
        customer: {
          cst_fname: 'Pierre',
          cst_name: 'Durand',
        },
      },
      {
        ord_id: '4',
        ord_total_ttc: '450.00',
        ord_is_pay: '1',
        ord_date: '2025-07-23T16:20:00Z',
        ord_info: JSON.stringify({
          payment_gateway: 'cyberplus',
          transaction_id: 'txn_5566778899',
        }),
        customer: {
          cst_fname: 'Sophie',
          cst_name: 'Bernard',
        },
      },
      {
        ord_id: '5',
        ord_total_ttc: '75.25',
        ord_is_pay: '0',
        ord_date: '2025-07-23T14:10:00Z',
        ord_info: JSON.stringify({
          payment_gateway: 'paypal',
          transaction_id: 'txn_9988776655',
        }),
        customer: {
          cst_fname: 'Lucas',
          cst_name: 'Petit',
        },
      },
    ];

    const { page, limit } = options;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedOrders = testOrders.slice(startIndex, endIndex);

    return {
      orders: paginatedOrders,
      total: testOrders.length,
    };
  }

  async getStats(): Promise<OrderStats> {
    const allOrders = await this.findAll({ page: 1, limit: 1000 });

    const completedOrders = allOrders.orders.filter(
      (order) => order.ord_is_pay === '1',
    );
    const pendingOrders = allOrders.orders.filter(
      (order) => order.ord_is_pay === '0',
    );

    const totalRevenue = completedOrders.reduce((sum, order) => {
      return sum + parseFloat(order.ord_total_ttc || '0');
    }, 0);

    return {
      totalOrders: allOrders.total,
      completedOrders: completedOrders.length,
      pendingOrders: pendingOrders.length,
      totalRevenue,
    };
  }
}
