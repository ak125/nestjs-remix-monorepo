/**
 * R6WhenPro — V2 "quand faire appel a un pro" section.
 * PAS de procedure : juste quand et pourquoi.
 */

import { Wrench } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { type R6WhenProCase } from "~/types/r6-guide.types";

interface Props {
  cases: R6WhenProCase[];
  gammeName: string;
}

export function R6WhenPro({ cases, gammeName: _gammeName }: Props) {
  if (cases.length === 0) return null;

  return (
    <section id="quand-pro" className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-orange-500">
        Quand faire appel a un professionnel
      </h2>
      <div className="space-y-3">
        {cases.map((c, i) => (
          <Card key={i} className="border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-orange-100 rounded-lg flex-shrink-0 mt-0.5">
                  <Wrench className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">
                    {c.situation}
                  </h3>
                  <p className="text-sm text-gray-600">{c.why_pro}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
