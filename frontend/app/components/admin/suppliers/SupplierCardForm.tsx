/**
 * Formulaire de fiche fournisseur (création et modification).
 *
 * Champ « secret » : seulement le NOM de la variable d'environnement du
 * serveur (ex. SUPPLIER_DCA_PASSWORD). La valeur se pose par Marwane dans les
 * secrets du serveur, jamais ici. La validation de localisation est une action
 * dédiée de la fiche, pas un champ.
 */
import { Form, Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
  centsToEuros,
  ORDER_MODE_LABELS,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TYPE_LABELS,
  SUPPLY_MODE_LABELS,
  type SupplierCard,
  type SupplierDuplicate,
} from "./supplier-card";

export interface SupplierCardFormErrors {
  message?: string;
  fieldErrors?: Record<string, string>;
  duplicates?: SupplierDuplicate[];
}

interface Props {
  mode: "create" | "update";
  card?: SupplierCard;
  errors?: SupplierCardFormErrors;
  submitting: boolean;
  cancelTo: string;
}

function Field({
  name,
  label,
  defaultValue,
  error,
  hint,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  error?: string;
  hint?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${name}-help` : undefined}
      />
      {error ? (
        <p id={`${name}-help`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-help`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Choice({
  name,
  label,
  options,
  defaultValue,
  error,
  allowEmpty = true,
}: {
  name: string;
  label: string;
  options: Record<string, string>;
  defaultValue?: string | null;
  error?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
      >
        {allowEmpty ? <SelectItem value="">Non renseigné</SelectItem> : null}
        {Object.entries(options).map(([value, text]) => (
          <SelectItem key={value} value={value}>
            {text}
          </SelectItem>
        ))}
      </Select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function SupplierCardForm({
  mode,
  card,
  errors,
  submitting,
  cancelTo,
}: Props) {
  const fe = errors?.fieldErrors ?? {};
  const editableStatuses = Object.fromEntries(
    Object.entries(SUPPLIER_STATUS_LABELS).filter(([v]) => v !== "archive"),
  );

  return (
    <Form method="post" className="space-y-6" noValidate>
      {errors?.message ? (
        <Alert variant="error">
          <AlertTitle>Enregistrement refusé</AlertTitle>
          <AlertDescription>
            {errors.message}
            {errors.duplicates && errors.duplicates.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {errors.duplicates.map((d) => (
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
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
          <CardDescription>
            Plateforme (catalogue multimarque) ou marque achetée en direct.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            name="name"
            label="Nom"
            required
            defaultValue={card?.name}
            error={fe.name}
          />
          <Field
            name="alias"
            label="Alias"
            defaultValue={card?.alias}
            error={fe.alias}
            hint={mode === "create" ? "Déduit du nom s'il est laissé vide" : undefined}
          />
          <Choice
            name="type"
            label="Type"
            options={SUPPLIER_TYPE_LABELS}
            defaultValue={card?.type}
            error={fe.type}
          />
          {mode === "update" ? (
            card?.status === "archive" ? (
              <p className="text-sm text-muted-foreground md:self-end">
                Fournisseur archivé : statut inchangé par ce formulaire.
              </p>
            ) : (
              <Choice
                name="status"
                label="Statut"
                options={editableStatuses}
                defaultValue={card?.status}
                error={fe.status}
                allowEmpty={false}
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground md:self-end">
              Statut à la création : « À confirmer ».
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Localisation</CardTitle>
          <CardDescription>
            Toute modification de ces champs annule la validation de
            localisation, à refaire depuis la fiche.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field
              name="address"
              label="Adresse"
              defaultValue={card?.location.address}
              error={fe.address}
            />
          </div>
          <Field
            name="postcode"
            label="Code postal"
            defaultValue={card?.location.postcode}
            error={fe.postcode}
          />
          <Field
            name="city"
            label="Ville"
            defaultValue={card?.location.city}
            error={fe.city}
          />
          <Field
            name="country"
            label="Pays (ISO 2 lettres)"
            defaultValue={card?.location.country}
            error={fe.country}
            hint="FR, DE, IT…"
          />
          <Choice
            name="supplyMode"
            label="Mode d'approvisionnement"
            options={SUPPLY_MODE_LABELS}
            defaultValue={card?.location.supplyMode}
            error={fe.supplyMode}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            name="contactName"
            label="Contact"
            defaultValue={card?.contact.name}
            error={fe.contactName}
          />
          <Field
            name="email"
            label="E-mail"
            type="email"
            defaultValue={card?.contact.email}
            error={fe.email}
          />
          <Field
            name="phone"
            label="Téléphone"
            type="tel"
            defaultValue={card?.contact.phone}
            error={fe.phone}
          />
          <Field
            name="website"
            label="Site web"
            type="url"
            defaultValue={card?.contact.website}
            error={fe.website}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conditions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            name="paymentTerms"
            label="Conditions de paiement"
            defaultValue={card?.conditions.paymentTerms}
            error={fe.paymentTerms}
          />
          <Field
            name="francoEuros"
            label="Franco de port (€ HT)"
            defaultValue={centsToEuros(card?.conditions.francoHtCents)}
            error={fe.francoEuros}
            hint="Ex. 150 ou 150,50"
          />
          <Field
            name="deliveryDelayDays"
            label="Délai de livraison (jours)"
            type="number"
            defaultValue={card?.conditions.deliveryDelayDays}
            error={fe.deliveryDelayDays}
          />
          <Choice
            name="orderMode"
            label="Mode de commande"
            options={ORDER_MODE_LABELS}
            defaultValue={card?.conditions.orderMode}
            error={fe.orderMode}
          />
          <div className="md:col-span-2">
            <Field
              name="portalUrl"
              label="URL du portail"
              type="url"
              defaultValue={card?.conditions.portalUrl}
              error={fe.portalUrl}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accès au portail</CardTitle>
          <CardDescription>
            Nom de la variable des secrets du serveur, jamais l'identifiant ni
            le mot de passe. La pose du secret et sa vérification se font hors
            de cet écran.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            name="secretName"
            label="Nom du secret"
            defaultValue={card?.access.secretName}
            error={fe.secretName}
            hint="Majuscules, chiffres et _ (ex. SUPPLIER_DCA_PASSWORD)"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Enregistrement…"
            : mode === "create"
              ? "Créer la fiche"
              : "Enregistrer"}
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>Annuler</Link>
        </Button>
      </div>
    </Form>
  );
}
