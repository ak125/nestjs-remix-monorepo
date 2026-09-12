import { test as base, expect } from "@playwright/test";
import { waitForRateBudget } from "../../../scripts/ci/preprod-e2e-rate-budget.mjs";

// CI has one worker and one source IP. Independent scenarios must not inherit
// an exhausted SSR bucket from earlier scenarios or deployment probes. Fixture
// setup has its own timeout and finishes before performance timers begin.
export const test = base.extend<{ rateBudget: void }>({
  rateBudget: [
    async ({ request }, use) => {
      if (process.env.E2E_RATE_BUDGET === "true") {
        await waitForRateBudget({
          probe: async () => {
            const response = await request.head("/", {
              maxRedirects: 0,
              timeout: 10_000,
            });
            return { status: response.status(), headers: response.headers() };
          },
        });
      }
      await use();
    },
    { auto: true, timeout: 90_000 },
  ],
});

export { expect };
