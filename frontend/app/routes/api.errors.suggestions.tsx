import { type ActionFunctionArgs, json } from "@remix-run/node";
import { logger } from "~/utils/logger";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = await request.json();

    if (body.action === "reportError") {
      const errorData = JSON.parse(body.errorData);

      // Envoyer l'erreur au service ErrorLogService via l'API interne
      try {
        const response = await fetch(
          `${process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:3000"}/api/errors/log`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Internal-Call": "true",
              "X-User-Id": errorData.userId || "anonymous",
            },
            body: JSON.stringify({
              code: errorData.code,
              url: errorData.url,
              userAgent: errorData.userAgent,
              ipAddress:
                request.headers.get("x-forwarded-for") ||
                request.headers.get("x-real-ip") ||
                "unknown",
              referrer: errorData.referrer,
              userId: errorData.userId,
              sessionId: request.headers.get("x-session-id"),
              metadata: {
                ...errorData.metadata,
                message: errorData.message,
                stack: errorData.stack,
                timestamp: errorData.timestamp,
                reportedFromClient: true,
              },
            }),
          },
        );

        if (!response.ok) {
          logger.error(
            "Erreur lors de l'envoi à l'API de logging:",
            response.statusText,
          );
        }
      } catch (apiError) {
        logger.error("Erreur lors de l'appel API de logging:", apiError);
      }

      return json({ success: true });
    }

    return json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error) {
    logger.error("Erreur dans l'API de rapport d'erreurs:", error);
    return json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function loader({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const errorUrl = url.searchParams.get("url");

    if (!errorUrl) {
      return json({ error: "URL manquante" }, { status: 400 });
    }

    // Récupérer les suggestions via l'API interne
    try {
      const response = await fetch(
        `${process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:3000"}/api/errors/suggestions?url=${encodeURIComponent(errorUrl)}`,
        {
          headers: {
            "Internal-Call": "true",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return json({ suggestions: data.suggestions || [] });
      }
    } catch (apiError) {
      logger.error("Erreur lors de l'appel API suggestions:", apiError);
    }

    return json({ suggestions: [] });
  } catch (error) {
    logger.error("Erreur lors de la récupération des suggestions:", error);
    return json({ suggestions: [] });
  }
}
