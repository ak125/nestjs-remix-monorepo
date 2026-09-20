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

function start(
  hasIdleCallback = true,
  choice: "granted" | "denied" | null = null,
) {
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
  if (choice)
    window.localStorage.setItem(
      "automecanik.analytics-consent.v1",
      JSON.stringify({ choice, updatedAt: Date.now() }),
    );
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
      const { window, commands } = start(idle, "granted");
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
    const { window, commands, flush } = start(true, "granted");
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

  it.each([true, false])(
    "does not load or queue events before acceptance (idle=%s)",
    (idle) => {
      const { window, commands, flush } = start(idle);
      window.gtag("event", "web_vitals", { metric_name: "LCP" });
      window.dispatchEvent(new window.Event("click"));
      window.dispatchEvent(new window.Event("scroll"));
      flush();
      expect(window.document.querySelectorAll("script")).toHaveLength(0);
      expect(
        commands().filter(([cmd]) => cmd === "event" || cmd === "config"),
      ).toHaveLength(0);
      expect(
        (commands()[0][2] as Record<string, unknown>).analytics_storage,
      ).toBe("denied");
    },
  );

  it("accepts explicitly, persists, and does not grant again on script load", () => {
    const { window, commands, flush } = start();
    expect(window.__analyticsConsent.setChoice("granted")).toBe(true);
    flush();
    expect(window.document.querySelectorAll("script")).toHaveLength(1);
    const beforeLoad = commands().length;
    window.document
      .querySelector("script")
      .dispatchEvent(new window.Event("load"));
    expect(commands()).toHaveLength(beforeLoad);
    expect(
      commands().filter(
        ([cmd, action, params]) =>
          cmd === "consent" &&
          action === "update" &&
          (params as Record<string, unknown>).analytics_storage === "granted",
      ),
    ).toHaveLength(1);
    expect(
      JSON.parse(
        window.localStorage.getItem("automecanik.analytics-consent.v1"),
      ).choice,
    ).toBe("granted");
  });

  it("keeps a stored refusal across reload and ignores events", () => {
    const { window, commands, flush } = start(true, "denied");
    window.gtag("event", "page_view", {});
    flush();
    expect(window.__analyticsConsent.getChoice()).toBe("denied");
    expect(window.document.querySelectorAll("script")).toHaveLength(0);
    expect(commands().filter(([cmd]) => cmd === "event")).toHaveLength(0);
  });

  it("withdraws before a pending load, discards queued events and removes only GA cookies", () => {
    const { window, commands, flush } = start(true, "granted");
    window.document.cookie = "_ga=old; path=/";
    window.document.cookie =
      "_ga_TESTONLY=old; path=/; domain=automecanik.example";
    window.document.cookie = "cart=preserved; path=/";
    window.gtag("event", "web_vitals", {});
    window.__analyticsConsent.setChoice("denied");
    flush();
    window.gtag("event", "page_view", {});
    expect(window["ga-disable-G-TESTONLY"]).toBe(true);
    expect(window.document.querySelectorAll("script")).toHaveLength(0);
    expect(commands().filter(([cmd]) => cmd === "event")).toHaveLength(0);
    expect(window.document.cookie).not.toContain("_ga");
    expect(window.document.cookie).toContain("cart=preserved");
  });

  it("blocks events after an already loaded tag is withdrawn and permits reacceptance", () => {
    const { window, commands, flush } = start(true, "granted");
    flush();
    window.__analyticsConsent.setChoice("denied");
    window.gtag("event", "web_vitals", {});
    expect(window["ga-disable-G-TESTONLY"]).toBe(true);
    expect(commands().filter(([cmd]) => cmd === "event")).toHaveLength(0);
    window.__analyticsConsent.setChoice("granted");
    window.gtag("event", "web_vitals", {});
    flush();
    expect(window["ga-disable-G-TESTONLY"]).toBe(false);
    expect(commands().filter(([cmd]) => cmd === "event")).toHaveLength(1);
    expect(window.document.querySelectorAll("script")).toHaveLength(1);
  });

  it("reflects withdrawal in another tab", () => {
    const { window } = start(true, "granted");
    window.localStorage.setItem(
      "automecanik.analytics-consent.v1",
      JSON.stringify({ choice: "denied", updatedAt: Date.now() }),
    );
    window.dispatchEvent(
      new window.StorageEvent("storage", {
        key: "automecanik.analytics-consent.v1",
        storageArea: window.localStorage,
      }),
    );
    expect(window.__analyticsConsent.getChoice()).toBe("denied");
    expect(window["ga-disable-G-TESTONLY"]).toBe(true);
  });

  it.each([
    "invalid",
    JSON.stringify({ choice: "granted", updatedAt: 1 }),
    JSON.stringify({ choice: "granted", updatedAt: Date.now() + 86400000 }),
  ])("rejects corrupt, expired or future stored choice: %s", (value) => {
    const { window, commands, flush } = start();
    window.localStorage.setItem("automecanik.analytics-consent.v1", value);
    window.dispatchEvent(
      new window.StorageEvent("storage", {
        key: "automecanik.analytics-consent.v1",
        storageArea: window.localStorage,
      }),
    );
    flush();
    expect(window.__analyticsConsent.getChoice()).toBe(null);
    expect(commands().filter(([cmd]) => cmd === "config")).toHaveLength(0);
  });

  it("reports persistence failure without granting on a later reload", () => {
    const { window } = start();
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
    expect(window.__analyticsConsent.setChoice("granted")).toBe(false);
    expect(window.__analyticsConsent.getChoice()).toBe("granted");
    expect(start().window.__analyticsConsent.getChoice()).toBe(null);
  });
});

describe("SPA page view attribution", () => {
  it("preserves each committed page and its referrer when idle callbacks run after another navigation", () => {
    const { window, commands, flush } = start(true, "granted");
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

describe("consent and SPA navigation", () => {
  it("sends only the current page at acceptance, skips refused pages and deduplicates reacceptance", () => {
    const { window, commands, flush } = start();
    const prevUrlRef = { current: "" };
    let cleanup: (() => void) | undefined;
    const visit = (pathname: string, state = "idle") => {
      cleanup?.();
      window.history.pushState({}, "", pathname);
      window.document.title = pathname;
      cleanup = runInNewContext(pageViewEffect, {
        window,
        document: window.document,
        URL: window.URL,
        location: { pathname, search: "" },
        navigation: { state },
        prevUrlRef,
      });
    };
    const views = () =>
      commands().filter(
        ([cmd, event]) => cmd === "event" && event === "page_view",
      );
    visit("/before");
    visit("/current");
    window.__analyticsConsent.setChoice("granted");
    flush();
    expect(
      views().map(
        ([, , params]) => (params as Record<string, unknown>).page_path,
      ),
    ).toEqual(["/current"]);
    window.__analyticsConsent.setChoice("granted");
    expect(views()).toHaveLength(1);
    visit("/next");
    expect(
      (views().slice(-1)[0][2] as Record<string, unknown>).page_referrer,
    ).toBe("https://automecanik.example/current");
    window.__analyticsConsent.setChoice("denied");
    visit("/refused");
    expect(views()).toHaveLength(0); // unprocessed queue discarded on withdrawal
    window.__analyticsConsent.setChoice("granted");
    expect(
      views().map(
        ([, , params]) => (params as Record<string, unknown>).page_path,
      ),
    ).toEqual(["/refused"]);
    visit("/admin");
    expect(views()).toHaveLength(1);
    cleanup?.();
  });
});

it("invalidates old acceptance if persisting withdrawal fails", () => {
  const { window } = start(true, "granted");
  // Storage methods live on the prototype in jsdom.
  Object.defineProperty(Object.getPrototypeOf(window.localStorage), "setItem", {
    value: () => {
      throw new Error("quota");
    },
    configurable: true,
  });
  expect(window.__analyticsConsent.setChoice("denied")).toBe(false);
  expect(window.localStorage.getItem("automecanik.analytics-consent.v1")).toBe(
    null,
  );
});
