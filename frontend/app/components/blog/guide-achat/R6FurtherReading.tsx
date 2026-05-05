import { Link } from "@remix-run/react";
import {
  ShoppingCart,
  Wrench,
  BookOpen,
  Stethoscope,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { GuideCard } from "~/components/guide/GuideCard";

const ROLE_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  R1: {
    icon: ShoppingCart,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Catalogue",
  },
  R1_ROUTER: {
    icon: ShoppingCart,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Catalogue",
  },
  R3: {
    icon: Wrench,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Conseil",
  },
  R3_GUIDE: {
    icon: Wrench,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Guide",
  },
  R3_CONSEILS: {
    icon: Wrench,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Conseil",
  },
  R4: {
    icon: BookOpen,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    label: "Reference",
  },
  R4_REFERENCE: {
    icon: BookOpen,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    label: "Reference",
  },
  R5: {
    icon: Stethoscope,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Diagnostic",
  },
  R5_DIAGNOSTIC: {
    icon: Stethoscope,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Diagnostic",
  },
  R6: {
    icon: BookOpen,
    color: "bg-green-50 text-green-700 border-green-200",
    label: "Guide achat",
  },
  // Canon RoleId form (PR-3a-cleanup migrated target_role: 'R6' → 'R6_GUIDE_ACHAT'
  // in r6-guide.service.ts; keeping 'R6' for backwards compat with legacy rows).
  R6_GUIDE_ACHAT: {
    icon: BookOpen,
    color: "bg-green-50 text-green-700 border-green-200",
    label: "Guide achat",
  },
};

const DEFAULT_ROLE = {
  icon: ArrowRight,
  color: "bg-gray-50 text-gray-700 border-gray-200",
  label: "Lien",
};

interface R6FurtherReadingProps {
  links: Array<{ label: string; href: string; target_role: string }>;
}

export function R6FurtherReading({ links }: R6FurtherReadingProps) {
  if (!links.length) return null;

  return (
    <GuideCard
      title="Pour aller plus loin"
      anchor="pour-aller-plus-loin"
      icon={BookOpen}
      label="Ressources"
      gradient="from-teal-600 to-emerald-600"
      border="border-teal-200"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {links.map((link, i) => {
          const role = ROLE_CONFIG[link.target_role] || DEFAULT_ROLE;
          const Icon = role.icon;
          return (
            <Link
              key={i}
              to={link.href}
              className="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className={`p-2 rounded-lg border ${role.color} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 group-hover:text-teal-700 transition-colors truncate">
                  {link.label}
                </p>
                <p className="text-xs text-gray-500">{role.label}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </GuideCard>
  );
}
