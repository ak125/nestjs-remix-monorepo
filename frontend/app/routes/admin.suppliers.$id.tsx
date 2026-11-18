/**
 * /admin/suppliers/:id — fiche fournisseur (mandat CH).
 *
 * Lecture : GET /api/suppliers/:id/card (colonnes réelles de ___xtr_supplier,
 * marques liées, profils de prix, doublons possibles).
 * Actions : validation de localisation (POST :id/location-validation, auteur
 * = utilisateur connecté, jamais automatique) et archivage (POST :id/deactivate,
 * spl_status='archive' + spl_display='0', sans suppression).
 * Accès : nom du secret et état seulement, aucune valeur.
 */
import { type ReactNode } from "react";
import {
  data,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  ACCESS_STATE_LABELS,
  centsToEuros,
  labelOf,
  ORDER_MODE_LABELS,
  readCardApiError,
  SCOPE_LEVEL_LABELS,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TYPE_LABELS,
  SUPPLY_MODE_LABELS,
  type SupplierCard,
} from "~/components/admin/suppliers/supplier-card";
import {
  requireSupplierAdmin,
  supplierApi,
  supplierIdParam,
} from "~/components/admin/suppliers/supplier-card.server";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  createNoIndexMeta(
    loaderData?.card.name
      ? `${loaderData.card.name} - Fournisseur - Admin`
      : "Fournisseur - Admin",
  );

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  await requireSupplierAdmin(context);
  const id = supplierIdParam(params.id);
  const res = await supplierApi(request, `/api/suppliers/${id}/card`);
  if (!res.ok) {
    throw new Response(readCardApiError(res.status, res.payload).message, {
      status: res.status,
    });
  }
  return { card: res.payload as SupplierCard };
}

const ACTIONS = {
  "validate-location": {
    path: "location-validation",
    done: "Localisation validée",
  },
  archive: { path: "deactivate", done: "Fournisseur archivé" },
} as const;

export async function action({ request, params, context }: ActionFunctionArgs) {
  await requireSupplierAdmin(context);
  const id = supplierIdParam(params.id);
  const intent = String((await request.formData()).get("intent") ?? "");
  if (!(intent in ACTIONS)) {
    return data({ ok: false, message: "Action inconnue" }, { status: 400 });
  }
  const { path, done } = ACTIONS[intent as keyof typeof ACTIONS];
  const res = await supplierApi(request, `/api/suppliers/${id}/${path}`, {
    method: "POST",
  });
  if (!res.ok) {
    return data(
      { ok: false, message: readCardApiError(res.status, res.payload).message },
      { status: res.status },
    );
  }
  return { ok: true, message: done };
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{value || "—"}</dd>
    </div>
  );
}

export default function AdminSupplierCard() {
  const { card } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const archived = card.status === "archive";
  const loc = card.location;
  const canValidate = Boolean(loc.country && loc.supplyMode);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {card.name ?? `Fournisseur #${card.id}`}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">#{card.id}</Badge>
            <Badge variant="secondary">
              {labelOf(SUPPLIER_TYPE_LABELS, card.type)}
            </Badge>
            <Badge variant={archived ? "destructive" : "info"}>
              {labelOf(SUPPLIER_STATUS_LABELS, card.status)}
            </Badge>
            {!card.displayed ? <Badge variant="warning">Masqué</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/suppliers">Retour à la liste</Link>
          </Button>
          <Button asChild>
            <Link to={`/admin/suppliers/${card.id}/edit`}>Modifier</Link>
          </Button>
        </div>
      </div>

      {result ? (
        <Alert variant={result.ok ? "success" : "error"}>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}

      {card.possibleDuplicates.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>Doublons possibles</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {card.possibleDuplicates.map((d) => (
                <li key={d.splId}>
                  <Link
                    className="underline"
                    to={`/admin/suppliers/${d.splId}`}
                  >
                    #{d.splId} {d.name ?? ""}
                  </Link>{" "}
                  ({d.kind === "exact" ? "même nom" : "nom proche"})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identité et contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Alias" value={card.alias} />
              <Row label="Contact" value={card.contact.name} />
              <Row label="E-mail" value={card.contact.email} />
              <Row label="Téléphone" value={card.contact.phone} />
              <Row label="Site web" value={card.contact.website} />
              <Row
                label="Dernière modification"
                value={
                  card.updatedAt
                    ? `${formatDate(card.updatedAt)} (${card.updatedBy ?? "?"})`
                    : null
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Localisation</CardTitle>
            <CardDescription>
              Validée par une personne, jamais automatiquement ; une
              modification de la localisation annule la validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl>
              <Row label="Adresse" value={loc.address} />
              <Row
                label="Ville"
                value={[loc.postcode, loc.city].filter(Boolean).join(" ")}
              />
              <Row label="Pays" value={loc.country} />
              <Row
                label="Approvisionnement"
                value={labelOf(SUPPLY_MODE_LABELS, loc.supplyMode)}
              />
              <Row
                label="Validation"
                value={
                  loc.validatedAt ? (
                    <Badge variant="success">
                      Validée le {formatDate(loc.validatedAt)} (
                      {loc.validatedBy ?? "?"})
                    </Badge>
                  ) : (
                    <Badge variant="warning">Non validée</Badge>
                  )
                }
              />
            </dl>
            {!loc.validatedAt && !archived ? (
              <Form method="post">
                <input type="hidden" name="intent" value="validate-location" />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={busy || !canValidate}
                >
                  Valider la localisation
                </Button>
                {!canValidate ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Pays et mode d'approvisionnement requis.
                  </p>
                ) : null}
              </Form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Paiement" value={card.conditions.paymentTerms} />
              <Row
                label="Franco"
                value={
                  card.conditions.francoHtCents === null
                    ? null
                    : `${centsToEuros(card.conditions.francoHtCents)} € HT`
                }
              />
              <Row
                label="Délai"
                value={
                  card.conditions.deliveryDelayDays === null
                    ? null
                    : `${card.conditions.deliveryDelayDays} j`
                }
              />
              <Row
                label="Commande"
                value={labelOf(ORDER_MODE_LABELS, card.conditions.orderMode)}
              />
              <Row label="Portail" value={card.conditions.portalUrl} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accès au portail</CardTitle>
            <CardDescription>
              Nom de la variable des secrets du serveur et état seulement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <Row
                label="Secret"
                value={
                  card.access.secretName ? (
                    <code>{card.access.secretName}</code>
                  ) : null
                }
              />
              <Row
                label="État"
                value={labelOf(ACCESS_STATE_LABELS, card.access.state)}
              />
              <Row
                label="Vérifié le"
                value={
                  card.access.checkedAt
                    ? formatDate(card.access.checkedAt)
                    : null
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marques liées ({card.brands.length})</CardTitle>
          <CardDescription>
            Liens ___xtr_supplier_link_pm ; un lien masqué reste listé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {card.brands.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune marque liée.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {card.brands.map((b) => (
                <Badge
                  key={b.linkId}
                  variant={b.linkDisplayed ? "secondary" : "outline"}
                >
                  {b.brandName ?? `pm_id ${b.pmId ?? "?"}`}
                  {b.linkDisplayed ? "" : " (masqué)"}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profils de remise et de marge</CardTitle>
          <CardDescription>
            Lignes supplier_price_profiles par portée (fournisseur, marque,
            famille, sous-famille) ; une promotion est une ligne datée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {card.priceProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun profil.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Portée</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Remise %</TableHead>
                    <TableHead>Marge %</TableHead>
                    <TableHead>État</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.priceProfiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {labelOf(SCOPE_LEVEL_LABELS, p.scopeLevel)}
                        {p.isPromo ? (
                          <Badge className="ml-2" variant="orange">
                            Promo
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{p.scopeCode ?? "—"}</TableCell>
                      <TableCell>v{p.version}</TableCell>
                      <TableCell>
                        {formatDate(p.effectiveFrom)} →{" "}
                        {formatDate(p.effectiveTo)}
                      </TableCell>
                      <TableCell>{p.defaultRemisePct ?? "—"}</TableCell>
                      <TableCell>{p.defaultMargePct ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.active ? "success" : "outline"}>
                          {p.active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!archived ? (
        <Card>
          <CardHeader>
            <CardTitle>Archiver</CardTitle>
            <CardDescription>
              Statut « archivé » et fiche masquée. Aucune suppression : les
              liens de marque et les profils de prix restent en place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form
              method="post"
              onSubmit={(e) => {
                if (!window.confirm(`Archiver ${card.name ?? card.id} ?`)) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="archive" />
              <Button type="submit" variant="destructive" disabled={busy}>
                Archiver le fournisseur
              </Button>
            </Form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
