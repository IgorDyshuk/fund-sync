// @vitest-environment jsdom

import Papa from "papaparse";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisResponse } from "./analysisSchema";
import type { SavedTrade } from "../types/app";
import { createAnalyticsRange } from "./monthlyAnalytics";
import { calculateTrade } from "./tradeCalculator";
import {
  createTradeCsvExport,
  downloadTradeCsvExport,
  tradeCsvExportColumns,
} from "./tradeCsvExport";
import { parseTradeCsv } from "./tradeCsvImport";

describe("trade CSV export", () => {
  it("keeps the CSV contract when the selected period has no trades", () => {
    const result = createTradeCsvExport(
      [],
      createAnalyticsRange("month", new Date(2026, 6, 15)),
    );
    const parsed = Papa.parse<Record<string, string>>(result.csv, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, ""),
    });

    expect(result.tradeCount).toBe(0);
    expect(result.fileName).toBe("fund-sync-2026-07.csv");
    expect(parsed.meta.fields).toEqual(tradeCsvExportColumns);
    expect(parsed.data).toEqual([]);
  });

  it("exports only trades closed inside the selected range", () => {
    const julyTrade = createTrade("july", "BTCUSDT", "15.07.2026 12:00", 15.8);
    const juneTrade = createTrade("june", "ETHUSDT", "30.06.2026 12:00", 8);

    const result = createTradeCsvExport(
      [juneTrade, julyTrade],
      createAnalyticsRange("month", new Date(2026, 6, 15)),
    );
    const parsed = Papa.parse<Record<string, string>>(result.csv, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      transformHeader: (header) => header.replace(/^\uFEFF/, ""),
    });

    expect(result.tradeCount).toBe(1);
    expect(result.fileName).toBe("fund-sync-2026-07.csv");
    expect(parsed.meta.fields).toEqual(tradeCsvExportColumns);
    expect(parsed.data[0]).toMatchObject({
      "Монета": "BTCUSDT",
      "Итого (USDT)": "15,8",
    });
  });

  it("preserves optional values and produces an import-compatible file", () => {
    const trade = createTrade("round-trip", "INUSDT", "09.07.2026 12:07", 15.8, {
      quantity: "10000",
      spreadEntry: 30.92,
      spreadExit: -29.84,
      longPnl: 319.44,
      shortPnl: -303.64,
    });
    const result = createTradeCsvExport(
      [trade],
      createAnalyticsRange("month", new Date(2026, 6, 9)),
    );
    const imported = parseTradeCsv(result.csv);

    expect(imported.issues).toEqual([]);
    expect(imported.trades).toHaveLength(1);
    expect(imported.trades[0].calculation.symbol).toBe("INUSDT");
    expect(imported.trades[0].calculation.netResult).toBeCloseTo(15.8);
    expect(imported.trades[0].calculation.spreadEntry).toBeCloseTo(30.92);
    expect(imported.trades[0].calculation.spreadExit).toBeCloseTo(-29.84);
  });

  it("creates and revokes a browser download URL", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:history");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi
      .spyOn(window.HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadTradeCsvExport({
      csv: "data",
      fileName: "history.csv",
      tradeCount: 1,
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:history");
  });
});

function createTrade(
  id: string,
  symbol: string,
  endedAt: string,
  netResult: number,
  optional: {
    quantity?: string;
    spreadEntry?: number;
    spreadExit?: number;
    longPnl?: number;
    shortPnl?: number;
  } = {},
): SavedTrade {
  const startedAt = endedAt.replace(/(\d{2}:)(\d{2})$/, "$100");
  const legs: AnalysisResponse["legs"] = [];
  if (optional.longPnl !== undefined) {
    legs.push({
      id: "long",
      label: `Long ${symbol}`,
      type: "futures",
      symbol,
      side: "long",
      startedAt,
      endedAt,
      volumeUsdt: null,
      pnlUsdt: optional.longPnl,
    });
  }
  if (optional.shortPnl !== undefined) {
    legs.push({
      id: "short",
      label: `Short ${symbol}`,
      type: "futures",
      symbol,
      side: "short",
      startedAt,
      endedAt,
      volumeUsdt: null,
      pnlUsdt: optional.shortPnl,
    });
  }
  if (legs.length === 0) {
    legs.push({
      id: "total",
      label: "Ручной итог",
      type: "unknown",
      symbol,
      side: "unknown",
      startedAt,
      endedAt,
      volumeUsdt: null,
      pnlUsdt: netResult,
    });
  }
  const analysis = {
    bundleType: legs.length > 1 ? "Фьючерс + Фьючерс" : "Ручной итог",
    spread: {
      entry: optional.spreadEntry ?? null,
      exit: optional.spreadExit ?? null,
    },
    legs,
    future: { symbol, startedAt, endedAt },
    spot: {},
    conflicts: [],
    notes: optional.quantity
      ? [`Количество монет: ${optional.quantity}.`]
      : [],
  };
  const calculated = calculateTrade(analysis);

  return {
    id,
    savedAt: toIsoDate(endedAt),
    analysis,
    calculation: {
      ...calculated,
      netResult,
      isProfitable: netResult >= 0,
      display: {
        ...calculated.display,
        netResult: `${String(netResult).replace(".", ",")} USDT`,
      },
    },
    instructions: "",
  };
}

function toIsoDate(value: string) {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/);
  if (!match) {
    throw new Error("Invalid test date");
  }
  const [, day, month, year, hours, minutes] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
  ).toISOString();
}
