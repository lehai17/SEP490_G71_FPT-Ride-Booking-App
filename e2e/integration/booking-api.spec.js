const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  cancelTripByApi,
  createCustomerSession,
  getTomorrowMorningIso,
} = require("../helpers/customer-real-backend");

function authHeaders(session) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

function getCreatedTripId(payload) {
  return payload?.trip?.id ?? payload?.id ?? null;
}

test("integration: customer can create and cancel normal ride with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  let createdTripId = null;

  try {
    const createTripResponse = await test.step(
      "Call POST /api/trips to create normal ride",
      async () =>
        request.post(`${API_BASE_URL}/trips`, {
          data: {
            pickupLatitude: 21.013189,
            pickupLongitude: 105.525578,
            pickupAddress: "E2E Integration Dai hoc FPT Hoa Lac",
            destinationLatitude: 21.028716,
            destinationLongitude: 105.778467,
            destinationAddress: "E2E Integration Ben xe My Dinh",
            estimatedDistanceKm: 21.5,
            estimatedDurationMinute: 42,
            vehicleType: 1,
            tripType: 1,
          },
          headers: authHeaders(session),
        })
    );
    await test.step("Verify normal ride is created successfully", async () => {
      expect(createTripResponse.ok()).toBe(true);
    });

    await test.step("Read created trip id from response", async () => {
      const createTripPayload = await createTripResponse.json();
      createdTripId = getCreatedTripId(createTripPayload);
      expect(createdTripId).toBeTruthy();
    });

    const cancelTripResponse = await test.step(
      "Call PUT /api/trips/{tripId}/cancel/passenger",
      async () =>
        request.put(`${API_BASE_URL}/trips/${createdTripId}/cancel/passenger`, {
          data: { cancelReason: 4 },
          headers: authHeaders(session),
        })
    );
    await test.step("Verify trip cancellation returns success", async () => {
      expect(cancelTripResponse.ok()).toBe(true);
    });

    const historyResponse = await test.step(
      "Call GET /api/passengers/trips to verify history",
      async () =>
        request.get(`${API_BASE_URL}/passengers/trips`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify trip history returns 200 OK", async () => {
      expect(historyResponse.ok()).toBe(true);
    });

    await test.step("Verify created trip appears in passenger history", async () => {
      const trips = await historyResponse.json();
      expect(Array.isArray(trips)).toBe(true);
      expect(
        trips.some(
          (trip) =>
            trip.id === createdTripId &&
            trip.pickupAddress === "E2E Integration Dai hoc FPT Hoa Lac"
        )
      ).toBe(true);
    });
  } finally {
    await cancelTripByApi(request, createdTripId, session.accessToken).catch(
      () => {}
    );
  }
});

test("integration: customer can create scheduled ride with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  let createdTripId = null;

  try {
    const createTripResponse = await test.step(
      "Call POST /api/trips to create scheduled ride",
      async () =>
        request.post(`${API_BASE_URL}/trips`, {
          data: {
            pickupLatitude: 21.013189,
            pickupLongitude: 105.525578,
            pickupAddress: "E2E Integration Scheduled FPT Hoa Lac",
            destinationLatitude: 21.028716,
            destinationLongitude: 105.778467,
            destinationAddress: "E2E Integration Scheduled My Dinh",
            estimatedDistanceKm: 21.5,
            estimatedDurationMinute: 42,
            vehicleType: 2,
            tripType: 2,
            scheduledAt: getTomorrowMorningIso(),
          },
          headers: authHeaders(session),
        })
    );
    await test.step("Verify scheduled ride is created successfully", async () => {
      expect(createTripResponse.ok()).toBe(true);
    });

    await test.step("Read created scheduled trip id from response", async () => {
      const createTripPayload = await createTripResponse.json();
      createdTripId = getCreatedTripId(createTripPayload);
      expect(createdTripId).toBeTruthy();
    });

    const historyResponse = await test.step(
      "Call GET /api/passengers/trips to verify scheduled trip",
      async () =>
        request.get(`${API_BASE_URL}/passengers/trips`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify trip history returns 200 OK", async () => {
      expect(historyResponse.ok()).toBe(true);
    });

    await test.step("Verify scheduled trip appears in passenger history", async () => {
      const trips = await historyResponse.json();
      expect(
        trips.some(
          (trip) =>
            trip.id === createdTripId &&
            trip.destinationAddress === "E2E Integration Scheduled My Dinh"
        )
      ).toBe(true);
    });
  } finally {
    await cancelTripByApi(request, createdTripId, session.accessToken).catch(
      () => {}
    );
  }
});

test("integration: customer can create and view trip detail with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  let createdTripId = null;

  try {
    const createTripResponse = await test.step(
      "Call POST /api/trips to create trip for detail check",
      async () =>
        request.post(`${API_BASE_URL}/trips`, {
          data: {
            pickupLatitude: 21.013189,
            pickupLongitude: 105.525578,
            pickupAddress: "E2E Integration Detail FPT Hoa Lac",
            destinationLatitude: 21.028716,
            destinationLongitude: 105.778467,
            destinationAddress: "E2E Integration Detail My Dinh",
            estimatedDistanceKm: 21.5,
            estimatedDurationMinute: 42,
            vehicleType: 1,
            tripType: 1,
          },
          headers: authHeaders(session),
        })
    );
    await test.step("Verify trip is created successfully", async () => {
      expect(createTripResponse.ok()).toBe(true);
    });

    await test.step("Read created trip id from response", async () => {
      const createTripPayload = await createTripResponse.json();
      createdTripId = getCreatedTripId(createTripPayload);
      expect(createdTripId).toBeTruthy();
    });

    const detailResponse = await test.step(
      "Call GET /api/trips/{tripId}",
      async () =>
        request.get(`${API_BASE_URL}/trips/${createdTripId}`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify trip detail API returns 200 OK", async () => {
      expect(detailResponse.ok()).toBe(true);
    });

    await test.step("Verify trip detail matches created trip", async () => {
      const trip = await detailResponse.json();
      expect(trip.id).toBe(createdTripId);
      expect(trip.pickupAddress).toBe("E2E Integration Detail FPT Hoa Lac");
      expect(trip.destinationAddress).toBe("E2E Integration Detail My Dinh");
    });
  } finally {
    await cancelTripByApi(request, createdTripId, session.accessToken).catch(
      () => {}
    );
  }
});

test("integration: cancel trip API rejects invalid cancel reason", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  let createdTripId = null;

  try {
    const createTripResponse = await test.step(
      "Call POST /api/trips to prepare cancellable trip",
      async () =>
        request.post(`${API_BASE_URL}/trips`, {
          data: {
            pickupLatitude: 21.013189,
            pickupLongitude: 105.525578,
            pickupAddress: "E2E Integration Invalid Cancel FPT Hoa Lac",
            destinationLatitude: 21.028716,
            destinationLongitude: 105.778467,
            destinationAddress: "E2E Integration Invalid Cancel My Dinh",
            estimatedDistanceKm: 21.5,
            estimatedDurationMinute: 42,
            vehicleType: 1,
            tripType: 1,
          },
          headers: authHeaders(session),
        })
    );
    await test.step("Verify trip is created successfully", async () => {
      expect(createTripResponse.ok()).toBe(true);
    });

    await test.step("Read created trip id from response", async () => {
      const createTripPayload = await createTripResponse.json();
      createdTripId = getCreatedTripId(createTripPayload);
      expect(createdTripId).toBeTruthy();
    });

    const cancelTripResponse = await test.step(
      "Call PUT /api/trips/{tripId}/cancel/passenger with invalid reason",
      async () =>
        request.put(`${API_BASE_URL}/trips/${createdTripId}/cancel/passenger`, {
          data: { cancelReason: 999 },
          headers: authHeaders(session),
        })
    );

    await test.step("Verify API returns 400 Bad Request", async () => {
      expect(cancelTripResponse.status()).toBe(400);
    });
  } finally {
    await cancelTripByApi(request, createdTripId, session.accessToken).catch(
      () => {}
    );
  }
});

test("integration: create trip API rejects missing pickup address", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );

  const createTripResponse = await test.step(
    "Call POST /api/trips with empty pickup address",
    async () =>
      request.post(`${API_BASE_URL}/trips`, {
        data: {
          pickupLatitude: 21.013189,
          pickupLongitude: 105.525578,
          pickupAddress: "",
          destinationLatitude: 21.028716,
          destinationLongitude: 105.778467,
          destinationAddress: "E2E Integration Ben xe My Dinh",
          estimatedDistanceKm: 21.5,
          estimatedDurationMinute: 42,
          vehicleType: 1,
          tripType: 1,
        },
        headers: authHeaders(session),
      })
  );

  await test.step("Verify API returns 400 Bad Request", async () => {
    expect(createTripResponse.status()).toBe(400);
  });
});

test("integration: create trip API rejects request without access token", async ({
  request,
}) => {
  const createTripResponse = await test.step(
    "Call POST /api/trips without access token",
    async () =>
      request.post(`${API_BASE_URL}/trips`, {
        data: {
          pickupLatitude: 21.013189,
          pickupLongitude: 105.525578,
          pickupAddress: "E2E Integration Dai hoc FPT Hoa Lac",
          destinationLatitude: 21.028716,
          destinationLongitude: 105.778467,
          destinationAddress: "E2E Integration Ben xe My Dinh",
          estimatedDistanceKm: 21.5,
          estimatedDurationMinute: 42,
          vehicleType: 1,
          tripType: 1,
        },
      })
  );

  await test.step("Verify API returns 401 Unauthorized", async () => {
    expect(createTripResponse.status()).toBe(401);
  });
});
