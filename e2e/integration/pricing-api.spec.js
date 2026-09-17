const { test, expect } = require("@playwright/test");

const { API_BASE_URL } = require("../helpers/customer-real-backend");

test("integration: customer can estimate bike fare with backend", async ({
  request,
}) => {
  const estimateResponse = await test.step(
    "Call POST /api/pricing/estimate for bike ride",
    async () =>
      request.post(`${API_BASE_URL}/pricing/estimate`, {
        data: {
          vehicleType: 1,
          rideType: "SingleRide",
          estimatedDistanceKm: 21.5,
          estimatedDurationMinute: 42,
        },
      })
  );

  await test.step("Verify fare estimate API returns 200 OK", async () => {
    expect(estimateResponse.ok()).toBe(true);
  });

  await test.step("Verify response contains positive estimated fare and breakdown", async () => {
    const estimate = await estimateResponse.json();
    expect(estimate.estimatedFare).toBeGreaterThan(0);
    expect(estimate.breakdown).toBeTruthy();
  });
});

test("integration: customer can estimate car fare with backend", async ({
  request,
}) => {
  const estimateResponse = await test.step(
    "Call POST /api/pricing/estimate for car ride",
    async () =>
      request.post(`${API_BASE_URL}/pricing/estimate`, {
        data: {
          vehicleType: 2,
          rideType: "SingleRide",
          estimatedDistanceKm: 21.5,
          estimatedDurationMinute: 42,
        },
      })
  );

  await test.step("Verify fare estimate API returns 200 OK", async () => {
    expect(estimateResponse.ok()).toBe(true);
  });

  await test.step("Verify response contains positive estimated fare and fare version", async () => {
    const estimate = await estimateResponse.json();
    expect(estimate.estimatedFare).toBeGreaterThan(0);
    expect(estimate.fareSettingVersion).toBeGreaterThan(0);
  });
});
