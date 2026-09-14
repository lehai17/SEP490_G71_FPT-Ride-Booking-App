const { expect } = require("@playwright/test");

const API_BASE_URL = process.env.E2E_API_URL ?? "http://localhost:5228/api";
const SESSION_STORAGE_KEY = "fpt-ride.auth.session";

function requireCustomerCredentials(test) {
  const email = process.env.E2E_CUSTOMER_EMAIL;
  const password = process.env.E2E_CUSTOMER_PASSWORD;

  if (!email || !password) {
    test.skip(
      true,
      "Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run customer BE tests."
    );
  }

  return { email, password };
}

async function createCustomerSession(test, request) {
  const { email, password } = requireCustomerCredentials(test);

  const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password },
  });

  expect(loginResponse.ok()).toBe(true);

  const loginPayload = await loginResponse.json();
  return {
    accessToken: loginPayload.accessToken,
    refreshToken: loginPayload.refreshToken ?? null,
    expiresAt: loginPayload.expiresAt,
    userId: loginPayload.userId,
    fullName: loginPayload.fullName,
    email: loginPayload.email,
    phoneNumber: loginPayload.phoneNumber ?? null,
    avatarUrl: loginPayload.avatarUrl ?? null,
    role: loginPayload.role,
    createdAt: loginPayload.createdAt ?? null,
  };
}

async function seedCustomerSession(page, session) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: SESSION_STORAGE_KEY, value: session }
  );
}

async function waitForAuthRestore(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("Dang kiem tra"),
    null,
    { timeout: 15_000 }
  );
}

async function pressByTestId(page, testId) {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible({ timeout: 20_000 });

  try {
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ force: true });
  } catch {
    await locator.dispatchEvent("click");
  }
}

async function pageWait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeIntoInput(locator, value) {
  await expect(locator).toBeVisible({ timeout: 20_000 });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await locator.scrollIntoViewIfNeeded();
      await locator.click({ force: true });
      await locator.fill("");
      await locator.focus();
      await locator.pressSequentially(value, { delay: 20 });
      await expect(locator).toHaveValue(value, { timeout: 3_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await pageWait(300);
    }
  }
}

async function cancelTripByApi(request, tripId, accessToken) {
  if (!tripId) {
    return;
  }

  await request.put(`${API_BASE_URL}/trips/${tripId}/cancel/passenger`, {
    data: { cancelReason: 4 },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function cancelRideSharingByApi(request, requestId, accessToken) {
  if (!requestId) {
    return;
  }

  await request.post(`${API_BASE_URL}/ride-sharing/requests/${requestId}/cancel`, {
    data: { cancelReason: 4 },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function leaveRideSharingGroupByApi(request, groupId, accessToken) {
  if (!groupId) {
    return null;
  }

  return request.post(`${API_BASE_URL}/ride-sharing/groups/${groupId}/leave`, {
    data: { cancelReason: 4 },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

function getTomorrowMorningIso() {
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 1);
  scheduledAt.setHours(8, 0, 0, 0);
  return scheduledAt.toISOString();
}

module.exports = {
  API_BASE_URL,
  cancelRideSharingByApi,
  cancelTripByApi,
  createCustomerSession,
  getTomorrowMorningIso,
  leaveRideSharingGroupByApi,
  pressByTestId,
  requireCustomerCredentials,
  seedCustomerSession,
  typeIntoInput,
  waitForAuthRestore,
};
