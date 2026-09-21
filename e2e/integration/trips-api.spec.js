const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  createCustomerSession,
} = require("../helpers/customer-real-backend");

function authHeaders(session) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

test("integration: customer can view trip history with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );

  const historyResponse = await test.step(
    "Call GET /api/passengers/trips with access token",
    async () =>
      request.get(`${API_BASE_URL}/passengers/trips`, {
        headers: authHeaders(session),
      })
  );

  await test.step("Verify trip history API returns 200 OK", async () => {
    expect(historyResponse.ok()).toBe(true);
  });

  await test.step("Verify response body is a trip list", async () => {
    const trips = await historyResponse.json();
    expect(Array.isArray(trips)).toBe(true);
  });
});

test("integration: trip history API rejects request without access token", async ({
  request,
}) => {
  const historyResponse = await test.step(
    "Call GET /api/passengers/trips without token",
    async () => request.get(`${API_BASE_URL}/passengers/trips`)
  );

  await test.step("Verify API returns 401 Unauthorized", async () => {
    expect(historyResponse.status()).toBe(401);
  });
});
