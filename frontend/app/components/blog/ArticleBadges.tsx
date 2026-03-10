/**
 * ArticleBadges — Affiche les badges calculés backend-side
 */
import { TrendingUp, Award, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";

type BlogBadgeType = "nouveau" | "populaire" | "mis-a-jour" | "guide-complet";

const BADGE_CONFIG: Record<
  BlogBadgeType,
  { label: string; icon: typeof TrendingUp; className: string }
> = {
  nouveau: {
    label: "Nouveau",
    icon: Sparkles,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  populaire: {
    label: "Populaire",
    icon: TrendingUp,
    className: "bg-pink-100 text-pink-800 border-pink-200",
  },
  "mis-a-jour": {
    label: "Mis à jour",
    icon: RefreshCw,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  "guide-complet": {
    label: "Guide complet",
    icon: Award,
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

interface ArticleBadgesProps {
  badges?: BlogBadgeType[];
  maxBadges?: number;
}

export function ArticleBadges({ badges, maxBadges = 2 }: ArticleBadgesProps) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {badges.slice(0, maxBadges).map((badge) => {
        const config = BADGE_CONFIG[badge];
        if (!config) return null;
        const Icon = config.icon;
        return (
          <Badge
            key={badge}
            variant="outline"
            className={`text-xs ${config.className}`}
          >
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        );
      })}
    </div>
  );
}
