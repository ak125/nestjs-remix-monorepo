import { type ActionFunctionArgs, json } from "@remix-run/node";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { requireAuth } from "../auth/unified.server";
import { initializePayment } from "../services/payment.server";

/**
 * Resource route pour initialiser un paiement et renvoyer du JSON
 * Cette route est appelée par fetch() depuis checkout-payment.tsx
 */
export async function action({ request }: ActionFunctionArgs) {
  logger.log("🔵 [checkout-payment-init] Action appelée");
  logger.log("� Request method:", request.method);
  logger.log("� Request URL:", request.url);

  try {
    // ⚠️ WORKAROUND: request.json() bloque dans Remix+Vite+Codespaces
    // On lit le body manuellement avec request.text() puis on parse
    logger.log("� Step 1: Reading body as text...");

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
      logger.log("✅ Step 1 OK: Body text received, length:", bodyText.length);
      logger.log(
        "📄 Body content (first 200 chars):",
        bodyText.substring(0, 200),
      );
    } catch (readError) {
      logger.error("❌ Step 1 FAILED: Error reading body text:", readError);
      return json(
        { error: "Timeout or error reading request body" },
        { status: 408 },
      );
    }

    logger.log("📥 Step 2: Parsing JSON from text...");
    let body: any;
    try {
      body = JSON.parse(bodyText);
      logger.log("✅ Step 2 OK: JSON parsed:", body);
    } catch (parseError) {
      logger.error("❌ Step 2 FAILED: JSON parse error:", parseError);
      logger.error("📄 Raw body text:", bodyText);
      return json({ error: "Invalid JSON format" }, { status: 400 });
    }

    // Vérifier l'authentification (sans lire le body)
    const user = await requireAuth(request);
    logger.log("✅ Utilisateur authentifié:", user.email);

    const { orderId, paymentMethod, acceptTerms } = body;
    logger.log("📋 Données reçues:", { orderId, paymentMethod, acceptTerms });

    if (!acceptTerms) {
      logger.log("❌ Termes non acceptés");
      return json(
        { error: "Vous devez accepter les conditions générales" },
        { status: 400 },
      );
    }

    if (!orderId || !paymentMethod) {
      logger.log("❌ Données manquantes");
      return json({ error: "Données manquantes" }, { status: 400 });
    }

    // Récupérer les détails de la commande
    const backendUrl = getInternalApiUrl("");
    logger.log(
      "🔍 Récupération commande depuis:",
      `${backendUrl}/api/orders/${orderId}`,
    );

    const orderResponse = await fetch(`${backendUrl}/api/orders/${orderId}`, {
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    logger.log("📥 Réponse commande - Status:", orderResponse.status);

    if (!orderResponse.ok) {
      logger.error("❌ Erreur récupération commande:", orderResponse.status);
      return json({ error: "Commande introuvable" }, { status: 404 });
    }

    const order = await orderResponse.json();
    logger.log("✅ Commande récupérée:", orderId);
    logger.log("💰 Montant commande:", order.totalTTC);

    // Déterminer l'URL de base
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    logger.log("🔗 Base URL:", baseUrl);

    // Récupérer l'IP du client
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    logger.log("🌐 IP Address:", ipAddress);

    // Initialiser le paiement
    logger.log("💳 Appel initializePayment...");
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

    logger.log(
      "✅ Paiement initialisé, transactionId:",
      paymentData.transactionId,
    );

    // Renvoyer les données au format attendu par le frontend
    if (
      paymentMethod === "cyberplus" &&
      paymentData.formData &&
      paymentData.gatewayUrl
    ) {
      logger.log("✅ Renvoi des données Cyberplus au frontend");
      logger.log("🔗 Gateway URL:", paymentData.gatewayUrl);
      logger.log(
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

    logger.log("✅ Renvoi des données standard");
    return json({
      success: true,
      transactionId: paymentData.transactionId,
    });
  } catch (error: unknown) {
    logger.error("❌ Erreur initialisation paiement:", error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error("❌ Stack trace:", stack);
    return json(
      {
        error: message || "Erreur lors de l'initialisation du paiement",
      },
      { status: 500 },
    );
  }
}
