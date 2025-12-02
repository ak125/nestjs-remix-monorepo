import { json, type ActionFunction, type LoaderFunction, type MetaFunction, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

// 🤖 SEO: Page transactionnelle non indexable
export const meta: MetaFunction = () => [
  { title: "Réinitialisation du mot de passe | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

export const loader: LoaderFunction = async ({ params }) => {
  const { token } = params;
  
  if (!token) {
    throw new Response("Token manquant", { status: 400 });
  }

  return json({ token });
};

export const action: ActionFunction = async ({ params, request, context }) => {
  const token = params.token;
  
  if (!token) {
    return json({ error: "Token manquant" }, { status: 400 });
  }

  const formData = await request.formData();
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (!password || !confirmPassword) {
    return json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return json({ error: "Les mots de passe ne correspondent pas" }, { status: 400 });
  }

  if (typeof password === 'string' && password.length < 6) {
    return json({ error: "Le mot de passe doit contenir au moins 6 caractères" }, { status: 400 });
  }

  // Utiliser l'intégration directe pour réinitialiser le mot de passe
  const { getRemixIntegrationService } = await import("~/server/remix-integration.server");
  const integration: any = await getRemixIntegrationService(context);
  const result = await integration.resetPasswordForRemix?.(token, password.toString());

  if (result.success) {
    return redirect("/login?reset=success");
  } else {
    return json({ error: result.error || "Token invalide ou expiré" }, { status: 400 });
  }
};

export default function ResetPassword() {
  const { token } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const error = searchParams.get("error");

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>
            Entrez votre nouveau mot de passe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(error || actionData?.error) && (
            <Alert className="mb-4 border-destructive bg-destructive/10">
              <AlertDescription className="text-red-800">
                {error === "invalid_token" && "Token invalide ou expiré"}
                {error === "token_used" && "Ce token a déjà été utilisé"}
                {error === "token_expired" && "Ce token a expiré"}
                {error === "server_error" && "Une erreur serveur est survenue"}
                {actionData?.error}
              </AlertDescription>
            </Alert>
          )}

          <Form method="post" className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="Au moins 6 caractères"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                placeholder="Confirmez votre mot de passe"
                className="w-full"
              />
            </div>

            <Button type="submit" className="w-full">
              Changer le mot de passe
            </Button>
          </Form>

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">
              Retour à la connexion
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
