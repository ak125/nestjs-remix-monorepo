import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "~/components/ui/button";

/** UI for the GA4 controller installed by Layout, without a second consent store. */
export function AnalyticsConsent() {
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<"granted" | "denied" | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const settingsPage =
    pathname === "/legal/cookies" || pathname === "/politique-cookies";

  useEffect(() => {
    const update = () => {
      setReady(Boolean(window.__analyticsConsent));
      setChoice(window.__analyticsConsent?.getChoice() ?? null);
    };
    update();
    window.addEventListener("automecanik:analytics-consent", update);
    return () =>
      window.removeEventListener("automecanik:analytics-consent", update);
  }, []);

  if (!ready || pathname.startsWith("/admin")) return null;
  if (!settingsPage && choice !== null && !storageFailed) return null;

  const choose = (next: "granted" | "denied") => {
    const persisted = window.__analyticsConsent?.setChoice(next);
    setStorageFailed(persisted === false);
    setChoice(window.__analyticsConsent?.getChoice() ?? null);
  };

  return (
    <section
      aria-label="Préférences de mesure d’audience"
      className={
        settingsPage
          ? "mx-auto my-6 max-w-3xl rounded-xl border bg-white p-5 shadow-sm"
          : "fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-3xl rounded-xl border bg-white p-5 shadow-xl md:bottom-4"
      }
    >
      <h2 className="text-lg font-semibold text-slate-900">
        Mesure d’audience
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        Avec votre accord, Google Analytics utilise des cookies pour mesurer les
        visites et améliorer le site. Refuser ne gêne pas vos achats. Vous
        pouvez changer votre choix dans « Gestion des cookies » en bas de page.
      </p>
      {settingsPage && (
        <p role="status" className="mt-2 text-sm font-medium text-slate-900">
          {choice === "granted"
            ? "Mesure d’audience acceptée."
            : choice === "denied"
              ? "Mesure d’audience refusée."
              : "Aucun choix enregistré."}
        </p>
      )}
      {storageFailed && (
        <p role="status" className="mt-2 text-sm text-slate-700">
          Votre navigateur ne permet pas d’enregistrer ce choix. Il s’applique à
          cette page ; il vous sera redemandé au prochain chargement.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => choose("denied")}
        >
          {choice === "granted" ? "Retirer mon accord" : "Refuser"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => choose("granted")}
        >
          Accepter
        </Button>
        {!settingsPage && (
          <Link
            to="/legal/cookies"
            className="text-sm text-slate-700 underline"
          >
            En savoir plus
          </Link>
        )}
      </div>
    </section>
  );
}
