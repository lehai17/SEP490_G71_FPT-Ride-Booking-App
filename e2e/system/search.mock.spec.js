const { test, expect } = require("@playwright/test");

const API_BASE_URL = process.env.E2E_API_URL ?? "http://localhost:5228/api";
const SESSION_STORAGE_KEY = "fpt-ride.auth.session";

async function createCustomerSession(request) {
  const email = process.env.E2E_CUSTOMER_EMAIL;
  const password = process.env.E2E_CUSTOMER_PASSWORD;

  test.skip(
    !email || !password,
    "Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run logged-in booking tests."
  );

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
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: SESSION_STORAGE_KEY, value: session }
  );
}

async function seedMockCustomerSession(page) {
  const session = {
    accessToken: "e2e-home-token",
    refreshToken: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    userId: "e2e-home-customer",
    fullName: "E2E Customer",
    email: "e2e.customer@example.com",
    phoneNumber: null,
    avatarUrl: null,
    role: "Customer",
    createdAt: null,
  };

  await page.route(`${API_BASE_URL}/auth/profile/${session.userId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: session.userId,
        fullName: session.fullName,
        email: session.email,
        phoneNumber: session.phoneNumber,
        avatarUrl: session.avatarUrl,
        role: session.role,
        createdAt: session.createdAt,
      }),
    })
  );

  await seedCustomerSession(page, session);
  return session;
}

async function waitForAuthRestore(page) {
  await page.waitForFunction(
    () => !document.body.innerText.includes("Đang kiểm tra"),
    null,
    { timeout: 10_000 }
  );
}

async function pressByTestId(page, testId) {
  const locator = page.getByTestId(testId);

  try {
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ force: true });
  } catch {
    await locator.dispatchEvent("click");
  }
}

async function typeIntoInput(locator, value) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await locator.scrollIntoViewIfNeeded();
      await locator.click({ force: true });
      await locator.fill("");
      await locator.focus();
      await locator.pressSequentially(value, { delay: 20 });

      try {
        await expect(locator).toHaveValue(value, { timeout: 2_000 });
        return;
      } catch {
        await locator.evaluate((element, nextValue) => {
          const prototype = Object.getPrototypeOf(element);
          const valueSetter = Object.getOwnPropertyDescriptor(
            prototype,
            "value"
          )?.set;

          if (valueSetter) {
            valueSetter.call(element, nextValue);
          } else {
            element.value = nextValue;
          }

          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }, value);
      }

      await expect(locator).toHaveValue(value, { timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

async function mockVietMapAutocomplete(page) {
  const pickupPlace = {
    ref_id: "e2e-fpt-hoa-lac",
    name: "Dai hoc FPT Hoa Lac",
    address: "Khu cong nghe cao Hoa Lac, Thach That, Ha Noi",
    display: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
    lat: 21.013189,
    lng: 105.525578,
  };
  const destinationPlace = {
    ref_id: "e2e-ben-xe-my-dinh",
    name: "Ben xe My Dinh",
    address: "20 Pham Hung, My Dinh, Nam Tu Liem, Ha Noi",
    display: "Ben xe My Dinh, Nam Tu Liem, Ha Noi",
    lat: 21.028716,
    lng: 105.778467,
  };

  await page.route("https://maps.vietmap.vn/api/autocomplete/v3**", (route) => {
    const url = new URL(route.request().url());
    const text = (url.searchParams.get("text") ?? "").toLowerCase();
    const data =
      text.includes("ben xe") || text.includes("my dinh")
        ? [destinationPlace]
        : [pickupPlace];

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
}

async function mockPricingEstimate(page) {
  await page.route(`${API_BASE_URL}/pricing/estimate`, async (route) => {
    const payload = route.request().postDataJSON();
    const fareByVehicleType = {
      1: 45000,
      2: 125000,
    };

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        estimatedFare: fareByVehicleType[payload.vehicleType] ?? 75000,
      }),
    });
  });
}

async function mockVietMapDirections(page) {
  await page.route("https://maps.vietmap.vn/api/route/v3**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        paths: [
          {
            distance: 21000,
            time: 2520000,
            points: {
              coordinates: [
                [105.525578, 21.013189],
                [105.778467, 21.028716],
              ],
            },
          },
        ],
      }),
    })
  );

  await page.route("https://maps.vietmap.vn/api/route?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        paths: [
          {
            distance: 21000,
            time: 2520000,
            points: {
              coordinates: [
                [105.525578, 21.013189],
                [105.778467, 21.028716],
              ],
            },
          },
        ],
      }),
    })
  );
}

async function mockCreateTrip(page) {
  const trip = {
    id: "e2e-trip-1",
    status: "Pending",
    pickupAddress: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
    destinationAddress: "Ben xe My Dinh, Nam Tu Liem, Ha Noi",
    estimatedFare: 45000,
    estimatedDistanceKm: 21,
    estimatedDurationMinute: 42,
    vehicleType: 1,
    createdAt: new Date().toISOString(),
  };

  await page.route(`${API_BASE_URL}/trips`, (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ trip }),
    });
  });

  await page.route(`${API_BASE_URL}/trips/e2e-trip-1`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(trip),
    })
  );
}

async function mockCreateCompletedTrip(page) {
  const trip = {
    id: "e2e-completed-trip",
    status: "Completed",
    pickupAddress: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
    destinationAddress: "Ben xe My Dinh, Nam Tu Liem, Ha Noi",
    estimatedFare: 45000,
    estimatedDistanceKm: 21,
    estimatedDurationMinute: 42,
    vehicleType: 1,
    driverId: "e2e-driver",
    driverName: "Tai xe E2E",
    driverPhone: "0900000000",
    driverLicensePlate: "30A-12345",
    driverVehicleInfo: "Xe may",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  await page.route(`${API_BASE_URL}/trips`, (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ trip }),
    });
  });

  await page.route(`${API_BASE_URL}/trips/e2e-completed-trip`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(trip),
    })
  );
}

async function mockRideSharingState(page) {
  await page.route(`${API_BASE_URL}/ride-sharing/requests/my`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    })
  );

  await page.route(`${API_BASE_URL}/ride-sharing/groups/my`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    })
  );

  await page.route(`${API_BASE_URL}/ride-sharing/groups/available**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  );
}

function createMockRideSharingGroup(overrides = {}) {
  return {
    id: "e2e-shared-group",
    status: "Forming",
    direction: 1,
    currentPassengers: 1,
    maxPassengers: 3,
    finalFare: 90000,
    scheduledDepartureTime: "2026-09-14T09:00:00",
    driverName: "",
    destinationAddress: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
    members: [
      {
        requestId: "e2e-member-request",
        passengerId: "other-passenger",
        passengerName: "Ban hoc FPT",
        pickupAddress: "Ben xe My Dinh, Nam Tu Liem, Ha Noi",
        destinationAddress: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
        finalFare: 45000,
        estimatedDistanceKm: 21,
        joinedAt: "2026-09-13T08:00:00",
      },
    ],
    createdAt: "2026-09-13T08:00:00",
    ...overrides,
  };
}

function createMockRideSharingRequest(overrides = {}) {
  return {
    id: "e2e-shared-request",
    passengerId: "e2e-home-customer",
    status: "Pending",
    groupId: "",
    pickupAddress: "Ben xe My Dinh, Nam Tu Liem, Ha Noi",
    destinationAddress: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
    quotedFare: 45000,
    finalFare: null,
    estimatedDistanceKm: 21,
    estimatedDurationMinutes: 42,
    scheduledAt: "2026-09-14T09:00:00",
    scheduledSlot: 1,
    createdAt: "2026-09-13T08:00:00",
    ...overrides,
  };
}

async function mockCancelTrip(page) {
  await page.route(`${API_BASE_URL}/trips/e2e-trip-1/cancel/passenger`, (route) => {
    if (route.request().method() !== "PUT") {
      return route.fallback();
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "e2e-trip-1",
        status: "Cancelled",
        pickupAddress: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
        destinationAddress: "Ben xe My Dinh, Nam Tu Liem, Ha Noi",
        estimatedFare: 45000,
        estimatedDistanceKm: 21,
        estimatedDurationMinute: 42,
        vehicleType: 1,
        cancelledAt: new Date().toISOString(),
      }),
    });
  });
}

async function openBookingConfirmStage(page, request) {
  await mockVietMapAutocomplete(page);

  const session = await createCustomerSession(request);
  await seedCustomerSession(page, session);

  await page.goto("/search");
  await expect(page.getByText("Đặt xe")).toBeVisible();
  await waitForAuthRestore(page);

  const pickupInput = page.getByTestId("booking-pickup-input");
  const destinationInput = page.getByTestId("booking-destination-input");
  const firstPickupSuggestion = page.getByTestId("booking-pickup-suggestion-0");
  const firstDestinationSuggestion = page.getByTestId(
    "booking-destination-suggestion-0"
  );

  await typeIntoInput(pickupInput, "Dai hoc FPT Hoa Lac");
  await expect(firstPickupSuggestion).toBeVisible({ timeout: 15_000 });
  await firstPickupSuggestion.click({ force: true });
  await expect(firstPickupSuggestion).toBeHidden({ timeout: 15_000 });

  await typeIntoInput(destinationInput, "Ben xe My Dinh");
  await expect(firstDestinationSuggestion).toBeVisible({ timeout: 15_000 });
  await firstDestinationSuggestion.click({ force: true });
  await expect(firstDestinationSuggestion).toBeHidden({ timeout: 15_000 });

  await pressByTestId(page, "booking-continue-button");
  await expect(page.getByTestId("booking-confirm-stage")).toBeVisible({
    timeout: 20_000,
  });
}

async function openFindingDriverStage(page, request) {
  await mockPricingEstimate(page);
  await mockCreateTrip(page);
  await openBookingConfirmStage(page, request);

  await pressByTestId(page, "booking-confirm-destination-button");
  await expect(page.getByTestId("booking-ride-options-stage")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("booking-ride-option-bike")).not.toContainText(
    "Đang tính...",
    { timeout: 10_000 }
  );

  await pressByTestId(page, "booking-book-button");
  await expect(page.getByTestId("booking-finding-driver-stage")).toBeVisible({
    timeout: 20_000,
  });
}

test("customer can open search tab without runtime errors", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/search");

  await expect(page).toHaveURL(/\/search/);
  await expect(page.getByText("Điểm đón")).toBeVisible();
  await expect(page.getByText("Điểm đến")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("logged-in customer sees booking validation when pickup is missing", async ({
  page,
  request,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const session = await createCustomerSession(request);
  await seedCustomerSession(page, session);

  await page.goto("/search");
  await expect(page.getByText("Đặt xe")).toBeVisible();

  await expect(page.getByTestId("booking-pickup-input")).toBeVisible();
  await page.getByTestId("booking-pickup-input").fill("");
  await page.getByTestId("booking-destination-input").fill("");
  await pressByTestId(page, "booking-continue-button");

  await expect(page.getByTestId("booking-alert-card")).toBeVisible();
  await expect(page.getByTestId("booking-alert-message")).toContainText(
    "Vui lòng nhập điểm đón."
  );
  expect(pageErrors).toEqual([]);
});

test("logged-in customer must choose pickup from suggestions", async ({
  page,
  request,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockVietMapAutocomplete(page);

  const session = await createCustomerSession(request);
  await seedCustomerSession(page, session);

  await page.goto("/search");
  await expect(page.getByText("Đặt xe")).toBeVisible();

  const pickupInput = page.getByTestId("booking-pickup-input");
  const destinationInput = page.getByTestId("booking-destination-input");

  await typeIntoInput(pickupInput, "Dai hoc FPT Hoa Lac");
  await typeIntoInput(destinationInput, "Ben xe My Dinh");
  await expect(pickupInput).toHaveValue("Dai hoc FPT Hoa Lac");
  await expect(destinationInput).toHaveValue("Ben xe My Dinh");

  await pressByTestId(page, "booking-continue-button");

  await expect(page.getByTestId("booking-alert-card")).toBeVisible();
  await expect(page.getByTestId("booking-alert-message")).toContainText(
    "Vui lòng chọn điểm đón từ gợi ý VietMap."
  );
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can select pickup and destination suggestions", async ({
  page,
  request,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await openBookingConfirmStage(page, request);
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can choose vehicle type from home before booking", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockPricingEstimate(page);
  await mockVietMapAutocomplete(page);
  await seedMockCustomerSession(page);

  await page.goto("/");
  await waitForAuthRestore(page);
  await expect(page.getByTestId("home-vehicle-selector")).toBeVisible();

  await pressByTestId(page, "home-vehicle-option-car4");
  await expect(page.getByTestId("booking-pickup-input")).toBeVisible();
  await expect(page).toHaveURL(/vehicle=car4/);
  await expect(page.getByTestId("booking-destination-input")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can continue to ride options", async ({
  page,
  request,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockPricingEstimate(page);
  await openBookingConfirmStage(page, request);

  await pressByTestId(page, "booking-confirm-destination-button");

  await expect(page.getByTestId("booking-ride-options-stage")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("booking-ride-option-bike")).toBeVisible();
  await expect(page.getByTestId("booking-book-button")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can book ride and see finding driver", async ({
  page,
  request,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await openFindingDriverStage(page, request);
  await expect(page.getByTestId("booking-finding-secondary-button")).toBeVisible();
  await expect(page.getByText("Đang tìm tài xế", { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can review completed ride from booking screen", async ({
  page,
}) => {
  const pageErrors = [];
  const reviewRequests = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockPricingEstimate(page);
  await mockVietMapAutocomplete(page);
  await mockCreateCompletedTrip(page);
  await page.route(`${API_BASE_URL}/reviews`, (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }

    reviewRequests.push(route.request().postDataJSON());

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "e2e-review",
        tripId: "e2e-completed-trip",
        rating: 4,
        comment: "Chuyen di on",
        createdAt: new Date().toISOString(),
      }),
    });
  });

  await seedMockCustomerSession(page);
  await page.goto("/search");
  await waitForAuthRestore(page);

  const pickupInput = page.getByTestId("booking-pickup-input");
  const destinationInput = page.getByTestId("booking-destination-input");
  const firstPickupSuggestion = page.getByTestId("booking-pickup-suggestion-0");
  const firstDestinationSuggestion = page.getByTestId(
    "booking-destination-suggestion-0"
  );

  await typeIntoInput(pickupInput, "Dai hoc FPT Hoa Lac");
  await expect(firstPickupSuggestion).toBeVisible({ timeout: 15_000 });
  await firstPickupSuggestion.click({ force: true });
  await expect(firstPickupSuggestion).toBeHidden({ timeout: 15_000 });

  await typeIntoInput(destinationInput, "Ben xe My Dinh");
  await expect(firstDestinationSuggestion).toBeVisible({ timeout: 15_000 });
  await firstDestinationSuggestion.click({ force: true });
  await expect(firstDestinationSuggestion).toBeHidden({ timeout: 15_000 });

  await pressByTestId(page, "booking-continue-button");
  await expect(page.getByTestId("booking-confirm-stage")).toBeVisible({
    timeout: 20_000,
  });

  await pressByTestId(page, "booking-confirm-destination-button");
  await expect(page.getByTestId("booking-ride-options-stage")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("booking-ride-option-bike")).not.toContainText(
    "Äang tÃ­nh...",
    { timeout: 10_000 }
  );

  await pressByTestId(page, "booking-book-button");
  await expect(page.getByTestId("booking-finding-driver-stage")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("booking-completed-review-button")).toBeVisible({
    timeout: 20_000,
  });

  await pressByTestId(page, "booking-completed-review-button");
  await expect(page.getByTestId("booking-review-modal")).toBeVisible();
  await pressByTestId(page, "booking-review-star-4");
  await typeIntoInput(
    page.getByTestId("booking-review-comment-input"),
    "Chuyen di on"
  );
  await pressByTestId(page, "booking-review-submit-button");

  await expect(page.getByTestId("booking-review-modal")).toBeHidden({
    timeout: 10_000,
  });
  await expect(page.getByTestId("booking-completed-review-button")).toContainText(
    "Đã đánh giá"
  );
  expect(reviewRequests).toEqual([
    {
      tripId: "e2e-completed-trip",
      rating: 4,
      comment: "Chuyen di on",
    },
  ]);
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can cancel pending ride", async ({ page, request }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockCancelTrip(page);
  await openFindingDriverStage(page, request);

  await pressByTestId(page, "booking-finding-secondary-button");

  await expect(page.getByText("Chuyến đi đã bị hủy")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
  await expect(page.getByTestId("booking-finding-secondary-button")).toContainText(
    "Quay lại"
  );
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can return to booking form after cancelling ride", async ({
  page,
  request,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockCancelTrip(page);
  await openFindingDriverStage(page, request);

  await pressByTestId(page, "booking-finding-secondary-button");
  await expect(page.getByText("Chuyến đi đã bị hủy")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("booking-finding-secondary-button")).toContainText(
    "Quay lại"
  );

  await pressByTestId(page, "booking-finding-secondary-button");

  await expect(page.getByTestId("booking-pickup-input")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("booking-destination-input")).toBeVisible();
  await expect(page.getByTestId("booking-continue-button")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("logged-in customer sees ride sharing validation when location is missing", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockRideSharingState(page);
  await seedMockCustomerSession(page);

  await page.goto("/search");
  await expect(page.getByText("Đặt xe")).toBeVisible();
  await waitForAuthRestore(page);
  await expect(page.getByTestId("booking-pickup-input")).toBeVisible();

  await pressByTestId(page, "booking-mode-shared");
  await expect(page.getByTestId("ride-sharing-section")).toBeVisible();

  await pressByTestId(page, "ride-sharing-create-button");
  await expect(page.getByTestId("ride-sharing-create-modal")).toBeVisible();

  await pressByTestId(page, "ride-sharing-submit-button");

  await expect(page.getByTestId("ride-sharing-form-error")).toBeVisible();
  await expect(page.getByTestId("ride-sharing-form-error")).toContainText(
    "Vui lòng nhập điểm đón."
  );
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can create and cancel ride sharing request", async ({
  page,
}) => {
  const pageErrors = [];
  const createRequests = [];
  const cancelRequests = [];
  let currentRequest = null;

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockVietMapAutocomplete(page);
  await mockVietMapDirections(page);
  await page.route(`${API_BASE_URL}/ride-sharing/requests/my`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentRequest),
    })
  );
  await page.route(`${API_BASE_URL}/ride-sharing/groups/my`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    })
  );
  await page.route(`${API_BASE_URL}/ride-sharing/groups/available**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  );
  await page.route(`${API_BASE_URL}/ride-sharing/requests/e2e-shared-request`, (route) =>
    route.fulfill({
      status: currentRequest ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(currentRequest ?? { message: "Not found" }),
    })
  );
  await page.route(`${API_BASE_URL}/ride-sharing/requests`, (route) => {
    if (route.request().method() !== "POST") {
      return route.fallback();
    }

    const payload = route.request().postDataJSON();
    createRequests.push(payload);
    currentRequest = createMockRideSharingRequest({
      pickupAddress: payload.pickupAddress,
      destinationAddress: payload.destinationAddress,
      estimatedDistanceKm: payload.estimatedDistanceKm,
      estimatedDurationMinutes: payload.estimatedDurationMinutes,
      scheduledAt: payload.scheduledAt,
      scheduledSlot: payload.scheduledSlot,
    });

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentRequest),
    });
  });
  await page.route(
    `${API_BASE_URL}/ride-sharing/requests/e2e-shared-request/cancel`,
    (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }

      cancelRequests.push(route.request().postDataJSON());
      currentRequest = createMockRideSharingRequest({
        status: "Cancelled",
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentRequest),
      });
    }
  );

  await seedMockCustomerSession(page);
  await page.goto("/search");
  await waitForAuthRestore(page);
  await pressByTestId(page, "booking-mode-shared");
  await expect(page.getByTestId("ride-sharing-section")).toBeVisible();

  await pressByTestId(page, "ride-sharing-create-button");
  await expect(page.getByTestId("ride-sharing-create-modal")).toBeVisible();
  await typeIntoInput(page.getByTestId("ride-sharing-location-input"), "Ben xe My Dinh");
  await expect(page.getByTestId("ride-sharing-location-suggestion-0")).toBeVisible({
    timeout: 15_000,
  });
  await pressByTestId(page, "ride-sharing-location-suggestion-0");
  await pressByTestId(page, "ride-sharing-date-1");
  await pressByTestId(page, "ride-sharing-slot-slot-1");
  await pressByTestId(page, "ride-sharing-submit-button");

  await expect(page.getByTestId("ride-sharing-create-modal")).toBeHidden({
    timeout: 20_000,
  });
  await expect(page.getByTestId("ride-sharing-request-card-0")).toBeVisible({
    timeout: 20_000,
  });
  expect(createRequests).toHaveLength(1);
  expect(createRequests[0]).toMatchObject({
    direction: 1,
    tripType: 2,
    scheduledSlot: 1,
  });

  await pressByTestId(page, "ride-sharing-request-cancel-0");
  await expect(page.getByTestId("ride-sharing-request-card-0")).toBeVisible({
    timeout: 20_000,
  });
  expect(cancelRequests).toEqual([{ cancelReason: 4 }]);
  expect(pageErrors).toEqual([]);
});

test("logged-in customer can open and join suggested ride sharing group", async ({
  page,
}) => {
  const pageErrors = [];
  const joinRequests = [];
  let group = createMockRideSharingGroup();

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockVietMapAutocomplete(page);
  await page.route(`${API_BASE_URL}/ride-sharing/requests/my`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    })
  );
  await page.route(`${API_BASE_URL}/ride-sharing/groups/my`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    })
  );
  await page.route(`${API_BASE_URL}/ride-sharing/groups/available**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: group.id }]),
    })
  );
  await page.route(`${API_BASE_URL}/ride-sharing/groups/e2e-shared-group`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(group),
    })
  );
  await page.route(
    `${API_BASE_URL}/ride-sharing/groups/e2e-shared-group/join`,
    (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }

      const payload = route.request().postDataJSON();
      joinRequests.push(payload);
      group = createMockRideSharingGroup({
        currentPassengers: 2,
        members: [
          ...group.members,
          {
            requestId: "e2e-joined-request",
            passengerId: "e2e-home-customer",
            passengerName: "E2E Customer",
            pickupAddress: payload.pickupAddress,
            destinationAddress: "Dai hoc FPT Hoa Lac, Thach That, Ha Noi",
            finalFare: 45000,
            estimatedDistanceKm: payload.estimatedDistanceKm,
            joinedAt: new Date().toISOString(),
          },
        ],
      });

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(group),
      });
    }
  );

  await seedMockCustomerSession(page);
  await page.goto("/search");
  await waitForAuthRestore(page);
  await pressByTestId(page, "booking-mode-shared");
  await expect(page.getByTestId("ride-sharing-suggested-group-0")).toBeVisible({
    timeout: 20_000,
  });

  await pressByTestId(page, "ride-sharing-suggested-join-0");
  await expect(page).toHaveURL(/\/search\/shared-ride\/e2e-shared-group/);
  await expect(page.getByTestId("shared-ride-join-button")).toBeVisible({
    timeout: 20_000,
  });

  await pressByTestId(page, "shared-ride-join-button");
  await expect(page.getByTestId("shared-ride-join-modal")).toBeVisible();
  await typeIntoInput(page.getByTestId("shared-ride-pickup-input"), "Ben xe My Dinh");
  await expect(page.getByTestId("shared-ride-pickup-suggestion-0")).toBeVisible({
    timeout: 15_000,
  });
  await pressByTestId(page, "shared-ride-pickup-suggestion-0");
  await pressByTestId(page, "shared-ride-submit-join-button");

  await expect(page.getByTestId("shared-ride-join-modal")).toBeHidden({
    timeout: 20_000,
  });
  expect(joinRequests).toHaveLength(1);
  expect(joinRequests[0]).toMatchObject({
    pickupAddress: "Ben xe My Dinh, Nam Tu Liem, Ha Noi",
  });
  expect(pageErrors).toEqual([]);
});
