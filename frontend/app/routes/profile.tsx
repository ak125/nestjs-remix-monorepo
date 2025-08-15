import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { requireUser } from "../auth/unified.server";

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await requireUser({ context });
  
  return json({ user });
};

export const action: ActionFunction = async ({ request, context }) => {
  console.log("🔍 DEBUG: Action POST Profile démarrée");
  
  try {
    // Utiliser le body parsé par Express au lieu de request.formData()
    const parsedBody = (context as any).parsedBody;
    console.log("🔍 DEBUG: Body parsé par Express:", parsedBody);
    
    const action = parsedBody?._action;
    console.log("🔍 DEBUG: Action reçue:", action);
    
    console.log("🔍 DEBUG: Tentative requireUser avec timeout...");
    
    // Ajouter un timeout pour requireUser
    const userPromise = requireUser({ context });
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('requireUser timeout')), 5000);
    });
    
    const user = await Promise.race([userPromise, timeoutPromise]);
    console.log("🔍 DEBUG: requireUser réussi, user:", user?.id);

    if (action === "updateProfile") {
      console.log("🔍 DEBUG: Traitement updateProfile...");
      
      const profileData = {
        firstName: parsedBody?.firstName,
        lastName: parsedBody?.lastName,
        email: parsedBody?.email,
        tel: parsedBody?.tel,
        address: parsedBody?.address,
        city: parsedBody?.city,
        zipCode: parsedBody?.zipCode,
        country: parsedBody?.country,
      };

      console.log("🔍 DEBUG: Données profil:", profileData);

      try {
        console.log("🔍 DEBUG: Appel updateProfile service...");
        await context.remixService.updateProfile({
          userId: user.id,
          ...profileData
        });
        console.log("🔍 DEBUG: updateProfile réussi");
        
        return json({ success: "Profil mis à jour avec succès" });
      } catch (error) {
        console.error('🔍 DEBUG: Erreur updateProfile:', error);
        return json({ error: "Erreur lors de la mise à jour du profil" }, { status: 500 });
      }
    }

    if (action === "changePassword") {
      console.log("🔍 DEBUG: Traitement changePassword...");
      
      const passwordData = {
        currentPassword: parsedBody?.currentPassword,
        newPassword: parsedBody?.newPassword,
        confirmPassword: parsedBody?.confirmPassword,
      };

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        console.log("🔍 DEBUG: Mots de passe ne correspondent pas");
        return json({ error: "Les mots de passe ne correspondent pas" }, { status: 400 });
      }

      try {
        console.log("🔍 DEBUG: Appel changePassword service...");
        await context.remixService.changePassword({
          userId: user.id,
          currentPassword: passwordData.currentPassword as string,
          newPassword: passwordData.newPassword as string
        });
        console.log("🔍 DEBUG: changePassword réussi");
        
        return json({ success: "Mot de passe changé avec succès" });
      } catch (error) {
        console.error('🔍 DEBUG: Erreur changePassword:', error);
        return json({ error: "Erreur lors du changement de mot de passe" }, { status: 500 });
      }
    }

    console.log("🔍 DEBUG: Action non reconnue:", action);
    return json({ error: "Action non reconnue" }, { status: 400 });
    
  } catch (error) {
    console.error("🔍 DEBUG: Erreur générale dans action:", error);
    
    // Si l'utilisateur n'est pas connecté, le rediriger vers la page de connexion
    if (error instanceof Response && error.status === 302) {
      console.log("🔍 DEBUG: Redirection détectée");
      throw error;
    }
    
    if (error instanceof Error && error.message === 'requireUser timeout') {
      console.error("🔍 DEBUG: Timeout requireUser détecté");
      return json({ error: "Timeout lors de la vérification de l'utilisateur" }, { status: 500 });
    }
    
    return json({ error: "Erreur du serveur" }, { status: 500 });
  }
};

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  
  const updateStatus = searchParams.get("update");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const passwordStatus = searchParams.get("password"); // TODO: utiliser pour afficher le statut de changement de mot de passe
  const error = searchParams.get("error");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Mon Profil</h1>

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
              {error === "update_failed" && "Échec de la mise à jour"}
              {error === "password_mismatch" && "Les mots de passe ne correspondent pas"}
              {error === "password_too_short" && "Le mot de passe est trop court"}
              {error === "invalid_current_password" && "Mot de passe actuel incorrect"}
              {error === "server_error" && "Une erreur serveur est survenue"}
              {actionData?.error}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Informations personnelles</TabsTrigger>
            <TabsTrigger value="password">Mot de passe</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
                <CardDescription>
                  Modifiez vos informations personnelles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
                  <input type="hidden" name="_action" value="updateProfile" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        defaultValue={user.firstName}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        defaultValue={user.lastName}
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
                      defaultValue={user.email}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tel">Téléphone</Label>
                    <Input
                      id="tel"
                      name="tel"
                      type="tel"
                      defaultValue={user.tel}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Input
                      id="address"
                      name="address"
                      defaultValue={user.address}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Ville</Label>
                      <Input
                        id="city"
                        name="city"
                        defaultValue={user.city}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">Code postal</Label>
                      <Input
                        id="zipCode"
                        name="zipCode"
                        defaultValue={user.zipCode}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Pays</Label>
                    <Input
                      id="country"
                      name="country"
                      defaultValue={user.country}
                    />
                  </div>

                  <Button type="submit" className="w-full md:w-auto">
                    Mettre à jour le profil
                  </Button>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="password" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Changer le mot de passe</CardTitle>
                <CardDescription>
                  Modifiez votre mot de passe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form method="post" className="space-y-4">
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
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      minLength={6}
                    />
                  </div>

                  <Button type="submit" className="w-full md:w-auto">
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
