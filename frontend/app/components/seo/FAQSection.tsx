import { memo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { pluralizePieceName } from "~/lib/seo-utils";
import { cn } from "~/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faq?: FAQItem[] | null;
  gammeName?: string;
  className?: string;
}

/**
 * Section FAQ avec schema.org FAQPage markup
 * Optimise pour les featured snippets Google
 */
export const FAQSection = memo(function FAQSection({
  faq,
  gammeName,
  className,
}: FAQSectionProps) {
  if (!faq || faq.length === 0) return null;

  const pieceType = gammeName?.toLowerCase() || "piece";
  const pluralType = pluralizePieceName(pieceType);

  // Schema.org FAQPage structured data
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className={cn("py-8", className)} aria-labelledby="faq-title">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="container mx-auto px-4">
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 text-white text-xl">
                ❓
              </span>
              <CardTitle id="faq-title" className="text-xl text-purple-900">
                Questions frequentes sur les {pluralType}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="faq-0">
              {faq.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`faq-${index}`}
                  className="border-purple-200 bg-white rounded-lg mb-3 last:mb-0"
                >
                  <AccordionTrigger className="px-4 text-purple-900 hover:no-underline hover:bg-purple-50 rounded-t-lg">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 border-t border-purple-100">
                    <p className="text-gray-700 leading-relaxed pt-2">
                      {item.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </section>
  );
});

export default FAQSection;
