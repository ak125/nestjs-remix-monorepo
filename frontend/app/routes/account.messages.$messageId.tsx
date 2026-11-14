import { ArrowLeft } from "lucide-react";
import {
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { createNoIndexMeta } from "~/utils/meta-helpers";
import { requireUser } from "../auth/unified.server";
import { HtmlContent } from "../components/seo/HtmlContent";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

/**
 * Route: /account/messages/:messageId
 * Affiche un message du client connecté (équivalent du PHP msg_fil.php), lu
 * par l'API `api/messages` avec sa session.
 */

export const meta: MetaFunction = () => createNoIndexMeta("Message");

// Message tel que le renvoie `GET /api/messages/:id`.
interface Message {
  id: string;
  customerId: string;
  orderId?: string;
  subject: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

const NOT_FOUND = { message: "Message introuvable." };

export const loader = async ({
  request,
  context,
  params,
}: LoaderFunctionArgs) => {
  const user = await requireUser({ context });
  const { messageId } = params;

  if (!messageId) {
    throw redirect("/account/messages");
  }

  const headers = { Cookie: request.headers.get("Cookie") || "" };
  const messageUrl = getInternalApiUrlFromRequest(
    `/api/messages/${encodeURIComponent(messageId)}`,
    request,
  );

  // L'API n'ouvre un message qu'à son détenteur : celui d'un autre client
  // répond 404.
  const response = await fetch(messageUrl, { headers });

  if (!response.ok) {
    if (response.status !== 404) {
      logger.error("Erreur API message:", response.status);
    }
    throw data(
      response.status === 404
        ? NOT_FOUND
        : { message: "Ce message n'a pas pu être chargé." },
      { status: response.status },
    );
  }

  const message: Message = (await response.json()).data;

  // L'espace client ne montre que les messages du compte connecté, y compris
  // à une session que l'API laisse lire ceux des autres.
  if (String(message.customerId) !== String(user.id)) {
    throw data(NOT_FOUND, { status: 404 });
  }

  // Le message reste lisible si le marquage échoue ; l'échec est tracé.
  if (!message.isRead) {
    const readResponse = await fetch(`${messageUrl}/read`, {
      method: "PUT",
      headers,
    });
    if (!readResponse.ok) {
      logger.error("Marquage « lu » refusé par l'API:", readResponse.status);
    }
  }

  return { message };
};

export default function MessageDetail() {
  const { message } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Bouton retour */}
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link to="/account/messages" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour à mes messages
          </Link>
        </Button>
      </div>

      {/* Message */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{message.subject}</CardTitle>
            {message.orderId && (
              <Badge className="bg-primary">
                Commande #{message.orderId}/A
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {new Date(message.createdAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </CardHeader>
        <CardContent>
          <HtmlContent html={message.content} className="prose max-w-none" />
        </CardContent>
      </Card>

      {/* Actions */}
      {message.orderId && (
        <div className="mt-6 flex gap-4">
          <Button asChild>
            <Link to={`/account/orders/${message.orderId}`}>
              Voir la commande #{message.orderId}/A
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
