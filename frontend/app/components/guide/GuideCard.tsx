/**
 * GuideCard — Primitive base for all Guide section components.
 * Provides the shared shell: gradient header (icon + label + h2) + body + optional sources badge.
 */

import { type LucideIcon, FileText } from "lucide-react";
import { type ReactNode } from "react";
import { slugifyTitle } from "~/components/blog/conseil/section-config";

interface GuideCardProps {
  title: string;
  anchor?: string;
  icon: LucideIcon;
  label: string;
  gradient: string;
  border: string;
  labelColor?: string;
  bodyBg?: string;
  shadow?: "md" | "lg" | "xl";
  subHeader?: ReactNode;
  sources?: string[];
  children: ReactNode;
}

export function GuideCard({
  title,
  anchor,
  icon: Icon,
  label,
  gradient,
  border,
  labelColor = "text-white/70",
  bodyBg = "bg-white",
  shadow = "lg",
  subHeader,
  sources,
  children,
}: GuideCardProps) {
  const id = anchor ?? slugifyTitle(title);

  return (
    <div id={id} className="mb-8">
      <div
        className={`rounded-xl border-2 ${border} overflow-hidden shadow-${shadow}`}
      >
        <div
          className={`flex items-center gap-3 px-5 py-4 bg-gradient-to-r ${gradient} text-white`}
        >
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <div
              className={`text-xs font-semibold uppercase tracking-widest ${labelColor} mb-0.5`}
            >
              {label}
            </div>
            <h2 className="text-xl font-bold leading-tight">{title}</h2>
          </div>
        </div>
        {subHeader}
        <div className={`${bodyBg} px-6 py-5`}>{children}</div>
        {sources && sources.length > 0 && (
          <div className="px-6 pb-4 -mt-2">
            <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-400">
              <FileText className="w-3 h-3" />
              Sources : {sources.join(" · ")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
