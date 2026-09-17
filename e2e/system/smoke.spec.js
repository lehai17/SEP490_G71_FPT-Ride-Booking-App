const { test, expect } = require("@playwright/test");

test("customer app opens on web", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");

  const body = page.locator("body");
  await expect(body).toBeVisible();
  await expect(body).toContainText(/FPT|KH|Xe|trip|ride/i);
  expect(pageErrors).toEqual([]);
});
