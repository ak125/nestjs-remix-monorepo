import { Link } from "@remix-run/react";
import { BookOpen, ArrowRight } from "lucide-react";
import { memo } from "react";
import { Card, CardContent } from "~/components/ui/card";

interface ReferenceEncartProps {
  reference: {
    slug: string;
    title: string;
    definition: string;
    roleMecanique: string | null;
    canonicalUrl: string | null;
  };
}

export const ReferenceEncartSection = memo(function ReferenceEncartSection({
  reference,
}: ReferenceEncartProps) {
  const href = reference.canonicalUrl || `/reference-auto/${reference.slug}`;

  return (
    <section className="py-8 md:py-12 bg-indigo-50/50">
      <div className="container mx-auto px-4">
        <Card className="border-indigo-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-semibold text-indigo-900 mb-2">
                  En savoir plus
                </h2>
                {reference.roleMecanique && (
                  <p className="text-base font-medium text-gray-800 mb-2">
                    {reference.roleMecanique}
                  </p>
                )}
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                  {reference.definition}
                </p>
                <Link
                  to={href}
                  className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Voir la fiche technique complète
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
});
