import React, { type ErrorInfo, type ReactNode , Component } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Appel du callback d'erreur si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Tracking analytics pour les erreurs
    if (typeof gtag !== 'undefined') {
      gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        custom_parameter_component_stack: errorInfo.componentStack
      });
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Interface fallback personnalisée si fournie
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Interface d'erreur par défaut
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <svg
                className="mx-auto h-16 w-16 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.888-.833-2.598 0L3.216 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Oops ! Une erreur est survenue
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Nous nous excusons pour la gêne occasionnée.
              </p>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Détails de l'erreur
              </h3>
              
              {this.state.error && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Message :</p>
                  <code className="block p-3 bg-gray-100 rounded text-sm text-red-600 font-mono break-words">
                    {this.state.error.message}
                  </code>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Stack trace :</p>
                  <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-32 text-gray-700">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Recharger la page
                </button>
                
                <button
                  onClick={() => window.history.back()}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Retour
                </button>
              </div>

              <div className="mt-4 text-center">
                <a
                  href="/"
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Retourner à l'accueil
                </a>
              </div>
            </div>

            {/* Formulaire de rapport d'erreur */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Signaler le problème
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Aidez-nous à améliorer l'expérience en signalant cette erreur.
              </p>
              <button
                onClick={() => {
                  const errorReport = {
                    message: this.state.error?.message,
                    stack: this.state.error?.stack,
                    componentStack: this.state.errorInfo?.componentStack,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                  };
                  
                  // Envoi du rapport d'erreur à l'API
                  fetch('/api/error-reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(errorReport)
                  }).catch(console.error);
                  
                  alert('Rapport d\'erreur envoyé. Merci !');
                }}
                className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                Envoyer le rapport d'erreur
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook pour utilisation dans les composants fonctionnels
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error("Error caught by useErrorHandler:", error, errorInfo);
    
    // Analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  };
};

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}