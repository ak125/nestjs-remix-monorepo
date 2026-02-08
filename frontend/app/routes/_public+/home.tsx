import { type MetaFunction } from "@remix-run/node";
import { Button } from "~/components/ui/button";

export const meta: MetaFunction = () => [
  { title: "Automecanik - Pièces Automobiles en Ligne" },
  {
    name: "description",
    content:
      "Découvrez notre large gamme de pièces automobiles de qualité. Livraison rapide et prix compétitifs.",
  },
  { name: "robots", content: "index, follow" },
  {
    property: "og:title",
    content: "Automecanik - Pièces Automobiles en Ligne",
  },
  {
    property: "og:description",
    content:
      "Découvrez notre large gamme de pièces automobiles de qualité. Livraison rapide et prix compétitifs.",
  },
  { property: "og:type", content: "website" },
];

export default function Index() {
  return (
    <div className="flex flex-col gap-3">
      <h1>AUTOMECANIK</h1>
      <Button variant={"primary"}>Créer un compte</Button>
    </div>
  );
}
