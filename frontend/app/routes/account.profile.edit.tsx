import { Alert } from '@fafa/ui';
import { json, redirect, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { User, Save, ArrowLeft } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
};

type LoaderData = {
  user: User;
};

type ActionData = {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
};

export const loader: LoaderFunction = async ({ request, context }) => {
  // Authentification requise
  const authUser = await requireUser({ context });
  
  try {
    // TODO: Récupérer le profil complet depuis l'API
    const user: User = {
      id: authUser.id,
      email: authUser.email,
      firstName: authUser.firstName || "",
      lastName: authUser.lastName || "",
      phone: "", // TODO: Récupérer depuis l'API
      status: "active"
    };

    return json<LoaderData>({ user });
  } catch (error) {
    console.error("Erreur chargement profil:", error);
    throw redirect("/account/profile");
  }
};

export const action: ActionFunction = async ({ request, context }) => {
  // Authentification requise
  const authUser = await requireUser({ context });
  
  const formData = await request.formData();
  const firstName = formData.get("firstName")?.toString() || "";
  const lastName = formData.get("lastName")?.toString() || "";
  const phone = formData.get("phone")?.toString() || "";

  // Validation
  const fieldErrors: ActionData["fieldErrors"] = {};
  
  if (!firstName.trim()) {
    fieldErrors.firstName = "Le prénom est requis";
  }
  
  if (!lastName.trim()) {
    fieldErrors.lastName = "Le nom est requis";
  }
  
  if (phone && !/^[+]?[0-9\s-()]{10,}$/.test(phone)) {
    fieldErrors.phone = "Format de téléphone invalide";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json<ActionData>({ fieldErrors }, { status: 400 });
  }

  try {
    // TODO: Appel API pour mettre à jour le profil
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    
    const response = await fetch(`${baseUrl}/api/legacy-users/${authUser.id}`, {
      method: 'PUT',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || ''
      },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined
      })
    });

    if (!response.ok) {
      console.error(`Update profile API error: ${response.status}`);
      return json<ActionData>({ 
        error: "Erreur lors de la mise à jour du profil" 
      }, { status: 500 });
    }

    return redirect("/account/profile?updated=true");
  } catch (error) {
    console.error("Erreur mise à jour profil:", error);
    return json<ActionData>({ 
      error: "Erreur lors de la mise à jour du profil" 
    }, { status: 500 });
  }
};

export default function AccountProfileEdit() {
  const { user } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <a href="/account/profile">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modifier le profil</h1>
          <p className="text-gray-600">Mettez à jour vos informations personnelles</p>
        </div>
      </div>

      {/* Messages de statut */}
      {actionData?.success && (
        <Alert intent="success"><p>Profil mis à jour avec succès !</p></Alert>
      )}

      {actionData?.error && (
        <Alert intent="error"><p>{actionData.error}</p></Alert>
      )}

      {/* Formulaire de modification */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-muted rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Informations personnelles</h3>
          </div>

          <Form method="post" className="space-y-4">
            {/* Email (lecture seule) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <Badge variant="outline">Non modifiable</Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                L'adresse email ne peut pas être modifiée. Contactez le support si nécessaire.
              </p>
            </div>

            {/* Prénom */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                Prénom *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                defaultValue={user.firstName}
                required
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  actionData?.fieldErrors?.firstName 
                    ? "border-destructive bg-destructive/10" 
                    : "border-gray-300"
                }`}
                placeholder="Votre prénom"
              />
              {actionData?.fieldErrors?.firstName && (
                <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.firstName}</p>
              )}
            </div>

            {/* Nom */}
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Nom *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                defaultValue={user.lastName}
                required
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  actionData?.fieldErrors?.lastName 
                    ? "border-destructive bg-destructive/10" 
                    : "border-gray-300"
                }`}
                placeholder="Votre nom"
              />
              {actionData?.fieldErrors?.lastName && (
                <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.lastName}</p>
              )}
            </div>

            {/* Téléphone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                defaultValue={user.phone}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  actionData?.fieldErrors?.phone 
                    ? "border-destructive bg-destructive/10" 
                    : "border-gray-300"
                }`}
                placeholder="+33 6 12 34 56 78"
              />
              {actionData?.fieldErrors?.phone && (
                <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.phone}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Format international recommandé (ex: +33 6 12 34 56 78)
              </p>
            </div>

            {/* Statut (lecture seule) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut du compte
              </label>
              <Badge variant={user.status === "active" ? "default" : "destructive"}>
                {user.status === "active" ? "Actif" : "Inactif"}
              </Badge>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-4 pt-6">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
              
              <Button type="button" variant="outline" asChild>
                <a href="/account/profile">
                  Annuler
                </a>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* Informations */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              <strong>Note :</strong> Les modifications peuvent prendre quelques minutes pour être prises en compte.
            </p>
            <p>
              Les champs marqués d'un astérisque (*) sont obligatoires.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
