/**
 * 🪝 useRemixForm - Intégration React Hook Form + Remix
 * 
 * Fusionne la validation client (Zod) avec les erreurs serveur (Remix actions)
 * et gère automatiquement l'état de soumission.
 * 
 * @example
 * ```tsx
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 * 
 * export function LoginForm() {
 *   const { register, handleSubmit, formState: { errors }, isSubmitting } = 
 *     useRemixForm(loginSchema);
 *   
 *   return (
 *     <Form method="post">
 *       <Input {...register('email')} error={errors.email?.message} />
 *       <Button type="submit" loading={isSubmitting}>Login</Button>
 *     </Form>
 *   );
 * }
 * ```
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useActionData, useNavigation } from '@remix-run/react';
import { useEffect } from 'react';
import  { type UseFormProps, type UseFormReturn, type FieldValues, type Path , useForm } from 'react-hook-form';
import  { type z } from 'zod';

export interface RemixFormActionData {
  errors?: Record<string, string | string[]>;
  values?: Record<string, any>;
  error?: string;
  success?: boolean;
}

export interface UseRemixFormReturn<T extends FieldValues> extends UseFormReturn<T> {
  isSubmitting: boolean;
  serverError?: string;
}

/**
 * Hook React Hook Form intégré avec Remix
 */
export function useRemixForm<T extends z.ZodType>(
  schema: T,
  options?: Omit<UseFormProps<z.infer<T>>, 'resolver'>
): UseRemixFormReturn<z.infer<T>> {
  type FormValues = z.infer<T>;
  
  const actionData = useActionData<RemixFormActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const form = useForm<FormValues>({
    // @ts-expect-error - Type incompatibility between zod versions
    resolver: zodResolver(schema),
    defaultValues: actionData?.values as any,
    ...options,
  });

  // Appliquer les erreurs serveur aux champs
  useEffect(() => {
    if (actionData?.errors) {
      Object.entries(actionData.errors).forEach(([field, message]) => {
        const errorMessage = Array.isArray(message) ? message[0] : message;
        form.setError(field as Path<FormValues>, {
          type: 'server',
          message: errorMessage,
        });
      });
    }
  }, [actionData, form]);

  return {
    ...form,
    isSubmitting,
    serverError: actionData?.error,
  };
}

/**
 * Helper pour valider les données de formulaire côté serveur
 * 
 * @example
 * ```tsx
 * export async function action({ request }: ActionFunctionArgs) {
 *   const formData = await request.formData();
 *   
 *   const result = validateFormData(loginSchema, formData);
 *   if (!result.success) {
 *     return json({ errors: result.errors }, { status: 400 });
 *   }
 *   
 *   const { email, password } = result.data;
 *   // ... logique authentification
 * }
 * ```
 */
export function validateFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData
): 
  | { success: true; data: z.infer<T> }
  | { success: false; errors: Record<string, string> } 
{
  const data = Object.fromEntries(formData);
  
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Transformer les erreurs Zod en format simple
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return { success: false, errors };
}

/**
 * Helper pour créer une réponse d'erreur de validation
 */
export function validationError(
  errors: Record<string, string>,
  values?: Record<string, any>
) {
  return {
    errors,
    values,
    success: false,
  };
}

/**
 * Helper pour créer une réponse de succès
 */
export function validationSuccess(data: any) {
  return {
    success: true,
    data,
  };
}
