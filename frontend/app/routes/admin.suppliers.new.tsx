/**
 * /admin/suppliers/new — création d'une fiche fournisseur (mandat CH).
 *
 * Écriture : POST /api/suppliers/card. Le backend impose le statut
 * « à confirmer », l'état d'accès « non configuré », et refuse un nom en
 * doublon exact (409 avec les fiches concernées).
 */
import {
  data,
  redirect,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import {
  cardFormToBody,
  readCardApiError,
} from "~/components/admin/suppliers/supplier-card";
import {
  requireSupplierAdmin,
  supplierApi,
} from "~/components/admin/suppliers/supplier-card.server";
import { SupplierCardForm } from "~/components/admin/suppliers/SupplierCardForm";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Nouveau fournisseur - Admin");

export async function loader({ context }: LoaderFunctionArgs) {
  await requireSupplierAdmin(context);
  return null;
}

export async function action({ request, context }: ActionFunctionArgs) {
  await requireSupplierAdmin(context);
  const parsed = cardFormToBody(await request.formData(), "create");
  if (!parsed.ok) {
    return data(
      { message: "Formulaire incomplet", fieldErrors: parsed.errors },
      { status: 400 },
    );
  }
  const res = await supplierApi(request, "/api/suppliers/card", {
    method: "POST",
    body: parsed.body,
  });
  if (!res.ok) {
    return data(readCardApiError(res.status, res.payload), {
      status: res.status,
    });
  }
  const created = res.payload as { id?: string };
  return created.id
    ? redirect(`/admin/suppliers/${created.id}`)
    : redirect("/admin/suppliers");
}

export default function AdminSupplierNew() {
  const errors = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Nouveau fournisseur</h1>
      <SupplierCardForm
        mode="create"
        errors={errors}
        submitting={navigation.state === "submitting"}
        cancelTo="/admin/suppliers"
      />
    </div>
  );
}
