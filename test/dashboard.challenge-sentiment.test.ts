import assert from "node:assert/strict";
import test from "node:test";
import {
  getChallengeSentimentStats,
  type DashboardData,
} from "../artifacts/dashboard/src/lib/dashboard-model.ts";

function createDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    netScore: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    objective: 270,
    allTimePositive: 421,
    allTimeNegative: 74,
    allTimeTotal: 498,
    googleTotalReviews: 897,
    googleAvgRating: 4.6,
    trimesterName: "Q2 2026",
    trimesterStart: "2026-04-01",
    trimesterEnd: "2026-06-30",
    recentActivity: [],
    ...overrides,
  };
}

test("getChallengeSentimentStats uses challenge-window sentiment counts directly", () => {
  const stats = getChallengeSentimentStats(
    createDashboardData({
      positive: 7,
      neutral: 4,
      negative: 2,
      allTimePositive: 500,
      allTimeNegative: 90,
      allTimeTotal: 650,
      googleTotalReviews: 1200,
    }),
  );

  assert.deepEqual(stats, {
    positive: 7,
    neutral: 4,
    negative: 2,
  });
});

test("getChallengeSentimentStats returns zeroes when dashboard data is absent", () => {
  assert.deepEqual(getChallengeSentimentStats(null), {
    positive: 0,
    neutral: 0,
    negative: 0,
  });
});
