/**
 * 🎨 FormField - Wrapper réutilisable pour tous les champs de formulaire
 *
 * Automatise:
 * - Label + error + helperText
 * - Intégration React Hook Form
 * - Accessibilité ARIA
 * - Layout consistant
 */

import { type ReactNode, memo } from "react";
import {
  useFormContext,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

interface FormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  name: FieldPath<TFieldValues>;
  label?: string;
  helperText?: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "tel"
    | "number"
    | "textarea"
    | "checkbox";
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  rows?: number;
  children?: ReactNode; // Pour composants custom (Select, etc.)
}

export const FormField = memo(function FormField<
  TFieldValues extends FieldValues = FieldValues,
>({
  name,
  label,
  helperText,
  type = "text",
  placeholder,
  required,
  autoComplete,
  rows,
  children,
}: FormFieldProps<TFieldValues>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TFieldValues>();

  // Extraire l'erreur pour ce champ (supporte nested paths comme "address.city")
  const error = name.split(".").reduce((obj, key) => obj?.[key], errors as any)
    ?.message as string | undefined;

  // Si children fourni, render custom (Select, RadioGroup, etc.)
  if (children) {
    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={name}
            className="block text-sm font-medium text-gray-700"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {children}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }

  // Render Checkbox
  if (type === "checkbox") {
    return (
      <Checkbox
        {...register(name)}
        label={label}
        error={error}
        helperText={helperText}
      />
    );
  }

  // Render Textarea
  if (type === "textarea") {
    return (
      <Textarea
        {...register(name)}
        label={label}
        placeholder={placeholder}
        error={error}
        helperText={helperText}
        rows={rows}
        required={required}
      />
    );
  }

  // Render Input (par défaut)
  return (
    <Input
      {...register(name)}
      type={type}
      label={label}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
      autoComplete={autoComplete}
      required={required}
    />
  );
}) as <TFieldValues extends FieldValues = FieldValues>(
  props: FormFieldProps<TFieldValues>,
) => JSX.Element;
