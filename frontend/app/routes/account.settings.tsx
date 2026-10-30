import { Bell, Eye, Trash2, Download } from "lucide-react";
import {
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  data,
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";

import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import {
  getMarketingConsent,
  updateMarketingConsent,
  type MarketingConsent,
} from "~/services/profile.server";
import { formatDate } from "~/utils/date";
import { logger } from "~/utils/logger";
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

export const meta: MetaFunction = () => [
  { title: "Paramètres du compte | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/account/settings",
  },
];

// Même libellé qu'à l'inscription : le client consent à la même chose.
const MARKETING_CONSENT_LABEL =
  "Je souhaite recevoir les offres et actualités AutoMecanik";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await requireUser({ context });

  // Consentement enregistré (ADR-036). Sans lecture, pas de case affichée :
  // un état par défaut pourrait être renvoyé tel quel et retirer un accord.
  let marketingConsent: MarketingConsent | null = null;
  try {
    const result = await getMarketingConsent(request);
    if (result.ok) marketingConsent = result.consent;
  } catch (error) {
    logger.error("[Settings] Lecture du consentement impossible:", error);
  }

  return { user, marketingConsent };
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  await requireUser({ context });
  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "updateMarketingConsent") {
    // Case non cochée = absente du formulaire = retrait du consentement.
    const granted = formData.get("marketingConsent") === "on";
    try {
      const result = await updateMarketingConsent(request, granted);
      if (result.ok) {
        return {
          success: true,
          message: result.consent.granted
            ? "C'est noté : vous recevrez nos offres et actualités."
            : "C'est noté : vous ne recevrez plus nos offres et actualités.",
        };
      }
      if (result.status === 401) return redirect("/login");
    } catch (error) {
      logger.error(
        "[Settings] Enregistrement du consentement impossible:",
        error,
      );
    }
    return data(
      {
        success: false,
        error:
          "Votre choix n'a pas pu être enregistré. Réessayez dans quelques instants.",
      },
      { status: 500 },
    );
  }

  if (action === "exportData") {
    // TODO: Implémenter l'export des données
    return {
      success: true,
      message: "Export des données en cours... Vous recevrez un email",
    };
  }

  if (action === "deleteAccount") {
    // TODO: Implémenter la suppression du compte
    const confirmation = formData.get("confirmation");
    if (confirmation !== "SUPPRIMER") {
      return data(
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

  return { success: false, error: "Action non reconnue" };
};

export default function AccountSettings() {
  const { marketingConsent } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { success?: boolean; message?: string; error?: string }
    | undefined;
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

      {/* Offres et actualités (consentement marketing) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Offres et actualités
          </CardTitle>
          <CardDescription>
            Ce choix ne concerne pas les e-mails liés à vos commandes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {marketingConsent ? (
            <Form method="post" className="space-y-4">
              <input
                type="hidden"
                name="_action"
                value="updateMarketingConsent"
              />

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="marketingConsent"
                  name="marketingConsent"
                  defaultChecked={marketingConsent.granted}
                  className="mt-1 h-4 w-4"
                />
                <div className="flex-1">
                  <Label htmlFor="marketingConsent" className="text-base">
                    {MARKETING_CONSENT_LABEL}
                  </Label>
                  {marketingConsent.grantedAt && (
                    <p className="text-sm text-gray-600">
                      Accord donné le {formatDate(marketingConsent.grantedAt)}
                    </p>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Enregistrement..." : "Enregistrer mon choix"}
              </Button>
            </Form>
          ) : (
            <Alert className="border-destructive bg-destructive/10">
              <AlertDescription className="text-red-800">
                Votre choix actuel n'a pas pu être chargé. Réessayez dans
                quelques instants.
              </AlertDescription>
            </Alert>
          )}
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
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
