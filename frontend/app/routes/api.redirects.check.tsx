import { json } from "@remix-run/node";

export async function loader({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const checkUrl = url.searchParams.get("url");

    if (!checkUrl) {
      return json({ error: "URL manquante" }, { status: 400 });
    }

    // Vérifier les redirections via l'API interne
    try {
      const response = await fetch(
        `${process.env.INTERNAL_API_BASE_URL || "http://127.0.0.1:3000"}/api/redirects/check?url=${encodeURIComponent(checkUrl)}`,
        {
          headers: {
            "Internal-Call": "true",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return json({
          destination: data.destination || null,
          permanent: data.permanent || false,
          found: !!data.destination,
        });
      }
    } catch (apiError) {
      console.error("Erreur lors de l'appel API redirections:", apiError);
    }

    return json({ destination: null, permanent: false, found: false });
  } catch (error) {
    console.error("Erreur lors de la vérification de redirection:", error);
    return json({ destination: null, permanent: false, found: false });
  }
}
