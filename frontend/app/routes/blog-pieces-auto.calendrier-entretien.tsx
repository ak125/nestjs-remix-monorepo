/**
 * Route : /blog-pieces-auto/calendrier-entretien
 * Calendrier d'entretien automobile — page statique noindex/nofollow
 */

import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  AlertTriangle,
  Battery,
  Calendar,
  CheckCircle,
  Droplets,
  Gauge,
  Snowflake,
  Sun,
  Thermometer,
  Wrench,
} from "lucide-react";

import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

/* ===========================================================================
   SEO — noindex, nofollow
   =========================================================================== */

export const meta: MetaFunction = () => [
  { title: "Calendrier d'entretien automobile | Blog AutoMecanik" },
  {
    name: "description",
    content:
      "Calendrier d'entretien complet pour votre vehicule : vidange, filtres, freins, distribution, controles saisonniers. Intervalles en km et en mois.",
  },
  { name: "robots", content: "noindex, nofollow" },
];

/* ===========================================================================
   DATA
   =========================================================================== */

const ENTRETIEN_PERIODIQUE = [
  {
    piece: "Vidange huile moteur",
    kmInterval: "10 000 - 15 000 km",
    tempsInterval: "1 an",
    importance: "critique" as const,
    lien: "/pieces/huile-moteur",
    conseil:
      "Utiliser l'huile recommandee par le constructeur (viscosite sur le carnet d'entretien).",
  },
  {
    piece: "Filtre a huile",
    kmInterval: "A chaque vidange",
    tempsInterval: "1 an",
    importance: "critique" as const,
    lien: "/pieces/filtre-a-huile",
    conseil: "Toujours remplacer en meme temps que l'huile moteur.",
  },
  {
    piece: "Filtre a air",
    kmInterval: "20 000 - 30 000 km",
    tempsInterval: "2 ans",
    importance: "important" as const,
    lien: "/pieces/filtre-a-air",
    conseil:
      "Un filtre encrasse augmente la consommation de carburant de 5 a 10 %.",
  },
  {
    piece: "Filtre habitacle (pollen)",
    kmInterval: "15 000 - 20 000 km",
    tempsInterval: "1 an",
    importance: "normal" as const,
    lien: "/pieces/filtre-habitacle",
    conseil:
      "Remplacer avant l'ete pour une climatisation efficace. Filtre a charbon actif pour les allergiques.",
  },
  {
    piece: "Liquide de frein",
    kmInterval: "40 000 km",
    tempsInterval: "2 ans",
    importance: "critique" as const,
    lien: "/pieces/liquide-de-frein",
    conseil:
      "Le liquide de frein absorbe l'humidite avec le temps, ce qui reduit son efficacite.",
  },
  {
    piece: "Plaquettes de frein avant",
    kmInterval: "30 000 - 50 000 km",
    tempsInterval: "Variable",
    importance: "critique" as const,
    lien: "/pieces/plaquettes-de-frein",
    conseil: "Verifier l'epaisseur tous les 20 000 km. Minimum legal : 2 mm.",
  },
  {
    piece: "Disques de frein avant",
    kmInterval: "60 000 - 80 000 km",
    tempsInterval: "Variable",
    importance: "critique" as const,
    lien: "/pieces/disques-de-frein",
    conseil:
      "Remplacer si epaisseur sous le minimum (grave sur le disque) ou si voile.",
  },
  {
    piece: "Bougies d'allumage (essence)",
    kmInterval: "30 000 - 60 000 km",
    tempsInterval: "3-4 ans",
    importance: "important" as const,
    lien: "/pieces/bougies-d-allumage",
    conseil:
      "Bougies iridium : jusqu'a 100 000 km. Symptome d'usure : ratees au demarrage.",
  },
  {
    piece: "Courroie de distribution",
    kmInterval: "80 000 - 120 000 km",
    tempsInterval: "5-6 ans",
    importance: "critique" as const,
    lien: "/pieces/kit-de-distribution",
    conseil:
      "Rupture = casse moteur. Toujours remplacer la pompe a eau en meme temps.",
  },
  {
    piece: "Liquide de refroidissement",
    kmInterval: "60 000 km",
    tempsInterval: "4-5 ans",
    importance: "important" as const,
    lien: "/pieces/liquide-de-refroidissement",
    conseil: "Ne jamais melanger les types de liquide (G11, G12, G13).",
  },
  {
    piece: "Batterie",
    kmInterval: "—",
    tempsInterval: "4-5 ans",
    importance: "important" as const,
    lien: "/pieces/batterie",
    conseil:
      "Tester la tension avant l'hiver. Sous 12,4 V au repos = remplacement proche.",
  },
  {
    piece: "Amortisseurs",
    kmInterval: "80 000 - 100 000 km",
    tempsInterval: "5-6 ans",
    importance: "important" as const,
    lien: "/pieces/amortisseur",
    conseil:
      "Usure progressive, difficile a detecter. Tester au controle technique.",
  },
  {
    piece: "Pneus",
    kmInterval: "40 000 - 50 000 km",
    tempsInterval: "5 ans max",
    importance: "critique" as const,
    lien: "/pieces/pneu",
    conseil:
      "Profondeur minimale legale : 1,6 mm (recommande : 3 mm). Verifier aussi les flancs.",
  },
];

const CONTROLES_MENSUELS = [
  {
    element: "Niveau d'huile moteur",
    icon: Droplets,
    detail:
      "Verifier a froid, moteur a l'horizontale. Completer si sous le repere MIN.",
  },
  {
    element: "Liquide de refroidissement",
    icon: Thermometer,
    detail:
      "Niveau entre MIN et MAX sur le vase d'expansion. Ne jamais ouvrir a chaud.",
  },
  {
    element: "Pression des pneus",
    icon: Gauge,
    detail:
      "Verifier a froid. Valeurs sur l'etiquette montant de porte conducteur. +0,2 bar si charge lourde.",
  },
  {
    element: "Eclairage",
    icon: Sun,
    detail:
      "Feux de croisement, de route, clignotants, feux de recul, feux stop. Remplacer par paire.",
  },
  {
    element: "Lave-glace",
    icon: Droplets,
    detail: "Completer avec du liquide lave-glace (pas d'eau seule en hiver).",
  },
  {
    element: "Essuie-glaces",
    icon: Wrench,
    detail: "Verifier les traces. Remplacer si trainees ou bruit au passage.",
  },
];

const ALERTES_KM = [
  {
    palier: "10 000 km",
    actions: [
      "Premiere vidange huile + filtre",
      "Controle visuel freins",
      "Verification pression pneus",
    ],
  },
  {
    palier: "30 000 km",
    actions: [
      "Vidange + filtres (huile, air, habitacle)",
      "Remplacement bougies (essence)",
      "Controle plaquettes de frein",
      "Controle courroie accessoires",
    ],
  },
  {
    palier: "60 000 km",
    actions: [
      "Vidange complete + tous filtres",
      "Remplacement liquide de frein",
      "Controle disques de frein",
      "Verification amortisseurs",
      "Remplacement liquide de refroidissement",
    ],
  },
  {
    palier: "100 000 km",
    actions: [
      "Remplacement courroie de distribution + pompe a eau",
      "Remplacement amortisseurs si usure",
      "Controle embrayage (boite manuelle)",
      "Revision complete suspension",
      "Remplacement bougies iridium",
    ],
  },
  {
    palier: "150 000 km",
    actions: [
      "2e remplacement distribution",
      "Controle vanne EGR / turbo (diesel)",
      "Remplacement silent-blocs si jeu",
      "Verification boite de vitesses (huile)",
      "Bilan complet train roulant",
    ],
  },
];

/* ===========================================================================
   HELPERS
   =========================================================================== */

function ImportanceBadge({
  level,
}: {
  level: "critique" | "important" | "normal";
}) {
  const styles = {
    critique: "bg-red-100 text-red-700 border-red-200",
    important: "bg-amber-100 text-amber-700 border-amber-200",
    normal: "bg-green-100 text-green-700 border-green-200",
  };
  const labels = {
    critique: "Critique",
    important: "Important",
    normal: "Normal",
  };
  return (
    <Badge variant="outline" className={styles[level]}>
      {labels[level]}
    </Badge>
  );
}

/* ===========================================================================
   PAGE
   =========================================================================== */

export default function CalendrierEntretienPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <BlogPiecesAutoNavigation />

      <CompactBlogHeader
        title="Calendrier d'entretien automobile"
        description="Tous les intervalles de remplacement pour maintenir votre vehicule en parfait etat. Adapte aux recommandations constructeur les plus courantes."
        gradientFrom="from-orange-600"
        gradientTo="to-amber-500"
        breadcrumb={[
          { label: "Blog", href: "/blog-pieces-auto" },
          { label: "Calendrier entretien" },
        ]}
        stats={[
          { icon: Wrench, value: "13", label: "pieces" },
          { icon: Calendar, value: "5", label: "paliers km" },
        ]}
      />

      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-10">
        {/* ── Section 1 : Entretien periodique ── */}
        <section id="entretien-periodique">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wrench className="w-5 h-5 text-orange-600" />
                Entretien periodique — Intervalles de remplacement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Ces intervalles sont des moyennes. Consultez toujours le
                  carnet d&apos;entretien de votre vehicule pour les
                  preconisations exactes du constructeur.
                </AlertDescription>
              </Alert>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Piece</TableHead>
                      <TableHead>Kilometrage</TableHead>
                      <TableHead>Duree</TableHead>
                      <TableHead>Priorite</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Conseil
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ENTRETIEN_PERIODIQUE.map((item) => (
                      <TableRow key={item.piece}>
                        <TableCell className="font-medium">
                          <Link
                            to={item.lien}
                            className="text-blue-600 hover:underline"
                          >
                            {item.piece}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.kmInterval}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.tempsInterval}</Badge>
                        </TableCell>
                        <TableCell>
                          <ImportanceBadge level={item.importance} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-gray-600 max-w-[300px]">
                          {item.conseil}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 2 : Entretien saisonnier ── */}
        <section id="entretien-saisonnier">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calendar className="w-5 h-5 text-blue-600" />
                Entretien saisonnier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Ete */}
                <div className="border rounded-lg p-5 bg-amber-50/50 border-amber-200">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    <Sun className="w-5 h-5 text-amber-500" />
                    Avant l&apos;ete (avril-mai)
                  </h3>
                  <ul className="space-y-2">
                    {[
                      "Recharge climatisation si souffle tiede",
                      "Verification liquide de refroidissement",
                      "Controle pneus ete (profondeur + pression)",
                      "Nettoyage filtre habitacle (pollen)",
                      "Verification essuie-glaces avant les orages",
                      "Controle batterie (la chaleur l'use aussi)",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Hiver */}
                <div className="border rounded-lg p-5 bg-blue-50/50 border-blue-200">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    <Snowflake className="w-5 h-5 text-blue-500" />
                    Avant l&apos;hiver (octobre-novembre)
                  </h3>
                  <ul className="space-y-2">
                    {[
                      "Montage pneus hiver ou 4 saisons",
                      "Verification antigel (concentration -20°C min)",
                      "Test batterie (tension > 12,4 V)",
                      "Remplacement essuie-glaces si traces",
                      "Lave-glace antigel (-20°C)",
                      "Controle eclairage complet (jours courts)",
                      "Verification chauffage et desembuage",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 3 : Controles mensuels ── */}
        <section id="controles-mensuels">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Controles mensuels recommandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CONTROLES_MENSUELS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.element}
                      className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm">
                          {item.element}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 4 : Alertes kilometrage ── */}
        <section id="alertes-km">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gauge className="w-5 h-5 text-purple-600" />
                Alertes par palier kilometrique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {ALERTES_KM.map((palier) => (
                  <div
                    key={palier.palier}
                    className="border-l-4 border-purple-300 pl-4"
                  >
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-sm">
                        {palier.palier}
                      </Badge>
                    </h3>
                    <ul className="space-y-1">
                      {palier.actions.map((action) => (
                        <li
                          key={action}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <Wrench className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 5 : CTA ── */}
        <section id="cta">
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="py-8">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Trouvez vos pieces d&apos;entretien au meilleur prix
                </h2>
                <p className="text-gray-600 max-w-xl mx-auto">
                  Selectionnez votre vehicule pour voir uniquement les pieces
                  compatibles parmi nos 4 millions de references.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {[
                    {
                      label: "Vidange & filtres",
                      href: "/pieces/huile-moteur",
                    },
                    { label: "Freinage", href: "/pieces/plaquettes-de-frein" },
                    {
                      label: "Distribution",
                      href: "/pieces/kit-de-distribution",
                    },
                    { label: "Batterie", href: "/pieces/batterie" },
                    { label: "Amortisseurs", href: "/pieces/amortisseur" },
                  ].map((cta) => (
                    <Link
                      key={cta.href}
                      to={cta.href}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-orange-200 rounded-full text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      <Battery className="w-3.5 h-3.5" />
                      {cta.label}
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Disclaimer ── */}
        <Alert className="border-gray-200">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-gray-600 text-sm">
            Ce calendrier est fourni a titre indicatif. Les intervalles
            d&apos;entretien varient selon le constructeur, le modele, le type
            de motorisation et les conditions d&apos;utilisation. Referez-vous
            toujours au carnet d&apos;entretien officiel de votre vehicule.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
