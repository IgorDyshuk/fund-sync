import { describe, expect, it } from "vitest";
import type { AnalysisResponse } from "./analysisSchema";
import {
  createAnalyticsRange,
  createAnalyticsSeries,
  createCustomAnalyticsRange,
  createMonthlySeries,
  createMonthlyCoinSeries,
  createMonthlyTradeSummary,
  getMonthlyCoinTrades,
  getAnalyticsRangeTrades,
  normalizeAnalyticsSymbol,
  shiftAnalyticsRange,
} from "./monthlyAnalytics";
import { calculateTrade } from "./tradeCalculator";
import type { SavedTrade } from "../types/app";

describe("monthlyAnalytics", () => {
  it("groups repeated symbols and sums their net results", () => {
    const summary = createMonthlyTradeSummary(
      [
        createTrade("first", "BTCUSDT", 10, "05.07.2026 10:00"),
        createTrade("second", "BTCUSDT", -3, "12.07.2026 11:00"),
        createTrade("third", "ETHUSDT", 5, "13.07.2026 12:00"),
      ],
      new Date(2026, 6, 1),
    );

    expect(summary.totalResult).toBe(12);
    expect(summary.tradeCount).toBe(3);
    expect(summary.coins).toHaveLength(2);
    expect(summary.coins[0]).toMatchObject({
      symbol: "BTCUSDT",
      result: 7,
      tradeCount: 2,
    });
    expect(summary.coins[1]).toMatchObject({
      symbol: "ETHUSDT",
      result: 5,
      tradeCount: 1,
    });
  });

  it("uses the closing month and ignores the opening and saving dates", () => {
    const july = createMonthlyTradeSummary(
      [
        createTrade(
          "cross-month",
          "SOLUSDT",
          15,
          "01.07.2026 00:05",
          "30.06.2026 23:50",
          "2026-06-30T20:00:00.000Z",
        ),
      ],
      new Date(2026, 6, 1),
    );
    const june = createMonthlyTradeSummary(
      [
        createTrade(
          "cross-month",
          "SOLUSDT",
          15,
          "01.07.2026 00:05",
          "30.06.2026 23:50",
          "2026-06-30T20:00:00.000Z",
        ),
      ],
      new Date(2026, 5, 1),
    );

    expect(july.totalResult).toBe(15);
    expect(july.tradeCount).toBe(1);
    expect(june.tradeCount).toBe(0);
  });

  it("tracks losses and calculates shares from absolute contribution", () => {
    const summary = createMonthlyTradeSummary(
      [
        createTrade("profit", "INUSDT", 30, "10.07.2026 10:00"),
        createTrade("loss", "TAIKOUSDT", -10, "11.07.2026 10:00"),
      ],
      new Date(2026, 6, 1),
    );

    expect(summary.totalResult).toBe(20);
    expect(summary.positiveResult).toBe(30);
    expect(summary.negativeResult).toBe(-10);
    expect(summary.contributionTotal).toBe(40);
    expect(summary.coins[0].sharePercent).toBe(75);
    expect(summary.coins[1].sharePercent).toBe(25);
  });

  it("sorts coin results by signed value instead of absolute size", () => {
    const summary = createMonthlyTradeSummary(
      [
        createTrade("large-loss", "LOSS73USDT", -73, "10.07.2026 10:00"),
        createTrade("profit", "PROFIT63USDT", 63, "11.07.2026 10:00"),
        createTrade("small-loss", "LOSS5USDT", -5, "12.07.2026 10:00"),
        createTrade("zero", "ZEROUSDT", 0, "13.07.2026 10:00"),
      ],
      new Date(2026, 6, 1),
    );

    expect(summary.coins.map((coin) => [coin.symbol, coin.result])).toEqual([
      ["PROFIT63USDT", 63],
      ["ZEROUSDT", 0],
      ["LOSS5USDT", -5],
      ["LOSS73USDT", -73],
    ]);
  });

  it("creates a chronological series ending at the selected month", () => {
    const series = createMonthlySeries([], new Date(2026, 6, 1), 3);

    expect(series.map((month) => month.key)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
  });

  it("keeps the chronological order across a year boundary", () => {
    const series = createMonthlySeries([], new Date(2027, 0, 1), 4);

    expect(series.map((month) => month.key)).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
      "2027-01",
    ]);
  });

  it("creates exact day, quarter and year boundaries", () => {
    const day = createAnalyticsRange("day", new Date(2026, 6, 16, 15, 30));
    const quarter = createAnalyticsRange(
      "quarter",
      new Date(2026, 6, 16),
    );
    const year = createAnalyticsRange("year", new Date(2026, 6, 16));

    expect(day.start).toEqual(new Date(2026, 6, 16, 0, 0, 0, 0));
    expect(day.end).toEqual(new Date(2026, 6, 16, 23, 59, 59, 999));
    expect(quarter.start).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(quarter.end).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
    expect(quarter.label).toBe("III квартал 2026 г.");
    expect(year.start).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(year.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  it("includes both custom range boundary dates", () => {
    const range = createCustomAnalyticsRange(
      new Date(2026, 6, 10),
      new Date(2026, 6, 12),
    );
    const trades = [
      createTrade("before", "BTCUSDT", 1, "09.07.2026 23:59"),
      createTrade("start", "BTCUSDT", 2, "10.07.2026 00:00"),
      createTrade("end", "BTCUSDT", 3, "12.07.2026 23:59:59"),
      createTrade("after", "BTCUSDT", 4, "13.07.2026 00:00"),
    ];

    expect(getAnalyticsRangeTrades(trades, range).map((trade) => trade.id)).toEqual([
      "start",
      "end",
    ]);
  });

  it("creates seven adjacent periods for every stable timeframe", () => {
    const ending = new Date(2026, 6, 16);

    expect(
      createAnalyticsSeries([], "day", ending).map((period) => period.key),
    ).toEqual([
      "day:2026-07-10",
      "day:2026-07-11",
      "day:2026-07-12",
      "day:2026-07-13",
      "day:2026-07-14",
      "day:2026-07-15",
      "day:2026-07-16",
    ]);
    expect(
      createAnalyticsSeries([], "quarter", ending).map((period) => period.key),
    ).toEqual([
      "quarter:2025-1",
      "quarter:2025-2",
      "quarter:2025-3",
      "quarter:2025-4",
      "quarter:2026-1",
      "quarter:2026-2",
      "quarter:2026-3",
    ]);
    expect(
      createAnalyticsSeries([], "year", ending).map((period) => period.key),
    ).toEqual([
      "year:2020",
      "year:2021",
      "year:2022",
      "year:2023",
      "year:2024",
      "year:2025",
      "year:2026",
    ]);
  });

  it("shifts standard ranges by their own duration", () => {
    expect(
      shiftAnalyticsRange(
        createAnalyticsRange("day", new Date(2026, 6, 16)),
        -1,
      ).key,
    ).toBe("day:2026-07-15");
    expect(
      shiftAnalyticsRange(
        createAnalyticsRange("quarter", new Date(2026, 6, 16)),
        -1,
      ).key,
    ).toBe("quarter:2026-2");
    expect(
      shiftAnalyticsRange(
        createAnalyticsRange("year", new Date(2026, 6, 16)),
        -1,
      ).key,
    ).toBe("year:2025");
  });

  it("ignores trades without a valid closing date or finite result", () => {
    const invalidDate = createTrade("invalid-date", "BTCUSDT", 10, "-");
    const invalidResult = createTrade(
      "invalid-result",
      "ETHUSDT",
      12,
      "05.07.2026 10:00",
    );
    invalidResult.calculation.netResult = Number.NaN;

    const summary = createMonthlyTradeSummary(
      [invalidDate, invalidResult],
      new Date(2026, 6, 1),
    );

    expect(summary.tradeCount).toBe(0);
    expect(summary.totalResult).toBe(0);
    expect(summary.coins).toEqual([]);
  });

  it("normalizes combined and lowercase symbols before grouping", () => {
    const first = createTrade("combined", "BTCUSDT", 10, "05.07.2026 10:00");
    const second = createTrade("lowercase", "BTCUSDT", 5, "06.07.2026 10:00");
    first.calculation.symbol = " btcusdt / BTCUSDT ";
    second.calculation.symbol = "btcusdt";

    const summary = createMonthlyTradeSummary(
      [first, second],
      new Date(2026, 6, 1),
    );

    expect(summary.coins).toEqual([
      {
        symbol: "BTCUSDT",
        result: 15,
        tradeCount: 2,
        sharePercent: 100,
      },
    ]);
    expect(normalizeAnalyticsSymbol(" ethusdt / ETHUSDT ")).toBe("ETHUSDT");
  });

  it("filters a coin page by symbol and closing month", () => {
    const trades = [
      createTrade("july-btc", "BTCUSDT", 10, "05.07.2026 10:00"),
      createTrade("june-btc", "BTCUSDT", 7, "30.06.2026 10:00"),
      createTrade("july-eth", "ETHUSDT", 5, "05.07.2026 10:00"),
    ];

    expect(
      getMonthlyCoinTrades(trades, "BTCUSDT", new Date(2026, 6, 1)).map(
        (trade) => trade.id,
      ),
    ).toEqual(["july-btc"]);
  });

  it("creates a seven-month result series for one coin", () => {
    const series = createMonthlyCoinSeries(
      [
        createTrade("may", "BTCUSDT", 4, "12.05.2026 10:00"),
        createTrade("june", "BTCUSDT", -2, "12.06.2026 10:00"),
        createTrade("july", "BTCUSDT", 7, "12.07.2026 10:00"),
        createTrade("other", "ETHUSDT", 100, "12.07.2026 10:00"),
      ],
      "BTCUSDT",
      new Date(2026, 6, 1),
    );

    expect(series).toHaveLength(7);
    expect(series.map((point) => point.key)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
    expect(series.map((point) => point.result)).toEqual([0, 0, 0, 0, 4, -2, 7]);
    expect(series.map((point) => point.tradeCount)).toEqual([0, 0, 0, 0, 1, 1, 1]);
  });
});

function createTrade(
  id: string,
  symbol: string,
  netResult: number,
  endedAt: string,
  startedAt = "01.07.2026 09:00",
  savedAt = "2026-07-01T10:00:00.000Z",
): SavedTrade {
  const analysis: AnalysisResponse = {
    bundleType: "Фьючерс",
    legs: [
      {
        id: `${id}-leg`,
        type: "futures",
        side: "short",
        symbol,
        startedAt,
        endedAt,
        pnlUsdt: netResult,
      },
    ],
    future: { symbol, startedAt, endedAt, realizedPnlUsdt: netResult },
    spot: {},
    conflicts: [],
    notes: [],
  };
  const calculation = calculateTrade(analysis);

  return {
    id,
    savedAt,
    analysis,
    calculation: {
      ...calculation,
      netResult,
      isProfitable: netResult >= 0,
      display: { ...calculation.display, netResult: `${netResult} USDT` },
    },
    instructions: "",
  };
}
