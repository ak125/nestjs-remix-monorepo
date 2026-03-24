/**
 * Recovery route for abandoned cart emails.
 * Redirects to the backend recovery endpoint which restores the cart
 * and redirects back to /panier.
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const token = params.token;

  if (!token || token.length !== 64) {
    return redirect("/panier?error=invalid_token");
  }

  // Forward cookies so the backend can identify the session
  const cookie = request.headers.get("Cookie") || "";

  try {
    const apiUrl =
      process.env.VITE_API_URL ||
      process.env.API_URL ||
      "http://localhost:3000";

    const response = await fetch(`${apiUrl}/api/cart/recover/${token}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });

    // The backend responds with a redirect to /panier?recovered=1
    const location = response.headers.get("Location");
    if (location) {
      return redirect(location);
    }

    return redirect("/panier?recovered=1");
  } catch {
    return redirect("/panier?error=recovery_failed");
  }
}

export default function PanierRecover() {
  // This component should never render (loader always redirects)
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <p>Restauration de votre panier en cours...</p>
    </div>
  );
}
