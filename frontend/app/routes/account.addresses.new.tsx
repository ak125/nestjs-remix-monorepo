import { json, redirect, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { MapPin, Save, ArrowLeft, Home, Building } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { requireAuth } from "../lib/auth.server";

type ActionData = {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    type?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
};

export const loader: LoaderFunction = async ({ request }) => {
  // Authentification requise
  await requireAuth(request);
  return json({});
};

export const action: ActionFunction = async ({ request }) => {
  // Authentification requise
  const authUser = await requireAuth(request);
  
  const formData = await request.formData();
  const type = formData.get("type")?.toString() || "";
  const firstName = formData.get("firstName")?.toString() || "";
  const lastName = formData.get("lastName")?.toString() || "";
  const company = formData.get("company")?.toString() || "";
  const address = formData.get("address")?.toString() || "";
  const city = formData.get("city")?.toString() || "";
  const postalCode = formData.get("postalCode")?.toString() || "";
  const country = formData.get("country")?.toString() || "";
  const phone = formData.get("phone")?.toString() || "";
  const isDefault = formData.get("isDefault") === "on";

  // Validation
  const fieldErrors: ActionData["fieldErrors"] = {};
  
  if (!type || !["billing", "shipping"].includes(type)) {
    fieldErrors.type = "Type d'adresse requis";
  }
  
  if (!firstName.trim()) {
    fieldErrors.firstName = "Le prénom est requis";
  }
  
  if (!lastName.trim()) {
    fieldErrors.lastName = "Le nom est requis";
  }
  
  if (!address.trim()) {
    fieldErrors.address = "L'adresse est requise";
  }
  
  if (!city.trim()) {
    fieldErrors.city = "La ville est requise";
  }
  
  if (!postalCode.trim()) {
    fieldErrors.postalCode = "Le code postal est requis";
  } else if (!/^\d{5}$/.test(postalCode)) {
    fieldErrors.postalCode = "Code postal invalide (5 chiffres requis)";
  }
  
  if (!country.trim()) {
    fieldErrors.country = "Le pays est requis";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json<ActionData>({ fieldErrors }, { status: 400 });
  }

  try {
    // TODO: Appel API pour créer l'adresse
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    
    const response = await fetch(`${baseUrl}/api/addresses`, {
      method: 'POST',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || ''
      },
      body: JSON.stringify({
        userId: authUser.id,
        type,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        company: company.trim() || undefined,
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        phone: phone.trim() || undefined,
        isDefault
      })
    });

    if (!response.ok) {
      console.error(`Create address API error: ${response.status}`);
      return json<ActionData>({ 
        error: "Erreur lors de la création de l'adresse" 
      }, { status: 500 });
    }

    return redirect("/account/addresses?created=true");
  } catch (error) {
    console.error("Erreur création adresse:", error);
    return json<ActionData>({ 
      error: "Erreur lors de la création de l'adresse" 
    }, { status: 500 });
  }
};

export default function AccountAddressesNew() {
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <a href="/account/addresses">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </a>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle adresse</h1>
          <p className="text-gray-600">Ajoutez une nouvelle adresse de facturation ou de livraison</p>
        </div>
      </div>

      {/* Messages de statut */}
      {actionData?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{actionData.error}</p>
        </div>
      )}

      {/* Formulaire */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Informations de l'adresse</h3>
          </div>

          <Form method="post" className="space-y-4">
            {/* Type d'adresse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Type d'adresse *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="type"
                    value="billing"
                    defaultChecked
                    className="mr-3"
                  />
                  <Building className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="font-medium">Facturation</p>
                    <p className="text-sm text-gray-600">Pour les factures</p>
                  </div>
                </label>
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="type"
                    value="shipping"
                    className="mr-3"
                  />
                  <Home className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="font-medium">Livraison</p>
                    <p className="text-sm text-gray-600">Pour les expéditions</p>
                  </div>
                </label>
              </div>
              {actionData?.fieldErrors?.type && (
                <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.type}</p>
              )}
            </div>

            {/* Nom et prénom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    actionData?.fieldErrors?.firstName 
                      ? "border-red-300 bg-red-50" 
                      : "border-gray-300"
                  }`}
                  placeholder="Prénom"
                />
                {actionData?.fieldErrors?.firstName && (
                  <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.firstName}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  required
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    actionData?.fieldErrors?.lastName 
                      ? "border-red-300 bg-red-50" 
                      : "border-gray-300"
                  }`}
                  placeholder="Nom"
                />
                {actionData?.fieldErrors?.lastName && (
                  <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Entreprise (optionnel) */}
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                Entreprise (optionnel)
              </label>
              <input
                type="text"
                id="company"
                name="company"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nom de l'entreprise"
              />
            </div>

            {/* Adresse */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse *
              </label>
              <input
                type="text"
                id="address"
                name="address"
                required
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  actionData?.fieldErrors?.address 
                    ? "border-red-300 bg-red-50" 
                    : "border-gray-300"
                }`}
                placeholder="Numéro et nom de rue"
              />
              {actionData?.fieldErrors?.address && (
                <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.address}</p>
              )}
            </div>

            {/* Ville et code postal */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Code postal *
                </label>
                <input
                  type="text"
                  id="postalCode"
                  name="postalCode"
                  required
                  maxLength={5}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    actionData?.fieldErrors?.postalCode 
                      ? "border-red-300 bg-red-50" 
                      : "border-gray-300"
                  }`}
                  placeholder="75001"
                />
                {actionData?.fieldErrors?.postalCode && (
                  <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.postalCode}</p>
                )}
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                  Ville *
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  required
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    actionData?.fieldErrors?.city 
                      ? "border-red-300 bg-red-50" 
                      : "border-gray-300"
                  }`}
                  placeholder="Paris"
                />
                {actionData?.fieldErrors?.city && (
                  <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.city}</p>
                )}
              </div>
            </div>

            {/* Pays */}
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                Pays *
              </label>
              <select
                id="country"
                name="country"
                required
                defaultValue="France"
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  actionData?.fieldErrors?.country 
                    ? "border-red-300 bg-red-50" 
                    : "border-gray-300"
                }`}
              >
                <option value="">Sélectionner un pays</option>
                <option value="France">France</option>
                <option value="Belgique">Belgique</option>
                <option value="Suisse">Suisse</option>
                <option value="Canada">Canada</option>
                <option value="Autre">Autre</option>
              </select>
              {actionData?.fieldErrors?.country && (
                <p className="text-sm text-red-600 mt-1">{actionData.fieldErrors.country}</p>
              )}
            </div>

            {/* Téléphone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone (optionnel)
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+33 6 12 34 56 78"
              />
            </div>

            {/* Adresse par défaut */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                name="isDefault"
                className="mr-3 rounded"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                Définir comme adresse par défaut
              </label>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-4 pt-6">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? "Enregistrement..." : "Enregistrer l'adresse"}
              </Button>
              
              <Button type="button" variant="outline" asChild>
                <a href="/account/addresses">
                  Annuler
                </a>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
