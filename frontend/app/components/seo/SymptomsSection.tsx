import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { cn } from '~/lib/utils';
import { pluralizePieceName } from '~/lib/seo-utils';

interface SymptomsSectionProps {
  symptoms?: string[] | null;
  gammeName?: string;
  className?: string;
}

/**
 * Section "Symptômes d'usure"
 * Liste des signes indiquant qu'une pièce doit être remplacée
 */
export function SymptomsSection({
  symptoms,
  gammeName,
  className,
}: SymptomsSectionProps) {
  if (!symptoms || symptoms.length === 0) return null;

  const pieceType = gammeName?.toLowerCase() || 'pièce';
  const pluralType = pluralizePieceName(pieceType);

  return (
    <section
      className={cn('py-8', className)}
      aria-labelledby="symptoms-title"
    >
      <div className="container mx-auto px-4">
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-600 text-white text-xl">
                🔍
              </span>
              <CardTitle
                id="symptoms-title"
                className="text-xl text-orange-900"
              >
                Symptômes de {pluralType} usées
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              Voici les signes qui indiquent qu'il est temps de remplacer vos {pluralType} :
            </p>
            <ul className="space-y-3">
              {symptoms.map((symptom, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-orange-200"
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-orange-100 text-orange-600 text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700">{symptom}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 p-3 bg-orange-100 rounded-lg border border-orange-200">
              <p className="text-orange-900 text-sm flex items-start gap-2">
                <span className="text-lg">💡</span>
                <span>
                  Si vous constatez un ou plusieurs de ces symptômes, n'attendez pas pour remplacer vos {pluralType}.
                  Des pièces usées peuvent compromettre votre sécurité et entraîner des réparations plus coûteuses.
                </span>
              </p>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-blue-800 text-sm font-medium flex items-center gap-2">
                <span>👉</span>
                <span>
                  Sélectionnez votre véhicule pour afficher uniquement les {pluralType} compatibles (avant/arrière).
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default SymptomsSection;
