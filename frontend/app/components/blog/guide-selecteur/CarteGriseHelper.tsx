/**
 * Aide carte grise — champs utiles pour identifier un vehicule
 * Inclut les champs F1/F2/F3 (FAQ SEO) pour repondre aux requetes People Also Ask
 */

import { CreditCard } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const CARTE_GRISE_FIELDS = [
  {
    code: "B",
    label: "Date de 1ere immatriculation",
    usage: "Determiner l'annee du vehicule",
  },
  { code: "D.1", label: "Marque", usage: "Identifier le constructeur" },
  {
    code: "D.2",
    label: "Type / Variante / Version (mine)",
    usage: "Identifier le modele exact et la phase",
  },
  {
    code: "D.3",
    label: "Denomination commerciale",
    usage: "Nom courant du modele",
  },
  {
    code: "E",
    label: "Numero VIN",
    usage: "Identification unique du vehicule (17 caracteres)",
  },
  {
    code: "F.1",
    label: "Masse en charge maximale (PTAC)",
    usage: "Utile pour freinage et suspension",
  },
  {
    code: "F.2",
    label: "PTAC de l'ensemble",
    usage: "Masse maximale autorisee du vehicule attele",
  },
  {
    code: "F.3",
    label: "PTRA",
    usage: "Poids total roulant autorise (vehicule + remorque)",
  },
  {
    code: "J",
    label: "Categorie du vehicule",
    usage: "VP = vehicule particulier",
  },
  {
    code: "P.3",
    label: "Type de carburant / source d'energie",
    usage: "Essence, diesel, hybride, electrique, GPL",
  },
];

export function CarteGriseHelper() {
  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-green-600" />
          Ou trouver les informations sur votre carte grise
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {CARTE_GRISE_FIELDS.map((field) => (
            <div
              key={field.code}
              className="flex items-start gap-3 rounded-md bg-white p-2 text-sm"
            >
              <Badge variant="outline" className="shrink-0 font-mono">
                {field.code}
              </Badge>
              <div>
                <span className="font-medium text-gray-900">{field.label}</span>
                <span className="text-gray-500"> — {field.usage}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          La carte grise (certificat d'immatriculation) contient toutes les
          informations necessaires pour identifier votre vehicule avec
          precision. Les champs F1, F2 et F3 concernent les masses et sont
          utiles pour dimensionner les pieces de freinage et de suspension.
        </p>
      </CardContent>
    </Card>
  );
}
