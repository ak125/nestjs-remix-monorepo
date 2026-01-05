import * as React from "react";
import { cn } from "~/lib/utils";

type AlertSize = 'sm' | 'md' | 'lg';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | string;
  intent?: string; // Alias pour variant
  icon?: React.ReactNode;
  title?: string;
  size?: AlertSize;
}

const variantStyles = {
  default: 'bg-background text-foreground',
  success: 'border-green-200 bg-green-50 text-green-900',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

const sizeStyles: Record<AlertSize, string> = {
  sm: 'p-2 text-sm',
  md: 'p-4',
  lg: 'p-6 text-lg',
};

const Alert = React.forwardRef<
  HTMLDivElement,
  AlertProps
>(({ className, variant = 'default', intent, icon, title, size = 'md', children, ...props }, ref) => {
  const effectiveVariant = intent || variant;
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "relative w-full rounded-lg border",
        sizeStyles[size],
        icon ? "pl-10" : "",
        variantStyles[effectiveVariant as keyof typeof variantStyles] || variantStyles.default,
        className
      )}
      {...props}
    >
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex-shrink-0">
          {icon}
        </span>
      )}
      {title && (
        <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>
      )}
      {children}
    </div>
  );
});
Alert.displayName = "Alert";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription };
