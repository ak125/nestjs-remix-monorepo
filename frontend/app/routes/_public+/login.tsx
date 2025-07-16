import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { getOptionalUser } from "~/server/auth.server";
import { useSearchParams } from "@remix-run/react";


export const loader = async ({ request, context }: LoaderFunctionArgs) => {
    const user = await getOptionalUser({ context })
    if (user) {
        return redirect('/')
    }
    return null;
};


export const action = async ({ request, context }: ActionFunctionArgs) => {
    // Cette action ne devrait pas être appelée car le formulaire poste directement vers /auth/login
    return null;
};

export default function Login() {
    const [searchParams] = useSearchParams();
    const defaultEmail = searchParams.get("email") || "";
    const registerSuccess = searchParams.get("register") === "success";
    const error = searchParams.get("error");

    return (
        <div className='max-w-[600px] mx-auto'>
            <h1>Connexion</h1>

            {registerSuccess && (
                <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
                    Compte créé avec succès, vous pouvez vous connecter.
                </div>
            )}

            {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                    {error === "user_exists" && "Cet utilisateur existe déjà."}
                    {error === "creation_failed" && "Erreur lors de la création du compte."}
                    {error === "server_error" && "Erreur serveur, veuillez réessayer."}
                    {!["user_exists", "creation_failed", "server_error"].includes(error) && "Erreur inconnue."}
                </div>
            )}

            <form
                method='POST'
                action='/auth/login'
                className='flex flex-col gap-4'
            >
                <div>
                    <label htmlFor="email">Adresse e-mail</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        className="w-full p-2 border rounded"
                        defaultValue={defaultEmail}
                    />
                </div>

                <div>
                    <label htmlFor="password">Mot de passe</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        required
                        className="w-full p-2 border rounded"
                    />
                </div>

                <button 
                    type='submit'
                    className='ml-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600'
                >
                    Se connecter
                </button>
            </form>
        </div>
    );
}