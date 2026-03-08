import { Await } from "@remix-run/react";
import { HelpCircle, Search, Shield, Stethoscope, Truck } from "lucide-react";
import { Suspense } from "react";
import { FAQ_DATA } from "~/components/home/constants";

function getFaqIcon(question: string) {
  const q = question.toLowerCase();
  if (q.includes("trouver") || q.includes("recherch") || q.includes("pièce"))
    return Search;
  if (q.includes("livraison") || q.includes("délai")) return Truck;
  if (q.includes("garantie") || q.includes("qualité")) return Shield;
  if (q.includes("diagnostic") || q.includes("gratuit")) return Stethoscope;
  return HelpCircle;
}

function FaqCards({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
      {items.map((faq, i) => {
        const FaqIcon = getFaqIcon(faq.q);
        return (
          <div
            key={i}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-slate-300 hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                <FaqIcon size={22} className="text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[1rem] font-semibold text-slate-800 leading-snug tracking-[-0.02em] font-v9-heading">
                  {faq.q}
                </h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed font-v9-body">
                  {faq.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FaqSection({
  faqsPromise,
}: {
  faqsPromise: Promise<Array<{ id: string; question: string; answer: string }>>;
}) {
  return (
    <section className="py-7 lg:py-10 bg-slate-50">
      <div className="px-5 lg:px-8 max-w-[1280px] mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[1.5rem] lg:text-[2rem] font-extrabold text-slate-900 tracking-[-0.03em] font-v9-heading">
            Questions fréquentes
          </h2>
          <div className="h-10 w-10 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-sm">
            <HelpCircle size={18} className="text-slate-400" />
          </div>
        </div>

        <Suspense fallback={<FaqCards items={FAQ_DATA} />}>
          <Await resolve={faqsPromise} errorElement={null}>
            {(resolvedFaqs) => {
              const faqList =
                resolvedFaqs.length > 0
                  ? resolvedFaqs.map((f) => ({
                      q: f.question,
                      a: f.answer,
                    }))
                  : FAQ_DATA;
              return <FaqCards items={faqList} />;
            }}
          </Await>
        </Suspense>
      </div>
    </section>
  );
}
