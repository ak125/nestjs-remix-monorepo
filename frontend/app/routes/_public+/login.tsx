import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useSearchParams, Link } from "@remix-run/react";
import { useState } from "react";
import { getOptionalUser } from "../../auth/unified.server";
import { Badge } from "~/components/ui/badge";
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
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

// Phase 9: PageRole pour analytics
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_SUPPORT, {
    clusterId: "auth",
    canonicalEntity: "login",
    contentType: "support",
    funnelStage: "decision",
    conversionGoal: "lead",
  }),
};

export const meta: MetaFunction = () => [
  { title: "Connexion | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/login",
  },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  if (user) {
    const userLevel = user.level || 1;
    if (user.isAdmin && userLevel >= 7) return redirect("/admin");
    if (user.isPro) return redirect("/commercial");
    return redirect("/account");
  }
  return json({});
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation(); // 🔧 EMPÊCHER LA PROPAGATION à Remix
    setIsLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // ✅ Récupérer le redirectTo pour rediriger après connexion
    const redirectTo = searchParams.get("redirectTo");

    console.log("� [Login] Connexion en cours...");
    if (redirectTo) {
      console.log("� [Login] Redirection après connexion:", redirectTo);
    }

    // Soumettre directement au backend via navigation native
    const tempForm = document.createElement("form");
    tempForm.method = "POST";
    tempForm.action = redirectTo
      ? `/authenticate?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/authenticate";
    tempForm.style.display = "none";

    const emailInput = document.createElement("input");
    emailInput.name = "email";
    emailInput.value = formData.get("email") as string;
    tempForm.appendChild(emailInput);

    const passwordInput = document.createElement("input");
    passwordInput.name = "password";
    passwordInput.value = formData.get("password") as string;
    tempForm.appendChild(passwordInput);

    // ✅ Ajouter le redirectTo au formulaire si présent
    if (redirectTo) {
      const redirectInput = document.createElement("input");
      redirectInput.name = "redirectTo";
      redirectInput.value = redirectTo;
      tempForm.appendChild(redirectInput);
      console.log("✅ [Login] RedirectTo ajouté:", redirectTo);
    }

    // 🔑 Capturer et envoyer la session invité pour fusion de panier
    const cookieHeader = document.cookie;
    const sessionCookie = cookieHeader
      .split(";")
      .find((c) => c.trim().startsWith("connect.sid="));

    if (sessionCookie) {
      try {
        const cookieValue = sessionCookie.split("=")[1];
        const decoded = decodeURIComponent(cookieValue);
        // Format: s:<sessionId>.<signature>
        const match = decoded.match(/^s:([^.]+)\./);
        if (match) {
          const guestSessionId = match[1];
          const sessionInput = document.createElement("input");
          sessionInput.name = "guestSessionId";
          sessionInput.value = guestSessionId;
          tempForm.appendChild(sessionInput);
          console.log("✅ [Login] Session invité envoyée:", guestSessionId);
        }
      } catch (err) {
        console.warn("⚠️ [Login] Erreur parsing cookie:", err);
      }
    }

    console.log("📤 [Login] Soumission du formulaire vers /authenticate");
    document.body.appendChild(tempForm);
    tempForm.submit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header avec animation */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Bienvenue
          </h1>
          <p className="text-gray-600">Connectez-vous à votre compte</p>
        </div>

        {/* Success message */}
        {searchParams.get("register") === "success" && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <Badge className="w-full justify-center py-2 bg-success/20 text-success hover:bg-success/20 border-green-200">
              ✓ Compte créé avec succès !
            </Badge>
          </div>
        )}

        {/* Error/Message display */}
        {(error || message) && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-6">
                <p className="text-sm text-red-800 flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  {message ? decodeURIComponent(message) : error}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Login Card */}
        <Card className="shadow-xl border-gray-200 backdrop-blur-sm bg-white/90">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Connexion
            </CardTitle>
            <CardDescription className="text-center">
              Entrez vos identifiants pour accéder à votre espace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Adresse email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  disabled={isLoading}
                  defaultValue={searchParams.get("email") || ""}
                  placeholder="vous@exemple.com"
                  className="h-11 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Mot de passe
                  </Label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="h-11 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Connexion en cours...
                  </span>
                ) : (
                  "Se connecter"
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Ou</span>
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  Vous n'avez pas encore de compte ?
                </p>
                <Link to="/register">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-2 hover:bg-gray-50 transition-all duration-200"
                  >
                    Créer un compte
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-gray-500">
          En vous connectant, vous acceptez nos conditions d'utilisation et
          notre politique de confidentialité.
        </p>
      </div>
    </div>
  );
}
