interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  text?: string;
  variant?: "primary" | "secondary" | "white";
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = "md",
  className = "",
  text = "Chargement...",
  variant = "primary",
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const variantClasses = {
    primary: "text-blue-600",
    secondary: "text-gray-600",
    white: "text-white",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Spinner animé */}
      <div
        className={`
        animate-spin rounded-full border-2 border-gray-300 border-t-current
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
      >
        <span className="sr-only">Chargement...</span>
      </div>

      {/* Texte de chargement */}
      {text && (
        <p
          className={`
          mt-3 font-medium
          ${textSizeClasses[size]}
          ${variantClasses[variant]}
        `}
        >
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Composant spécialisé pour le chargement de page
export function PageLoadingSpinner({
  message = "Chargement de la page...",
}: {
  message?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="xl" variant="primary" />
        <p className="mt-4 text-lg text-gray-600">{message}</p>
        <div className="mt-2 text-sm text-gray-500">
          Veuillez patienter quelques instants...
        </div>
      </div>
    </div>
  );
}

// Composant pour le chargement de contenu
export function ContentLoadingSpinner({
  rows = 3,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse space-y-4 ${className}`}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
