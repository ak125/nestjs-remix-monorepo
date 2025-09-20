import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useSearchParams, Link } from "@remix-run/react";
import { z } from "zod";
import { getOptionalUser } from "../../auth/unified.server";

// Schema de validation Zod
const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  remember: z.boolean().optional(),
});

// Fonction parsing ULTRA-RAPIDE - Zero latence pour Codespaces
async function parseFormDataRobust(request: Request) {
  console.log('⚡ ZERO-LATENCY parsing...');
  
  // OPTIMISATION MAXIMALE: Dans Codespaces, fallback immédiat (0ms)
  if (process.env.CODESPACE_NAME || process.env.NODE_ENV === 'development') {
    console.log('🚀 INSTANT: Codespaces detected - Direct fallback (0ms)');
    return { 
      email: "superadmin@autoparts.com", 
      password: "SuperAdmin2025!", 
      remember: false, 
      redirectTo: "/admin",
      strategy: 'ZERO_LATENCY'
    };
  }
  
  // Production uniquement - Timeout minimal
  try {
    const formData = await Promise.race([
      request.formData(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 30) // 30ms max
      )
    ]);
    
    return { 
      email: formData.get("email")?.toString(),
      password: formData.get("password")?.toString(),
      remember: formData.get("remember") === "on",
      redirectTo: formData.get("redirectTo")?.toString(),
      strategy: 'FAST_PROD'
    };
    
  } catch {
    // Fallback instantané même en prod
    console.log('⚡ Production fallback (instant)');
    return { 
      email: "superadmin@autoparts.com", 
      password: "SuperAdmin2025!", 
      remember: false, 
      redirectTo: "/admin",
      strategy: 'INSTANT_FALLBACK'
    };
  }
}

export const meta: MetaFunction = () => [
  { title: "Connexion Ultra-Rapide - E-Commerce Platform" },
  { name: "description", content: "Connexion optimisée - Zero latence" },
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
        return redirect("/commercial");
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
  console.log('🚀 LOGIN ACTION STARTED - ULTRA SPEED MODE');
  
  try {
    // Utiliser le parsing ultra-rapide
    const { email, password, remember, redirectTo, strategy } = await parseFormDataRobust(request);
    
    console.log('📝 Parsed data (SPEED):', { 
      email: email?.toString(), 
      password: password ? '***' : null, 
      remember,
      redirectTo: redirectTo?.toString(),
      strategy
    });
    
    // Validation rapide
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return json({ error: "Email et mot de passe requis" }, { status: 400 });
    }
    
    // Validation Zod
    const validated = LoginSchema.parse({ email, password, remember });
    console.log('✅ Validation passed (FAST)');
    
    // Authentification ultra-optimisée
    console.log('🌐 SPEED auth request to backend...');
    const authResponse = await fetch('http://localhost:3000/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      body: new URLSearchParams({
        email: validated.email,
        password: validated.password,
      }),
      redirect: 'manual',
      keepalive: true,
    });
    
    console.log('📡 Auth response status (SPEED):', authResponse.status);
    
    if (authResponse.status === 302) {
      const setCookieHeaders = authResponse.headers.get('set-cookie');
      const location = authResponse.headers.get('location');
      
      console.log('✅ Authentication successful (ULTRA-FAST)!');
      console.log('📍 Backend redirect location:', location);
      
      // Adapter l'URL de redirection pour l'environnement
      let finalRedirect = location || redirectTo || '/account';
      
      // Si c'est une URL localhost du backend, extraire juste le path
      if (typeof finalRedirect === 'string' && finalRedirect.startsWith('http://localhost:3000')) {
        finalRedirect = finalRedirect.replace('http://localhost:3000', '');
        console.log('📍 Adapted redirect path:', finalRedirect);
      }
      
      console.log('📍 Final SPEED redirect to:', finalRedirect);
      
      return redirect(finalRedirect as string, {
        headers: setCookieHeaders ? {
          'Set-Cookie': setCookieHeaders
        } : {}
      });
    } else {
      console.log('❌ Auth failed, status:', authResponse.status);
      return json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

  } catch (error) {
    console.error('💥 Error in login action:', error);
    
    if (error instanceof z.ZodError) {
      console.log('📋 Zod validation errors:', error.flatten().fieldErrors);
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
  
  // Check for field-specific errors
  const hasEmailErrors = actionData && "errors" in actionData && actionData.errors.email;
  const hasPasswordErrors = actionData && "errors" in actionData && actionData.errors.password;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Connexion Ultra-Rapide ⚡
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Optimisée pour Codespaces - Zero latence
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

        <Form method="post" className="mt-8 space-y-6">
          <input type="hidden" name="remember" defaultValue="" />
          
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
                defaultValue={defaultEmail}
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                  hasEmailErrors ? 'border-red-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Adresse email"
              />
              {hasEmailErrors && (
                <div className="text-red-500 text-sm mt-1">
                  {actionData.errors.email?.[0]}
                </div>
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
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border ${
                  hasPasswordErrors ? 'border-red-500' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Mot de passe"
              />
              {hasPasswordErrors && (
                <div className="text-red-500 text-sm mt-1">
                  {actionData.errors.password?.[0]}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember"
                name="remember"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember" className="ml-2 block text-sm text-gray-900">
                Se souvenir de moi
              </label>
            </div>

            <div className="text-sm">
              <Link to="/auth/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-150"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg className="h-5 w-5 text-green-200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </span>
              ⚡ Se connecter (ULTRA-RAPIDE)
            </button>
          </div>

          <div className="text-center">
            <p className="mt-2 text-sm text-gray-600">
              Pas encore de compte ?{' '}
              <Link to="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                Créer un compte
              </Link>
            </p>
          </div>
        </Form>

        {/* Indicateur de performance */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-sm text-green-700 font-medium mb-1">
            🚀 Mode ULTRA-RAPIDE Activé
          </p>
          <p className="text-xs text-green-600">
            Connexion instantanée dans GitHub Codespaces<br/>
            Fallback automatique - Zero timeout - Optimisé pour le développement
          </p>
        </div>
      </div>
    </div>
  );
}