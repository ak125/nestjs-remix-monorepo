/**
 * Composant d'historique d'activité utilisateur
 * Affiche les activités récentes (connexions, commandes, modifications)
 */

import { Clock, Package, User, Shield, MapPin } from "lucide-react";
import { memo } from "react";

import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export interface ActivityItem {
  id: string;
  type:
    | "login"
    | "order"
    | "profile_update"
    | "password_change"
    | "address_add";
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  maxItems?: number;
}

function getActivityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "login":
      return <Shield className="h-4 w-4" />;
    case "order":
      return <Package className="h-4 w-4" />;
    case "profile_update":
      return <User className="h-4 w-4" />;
    case "password_change":
      return <Shield className="h-4 w-4" />;
    case "address_add":
      return <MapPin className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getActivityColor(type: ActivityItem["type"]) {
  switch (type) {
    case "login":
      return "text-primary bg-primary/10";
    case "order":
      return "text-success bg-success/10";
    case "profile_update":
      return "text-purple-500 bg-purple-50";
    case "password_change":
      return "text-destructive bg-destructive/10";
    case "address_add":
      return "text-orange-500 bg-orange-50";
    default:
      return "text-gray-500 bg-gray-50";
  }
}

function getActivityLabel(type: ActivityItem["type"]) {
  switch (type) {
    case "login":
      return "Connexion";
    case "order":
      return "Commande";
    case "profile_update":
      return "Profil";
    case "password_change":
      return "Sécurité";
    case "address_add":
      return "Adresse";
    default:
      return "Activité";
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export const ActivityTimeline = memo(function ActivityTimeline({
  activities,
  maxItems = 10,
}: ActivityTimelineProps) {
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Activité récente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayedActivities.length > 0 ? (
          <div className="space-y-4">
            {displayedActivities.map((activity, index) => (
              <div key={activity.id} className="flex gap-4 relative">
                {/* Ligne verticale de connexion */}
                {index < displayedActivities.length - 1 && (
                  <div className="absolute left-4 top-10 w-px h-full bg-gray-200" />
                )}

                {/* Icône */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)} relative z-10`}
                >
                  {getActivityIcon(activity.type)}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{activity.title}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.description}
                      </p>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-xs">
                      {getActivityLabel(activity.type)}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune activité récente</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// Variante compacte
export const ActivityTimelineCompact = memo(function ActivityTimelineCompact({
  activities,
  maxItems = 5,
}: ActivityTimelineProps) {
  const displayedActivities = activities.slice(0, maxItems);

  return (
    <div className="space-y-3">
      {displayedActivities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.type)}`}
          >
            {getActivityIcon(activity.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{activity.title}</p>
            <p className="text-xs text-gray-500">
              {formatTimeAgo(activity.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});
