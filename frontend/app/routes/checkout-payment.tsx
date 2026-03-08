/**
 * REDIRECT STUB — checkout-payment.tsx
 * L'ancien flow checkout-payment est fusionne dans /checkout (accordion one-page).
 * Ce fichier redirige les anciennes URLs vers /checkout.
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  // Si un orderId est present, on le passe en query param (backward compat)
  if (orderId) {
    return redirect(`/checkout?orderId=${encodeURIComponent(orderId)}`);
  }

  return redirect("/checkout");
};

export default function CheckoutPaymentRedirect() {
  return null;
}
