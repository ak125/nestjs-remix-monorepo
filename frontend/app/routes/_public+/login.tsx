import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { loginSchema } from "~/schemas/auth";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { getProxyHeaders } from "~/utils/proxy-headers.server";
import { safeRedirect } from "~/utils/safe-redirect.server";
import { getOptionalUser } from "../../auth/unified.server";

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
    return redirect("/account/dashboard");
  }
  return json({
    googleClientId: process.env.VITE_GOOGLE_CLIENT_ID || "",
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return json(
      { ok: false as const, errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const redirectTo = safeRedirect(formData.get("redirectTo") as string | null);
  const rememberMe = formData.get("rememberMe") === "on";

  // Appel interne au backend (même pattern que unified.server.ts)
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("Cookie") || "",
        ...getProxyHeaders(request),
      },
      body: JSON.stringify({
        email: parsed.data.email,
        password: parsed.data.password,
        rememberMe,
      }),
    });
  } catch {
    return json(
      {
        ok: false as const,
        formError: "Erreur de connexion au serveur. Veuillez réessayer.",
      },
      { status: 500 },
    );
  }

  // Gérer les redirects inattendus du backend (Passport)
  if (backendResponse.status >= 300 && backendResponse.status < 400) {
    return json(
      {
        ok: false as const,
        formError: "Email ou mot de passe incorrect.",
      },
      { status: 401 },
    );
  }

  if (!backendResponse.ok) {
    const body = await backendResponse.json().catch(() => null);
    return json(
      {
        ok: false as const,
        formError: body?.message || "Email ou mot de passe incorrect.",
      },
      { status: 401 },
    );
  }

  // Forward Set-Cookie du backend vers le browser
  const headers = new Headers();
  const setCookies =
    backendResponse.headers.getSetCookie?.() ??
    [backendResponse.headers.get("set-cookie")].filter(Boolean);
  for (const cookie of setCookies) {
    if (cookie) headers.append("Set-Cookie", cookie);
  }

  // Déterminer la destination de redirect selon le rôle
  const data = await backendResponse.json().catch(() => ({}));
  const user = data.user;
  let destination = redirectTo;
  if (destination === "/account" || destination === "/account/dashboard") {
    const level = parseInt(String(user?.level)) || 0;
    if (user?.isAdmin && level >= 7) destination = "/admin";
    else if (user?.isPro) destination = "/commercial";
  }

  return redirect(destination, { headers });
}

export default function LoginPage() {
  const { googleClientId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = navigation.state === "submitting";
  const error =
    (actionData && "formError" in actionData ? actionData.formError : null) ||
    searchParams.get("error") ||
    googleError;
  const fieldErrors =
    actionData && "errors" in actionData ? actionData.errors : null;
  const message = searchParams.get("message");

  return (
    <>
      {/* Hero sombre — aligné charte homepage */}
      <section className="bg-gradient-to-b from-v9-navy to-v9-navy-light">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 pt-8 pb-16 lg:pt-12 lg:pb-20 text-center">
          <h1 className="text-[28px] lg:text-[42px] font-extrabold leading-[1.1] tracking-tight text-white font-v9-heading">
            Connectez-vous à votre espace
          </h1>
          <p className="text-[14px] lg:text-[16px] text-white/60 font-v9-body max-w-xl mx-auto mt-3">
            Retrouvez vos commandes, vos véhicules et vos pièces compatibles.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {["Suivi de commande", "Historique d'achats", "Vos véhicules"].map(
              (chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 lg:px-4 lg:py-2.5 text-[12px] lg:text-[13px] font-medium text-white/70"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Card flottante — remonte sur le hero */}
      <div className="relative z-10 -mt-8 lg:-mt-12 pb-16">
        <div className="max-w-md mx-auto px-5 lg:px-8">
          {/* Success message après inscription */}
          {searchParams.get("register") === "success" && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 font-v9-body flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Compte créé avec succès !
            </div>
          )}

          {/* Error/Message display */}
          {(error || message) && (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-v9-body flex items-center gap-2"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {message ? decodeURIComponent(message) : error}
            </div>
          )}

          <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(2,6,23,0.08)] overflow-hidden">
            <div className="p-6 sm:p-8 lg:p-10">
              {/* Google Sign-In */}
              {googleClientId && (
                <div className="mb-6">
                  <GoogleSignInButton
                    clientId={googleClientId}
                    text="signin_with"
                    onError={(err) => setGoogleError(err)}
                  />
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">
                        Ou par email
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Form method="post" className="space-y-5">
                <input
                  type="hidden"
                  name="redirectTo"
                  value={searchParams.get("redirectTo") || ""}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="email">Adresse email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    disabled={isLoading}
                    defaultValue={searchParams.get("email") || ""}
                    placeholder="vous@exemple.com"
                    className="h-12 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                    autoComplete="email"
                  />
                  {fieldErrors?.email ? (
                    <p className="text-xs text-red-600" aria-live="polite">
                      {fieldErrors.email[0]}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-cta hover:text-cta-hover transition-colors"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      disabled={isLoading}
                      placeholder="••••••••"
                      className="h-12 pr-10 rounded-2xl bg-white border-slate-200 text-sm placeholder:text-slate-400 focus-visible:border-cta focus-visible:ring-4 focus-visible:ring-cta/10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-cta/50 focus:outline-none rounded-lg transition-colors"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors?.password ? (
                    <p className="text-xs text-red-600" aria-live="polite">
                      {fieldErrors.password[0]}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    name="rememberMe"
                    className="h-4 w-4 rounded border-slate-300 text-cta focus:ring-cta/50"
                  />
                  <Label
                    htmlFor="rememberMe"
                    className="text-sm text-slate-600 font-normal cursor-pointer"
                  >
                    Se souvenir de moi
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-cta hover:bg-cta-hover text-white font-bold text-base rounded-2xl shadow-[0_12px_30px_rgba(249,115,22,0.28)] transition-colors"
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
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Connexion en cours...
                    </span>
                  ) : (
                    "Se connecter"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <p className="text-sm text-slate-600 font-v9-body">
                    Pas encore de compte ?{" "}
                    <Link
                      to="/register"
                      className="text-cta hover:text-cta-hover font-medium"
                    >
                      Créer mon compte
                    </Link>
                  </p>
                </div>
              </Form>
            </div>
          </div>

          {/* Mention légale */}
          <p className="text-center text-xs text-slate-400 font-v9-body mt-6">
            En vous connectant, vous acceptez nos{" "}
            <Link to="/cgv" className="underline hover:text-slate-600">
              conditions d'utilisation
            </Link>{" "}
            et notre{" "}
            <Link
              to="/confidentialite"
              className="underline hover:text-slate-600"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
