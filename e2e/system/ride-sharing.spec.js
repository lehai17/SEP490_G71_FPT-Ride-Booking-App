const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  cancelRideSharingByApi,
  createCustomerSession,
  getTomorrowMorningIso,
  leaveRideSharingGroupByApi,
  pressByTestId,
  seedCustomerSession,
  waitForAuthRestore,
} = require("../helpers/customer-real-backend");

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

function authHeaders(session) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

function getEntityId(payload) {
  return payload?.request?.id ?? payload?.group?.id ?? payload?.id ?? null;
}

async function cleanupRideSharingState(request, session) {
  const myRequestResponse = await request.get(
    `${API_BASE_URL}/ride-sharing/requests/my`,
    { headers: authHeaders(session) }
  );

  if (myRequestResponse.ok()) {
    const myRequest = await myRequestResponse.json();
    const cancelResponse = await cancelRideSharingByApi(
      request,
      getEntityId(myRequest),
      session.accessToken
    ).catch(() => null);

    if (cancelResponse) {
      expect(cancelResponse.ok()).toBe(true);
    }
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

  const remainingRequestResponse = await request.get(
    `${API_BASE_URL}/ride-sharing/requests/my`,
    { headers: authHeaders(session) }
  );

  if (remainingRequestResponse.ok()) {
    const remainingRequest = await remainingRequestResponse.json();
    const cancelResponse = await cancelRideSharingByApi(
      request,
      getEntityId(remainingRequest),
      session.accessToken
    ).catch(() => null);

    if (cancelResponse) {
      expect(cancelResponse.ok()).toBe(true);
    }
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
    pickupAddress: "E2E My Dinh pickup",
    destinationLatitude: 21.013189,
    destinationLongitude: 105.525578,
    destinationAddress: "E2E Dai hoc FPT Hoa Lac",
    direction: 1,
    estimatedDistanceKm: 21.5,
    estimatedDurationMinutes: 42,
    tripType: 2,
    scheduledAt: getTomorrowMorningIso(),
    scheduledSlot: 1,
    ...overrides,
  };
  let createResponse = await request.post(
    `${API_BASE_URL}/ride-sharing/requests`,
    {
      data: payload,
      headers: authHeaders(session),
    }
  );

  if (!createResponse.ok()) {
    const currentRequestResponse = await request.get(
      `${API_BASE_URL}/ride-sharing/requests/my`,
      { headers: authHeaders(session) }
    );

    if (currentRequestResponse.ok()) {
      const currentRequest = await currentRequestResponse.json();
      await cancelRideSharingByApi(
        request,
        getEntityId(currentRequest),
        session.accessToken
      ).catch(() => {});
    }

    createResponse = await request.post(`${API_BASE_URL}/ride-sharing/requests`, {
      data: payload,
      headers: authHeaders(session),
    });
  }

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

test("customer can create and cancel ride sharing request with backend", async ({
  page,
  request,
}) => {
  const session = await createCustomerSession(test, request);
  await seedCustomerSession(page, session);

  let createdRequestId = null;

  try {
    const currentRequestResponse = await request.get(
      `${API_BASE_URL}/ride-sharing/requests/my`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (currentRequestResponse.ok()) {
      const currentRequest = await currentRequestResponse.json();
      const currentRequestId = currentRequest?.request?.id ?? currentRequest?.id;
      await cancelRideSharingByApi(
        request,
        currentRequestId,
        session.accessToken
      ).catch(() => {});
    }

    const createRequestResponse = await request.post(
      `${API_BASE_URL}/ride-sharing/requests`,
      {
        data: {
          pickupLatitude: 21.028716,
          pickupLongitude: 105.778467,
          pickupAddress: "E2E Ben xe My Dinh",
          destinationLatitude: 21.013189,
          destinationLongitude: 105.525578,
          destinationAddress: "E2E Dai hoc FPT Hoa Lac",
          direction: 1,
          estimatedDistanceKm: 21.5,
          estimatedDurationMinutes: 42,
          tripType: 2,
          scheduledAt: getTomorrowMorningIso(),
          scheduledSlot: 1,
        },
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }
    );
    expect(createRequestResponse.ok()).toBe(true);

    const createRequestPayload = await createRequestResponse.json();
    createdRequestId =
      createRequestPayload?.request?.id ?? createRequestPayload?.id ?? null;
    expect(createdRequestId).toBeTruthy();

    await page.goto("/search?mode=shared&when=any&source=e2e");
    await waitForAuthRestore(page);

    await expect(page.getByTestId("ride-sharing-section")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("ride-sharing-request-card-0")).toBeVisible({
      timeout: 20_000,
    });

    const cancelRequestResponsePromise = page.waitForResponse((response) =>
      response.url().includes(
        `/api/ride-sharing/requests/${createdRequestId}/cancel`
      )
    );

    await pressByTestId(page, "ride-sharing-request-cancel-0");
    const cancelRequestResponse = await cancelRequestResponsePromise;
    expect(cancelRequestResponse.ok()).toBe(true);
  } finally {
    await cancelRideSharingByApi(
      request,
      createdRequestId,
      session.accessToken
    ).catch(() => {});
  }
});

test.skip("customer can join ride sharing group with backend", async () => {
  // Skip vi BE join nhom xe ghep dang loi/chua san sang.
});

/*
test.skip("customer can view and leave current ride sharing group with backend", async ({
  page,
  request,
}) => {
  const session = await createCustomerSession(test, request);
  await seedCustomerSession(page, session);

  const myGroupResponse = await request.get(
    `${API_BASE_URL}/ride-sharing/groups/my`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } }
  );

  test.skip(
    !myGroupResponse.ok(),
    "Account test hien khong co nhom xe ghep; BE join nhom dang loi nen khong tao duoc data de roi nhom."
  );

  const myGroup = await myGroupResponse.json();
  const groupId = myGroup?.group?.id ?? myGroup?.id ?? null;

  test.skip(
    !groupId,
    "BE khong tra groupId cho nhom xe ghep hien tai cua account test."
  );

  await page.goto(`/search/shared-ride/${groupId}`);
  await waitForAuthRestore(page);

  await expect(page.locator("body")).toContainText(/Chi|tiết|xe|ghép/i, {
    timeout: 30_000,
  });

  const leaveResponse = await leaveRideSharingGroupByApi(
    request,
    groupId,
    session.accessToken
  );

  expect(leaveResponse.ok()).toBe(true);
});

*/

test("customer can view and leave prepared ride sharing group with backend", async ({
  page,
  request,
}) => {
  const session = await createCustomerSession(test, request);
  const secondSession = await createCustomerSession(
    test,
    request,
    requireSecondCustomerCredentials(test)
  );
  await seedCustomerSession(page, session);

  let groupId = null;

  try {
    await cleanupRideSharingState(request, session);
    await cleanupRideSharingState(request, secondSession);

    await createRideSharingRequestForSession(request, secondSession, {
      pickupAddress: "E2E Second My Dinh pickup",
      tripType: 1,
      scheduledAt: null,
      scheduledSlot: null,
    });
    await createRideSharingRequestForSession(request, session, {
      pickupLatitude: 21.0289,
      pickupLongitude: 105.7787,
      pickupAddress: "E2E Main My Dinh pickup",
      tripType: 1,
      scheduledAt: null,
      scheduledSlot: null,
    });

    const myGroup = await waitForMyRideSharingGroup(request, session);
    groupId = myGroup.groupId;

    const groupResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/ride-sharing/groups/${groupId}`)
    );
    await page.goto(`/search/shared-ride/${groupId}`);
    await waitForAuthRestore(page);

    const groupResponse = await groupResponsePromise;
    expect(groupResponse.ok()).toBe(true);
    await expect(page.locator("body")).toContainText("E2E", {
      timeout: 30_000,
    });

    const leaveResponse = await leaveRideSharingGroupByApi(
      request,
      groupId,
      session.accessToken
    );

    expect(leaveResponse.ok()).toBe(true);
  } finally {
    await cleanupRideSharingState(request, session);
    await cleanupRideSharingState(request, secondSession);
  }
});
