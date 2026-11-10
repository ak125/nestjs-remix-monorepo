// @vitest-environment node
import { describe, expect, it } from "vitest";
import routes from "~/routes";

describe("guest payment resume routing", () => {
  it("renders /checkout/resume independently of the checkout form", async () => {
    // The checkout form has no Outlet: nesting here hides the resume screen.
    const config = await routes;
    expect(config.find((route) => route.path === "checkout/resume")).toMatchObject({
      file: "routes/checkout_.resume.tsx",
    });
  });
});
