import { Link } from "@remix-run/react";
import {
  BookMarked,
  Building2,
  Car,
  Grid3x3,
  ScanLine,
  Search,
} from "lucide-react";
import { useCallback } from "react";

/** Scroll to an element with offset for sticky header */
function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: y, behavior: "smooth" });
}

/** Dispatch hero tab switch event (listened by HeroSection) */
function switchHeroTab(tab: number) {
  window.dispatchEvent(new CustomEvent("hero-tab-switch", { detail: { tab } }));
}

interface Shortcut {
  icon: typeof Car;
  title: string;
  desc: string;
  /** Route path for <Link> navigation */
  href?: string;
  /** Anchor ID for in-page scroll */
  scrollTo?: string;
  /** Hero tab index to activate on scroll */
  heroTab?: number;
}

const SHORTCUTS: Shortcut[] = [
  {
    icon: Car,
    title: "Par véhicule",
    scrollTo: "hero-v9",
    heroTab: 0,
    desc: "Marque, modèle, motorisation",
  },
  {
    icon: Grid3x3,
    title: "Par famille",
    scrollTo: "catalogue",
    desc: "19 familles techniques",
  },
  {
    icon: Building2,
    title: "Par constructeur",
    scrollTo: "marques",
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
    scrollTo: "hero-v9",
    heroTab: 2,
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
  onScrollAction,
}: {
  s: Shortcut;
  compact?: boolean;
  onScrollAction: (s: Shortcut) => void;
}) {
  const Icon = s.icon;

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
    ? "flex flex-shrink-0 items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:border-cta/30 hover:bg-orange-50 active:scale-[0.98] cursor-pointer"
    : "group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 transition-all hover:border-cta/30 hover:bg-orange-50/50 hover:shadow-sm cursor-pointer";

  // Route link → <Link>
  if (s.href) {
    return (
      <Link to={s.href} className={cls}>
        {inner}
      </Link>
    );
  }

  // In-page scroll action → <button>
  return (
    <button type="button" onClick={() => onScrollAction(s)} className={cls}>
      {inner}
    </button>
  );
}

export default function QuickAccessGrid() {
  const handleScrollAction = useCallback((s: Shortcut) => {
    if (s.scrollTo) {
      scrollToId(s.scrollTo);
    }
    if (s.heroTab !== undefined) {
      switchHeroTab(s.heroTab);
    }
  }, []);

  return (
    <section className="bg-white border-b border-slate-100">
      <div className="mx-auto max-w-[1280px] px-5 py-4 lg:px-8 lg:py-5">
        <h2 className="sr-only">Choisir votre parcours</h2>

        {/* Mobile: scroll horizontal */}
        <div className="flex gap-2.5 overflow-x-auto hide-scroll -mx-5 px-5 lg:hidden">
          {SHORTCUTS.map((s) => (
            <ShortcutItem
              key={s.title}
              s={s}
              compact
              onScrollAction={handleScrollAction}
            />
          ))}
        </div>

        {/* Desktop: 6 columns */}
        <div className="hidden lg:grid lg:grid-cols-6 lg:gap-3">
          {SHORTCUTS.map((s) => (
            <ShortcutItem
              key={s.title}
              s={s}
              onScrollAction={handleScrollAction}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
