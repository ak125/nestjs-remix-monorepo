/**
 * /admin/suppliers/:id/edit — modification de la fiche fournisseur (mandat CH).
 *
 * `$id_` : la route n'est pas imbriquée sous la fiche `$id` (qui n'a pas
 * d'Outlet) ; l'URL reste /admin/suppliers/:id/edit.
 * Écriture : PUT /api/suppliers/:id/card (schéma Zod strict côté backend).
 */
import {
  data,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  cardFormToBody,
  readCardApiError,
  type SupplierCard,
} from "~/components/admin/suppliers/supplier-card";
import {
  requireSupplierAdmin,
  supplierApi,
  supplierIdParam,
} from "~/components/admin/suppliers/supplier-card.server";
import { SupplierCardForm } from "~/components/admin/suppliers/SupplierCardForm";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  createNoIndexMeta(
    loaderData?.card.name
      ? `Modifier ${loaderData.card.name} - Fournisseur - Admin`
      : "Modifier un fournisseur - Admin",
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

export async function action({ request, params, context }: ActionFunctionArgs) {
  await requireSupplierAdmin(context);
  const id = supplierIdParam(params.id);
  const parsed = cardFormToBody(await request.formData(), "update");
  if (!parsed.ok) {
    return data(
      { message: "Formulaire incomplet", fieldErrors: parsed.errors },
      { status: 400 },
    );
  }
  const res = await supplierApi(request, `/api/suppliers/${id}/card`, {
    method: "PUT",
    body: parsed.body,
  });
  if (!res.ok) {
    return data(readCardApiError(res.status, res.payload), {
      status: res.status,
    });
  }
  return redirect(`/admin/suppliers/${id}`);
}

export default function AdminSupplierEdit() {
  const { card } = useLoaderData<typeof loader>();
  const errors = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Modifier {card.name ?? `#${card.id}`}
        </h1>
        <p className="text-sm text-muted-foreground">Fournisseur #{card.id}</p>
      </div>
      <SupplierCardForm
        mode="update"
        card={card}
        errors={errors}
        submitting={navigation.state === "submitting"}
        cancelTo={`/admin/suppliers/${card.id}`}
      />
    </div>
  );
}
