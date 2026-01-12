import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  Form,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { Send, Paperclip, ArrowLeft } from "lucide-react";
import { requireUserWithRedirect } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Error404 } from "~/components/errors/Error404";
import { Alert } from "~/components/ui/alert";

interface LoaderData {
  user: any;
  orderId?: string;
  parentId?: string;
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await requireUserWithRedirect({ request, context });

  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const parentId = url.searchParams.get("reply");

  return json<LoaderData>({
    user,
    orderId: orderId || undefined,
    parentId: parentId || undefined,
  });
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const user = await requireUserWithRedirect({ request, context });
  const formData = await request.formData();

  const messageData = {
    customerId: user.id.toString(),
    staffId: formData.get("staffId")?.toString() || "1", // Par défaut staff admin
    orderId: formData.get("orderId")?.toString(),
    subject: formData.get("subject")?.toString() || "",
    content: formData.get("content")?.toString() || "",
    priority:
      (formData.get("priority")?.toString() as "low" | "normal" | "high") ||
      "normal",
  };

  try {
    // Appel à l'API pour créer le message
    const response = await fetch("http://localhost:3000/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("Cookie") || "",
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      throw new Error("Erreur lors de l'envoi du message");
    }

    const result = await response.json();

    if (result.success) {
      return redirect(`/account/messages?sent=1`);
    } else {
      throw new Error(result.message || "Erreur inconnue");
    }
  } catch (error) {
    console.error("Erreur envoi message:", error);
    return json(
      { error: "Erreur lors de l'envoi du message" },
      { status: 500 },
    );
  }
};

export default function ComposeMessage() {
  const { user, orderId, parentId } = useLoaderData<LoaderData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>

        <h1 className="text-2xl font-bold text-gray-900">
          Nouveau message de support
        </h1>
        <p className="text-gray-600 mt-1">
          Contactez notre équipe de support pour toute question
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Composer un message
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Form method="post" className="space-y-6">
            {/* Informations utilisateur */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">
                Vos informations
              </h3>
              <p className="text-sm text-gray-600">
                De: <span className="font-medium">{user.email}</span>
              </p>
              <p className="text-sm text-gray-600">
                ID Client: <span className="font-medium">#{user.id}</span>
              </p>
            </div>

            {/* Champs cachés */}
            <input type="hidden" name="staffId" value="1" />
            {orderId && <input type="hidden" name="orderId" value={orderId} />}
            {parentId && (
              <input type="hidden" name="parentId" value={parentId} />
            )}

            {/* Information sur la commande si applicable */}
            {orderId && (
              <Alert className="p-4  rounded-lg" variant="info">
                <div className="flex items-center gap-2">
                  <Badge className="bg-info/20 text-info">Commande</Badge>
                  <span className="text-sm font-medium">
                    Concernant la commande #{orderId.slice(0, 8)}
                  </span>
                </div>
              </Alert>
            )}

            {/* Sujet */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sujet *
              </label>
              <Input
                name="subject"
                required
                defaultValue={
                  orderId
                    ? `Question concernant ma commande #${orderId.slice(0, 8)}`
                    : ""
                }
                placeholder="Décrivez brièvement votre demande"
                className="w-full"
              />
            </div>

            {/* Priorité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Niveau de priorité
              </label>
              <select
                name="priority"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue="normal"
              >
                <option value="low">🟢 Basse - Question générale</option>
                <option value="normal">🟡 Normale - Demande standard</option>
                <option value="high">🔴 Haute - Problème urgent</option>
              </select>
            </div>

            {/* Type de demande */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de demande
              </label>
              <select
                name="category"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue={orderId ? "order" : "general"}
              >
                <option value="general">💬 Question générale</option>
                <option value="order">📦 Commande</option>
                <option value="support">🛠️ Support technique</option>
                <option value="billing">💳 Facturation</option>
                <option value="account">👤 Compte utilisateur</option>
              </select>
            </div>

            {/* Corps du message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Votre message *
              </label>
              <Textarea
                name="content"
                required
                rows={8}
                placeholder="Décrivez votre demande en détail. Plus vous donnerez d'informations, plus nous pourrons vous aider efficacement."
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 10 caractères
              </p>
            </div>

            {/* Pièces jointes (future fonctionnalité) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pièces jointes (optionnel)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Fonctionnalité bientôt disponible
                </p>
                <p className="text-xs text-gray-400">
                  En attendant, vous pouvez inclure les détails dans votre
                  message
                </p>
              </div>
            </div>

            {/* Conseils */}
            <Alert className="p-4 rounded-lg" variant="warning">
              <h4 className="font-medium text-yellow-800 mb-2">
                💡 Conseils pour une réponse rapide
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Soyez précis dans votre description</li>
                <li>• Mentionnez les numéros de commande si applicable</li>
                <li>• Décrivez les étapes qui ont mené au problème</li>
                <li>
                  • Indiquez votre système d'exploitation/navigateur si
                  pertinent
                </li>
              </ul>
            </Alert>

            {/* Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
                disabled={isSubmitting}
              >
                Annuler
              </Button>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
