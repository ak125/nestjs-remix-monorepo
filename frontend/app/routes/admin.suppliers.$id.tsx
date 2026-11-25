/**
 * /admin/suppliers/:id — fiche fournisseur (mandat CH).
 *
 * Lecture : GET /api/suppliers/:id/card (colonnes réelles de ___xtr_supplier,
 * marques liées, profils de prix, doublons possibles).
 * Actions : validation de localisation (POST :id/location-validation, auteur
 * = utilisateur connecté, jamais automatique) et archivage (POST :id/deactivate,
 * spl_status='archive' + spl_display='0', sans suppression).
 * Règles de remise (compléments CH-2 et CH-3) : saisie (POST :id/price-rules,
 * remplacement atomique) et retrait (POST :id/price-rules/:ruleId/retire,
 * active = false, auteur et date) de conditions fournisseur × marque ×
 * famille / sous-famille. Les profils d'import sont affichés en lecture
 * seule. Conditions non lues par le calcul des prix tant que le branchement
 * (mandat séparé) n'est pas fait.
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
  FALLBACK_MODE_LABELS,
  labelOf,
  ORDER_MODE_LABELS,
  priceRuleFormToBody,
  readCardApiError,
  RULE_STATUS_LABELS,
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectItem } from "~/components/ui/select";
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

type ActionResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

/** Intention → route POST dédiée et corps éventuel ; null = refus. */
function actionRequest(
  intent: string,
  form: FormData,
): { path: string; done: string; body?: unknown } | null {
  switch (intent) {
    case "validate-location":
      return { path: "location-validation", done: "Localisation validée" };
    case "archive":
      return { path: "deactivate", done: "Fournisseur archivé" };
    case "add-price-rule":
      return {
        path: "price-rules",
        done: "Règle enregistrée",
        body: priceRuleFormToBody(form),
      };
    case "retire-price-rule": {
      const ruleId = String(form.get("ruleId") ?? "");
      return /^\d{1,12}$/.test(ruleId)
        ? { path: `price-rules/${ruleId}/retire`, done: "Règle retirée" }
        : null;
    }
    default:
      return null;
  }
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  await requireSupplierAdmin(context);
  const id = supplierIdParam(params.id);
  const form = await request.formData();
  const target = actionRequest(String(form.get("intent") ?? ""), form);
  if (!target) {
    return data<ActionResult>(
      { ok: false, message: "Action inconnue" },
      { status: 400 },
    );
  }
  const res = await supplierApi(
    request,
    `/api/suppliers/${id}/${target.path}`,
    {
      method: "POST",
      body: target.body,
    },
  );
  if (!res.ok) {
    const error = readCardApiError(res.status, res.payload);
    return data<ActionResult>(
      { ok: false, message: error.message, fieldErrors: error.fieldErrors },
      { status: res.status },
    );
  }
  const done: ActionResult = { ok: true, message: target.done };
  return done;
}

const RULE_FIELD_LABELS: Record<string, string> = {
  scopeLevel: "Portée",
  brandPmId: "Marque",
  scopeCode: "Code famille ou sous-famille",
  remisePct: "Remise %",
  margePct: "Marge %",
  effectiveFrom: "Début (inclus)",
  effectiveTo: "Fin (exclue)",
  changeReason: "Motif",
};

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
  const brandLabel = (pmId: string | null) =>
    pmId === null
      ? "Toutes"
      : (card.brands.find((b) => String(b.pmId) === pmId)?.brandName ??
        `pm_id ${pmId}`);

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
          <AlertDescription>
            {result.message}
            {result.fieldErrors &&
            Object.keys(result.fieldErrors).length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(result.fieldErrors).map(([field, msg]) => (
                  <li key={field}>
                    {RULE_FIELD_LABELS[field] ?? field} : {msg}
                  </li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
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
                label="Repli hors dépôt"
                value={labelOf(FALLBACK_MODE_LABELS, loc.fallbackMode)}
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
            Liens ___xtr_supplier_link_pm ; un lien masqué reste listé. Une
            marque ouvre ses sources d'achat ordonnées (rang affiché si ce lien
            est classé).
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
                  {b.pmId === null ? (
                    (b.brandName ?? "pm_id ?")
                  ) : (
                    <Link
                      className="underline-offset-2 hover:underline"
                      to={`/admin/suppliers/marques/${b.pmId}`}
                    >
                      {b.brandName ?? `pm_id ${b.pmId}`}
                    </Link>
                  )}
                  {b.sourceRank === null ? "" : ` · rang ${b.sourceRank}`}
                  {b.linkDisplayed ? "" : " (masqué)"}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Remises et marges par portée</CardTitle>
          <CardDescription>
            La règle la plus précise gagne : marque × sous-famille, marque ×
            famille, marque, sous-famille, famille, fournisseur. Une promotion
            (règle datée) prime sur la règle de même portée pendant sa période.
            Ces règles sont enregistrées mais pas encore lues par le calcul des
            prix (branchement : mandat séparé).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {card.priceProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune règle.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Portée</TableHead>
                    <TableHead>Marque</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Remise %</TableHead>
                    <TableHead>Marge %</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="sr-only">Action</TableHead>
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
                        {p.profileKind === "import" ? (
                          <Badge className="ml-2" variant="outline">
                            Profil d’import
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{brandLabel(p.brandPmId)}</TableCell>
                      <TableCell>{p.scopeCode ?? "—"}</TableCell>
                      <TableCell>{p.defaultRemisePct ?? "—"}</TableCell>
                      <TableCell>{p.defaultMargePct ?? "—"}</TableCell>
                      <TableCell>
                        {p.isPromo
                          ? `${formatDate(p.effectiveFrom)} → ${formatDate(p.effectiveTo)}`
                          : "Permanente"}
                      </TableCell>
                      <TableCell>v{p.version}</TableCell>
                      <TableCell>
                        {p.ruleStatus === null ? (
                          <Badge variant="outline">
                            {p.active ? "Lu par l’import" : "Inactif"}
                          </Badge>
                        ) : (
                          <Badge
                            variant={
                              p.ruleStatus === "en_vigueur"
                                ? "success"
                                : "outline"
                            }
                          >
                            {labelOf(RULE_STATUS_LABELS, p.ruleStatus)}
                          </Badge>
                        )}
                        {p.supersededBy !== null ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            par #{p.supersededBy}
                          </span>
                        ) : null}
                        {p.retiredAt !== null ? (
                          <span className="block text-xs text-muted-foreground">
                            Retirée le {formatDate(p.retiredAt)}
                            {p.retiredBy ? ` par ${p.retiredBy}` : ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {p.active && p.profileKind === "condition" ? (
                          <Form
                            method="post"
                            onSubmit={(e) => {
                              if (
                                !window.confirm(`Retirer la règle #${p.id} ?`)
                              )
                                e.preventDefault();
                            }}
                          >
                            <input
                              type="hidden"
                              name="intent"
                              value="retire-price-rule"
                            />
                            <input type="hidden" name="ruleId" value={p.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                            >
                              Retirer
                            </Button>
                          </Form>
                        ) : null}
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
            <CardTitle>Ajouter ou remplacer une règle</CardTitle>
            <CardDescription>
              Même portée, même marque, même code et même période : la règle
              existante est remplacée par une nouvelle version. Exemple : SEIM,
              famille câbles (NU17), remise 32,5.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="post" className="grid gap-4 md:grid-cols-4">
              <input type="hidden" name="intent" value="add-price-rule" />
              <div className="space-y-1.5">
                <Label htmlFor="scopeLevel">
                  {RULE_FIELD_LABELS.scopeLevel}
                </Label>
                <Select id="scopeLevel" name="scopeLevel" defaultValue="FAMILY">
                  {Object.entries(SCOPE_LEVEL_LABELS).map(([value, text]) => (
                    <SelectItem key={value} value={value}>
                      {text}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brandPmId">{RULE_FIELD_LABELS.brandPmId}</Label>
                <Select id="brandPmId" name="brandPmId" defaultValue="">
                  <SelectItem value="">Toutes marques</SelectItem>
                  {card.brands
                    .filter((b) => b.pmId !== null)
                    .map((b) => (
                      <SelectItem key={b.linkId} value={String(b.pmId)}>
                        {b.brandName ?? `pm_id ${b.pmId}`}
                      </SelectItem>
                    ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scopeCode">{RULE_FIELD_LABELS.scopeCode}</Label>
                <Input
                  id="scopeCode"
                  name="scopeCode"
                  placeholder="NU17 ou 1738"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="changeReason">
                  {RULE_FIELD_LABELS.changeReason}
                </Label>
                <Input id="changeReason" name="changeReason" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="remisePct">{RULE_FIELD_LABELS.remisePct}</Label>
                <Input id="remisePct" name="remisePct" inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="margePct">{RULE_FIELD_LABELS.margePct}</Label>
                <Input id="margePct" name="margePct" inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="effectiveFrom">
                  {RULE_FIELD_LABELS.effectiveFrom}
                </Label>
                <Input id="effectiveFrom" name="effectiveFrom" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="effectiveTo">
                  {RULE_FIELD_LABELS.effectiveTo}
                </Label>
                <Input id="effectiveTo" name="effectiveTo" type="date" />
              </div>
              <div className="md:col-span-4">
                <Button type="submit" disabled={busy}>
                  Enregistrer la règle
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      ) : null}

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
