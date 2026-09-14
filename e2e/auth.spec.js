const { test, expect } = require("@playwright/test");

const {
  pressByTestId,
  requireCustomerCredentials,
  typeIntoInput,
  waitForAuthRestore,
} = require("./helpers/customer-real-backend");

test("customer sees login validation when submitting empty form", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto("/profile");
  await waitForAuthRestore(page);
  await pressByTestId(page, "login-submit-button");

  await expect(page.getByTestId("auth-error-message")).toBeVisible();
  await expect(page.getByTestId("auth-error-message")).not.toHaveText("");
});

test("customer can log in with backend account", async ({ page }) => {
  const { email, password } = requireCustomerCredentials(test);

  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.goto("/profile");
  await waitForAuthRestore(page);

  await typeIntoInput(page.getByTestId("login-email-input"), email);
  await typeIntoInput(page.getByTestId("login-password-input"), password);

  const loginResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/auth/login")
  );

  await pressByTestId(page, "login-submit-button");
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.ok()).toBe(true);

  await expect(page.getByTestId("profile-email")).toHaveText(email);
  await expect(page.getByTestId("logout-button")).toBeVisible();
});
