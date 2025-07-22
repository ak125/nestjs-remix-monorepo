import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useSearchParams, Link } from "@remix-run/react";
import { getOptionalUser } from "~/server/auth.server";


export const loader = async ({ request, context }: LoaderFunctionArgs) => {
    const user = await getOptionalUser({ context })
    if (user) {
        // Rediriger vers la page demandée ou le profil par défaut
        const url = new URL(request.url);
        const redirectTo = url.searchParams.get('redirectTo') || '/profile';
        return redirect(redirectTo);
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
    const errorMessage = searchParams.get("message");

    // Fonction pour obtenir le message d'erreur approprié
    const getErrorMessage = (errorType: string | null, customMessage: string | null) => {
        if (customMessage) {
            return decodeURIComponent(customMessage);
        }
        
        switch (errorType) {
            case "invalid_credentials":
                return "L'email ou le mot de passe que vous avez saisi est incorrect.";
            case "rate_limited":
                return "Trop de tentatives de connexion détectées. Veuillez réessayer dans quelques minutes.";
            case "account_disabled":
                return "Votre compte est désactivé. Veuillez contacter l'administrateur.";
            case "email_not_found":
                return "Aucun compte associé à cette adresse email.";
            case "user_exists":
                return "Cet utilisateur existe déjà.";
            case "creation_failed":
                return "Erreur lors de la création du compte.";
            case "server_error":
                return "Erreur serveur, veuillez réessayer.";
            default:
                return errorType ? "Une erreur s'est produite lors de la connexion." : null;
        }
    };

    const displayErrorMessage = getErrorMessage(error, errorMessage);

    return (
        <div className='max-w-[600px] mx-auto'>
            <h1>Connexion</h1>

            {registerSuccess && (
                <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg border border-green-200">
                    ✅ <strong>Compte créé avec succès !</strong><br />
                    Votre email est déjà pré-rempli. Saisissez simplement votre mot de passe pour vous connecter.
                </div>
            )}

            {displayErrorMessage && (
                <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 mr-2">
                            <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-red-800">
                                Erreur de connexion
                            </h3>
                            <p className="mt-1 text-sm text-red-700">
                                {displayErrorMessage}
                            </p>
                            {error === "invalid_credentials" && (
                                <div className="mt-2 text-sm text-red-600">
                                    <p className="font-medium">Suggestions :</p>
                                    <ul className="mt-1 list-disc list-inside space-y-1">
                                        <li>Vérifiez que votre email est correctement saisi</li>
                                        <li>Assurez-vous que votre mot de passe est correct</li>
                                        <li>Vérifiez que la touche Caps Lock n'est pas activée</li>
                                    </ul>
                                </div>
                            )}
                            {error === "rate_limited" && (
                                <div className="mt-2 text-sm text-red-600">
                                    <p className="font-medium">Que faire :</p>
                                    <ul className="mt-1 list-disc list-inside space-y-1">
                                        <li>Attendez quelques minutes avant de réessayer</li>
                                        <li>Vérifiez vos identifiants pour éviter de nouveaux échecs</li>
                                        <li>Contactez le support si le problème persiste</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
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
            
            <div className="mt-4 text-center space-y-2">
                <p className="text-sm text-gray-600">
                    <Link to="/forgot-password" className="text-blue-600 hover:underline">
                        Mot de passe oublié ?
                    </Link>
                </p>
                <p className="text-sm text-gray-600">
                    Pas encore de compte ? {' '}
                    <Link to="/register" className="text-blue-600 hover:underline">
                        S'inscrire
                    </Link>
                </p>
            </div>
        </div>
    );
}