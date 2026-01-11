interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  variant?: "error" | "warning" | "info";
}

export default function ErrorState({
  title = "Une erreur s'est produite",
  message = "Nous n'avons pas pu charger ces données. Veuillez réessayer.",
  onRetry,
  variant = "error",
}: ErrorStateProps) {
  const variantClasses = {
    error: "bg-destructive/5 border-red-200 text-red-800",
    warning: "bg-warning/5 border-yellow-200 text-yellow-800",
    info: "bg-primary/5 border-blue-200 text-blue-800",
  };

  const iconClasses = {
    error: "⚠️",
    warning: "⚠️",
    info: "ℹ️",
  };

  return (
    <div className={`border rounded-lg p-6 ${variantClasses[variant]}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{iconClasses[variant]}</span>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <p className="mb-4 opacity-90">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-white px-4 py-2 rounded-md border border-current hover:bg-gray-50 transition-colors duration-200"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
