import assert from "node:assert/strict";
import test from "node:test";
import {
  HARDCODED_DASHBOARD,
  mergeDashboardData,
  type DashboardSnapshot,
} from "../artifacts/api-server/src/services/dashboard-merge.ts";

function createSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    ...HARDCODED_DASHBOARD,
    provider: "database",
    updatedAt: "2026-04-12T10:00:00.000Z",
    recentActivity: [],
    ...overrides,
  };
}

test("mergeDashboardData preserves zero challenge counts while falling back all-time totals", () => {
  const merged = mergeDashboardData(
    createSnapshot({
      netScore: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      allTimePositive: 12,
      allTimeNegative: 4,
      allTimeTotal: 16,
      allTimeAvgRating: 4,
      googleTotalReviews: 897,
      googleAvgRating: 4.6,
    }),
  );

  assert.equal(merged.positive, 0);
  assert.equal(merged.neutral, 0);
  assert.equal(merged.negative, 0);
  assert.equal(merged.netScore, 0);
  assert.equal(merged.allTimeTotal, HARDCODED_DASHBOARD.allTimeTotal);
  assert.equal(merged.allTimePositive, HARDCODED_DASHBOARD.allTimePositive);
  assert.equal(merged.provider, "database");
});

test("mergeDashboardData exposes reliable challenge and all-time db data when seeded enough", () => {
  const merged = mergeDashboardData(
    createSnapshot({
      netScore: 6,
      positive: 8,
      neutral: 3,
      negative: 2,
      totalFetched: 213,
      allTimePositive: 150,
      allTimeNegative: 33,
      allTimeTotal: 220,
      allTimeAvgRating: 4.2,
      googleTotalReviews: 920,
      googleAvgRating: 4.7,
      recentActivity: [
        {
          rating: 5,
          isoDate: "2026-04-11T09:00:00.000Z",
          text: "Muy buen trato",
          author: "Cliente",
        },
      ],
    }),
  );

  assert.equal(merged.positive, 8);
  assert.equal(merged.neutral, 3);
  assert.equal(merged.negative, 2);
  assert.equal(merged.netScore, 6);
  assert.equal(merged.allTimeTotal, 220);
  assert.equal(merged.allTimePositive, 150);
  assert.equal(merged.googleTotalReviews, 920);
  assert.equal(merged.provider, "database");
  assert.deepEqual(merged.recentActivity, [
    {
      rating: 5,
      isoDate: "2026-04-11T09:00:00.000Z",
      text: "Muy buen trato",
      author: "Cliente",
    },
  ]);
});
