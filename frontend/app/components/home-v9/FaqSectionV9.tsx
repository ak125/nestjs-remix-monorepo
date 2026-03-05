import { Await } from "@remix-run/react";
import { HelpCircle, Search, Shield, Stethoscope, Truck } from "lucide-react";
import { Suspense } from "react";
import { FAQ_DATA } from "~/components/home/constants";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

// Map FAQ questions to icons
function getFaqIcon(question: string) {
  const q = question.toLowerCase();
  if (q.includes("trouver") || q.includes("recherch") || q.includes("pièce"))
    return Search;
  if (q.includes("livraison") || q.includes("délai")) return Truck;
  if (q.includes("garantie") || q.includes("qualité")) return Shield;
  if (q.includes("diagnostic") || q.includes("gratuit")) return Stethoscope;
  return HelpCircle;
}

function FaqAccordionV9({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3"
    >
      {items.map((faq, i) => {
        const FaqIcon = getFaqIcon(faq.q);
        return (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="group bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200 hover:border-slate-300 data-[state=open]:border-blue-200 data-[state=open]:shadow-lg data-[state=open]:shadow-blue-500/[0.05]"
          >
            <AccordionTrigger className="px-4 py-4 text-[13px] font-semibold text-slate-800 hover:no-underline [&>svg]:sr-only">
              <div className="flex items-center gap-3 w-full text-left">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-400 group-data-[state=open]:bg-blue-100 group-data-[state=open]:text-blue-600 transition-colors">
                  <FaqIcon size={15} />
                </div>
                <span className="flex-1 leading-snug font-v9-body">
                  {faq.q}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pl-[60px] text-[13px] text-slate-600 leading-relaxed font-v9-body">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export default function FaqSectionV9({
  faqsPromise,
}: {
  faqsPromise: Promise<Array<{ id: string; question: string; answer: string }>>;
}) {
  return (
    <section className="py-7 lg:py-10 bg-slate-50">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] lg:text-[24px] font-bold text-slate-900 tracking-tight font-v9-heading">
            Questions fréquentes
          </h2>
          <HelpCircle size={18} className="text-slate-400" />
        </div>

        <Suspense fallback={<FaqAccordionV9 items={FAQ_DATA} />}>
          <Await resolve={faqsPromise} errorElement={null}>
            {(resolvedFaqs) => {
              const faqList =
                resolvedFaqs.length > 0
                  ? resolvedFaqs.map((f) => ({
                      q: f.question,
                      a: f.answer,
                    }))
                  : FAQ_DATA;
              return <FaqAccordionV9 items={faqList} />;
            }}
          </Await>
        </Suspense>
      </div>
    </section>
  );
}
