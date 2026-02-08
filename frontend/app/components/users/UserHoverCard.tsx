/**
 * 👤 User Hover Card - Preview rapide utilisateur au survol
 *
 * Affiche un aperçu riche au hover avec:
 * - Avatar avec fallback initiales
 * - Nom complet + email
 * - Level/rôle avec badge
 * - Dernière connexion
 * - Lien vers profil
 */

import { Link } from "@remix-run/react";
import { CalendarDays, ExternalLink, Mail, Shield, User } from "lucide-react";
import { memo } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card";

interface UserPreview {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  level: number;
  lastLogin?: string;
  ordersCount?: number;
  totalSpent?: number;
}

interface UserHoverCardProps {
  user: UserPreview;
  /** Élément qui déclenche le hover (ex: nom cliquable) */
  children: React.ReactNode;
  /** Afficher le lien "Voir profil" */
  showViewProfile?: boolean;
}

export const UserHoverCard = memo(function UserHoverCard({
  user,
  children,
  showViewProfile = true,
}: UserHoverCardProps) {
  const fullName = `${user.firstName} ${user.lastName}`;
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  // Déterminer le rôle selon le level
  const getRoleBadge = (level: number) => {
    if (level >= 9)
      return { label: "Super Admin", variant: "destructive" as const };
    if (level >= 7) return { label: "Admin", variant: "default" as const };
    if (level >= 5)
      return { label: "Modérateur", variant: "secondary" as const };
    return { label: "Utilisateur", variant: "outline" as const };
  };

  const role = getRoleBadge(user.level);

  // Formater la dernière connexion
  const formatLastLogin = (dateStr?: string) => {
    if (!dateStr) return "Jamais connecté";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 5) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString("fr-FR");
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Header avec Avatar */}
          <div className="flex items-start gap-4">
            {/* Avatar avec initiales */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg shadow-md">
              {initials}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">{fullName}</h4>
                <Badge variant={role.variant} className="text-xs">
                  {role.label}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span>{user.email}</span>
              </div>
            </div>
          </div>

          {/* Informations supplémentaires */}
          <div className="space-y-2 text-xs">
            {/* Dernière connexion */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>
                Dernière connexion:{" "}
                <strong className="text-foreground">
                  {formatLastLogin(user.lastLogin)}
                </strong>
              </span>
            </div>

            {/* Level */}
            {user.level > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-3.5 h-3.5" />
                <span>
                  Niveau:{" "}
                  <strong className="text-foreground">{user.level}</strong>
                </span>
              </div>
            )}

            {/* Stats utilisateur */}
            {(user.ordersCount !== undefined ||
              user.totalSpent !== undefined) && (
              <div className="flex gap-4 pt-2 border-t border-border">
                {user.ordersCount !== undefined && (
                  <div>
                    <div className="text-lg font-bold text-foreground">
                      {user.ordersCount}
                    </div>
                    <div className="text-muted-foreground">Commandes</div>
                  </div>
                )}
                {user.totalSpent !== undefined && (
                  <div>
                    <div className="text-lg font-bold text-foreground">
                      {user.totalSpent.toFixed(2)}€
                    </div>
                    <div className="text-muted-foreground">Dépensé</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lien vers profil */}
          {showViewProfile && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to={`/admin/users/${user.id}`}>
                <User className="w-4 h-4 mr-2" />
                Voir le profil
                <ExternalLink className="w-3 h-3 ml-auto" />
              </Link>
            </Button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});
