/**
 * 🏢 FORMULAIRE FOURNISSEUR - Admin Interface
 * ✅ Aligné sur l'architecture des autres modules (users, orders, messages)
 * ✅ Utilise requireAdmin pour l'authentification
 * ✅ Validation Zod côté backend
 * ✅ API moderne avec gestion d'erreurs
 * ✅ Interface cohérente avec shadcn/ui
 */

import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData, Link } from "@remix-run/react";
import { requireAdmin } from "../server/auth.server";

export const meta: MetaFunction = ({ params }) => {
  return [
    { title: params.id === 'new' ? "Nouveau Fournisseur - Admin" : "Modifier Fournisseur - Admin" },
    { name: "description", content: "Formulaire de création/modification d'un fournisseur" },
  ];
};

// Types alignés avec les schémas Zod backend
interface Supplier {
  id?: number;
  code: string;
  name: string;
  companyName?: string;
  siret?: string;
  vatNumber?: string;
  address1?: string;
  address2?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  minimumOrderAmount?: number;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ActionData {
  errors?: Record<string, string>;
  error?: string;
  success?: boolean;
}

export const loader = async ({ params, context }: LoaderFunctionArgs) => {
  // Utiliser requireAdmin comme les autres modules admin
  await requireAdmin({ context });
  
  if (params.id === 'new') {
    return json({ supplier: null });
  }
  
  try {
    console.log(`🔄 Chargement fournisseur ID: ${params.id}`);
    
    // Utiliser l'API moderne alignée avec l'architecture
    const response = await fetch(`http://localhost:3000/api/suppliers-modern/${params.id}`, {
      headers: { "Internal-Call": "true" },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Response("Fournisseur non trouvé", { status: 404 });
      }
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const supplierData = await response.json();
    console.log("✅ Fournisseur chargé avec succès");
    
    return json({ supplier: supplierData.supplier });
    
  } catch (error) {
    console.error("❌ Erreur lors du chargement du fournisseur:", error);
    throw new Response("Erreur lors du chargement du fournisseur", { status: 500 });
  }
};

export const action = async ({ request, params, context }: ActionFunctionArgs) => {
  await requireAdmin({ context });
  
  const formData = await request.formData();
  const data = Object.fromEntries(formData);
  
  // Conversion des types pour correspondre aux schémas Zod
  const supplierData = {
    ...data,
    minimumOrderAmount: data.minimumOrderAmount ? parseFloat(data.minimumOrderAmount as string) : undefined,
    isActive: data.isActive === 'on' || data.isActive === 'true',
  };
  
  try {
    console.log(`🔄 ${params.id === 'new' ? 'Création' : 'Mise à jour'} fournisseur...`);
    
    if (params.id === 'new') {
      // Création d'un nouveau fournisseur
      const response = await fetch('http://localhost:3000/api/suppliers-modern', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
        },
        body: JSON.stringify(supplierData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return json({ 
          errors: errorData.errors || {},
          error: errorData.message || 'Erreur lors de la création'
        }, { status: 400 });
      }
      
      const result = await response.json();
      console.log("✅ Fournisseur créé avec succès");
      
      return redirect(`/admin/suppliers/${result.supplier.id}`);
      
    } else {
      // Mise à jour d'un fournisseur existant
      const response = await fetch(`http://localhost:3000/api/suppliers-modern/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
        },
        body: JSON.stringify(supplierData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return json({ 
          errors: errorData.errors || {},
          error: errorData.message || 'Erreur lors de la mise à jour'
        }, { status: 400 });
      }
      
      console.log("✅ Fournisseur mis à jour avec succès");
      
      return json({ success: true });
    }
    
  } catch (error) {
    console.error("❌ Erreur lors de l'action:", error);
    return json({ 
      error: "Erreur serveur lors de l'opération"
    }, { status: 500 });
  }
};

export default function SupplierForm() {
  const { supplier } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const isNew = !supplier;
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* En-tête */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          to="/admin/suppliers"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          ← Retour aux fournisseurs
        </Link>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {isNew ? 'Nouveau Fournisseur' : 'Modifier le Fournisseur'}
          </h1>
          {supplier && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                supplier.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {supplier.isActive ? "Actif" : "Inactif"}
              </span>
              <span className="text-sm text-gray-500">ID: {supplier.id}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Messages d'erreur globaux */}
      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <span className="text-sm text-red-600">{actionData.error}</span>
          </div>
        </div>
      )}
      
      {/* Message de succès */}
      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <span className="text-sm text-green-600">✅ Fournisseur mis à jour avec succès</span>
        </div>
      )}
      
      <Form method="post" className="space-y-6">
        {/* Informations principales */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              🏢 Informations Générales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code Fournisseur *
                </label>
                <input
                  type="text"
                  name="code"
                  required
                  defaultValue={supplier?.code}
                  placeholder="SUP001"
                  className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    actionData?.errors?.code ? "border-red-500" : ""
                  }`}
                />
                {actionData?.errors?.code && (
                  <span className="text-xs text-red-600">{actionData.errors.code}</span>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom Commercial *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={supplier?.name}
                  placeholder="Nom du fournisseur"
                  className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    actionData?.errors?.name ? "border-red-500" : ""
                  }`}
                />
                {actionData?.errors?.name && (
                  <span className="text-xs text-red-600">{actionData.errors.name}</span>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison Sociale
                </label>
                <input
                  type="text"
                  name="companyName"
                  defaultValue={supplier?.companyName}
                  placeholder="Raison sociale complète"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={supplier?.email}
                  placeholder="contact@fournisseur.com"
                  className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    actionData?.errors?.email ? "border-red-500" : ""
                  }`}
                />
                {actionData?.errors?.email && (
                  <span className="text-xs text-red-600">{actionData.errors.email}</span>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={supplier?.phone}
                  placeholder="+33 1 23 45 67 89"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Web
                </label>
                <input
                  type="url"
                  name="website"
                  defaultValue={supplier?.website}
                  placeholder="https://www.fournisseur.com"
                  className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    actionData?.errors?.website ? "border-red-500" : ""
                  }`}
                />
                {actionData?.errors?.website && (
                  <span className="text-xs text-red-600">{actionData.errors.website}</span>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SIRET
                </label>
                <input
                  type="text"
                  name="siret"
                  defaultValue={supplier?.siret}
                  placeholder="12345678900001"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° TVA
                </label>
                <input
                  type="text"
                  name="vatNumber"
                  defaultValue={supplier?.vatNumber}
                  placeholder="FR12345678901"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={supplier?.isActive ?? true}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium text-gray-700">Fournisseur actif</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        
        {/* Adresse */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              📍 Adresse
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse ligne 1
                </label>
                <input
                  type="text"
                  name="address1"
                  defaultValue={supplier?.address1}
                  placeholder="123 rue Example"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse ligne 2
                </label>
                <input
                  type="text"
                  name="address2"
                  defaultValue={supplier?.address2}
                  placeholder="Bâtiment A, Étage 2"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code Postal
                </label>
                <input
                  type="text"
                  name="zipCode"
                  defaultValue={supplier?.zipCode}
                  placeholder="75001"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  name="city"
                  defaultValue={supplier?.city}
                  placeholder="Paris"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pays
                </label>
                <input
                  type="text"
                  name="country"
                  defaultValue={supplier?.country || 'France'}
                  placeholder="France"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Contact et conditions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              👤 Contact & Conditions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personne de Contact
                </label>
                <input
                  type="text"
                  name="contactPerson"
                  defaultValue={supplier?.contactPerson}
                  placeholder="Jean Dupont"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fax
                </label>
                <input
                  type="text"
                  name="fax"
                  defaultValue={supplier?.fax}
                  placeholder="+33 1 23 45 67 90"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conditions de Paiement
                </label>
                <input
                  type="text"
                  name="paymentTerms"
                  defaultValue={supplier?.paymentTerms}
                  placeholder="30 jours net"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conditions de Livraison
                </label>
                <input
                  type="text"
                  name="deliveryTerms"
                  defaultValue={supplier?.deliveryTerms}
                  placeholder="Franco de port dès 500€"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant Minimum de Commande (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="minimumOrderAmount"
                  defaultValue={supplier?.minimumOrderAmount}
                  placeholder="100.00"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes Internes
                </label>
                <textarea
                  name="notes"
                  defaultValue={supplier?.notes}
                  placeholder="Notes internes sur le fournisseur..."
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <Link to="/admin/suppliers">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Annuler
            </button>
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>⏳ Enregistrement...</>
            ) : (
              <>
                💾 {isNew ? 'Créer' : 'Mettre à jour'}
              </>
            )}
          </button>
        </div>
      </Form>
    </div>
  );
}
