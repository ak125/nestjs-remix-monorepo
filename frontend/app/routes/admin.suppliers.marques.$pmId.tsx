/**
 * /admin/suppliers/marques/:pmId — sources d'achat ordonnées d'une marque
 * (mandat DQ).
 *
 * Lecture : GET /api/suppliers/brands/:pmId/sources (liens
 * ___xtr_supplier_link_pm classés, liens non classés, fiches actives,
 * anomalies signalées sans correction).
 * Écriture : PUT de la même route avec la liste entière ; le rang envoyé est la
 * position, l'auteur est l'utilisateur connecté (slpm_updated_by). Une ligne
 * sans rang n'est pas une source : son lien reste en place, non classé.
 *
 * Hors périmètre : prix et remises (les remises restent dans
 * supplier_price_profiles, par fournisseur × marque) ; rien n'est lu par le
 * calcul des prix ni par le panier.
 */
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
  brandSourcesFormToBody,
  centsToEuros,
  FALLBACK_MODE_LABELS,
  labelOf,
  readCardApiError,
  STOCK_KIND_LABELS,
  SUPPLIER_TYPE_LABELS,
  SUPPLY_MODE_LABELS,
  type BrandSources,
} from "~/components/admin/suppliers/supplier-card";
import {
  requireSupplierAdmin,
  supplierApi,
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

/** Lignes vides proposées pour ajouter une source. */
const EMPTY_ROWS = 3;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  createNoIndexMeta(
    loaderData?.brand.brandName
      ? `${loaderData.brand.brandName} - Sources d'achat - Admin`
      : "Sources d'achat - Admin",
  );

/** pm_id de l'URL : entier positif, sinon 400 sans appel au backend. */
export function brandPmIdParam(raw: string | undefined): string {
  if (!raw || !/^[0-9]{1,9}$/.test(raw)) {
    throw new Response("Marque invalide", { status: 400 });
  }
  return raw;
}

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  await requireSupplierAdmin(context);
  const pmId = brandPmIdParam(params.pmId);
  const res = await supplierApi(
    request,
    `/api/suppliers/brands/${pmId}/sources`,
  );
  if (!res.ok) {
    throw new Response(readCardApiError(res.status, res.payload).message, {
      status: res.status,
    });
  }
  return { brand: res.payload as BrandSources };
}

type ActionResult = { ok: boolean; message: string; errors?: string[] };

export async function action({ request, params, context }: ActionFunctionArgs) {
  await requireSupplierAdmin(context);
  const pmId = brandPmIdParam(params.pmId);
  const form = await request.formData();
  const rowCount = Number(form.get("rowCount") ?? 0);
  if (!Number.isInteger(rowCount) || rowCount < 0 || rowCount > 60) {
    return data<ActionResult>(
      { ok: false, message: "Formulaire invalide" },
      { status: 400 },
    );
  }
  const parsed = brandSourcesFormToBody(form, rowCount);
  if (!parsed.ok) {
    return data<ActionResult>(
      { ok: false, message: "Sources non enregistrées", errors: parsed.errors },
      { status: 400 },
    );
  }
  const res = await supplierApi(
    request,
    `/api/suppliers/brands/${pmId}/sources`,
    { method: "PUT", body: parsed.body },
  );
  if (!res.ok) {
    const error = readCardApiError(res.status, res.payload);
    return data<ActionResult>(
      {
        ok: false,
        message: error.message,
        errors: error.fieldErrors
          ? Object.entries(error.fieldErrors).map(([k, v]) => `${k} : ${v}`)
          : undefined,
      },
      { status: res.status },
    );
  }
  const n = parsed.body.sources.length;
  const done: ActionResult = {
    ok: true,
    message:
      n === 0
        ? "Toutes les sources ont été déclassées"
        : `${n} source(s) enregistrée(s)`,
  };
  return done;
}

/** Ligne du formulaire : lien existant (fournisseur figé) ou ligne nouvelle. */
type FormRow = {
  key: string;
  linkId: string | null;
  splId: string | null;
  name: string | null;
  rank: number | null;
  deliverySplId: string | null;
  stockKind: string | null;
  surchargeCents: number | null;
};

function formRows(brand: BrandSources): FormRow[] {
  const ranked: FormRow[] = brand.sources.map((s) => ({
    key: `l${s.linkId}`,
    linkId: s.linkId,
    splId: s.source.splId,
    name: s.source.name,
    rank: s.rank,
    deliverySplId: s.delivery.isSource ? null : s.delivery.splId,
    stockKind: s.stockKind,
    surchargeCents: s.surchargeCents,
  }));
  const unranked: FormRow[] = brand.unrankedLinks.map((l) => ({
    key: `l${l.linkId}`,
    linkId: l.linkId,
    splId: l.splId,
    name: l.name,
    rank: null,
    deliverySplId: null,
    stockKind: null,
    surchargeCents: null,
  }));
  const empty: FormRow[] = Array.from({ length: EMPTY_ROWS }, (_, i) => ({
    key: `new${i}`,
    linkId: null,
    splId: null,
    name: null,
    rank: null,
    deliverySplId: null,
    stockKind: null,
    surchargeCents: null,
  }));
  return [...ranked, ...unranked, ...empty];
}

export default function AdminBrandSources() {
  const { brand } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const rows = formRows(brand);
  const supplierOptions = brand.activeSuppliers.map((s) => (
    <SelectItem key={s.splId} value={s.splId}>
      #{s.splId} {s.name ?? ""} ({labelOf(SUPPLIER_TYPE_LABELS, s.type)})
    </SelectItem>
  ));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            Sources d'achat — {brand.brandName ?? `marque ${brand.pmId}`}
          </h1>
          <Badge variant="outline">pm_id {brand.pmId}</Badge>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/suppliers">Retour aux fournisseurs</Link>
        </Button>
      </div>

      {result ? (
        <Alert variant={result.ok ? "success" : "error"}>
          <AlertDescription>
            {result.message}
            {result.errors && result.errors.length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {brand.issues.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>Anomalies de la donnée enregistrée</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {brand.issues.map((i) => (
                <li key={`${i.linkId}-${i.code}`}>
                  Rang {i.rank} (lien {i.linkId}) : {i.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ordre actuel ({brand.sources.length})</CardTitle>
          <CardDescription>
            Rang 1 = première source consultée. Le mode d'approvisionnement est
            celui de la fiche d'arrivée ; le repli hors dépôt est celui de la
            fiche source. Les remises restent sur la fiche du fournisseur.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brand.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune source classée pour cette marque.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Livraison</TableHead>
                    <TableHead>Nature</TableHead>
                    <TableHead>Surcoût</TableHead>
                    <TableHead>Approvisionnement</TableHead>
                    <TableHead>Repli</TableHead>
                    <TableHead>Modifié</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brand.sources.map((s) => (
                    <TableRow key={s.linkId}>
                      <TableCell>{s.rank}</TableCell>
                      <TableCell>
                        <Link
                          className="underline"
                          to={`/admin/suppliers/${s.source.splId}`}
                        >
                          {s.source.name ?? `#${s.source.splId}`}
                        </Link>{" "}
                        <span className="text-xs text-muted-foreground">
                          {labelOf(SUPPLIER_TYPE_LABELS, s.source.type)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {s.delivery.isSource
                          ? "Chez la source"
                          : (s.delivery.name ?? `#${s.delivery.splId}`)}
                      </TableCell>
                      <TableCell>
                        {labelOf(STOCK_KIND_LABELS, s.stockKind)}
                      </TableCell>
                      <TableCell>
                        {s.surchargeCents === null
                          ? "—"
                          : `${centsToEuros(s.surchargeCents)} €`}
                      </TableCell>
                      <TableCell>
                        {labelOf(SUPPLY_MODE_LABELS, s.supplyMode)}
                      </TableCell>
                      <TableCell>
                        {labelOf(FALLBACK_MODE_LABELS, s.fallbackMode)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.updatedBy ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modifier l'ordre</CardTitle>
          <CardDescription>
            La liste enregistrée remplace la précédente. Rang vide = pas une
            source (le lien reste, non classé ; aucun lien n'est supprimé).
            Livraison vide = chez la source. Surcoût fixe en euros, 0 si aucun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="rowCount" value={rows.length} />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Point de livraison</TableHead>
                    <TableHead>Nature</TableHead>
                    <TableHead>Surcoût (€)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.key}>
                      <TableCell>
                        <Input
                          aria-label={`Rang ligne ${i + 1}`}
                          name={`rank_${i}`}
                          inputMode="numeric"
                          className="w-16"
                          defaultValue={r.rank ?? ""}
                        />
                      </TableCell>
                      <TableCell>
                        {r.linkId ? (
                          <>
                            <input
                              type="hidden"
                              name={`linkId_${i}`}
                              value={r.linkId}
                            />
                            <input
                              type="hidden"
                              name={`splId_${i}`}
                              value={r.splId ?? ""}
                            />
                            {r.name ?? `#${r.splId}`}{" "}
                            <span className="text-xs text-muted-foreground">
                              lien {r.linkId}
                            </span>
                          </>
                        ) : (
                          <Select
                            aria-label={`Source ligne ${i + 1}`}
                            name={`splId_${i}`}
                            defaultValue=""
                          >
                            <SelectItem value="">Nouvelle source…</SelectItem>
                            {supplierOptions}
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          aria-label={`Point de livraison ligne ${i + 1}`}
                          name={`deliverySplId_${i}`}
                          defaultValue={r.deliverySplId ?? ""}
                        >
                          <SelectItem value="">Chez la source</SelectItem>
                          {supplierOptions}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          aria-label={`Nature ligne ${i + 1}`}
                          name={`stockKind_${i}`}
                          defaultValue={r.stockKind ?? ""}
                        >
                          <SelectItem value="">—</SelectItem>
                          {Object.entries(STOCK_KIND_LABELS).map(([v, t]) => (
                            <SelectItem key={v} value={v}>
                              {t}
                            </SelectItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Surcoût ligne ${i + 1}`}
                          name={`surcharge_${i}`}
                          inputMode="decimal"
                          className="w-24"
                          defaultValue={
                            r.surchargeCents === null
                              ? ""
                              : centsToEuros(r.surchargeCents)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button type="submit" disabled={busy}>
              Enregistrer l'ordre
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
