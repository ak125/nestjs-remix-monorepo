import {
  json,
  redirect,
  type ActionFunction,
  type LoaderFunction,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { Bell, Eye, Globe, Trash2, Download } from "lucide-react";

import { requireUser } from "../auth/unified.server";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";
import { Error404 } from "~/components/errors/Error404";

export const meta: MetaFunction = () => [
  { title: "Paramètres du compte | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/account/settings",
  },
];

export const loader: LoaderFunction = async ({ context }) => {
  const user = await requireUser({ context });

  // Récupérer les préférences utilisateur (à implémenter côté backend)
  const preferences = {
    notifications: {
      email: true,
      orderUpdates: true,
      promotions: false,
      newsletter: true,
    },
    privacy: {
      showProfile: false,
      showOrders: false,
    },
    language: "fr",
    currency: "EUR",
  };

  return json({ user, preferences });
};

export const action: ActionFunction = async ({ request, context }) => {
  const _user = await requireUser({ context });
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "updatePreferences") {
    // TODO: Implémenter la mise à jour des préférences
    return json({
      success: true,
      message: "Préférences mises à jour avec succès",
    });
  }

  if (action === "exportData") {
    // TODO: Implémenter l'export des données
    return json({
      success: true,
      message: "Export des données en cours... Vous recevrez un email",
    });
  }

  if (action === "deleteAccount") {
    // TODO: Implémenter la suppression du compte
    const confirmation = formData.get("confirmation");
    if (confirmation !== "SUPPRIMER") {
      return json(
        {
          success: false,
          error: "Veuillez taper SUPPRIMER pour confirmer",
        },
        { status: 400 },
      );
    }

    // Rediriger vers une page de confirmation
    return redirect("/account/deleted");
  }

  return json({ success: false, error: "Action non reconnue" });
};

export default function AccountSettings() {
  const { preferences } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <PublicBreadcrumb
        items={[
          { label: "Mon Compte", href: "/account" },
          { label: "Paramètres" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold">Paramètres du compte</h1>
        <p className="text-gray-600">
          Gérez vos préférences et votre confidentialité
        </p>
      </div>

      {/* Messages */}
      {actionData?.success && (
        <Alert className="border-success bg-success/10">
          <AlertDescription className="text-green-800">
            {actionData.message}
          </AlertDescription>
        </Alert>
      )}

      {actionData?.error && (
        <Alert className="border-destructive bg-destructive/10">
          <AlertDescription className="text-red-800">
            {actionData.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Gérez vos préférences de notification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="_action" value="updatePreferences" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="emailNotif" className="text-base">
                    Notifications par email
                  </Label>
                  <p className="text-sm text-gray-600">
                    Recevoir des emails sur l'activité de votre compte
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="emailNotif"
                  name="emailNotif"
                  defaultChecked={preferences.notifications.email}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="orderUpdates" className="text-base">
                    Mises à jour des commandes
                  </Label>
                  <p className="text-sm text-gray-600">
                    Être informé du statut de vos commandes
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="orderUpdates"
                  name="orderUpdates"
                  defaultChecked={preferences.notifications.orderUpdates}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="promotions" className="text-base">
                    Offres promotionnelles
                  </Label>
                  <p className="text-sm text-gray-600">
                    Recevoir les offres et réductions
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="promotions"
                  name="promotions"
                  defaultChecked={preferences.notifications.promotions}
                  className="h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label htmlFor="newsletter" className="text-base">
                    Newsletter
                  </Label>
                  <p className="text-sm text-gray-600">
                    Actualités et nouveautés du site
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="newsletter"
                  name="newsletter"
                  defaultChecked={preferences.notifications.newsletter}
                  className="h-4 w-4"
                />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Enregistrement..."
                : "Enregistrer les préférences"}
            </Button>
          </Form>
        </CardContent>
      </Card>

      {/* Confidentialité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Confidentialité
          </CardTitle>
          <CardDescription>
            Contrôlez la visibilité de vos informations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-base">Profil public</Label>
                <p className="text-sm text-gray-600">
                  Permettre aux autres utilisateurs de voir votre profil
                </p>
              </div>
              <Badge variant="outline">Privé</Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-base">Historique des commandes</Label>
                <p className="text-sm text-gray-600">
                  Masquer votre historique de commandes
                </p>
              </div>
              <Badge variant="outline">Privé</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Langue et région */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Langue et région
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="_action" value="updatePreferences" />

            <div className="space-y-2">
              <Label htmlFor="language">Langue</Label>
              <select
                id="language"
                name="language"
                defaultValue={preferences.language}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <select
                id="currency"
                name="currency"
                defaultValue={preferences.currency}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              Enregistrer
            </Button>
          </Form>
        </CardContent>
      </Card>

      {/* Export des données */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export de vos données
          </CardTitle>
          <CardDescription>
            Téléchargez une copie de toutes vos données (RGPD)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post">
            <input type="hidden" name="_action" value="exportData" />
            <p className="text-sm text-gray-600 mb-4">
              Vous recevrez un email avec un lien de téléchargement contenant
              toutes vos données personnelles (commandes, adresses,
              préférences).
            </p>
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              <Download className="h-4 w-4 mr-2" />
              Demander l'export
            </Button>
          </Form>
        </CardContent>
      </Card>

      {/* Suppression du compte */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Zone de danger
          </CardTitle>
          <CardDescription>
            Actions irréversibles sur votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert intent="error">
              <p className="text-sm text-red-800 font-medium mb-2">
                ⚠️ Suppression du compte
              </p>
              <p className="text-sm text-red-700">
                Cette action est définitive. Toutes vos données seront
                supprimées et vous ne pourrez plus accéder à votre compte ni à
                vos commandes.
              </p>
            </Alert>

            <Form method="post" className="space-y-4">
              <input type="hidden" name="_action" value="deleteAccount" />

              <div className="space-y-2">
                <Label htmlFor="confirmation">
                  Tapez <strong>SUPPRIMER</strong> pour confirmer
                </Label>
                <Input
                  id="confirmation"
                  name="confirmation"
                  placeholder="SUPPRIMER"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer définitivement mon compte
              </Button>
            </Form>
          </div>
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
