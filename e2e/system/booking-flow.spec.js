const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  cancelTripByApi,
  createCustomerSession,
  pressByTestId,
  seedCustomerSession,
  typeIntoInput,
  waitForAuthRestore,
} = require("../helpers/customer-real-backend");

async function mockVietMapForBooking(page) {
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

async function selectBookingSuggestion(page, inputTestId, suggestionTestId, value) {
  const input = page.getByTestId(inputTestId);
  const suggestion = page.getByTestId(suggestionTestId);

  await typeIntoInput(input, value);
  await expect(suggestion).toBeVisible({ timeout: 20_000 });
  await pressByTestId(page, suggestionTestId);
  await expect(suggestion).toBeHidden({ timeout: 20_000 });
}

test("system: customer can complete normal booking flow through UI with backend", async ({
  page,
  request,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await mockVietMapForBooking(page);

  const session = await createCustomerSession(test, request);
  await seedCustomerSession(page, session);

  let createdTripId = null;
  let wasCancelledByUi = false;

  try {
    await page.goto("/search");
    await waitForAuthRestore(page);
    await expect(page.getByTestId("booking-pickup-input")).toBeVisible({
      timeout: 20_000,
    });

    await selectBookingSuggestion(
      page,
      "booking-pickup-input",
      "booking-pickup-suggestion-0",
      "Dai hoc FPT Hoa Lac"
    );
    await selectBookingSuggestion(
      page,
      "booking-destination-input",
      "booking-destination-suggestion-0",
      "Ben xe My Dinh"
    );

    await pressByTestId(page, "booking-continue-button");
    await expect(page.getByTestId("booking-confirm-stage")).toBeVisible({
      timeout: 20_000,
    });

    await pressByTestId(page, "booking-confirm-destination-button");
    await expect(page.getByTestId("booking-ride-options-stage")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("booking-ride-option-bike")).toContainText(
      /\d/,
      { timeout: 20_000 }
    );

    await pressByTestId(page, "booking-ride-option-bike");
    const createTripResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/trips") &&
        response.request().method() === "POST",
      { timeout: 20_000 }
    );

    await pressByTestId(page, "booking-book-button");
    const createTripResponse = await createTripResponsePromise;
    expect(createTripResponse.ok()).toBe(true);

    const createTripPayload = await createTripResponse.json();
    createdTripId = createTripPayload?.trip?.id ?? createTripPayload?.id ?? null;
    expect(createdTripId).toBeTruthy();

    await expect(page.getByTestId("booking-finding-driver-stage")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("booking-finding-secondary-button")).toBeVisible();

    const cancelResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/trips/${createdTripId}/cancel/passenger`) &&
        response.request().method() === "PUT",
      { timeout: 20_000 }
    );

    await pressByTestId(page, "booking-finding-secondary-button");
    const cancelResponse = await cancelResponsePromise;
    expect(cancelResponse.ok()).toBe(true);
    wasCancelledByUi = true;

    expect(pageErrors).toEqual([]);
  } finally {
    if (!wasCancelledByUi) {
      await cancelTripByApi(request, createdTripId, session.accessToken).catch(
        () => {}
      );
    }
  }
});
