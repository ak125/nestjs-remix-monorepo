/**
 * Bloc conseils avances pour professionnels et utilisateurs experimentes
 */

import { Link } from "@remix-run/react";
import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

export function NoteProBlock() {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-800">
          <Lightbulb className="h-5 w-5" />
          Note pro : conseils avances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-amber-900">
        <div>
          <p className="font-medium">Multi-vehicules</p>
          <p className="text-amber-800">
            Si vous entretenez plusieurs vehicules (famille, flotte), notez le
            VIN de chacun. Cela vous evitera des erreurs croisees, surtout entre
            variantes du meme modele.
          </p>
        </div>
        <Separator className="bg-amber-200" />
        <div>
          <p className="font-medium">Numero OE (Origine Equipementier)</p>
          <p className="text-amber-800">
            Chaque piece d'origine porte un numero OE grave ou imprime. Ce
            numero permet de retrouver les equivalences chez d'autres
            fabricants. Relevez-le avant de commander une piece de remplacement.
            C'est la methode la plus fiable pour chercher une piece detachee par
            sa reference OEM.
          </p>
        </div>
        <Separator className="bg-amber-200" />
        <div>
          <p className="font-medium">Fiabilite par methode</p>
          <ul className="mt-1 space-y-1 text-amber-800">
            <li>
              <strong>VIN :</strong> compatibilite la plus fiable (configuration
              usine). Permet aussi de trouver le code moteur avec le VIN
              gratuitement.
            </li>
            <li>
              <strong>Manuel :</strong> tres fiable si motorisation exacte,
              parfois verification necessaire sur les variantes.
            </li>
            <li>
              <strong>Immat :</strong> rapide, fiable si base a jour et plaque
              reconnue.
            </li>
            <li>
              <strong>OEM :</strong> 100% precis si vous avez la reference
              d'origine. Ideal pour un remplacement a l'identique.
            </li>
          </ul>
          <p className="mt-2 font-medium text-amber-900">
            En cas de doute sur une piece de securite : privilegiez VIN.
          </p>
        </div>
        <Separator className="bg-amber-200" />
        <div>
          <p className="font-medium">Historique vehicule</p>
          <p className="text-amber-800">
            Conservez un carnet d'entretien numerique avec les references de
            pieces remplacees. Lors du prochain remplacement, vous pourrez
            commander exactement la meme reference sans recherche.
          </p>
        </div>
        <Separator className="bg-amber-200" />
        <div>
          <p className="font-medium">Guides specialises</p>
          <p className="text-amber-800">
            Consultez nos guides par categorie pour aller plus loin :{" "}
            <Link
              to="/blog-pieces-auto/conseils/disque-de-frein"
              className="underline hover:text-amber-950"
            >
              Guide freinage
            </Link>
            ,{" "}
            <Link
              to="/blog-pieces-auto/conseils/batterie"
              className="underline hover:text-amber-950"
            >
              Guide batterie
            </Link>
            ,{" "}
            <Link
              to="/blog-pieces-auto/conseils/filtre-a-huile"
              className="underline hover:text-amber-950"
            >
              Guide filtration
            </Link>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
