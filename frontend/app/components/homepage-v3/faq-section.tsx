import { useState } from 'react';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqs = [
    { q: 'Quelle est la garantie sur les pièces ?', a: 'Toutes nos pièces bénéficient d\'une garantie constructeur de 2 ans minimum.' },
    { q: 'Livrez-vous partout en France ?', a: 'Oui, nous livrons dans toute la France métropolitaine sous 24-48h.' },
    { q: 'Comment trouver la bonne référence ?', a: 'Utilisez notre outil de recherche par véhicule ou contactez notre service client.' },
  ];
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 max-w-3xl">
        <h2 className="text-4xl font-bold text-center mb-12">Questions Fréquentes</h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full text-left p-6 font-semibold text-lg hover:bg-gray-50 transition flex justify-between items-center"
              >
                {faq.q}
                <span>{openIndex === index ? '−' : '+'}</span>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6 text-gray-600">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
