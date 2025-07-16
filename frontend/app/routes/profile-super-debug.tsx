import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request, context }) => {
  return json({ message: "Loader OK" });
};

export const action: ActionFunction = async ({ request, context }) => {
  console.log("🔍 SUPER DEBUG: Action POST démarrée - PAS DE REQUIREUSER");
  
  try {
    console.log("🔍 SUPER DEBUG: Lecture formData...");
    const formData = await request.formData();
    console.log("🔍 SUPER DEBUG: FormData lue");
    
    const action = formData.get("_action");
    console.log("🔍 SUPER DEBUG: Action:", action);

    console.log("🔍 SUPER DEBUG: Retour succès immédiat");
    return json({ success: "Test réussi sans requireUser" });
    
  } catch (error) {
    console.error("🔍 SUPER DEBUG: Erreur:", error);
    return json({ error: "Erreur serveur" }, { status: 500 });
  }
};

export default function ProfileSuperDebug() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Super Debug Profile</h1>
      <p>Action POST sans requireUser</p>
    </div>
  );
}
