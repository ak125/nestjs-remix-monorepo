/**
 * Tests unitaires — `LazyBoundary` + `isLazyInitError`
 * (`frontend/app/components/LazyBoundary.tsx`).
 *
 * `LazyBoundary` généralise l'ancien `ChatWidgetErrorBoundary`. **Doit
 * classifier** (must-fix red-team #5) : seule la classe « fulfill-with-undefined
 * / safeLazy » est avalée → dégrade vers `fallback` (null par défaut) + observée ;
 * TOUTE autre erreur re-jette pour remonter à l'ErrorBoundary de route (une vraie
 * régression ne doit JAMAIS être masquée silencieusement).
 */

import { render } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LazyBoundary, isLazyInitError } from "~/components/LazyBoundary";

// `vi.hoisted` expose les spies à la factory auto-hoistée de `vi.mock`.
const { reportChunkResolvedInvalid, warn } = vi.hoisted(() => ({
  reportChunkResolvedInvalid: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("~/utils/runtime-errors.client", () => ({ reportChunkResolvedInvalid }));
vi.mock("~/utils/logger", () => ({ logger: { warn } }));

function Thrower({ error }: { error: Error }): ReactNode {
  throw error;
}

/** Outer catch-all boundary to observe whether the inner LazyBoundary re-threw. */
class CatchAll extends Component<
  { onCatch: (e: Error) => void; children: ReactNode },
  { caught: boolean }
> {
  state = { caught: false };
  static getDerivedStateFromError() {
    return { caught: true };
  }
  componentDidCatch(error: Error) {
    this.props.onCatch(error);
  }
  render() {
    return this.state.caught ? <div data-testid="outer-fallback" /> : this.props.children;
  }
}

let consoleErr: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  reportChunkResolvedInvalid.mockClear();
  warn.mockClear();
  // React prints caught render errors to console.error — silence to keep output pristine.
  consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleErr.mockRestore());

describe("isLazyInitError (classifier)", () => {
  it("recognizes a safeLazy resolved-without-default error", () => {
    expect(
      isLazyInitError(new Error("[safeLazy:GlobalFooter] resolved without a default export")),
    ).toBe(true);
  });

  it("recognizes the raw React.lazy reading-'default'-on-undefined TypeError", () => {
    expect(
      isLazyInitError(
        new TypeError("Cannot read properties of undefined (reading 'default')"),
      ),
    ).toBe(true);
  });

  it("does NOT recognize a genuine undefined-read bug on another property", () => {
    expect(
      isLazyInitError(
        new TypeError("Cannot read properties of undefined (reading 'map')"),
      ),
    ).toBe(false);
  });

  it("does NOT recognize an unrelated error", () => {
    expect(isLazyInitError(new Error("something else broke"))).toBe(false);
  });
});

describe("LazyBoundary component", () => {
  it("swallows a lazy-init error → renders fallback null + observes it", () => {
    const { container } = render(
      <LazyBoundary name="GlobalFooter">
        <Thrower error={new Error("[safeLazy:GlobalFooter] resolved without a default export")} />
      </LazyBoundary>,
    );
    expect(container.innerHTML).toBe(""); // degraded to null
    expect(reportChunkResolvedInvalid).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it("re-throws a genuine (non-lazy) error to the parent boundary (not swallowed, not beaconed)", () => {
    const onCatch = vi.fn();
    const { getByTestId } = render(
      <CatchAll onCatch={onCatch}>
        <LazyBoundary name="GlobalFooter">
          <Thrower error={new TypeError("Cannot read properties of undefined (reading 'map')")} />
        </LazyBoundary>
      </CatchAll>,
    );
    expect(getByTestId("outer-fallback")).toBeTruthy(); // inner re-threw → outer caught
    expect(reportChunkResolvedInvalid).not.toHaveBeenCalled();
  });

  it("renders children normally when nothing throws", () => {
    const { getByText } = render(
      <LazyBoundary name="X">
        <span>ok</span>
      </LazyBoundary>,
    );
    expect(getByText("ok")).toBeTruthy();
  });
});
