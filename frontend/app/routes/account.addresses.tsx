import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { MapPin, Plus, Edit2, Trash2, Home, Building } from "lucide-react";

import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

type Address = {
  id: string;
  type: "billing" | "shipping";
  isDefault: boolean;
  firstName: string;
  lastName: string;
  company?: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
};

type LoaderData = {
  addresses: Address[];
  user: any;
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const user = await requireAuth(request);
    
    if (!user) {
      throw new Response("Non authentifié", { status: 401 });
    }

    // TODO: Récupérer les adresses depuis l'API
    const addresses: Address[] = [
      {
        id: "1",
        type: "billing",
        isDefault: true,
        firstName: "John",
        lastName: "Doe",
        address: "123 Rue de la Paix",
        city: "Paris",
        postalCode: "75001",
        country: "France",
        phone: "+33 1 23 45 67 89"
      },
      {
        id: "2",
        type: "shipping",
        isDefault: false,
        firstName: "John",
        lastName: "Doe",
        company: "Mon Entreprise",
        address: "456 Avenue des Champs",
        city: "Lyon",
        postalCode: "69000",
        country: "France",
        phone: "+33 4 56 78 90 12"
      }
    ];

    return json<LoaderData>({ addresses, user });
  } catch (error) {
    console.error("Erreur chargement adresses:", error);
    throw new Response("Erreur chargement adresses", { status: 500 });
  }
};

function AddressCard({ address }: { address: Address }) {
  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {address.type === "billing" ? (
              <Building className="w-5 h-5 text-blue-600" />
            ) : (
              <Home className="w-5 h-5 text-green-600" />
            )}
            {address.type === "billing" ? "Facturation" : "Livraison"}
          </CardTitle>
          <div className="flex items-center gap-2">
            {address.isDefault && (
              <Badge variant="default">Par défaut</Badge>
            )}
            <Button size="sm" variant="outline">
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline">
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium text-gray-900">
          {address.firstName} {address.lastName}
        </p>
        {address.company && (
          <p className="text-gray-600">{address.company}</p>
        )}
        <div className="text-gray-600">
          <p>{address.address}</p>
          <p>{address.postalCode} {address.city}</p>
          <p>{address.country}</p>
        </div>
        {address.phone && (
          <p className="text-gray-600">{address.phone}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountAddresses() {
  const { addresses, user } = useLoaderData<LoaderData>();

  const billingAddresses = addresses.filter(addr => addr.type === "billing");
  const shippingAddresses = addresses.filter(addr => addr.type === "shipping");

  return (
    <AccountLayout user={user} stats={{ orders: { pending: 0 }, messages: { unread: 0 } }}>
      <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes Adresses</h1>
          <p className="text-gray-600">Gérez vos adresses de facturation et de livraison</p>
        </div>
        <Button asChild>
          <Link to="/account/addresses/new">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle adresse
          </Link>
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <MapPin className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{addresses.length}</p>
            <p className="text-sm text-gray-600">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Building className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{billingAddresses.length}</p>
            <p className="text-sm text-gray-600">Facturation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Home className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{shippingAddresses.length}</p>
            <p className="text-sm text-gray-600">Livraison</p>
          </CardContent>
        </Card>
      </div>

      {/* Adresses de facturation */}
      {billingAddresses.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Adresses de facturation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {billingAddresses.map((address) => (
              <AddressCard key={address.id} address={address} />
            ))}
          </div>
        </div>
      )}

      {/* Adresses de livraison */}
      {shippingAddresses.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Adresses de livraison</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shippingAddresses.map((address) => (
              <AddressCard key={address.id} address={address} />
            ))}
          </div>
        </div>
      )}

      {/* État vide */}
      {addresses.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune adresse enregistrée
            </h3>
            <p className="text-gray-600 mb-4">
              Ajoutez votre première adresse pour faciliter vos commandes
            </p>
            <Button asChild>
              <Link to="/account/addresses/new">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une adresse
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link to="/account/dashboard">
            Retour au dashboard
          </Link>
        </Button>
      </div>
      </div>
    </AccountLayout>
  );
}
