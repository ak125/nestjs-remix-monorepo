import { Link } from "@remix-run/react";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "~/components/ui/badge";

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  R1: {
    label: "Catalogue",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  R1_ROUTER: {
    label: "Catalogue",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  R3: {
    label: "Conseil",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  R3_GUIDE: {
    label: "Guide",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  R3_CONSEILS: {
    label: "Conseil",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  R4: {
    label: "Reference",
    className: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  R4_REFERENCE: {
    label: "Reference",
    className: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
};

const DEFAULT_BADGE = {
  label: "Lien",
  className: "bg-gray-100 text-gray-700 border-gray-200",
};

interface R6InternalLinksProps {
  links: Array<{
    anchor_text: string;
    href: string;
    target_role: string;
  }>;
}

export function R6InternalLinks({ links }: R6InternalLinksProps) {
  if (!links.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      {links.map((link, i) => {
        const badge = ROLE_BADGE[link.target_role] || DEFAULT_BADGE;
        return (
          <Link
            key={i}
            to={link.href}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-sm"
          >
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${badge.className}`}
            >
              {badge.label}
            </Badge>
            <span className="text-gray-700 group-hover:text-gray-900 font-medium">
              {link.anchor_text}
            </span>
            <ArrowUpRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </Link>
        );
      })}
    </div>
  );
}
