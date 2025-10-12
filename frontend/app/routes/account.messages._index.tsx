import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { Mail, MailOpen, Package } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";

/**
 * Route: /account/messages
 * Liste tous les messages du client (équivalent section messages du PHP)
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

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });

  // Récupérer tous les messages du client
  const baseUrl = process.env.SUPABASE_URL || "";
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  try {
    const messagesResponse = await fetch(
      `${baseUrl}/rest/v1/___XTR_MSG?MSG_CST_ID=eq.${user.id}&MSG_CNFA_ID=neq.0&order=MSG_DATE.desc`,
      {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!messagesResponse.ok) {
      throw new Error("Erreur lors de la récupération des messages");
    }

    const messages: Message[] = await messagesResponse.json();

    // Statistiques
    const stats = {
      total: messages.length,
      unread: messages.filter((msg) => msg.MSG_OPEN === 0).length,
      withOrder: messages.filter((msg) => msg.MSG_ORD_ID !== null).length,
    };

    return json({ messages, stats, user });
  } catch (error) {
    console.error("Erreur chargement messages:", error);
    return json({ messages: [], stats: { total: 0, unread: 0, withOrder: 0 }, user });
  }
};

export default function MessagesList() {
  const { messages, stats } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Mes Messages</h1>
            <p className="text-gray-600 mt-2">
              Échanges avec le service commercial et technique
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/profile">Retour au profil</Link>
          </Button>
        </div>

        {/* Alertes */}
        {error === "access_denied" && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              Vous n'avez pas accès à ce message.
            </AlertDescription>
          </Alert>
        )}

        {error === "not_found" && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              Message introuvable.
            </AlertDescription>
          </Alert>
        )}

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total messages</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Mail className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Non lus</p>
                  <p className="text-2xl font-bold">{stats.unread}</p>
                </div>
                <MailOpen className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Liés aux commandes</p>
                  <p className="text-2xl font-bold">{stats.withOrder}</p>
                </div>
                <Package className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des messages */}
        <Card>
          <CardHeader>
            <CardTitle>Tous les messages</CardTitle>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Vous n'avez aucun message pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message: Message) => (
                  <div
                    key={message.MSG_ID}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors hover:bg-gray-50 ${
                      message.MSG_OPEN === 0
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {message.MSG_OPEN === 0 ? (
                          <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        ) : (
                          <MailOpen className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm">
                          {message.MSG_ORD_ID ? `#${message.MSG_ORD_ID}/A` : "Message général"}
                        </span>
                        {message.MSG_OPEN === 0 && (
                          <Badge className="bg-blue-500 text-xs">Nouveau</Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{message.MSG_SUBJECT}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(message.MSG_DATE).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Button
                      variant={message.MSG_OPEN === 0 ? "default" : "secondary"}
                      size="sm"
                      asChild
                    >
                      <Link to={`/account/messages/${message.MSG_ID}`}>
                        {message.MSG_OPEN === 0 ? "Lire" : "Voir"}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
