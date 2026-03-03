/**
 * R6FaqAccordion — FAQ accordion for R6 Guide d'Achat.
 * Uses shadcn Accordion with pre-structured R6FaqItem[] (no HTML parsing needed).
 */

import { HelpCircle } from "lucide-react";
import { HtmlContent } from "~/components/seo/HtmlContent";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { type R6FaqItem } from "~/types/r6-guide.types";
import { annotateGlossaryTerms } from "./GlossaryTooltip";
import { GuideCard } from "./GuideCard";

interface R6FaqAccordionProps {
  items: R6FaqItem[];
}

export function R6FaqAccordion({ items }: R6FaqAccordionProps) {
  if (items.length === 0) return null;

  return (
    <GuideCard
      title="Questions frequentes"
      anchor="faq"
      icon={HelpCircle}
      label="FAQ"
      gradient="from-violet-500 to-purple-500"
      border="border-violet-200"
      labelColor="text-violet-100"
      bodyBg="bg-violet-50/30"
    >
      <Accordion type="single" collapsible className="space-y-2">
        {items.map((item, idx) => (
          <AccordionItem
            key={idx}
            value={`faq-${idx}`}
            className="rounded-lg border border-violet-200 bg-white overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 text-sm font-medium text-gray-900 hover:bg-violet-50 transition-colors [&[data-state=open]]:bg-violet-50">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-0 border-t border-violet-100">
              <HtmlContent
                html={annotateGlossaryTerms(item.answer)}
                className="text-sm text-gray-600 leading-relaxed [&_a]:text-violet-600 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-gray-900"
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </GuideCard>
  );
}
