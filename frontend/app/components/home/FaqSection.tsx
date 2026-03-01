import { Await } from "@remix-run/react";
import { Suspense } from "react";
import { Section } from "~/components/layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { FAQ_DATA } from "./constants";

function FaqAccordion({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <Accordion type="single" collapsible className="space-y-3">
      {items.map((faq, i) => (
        <AccordionItem
          key={i}
          value={`faq-${i}`}
          className="border border-slate-200 rounded-xl bg-white overflow-hidden hover:border-cta/20 transition-colors data-[state=open]:border-cta/20 data-[state=open]:shadow-md"
        >
          <AccordionTrigger className="px-4 sm:px-5 py-4 text-sm sm:text-[15px] font-bold text-slate-900 hover:no-underline data-[state=open]:text-cta">
            {faq.q}
          </AccordionTrigger>
          <AccordionContent className="px-4 sm:px-5 text-sm text-slate-600 leading-relaxed">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export default function FaqSection({
  faqsPromise,
}: {
  faqsPromise: Promise<Array<{ id: string; question: string; answer: string }>>;
}) {
  return (
    <Section variant="white" spacing="md" size="narrow">
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 text-balance">
          Questions fr&eacute;quentes
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Tout ce qu&apos;il faut savoir avant de commander
        </p>
      </div>
      <Suspense fallback={<FaqAccordion items={FAQ_DATA} />}>
        <Await resolve={faqsPromise} errorElement={null}>
          {(resolvedFaqs) => {
            const faqList =
              resolvedFaqs.length > 0
                ? resolvedFaqs.map((f) => ({ q: f.question, a: f.answer }))
                : FAQ_DATA;
            return <FaqAccordion items={faqList} />;
          }}
        </Await>
      </Suspense>
    </Section>
  );
}
