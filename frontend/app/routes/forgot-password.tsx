import { json, type ActionFunction, redirect } from "@remix-run/node";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

export const action: ActionFunction = async ({ request, context }) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!email || typeof email !== 'string') {
    return json({ error: "Email is required" }, { status: 400 });
  }

  // ✅ Approche intégrée : appel direct au service via Remix
  if (!context.remixService?.integration) {
    return json({ error: "Service d'intégration non disponible" }, { status: 500 });
  }

  try {
    const result = await context.remixService.integration.sendForgotPasswordForRemix(email);

    if (result.success) {
      return redirect("/forgot-password?status=sent");
    } else {
      return json({ error: result.error || "Une erreur est survenue" }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Erreur forgot password:', error);
    return json({ error: "Erreur lors de l'envoi" }, { status: 500 });
  }
};

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const status = searchParams.get("status");
  const error = searchParams.get("error");

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Entrez votre email pour recevoir un lien de réinitialisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                Si un compte avec cet email existe, vous recevrez un lien de réinitialisation.
              </AlertDescription>
            </Alert>
          )}

          {(error || actionData?.error) && (
            <Alert className="mb-4 border-red-200 bg-red-50">
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

            <Button type="submit" className="w-full">
              Envoyer le lien de réinitialisation
            </Button>
          </Form>

          <div className="mt-4 text-center">
            <a href="/login" className="text-sm text-blue-600 hover:underline">
              Retour à la connexion
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
