import { memo } from "react";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const LoadingState = memo(function LoadingState({
  message = "Chargement...",
  size = "md",
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mb-4`}
      ></div>
      <p className="text-gray-600 animate-pulse">{message}</p>
    </div>
  );
});

export default LoadingState;
