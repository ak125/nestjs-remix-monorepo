import {
  json,
  type ActionFunction,
  type MetaFunction,
  redirect,
} from "@remix-run/node";
import {
  Form,
  useActionData,
  useSearchParams,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { Error404 } from "~/components/errors/Error404";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Mot de passe oublié | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!email) {
    return json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const baseUrl =
      process.env.INTERNAL_API_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/password/request-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toString() }),
    });

    const result = await response.json();

    if (result.success) {
      return redirect("/forgot-password?status=sent");
    }

    return json(
      { error: result.message || "Une erreur est survenue" },
      { status: response.status },
    );
  } catch {
    // Toujours afficher le message de succès (sécurité : ne pas révéler si l'email existe)
    return redirect("/forgot-password?status=sent");
  }
};

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  return (
    <div className="flex items-center justify-center min-h-[70vh] bg-gradient-to-b from-v9-navy to-v9-navy-light px-4 py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Entrez votre email pour recevoir un lien de réinitialisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" && (
            <Alert className="mb-4 border-success bg-success/10">
              <AlertDescription className="text-green-800">
                Si un compte avec cet email existe, vous recevrez un lien de
                réinitialisation.
              </AlertDescription>
            </Alert>
          )}

          {(error || actionData?.error) && (
            <Alert className="mb-4 border-destructive bg-destructive/10">
              <AlertDescription className="text-red-800">
                {error === "server_error" && "Une erreur serveur est survenue"}
                {actionData?.error}
              </AlertDescription>
            </Alert>
          )}

          <Form method="post" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="votre@email.com"
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-cta hover:bg-cta-hover text-white"
            >
              Envoyer le lien de réinitialisation
            </Button>
          </Form>

          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-4 py-2 text-sm text-cta hover:underline hover:bg-cta/5 rounded-lg transition-colors"
            >
              Retour à la connexion
            </Link>
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
