const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  createCustomerSession,
} = require("../helpers/customer-real-backend");

test("integration: customer can log in and load profile with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );

  await test.step("Verify login response contains access token and email", async () => {
    expect(session.accessToken).toBeTruthy();
    expect(session.email).toBeTruthy();
  });

  const profileResponse = await test.step("Call GET /api/auth/profile/{userId}", async () =>
    request.get(`${API_BASE_URL}/auth/profile/${session.userId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
  );

  await test.step("Verify profile API returns 200 OK", async () => {
    expect(profileResponse.ok()).toBe(true);
  });

  await test.step("Verify profile email matches logged-in customer", async () => {
    const profile = await profileResponse.json();
    expect(profile.email).toBe(session.email);
  });
});

test("integration: profile API rejects request without access token", async ({
  request,
}) => {
  const profileResponse = await test.step(
    "Call GET /api/auth/profile/{userId} without token",
    async () =>
      request.get(
        `${API_BASE_URL}/auth/profile/00000000-0000-0000-0000-000000000000`
      )
  );

  await test.step("Verify API returns 401 Unauthorized", async () => {
    expect(profileResponse.status()).toBe(401);
  });
});
