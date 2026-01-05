import * as React from "react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "error" | "purple" | "orange" | "subtle";
type BadgeSize = "xs" | "sm" | "md" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

function Badge({ className = "", variant = "default", size = "sm", icon, children, ...props }: BadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground",
    success: "border-transparent bg-success/20 text-success hover:bg-success/20/80",
    warning: "border-transparent bg-warning/20 text-warning hover:bg-warning/20/80",
    info: "border-transparent bg-info/20 text-info hover:bg-info/20/80",
    error: "border-transparent bg-destructive/20 text-destructive hover:bg-destructive/20/80",
    purple: "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100/80",
    orange: "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-100/80",
    subtle: "border-transparent bg-muted text-muted-foreground",
  };

  const sizeClasses: Record<BadgeSize, string> = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const baseClasses = "inline-flex items-center gap-1 rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

  return (
    <div
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </div>
  );
}

export { Badge };
