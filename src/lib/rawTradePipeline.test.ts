import { describe, expect, it } from "vitest";
import {
  buildAnalysisFromRawExtraction,
  normalizeNumber,
  parseManualSpreadPrices,
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

  it("keeps an unsigned manual spot amount raw until the UI confirms its sign", () => {
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [{ symbol: "SOLUSDT", side: "short", realizedPnlUsdt: 62.54 }],
        spotData: { method: "unknown" },
      },
      { instructions: "Spot вышел 10 USDT" },
    );

    expect(analysis.spot.rawPnlUsdt).toBe(10);
    expect(analysis.spot.pnlUsdt).toBeNull();
  });

  it("keeps both futures and spot positive when instructions explicitly say spot plus", () => {
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [
          {
            symbol: "SOLUSDT",
            side: "long",
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
      { instructions: "спот: +16,9 USDT" },
    );

    expect(analysis.spot.pnlUsdt).toBeCloseTo(16.9);
    expect(calculateTrade(analysis).signedSpotPnl).toBeCloseTo(16.9);
    expect(calculateTrade(analysis).netResult).toBeCloseTo(79.44);
  });

  it("uses the signed PNL from a spot summary when futures are also positive", () => {
    const instructions = `PNL (Прибыль): +10.13145 USDT (172.455 USDT получено минус 162.32355 USDT потрачено)
Всего задействовано USDT (сумма покупок): 162.32355 USDT
Средняя цена покупки: 0.002162 USDT
Средняя цена продажи: 0.002299 USDT`;
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [
          {
            symbol: "VANRYUSDT",
            side: "short",
            realizedPnlUsdt: 12.39,
            volumeUsdt: 498.14,
          },
        ],
        spotData: { method: "unknown", manualPnl: 10.13145 },
      },
      { instructions },
    );

    expect(analysis.spot.pnlUsdt).toBeCloseTo(10.13145);
    expect(calculateTrade(analysis).netResult).toBeCloseTo(22.52145);
  });

  it("calculates spot orders from buy cost and sell revenue", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "INUSDT",
          side: "short",
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
    expect(analysis.spread.entry).toBeNull();
    expect(analysis.spread.exit).toBeNull();
    expect(analysis.notes.some((note) => note.includes("Игнорировано"))).toBe(
      true,
    );
  });

  it("calculates weighted spot entry and exit prices for the spread", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "INUSDT",
          side: "short",
          realizedPnlUsdt: 10,
          entryPrice: 10,
          exitPrice: 12,
        },
      ],
      spotData: {
        method: "orders",
        extractedTransactions: [
          { type: "buy", amount: 2, price: 9, totalUsdt: 18 },
          { type: "buy", amount: 1, price: 11, totalUsdt: 11 },
          { type: "sell", amount: 1, price: 13, totalUsdt: 13 },
          { type: "sell", amount: 2, price: 12, totalUsdt: 24 },
        ],
      },
    });

    expect(analysis.spread.entry).toBeCloseTo(
      Math.abs(10 - 29 / 3) / ((10 + 29 / 3) / 2) * 100,
    );
    expect(analysis.spread.exit).toBeCloseTo(
      Math.abs(37 / 3 - 12) / ((37 / 3 + 12) / 2) * 100,
    );
    expect(
      analysis.notes.some((note) => note.includes("Спред входа")),
    ).toBe(true);
    expect(
      analysis.notes.some((note) => note.includes("Спред выхода")),
    ).toBe(true);
  });

  it("makes both spot spread signs negative when spot prices are unfavorable", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ side: "short", entryPrice: 10, exitPrice: 12 }],
      spotData: {
        method: "orders",
        extractedTransactions: [
          { type: "buy", amount: 1, price: 11, totalUsdt: 11 },
          { type: "sell", amount: 1, price: 11, totalUsdt: 11 },
        ],
      },
    });

    expect(analysis.spread.entry).toBeCloseTo(-Math.abs(11 - 10) / 10.5 * 100);
    expect(analysis.spread.exit).toBeCloseTo(-Math.abs(11 - 12) / 11.5 * 100);
  });

  it("does not calculate a spread for spot plus long futures", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ side: "long", entryPrice: 10, exitPrice: 12 }],
      spotData: {
        method: "orders",
        extractedTransactions: [
          { type: "buy", amount: 1, price: 9, totalUsdt: 9 },
          { type: "sell", amount: 1, price: 13, totalUsdt: 13 },
        ],
      },
    });

    expect(analysis.spread.entry).toBeNull();
    expect(analysis.spread.exit).toBeNull();
  });

  it("ignores invalid and transfer rows when calculating spot averages", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [{ side: "short", entryPrice: 10, exitPrice: 12 }],
      spotData: {
        method: "orders",
        extractedTransactions: [
          { type: "buy", amount: 1, price: 9, totalUsdt: 9 },
          { type: "sell", amount: 1, price: 13, totalUsdt: 13 },
          { type: "sell", amount: 100, price: 100, totalUsdt: 1 },
          { type: "deposit", amount: 50, price: 1, totalUsdt: 50 },
        ],
      },
      notes: [],
    });

    expect(analysis.spread.entry).toBeCloseTo(Math.abs(10 - 9) / 9.5 * 100);
    expect(analysis.spread.exit).toBeCloseTo(Math.abs(13 - 12) / 12.5 * 100);
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

  it("keeps a single short futures position as a complete saveable result", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "BTCUSDT",
          side: "short",
          realizedPnlUsdt: -18.42,
          volumeUsdt: 750,
          startedAt: "15.07.2026 10:00",
          endedAt: "15.07.2026 11:30",
        },
      ],
      spotData: { method: "unknown" },
      confidence: 0.98,
    });
    const calculation = calculateTrade(analysis);

    expect(analysis.bundleType).toBe("Фьючерс");
    expect(analysis.legs).toHaveLength(1);
    expect(analysis.legs[0]).toMatchObject({
      type: "futures",
      side: "short",
      symbol: "BTCUSDT",
      volumeUsdt: 750,
      pnlUsdt: -18.42,
    });
    expect(analysis.spot.pnlUsdt).toBeNull();
    expect(calculation.totalVolume).toBe(750);
    expect(calculation.netResult).toBe(-18.42);
    expect(calculation.display.netResult).toBe("-18,42 USDT");
  });

  it("calculates the directional spread for long and short futures", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "BTCUSDT",
          side: "long",
          realizedPnlUsdt: 40,
          coinAmount: 2,
          entryPrice: 100,
          exitPrice: 110,
        },
        {
          symbol: "BTCUSDT",
          side: "short",
          realizedPnlUsdt: -12,
          coinAmount: 1,
          entryPrice: 105,
          exitPrice: 108,
        },
      ],
      spotData: { method: "unknown" },
    });

    expect(analysis.spread.entry).toBeCloseTo(5 / 102.5 * 100);
    expect(analysis.spread.exit).toBeCloseTo(2 / 109 * 100);
  });

  it("makes both futures spread signs negative when long prices are unfavorable", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          side: "long",
          coinAmount: 1,
          entryPrice: 110,
          exitPrice: 105,
        },
        {
          side: "short",
          coinAmount: 1,
          entryPrice: 100,
          exitPrice: 110,
        },
      ],
      spotData: { method: "unknown" },
    });

    expect(analysis.spread.entry).toBeCloseTo(-Math.abs(110 - 100) / 105 * 100);
    expect(analysis.spread.exit).toBeCloseTo(-Math.abs(105 - 110) / 107.5 * 100);
  });

  it("uses localized manual average buy and sell prices for a futures screenshot", () => {
    const instructions = `
      * Средняя цена покупки: **0.002162 USDT**
      * Средняя цена продажи: **0.002299 USDT**
    `;
    const prices = parseManualSpreadPrices(instructions);
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [
          {
            symbol: "VANRYUSDT",
            side: "short",
            realizedPnlUsdt: 10,
            entryPrice: 0.0021,
            exitPrice: 0.0024,
          },
        ],
        spotData: { method: "unknown" },
      },
      { instructions },
    );

    expect(prices.spotBuyPrice).toBeCloseTo(0.002162);
    expect(prices.spotSellPrice).toBeCloseTo(0.002299);
    expect(analysis.spread.entry).toBeCloseTo(
      -Math.abs(0.0021 - 0.002162) / ((0.0021 + 0.002162) / 2) * 100,
    );
    expect(analysis.spread.exit).toBeCloseTo(
      -Math.abs(0.002299 - 0.0024) / ((0.002299 + 0.0024) / 2) * 100,
    );
  });

  it("lets explicit futures entry and exit prices override only those fields", () => {
    const instructions = "futures entry: 101,5; futures exit: 109,25";
    const prices = parseManualSpreadPrices(instructions);
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [
          {
            side: "short",
            entryPrice: 100,
            exitPrice: 110,
          },
        ],
        spotData: {
          method: "orders",
          extractedTransactions: [
            { type: "buy", amount: 1, price: 100, totalUsdt: 100 },
            { type: "sell", amount: 1, price: 111, totalUsdt: 111 },
          ],
        },
      },
      { instructions },
    );

    expect(prices.futuresEntryPrice).toBeCloseTo(101.5);
    expect(prices.futuresExitPrice).toBeCloseTo(109.25);
    expect(analysis.spread.entry).toBeCloseTo(1.5 / 100.75 * 100);
    expect(analysis.spread.exit).toBeCloseTo(1.75 / 110.125 * 100);
  });

  it("uses the complete manual spot summary for volume, PnL, and spread", () => {
    const instructions = `
      - PNL (Прибыль): +10.13145 USDT (172.455 USDT получено минус 162.32355 USDT потрачено)
      - Всего задействовано USDT (сумма покупок): 162.32355 USDT
      - Средняя цена покупки: 0.002162 USDT (162.32355 USDT / 75 078 VANRY)
      - Средняя цена продажи: 0.002299 USDT (172.455 USDT / 75 000 VANRY)
    `;
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [
          {
            symbol: "VANRYUSDT",
            side: "short",
            realizedPnlUsdt: 12.39,
            volumeUsdt: 498.14,
            entryPrice: 0.006642,
            exitPrice: 0.006445,
          },
        ],
        spotData: { method: "unknown" },
      },
      { instructions },
    );
    const calculation = calculateTrade(analysis);
    const prices = parseManualSpreadPrices(instructions);

    expect(analysis.spot.pnlUsdt).toBeCloseTo(10.13145);
    expect(prices.spotVolumeUsdt).toBeCloseTo(162.32355);
    expect(prices.spotRevenueUsdt).toBeCloseTo(172.455);
    expect(prices.spotCostUsdt).toBeCloseTo(162.32355);
    expect(analysis.spot.volumeUsdt).toBeCloseTo(162.32355);
    expect(analysis.spot.revenueUsdt).toBeCloseTo(172.455);
    expect(analysis.spot.costUsdt).toBeCloseTo(162.32355);
    expect(calculation.display.totalVolume).toBe("660,46 USDT");
    expect(analysis.spread.entry).toBeCloseTo(
      Math.abs(0.006642 - 0.002162) / ((0.006642 + 0.002162) / 2) * 100,
    );
    expect(analysis.spread.exit).toBeCloseTo(
      -Math.abs(0.002299 - 0.006445) / ((0.002299 + 0.006445) / 2) * 100,
    );
  });

  it("infers a short side and calculates spread for an unlabeled futures screenshot", () => {
    const instructions = `
      - PNL (Прибыль): +296.621 USDT (2653.325 USDT получено минус 2356.704 USDT потрачено)
      - Всего задействовано USDT (сумма покупок): 2356.704 USDT
      - Средняя цена покупки: 0.020473 USDT (2356.704 USDT / 115 113 ESPORTS)
      - Средняя цена продажи: 0.023072 USDT (2653.325 USDT / 115 000 ESPORTS)
    `;
    const analysis = buildAnalysisFromRawExtraction(
      {
        futuresLegs: [
          {
            symbol: "ESPORTSUSDT",
            side: "unknown",
            realizedPnlUsdt: -288.71,
            coinAmount: 115000,
            entryPrice: 0.0183892,
            exitPrice: 0.021044,
          },
        ],
        spotData: { method: "unknown" },
      },
      { instructions },
    );

    expect(analysis.future.side).toBe("short");
    expect(analysis.legs[0].side).toBe("short");
    expect(analysis.spot.pnlUsdt).toBeCloseTo(296.621);
    expect(analysis.spread.entry).toBeCloseTo(
      -Math.abs(0.020473 - 0.0183892) /
        ((0.020473 + 0.0183892) / 2) *
        100,
    );
    expect(analysis.spread.exit).toBeCloseTo(
      Math.abs(0.023072 - 0.021044) /
        ((0.023072 + 0.021044) / 2) *
        100,
    );
    expect(analysis.notes).toContain(
      "Направление ESPORTSUSDT определено как Short по цене входа, цене закрытия и знаку PnL.",
    );
  });

  it("does not override an explicitly extracted futures side", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "BTCUSDT",
          side: "long",
          realizedPnlUsdt: -10,
          entryPrice: 100,
          exitPrice: 110,
        },
      ],
      spotData: { method: "unknown" },
    });

    expect(analysis.future.side).toBe("long");
    expect(analysis.notes.some((note) => note.includes("определено как"))).toBe(
      false,
    );
  });

  it.each([
    { pnl: 10, entryPrice: 100, exitPrice: 110, expectedSide: "long" },
    { pnl: -10, entryPrice: 100, exitPrice: 110, expectedSide: "short" },
    { pnl: 10, entryPrice: 110, exitPrice: 100, expectedSide: "short" },
    { pnl: -10, entryPrice: 110, exitPrice: 100, expectedSide: "long" },
  ] as const)(
    "infers $expectedSide from pnl $pnl and the entry/exit price direction",
    ({ pnl, entryPrice, exitPrice, expectedSide }) => {
      const analysis = buildAnalysisFromRawExtraction({
        futuresLegs: [
          {
            symbol: "BTCUSDT",
            side: "unknown",
            realizedPnlUsdt: pnl,
            entryPrice,
            exitPrice,
          },
        ],
        spotData: { method: "unknown" },
      });

      expect(analysis.future.side).toBe(expectedSide);
    },
  );

  it("keeps an unknown side when deterministic inference lacks a price", () => {
    const analysis = buildAnalysisFromRawExtraction({
      futuresLegs: [
        {
          symbol: "BTCUSDT",
          side: "unknown",
          realizedPnlUsdt: -10,
          entryPrice: 100,
          exitPrice: null,
        },
      ],
      spotData: { method: "unknown" },
    });

    expect(analysis.future.side).toBe("unknown");
    expect(analysis.spread).toEqual({ entry: null, exit: null });
  });

  it.each([
    { pnl: 0, entryPrice: 100, exitPrice: 110 },
    { pnl: 10, entryPrice: 100, exitPrice: 100 },
  ])(
    "keeps an unknown side for a neutral inference input",
    ({ pnl, entryPrice, exitPrice }) => {
      const analysis = buildAnalysisFromRawExtraction({
        futuresLegs: [
          {
            symbol: "BTCUSDT",
            side: "unknown",
            realizedPnlUsdt: pnl,
            entryPrice,
            exitPrice,
          },
        ],
        spotData: { method: "unknown" },
      });

      expect(analysis.future.side).toBe("unknown");
    },
  );

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

  it("accepts legacy frontend responses without spread", () => {
    const parsed = analysisResponseSchema.safeParse({
      future: { symbol: "BTCUSDT" },
      spot: {},
      legs: [],
      conflicts: [],
      notes: [],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.spread).toBeUndefined();
  });

  it("handles empty raw extraction without throwing", () => {
    const analysis = buildAnalysisFromRawExtraction(null);

    expect(analysis.bundleType).toBeNull();
    expect(analysis.legs).toEqual([]);
    expect(analysis.spot.method).toBe("unknown");
    expect(analysis.spread).toEqual({ entry: null, exit: null });
    expect(analysisResponseSchema.safeParse(analysis).success).toBe(true);
  });
});
