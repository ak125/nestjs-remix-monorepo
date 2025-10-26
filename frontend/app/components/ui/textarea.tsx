import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id: providedId, ...props }, ref) => {
    const generatedId = React.useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const textareaElement = (
      <textarea
        id={id}
        aria-invalid={!!error}
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        ref={ref}
        {...props}
      />
    );

    // Backward compatible
    if (!label && !error && !helperText) {
      return textareaElement;
    }

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        {textareaElement}
        
        {error && (
          <p id={errorId} className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}
        
        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
