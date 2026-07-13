import { renderHook, act } from "@testing-library/react";
import {
  type MouseEvent,
  type MutableRefObject,
  type PointerEvent,
} from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useNativeDialog } from "~/hooks/useNativeDialog";

/**
 * jsdom n'implémente pas <dialog>.showModal()/close() → on les stub.
 * Le vrai gain INP (-54%) est prouvé par sonde Playwright sur build prod ;
 * ces tests verrouillent le CONTRAT du hook (scroll-lock + open/close/backdrop)
 * qui est ce qui risque de régresser silencieusement.
 */
function attachDialog(
  ref: MutableRefObject<HTMLDialogElement | null>,
  opened = false,
): HTMLDialogElement {
  const d = document.createElement("dialog");
  if (opened) d.setAttribute("open", "");
  document.body.appendChild(d);
  ref.current = d;
  return d;
}

describe("useNativeDialog", () => {
  let showModal: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.style.overflow = "";
    showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    (HTMLDialogElement.prototype as unknown as Record<string, unknown>).showModal =
      showModal;
    (HTMLDialogElement.prototype as unknown as Record<string, unknown>).close =
      close;
  });

  afterEach(() => {
    document.body.replaceChildren();
    document.body.style.overflow = "";
  });

  it("open() ouvre via showModal et verrouille le scroll du body", () => {
    const { result } = renderHook(() => useNativeDialog());
    attachDialog(result.current.ref);

    act(() => result.current.open());

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("open() ne ré-ouvre pas un dialog déjà ouvert", () => {
    const { result } = renderHook(() => useNativeDialog());
    attachDialog(result.current.ref, true);

    act(() => result.current.open());

    expect(showModal).not.toHaveBeenCalled();
  });

  it("close() ferme un dialog ouvert", () => {
    const { result } = renderHook(() => useNativeDialog());
    attachDialog(result.current.ref, true);

    act(() => result.current.close());

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("l'event close natif (Échap) déverrouille le scroll et notifie onClose", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useNativeDialog({ onClose }));
    document.body.style.overflow = "hidden";

    act(() => result.current.dialogProps.onClose());

    expect(document.body.style.overflow).toBe("");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clic sur le backdrop (pointerdown + click ciblent le dialog) ferme", () => {
    const { result } = renderHook(() => useNativeDialog());
    const dialog = attachDialog(result.current.ref, true);

    act(() => {
      result.current.dialogProps.onPointerDown({
        target: dialog,
      } as unknown as PointerEvent<HTMLDialogElement>);
      result.current.dialogProps.onClick({
        target: dialog,
      } as unknown as MouseEvent<HTMLDialogElement>);
    });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("geste commencé DANS le contenu et relâché sur le backdrop ne ferme pas (sélection de texte)", () => {
    // mousedown enfant + mouseup backdrop → le navigateur retarget le click
    // sur l'ancêtre commun (le dialog) ; le garde pointerdown doit l'ignorer.
    const { result } = renderHook(() => useNativeDialog());
    const dialog = attachDialog(result.current.ref, true);
    const child = document.createElement("span");
    dialog.appendChild(child);

    act(() => {
      result.current.dialogProps.onPointerDown({
        target: child,
      } as unknown as PointerEvent<HTMLDialogElement>);
      result.current.dialogProps.onClick({
        target: dialog,
      } as unknown as MouseEvent<HTMLDialogElement>);
    });

    expect(close).not.toHaveBeenCalled();
  });

  it("clic à l'intérieur (cible ≠ dialog) ne ferme pas", () => {
    const { result } = renderHook(() => useNativeDialog());
    const dialog = attachDialog(result.current.ref, true);
    const child = document.createElement("a");
    dialog.appendChild(child);

    act(() =>
      result.current.dialogProps.onClick({
        target: child,
      } as unknown as MouseEvent<HTMLDialogElement>),
    );

    expect(close).not.toHaveBeenCalled();
  });
});
