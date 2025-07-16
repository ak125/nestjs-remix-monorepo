import { json, type ActionFunction, type LoaderFunction, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { requireUser } from "~/server/auth.server";

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });
  return json({ user });
};

export const action: ActionFunction = async ({ request, context }) => {
  console.log("🔍 DEBUG: Action POST Profile ALTERNATIVE démarrée");
  
  try {
    console.log("🔍 DEBUG: Lecture du body directement...");
    
    // Essayer de lire le body directement plutôt que via formData
    const body = await request.text();
    console.log("🔍 DEBUG: Body reçu:", body);
    
    // Parser manuellement les données URL-encoded
    const params = new URLSearchParams(body);
    const action = params.get("_action");
    
    console.log("🔍 DEBUG: Action parsée:", action);
    console.log("🔍 DEBUG: Tous les paramètres:", Array.from(params.entries()));
    
    // Version simplifiée - pas de requireUser pour l'instant
    console.log("🔍 DEBUG: Traitement sans requireUser...");

    if (action === "updateProfile") {
      console.log("🔍 DEBUG: Simulation updateProfile...");
      
      const profileData = {
        firstName: params.get("firstName"),
        lastName: params.get("lastName"),
        email: params.get("email"),
        tel: params.get("tel"),
        address: params.get("address"),
        city: params.get("city"),
        zipCode: params.get("zipCode"),
        country: params.get("country"),
      };
      
      console.log("🔍 DEBUG: Données profil parsées:", profileData);
      
      // Simulation de traitement - pas d'appel backend
      return json({ success: "Profil mis à jour avec succès (simulation alternative)" });
    }

    if (action === "changePassword") {
      console.log("🔍 DEBUG: Simulation changePassword...");
      
      const passwordData = {
        currentPassword: params.get("currentPassword"),
        newPassword: params.get("newPassword"),
        confirmPassword: params.get("confirmPassword"),
      };
      
      console.log("🔍 DEBUG: Données mot de passe parsées:", passwordData);
      
      // Simulation de traitement - pas d'appel backend
      return json({ success: "Mot de passe changé avec succès (simulation alternative)" });
    }

    console.log("🔍 DEBUG: Action non reconnue:", action);
    return json({ error: "Action non reconnue" }, { status: 400 });
    
  } catch (error) {
    console.error("🔍 DEBUG: Erreur générale dans action:", error);
    return json({ error: "Erreur du serveur" }, { status: 500 });
  }
};

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  
  const updateStatus = searchParams.get("update");
  const passwordStatus = searchParams.get("password");
  const error = searchParams.get("error");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Mon Profil (Version Alternative)</h1>

        {(updateStatus === "success" || actionData?.success) && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              {actionData?.success || "Profil mis à jour avec succès"}
            </AlertDescription>
          </Alert>
        )}

        {(error || actionData?.error) && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {actionData?.error || "Une erreur s'est produite"}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="password">Mot de passe</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>
                  Mettez à jour vos informations personnelles (Version Alternative)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form method="post">
                  <input type="hidden" name="_action" value="updateProfile" />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        defaultValue={user?.firstName || ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        defaultValue={user?.lastName || ""}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={user?.email || ""}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Mettre à jour le profil
                  </Button>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Changer le mot de passe</CardTitle>
                <CardDescription>
                  Mettez à jour votre mot de passe (Version Alternative)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Form method="post">
                  <input type="hidden" name="_action" value="changePassword" />
                  
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                    <Input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Changer le mot de passe
                  </Button>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
