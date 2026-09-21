const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  cancelRideSharingByApi,
  createCustomerSession,
  getTomorrowMorningIso,
  leaveRideSharingGroupByApi,
} = require("../helpers/customer-real-backend");

function authHeaders(session) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

function getEntityId(payload) {
  return payload?.request?.id ?? payload?.group?.id ?? payload?.id ?? null;
}

function requireSecondCustomerCredentials(test) {
  const email = process.env.E2E_SECOND_CUSTOMER_EMAIL;
  const password = process.env.E2E_SECOND_CUSTOMER_PASSWORD;

  if (!email || !password) {
    test.skip(
      true,
      "Set E2E_SECOND_CUSTOMER_EMAIL and E2E_SECOND_CUSTOMER_PASSWORD to prepare ride sharing group data."
    );
  }

  return { email, password };
}

async function cleanupRideSharingState(request, session) {
  const myRequestResponse = await request.get(
    `${API_BASE_URL}/ride-sharing/requests/my`,
    { headers: authHeaders(session) }
  );

  if (myRequestResponse.ok()) {
    const myRequest = await myRequestResponse.json();
    await cancelRideSharingByApi(
      request,
      getEntityId(myRequest),
      session.accessToken
    ).catch(() => {});
  }

  const myGroupResponse = await request.get(
    `${API_BASE_URL}/ride-sharing/groups/my`,
    { headers: authHeaders(session) }
  );

  if (myGroupResponse.ok()) {
    const myGroup = await myGroupResponse.json();
    await leaveRideSharingGroupByApi(
      request,
      getEntityId(myGroup),
      session.accessToken
    ).catch(() => {});
  }
}

async function createRideSharingRequestForSession(
  request,
  session,
  overrides = {}
) {
  const payload = {
    pickupLatitude: 21.028716,
    pickupLongitude: 105.778467,
    pickupAddress: "E2E Integration My Dinh pickup",
    destinationLatitude: 21.013189,
    destinationLongitude: 105.525578,
    destinationAddress: "E2E Integration FPT Hoa Lac",
    direction: 1,
    estimatedDistanceKm: 21.5,
    estimatedDurationMinutes: 42,
    tripType: 1,
    scheduledAt: null,
    scheduledSlot: null,
    ...overrides,
  };

  const createResponse = await request.post(
    `${API_BASE_URL}/ride-sharing/requests`,
    {
      data: payload,
      headers: authHeaders(session),
    }
  );

  if (!createResponse.ok()) {
    throw new Error(
      `Create ride sharing request failed: ${createResponse.status()} ${await createResponse.text()}`
    );
  }

  return createResponse.json();
}

async function waitForMyRideSharingGroup(request, session) {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    const response = await request.get(`${API_BASE_URL}/ride-sharing/groups/my`, {
      headers: authHeaders(session),
    });

    if (response.ok()) {
      const group = await response.json();
      const groupId = getEntityId(group);

      if (groupId) {
        return { group, groupId };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error("Timed out waiting for ride sharing group to be created.");
}

test("integration: customer can create and cancel ride sharing request with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  let createdRequestId = null;

  try {
    await test.step("Clean existing ride sharing state for customer", async () => {
      await cleanupRideSharingState(request, session);
    });

    const createResponse = await test.step(
      "Call POST /api/ride-sharing/requests",
      async () =>
        request.post(`${API_BASE_URL}/ride-sharing/requests`, {
          data: {
            pickupLatitude: 21.028716,
            pickupLongitude: 105.778467,
            pickupAddress: "E2E Integration My Dinh pickup",
            destinationLatitude: 21.013189,
            destinationLongitude: 105.525578,
            destinationAddress: "E2E Integration FPT Hoa Lac",
            direction: 1,
            estimatedDistanceKm: 21.5,
            estimatedDurationMinutes: 42,
            tripType: 2,
            scheduledAt: getTomorrowMorningIso(),
            scheduledSlot: 1,
          },
          headers: authHeaders(session),
        })
    );
    await test.step("Verify ride sharing request is created successfully", async () => {
      expect(createResponse.ok()).toBe(true);
    });

    await test.step("Read created ride sharing request id from response", async () => {
      const createdRequest = await createResponse.json();
      createdRequestId = getEntityId(createdRequest);
      expect(createdRequestId).toBeTruthy();
    });

    const myRequestResponse = await test.step(
      "Call GET /api/ride-sharing/requests/my",
      async () =>
        request.get(`${API_BASE_URL}/ride-sharing/requests/my`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify current request API returns created request", async () => {
      expect(myRequestResponse.ok()).toBe(true);
    });

    const cancelResponse = await test.step(
      "Call POST /api/ride-sharing/requests/{requestId}/cancel",
      async () =>
        cancelRideSharingByApi(request, createdRequestId, session.accessToken)
    );
    await test.step("Verify ride sharing request is cancelled successfully", async () => {
      expect(cancelResponse.ok()).toBe(true);
    });
  } finally {
    await cancelRideSharingByApi(
      request,
      createdRequestId,
      session.accessToken
    ).catch(() => {});
  }
});

test("integration: customer can view my ride sharing request and request detail with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  let createdRequestId = null;

  try {
    await test.step("Clean existing ride sharing state for customer", async () => {
      await cleanupRideSharingState(request, session);
    });

    await test.step("Call POST /api/ride-sharing/requests to prepare request", async () => {
      const createdRequest = await createRideSharingRequestForSession(request, session, {
        pickupAddress: "E2E Integration Detail My Dinh pickup",
      });
      createdRequestId = getEntityId(createdRequest);
      expect(createdRequestId).toBeTruthy();
    });

    const myRequestResponse = await test.step(
      "Call GET /api/ride-sharing/requests/my",
      async () =>
        request.get(`${API_BASE_URL}/ride-sharing/requests/my`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify my request API returns the active request", async () => {
      expect(myRequestResponse.ok()).toBe(true);
      const myRequest = await myRequestResponse.json();
      expect(getEntityId(myRequest)).toBe(createdRequestId);
    });

    const detailResponse = await test.step(
      "Call GET /api/ride-sharing/requests/{requestId}",
      async () =>
        request.get(`${API_BASE_URL}/ride-sharing/requests/${createdRequestId}`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify request detail API returns created request", async () => {
      expect(detailResponse.ok()).toBe(true);
      const requestDetail = await detailResponse.json();
      expect(getEntityId(requestDetail)).toBe(createdRequestId);
      expect(requestDetail.pickupAddress).toBe(
        "E2E Integration Detail My Dinh pickup"
      );
    });
  } finally {
    await cancelRideSharingByApi(
      request,
      createdRequestId,
      session.accessToken
    ).catch(() => {});
  }
});

test("integration: customer can view prepared ride sharing group detail with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  const secondSession = await test.step(
    "Login with second customer account",
    async () =>
      createCustomerSession(
        test,
        request,
        requireSecondCustomerCredentials(test)
      )
  );
  let groupId = null;

  try {
    await test.step("Clean existing ride sharing state for both customers", async () => {
      await cleanupRideSharingState(request, session);
      await cleanupRideSharingState(request, secondSession);
    });

    await test.step("Create matching ride sharing request for second customer", async () => {
      await createRideSharingRequestForSession(request, secondSession, {
        pickupAddress: "E2E Integration Second My Dinh pickup",
      });
    });

    await test.step("Create matching ride sharing request for main customer", async () => {
      await createRideSharingRequestForSession(request, session, {
        pickupLatitude: 21.0289,
        pickupLongitude: 105.7787,
        pickupAddress: "E2E Integration Main My Dinh pickup",
      });
    });

    await test.step("Wait until backend creates ride sharing group", async () => {
      const myGroup = await waitForMyRideSharingGroup(request, session);
      groupId = myGroup.groupId;
      expect(groupId).toBeTruthy();
    });

    const myGroupResponse = await test.step(
      "Call GET /api/ride-sharing/groups/my",
      async () =>
        request.get(`${API_BASE_URL}/ride-sharing/groups/my`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify my group API returns prepared group", async () => {
      expect(myGroupResponse.ok()).toBe(true);
      const myGroup = await myGroupResponse.json();
      expect(getEntityId(myGroup)).toBe(groupId);
    });

    const groupDetailResponse = await test.step(
      "Call GET /api/ride-sharing/groups/{groupId}",
      async () =>
        request.get(`${API_BASE_URL}/ride-sharing/groups/${groupId}`, {
          headers: authHeaders(session),
        })
    );
    await test.step("Verify group detail contains active members", async () => {
      expect(groupDetailResponse.ok()).toBe(true);
      const group = await groupDetailResponse.json();
      expect(getEntityId(group)).toBe(groupId);
      expect(Array.isArray(group.members)).toBe(true);
      expect(group.members.length).toBeGreaterThanOrEqual(2);
    });
  } finally {
    await cleanupRideSharingState(request, session);
    await cleanupRideSharingState(request, secondSession);
  }
});

test("integration: cancel ride sharing request rejects invalid cancel reason", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );
  let createdRequestId = null;

  try {
    await test.step("Clean existing ride sharing state for customer", async () => {
      await cleanupRideSharingState(request, session);
    });

    const createResponse = await test.step(
      "Call POST /api/ride-sharing/requests to prepare cancellable request",
      async () =>
        request.post(`${API_BASE_URL}/ride-sharing/requests`, {
          data: {
            pickupLatitude: 21.028716,
            pickupLongitude: 105.778467,
            pickupAddress: "E2E Integration Invalid Cancel My Dinh pickup",
            destinationLatitude: 21.013189,
            destinationLongitude: 105.525578,
            destinationAddress: "E2E Integration FPT Hoa Lac",
            direction: 1,
            estimatedDistanceKm: 21.5,
            estimatedDurationMinutes: 42,
            tripType: 2,
            scheduledAt: getTomorrowMorningIso(),
            scheduledSlot: 1,
          },
          headers: authHeaders(session),
        })
    );
    await test.step("Verify ride sharing request is created successfully", async () => {
      expect(createResponse.ok()).toBe(true);
    });

    await test.step("Read created ride sharing request id from response", async () => {
      const createdRequest = await createResponse.json();
      createdRequestId = getEntityId(createdRequest);
      expect(createdRequestId).toBeTruthy();
    });

    const invalidCancelResponse = await test.step(
      "Call POST /api/ride-sharing/requests/{requestId}/cancel with invalid reason",
      async () =>
        request.post(
          `${API_BASE_URL}/ride-sharing/requests/${createdRequestId}/cancel`,
          {
            data: { cancelReason: 999 },
            headers: authHeaders(session),
          }
        )
    );

    await test.step("Verify API returns 400 Bad Request", async () => {
      expect(invalidCancelResponse.status()).toBe(400);
    });
  } finally {
    await cancelRideSharingByApi(
      request,
      createdRequestId,
      session.accessToken
    ).catch(() => {});
  }
});

test("integration: customer can view available ride sharing groups with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );

  const availableGroupsResponse = await test.step(
    "Call GET /api/ride-sharing/groups/available?direction=1",
    async () =>
      request.get(`${API_BASE_URL}/ride-sharing/groups/available?direction=1`, {
        headers: authHeaders(session),
      })
  );

  await test.step("Verify available groups API returns 200 OK", async () => {
    expect(availableGroupsResponse.ok()).toBe(true);
  });

  await test.step("Verify response body is a group list", async () => {
    const groups = await availableGroupsResponse.json();
    expect(Array.isArray(groups)).toBe(true);
  });
});

test("integration: ride sharing APIs reject request without access token", async ({
  request,
}) => {
  const availableGroupsResponse = await test.step(
    "Call GET /api/ride-sharing/groups/available without token",
    async () =>
      request.get(`${API_BASE_URL}/ride-sharing/groups/available?direction=1`)
  );

  await test.step("Verify API returns 401 Unauthorized", async () => {
    expect(availableGroupsResponse.status()).toBe(401);
  });
});
