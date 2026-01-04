import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
 * Optimisé pour les featured snippets Google
 */
export function FAQSection({ faq, gammeName, className }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!faq || faq.length === 0) return null;

  const pieceType = gammeName?.toLowerCase() || 'pièce';

  // Schema.org FAQPage structured data
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className={cn('py-8', className)} aria-labelledby="faq-title">
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
                Questions fréquentes sur {pieceType}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {faq.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg border border-purple-200 overflow-hidden"
                >
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-purple-50 transition-colors"
                    aria-expanded={openIndex === index}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="font-semibold text-purple-900 pr-4">
                      {item.question}
                    </span>
                    <span className="flex-shrink-0 text-purple-600">
                      {openIndex === index ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </span>
                  </button>
                  <div
                    id={`faq-answer-${index}`}
                    className={cn(
                      'overflow-hidden transition-all duration-300',
                      openIndex === index ? 'max-h-96' : 'max-h-0'
                    )}
                  >
                    <div className="p-4 pt-0 border-t border-purple-100">
                      <p className="text-gray-700 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default FAQSection;
