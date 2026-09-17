const { test, expect } = require("@playwright/test");

const {
  API_BASE_URL,
  createCustomerSession,
} = require("../helpers/customer-real-backend");

function authHeaders(session) {
  return { Authorization: `Bearer ${session.accessToken}` };
}

test("integration: customer can view my reviews with backend", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );

  const myReviewsResponse = await test.step(
    "Call GET /api/reviews/my with access token",
    async () =>
      request.get(`${API_BASE_URL}/reviews/my`, {
        headers: authHeaders(session),
      })
  );

  await test.step("Verify my reviews API returns 200 OK", async () => {
    expect(myReviewsResponse.ok()).toBe(true);
  });

  await test.step("Verify response body is a review list", async () => {
    const reviews = await myReviewsResponse.json();
    expect(Array.isArray(reviews)).toBe(true);
  });
});

test("integration: create review API rejects invalid rating", async ({
  request,
}) => {
  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );

  const reviewResponse = await test.step(
    "Call POST /api/reviews with rating outside 1-5",
    async () =>
      request.post(`${API_BASE_URL}/reviews`, {
        data: {
          tripId: "00000000-0000-0000-0000-000000000000",
          rating: 0,
          comment: "Invalid rating integration test",
        },
        headers: authHeaders(session),
      })
  );

  await test.step("Verify API returns 400 Bad Request", async () => {
    expect(reviewResponse.status()).toBe(400);
  });
});

test("integration: review API rejects request without access token", async ({
  request,
}) => {
  const myReviewsResponse = await test.step(
    "Call GET /api/reviews/my without access token",
    async () => request.get(`${API_BASE_URL}/reviews/my`)
  );

  await test.step("Verify API returns 401 Unauthorized", async () => {
    expect(myReviewsResponse.status()).toBe(401);
  });
});

test("integration: customer can submit review for prepared completed trip with backend", async ({
  request,
}) => {
  const reviewTripId = process.env.E2E_REVIEW_TRIP_ID;
  test.skip(
    !reviewTripId,
    "Set E2E_REVIEW_TRIP_ID to a completed, not-yet-reviewed trip id to run review creation integration test."
  );

  const session = await test.step("Login with valid customer account", async () =>
    createCustomerSession(test, request)
  );

  const reviewResponse = await test.step(
    "Call POST /api/reviews for prepared completed trip",
    async () =>
      request.post(`${API_BASE_URL}/reviews`, {
        data: {
          tripId: reviewTripId,
          rating: 5,
          comment: `E2E integration review ${Date.now()}`,
        },
        headers: authHeaders(session),
      })
  );

  await test.step("Verify review is submitted successfully", async () => {
    expect(reviewResponse.ok()).toBe(true);
  });

  await test.step("Verify created review contains expected trip id and rating", async () => {
    const review = await reviewResponse.json();
    expect(review.tripId).toBe(reviewTripId);
    expect(review.rating).toBe(5);
  });
});
