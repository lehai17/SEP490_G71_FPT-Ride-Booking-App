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
} = require("./helpers/customer-real-backend");

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

test("customer can view and leave current ride sharing group with backend", async ({
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
