import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: string;
              size?: string;
              text?: string;
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  clientId: string;
  onSuccess?: (redirectUrl: string) => void;
  onError?: (error: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}

export function GoogleSignInButton({
  clientId,
  onSuccess,
  onError,
  text = "signin_with",
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Charger le script GIS
  useEffect(() => {
    if (document.getElementById("google-gsi-script")) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => onError?.("Impossible de charger Google Sign-In");
    document.head.appendChild(script);
  }, [onError]);

  // Initialiser le bouton quand le script est chargé
  useEffect(() => {
    if (!scriptLoaded || !window.google || !buttonRef.current || !clientId)
      return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response.credential) {
          onError?.("Aucun token recu de Google");
          return;
        }

        setIsLoading(true);
        try {
          const res = await fetch("/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ credential: response.credential }),
          });

          const data = await res.json();

          if (data.success) {
            onSuccess?.(data.redirectUrl || "/");
            window.location.href = data.redirectUrl || "/";
          } else {
            onError?.(data.message || "Erreur de connexion Google");
            setIsLoading(false);
          }
        } catch {
          onError?.("Erreur de connexion au serveur");
          setIsLoading(false);
        }
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text,
      width: 400,
      locale: "fr",
    });
  }, [scriptLoaded, clientId, text, onSuccess, onError]);

  if (!clientId) return null;

  return (
    <div className="w-full">
      {isLoading ? (
        <div className="flex items-center justify-center h-11 border border-gray-300 rounded-md bg-gray-50">
          <svg
            className="animate-spin h-5 w-5 text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="ml-2 text-sm text-gray-600">
            Connexion en cours...
          </span>
        </div>
      ) : (
        <div ref={buttonRef} className="flex justify-center [&>div]:!w-full" />
      )}
    </div>
  );
}
