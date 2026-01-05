import { Info } from 'lucide-react';
import { pluralizePieceName } from '~/lib/seo-utils';
import { cn } from '~/lib/utils';

interface UXMessageBoxProps {
  gammeName?: string;
  className?: string;
}

/**
 * Encadré UX - Message de réassurance pour guider l'utilisateur
 * "Pas besoin de connaître la référence. Sélectionnez votre véhicule..."
 */
export function UXMessageBox({ gammeName, className }: UXMessageBoxProps) {
  const pieceType = gammeName?.toLowerCase() || 'pièce';
  const pluralType = pluralizePieceName(pieceType);

  return (
    <div
      className={cn(
        'container mx-auto px-4 -mt-4 mb-6 relative z-10',
        className
      )}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Info className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-blue-900 font-medium text-base leading-relaxed">
              <span className="text-green-600 mr-2">✅</span>
              Pas besoin de connaître la référence ni le type de {pluralType}.
            </p>
            <p className="text-blue-700 text-sm mt-1">
              Sélectionnez votre véhicule : nous affichons uniquement les {pluralType} compatibles (avant/arrière).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UXMessageBox;
