import { type PaymentMethod } from "../types/payment";

/**
 * Service côté serveur pour les paiements utilisateur
 */

export interface InitializePaymentParams {
  orderId: string;
  userId: string;
  paymentMethod: string;
  amount: number; // ✅ Phase 7: Montant total TTC (inclut consignes)
  consigneTotal?: number; // ✅ Phase 7: Montant des consignes
  returnUrl: string;
  ipAddress: string;
}

export interface PaymentInitializationResult {
  transactionId: string;
  formData?: Record<string, string>;
  gatewayUrl?: string;
  redirectUrl?: string;
}

/**
 * Initialise un paiement côté serveur
 */
export async function initializePayment(
  params: InitializePaymentParams
): Promise<PaymentInitializationResult> {
  try {
    console.log('🔄 Initializing payment:', params);

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Internal-Call': 'true',
      },
      body: JSON.stringify({
        orderId: params.orderId,
        userId: params.userId,
        amount: params.amount, // ✅ Phase 7: Montant total incluant consignes
        method: params.paymentMethod,
        currency: 'EUR',
        // ✅ Phase 7: Informations consignes
        consigne_total: params.consigneTotal || 0,
        returnUrl: params.returnUrl,
        cancelUrl: `${baseUrl}/checkout/payment/cancel`,
        notifyUrl: `${baseUrl}/api/payments/callback/cyberplus`,
        ipAddress: params.ipAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment initialization failed: ${response.statusText}`);
    }

    const paymentData = await response.json();

    // Le backend retourne déjà redirectData avec le formulaire
    if (paymentData.data.redirectData) {
      return {
        transactionId: paymentData.data.id,
        formData: paymentData.data.redirectData.parameters,
        gatewayUrl: paymentData.data.redirectData.url,
      };
    }

    return {
      transactionId: paymentData.data.id,
      redirectUrl: `/checkout/payment/process/${paymentData.data.id}`,
    };
  } catch (error) {
    console.error('❌ Payment initialization failed:', error);
    throw new Error(
      `Échec de l'initialisation du paiement: ${
        error instanceof Error ? error.message : 'Erreur inconnue'
      }`
    );
  }
}

/**
 * Récupère les méthodes de paiement disponibles
 */
export async function getAvailablePaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(
      `${backendUrl}/api/payments/methods/available`,
      {
        headers: {
          'Internal-Call': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch payment methods: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('❌ Failed to fetch payment methods:', error);
    // Fallback aux méthodes par défaut
    return getDefaultPaymentMethods();
  }
}

/**
 * Méthodes de paiement par défaut (fallback)
 */
function getDefaultPaymentMethods(): PaymentMethod[] {
  return [
    {
      id: 'CYBERPLUS',
      name: 'Carte bancaire',
      description: 'Paiement sécurisé par carte bancaire',
      logo: '/images/cards.png',
      enabled: true,
      isDefault: true,
    },
    {
      id: 'PAYPAL',
      name: 'PayPal',
      description: 'Paiement via votre compte PayPal',
      logo: '/images/paypal.png',
      enabled: true,
      isDefault: false,
    },
    {
      id: 'BANK_TRANSFER',
      name: 'Virement bancaire',
      description: 'Paiement par virement (délai 2-3 jours)',
      logo: '/images/bank-transfer.png',
      enabled: false,
      isDefault: false,
    },
  ];
}

/**
 * Vérifie le statut d'un paiement
 */
export async function getPaymentStatus(paymentId: string) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(
      `${backendUrl}/api/payments/${paymentId}`,
      {
        headers: {
          'Internal-Call': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('❌ Failed to get payment status:', error);
    throw error;
  }
}

/**
 * Gère le retour de paiement depuis la gateway
 */
export async function handlePaymentReturn(
  paymentId: string,
  returnData: Record<string, string>
) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(
      `${backendUrl}/api/payments/callback/success`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
        },
        body: JSON.stringify({
          payment_id: paymentId,
          ...returnData,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Payment return handling failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Payment return handling failed:', error);
    throw error;
  }
}

/**
 * Traite le retour de paiement depuis Cyberplus
 * Utilise le webhook /api/payments/callback/cyberplus
 */
export async function processPaymentReturn({
  transactionId,
  status,
  params,
}: {
  transactionId: string;
  status: string | null;
  params: Record<string, string>;
}) {
  try {
    // Utiliser le callback Cyberplus standard
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(
      `${backendUrl}/api/payments/callback/cyberplus`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
        },
        body: JSON.stringify({
          vads_trans_id: transactionId,
          vads_trans_status: status || 'PENDING',
          ...params,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Payment return processing failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Payment return processing failed:', error);
    throw error;
  }
}
