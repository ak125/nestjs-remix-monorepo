import { test, expect } from "./fixtures";

// Runs in the post-deployment smoke suite without an admin account or key.
// An exact redirect proves the built route exists and still enforces login;
// accepting any non-200 status would also accept the missing-route regression.
test.use({ storageState: { cookies: [], origins: [] } });

test("Command Center redirects anonymous requests to login", async ({
  request,
}) => {
  const response = await request.get("/admin/command-center", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe("/login");
});
