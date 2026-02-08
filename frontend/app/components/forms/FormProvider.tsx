/**
 * 🧩 FormProvider - Wrapper pour React Hook Form + Remix
 *
 * Simplifie l'usage dans les routes Remix:
 * - Auto-wiring useRemixForm + FormProvider
 * - Layout Form avec method POST
 * - Actions loading state
 */

import { Form } from "@remix-run/react";
import { type ReactNode, memo } from "react";
import {
  FormProvider as RHFFormProvider,
  type UseFormReturn,
} from "react-hook-form";

interface FormProviderProps {
  form: UseFormReturn<any>;
  onSubmit: (data: any) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  method?: "post" | "get";
}

export const FormProvider = memo(function FormProvider({
  form,
  onSubmit,
  children,
  className,
  method = "post",
}: FormProviderProps) {
  return (
    <RHFFormProvider {...form}>
      <Form
        method={method}
        onSubmit={form.handleSubmit(onSubmit)}
        className={className}
      >
        {children}
      </Form>
    </RHFFormProvider>
  );
});
