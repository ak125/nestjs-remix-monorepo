import { 
  json, 
  redirect,
  type ActionFunctionArgs, 
  type LoaderFunctionArgs 
} from "@remix-run/node";
import { Form, useActionData, Link } from "@remix-run/react";
import { z } from "zod";
import { getOptionalUser } from "~/server/auth.server";

const RegisterSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  confirmPassword: z.string(),
  firstName: z.string().min(2, "Prénom requis"),
  lastName: z.string().min(2, "Nom requis"),
  phone: z.string().optional(),
  civility: z.enum(["M", "Mme", "Autre"]),
  newsletterOptIn: z.boolean().optional(),
  // Adresse de facturation
  billingAddress: z.object({
    address1: z.string().min(5, "Adresse requise"),
    address2: z.string().optional(),
    postalCode: z.string().regex(/^\d{5}$/, "Code postal invalide"),
    city: z.string().min(2, "Ville requise"),
    country: z.string().default("FR"),
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getOptionalUser({ context });
  if (user) {
    // Rediriger vers la page demandée ou le profil par défaut
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo') || '/profile';
    return redirect(redirectTo);
  }
  return null;
};

export async function action({ request }: ActionFunctionArgs) {
  // Équivalent à myspace.subscribe.php
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  
  try {
    // Parser et valider les données
    const userData = {
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      civility: data.civility,
      newsletterOptIn: data.newsletterOptIn === "on",
      billingAddress: {
        address1: data["billing.address1"],
        address2: data["billing.address2"],
        postalCode: data["billing.postalCode"],
        city: data["billing.city"],
        country: data["billing.country"] || "FR",
      },
    };

    const validated = RegisterSchema.parse(userData);
    
    // Créer l'utilisateur via l'API backend
    console.log('🔍 DEBUG: Appel API register avec:', validated);
    
    const response = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validated),
    });

    const result = await response.json();
    console.log('🔍 DEBUG: Réponse API register:', result);

    if (!response.ok) {
      if (response.status === 409) {
        return json(
          { error: "Cet email est déjà utilisé" },
          { status: 409 }
        );
      }
      return json(
        { error: result.message || "Erreur lors de la création du compte" },
        { status: response.status }
      );
    }

    // Redirection vers la page de bienvenue avec token de session
    if (result.sessionToken) {
      console.log('🔍 DEBUG: Redirection avec token:', result.sessionToken);
      return redirect(`/authenticate?token=${result.sessionToken}`);
    }

    // Si succès mais pas de token, redirection vers login
    if (result.success) {
      console.log('🔍 DEBUG: Succès sans token, redirection vers login');
      return redirect("/login?message=Compte créé avec succès, veuillez vous connecter");
    }

    // Redirection par défaut
    console.log('🔍 DEBUG: Redirection par défaut');
    return redirect("/account/welcome");

  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        { errors: error.flatten() },
        { status: 400 }
      );
    }
    return json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6">Créer un compte</h1>

        <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
          ℹ️ <strong>Information :</strong> Après avoir créé votre compte, vous serez automatiquement connecté et redirigé vers la page d'accueil.
        </div>

        {actionData?.error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
            ❌ {actionData.error}
          </div>
        )}

        {actionData?.errors && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
            <ul className="list-disc list-inside">
              {Object.entries(actionData.errors.fieldErrors).map(([field, errors]) => (
                <li key={field}>{field}: {errors?.join(', ')}</li>
              ))}
            </ul>
          </div>
        )}

        <Form method="post" className="space-y-6">
          {/* Informations personnelles */}
          <fieldset className="border border-gray-200 rounded-lg p-6">
            <legend className="text-lg font-semibold px-3">Informations personnelles</legend>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="civility" className="block text-sm font-medium text-gray-700 mb-1">
                  Civilité
                </label>
                <select 
                  id="civility" 
                  name="civility" 
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="M">M.</option>
                  <option value="Mme">Mme</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 8 caractères</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </fieldset>

          {/* Adresse de facturation */}
          <fieldset className="border border-gray-200 rounded-lg p-6">
            <legend className="text-lg font-semibold px-3">Adresse de facturation</legend>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="billing.address1" className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                <input
                  id="billing.address1"
                  name="billing.address1"
                  type="text"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="billing.address2" className="block text-sm font-medium text-gray-700 mb-1">
                  Complément d'adresse
                </label>
                <input
                  id="billing.address2"
                  name="billing.address2"
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="billing.postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Code postal
                  </label>
                  <input
                    id="billing.postalCode"
                    name="billing.postalCode"
                    type="text"
                    pattern="[0-9]{5}"
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="billing.city" className="block text-sm font-medium text-gray-700 mb-1">
                    Ville
                  </label>
                  <input
                    id="billing.city"
                    name="billing.city"
                    type="text"
                    required
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <input type="hidden" name="billing.country" value="FR" />
            </div>
          </fieldset>

          <div className="flex items-center space-x-3">
            <input
              name="newsletterOptIn"
              type="checkbox"
              id="newsletterOptIn"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="newsletterOptIn" className="text-sm text-gray-700">
              Je souhaite recevoir la newsletter
            </label>
          </div>

          <div className="flex justify-between items-center pt-6">
            <Link 
              to="/login" 
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Déjà un compte ? Se connecter
            </Link>
            
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 font-medium"
            >
              Créer mon compte
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
