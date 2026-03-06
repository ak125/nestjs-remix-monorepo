import { Award, BookOpen, Car, HelpCircle, Package } from "lucide-react";

const SECTIONS = [
  { id: "compat", label: "Compatibilites", icon: Car },
  { id: "equip", label: "Equipementiers", icon: Award },
  { id: "family", label: "Meme famille", icon: Package },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "guide-link", label: "Guide", icon: BookOpen },
];

export default function GammeQuickNavV9() {
  return (
    <nav
      aria-label="Navigation rapide"
      className="bg-white border-b border-slate-100 py-3"
    >
      <div className="max-w-[1280px] mx-auto px-5 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto lg:justify-center scrollbar-hide">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 whitespace-nowrap hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50 hover:-translate-y-0.5 transition-all"
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
