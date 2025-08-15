import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useSearchParams, Link } from "@remix-run/react";
import { z } from "zod";
import { getOptionalUser } from "../../server/auth.server";

// Schema de validation Zod
const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  remember: z.boolean().optional(),
});

export const meta: MetaFunction = () => [
  { title: "Connexion - E-Commerce Platform" },
  { name: "description", content: "Connectez-vous à votre compte" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Vérifier si l'utilisateur est déjà connecté
  const user = await getOptionalUser({ context });
  if (user) {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirectTo");
    
    // Si pas de redirection spécifiée, utiliser la logique conditionnelle
    if (!redirectTo) {
      const userLevel = user.level || 1;
      if (user.isAdmin && userLevel >= 7) {
        return redirect("/admin");
      } else if (user.isPro) {
        return redirect("/pro/dashboard");
      } else {
        return redirect("/account");
      }
    }
    
    return redirect(redirectTo);
  }

  const url = new URL(request.url);
  const message = url.searchParams.get("message");
  const error = url.searchParams.get("error");
  
  return json({ 
    message,
    error,
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  // Cette action gère l'authentification directement
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const remember = formData.get("remember") === "on";
  const redirectTo = formData.get("redirectTo");

  try {
    // Validation des données
    const validated = LoginSchema.parse({ email, password, remember });
    
    console.log('🔍 DEBUG: POST request body:', { email: validated.email, password: '***' });
    
    // Créer une nouvelle requête POST pour l'endpoint d'authentification
    const authResponse = await fetch('http://localhost:3000/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': request.headers.get('Cookie') || ''
      },
      body: new URLSearchParams({
        email: validated.email,  // Utiliser 'email' au lieu de 'username'
        password: validated.password,
      }),
      redirect: 'manual' // Important pour capturer la redirection
    });
    
    if (authResponse.status === 302) {
      // Récupération des cookies de session
      const setCookieHeaders = authResponse.headers.get('set-cookie');
      const location = authResponse.headers.get('location');
      
      console.log('✅ Authentification réussie, redirection vers:', location);
      
      // Utiliser la redirection du backend si disponible, sinon le redirectTo spécifié
      const finalRedirect = location || redirectTo || '/account';
      
      // Rediriger vers la destination finale avec les cookies de session
      return redirect(finalRedirect as string, {
        headers: setCookieHeaders ? {
          'Set-Cookie': setCookieHeaders
        } : {}
      });
    } else {
      console.log('❌ Erreur d\'authentification, status:', authResponse.status);
      
      return json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('❌ Erreur lors de la connexion:', error);
    if (error instanceof z.ZodError) {
      return json(
        { errors: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    return json(
      { error: "Une erreur est survenue lors de la connexion" },
      { status: 500 }
    );
  }
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  const defaultEmail = searchParams.get("email") || "";
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  
  // Messages d'erreur personnalisés
  const getErrorMessage = (errorType: string | null, customMessage: string | null) => {
    if (customMessage) {
      return decodeURIComponent(customMessage);
    }
    
    switch (errorType) {
      case "invalid_credentials":
        return "Email ou mot de passe incorrect";
      case "rate_limited":
        return "Trop de tentatives. Réessayez dans 15 minutes.";
      case "account_disabled":
        return "Compte désactivé. Contactez l'administrateur.";
      case "server_error":
        return "Erreur serveur, veuillez réessayer.";
      default:
        return errorType ? "Une erreur s'est produite lors de la connexion." : null;
    }
  };

  const displayErrorMessage = getErrorMessage(error, message);
  const hasError = displayErrorMessage || ("error" in (actionData || {}));
  const getErrorText = () => {
    if (displayErrorMessage) return displayErrorMessage;
    if (actionData && "error" in actionData) return actionData.error;
    return null;
  };
  const hasEmailErrors = actionData && "errors" in actionData && actionData.errors.email;
  const hasPasswordErrors = actionData && "errors" in actionData && actionData.errors.password;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Connexion
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connectez-vous à votre compte
          </p>
        </div>
        
        {/* Messages de succès */}
        {searchParams.get("register") === "success" && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  Compte créé avec succès ! Vous pouvez maintenant vous connecter.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages d'erreur */}
        {hasError && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {getErrorText()}
                </p>
              </div>
            </div>
          </div>
        )}

        <Form method="post" action="/authenticate" className="mt-8 space-y-6">
          <input
            type="hidden"
            name="redirectTo"
            value={searchParams.get("redirectTo") ?? "/account"}
          />
          
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={defaultEmail}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Adresse email"
              />
              {hasEmailErrors && (
                <p className="mt-1 text-sm text-red-600">
                  {actionData && "errors" in actionData && actionData.errors.email?.[0]}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Mot de passe"
              />
              {hasPasswordErrors && (
                <p className="mt-1 text-sm text-red-600">
                  {actionData && "errors" in actionData && actionData.errors.password?.[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="remember" className="ml-2 block text-sm text-gray-900">
                Se souvenir de moi
              </label>
            </div>

            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Se connecter
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Pas encore de compte ?{' '}
              <Link
                to="/register"
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                Créer un compte
              </Link>
            </p>
          </div>
        </Form>
      </div>
    </div>
  );
}
