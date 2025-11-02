import { Check, Minus } from "lucide-react";
import * as React from "react";
import { cn } from "~/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, helperText, indeterminate, id: providedId, checked, ...props }, ref) => {
    const generatedId = React.useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    // Fusionner les refs
    React.useImperativeHandle(ref, () => inputRef.current!);
    
    // Gérer l'état indeterminate
    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate || false;
      }
    }, [indeterminate]);

    const checkboxElement = (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          id={id}
          ref={inputRef}
          checked={checked}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          className={cn(
            "peer h-5 w-5 shrink-0 rounded border border-input ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "cursor-pointer appearance-none",
            "checked:bg-primary checked:border-primary",
            error && "border-red-500 focus-visible:ring-red-500",
            className
          )}
          {...props}
        />
        
        {/* Icon check/minus overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white">
          {indeterminate ? (
            <Minus className="h-3 w-3" />
          ) : checked ? (
            <Check className="h-3 w-3" />
          ) : null}
        </div>
      </div>
    );

    // Si pas de label/error/helper, retour simple
    if (!label && !error && !helperText) {
      return checkboxElement;
    }

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {checkboxElement}
          
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {label}
              {props.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}
        </div>
        
        {error && (
          <p id={errorId} className="text-sm text-red-600 flex items-center gap-1.5 ml-7">
            <span>{error}</span>
          </p>
        )}
        
        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted-foreground ml-7">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
