import { Calendar, Filter, HelpCircle, Plus, Settings } from "lucide-react";
import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

interface GammeFaqV9Props {
  items: FaqItem[];
}

const ICON_MAP = [Filter, Settings, Calendar, HelpCircle, Filter];

export default function GammeFaqV9({ items }: GammeFaqV9Props) {
  const [open, setOpen] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <section id="faq" className="py-7 lg:py-10 bg-slate-50 scroll-mt-16">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Questions fréquentes
          </h2>
          <HelpCircle size={18} className="text-slate-400" />
        </div>

        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
          {items.map((f, i) => {
            const Icon = ICON_MAP[i % ICON_MAP.length];
            const isOpen = open === i;
            return (
              <div
                key={i}
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isOpen
                    ? "border-blue-200 shadow-lg shadow-blue-500/[0.05]"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full p-4 text-left flex items-center gap-3 text-[13px] font-semibold text-slate-800"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      isOpen
                        ? "bg-blue-100 text-blue-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <Icon size={15} />
                  </div>
                  <span className="flex-1 leading-snug font-v9-body">
                    {f.question}
                  </span>
                  <Plus
                    size={16}
                    className={`flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-45 text-blue-500" : "text-slate-400"
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-[60px] text-[13px] text-slate-600 leading-relaxed animate-v9-fade-in font-normal font-v9-body">
                    {f.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
