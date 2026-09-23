// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

// Execute the inline script shipped by Layout, not a copied bootstrap. The DOM
// has no resource loader: gtag.js and analytics collection never leave the test.
const source = ts.createSourceFile(
  "root.tsx",
  readFileSync(new URL("../../app/root.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let bootstrapExpression = "";
let pageViewEffect = "";
function findBootstrap(node: ts.Node): void {
  if (
    ts.isPropertyAssignment(node) &&
    node.name.getText(source) === "__html" &&
    ts.isTemplateExpression(node.initializer) &&
    node.initializer.head.text.includes("window.dataLayer")
  ) {
    bootstrapExpression = node.initializer.getText(source);
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(source) === "useEffect" &&
    node.arguments[0]?.getText(source).includes("const trackPageView")
  ) {
    pageViewEffect = ts.transpileModule(
      "(" + node.arguments[0].getText(source) + ")()",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText;
  }
  ts.forEachChild(node, findBootstrap);
}
findBootstrap(source);
if (!bootstrapExpression) throw new Error("Layout GA4 bootstrap not found");
const bootstrap = runInNewContext(bootstrapExpression, {
  gaMeasurementId: "G-TESTONLY",
}) as string;

const doms: JSDOM[] = [];
afterEach(() => {
  for (const dom of doms.splice(0)) dom.window.close();
});

function start(hasIdleCallback = true) {
  const dom = new JSDOM("<!doctype html><title>Pièces auto</title>", {
    url: "https://automecanik.example/pieces?marque=renault",
    runScripts: "outside-only",
    referrer: "https://search.example/",
  });
  doms.push(dom);
  const { window } = dom;
  const pending: Array<() => void> = [];
  window.setTimeout = ((callback: () => void) => {
    pending.push(callback);
    return pending.length;
  }) as typeof window.setTimeout;
  if (hasIdleCallback) {
    window.requestIdleCallback = (callback: () => void) => {
      pending.push(callback);
      return pending.length;
    };
  }
  window.eval(bootstrap);
  const commands = () =>
    Array.from(window.dataLayer as ArrayLike<ArrayLike<unknown>>, (entry) =>
      Array.from(entry),
    );
  const flush = () => {
    while (pending.length) pending.shift()!();
  };
  return { window, commands, flush };
}

describe("GA4 deferred bootstrap", () => {
  it.each([true, false])(
    "configures the destination before a page view queued ahead of the script (idle=%s)",
    (idle) => {
      const { window, commands } = start(idle);
      window.gtag("event", "page_view", {
        page_location: window.location.href,
        page_title: window.document.title,
      });
      const queue = commands();
      const configIndex = queue.findIndex(([command]) => command === "config");
      const viewIndex = queue.findIndex(([command]) => command === "event");
      expect(configIndex).toBeGreaterThan(-1);
      expect(configIndex).toBeLessThan(viewIndex);
      expect(queue[configIndex]).toEqual([
        "config",
        "G-TESTONLY",
        expect.objectContaining({ send_page_view: false }),
      ]);
      expect(window.document.querySelectorAll("script")).toHaveLength(0);
    },
  );

  it("does not reconfigure or add a second script when interaction and idle overlap", () => {
    const { window, commands, flush } = start();
    window.dispatchEvent(new window.Event("click"));
    window.dispatchEvent(new window.Event("scroll"));
    flush();
    const scripts = window.document.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-TESTONLY",
    );
    scripts[0].dispatchEvent(new window.Event("load"));
    expect(commands().filter(([command]) => command === "config")).toHaveLength(
      1,
    );
    expect(commands().filter(([command]) => command === "event")).toHaveLength(
      0,
    );
  });

  it("keeps denied consent ahead of configuration and defers the existing consent update until load", () => {
    const { window, commands, flush } = start();
    expect(commands()[0]).toEqual([
      "consent",
      "default",
      expect.objectContaining({
        analytics_storage: "denied",
        ad_storage: "denied",
      }),
    ]);
    expect(
      commands().filter(
        ([command, action]) => command === "consent" && action === "update",
      ),
    ).toHaveLength(0);
    flush();
    window.document
      .querySelector("script")!
      .dispatchEvent(new window.Event("load"));
    expect(
      commands().filter(
        ([command, action]) => command === "consent" && action === "update",
      ),
    ).toEqual([["consent", "update", { analytics_storage: "granted" }]]);
  });
});

describe("SPA page view attribution", () => {
  it("preserves each committed page and its referrer when idle callbacks run after another navigation", () => {
    const { window, commands, flush } = start();
    const prevUrlRef = { current: "" };
    const visit = (url: string, title: string) => {
      window.history.pushState({}, "", url);
      window.document.title = title;
      runInNewContext(pageViewEffect, {
        window,
        document: window.document,
        URL: window.URL,
        location: {
          pathname: window.location.pathname,
          search: window.location.search,
        },
        navigation: { state: "idle" },
        prevUrlRef,
      });
    };
    visit("/pieces?marque=renault", "Catalogue Renault");
    visit("/blog", "Conseils auto");
    flush();
    expect(
      commands()
        .filter(
          ([command, name]) => command === "event" && name === "page_view",
        )
        .map(([, , params]) => params),
    ).toEqual([
      {
        page_path: "/pieces?marque=renault",
        page_title: "Catalogue Renault",
        page_location: "https://automecanik.example/pieces?marque=renault",
        page_referrer: "https://search.example/",
      },
      {
        page_path: "/blog",
        page_title: "Conseils auto",
        page_location: "https://automecanik.example/blog",
        page_referrer: "https://automecanik.example/pieces?marque=renault",
      },
    ]);
    visit("/blog", "Conseils auto");
    flush();
    expect(
      commands().filter(
        ([command, name]) => command === "event" && name === "page_view",
      ),
    ).toHaveLength(2);
    visit("/pieces?marque=renault", "Catalogue Renault");
    flush();
    expect(
      commands()
        .filter(
          ([command, name]) => command === "event" && name === "page_view",
        )
        .slice(-1)[0]?.[2],
    ).toEqual({
      page_path: "/pieces?marque=renault",
      page_title: "Catalogue Renault",
      page_location: "https://automecanik.example/pieces?marque=renault",
      page_referrer: "https://automecanik.example/blog",
    });
  });
});
