const { test, expect } = require("@playwright/test");

const {
  createCustomerSession,
  pressByTestId,
  seedCustomerSession,
  typeIntoInput,
  waitForAuthRestore,
} = require("../helpers/customer-real-backend");

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

test("customer can submit review for completed trip with backend", async ({
  page,
  request,
}) => {
  const session = await createCustomerSession(test, request);
  await seedCustomerSession(page, session);

  const tripsResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/passengers/trips")
  );
  await page.goto("/trips?tab=history");
  await waitForAuthRestore(page);
  const tripsResponse = await tripsResponsePromise;
  expect(tripsResponse.ok()).toBe(true);

  const reviewTrip = page
    .locator('[data-testid^="trips-history-item-"]')
    .filter({ hasText: "E2E Review" })
    .first();
  await expect(reviewTrip).toBeVisible({ timeout: 30_000 });

  const reviewButton = reviewTrip.locator(
    '[data-testid^="trips-history-primary-"]'
  );
  await expect(reviewButton).toBeVisible({ timeout: 20_000 });
  await reviewButton.click({ force: true });

  const ratingDialog = page.getByRole("dialog");
  await expect(ratingDialog).toBeVisible({
    timeout: 20_000,
  });
  await pressByTestId(page, "trips-rating-star-5");
  await typeIntoInput(
    page.getByTestId("trips-rating-comment-input"),
    `E2E review ${Date.now()}`
  );

  const reviewResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/reviews") &&
      response.request().method() === "POST",
    { timeout: 20_000 }
  );
  await pressByTestId(page, "trips-rating-submit-button");
  const reviewResponse = await reviewResponsePromise;

  expect(reviewResponse.ok()).toBe(true);
  await expect(ratingDialog).toBeHidden({
    timeout: 20_000,
  });
});
