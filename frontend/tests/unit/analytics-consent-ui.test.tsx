import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AnalyticsConsent } from "../../app/components/AnalyticsConsent";

const source = ts.createSourceFile(
  "root.tsx",
  readFileSync(resolve(__dirname, "../../app/root.tsx"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let expression = "";
function find(node: ts.Node) {
  if (
    ts.isPropertyAssignment(node) &&
    node.name.getText(source) === "__html" &&
    ts.isTemplateExpression(node.initializer) &&
    node.initializer.head.text.includes("window.dataLayer")
  ) {
    expression = node.initializer.getText(source);
  }
  ts.forEachChild(node, find);
}
find(source);
const bootstrap = runInNewContext(expression, {
  gaMeasurementId: "G-TESTONLY",
});
const key = "automecanik.analytics-consent.v1";

beforeEach(() => {
  window.localStorage.clear();
  window.dataLayer = [];
  delete window.__gtmLoaded;
});
afterEach(() => {
  cleanup();
});

function mount(path = "/", initial?: "granted" | "denied") {
  if (initial)
    localStorage.setItem(
      key,
      JSON.stringify({ choice: initial, updatedAt: Date.now() }),
    );
  // The real controller, with script scheduling disabled: no Google request.
  const pending: Array<() => void> = [];
  window.requestIdleCallback = ((callback: () => void) =>
    pending.push(callback)) as typeof window.requestIdleCallback;
  runInNewContext(bootstrap, { window, document, Event, Date });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AnalyticsConsent />
    </MemoryRouter>,
  );
}

describe("analytics consent UI", () => {
  it("offers equivalent accept and refuse actions and hides after refusal", () => {
    mount();
    const accept = screen.getByRole("button", { name: "Accepter" });
    const refuse = screen.getByRole("button", { name: "Refuser" });
    expect(accept.className).toBe(refuse.className);
    fireEvent.click(refuse);
    expect(window.__analyticsConsent?.getChoice()).toBe("denied");
    expect(screen.queryByRole("region")).toBe(null);
  });
  it("accepts and keeps the recorded choice after remount", () => {
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
    expect(window.__analyticsConsent?.getChoice()).toBe("granted");
    view.unmount();
    mount();
    expect(screen.queryByRole("button", { name: "Accepter" })).toBe(null);
  });
  it.each(["/legal/cookies", "/politique-cookies"])(
    "allows withdrawal on %s",
    (path) => {
      mount(path, "granted");
      fireEvent.click(
        screen.getByRole("button", { name: "Retirer mon accord" }),
      );
      expect(window.__analyticsConsent?.getChoice()).toBe("denied");
      expect(screen.getByRole("status").textContent).toContain("refusée");
      fireEvent.click(screen.getByRole("button", { name: "Accepter" }));
      expect(screen.getByRole("status").textContent).toContain("acceptée");
    },
  );
  it("does not render on admin pages", () => {
    mount("/admin");
    expect(screen.queryByRole("region")).toBe(null);
  });
  it("does not render without an eligible analytics controller", () => {
    delete window.__analyticsConsent;
    render(
      <MemoryRouter>
        <AnalyticsConsent />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("region")).toBe(null);
  });
});
