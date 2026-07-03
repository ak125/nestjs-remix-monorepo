import { describe, it, expect, vi } from "vitest";

import {
  captureReactErrorToSentry,
  createDeferredReactErrorBuffer,
  createReactErrorHandlers,
  isHydrationRecoverableError,
  type BufferedReactError,
  type SentryLike,
} from "~/utils/react-error-handlers.client";

/**
 * React 19 root error routing (plan §Phase 4).
 *
 * Invariants under test:
 *  - All three channels (recoverable/caught/uncaught) buffer to the SAME sink.
 *  - ONLY a hydration-classified recoverable error emits the internal SEO
 *    event — caught/uncaught NEVER do (the endpoint accepts 4 types only).
 *  - componentStack + cause are preserved; one error → one Sentry capture;
 *    cause is never serialized wholesale (bounded extras only).
 */

function makeSink() {
  const buffer: BufferedReactError[] = [];
  const reportHydration = vi.fn();
  const handlers = createReactErrorHandlers({
    buffer: (entry) => buffer.push(entry),
    reportHydration,
  });
  return { buffer, reportHydration, handlers };
}

describe("isHydrationRecoverableError", () => {
  it.each([
    "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.",
    "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.",
    "There was an error while hydrating this Suspense boundary.",
    "Text content does not match server-rendered HTML.",
  ])("matches the React 19 hydration message: %s", (msg) => {
    expect(isHydrationRecoverableError(new Error(msg))).toBe(true);
  });

  it("matches when the hydration signature is on error.cause", () => {
    const err = new Error("Minified React error") as Error & {
      cause?: unknown;
    };
    err.cause = new Error("server rendered HTML didn't match the client");
    expect(isHydrationRecoverableError(err)).toBe(true);
  });

  it("does NOT match a non-hydration recoverable error", () => {
    expect(
      isHydrationRecoverableError(new Error("Cannot read properties of null")),
    ).toBe(false);
  });
});

describe("createReactErrorHandlers", () => {
  it("recoverable + hydration → buffers (recoverable) AND emits hydration event", () => {
    const { buffer, reportHydration, handlers } = makeSink();
    handlers.onRecoverableError(
      new Error("server rendered HTML didn't match the client"),
      { componentStack: "\n at Foo\n at Bar" },
    );
    expect(buffer).toHaveLength(1);
    expect(buffer[0].channel).toBe("recoverable");
    expect(buffer[0].componentStack).toBe("\n at Foo\n at Bar");
    expect(reportHydration).toHaveBeenCalledTimes(1);
  });

  it("recoverable + NON-hydration → buffers only, NO hydration event", () => {
    const { buffer, reportHydration, handlers } = makeSink();
    handlers.onRecoverableError(new Error("some recoverable glitch"));
    expect(buffer).toHaveLength(1);
    expect(buffer[0].channel).toBe("recoverable");
    expect(reportHydration).not.toHaveBeenCalled();
  });

  it("caught → buffers (caught), NEVER emits a hydration event", () => {
    const { buffer, reportHydration, handlers } = makeSink();
    handlers.onCaughtError(
      new Error("server rendered HTML didn't match"), // even if it looks like hydration
      { componentStack: "stack" },
    );
    expect(buffer[0].channel).toBe("caught");
    expect(reportHydration).not.toHaveBeenCalled();
  });

  it("uncaught → buffers (uncaught), NEVER emits a hydration event", () => {
    const { buffer, reportHydration, handlers } = makeSink();
    handlers.onUncaughtError(new Error("boom"), { componentStack: "stack" });
    expect(buffer[0].channel).toBe("uncaught");
    expect(reportHydration).not.toHaveBeenCalled();
  });

  it("preserves error.cause on the buffered entry", () => {
    const { buffer, handlers } = makeSink();
    const cause = new Error("root cause");
    const err = new Error("wrapper") as Error & { cause?: unknown };
    err.cause = cause;
    handlers.onUncaughtError(err);
    expect(buffer[0].cause).toBe(cause);
  });
});

describe("captureReactErrorToSentry", () => {
  function makeSentry() {
    const tags: Record<string, string> = {};
    const extras: Record<string, unknown> = {};
    const scope = {
      setTag: (k: string, v: string) => {
        tags[k] = v;
      },
      setExtra: (k: string, v: unknown) => {
        extras[k] = v;
      },
    };
    const captureException = vi.fn();
    const Sentry: SentryLike = {
      withScope: (cb) => cb(scope),
      captureException,
    };
    return { Sentry, tags, extras, captureException };
  }

  it("tags the channel, forwards the error ONCE, and bounds the extras", () => {
    const { Sentry, tags, extras, captureException } = makeSentry();
    const cause = new Error("c".repeat(1000));
    const error = new Error("render failed");
    const item: BufferedReactError = {
      kind: "reactError",
      channel: "uncaught",
      error,
      componentStack: "x".repeat(5000),
      cause,
    };
    captureReactErrorToSentry(Sentry, item);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
    expect(tags["react.error_channel"]).toBe("uncaught");
    // componentStack truncated to 4000, cause.message truncated to 500.
    expect((extras["react.component_stack"] as string).length).toBe(4000);
    expect(extras["react.cause_name"]).toBe("Error");
    expect((extras["react.cause_message"] as string).length).toBe(500);
  });

  it("omits cause extras when there is no Error cause", () => {
    const { Sentry, extras } = makeSentry();
    captureReactErrorToSentry(Sentry, {
      kind: "reactError",
      channel: "caught",
      error: new Error("e"),
      componentStack: null,
    });
    expect(extras).not.toHaveProperty("react.cause_name");
    expect(extras).not.toHaveProperty("react.component_stack");
  });
});

describe("createDeferredReactErrorBuffer", () => {
  const entry: BufferedReactError = {
    kind: "reactError",
    channel: "uncaught",
    error: new Error("boom"),
  };

  it("drops the error when observability is disabled (no leak)", () => {
    const buffered: BufferedReactError[] = [];
    const captureException = vi.fn();
    const sink = createDeferredReactErrorBuffer({
      isDisabled: () => true,
      getLive: () => ({
        withScope: (cb) => cb({ setTag() {}, setExtra() {} }),
        captureException,
      }),
      bufferPush: (e) => buffered.push(e),
    });
    sink(entry);
    expect(buffered).toHaveLength(0);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captures directly when Sentry is live (post-init path)", () => {
    const buffered: BufferedReactError[] = [];
    const captureException = vi.fn();
    const live: SentryLike = {
      withScope: (cb) => cb({ setTag() {}, setExtra() {} }),
      captureException,
    };
    const sink = createDeferredReactErrorBuffer({
      isDisabled: () => false,
      getLive: () => live,
      bufferPush: (e) => buffered.push(e),
    });
    sink(entry);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(buffered).toHaveLength(0); // direct, not buffered
  });

  it("buffers when Sentry is not yet live (pre-init path)", () => {
    const buffered: BufferedReactError[] = [];
    const sink = createDeferredReactErrorBuffer({
      isDisabled: () => false,
      getLive: () => null,
      bufferPush: (e) => buffered.push(e),
    });
    sink(entry);
    expect(buffered).toEqual([entry]);
  });
});
