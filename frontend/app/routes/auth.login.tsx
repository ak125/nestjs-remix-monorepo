import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { getOptionalUser } from "~/server/auth.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
    const user = await getOptionalUser({ context })
    if (user) {
        return redirect('/')
    }
    return null;
};

// Cette route n'est plus utilisée car le formulaire poste directement vers /authenticate
// On garde juste le loader pour éviter les erreurs de routing
export const action = async ({ request }: ActionFunctionArgs) => {
    return redirect('/login?error=route_deprecated');
};

export default function AuthLogin() {
    return null;
}
