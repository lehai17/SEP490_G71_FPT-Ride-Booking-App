const { test, expect } = require("@playwright/test");

const {
  createCustomerSession,
  seedCustomerSession,
  waitForAuthRestore,
} = require("./helpers/customer-real-backend");

test("customer can open profile and trip history from backend", async ({
  page,
  request,
}) => {
  const session = await createCustomerSession(test, request);
  await seedCustomerSession(page, session);

  const profileResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/auth/profile/")
  );
  await page.goto("/profile");
  await waitForAuthRestore(page);
  const profileResponse = await profileResponsePromise;
  expect(profileResponse.ok()).toBe(true);
  await expect(page.getByTestId("profile-email")).toHaveText(session.email);

  const tripsResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/passengers/trips")
  );
  await page.goto("/trips?tab=history");
  const tripsResponse = await tripsResponsePromise;
  expect(tripsResponse.ok()).toBe(true);
  await expect(page.getByTestId("trips-tab-history")).toBeVisible({
    timeout: 20_000,
  });
});
