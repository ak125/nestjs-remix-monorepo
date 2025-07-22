import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useSearchParams, Link } from "@remix-run/react";
import { getOptionalUser } from "~/server/auth.server";

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

export const action = async ({ request, context }: ActionFunctionArgs) => {
    // Cette action ne devrait pas être appelée car le formulaire poste directement vers /auth/register
    return null;
};

export default function Register() {
    const [searchParams] = useSearchParams();
    const error = searchParams.get("error");

    return (
        <div className='max-w-[600px] mx-auto'>
            <h1>Création de compte</h1>
            
            <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                ℹ️ <strong>Information :</strong> Après avoir créé votre compte, vous serez automatiquement connecté et redirigé vers la page d'accueil.
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
                    {error === "user_exists" && (
                        <>
                            ⚠️ <strong>Utilisateur existant :</strong> Un compte avec cette adresse email existe déjà. 
                            <Link to="/login" className="underline ml-2">Se connecter</Link>
                        </>
                    )}
                    {error === "creation_failed" && (
                        <>
                            ❌ <strong>Erreur :</strong> Impossible de créer le compte. Veuillez réessayer.
                        </>
                    )}
                    {error === "server_error" && (
                        <>
                            🔧 <strong>Erreur serveur :</strong> Problème technique temporaire. Veuillez réessayer dans quelques instants.
                        </>
                    )}
                </div>
            )}
            
            <form
                method='POST'
                action='/auth/register'
                className='flex flex-col gap-4'
            >
                <div>
                    <label htmlFor='firstname'>Votre prénom</label>
                    <input
                        id='firstname'
                        name='firstname'
                        type='text'
                        required
                        className='w-full p-2 border rounded'
                    />
                </div>

                <div>
                    <label htmlFor='lastname'>Votre nom</label>
                    <input
                        id='lastname'
                        name='lastname'
                        type='text'
                        required
                        className='w-full p-2 border rounded'
                    />
                </div>

                <div>
                    <label htmlFor='email'>Adresse e-mail</label>
                    <input
                        id='email'
                        name='email'
                        type='email'
                        required
                        className='w-full p-2 border rounded'
                    />
                </div>

                <div>
                    <label htmlFor='password'>Mot de passe</label>
                    <input
                        id='password'
                        name='password'
                        type='password'
                        required
                        className='w-full p-2 border rounded'
                    />
                </div>

                <button 
                    type='submit'
                    className='ml-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
                >
                    Je crée mon compte
                </button>
            </form>
        </div>
    );
}
