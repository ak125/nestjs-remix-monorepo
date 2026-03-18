import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Link,
  Form,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { MapPin, Trash2, Home, Building, Star, Loader2 } from "lucide-react";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { logger } from "~/utils/logger";
import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

export const meta: MetaFunction = () => [
  { title: "Mes adresses | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/account/addresses",
  },
];

type BillingAddress = {
  id: number;
  customer_id: number;
  firstname: string;
  lastname: string;
  company?: string;
  address1: string;
  address2?: string;
  postal_code: string;
  city: string;
  country: string;
  phone?: string;
};

type DeliveryAddress = BillingAddress & { label?: string; is_default: boolean };

type LoaderData = {
  billing: BillingAddress | null;
  delivery: DeliveryAddress[];
  user: Record<string, unknown>;
};
type ActionData = { success?: boolean; error?: string };

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  if (!user) throw new Response("Non authentifié", { status: 401 });

  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";

  try {
    const res = await fetch(`${baseUrl}/api/addresses`, {
      headers: { Accept: "application/json", Cookie: cookie },
    });
    if (!res.ok) {
      logger.error(`API addresses error: ${res.status}`);
      return json<LoaderData>({ billing: null, delivery: [], user });
    }
    const data = await res.json();
    return json<LoaderData>({
      billing: data.billing || null,
      delivery: data.delivery || [],
      user,
    });
  } catch (error) {
    logger.error("Erreur chargement adresses:", error);
    return json<LoaderData>({ billing: null, delivery: [], user });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request);
  if (!user)
    return json<ActionData>({ error: "Non authentifié" }, { status: 401 });

  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  const cookie = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  try {
    let res: Response;
    switch (intent) {
      case "deleteDelivery": {
        const addressId = formData.get("addressId");
        res = await fetch(`${baseUrl}/api/addresses/delivery/${addressId}`, {
          method: "DELETE",
          headers,
        });
        break;
      }
      case "setDefault": {
        const addressId = formData.get("addressId");
        res = await fetch(
          `${baseUrl}/api/addresses/delivery/${addressId}/set-default`,
          { method: "PATCH", headers },
        );
        break;
      }
      default:
        return json<ActionData>({ error: "Action inconnue" }, { status: 400 });
    }
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return json<ActionData>(
        { error: errorData.message || `Erreur ${res.status}` },
        { status: res.status },
      );
    }
    return json<ActionData>({ success: true });
  } catch (error) {
    logger.error("Erreur action adresses:", error);
    return json<ActionData>({ error: "Erreur serveur" }, { status: 500 });
  }
}

function AddressCard({
  address,
  type,
}: {
  address: BillingAddress | DeliveryAddress;
  type: "billing" | "shipping";
}) {
  const navigation = useNavigation();
  const isDefault =
    type === "shipping" && "is_default" in address && address.is_default;
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("addressId") === String(address.id) &&
    navigation.formData?.get("intent") === "deleteDelivery";

  return (
    <Card className={`relative ${isDeleting ? "opacity-50" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {type === "billing" ? (
              <Building className="w-5 h-5 text-blue-600" />
            ) : (
              <Home className="w-5 h-5 text-green-600" />
            )}
            {type === "billing"
              ? "Facturation"
              : ("label" in address && address.label) || "Livraison"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isDefault && <Badge variant="default">Par défaut</Badge>}
            {type === "shipping" && !isDefault && (
              <Form method="post">
                <input type="hidden" name="intent" value="setDefault" />
                <input type="hidden" name="addressId" value={address.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  title="Définir par défaut"
                >
                  <Star className="w-4 h-4" />
                </Button>
              </Form>
            )}
            {type === "shipping" && (
              <Form method="post">
                <input type="hidden" name="intent" value="deleteDelivery" />
                <input type="hidden" name="addressId" value={address.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  title="Supprimer"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-red-500" />
                  )}
                </Button>
              </Form>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="font-medium text-gray-900">
          {address.firstname} {address.lastname}
        </p>
        {address.company && <p className="text-gray-600">{address.company}</p>}
        <div className="text-gray-600 text-sm">
          <p>{address.address1}</p>
          {address.address2 && <p>{address.address2}</p>}
          <p>
            {address.postal_code} {address.city}
          </p>
          <p>{address.country}</p>
        </div>
        {address.phone && (
          <p className="text-gray-600 text-sm">{address.phone}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountAddresses() {
  const { billing, delivery, user } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();

  return (
    <AccountLayout
      user={user}
      stats={{ orders: { pending: 0 }, messages: { unread: 0 } }}
    >
      <div className="space-y-6">
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Mes Adresses" },
          ]}
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes Adresses</h1>
            <p className="text-gray-600">
              Gérez vos adresses de facturation et de livraison
            </p>
          </div>
        </div>
        {actionData?.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {actionData.error}
          </div>
        )}
        {actionData?.success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            Adresse mise à jour avec succès
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <MapPin className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {(billing ? 1 : 0) + delivery.length}
              </p>
              <p className="text-sm text-gray-600">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Building className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {billing ? 1 : 0}
              </p>
              <p className="text-sm text-gray-600">Facturation</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Home className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {delivery.length}
              </p>
              <p className="text-sm text-gray-600">Livraison</p>
            </CardContent>
          </Card>
        </div>
        {billing && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Adresse de facturation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AddressCard address={billing} type="billing" />
            </div>
          </div>
        )}
        {delivery.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Adresses de livraison
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {delivery.map((addr) => (
                <AddressCard key={addr.id} address={addr} type="shipping" />
              ))}
            </div>
          </div>
        )}
        {!billing && delivery.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune adresse enregistrée
              </h3>
              <p className="text-gray-600 mb-4">
                Vos adresses seront enregistrées lors de votre prochaine
                commande
              </p>
            </CardContent>
          </Card>
        )}
        <div className="flex gap-4">
          <Button asChild variant="outline">
            <Link to="/account/dashboard">Retour au dashboard</Link>
          </Button>
        </div>
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
