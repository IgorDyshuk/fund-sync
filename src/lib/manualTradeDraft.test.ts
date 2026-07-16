import { describe, expect, it } from "vitest";
import type { AnalysisResponse } from "./analysisSchema";
import {
  createManualTradeDraft,
  mergeEditedTrade,
} from "./manualTradeDraft";
import { calculateTrade } from "./tradeCalculator";
import { createTradeFromCsvDraft } from "./tradeCsvImport";

describe("createManualTradeDraft", () => {
  it("prefills every editable value known for a saved trade", () => {
    const analysis: AnalysisResponse = {
      bundleType: "Фьючерс + Фьючерс",
      spread: { entry: 1.25, exit: -0.75 },
      legs: [
        {
          id: "long",
          type: "futures",
          side: "long",
          symbol: "BTCUSDT",
          startedAt: "15.07.2026 10:00",
          endedAt: "15.07.2026 11:00",
          pnlUsdt: 12.5,
        },
        {
          id: "short",
          type: "futures",
          side: "short",
          symbol: "BTCUSDT",
          startedAt: "15.07.2026 10:00",
          endedAt: "15.07.2026 11:00",
          pnlUsdt: -4.25,
        },
      ],
      future: { symbol: "BTCUSDT" },
      spot: {},
      conflicts: [],
      confidence: 1,
      notes: [
        "Количество монет: 1 250,5.",
        "Значение «Спред принес»: 8,25 USDT.",
      ],
    };

    expect(
      createManualTradeDraft({
        id: "trade-1",
        savedAt: "2026-07-15T11:00:00.000Z",
        analysis,
        calculation: calculateTrade(analysis),
        instructions: "",
      }),
    ).toEqual({
      symbol: "BTCUSDT",
      period: "15.07.2026 10:00 — 11:00",
      quantity: "1 250,5",
      spreadEntry: "1,25",
      spreadExit: "-0,75",
      longPnl: "12,5",
      shortPnl: "-4,25",
      spreadContribution: "8,25 USDT",
      total: "8,25",
    });
  });

  it("uses a spot leg as the long side and leaves unavailable values empty", () => {
    const analysis: AnalysisResponse = {
      bundleType: "Фьючерс + Спот",
      legs: [
        {
          id: "spot",
          type: "spot",
          side: "unknown",
          symbol: "ETHUSDT",
          startedAt: "15.07.2026 12:00",
          endedAt: "15.07.2026 13:00",
          pnlUsdt: 7,
        },
      ],
      future: { symbol: "ETHUSDT" },
      spot: {},
      conflicts: [],
      notes: [],
    };

    const draft = createManualTradeDraft({
      id: "trade-2",
      savedAt: "2026-07-15T13:00:00.000Z",
      analysis,
      calculation: calculateTrade(analysis),
      instructions: "",
    });

    expect(draft.longPnl).toBe("7");
    expect(draft.shortPnl).toBe("");
    expect(draft.quantity).toBe("");
  });

  it("preserves original leg types and volumes while applying edited values", () => {
    const originalAnalysis: AnalysisResponse = {
      bundleType: "Фьючерс + Спот",
      spread: { entry: 1, exit: 2 },
      legs: [
        {
          id: "future-short",
          label: "Short LINKUSDT",
          type: "futures",
          side: "short",
          symbol: "LINKUSDT",
          startedAt: "15.07.2026 10:00",
          endedAt: "15.07.2026 11:00",
          volumeUsdt: 600,
          pnlUsdt: -4,
        },
        {
          id: "spot-long",
          label: "Спот LINKUSDT",
          type: "spot",
          side: "unknown",
          symbol: "LINKUSDT",
          startedAt: "15.07.2026 10:00",
          endedAt: "15.07.2026 11:00",
          volumeUsdt: 400,
          pnlUsdt: 9,
        },
      ],
      future: {
        symbol: "LINKUSDT",
        side: "short",
        startedAt: "15.07.2026 10:00",
        endedAt: "15.07.2026 11:00",
        volumeUsdt: 600,
        realizedPnlUsdt: -4,
      },
      spot: { volumeUsdt: 400, pnlUsdt: 9, rawPnlUsdt: 9 },
      conflicts: [],
      confidence: 0.91,
      notes: [],
    };
    const originalTrade = {
      id: "preserved-id",
      savedAt: "2026-07-15T11:00:00.000Z",
      analysis: originalAnalysis,
      calculation: calculateTrade(originalAnalysis),
      instructions: "",
    };
    const generated = createTradeFromCsvDraft(
      {
        symbol: "LINKUSDT",
        period: "15.07.2026 10:00 — 11:00",
        quantity: "",
        spreadEntry: "1,5",
        spreadExit: "2,5",
        longPnl: "10",
        shortPnl: "-5",
        spreadContribution: "",
        total: "7",
      },
      2,
      { requireTotal: true, allowTotalOnly: true, source: "manual" },
    );
    if ("message" in generated) {
      throw new Error(generated.message);
    }

    const edited = mergeEditedTrade(originalTrade, generated.trade);

    expect(edited.id).toBe("preserved-id");
    expect(edited.analysis.bundleType).toBe("Фьючерс + Спот");
    expect(edited.analysis.confidence).toBe(0.91);
    expect(edited.calculation.totalVolume).toBe(1000);
    expect(edited.calculation.spotVolume).toBe(400);
    expect(edited.calculation.futuresVolume).toBe(600);
    expect(edited.calculation.netResult).toBe(7);
    expect(edited.analysis.legs.map((leg) => leg.type)).toEqual([
      "spot",
      "futures",
    ]);
    expect(edited.analysis.legs.map((leg) => leg.label)).toEqual([
      "Спот LINKUSDT",
      "Short LINKUSDT",
    ]);
  });
});
