import { type ActionFunctionArgs, json } from "@remix-run/node";
import { requireAuth } from "../auth/unified.server";
import { initializePayment } from "../services/payment.server";
import { getInternalApiUrl } from "~/utils/internal-api.server";

/**
 * Resource route pour initialiser un paiement et renvoyer du JSON
 * Cette route est appelée par fetch() depuis checkout-payment.tsx
 */
export async function action({ request }: ActionFunctionArgs) {
  console.log("🔵 [checkout-payment-init] Action appelée");
  console.log("� Request method:", request.method);
  console.log("� Request URL:", request.url);

  try {
    // ⚠️ WORKAROUND: request.json() bloque dans Remix+Vite+Codespaces
    // On lit le body manuellement avec request.text() puis on parse
    console.log("� Step 1: Reading body as text...");

    let bodyText: string;
    try {
      const timeoutMs = 3000;
      bodyText = await Promise.race([
        request.text(),
        new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error("⏱️ Timeout reading body (3s)")),
            timeoutMs,
          ),
        ),
      ]);
      console.log("✅ Step 1 OK: Body text received, length:", bodyText.length);
      console.log(
        "📄 Body content (first 200 chars):",
        bodyText.substring(0, 200),
      );
    } catch (readError) {
      console.error("❌ Step 1 FAILED: Error reading body text:", readError);
      return json(
        { error: "Timeout or error reading request body" },
        { status: 408 },
      );
    }

    console.log("📥 Step 2: Parsing JSON from text...");
    let body: any;
    try {
      body = JSON.parse(bodyText);
      console.log("✅ Step 2 OK: JSON parsed:", body);
    } catch (parseError) {
      console.error("❌ Step 2 FAILED: JSON parse error:", parseError);
      console.error("📄 Raw body text:", bodyText);
      return json({ error: "Invalid JSON format" }, { status: 400 });
    }

    // Vérifier l'authentification (sans lire le body)
    const user = await requireAuth(request);
    console.log("✅ Utilisateur authentifié:", user.email);

    const { orderId, paymentMethod, acceptTerms } = body;
    console.log("📋 Données reçues:", { orderId, paymentMethod, acceptTerms });

    if (!acceptTerms) {
      console.log("❌ Termes non acceptés");
      return json(
        { error: "Vous devez accepter les conditions générales" },
        { status: 400 },
      );
    }

    if (!orderId || !paymentMethod) {
      console.log("❌ Données manquantes");
      return json({ error: "Données manquantes" }, { status: 400 });
    }

    // Récupérer les détails de la commande
    const backendUrl = getInternalApiUrl("");
    console.log(
      "🔍 Récupération commande depuis:",
      `${backendUrl}/api/orders/${orderId}`,
    );

    const orderResponse = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    console.log("📥 Réponse commande - Status:", orderResponse.status);

    if (!orderResponse.ok) {
      console.error("❌ Erreur récupération commande:", orderResponse.status);
      return json({ error: "Commande introuvable" }, { status: 404 });
    }

    const order = await orderResponse.json();
    console.log("✅ Commande récupérée:", orderId);
    console.log("💰 Montant commande:", order.totalTTC);

    // Déterminer l'URL de base
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    console.log("🔗 Base URL:", baseUrl);

    // Récupérer l'IP du client
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    console.log("🌐 IP Address:", ipAddress);

    // Initialiser le paiement
    console.log("💳 Appel initializePayment...");
    const paymentData = await initializePayment({
      orderId,
      userId: user.id,
      paymentMethod,
      amount: parseFloat(order.totalTTC),
      consigneTotal: parseFloat(order.consigneTotal || "0"),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      returnUrl: `${baseUrl}/checkout-payment-return`,
      baseUrl,
      ipAddress,
    });

    console.log(
      "✅ Paiement initialisé, transactionId:",
      paymentData.transactionId,
    );

    // Renvoyer les données au format attendu par le frontend
    if (
      paymentMethod === "cyberplus" &&
      paymentData.formData &&
      paymentData.gatewayUrl
    ) {
      console.log("✅ Renvoi des données Cyberplus au frontend");
      console.log("🔗 Gateway URL:", paymentData.gatewayUrl);
      console.log(
        "📋 Form data keys:",
        Object.keys(paymentData.formData).join(", "),
      );

      return json({
        success: true,
        cyberplus: true,
        gatewayUrl: paymentData.gatewayUrl,
        formData: paymentData.formData,
        transactionId: paymentData.transactionId,
      });
    }

    console.log("✅ Renvoi des données standard");
    return json({
      success: true,
      transactionId: paymentData.transactionId,
    });
  } catch (error: any) {
    console.error("❌ Erreur initialisation paiement:", error);
    console.error("❌ Stack trace:", error.stack);
    return json(
      {
        error: error.message || "Erreur lors de l'initialisation du paiement",
      },
      { status: 500 },
    );
  }
}
