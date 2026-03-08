import { Link } from "@remix-run/react";
import {
  BookMarked,
  Building2,
  Car,
  Grid3x3,
  ScanLine,
  Search,
} from "lucide-react";

const SHORTCUTS = [
  {
    icon: Car,
    title: "Par véhicule",
    href: "#hero-v9",
    desc: "Marque, modèle, motorisation",
  },
  {
    icon: Grid3x3,
    title: "Par famille",
    href: "#catalogue",
    desc: "19 familles techniques",
  },
  {
    icon: Building2,
    title: "Par constructeur",
    href: "#marques",
    desc: "36 marques auto",
  },
  {
    icon: ScanLine,
    title: "Diagnostic",
    href: "/diagnostic-auto",
    desc: "Identifier une panne",
  },
  {
    icon: Search,
    title: "Par référence",
    href: "#hero-v9",
    desc: "OE, marque ou pièce",
  },
  {
    icon: BookMarked,
    title: "Guides & conseils",
    href: "/blog-pieces-auto/guide-achat",
    desc: "Comparatifs et aide au choix",
  },
];

function ShortcutItem({
  s,
  compact,
}: {
  s: (typeof SHORTCUTS)[number];
  compact?: boolean;
}) {
  const Icon = s.icon;
  const isRoute = s.href.startsWith("/");

  const inner = compact ? (
    <>
      <Icon size={18} className="text-cta shrink-0" />
      <span className="text-[13px] font-semibold text-slate-800 whitespace-nowrap">
        {s.title}
      </span>
    </>
  ) : (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cta/10 group-hover:bg-cta/15 transition-colors">
        <Icon size={18} className="text-cta" />
      </div>
      <div className="min-w-0">
        <span className="block text-[13px] font-semibold text-slate-800 leading-tight">
          {s.title}
        </span>
        <span className="block text-[11px] text-slate-500 leading-tight mt-0.5">
          {s.desc}
        </span>
      </div>
    </>
  );

  const cls = compact
    ? "flex flex-shrink-0 items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-cta/30 hover:bg-orange-50 active:scale-[0.98]"
    : "group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 transition-all hover:border-cta/30 hover:bg-orange-50/50 hover:shadow-sm";

  if (isRoute) {
    return (
      <Link to={s.href} className={cls}>
        {inner}
      </Link>
    );
  }

  return (
    <a href={s.href} className={cls}>
      {inner}
    </a>
  );
}

export default function QuickAccessGrid() {
  return (
    <section className="bg-white border-b border-slate-100">
      <div className="mx-auto max-w-[1280px] px-5 py-4 lg:px-8 lg:py-5">
        <h2 className="sr-only">Choisir votre parcours</h2>

        {/* Mobile: scroll horizontal */}
        <div className="flex gap-2.5 overflow-x-auto hide-scroll -mx-5 px-5 lg:hidden">
          {SHORTCUTS.map((s) => (
            <ShortcutItem key={s.title} s={s} compact />
          ))}
        </div>

        {/* Desktop: 5 columns */}
        <div className="hidden lg:grid lg:grid-cols-6 lg:gap-3">
          {SHORTCUTS.map((s) => (
            <ShortcutItem key={s.title} s={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
