import {
  Award,
  BookOpen,
  Car,
  HelpCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";

const SECTIONS = [
  { id: "bien-choisir", label: "Bien choisir", icon: ShieldCheck },
  { id: "qualite-prix", label: "Prix & Marques", icon: Award },
  { id: "emplacement", label: "Emplacement", icon: MapPin },
  { id: "reference", label: "Compatibilité", icon: Car },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "aller-plus-loin", label: "Voir aussi", icon: BookOpen },
];

export default function GammeQuickNav() {
  return (
    <nav
      aria-label="Navigation rapide"
      className="bg-white border-b border-slate-100 py-3"
    >
      <div className="max-w-7xl mx-auto px-page">
        <div className="flex items-center gap-2 overflow-x-auto lg:justify-center scrollbar-hide">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-[18px] text-[12px] font-semibold text-slate-600 whitespace-nowrap shadow-sm hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 hover:-translate-y-0.5 transition-all"
              >
                <Icon size={13} /> {s.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
