/**
 * R1RelatedBlocks — Blocs de maillage contextuel R1.
 * Consomme des blocs déjà qualifiés par le backend.
 * Max 3 blocs, max 3 liens par bloc.
 */
import { Link } from "@remix-run/react";
import { AlertTriangle, BookOpen, Wrench, ArrowRight } from "lucide-react";

interface RelatedLink {
  kind: string;
  title: string;
  href: string;
  reason: string;
}

interface RelatedBlock {
  kind: string;
  heading: string;
  items: RelatedLink[];
}

interface R1RelatedBlocksProps {
  blocks: RelatedBlock[];
}

const BLOCK_ICONS: Record<string, typeof AlertTriangle> = {
  "avoid-confusion": AlertTriangle,
  "buying-guide": BookOpen,
  "understand-maintain": Wrench,
  "compatible-parts": ArrowRight,
};

const BLOCK_COLORS: Record<string, string> = {
  "avoid-confusion": "border-amber-200 bg-amber-50/50",
  "buying-guide": "border-blue-200 bg-blue-50/50",
  "understand-maintain": "border-slate-200 bg-slate-50/50",
  "compatible-parts": "border-green-200 bg-green-50/50",
};

export function R1RelatedBlocks({ blocks }: R1RelatedBlocksProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <section data-section="related-resources" className="py-8 px-4 sm:px-6">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map((block) => {
            const Icon = BLOCK_ICONS[block.kind] ?? ArrowRight;
            const colorClass = BLOCK_COLORS[block.kind] ?? "border-slate-200";

            return (
              <div
                key={block.kind}
                className={`rounded-xl border p-5 ${colorClass}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    {block.heading}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {block.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className="group block"
                        prefetch="intent"
                      >
                        <span className="text-sm font-medium text-blue-700 group-hover:text-blue-900 group-hover:underline">
                          {item.title}
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {item.reason}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
