import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { requireUser } from "~/server/auth.server";

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });
  return json({ user });
};

export const action: ActionFunction = async ({ request, context }) => {
  console.log("🔍 DEBUG: Action POST démarrée");
  
  try {
    console.log("🔍 DEBUG: Tentative requireUser...");
    const user = await requireUser({ context });
    console.log("🔍 DEBUG: User obtenu:", user?.id);
    
    console.log("🔍 DEBUG: Lecture formData...");
    const formData = await request.formData();
    console.log("🔍 DEBUG: FormData lue");
    
    const action = formData.get("_action");
    console.log("🔍 DEBUG: Action:", action);

    if (action === "updateProfile") {
      console.log("🔍 DEBUG: Traitement updateProfile...");
      
      // Version simplifiée - juste retourner un succès sans appeler le backend
      console.log("🔍 DEBUG: Retour succès simulé");
      return json({ success: "Test réussi - pas d'appel backend" });
    }

    if (action === "changePassword") {
      console.log("🔍 DEBUG: Traitement changePassword...");
      
      // Version simplifiée - juste retourner un succès sans appeler le backend
      console.log("🔍 DEBUG: Retour succès simulé");
      return json({ success: "Test réussi - pas d'appel backend" });
    }

    console.log("🔍 DEBUG: Action non reconnue");
    return json({ error: "Action non reconnue" }, { status: 400 });
    
  } catch (error) {
    console.error("🔍 DEBUG: Erreur dans action:", error);
    return json({ error: "Erreur serveur" }, { status: 500 });
  }
};

// Le reste du composant reste identique
export default function Profile() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Profile de Test</h1>
      <p>Action POST désactivée pour debug</p>
    </div>
  );
}
