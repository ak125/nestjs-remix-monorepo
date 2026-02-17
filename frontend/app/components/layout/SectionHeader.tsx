import { Link } from "@remix-run/react";
import { ArrowRight } from "lucide-react";

export default function SectionHeader({
  title,
  sub,
  linkText,
  linkHref,
  dark = false,
}: {
  title: string;
  sub?: string;
  linkText?: string;
  linkHref?: string;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5 sm:mb-6">
      <div>
        <h2
          className={`text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}
        >
          {title}
        </h2>
        {sub && (
          <p
            className={`text-sm mt-1 ${dark ? "text-white/60" : "text-slate-500"}`}
          >
            {sub}
          </p>
        )}
      </div>
      {linkText && linkHref && (
        <Link
          to={linkHref}
          className="flex items-center gap-1 text-sm font-semibold text-[#e8590c] whitespace-nowrap flex-shrink-0"
        >
          {linkText} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
