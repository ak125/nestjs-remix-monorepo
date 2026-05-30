/**
 * useNativeDialog — drawer/modal via l'élément natif <dialog> (top-layer).
 *
 * Pourquoi : ouvrir un Radix Dialog/Sheet exécute synchronement sa machinerie
 * (react-remove-scroll + FocusScope qui LISENT le layout → reflow forcé) sur le
 * thread principal pendant l'interaction → INP élevé (mesuré ~208-304ms @6x sur
 * /pieces/, cause du flag CrUX "INP > 500ms mobile"). L'élément natif <dialog>
 * rend en **top layer** (hors flux document, pas de reflow), avec focus-trap,
 * Échap et aria-modal **natifs** (pas de JS à exécuter). Mesuré : -54% @6x.
 *
 * Le contenu doit être rendu en permanence dans le <dialog> (display:none tant
 * que fermé) pour que `showModal()` soit quasi-instantané (aucun render React au
 * clic). Scroll-lock = une seule écriture `body.overflow` (pas de lecture → pas
 * de thrash).
 *
 * Accessibilité fournie par la plateforme : focus-trap, Échap (event `close`),
 * `aria-modal`, restauration du focus, inert background.
 */
import { useCallback, useEffect, useRef } from "react";

interface UseNativeDialogOptions {
  /** Appelé quand le dialog se ferme (Échap natif, clic backdrop, ou close()). */
  onClose?: () => void;
}

export function useNativeDialog({ onClose }: UseNativeDialogOptions = {}) {
  const ref = useRef<HTMLDialogElement>(null);

  const lockScroll = (locked: boolean) => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = locked ? "hidden" : "";
    }
  };

  const open = useCallback(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      lockScroll(true);
    }
  }, []);

  const close = useCallback(() => {
    const d = ref.current;
    if (d?.open) d.close(); // déclenche l'event `close` → onClose ci-dessous
  }, []);

  // Garantit le déverrouillage du scroll si le composant disparaît pendant l'ouverture.
  useEffect(() => () => lockScroll(false), []);

  /** Props à étaler sur l'élément <dialog>. */
  const dialogProps = {
    ref,
    onClose: () => {
      lockScroll(false);
      onClose?.();
    },
    // Clic sur le backdrop (la cible est l'élément <dialog> lui-même) = fermeture.
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === ref.current) close();
    },
  };

  return { ref, open, close, dialogProps };
}
