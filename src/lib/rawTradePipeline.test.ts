import { describe, expect, it } from "vitest";
import {
  buildAnalysisFromRawExtraction,
  normalizeNumber,
} from "../../server/rawTradePipeline";
import { analysisResponseSchema } from "./analysisSchema";
import { calculateTrade } from "./tradeCalculator";

describe("buildAnalysisFromRawExtraction", () => {
  it("normalizes common Russian and US number formats", () => {
    expect(normalizeNumber("1 234,56")).toBeCloseTo(1234.56);
    expect(normalizeNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(normalizeNumber("1,234.56")).toBeCloseTo(1234.56);
    expect(normalizeNumber("−15,54")).toBeCloseTo(-15.54);
    expect(normalizeNumber("(15.54)")).toBeCloseTo(-15.54);
  });

  it("keeps manual signed spot PnL as the highest priority", () => {
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [
          {
            symbol: "SOLUSDT",
            side: "short",
            realizedPnlUsdt: 62.54,
            volumeUsdt: 1550,
          },
        ],
        spotData: {
          method: "orders",
          extractedTransactions: [
            { type: "buy", symbol: "SOLUSDT", totalUsdt: 1550 },
            { type: "sell", symbol: "SOLUSDT", totalUsdt: 1534.46 },
          ],
        },
      },
      { instructions: "итог по споту -15,54 USDT" },
    );

    expect(analysis.spot.method).toBe("manual");
    expect(analysis.spot.rawPnlUsdt).toBeCloseTo(15.54);
    expect(analysis.spot.pnlUsdt).toBeCloseTo(-15.54);
    expect(calculateTrade(analysis).netResult).toBeCloseTo(47);
  });

  it("calculates spot orders from buy cost and sell revenue", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "INUSDT",
          side: "long",
          realizedPnlUsdt: 100,
          volumeUsdt: 1000,
        },
      ],
      spotData: {
        method: "orders",
        extractedTransactions: [
          {
            type: "buy",
            symbol: "INUSDT",
            amount: 10,
            price: 100,
            totalUsdt: 1000,
          },
          {
            type: "sell",
            symbol: "INUSDT",
            amount: 10,
            price: 101.5,
            totalUsdt: 1015,
          },
        ],
        ignoredTransactions: [
          {
            type: "deposit",
            symbol: "USDT",
            amount: 1000,
            price: 1,
            totalUsdt: 1000,
          },
        ],
      },
    });

    expect(analysis.spot.method).toBe("orders");
    expect(analysis.spot.costUsdt).toBe(1000);
    expect(analysis.spot.revenueUsdt).toBe(1015);
    expect(analysis.spot.rawPnlUsdt).toBe(15);
    expect(analysis.spot.pnlUsdt).toBe(-15);
    expect(analysis.notes.some((note) => note.includes("Игнорировано"))).toBe(
      true,
    );
  });

  it("excludes an order when amount times price conflicts with total", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ symbol: "INUSDT", side: "long", realizedPnlUsdt: 100 }],
      spotData: {
        method: "orders",
        extractedTransactions: [
          { type: "buy", amount: 10, price: 100, totalUsdt: 1000 },
          { type: "sell", amount: 10, price: 101.5, totalUsdt: 900 },
        ],
      },
    });

    expect(analysis.spot.rawPnlUsdt).toBeNull();
    expect(
      analysis.notes.some((note) => note.includes("Исключено ордеров")),
    ).toBe(true);
  });

  it("derives missing spot order total from amount and price", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ symbol: "INUSDT", side: "long", realizedPnlUsdt: 100 }],
      spotData: {
        method: "orders",
        extractedTransactions: [
          { type: "buy", amount: 10, price: 100, totalUsdt: null },
          { type: "sell", amount: 10, price: 101.5, totalUsdt: null },
        ],
      },
    });

    expect(analysis.spot.costUsdt).toBe(1000);
    expect(analysis.spot.revenueUsdt).toBe(1015);
    expect(analysis.spot.rawPnlUsdt).toBe(15);
    expect(
      analysis.notes.some((note) => note.includes("Рассчитан totalUsdt")),
    ).toBe(true);
  });

  it("calculates futures volume from coin amount and entry price", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "INUSDT",
          side: "long",
          realizedPnlUsdt: 10,
          volumeUsdt: null,
          coinAmount: 123.45,
          entryPrice: 2,
        },
      ],
      spotData: { method: "unknown" },
    });

    expect(analysis.future.volumeUsdt).toBeCloseTo(246.9);
    expect(analysis.legs[0].volumeUsdt).toBeCloseTo(246.9);
    expect(calculateTrade(analysis).display.futuresVolume).toBe("246,90 USDT");
  });

  it("does not count ignored deposits or withdrawals as spot PnL", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ symbol: "BTCUSDT", side: "long", realizedPnlUsdt: -30 }],
      spotData: {
        method: "orders",
        extractedTransactions: [],
        ignoredTransactions: [
          { type: "deposit", symbol: "USDT", totalUsdt: 5000 },
          { type: "withdrawal", symbol: "USDT", totalUsdt: 4900 },
        ],
      },
    });

    expect(analysis.spot.rawPnlUsdt).toBeNull();
    expect(analysis.spot.pnlUsdt).toBeNull();
    expect(analysis.legs).toHaveLength(1);
  });

  it("calculates balance delta and applies hedge sign from negative futures PnL", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ symbol: "ETHUSDT", side: "short", realizedPnlUsdt: -50 }],
      spotData: {
        method: "balance_delta",
        balanceBeforeUsdt: 1000,
        balanceAfterUsdt: 980,
      },
    });

    expect(analysis.spot.rawPnlUsdt).toBe(20);
    expect(analysis.spot.pnlUsdt).toBe(20);
    expect(calculateTrade(analysis).netResult).toBe(-30);
  });

  it("generates a conflict when orders and balance delta differ by more than 1%", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ symbol: "SOLUSDT", side: "long", realizedPnlUsdt: 100 }],
      spotData: {
        method: "orders",
        balanceBeforeUsdt: 1000,
        balanceAfterUsdt: 980,
        extractedTransactions: [
          { type: "buy", symbol: "SOLUSDT", totalUsdt: 1000 },
          { type: "sell", symbol: "SOLUSDT", totalUsdt: 990 },
        ],
      },
    });

    expect(analysis.spot.rawPnlUsdt).toBe(10);
    expect(analysis.conflicts).toHaveLength(1);
    expect(analysis.conflicts[0].field).toBe("legs.1.rawPnlUsdt");
    expect(analysis.conflicts[0].choices.map((choice) => choice.value)).toEqual(
      [10, 20],
    );
  });

  it("keeps futures plus futures bundles compatible with existing calculation", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "BTCUSDT",
          side: "long",
          realizedPnlUsdt: 40,
          volumeUsdt: 1000,
        },
        {
          symbol: "ETHUSDT",
          side: "short",
          realizedPnlUsdt: -12,
          volumeUsdt: 900,
        },
      ],
      spotData: { method: "unknown" },
    });
    const calculation = calculateTrade(analysis);

    expect(analysis.bundleType).toBe("Фьючерс + Фьючерс");
    expect(analysis.legs).toHaveLength(2);
    expect(calculation.netResult).toBe(28);
    expect(calculation.display.totalVolume).toBe("1 900,00 USDT");
  });

  it("returns a payload accepted by the frontend analysis schema", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ symbol: "SOLUSDT", side: "long", realizedPnlUsdt: 10 }],
      spotData: { method: "unknown" },
      confidence: 0.91,
    });

    const parsed = analysisResponseSchema.safeParse(analysis);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.confidence).toBe(0.91);
  });

  it("handles empty raw extraction without throwing", () => {
    const analysis = buildAnalysisFromRawExtraction(null);

    expect(analysis.bundleType).toBeNull();
    expect(analysis.legs).toEqual([]);
    expect(analysis.spot.method).toBe("unknown");
    expect(analysisResponseSchema.safeParse(analysis).success).toBe(true);
  });
});
