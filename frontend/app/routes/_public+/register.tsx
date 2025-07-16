import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { getOptionalUser } from "~/server/auth.server";

export const loader = async ({ context }: LoaderFunctionArgs) => {
    const user = await getOptionalUser({ context });
    if (user) {
        return redirect('/');
    }
    return null;
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
    // Cette action ne devrait pas être appelée car le formulaire poste directement vers /auth/register
    return null;
};

export default function Register() {
    return (
        <div className='max-w-[600px] mx-auto'>
            <h1>Création de compte</h1>
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
