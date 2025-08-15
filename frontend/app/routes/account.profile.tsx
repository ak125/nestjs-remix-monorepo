import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { User, Mail, Phone, Calendar, Shield, Edit } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type LoaderData = {
  user: User | null;
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // TODO: Récupérer l'utilisateur depuis la session
    const user = {
      id: "1",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: "+33 6 12 34 56 78",
      status: "active",
      createdAt: "2024-01-15T10:00:00Z",
      lastLoginAt: "2025-08-12T15:30:00Z"
    };

    return json<LoaderData>({ user });
  } catch (error) {
    console.error("Erreur chargement profil:", error);
    return json<LoaderData>({ user: null });
  }
};

export default function AccountProfile() {
  const { user } = useLoaderData<LoaderData>();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Erreur de chargement du profil</p>
        <Button asChild className="mt-4">
          <Link to="/account/dashboard">Retour au dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon Profil</h1>
          <p className="text-gray-600">Gérez vos informations personnelles</p>
        </div>
        <Button asChild>
          <Link to="/account/profile/edit">
            <Edit className="w-4 h-4 mr-2" />
            Modifier
          </Link>
        </Button>
      </div>

      {/* Informations personnelles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informations personnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Prénom</label>
              <p className="text-gray-900 font-medium">{user.firstName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Nom</label>
              <p className="text-gray-900 font-medium">{user.lastName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="text-gray-900 font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Téléphone</label>
              <p className="text-gray-900 font-medium flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {user.phone || "Non renseigné"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statut du compte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Statut du compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Statut</span>
            <Badge variant={user.status === "active" ? "default" : "destructive"}>
              {user.status === "active" ? "Actif" : "Inactif"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Membre depuis</span>
            <span className="text-gray-900 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Dernière connexion</span>
            <span className="text-gray-900">
              {user.lastLoginAt 
                ? new Date(user.lastLoginAt).toLocaleDateString()
                : "Jamais"
              }
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link to="/account/dashboard">
            Retour au dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/account/security">
            Gérer la sécurité
          </Link>
        </Button>
      </div>
    </div>
  );
}
