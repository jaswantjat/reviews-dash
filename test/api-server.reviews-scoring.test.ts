import assert from "node:assert/strict";
import test from "node:test";
import { scoreReviews } from "../artifacts/api-server/src/services/reviews.ts";

test("scoreReviews counts challenge-window positive, neutral, and negative reviews", () => {
  const result = scoreReviews(
    [
      { rating: 5, isoDate: "2026-03-31T23:59:59Z" },
      { rating: 5, isoDate: "2026-04-01T00:00:00Z" },
      { rating: 3, isoDate: "2026-05-10T12:30:00Z" },
      { rating: 1, isoDate: "2026-06-30T23:59:59Z" },
      { rating: 2, isoDate: "2026-07-01T00:00:00Z" },
    ],
    "2026-04-01",
    "2026-06-30",
    ["April", "May", "June"],
  );

  assert.equal(result.totalPositive, 1);
  assert.equal(result.totalNeutral, 1);
  assert.equal(result.totalNegative, 1);
  assert.deepEqual(result.monthlyBreakdown, [
    { month: "April", positive: 1, negative: 0, net: 1 },
    { month: "May", positive: 0, negative: 0, net: 0 },
    { month: "June", positive: 0, negative: 1, net: -1 },
  ]);
});

test("scoreReviews excludes out-of-window reviews from challenge totals", () => {
  const result = scoreReviews(
    [
      { rating: 4, isoDate: "2026-03-15T10:00:00Z" },
      { rating: 3, isoDate: "2026-07-15T10:00:00Z" },
      { rating: 1, isoDate: "2026-08-15T10:00:00Z" },
    ],
    "2026-04-01",
    "2026-06-30",
    ["April", "May", "June"],
  );

  assert.equal(result.totalPositive, 0);
  assert.equal(result.totalNeutral, 0);
  assert.equal(result.totalNegative, 0);
  assert.deepEqual(result.monthlyBreakdown, [
    { month: "April", positive: 0, negative: 0, net: 0 },
    { month: "May", positive: 0, negative: 0, net: 0 },
    { month: "June", positive: 0, negative: 0, net: 0 },
  ]);
});
