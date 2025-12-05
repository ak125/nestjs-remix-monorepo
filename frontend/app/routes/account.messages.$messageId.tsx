import { json, redirect, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { HtmlContent } from "../components/seo/HtmlContent";

/**
 * Route: /account/messages/:messageId
 * Affiche un message individuel (équivalent du PHP msg_fil.php)
 */

interface Message {
  MSG_ID: number;
  MSG_CST_ID: number;
  MSG_ORD_ID: number | null;
  MSG_CNFA_ID: number;
  MSG_SUBJECT: string;
  MSG_CONTENT: string;
  MSG_DATE: string;
  MSG_OPEN: number;
}

export const loader: LoaderFunction = async ({ request, context, params }) => {
  const user = await requireUser({ context });
  const { messageId } = params;

  if (!messageId) {
    throw redirect("/account/messages");
  }

  // Récupérer le message depuis l'API backend
  const _API_URL = process.env.API_BASE_URL || "http://localhost:3000";
  const baseUrl = process.env.SUPABASE_URL || "";
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  try {
    // Récupérer le message avec vérification de propriété (MSG_CST_ID = user.id)
    const messageResponse = await fetch(
      `${baseUrl}/rest/v1/___XTR_MSG?MSG_ID=eq.${messageId}&MSG_CST_ID=eq.${user.id}`,
      {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!messageResponse.ok) {
      throw new Error("Erreur lors de la récupération du message");
    }

    const messages = await messageResponse.json();

    if (messages.length === 0) {
      // Pas le droit d'accéder à ce message
      throw redirect("/account/messages?error=access_denied");
    }

    const message: Message = messages[0];

    // Marquer le message comme lu si pas encore lu
    if (message.MSG_OPEN === 0) {
      await fetch(
        `${baseUrl}/rest/v1/___XTR_MSG?MSG_ID=eq.${messageId}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ MSG_OPEN: 1 }),
        }
      );
    }

    return json({ message, user });
  } catch (error) {
    console.error("Erreur chargement message:", error);
    throw redirect("/account/messages?error=not_found");
  }
};

export default function MessageDetail() {
  const { message, user: _user } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Bouton retour */}
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link to="/profile" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour à mon espace
          </Link>
        </Button>
      </div>

      {/* Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {message.MSG_SUBJECT}
            </CardTitle>
            {message.MSG_ORD_ID && (
              <Badge className="bg-primary">
                Commande #{message.MSG_ORD_ID}/A
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {new Date(message.MSG_DATE).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </CardHeader>
        <CardContent>
          <HtmlContent 
            html={message.MSG_CONTENT}
            className="prose max-w-none"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="mt-6 flex gap-4">
        <Button variant="outline" asChild>
          <Link to="/profile">
            Retour à mon compte
          </Link>
        </Button>
        {message.MSG_ORD_ID && (
          <Button asChild>
            <Link to={`/account/orders/${message.MSG_ORD_ID}`}>
              Voir la commande #{message.MSG_ORD_ID}/A
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
