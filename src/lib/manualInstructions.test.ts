import { describe, expect, it } from "vitest";
import {
  applyManualInstructionsToAnalysis,
  applyManualSpotSign,
  parseManualSpotOverride,
  parseManualSpotSummary,
} from "./manualInstructions";
import { calculateTrade } from "./tradeCalculator";
import type { AnalysisResponse } from "./analysisSchema";

const baseAnalysis: AnalysisResponse = {
  bundleType: "Фьючерс + Спот",
  legs: [
    {
      id: "future-main",
      label: "Фьючерс",
      type: "futures",
      symbol: "SOLUSDT",
      side: "long",
      startedAt: null,
      endedAt: null,
      volumeUsdt: 1550,
      pnlUsdt: 62.54,
      realizedPnlUsdt: 62.54,
      rawPnlUsdt: null,
      roiPercent: null,
      method: "unknown",
      balanceBeforeUsdt: null,
      balanceAfterUsdt: null,
      revenueUsdt: null,
      costUsdt: null,
    },
    {
      id: "spot-main",
      label: "Спот",
      type: "spot",
      symbol: "SOLUSDT",
      side: "unknown",
      startedAt: null,
      endedAt: null,
      volumeUsdt: 1550,
      pnlUsdt: 99,
      realizedPnlUsdt: null,
      rawPnlUsdt: 99,
      roiPercent: null,
      method: "balance_delta",
      balanceBeforeUsdt: null,
      balanceAfterUsdt: null,
      revenueUsdt: null,
      costUsdt: null,
    },
  ],
  future: {
    symbol: "SOLUSDT",
    side: "long",
    startedAt: null,
    endedAt: null,
    volumeUsdt: 1550,
    roiPercent: null,
    realizedPnlUsdt: 62.54,
  },
  spot: {
    method: "balance_delta",
    volumeUsdt: 1550,
    rawPnlUsdt: 99,
    pnlUsdt: 99,
    balanceBeforeUsdt: null,
    balanceAfterUsdt: null,
    revenueUsdt: null,
    costUsdt: null,
  },
  conflicts: [
    {
      field: "spot.rawPnlUsdt",
      label: "PnL Spot",
      message: "manual/photo mismatch",
      choices: [],
    },
  ],
  confidence: 0.8,
  notes: [],
};

describe("parseManualSpotOverride", () => {
  it("parses raw spot amount from common Russian instruction", () => {
    expect(parseManualSpotOverride("спот считать 15,54 USDT")).toEqual({
      amount: 15.54,
      mode: "raw",
    });
  });

  it("marks an unsigned Spot result for confirmation", () => {
    expect(parseManualSpotOverride("Spot вышел 10 USDT")).toEqual({
      amount: 10,
      mode: "raw",
    });
  });

  it("does not require confirmation when the sign is explicit", () => {
    expect(parseManualSpotOverride("Spot вышел +10 USDT")).toEqual({
      amount: 10,
      mode: "signed",
    });
    expect(parseManualSpotOverride("Spot вышел -10 USDT")).toEqual({
      amount: -10,
      mode: "signed",
    });
  });

  it("parses signed spot amount when sign is explicit", () => {
    expect(parseManualSpotOverride("итог по споту -15,54")).toEqual({
      amount: -15.54,
      mode: "signed",
    });
  });

  it("parses signed spot amount from plus/minus words", () => {
    expect(parseManualSpotOverride("спот минус 15,54")).toEqual({
      amount: -15.54,
      mode: "signed",
    });
    expect(parseManualSpotOverride("спот плюс 15,54")).toEqual({
      amount: 15.54,
      mode: "signed",
    });
  });

  it("parses an explicitly positive spot result in short instructions", () => {
    expect(parseManualSpotOverride("спот: +16,9 USDT")).toEqual({
      amount: 16.9,
      mode: "signed",
    });
  });

  it("parses a positive PNL from a spot summary without the word spot", () => {
    expect(
      parseManualSpotOverride(
        "PNL (Прибыль): +10.13145 USDT (172.455 USDT получено минус 162.32355 USDT потрачено)\nВсего задействовано USDT (сумма покупок): 162.32355 USDT\nСредняя цена покупки: 0.002162 USDT\nСредняя цена продажи: 0.002299 USDT",
      ),
    ).toEqual({
      amount: 10.13145,
      mode: "signed",
    });
  });

  it("parses involved volume, received amount, and spent amount from a spot summary", () => {
    expect(
      parseManualSpotSummary(
        "PNL: +10.13145 USDT (172.455 USDT получено минус 162.32355 USDT потрачено)\nВсего задействовано USDT (сумма покупок): 162.32355 USDT",
      ),
    ).toEqual({
      volumeUsdt: 162.32355,
      revenueUsdt: 172.455,
      costUsdt: 162.32355,
    });
  });
});

describe("applyManualInstructionsToAnalysis", () => {
  it("overrides model spot result with manual raw amount before calculation", () => {
    const patchedAnalysis = applyManualInstructionsToAnalysis(
      baseAnalysis,
      "спот считать 15,54 USDT",
    );
    const result = calculateTrade(patchedAnalysis);

    expect(patchedAnalysis.conflicts).toHaveLength(0);
    expect(patchedAnalysis.spot.method).toBe("manual");
    expect(patchedAnalysis.spot.rawPnlUsdt).toBeCloseTo(15.54);
    expect(patchedAnalysis.spot.pnlUsdt).toBeNull();
    expect(result.signedSpotPnl).toBeCloseTo(-15.54);
    expect(result.netResult).toBeCloseTo(47);
  });

  it("keeps manual signed spot amount as final PnL", () => {
    const patchedAnalysis = applyManualInstructionsToAnalysis(
      baseAnalysis,
      "итог по споту +15,54",
    );
    const result = calculateTrade(patchedAnalysis);

    expect(patchedAnalysis.spot.pnlUsdt).toBeCloseTo(15.54);
    expect(result.signedSpotPnl).toBeCloseTo(15.54);
    expect(result.netResult).toBeCloseTo(78.08);
  });

  it("applies the selected sign to an unsigned spot amount", () => {
    const rawAnalysis = applyManualInstructionsToAnalysis(
      baseAnalysis,
      "Spot вышел 10 USDT",
    );
    const positiveAnalysis = applyManualSpotSign(rawAnalysis, "positive");
    const negativeAnalysis = applyManualSpotSign(rawAnalysis, "negative");

    expect(positiveAnalysis.spot.rawPnlUsdt).toBe(10);
    expect(positiveAnalysis.spot.pnlUsdt).toBe(10);
    expect(positiveAnalysis.legs[1].pnlUsdt).toBe(10);
    expect(negativeAnalysis.spot.rawPnlUsdt).toBe(10);
    expect(negativeAnalysis.spot.pnlUsdt).toBe(-10);
    expect(negativeAnalysis.legs[1].pnlUsdt).toBe(-10);
  });
});
