import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get('paymentId');

  if (!paymentId) {
    throw new Response('Payment ID manquant', { status: 400 });
  }

  // Appeler le backend pour récupérer les données de paiement
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const response = await fetch(`${backendUrl}/api/payments/${paymentId}`);
  
  if (!response.ok) {
    throw new Response('Paiement introuvable', { status: 404 });
  }

  const payment = await response.json();
  const redirectData = payment.data?.redirectData;

  if (!redirectData?.html) {
    throw new Response('Données de redirection manquantes', { status: 500 });
  }

  // Retourner le HTML directement comme réponse
  return new Response(redirectData.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
