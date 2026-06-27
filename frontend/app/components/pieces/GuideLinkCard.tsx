/**
 * GuideLinkCard — Cross-link R1 → R3 conseil page.
 * Lightweight card that links from /pieces/{slug} to /blog-pieces-auto/conseils/{pgAlias}
 */

import { BookOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router";

interface GuideLinkCardProps {
  pgAlias: string;
  pgName: string;
}

export function GuideLinkCard({ pgAlias, pgName }: GuideLinkCardProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to={`/blog-pieces-auto/conseils/${pgAlias}`}
        prefetch="intent"
        className="group flex items-center gap-4 px-6 py-5 bg-white rounded-xl border border-violet-200 hover:border-violet-400 shadow-sm hover:shadow-md transition-all"
      >
        <div className="shrink-0 p-3 bg-muted rounded-lg group-hover:bg-muted transition-colors">
          <BookOpen className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 group-hover:text-foreground transition-colors">
            Guide complet : {pgName}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Symptômes, remplacement étape par étape, erreurs à éviter et FAQ
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-foreground transition-colors shrink-0" />
      </Link>
    </div>
  );
}
