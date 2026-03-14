import {
  json,
  type ActionFunction,
  type LoaderFunction,
  type MetaFunction,
  redirect,
} from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { useState } from "react";
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

export const meta: MetaFunction = () => [
  { title: "Activez votre compte | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
];

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    throw new Response("Token manquant", { status: 400 });
  }

  return json({ token });
};

export const action: ActionFunction = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

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
    return json(
      { error: "Les mots de passe ne correspondent pas" },
      { status: 400 },
    );
  }

  const pwd = password.toString();

  if (pwd.length < 6) {
    return json(
      { error: "Le mot de passe doit contenir au moins 6 caracteres" },
      { status: 400 },
    );
  }

  try {
    const baseUrl =
      process.env.INTERNAL_API_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/auth/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: pwd }),
    });

    const result = await response.json();

    if (result.success) {
      return redirect("/login?activated=success");
    }

    return json(
      { error: result.message || "Token invalide ou expire" },
      { status: 400 },
    );
  } catch {
    return json(
      { error: "Une erreur est survenue. Veuillez reessayer." },
      { status: 500 },
    );
  }
};

function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 6) strength += 25;
  if (password.length >= 12) strength += 25;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
  return Math.min(100, strength);
}

function getStrengthLabel(strength: number): { text: string; color: string } {
  if (strength >= 75) return { text: "Fort", color: "bg-green-500" };
  if (strength >= 50) return { text: "Moyen", color: "bg-yellow-500" };
  if (strength >= 25) return { text: "Faible", color: "bg-orange-500" };
  return { text: "Tres faible", color: "bg-red-500" };
}

export default function SetPassword() {
  const { token } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const error = searchParams.get("error");
  const [passwordStrength, setPasswordStrength] = useState(0);

  const strengthInfo = getStrengthLabel(passwordStrength);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Activez votre compte</CardTitle>
          <CardDescription>
            Definissez votre mot de passe pour acceder a votre espace client et
            suivre vos commandes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(error || actionData?.error) && (
            <Alert className="mb-4 border-destructive bg-destructive/10">
              <AlertDescription className="text-red-800">
                {error === "invalid_token" && "Token invalide ou expire"}
                {error === "token_used" && "Ce token a deja ete utilise"}
                {error === "token_expired" && "Ce token a expire"}
                {actionData?.error}
              </AlertDescription>
            </Alert>
          )}

          <Form
            method="post"
            action={`/client/set-password?token=${token}`}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="6 caracteres minimum"
                className="w-full"
                onChange={(e) =>
                  setPasswordStrength(calculatePasswordStrength(e.target.value))
                }
              />
              {passwordStrength > 0 && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthInfo.color}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Force : {strengthInfo.text}
                  </p>
                </div>
              )}
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
              Activer mon compte
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
