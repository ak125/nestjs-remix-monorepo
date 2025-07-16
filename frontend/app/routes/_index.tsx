import { useSearchParams } from "@remix-run/react";

export default function Index() {
  const [searchParams] = useSearchParams();
  const welcomeMessage = searchParams.get("welcome") === "true";

  return (
    <div className="flex flex-col gap-3">
      {welcomeMessage && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg border border-green-200">
          🎉 <strong>Bienvenue !</strong> Votre compte a été créé avec succès et vous êtes maintenant connecté.
        </div>
      )}
      
      <h1>AUTOMECANIK</h1>
      {/* <Button variant={"primary"}>Créer un compte</Button>
      <Button variant={"secondary"}>Créer un compte</Button> 
      <Button variant={"greenOutline"}>crée un compte</Button>
      <Button variant={"redOutline"}>crée un compte</Button>
      <Button variant={"blueOutline"}>crée un compte</Button>
      <Button variant={"oauth"}>crée un compte</Button> */}
    </div>
  );
}
