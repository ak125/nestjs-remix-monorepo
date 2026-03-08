/**
 * ResultMissing — Block 6: Missing data that could improve the diagnostic
 */
import { HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

interface Props {
  missing: string[];
}

export function ResultMissing({ missing }: Props) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-gray-600">
          <HelpCircle className="w-5 h-5" />
          Données manquantes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500 mb-2">
          Ces informations permettraient d'affiner le diagnostic :
        </p>
        <ul className="space-y-1">
          {missing.map((m, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-gray-600"
            >
              <span className="text-gray-400 mt-0.5">•</span>
              {m}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
