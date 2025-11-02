import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "danger";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  progress?: number;
  onClick?: () => void;
  enhanced?: boolean;
}

export function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = "default", 
  trend,
  progress,
  onClick,
  enhanced = false
}: StatCardProps) {
  const variants = {
    default: "border-gray-200 bg-white",
    success: "border-success bg-success/10",
    warning: "border-warning bg-warning/10", 
    danger: "border-destructive bg-destructive/10"
  };

  const iconVariants = {
    default: "text-gray-500",
    success: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-red-600"
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        variants[variant],
        onClick && "cursor-pointer hover:shadow-md hover:scale-105",
        enhanced && "relative overflow-hidden"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-700">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4", iconVariants[variant])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        
        {/* Enhanced: Progress Bar */}
        {enhanced && typeof progress === 'number' && (
          <div className="mt-3">
            <Progress 
              value={progress} 
              className={cn("h-2", {
                "[&>div]:bg-success": progress >= 70,
                "[&>div]:bg-warning": progress >= 40 && progress < 70,
                "[&>div]:bg-destructive": progress < 40
              })}
            />
            <div className="mt-1 text-xs text-gray-500">
              {progress}% complété
            </div>
          </div>
        )}

        {/* Enhanced: Trend Indicator */}
        {enhanced && trend && (
          <div className="mt-2 flex items-center text-xs">
            <span className={cn(
              "flex items-center font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {trend.isPositive ? "↗" : "↘"} {Math.abs(trend.value)}%
            </span>
            <span className="ml-1 text-gray-500">vs mois dernier</span>
          </div>
        )}

        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
