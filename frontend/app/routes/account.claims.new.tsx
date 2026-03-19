import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Form,
  Link,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { requireAuth, type AuthUser } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

export const meta: MetaFunction = () => [
  { title: "Nouvelle réclamation | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

type LoaderData = { user: AuthUser };
type ActionData = { error?: string; fieldErrors?: Record<string, string> };

const claimTypes = [
  { value: "defective_product", label: "Produit défectueux" },
  { value: "wrong_product", label: "Mauvais produit reçu" },
  { value: "missing_product", label: "Produit manquant" },
  { value: "delivery_issue", label: "Problème de livraison" },
  { value: "billing_issue", label: "Problème de facturation" },
  { value: "other", label: "Autre" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (!user) throw new Response("Non authentifié", { status: 401 });
  return json<LoaderData>({ user });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (!user)
    return json<ActionData>({ error: "Non authentifié" }, { status: 401 });

  const formData = await request.formData();
  const type = formData.get("type") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const expectedResolution = formData.get("expectedResolution") as string;
  const orderId = formData.get("orderId") as string;

  const fieldErrors: Record<string, string> = {};
  if (!type) fieldErrors.type = "Le type est requis";
  if (!title || title.length < 5)
    fieldErrors.title = "Le titre doit faire au moins 5 caractères";
  if (!description || description.length < 20)
    fieldErrors.description =
      "La description doit faire au moins 20 caractères";
  if (!expectedResolution || expectedResolution.length < 10)
    fieldErrors.expectedResolution =
      "La résolution attendue doit faire au moins 10 caractères";

  if (Object.keys(fieldErrors).length > 0)
    return json<ActionData>({ fieldErrors }, { status: 400 });

  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const userData = user;

  try {
    const res = await fetch(`${baseUrl}/api/support/claims`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        customerId: String(userData.id || userData.cst_id || ""),
        customerName:
          `${userData.firstName || ""} ${userData.lastName || ""}`.trim(),
        customerEmail: String(userData.email || ""),
        customerPhone: undefined,
        type,
        priority: "normal",
        title,
        description,
        expectedResolution,
        orderId: orderId || undefined,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return json<ActionData>(
        { error: errorData.message || `Erreur ${res.status}` },
        { status: res.status },
      );
    }
    return redirect("/account/claims");
  } catch (error) {
    logger.error("Erreur création réclamation:", error);
    return json<ActionData>({ error: "Erreur serveur" }, { status: 500 });
  }
}

export default function NewClaim() {
  const { user } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AccountLayout
      user={user}
      stats={{ orders: { pending: 0 }, messages: { unread: 0 } }}
    >
      <div className="space-y-6">
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Réclamations", href: "/account/claims" },
            { label: "Nouvelle" },
          ]}
        />
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link to="/account/claims">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            Nouvelle réclamation
          </h1>
        </div>

        {actionData?.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Décrivez votre problème</CardTitle>
          </CardHeader>
          <CardContent>
            <Form method="post" className="space-y-5">
              <div>
                <label
                  htmlFor="type"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Type de réclamation *
                </label>
                <select
                  id="type"
                  name="type"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionnez un type</option>
                  {claimTypes.map((ct) => (
                    <option key={ct.value} value={ct.value}>
                      {ct.label}
                    </option>
                  ))}
                </select>
                {actionData?.fieldErrors?.type && (
                  <p className="text-sm text-red-500 mt-1">
                    {actionData.fieldErrors.type}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="orderId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Numéro de commande (optionnel)
                </label>
                <input
                  type="text"
                  id="orderId"
                  name="orderId"
                  placeholder="Ex: ORD-1234567890-123"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Titre *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  minLength={5}
                  placeholder="Résumé du problème"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {actionData?.fieldErrors?.title && (
                  <p className="text-sm text-red-500 mt-1">
                    {actionData.fieldErrors.title}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description détaillée *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  minLength={20}
                  rows={5}
                  placeholder="Décrivez votre problème en détail..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {actionData?.fieldErrors?.description && (
                  <p className="text-sm text-red-500 mt-1">
                    {actionData.fieldErrors.description}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="expectedResolution"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Résolution souhaitée *
                </label>
                <textarea
                  id="expectedResolution"
                  name="expectedResolution"
                  required
                  minLength={10}
                  rows={3}
                  placeholder="Que souhaitez-vous ? (remboursement, remplacement, etc.)"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {actionData?.fieldErrors?.expectedResolution && (
                  <p className="text-sm text-red-500 mt-1">
                    {actionData.fieldErrors.expectedResolution}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Envoyer la réclamation
                  </>
                )}
              </Button>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AccountLayout>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error))
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  return <ErrorGeneric />;
}
