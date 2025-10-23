import { Link } from "@remix-run/react";
import { ArrowRight, ShoppingBag, User, MapPin, Mail, Key, Heart } from "lucide-react";

import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface QuickAction {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  badge?: number;
  variant?: "default" | "primary" | "secondary";
}

interface QuickActionsProps {
  stats?: {
    orders?: { pending?: number };
    messages?: { unread?: number };
  };
  enhanced?: boolean;
}

export function QuickActions({ stats, enhanced = false }: QuickActionsProps) {
  const quickActions: QuickAction[] = [
    {
      title: "Mes commandes",
      href: "/account/orders",
      icon: ShoppingBag,
      description: "Suivi de vos commandes",
      badge: stats?.orders?.pending,
      variant: "primary"
    },
    {
      title: "Mon profil",
      href: "/account/profile",
      icon: User,
      description: "Informations personnelles"
    },
    {
      title: "Mes adresses",
      href: "/account/addresses", 
      icon: MapPin,
      description: "Adresses de livraison"
    },
    {
      title: "Messages",
      href: "/account/messages",
      icon: Mail,
      badge: stats?.messages?.unread,
      description: "Centre de messages"
    },
    {
      title: "Sécurité",
      href: "/account/security",
      icon: Key,
      description: "Mot de passe et sécurité"
    },
    {
      title: "Mes favoris",
      href: "/account/favorites",
      icon: Heart,
      description: "Produits sauvegardés"
    }
  ];

  if (enhanced) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.href}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md",
                  action.variant === "primary" && "bg-primary/5 border-blue-200 hover:bg-info/20",
                  action.variant === "secondary" && "bg-gray-50 border-gray-200 hover:bg-gray-100",
                  !action.variant && "bg-white border-gray-200 hover:bg-gray-50"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5",
                  action.variant === "primary" && "text-blue-600",
                  !action.variant && "text-gray-500"
                )} />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    {action.title}
                  </div>
                  {action.description && (
                    <div className="text-xs text-gray-500 mt-1">
                      {action.description}
                    </div>
                  )}
                </div>
                {action.badge && action.badge > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {action.badge}
                  </Badge>
                )}
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  // Version simplifiée (basic)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Navigation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quickActions.slice(0, 4).map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start"
              asChild
            >
              <Link to={action.href}>
                <Icon className="h-4 w-4 mr-2" />
                {action.title}
                {action.badge && action.badge > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {action.badge}
                  </Badge>
                )}
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
