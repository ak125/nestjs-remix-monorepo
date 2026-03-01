import { FAQ_DATA } from "./constants";

export default function HomepageJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": "https://www.automecanik.com/#website",
              url: "https://www.automecanik.com",
              name: "Automecanik",
              description:
                "Pièces détachées auto pour toutes marques et modèles",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate:
                    "https://www.automecanik.com/recherche?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "AutoPartsStore",
              "@id": "https://www.automecanik.com/#store",
              name: "Automecanik",
              description:
                "Catalogue de pièces détachées auto pour toutes marques et modèles",
              url: "https://www.automecanik.com",
              logo: "https://www.automecanik.com/logo-navbar.webp",
              image: "https://www.automecanik.com/logo-og.webp",
              priceRange: "€€",
              address: {
                "@type": "PostalAddress",
                addressCountry: "FR",
              },
            },
            {
              "@type": "FAQPage",
              "@id": "https://www.automecanik.com/#faq",
              mainEntity: FAQ_DATA.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.a,
                },
              })),
            },
          ],
        }),
      }}
    />
  );
}
