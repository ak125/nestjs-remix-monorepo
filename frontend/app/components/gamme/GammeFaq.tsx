import { Calendar, Filter, HelpCircle, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { Reveal, Section, SectionHeader } from "~/components/layout";

interface FaqItem {
  question: string;
  answer: string;
}

interface GammeFaqProps {
  items: FaqItem[];
  h2Override?: string | null;
}

const ICON_MAP = [Filter, Settings, Calendar, HelpCircle, Filter];

export default function GammeFaq({ items, h2Override }: GammeFaqProps) {
  const [open, setOpen] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <Section variant="slate" id="faq" className="scroll-mt-16">
      <SectionHeader
        title={h2Override || "Questions fréquentes"}
        trailing={<HelpCircle size={18} className="text-slate-400" />}
      />

      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3">
        {items.map((f, i) => {
          const Icon = ICON_MAP[i % ICON_MAP.length];
          const isOpen = open === i;
          return (
            <Reveal key={i} delay={i * 60}>
              <div
                className={`bg-white border rounded-[24px] overflow-hidden shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-all duration-200 ${
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
                  <span className="flex-1 leading-snug font-body">
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
                  <div className="px-4 pb-4 pl-[60px] text-[13px] text-slate-600 leading-relaxed animate-subtle-fade-in font-normal font-body">
                    {f.answer}
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
