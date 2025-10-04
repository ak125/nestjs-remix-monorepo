import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useSearchParams, Link } from "@remix-run/react";
import { getOptionalUser } from "../../auth/unified.server";

export const meta: MetaFunction = () => [
  { title: "Connexion - E-Commerce Platform" },
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
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">Connexion</h2>
          {searchParams.get("register") === "success" && (
            <p className="mt-2 text-center text-sm text-green-600">
              Compte créé avec succès !
            </p>
          )}
        </div>

        {(error || message) && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">
              {message ? decodeURIComponent(message) : error}
            </p>
          </div>
        )}

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            
            // Soumettre directement au backend via navigation native
            const params = new URLSearchParams();
            params.set('email', formData.get('email') as string);
            params.set('password', formData.get('password') as string);
            
            // Créer un formulaire temporaire et le soumettre
            const tempForm = document.createElement('form');
            tempForm.method = 'POST';
            tempForm.action = '/authenticate';
            tempForm.style.display = 'none';
            
            const emailInput = document.createElement('input');
            emailInput.name = 'email';
            emailInput.value = formData.get('email') as string;
            tempForm.appendChild(emailInput);
            
            const passwordInput = document.createElement('input');
            passwordInput.name = 'password';
            passwordInput.value = formData.get('password') as string;
            tempForm.appendChild(passwordInput);
            
            document.body.appendChild(tempForm);
            tempForm.submit();
          }}
          className="mt-8 space-y-6"
        >
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={searchParams.get("email") || ""}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="votre@email.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Se connecter
          </button>

          <p className="text-center text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link to="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
              Créer un compte
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
