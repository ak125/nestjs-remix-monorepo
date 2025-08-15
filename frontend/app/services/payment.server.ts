import { type PaymentMethod } from "../types/payment";

/**
 * Service côté serveur pour les paiements utilisateur
 */

export interface InitializePaymentParams {
  orderId: string;
  userId: string;
  paymentMethod: string;
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

    const response = await fetch(`${process.env.BACKEND_URL}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Internal-Call': 'true',
      },
      body: JSON.stringify({
        orderId: params.orderId,
        userId: params.userId,
        paymentMethod: params.paymentMethod,
        returnUrl: params.returnUrl,
        cancelUrl: `${process.env.BASE_URL}/checkout/payment/cancel`,
        notifyUrl: `${process.env.BASE_URL}/api/payments/callback/cyberplus`,
        ipAddress: params.ipAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment initialization failed: ${response.statusText}`);
    }

    const paymentData = await response.json();

    if (params.paymentMethod === 'CYBERPLUS') {
      // Pour Cyberplus, générer le formulaire de redirection
      const formResponse = await fetch(
        `${process.env.BACKEND_URL}/api/payments/${paymentData.data.id}/cyberplus-form`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Internal-Call': 'true',
          },
        }
      );

      if (formResponse.ok) {
        const formData = await formResponse.json();
        return {
          transactionId: paymentData.data.id,
          formData: formData.parameters,
          gatewayUrl: formData.url,
        };
      }
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
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/payments/methods/available`,
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
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/payments/${paymentId}`,
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
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/payments/callback/success`,
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
 * Traite le retour de paiement depuis Cyberplus (compatible avec route payment-return)
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
    // Appeler l'API backend pour traiter le retour
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/payments/${transactionId}/return`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
        },
        body: JSON.stringify({
          status,
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
