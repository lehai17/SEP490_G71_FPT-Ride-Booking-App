const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  cancelTripByApi,
  createCustomerSession,
  getTomorrowMorningIso,
  seedCustomerSession,
} = require("./helpers/customer-real-backend");

test("customer can create and cancel normal ride with backend", async ({
  page,
  request,
}) => {
  const session = await createCustomerSession(test, request);
  await seedCustomerSession(page, session);

  let createdTripId = null;

  try {
    const createTripResponse = await request.post(`${API_BASE_URL}/trips`, {
      data: {
        pickupLatitude: 21.013189,
        pickupLongitude: 105.525578,
        pickupAddress: "E2E Dai hoc FPT Hoa Lac",
        destinationLatitude: 21.028716,
        destinationLongitude: 105.778467,
        destinationAddress: "E2E Ben xe My Dinh",
        estimatedDistanceKm: 21.5,
        estimatedDurationMinute: 42,
        vehicleType: 1,
        tripType: 1,
      },
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(createTripResponse.ok()).toBe(true);

    const createTripPayload = await createTripResponse.json();
    createdTripId = createTripPayload?.trip?.id ?? createTripPayload?.id ?? null;
    expect(createdTripId).toBeTruthy();

    const cancelTripResponse = await request.put(
      `${API_BASE_URL}/trips/${createdTripId}/cancel/passenger`,
      {
        data: { cancelReason: 4 },
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );
    expect(cancelTripResponse.ok()).toBe(true);

    const tripsResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/passengers/trips")
    );
    await page.goto("/trips?tab=history");
    const tripsResponse = await tripsResponsePromise;
    expect(tripsResponse.ok()).toBe(true);

    await expect(page.getByTestId("trips-tab-history")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("body")).toContainText("E2E Dai hoc FPT Hoa Lac");
  } finally {
    await cancelTripByApi(request, createdTripId, session.accessToken).catch(
      () => {}
    );
  }
});

test("customer can create and view scheduled ride with backend", async ({
  page,
  request,
}) => {
  const session = await createCustomerSession(test, request);
  await seedCustomerSession(page, session);

  let createdTripId = null;

  try {
    const createTripResponse = await request.post(`${API_BASE_URL}/trips`, {
      data: {
        pickupLatitude: 21.013189,
        pickupLongitude: 105.525578,
        pickupAddress: "E2E Scheduled Dai hoc FPT Hoa Lac",
        destinationLatitude: 21.028716,
        destinationLongitude: 105.778467,
        destinationAddress: "E2E Scheduled Ben xe My Dinh",
        estimatedDistanceKm: 21.5,
        estimatedDurationMinute: 42,
        vehicleType: 2,
        tripType: 2,
        scheduledAt: getTomorrowMorningIso(),
      },
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    expect(createTripResponse.ok()).toBe(true);

    const createTripPayload = await createTripResponse.json();
    createdTripId = createTripPayload?.trip?.id ?? createTripPayload?.id ?? null;
    expect(createdTripId).toBeTruthy();

    const tripsResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/passengers/trips")
    );
    await page.goto("/trips?tab=scheduled");
    const tripsResponse = await tripsResponsePromise;
    expect(tripsResponse.ok()).toBe(true);

    await expect(page.getByTestId("trips-tab-scheduled")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("body")).toContainText(
      "E2E Scheduled Ben xe My Dinh"
    );
  } finally {
    await cancelTripByApi(request, createdTripId, session.accessToken).catch(
      () => {}
    );
  }
});
