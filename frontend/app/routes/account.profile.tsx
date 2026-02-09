import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { User, Mail, Phone, Calendar, Shield, Edit } from "lucide-react";

import { Error404 } from "~/components/errors/Error404";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { requireAuth } from "../auth/unified.server";
import { AccountLayout } from "../components/account/AccountNavigation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { PublicBreadcrumb } from "../components/ui/PublicBreadcrumb";

export const meta: MetaFunction = () => [
  { title: "Mon profil | AutoMecanik" },
  { name: "robots", content: "noindex, nofollow" },
  {
    tagName: "link",
    rel: "canonical",
    href: "https://www.automecanik.com/account/profile",
  },
];

type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  level?: number;
  isPro?: boolean;
  completeness?: number;
};

type LoaderData = {
  user: UserProfile;
  stats?: any;
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const user = await requireAuth(request);

    if (!user) {
      throw new Response("Non authentifié", { status: 401 });
    }

    // Construire un profil par défaut avec les données de session
    const defaultProfile = {
      id: user.id || "",
      email: user.email || "",
      firstName: user.firstName || "Utilisateur",
      lastName: user.lastName || "",
      phone: "",
      status: "active",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      level: 1,
      isPro: false,
      completeness: 60,
    };

    // Essayer de récupérer le profil complet depuis l'API
    try {
      const baseUrl = getInternalApiUrl("");
      const profileResponse = await fetch(`${baseUrl}/api/users/profile`, {
        headers: {
          Cookie: request.headers.get("Cookie") || "",
        },
      });

      if (profileResponse.ok) {
        const { data } = await profileResponse.json();
        return json<LoaderData>({
          user: { ...defaultProfile, ...data },
          stats: {},
        });
      }
    } catch (apiError) {
      logger.warn("API profile fetch failed, using default:", apiError);
    }

    // Retourner le profil par défaut si l'API échoue
    return json<LoaderData>({
      user: defaultProfile,
      stats: {},
    });
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("Erreur chargement profil:", error);
    throw new Response("Erreur chargement profil", { status: 500 });
  }
};

export default function AccountProfile() {
  const { user } = useLoaderData<LoaderData>();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Erreur de chargement du profil</p>
          <Button asChild>
            <Link to="/account/dashboard">Retour au dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AccountLayout
      user={user}
      stats={{ orders: { pending: 0 }, messages: { unread: 0 } }}
    >
      <div className="space-y-6">
        {/* Breadcrumb */}
        <PublicBreadcrumb
          items={[
            { label: "Mon Compte", href: "/account" },
            { label: "Mon Profil" },
          ]}
        />

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
                <label className="text-sm font-medium text-gray-500">
                  Prénom
                </label>
                <p className="text-gray-900 font-medium">{user.firstName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Nom</label>
                <p className="text-gray-900 font-medium">{user.lastName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Email
                </label>
                <p className="text-gray-900 font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Téléphone
                </label>
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
              <Badge
                variant={user.status === "active" ? "default" : "destructive"}
              >
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
                  : "Jamais"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-4">
          <Button asChild variant="outline">
            <Link to="/account/dashboard">Retour au dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/account/security">Gérer la sécurité</Link>
          </Button>
        </div>
      </div>
    </AccountLayout>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
