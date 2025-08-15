import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Shield, Key, Smartphone, AlertTriangle, CheckCircle, Clock, Lock } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { requireAuth } from "../auth/unified.server";

type SecurityData = {
  password: {
    strength: "weak" | "medium" | "strong";
    lastChanged: string | null;
    daysOld: number;
  };
  twoFactor: {
    enabled: boolean;
    method?: "sms" | "app" | "email";
    lastUsed?: string;
  };
  sessions: {
    active: number;
    devices: Array<{
      id: string;
      device: string;
      location: string;
      lastSeen: string;
      current: boolean;
    }>;
  };
  securityScore: number;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    action: string;
  }>;
};

type LoaderData = {
  security: SecurityData;
};

export const loader: LoaderFunction = async ({ request }) => {
  // Authentification requise
  await requireAuth(request);
  
  try {
    // TODO: Récupérer les données de sécurité depuis l'API
    const security: SecurityData = {
      password: {
        strength: "medium",
        lastChanged: "2025-06-15T10:00:00Z",
        daysOld: 58
      },
      twoFactor: {
        enabled: false
      },
      sessions: {
        active: 2,
        devices: [
          {
            id: "1",
            device: "Chrome sur Windows",
            location: "Paris, France",
            lastSeen: "2025-08-12T15:30:00Z",
            current: true
          },
          {
            id: "2", 
            device: "Safari sur iPhone",
            location: "Paris, France",
            lastSeen: "2025-08-11T09:15:00Z",
            current: false
          }
        ]
      },
      securityScore: 65,
      recommendations: [
        {
          id: "1",
          title: "Activer l'authentification à deux facteurs",
          description: "Sécurisez votre compte avec une couche de protection supplémentaire",
          priority: "high",
          action: "Activer 2FA"
        },
        {
          id: "2",
          title: "Mettre à jour votre mot de passe", 
          description: "Votre mot de passe date de plus de 2 mois",
          priority: "medium",
          action: "Changer le mot de passe"
        },
        {
          id: "3",
          title: "Vérifier les sessions actives",
          description: "Vous avez 2 sessions actives sur différents appareils",
          priority: "low",
          action: "Voir les sessions"
        }
      ]
    };

    return json<LoaderData>({ security });
  } catch (error) {
    console.error("Erreur chargement sécurité:", error);
    return json<LoaderData>({ 
      security: {
        password: { strength: "weak", lastChanged: null, daysOld: 0 },
        twoFactor: { enabled: false },
        sessions: { active: 0, devices: [] },
        securityScore: 0,
        recommendations: []
      }
    });
  }
};

function SecurityScoreCard({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return CheckCircle;
    if (score >= 60) return AlertTriangle;
    return AlertTriangle;
  };

  const Icon = getScoreIcon(score);

  return (
    <Card className={`${getScoreColor(score)}`}>
      <CardContent className="p-6 text-center">
        <Icon className="w-12 h-12 mx-auto mb-4" />
        <p className="text-3xl font-bold mb-2">{score}/100</p>
        <p className="font-medium mb-2">Score de sécurité</p>
        <p className="text-sm opacity-80">
          {score >= 80 && "Excellent niveau de sécurité"}
          {score >= 60 && score < 80 && "Sécurité correcte, améliorations possibles"}
          {score < 60 && "Sécurité insuffisante, actions requises"}
        </p>
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ recommendation }: { recommendation: SecurityData['recommendations'][0] }) {
  const priorityColors = {
    high: "border-red-200 bg-red-50",
    medium: "border-yellow-200 bg-yellow-50", 
    low: "border-blue-200 bg-blue-50"
  };

  const priorityBadges = {
    high: { variant: "destructive" as const, text: "Urgent" },
    medium: { variant: "secondary" as const, text: "Important" },
    low: { variant: "outline" as const, text: "Recommandé" }
  };

  return (
    <Card className={priorityColors[recommendation.priority]}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium text-gray-900">{recommendation.title}</h3>
              <Badge variant={priorityBadges[recommendation.priority].variant}>
                {priorityBadges[recommendation.priority].text}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-3">{recommendation.description}</p>
          </div>
          <Button size="sm" variant="outline">
            {recommendation.action}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AccountSecurity() {
  const { security } = useLoaderData<LoaderData>();

  const getPasswordStrengthColor = (strength: string) => {
    switch (strength) {
      case "strong": return "text-green-600";
      case "medium": return "text-yellow-600";
      default: return "text-red-600";
    }
  };

  const getPasswordStrengthText = (strength: string) => {
    switch (strength) {
      case "strong": return "Fort";
      case "medium": return "Moyen";
      default: return "Faible";
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sécurité & Mot de passe</h1>
          <p className="text-gray-600">Gérez la sécurité de votre compte et vos paramètres de connexion</p>
        </div>
      </div>

      {/* Score de sécurité */}
      <SecurityScoreCard score={security.securityScore} />

      {/* Informations de sécurité */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mot de passe */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Key className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Mot de passe</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Force</span>
                <span className={`text-sm font-medium ${getPasswordStrengthColor(security.password.strength)}`}>
                  {getPasswordStrengthText(security.password.strength)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Dernière modification</span>
                <span className="text-sm text-gray-900">
                  {security.password.lastChanged 
                    ? `Il y a ${security.password.daysOld} jours`
                    : "Jamais modifié"
                  }
                </span>
              </div>
            </div>
            
            <Button className="w-full mt-4" variant="outline">
              <Lock className="w-4 h-4 mr-2" />
              Changer le mot de passe
            </Button>
          </CardContent>
        </Card>

        {/* Authentification à deux facteurs */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Smartphone className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Authentification 2FA</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Statut</span>
                {security.twoFactor.enabled ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Activée
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Désactivée
                  </Badge>
                )}
              </div>
              
              {security.twoFactor.enabled && security.twoFactor.method && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Méthode</span>
                  <span className="text-sm text-gray-900 capitalize">
                    {security.twoFactor.method}
                  </span>
                </div>
              )}
            </div>
            
            <Button className="w-full mt-4" variant={security.twoFactor.enabled ? "outline" : "default"}>
              <Shield className="w-4 h-4 mr-2" />
              {security.twoFactor.enabled ? "Gérer 2FA" : "Activer 2FA"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sessions actives */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Sessions actives ({security.sessions.active})</h3>
          </div>
          
          <div className="space-y-3">
            {security.sessions.devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{device.device}</p>
                    {device.current && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Session actuelle
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{device.location}</p>
                  <p className="text-xs text-gray-500">
                    Dernière activité: {new Date(device.lastSeen).toLocaleDateString()} à{' '}
                    {new Date(device.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!device.current && (
                  <Button size="sm" variant="outline">
                    Déconnecter
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommandations */}
      {security.recommendations.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recommandations de sécurité</h2>
          <div className="space-y-3">
            {security.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-4">
        <Button asChild variant="outline">
          <Link to="/account/dashboard">
            Retour au dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/account/profile">
            Voir le profil
          </Link>
        </Button>
      </div>
    </div>
  );
}
