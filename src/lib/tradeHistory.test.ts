import { describe, expect, it } from "vitest";
import {
  loadTradeHistory,
  parseTradeHistory,
  saveTradeHistory,
  TRADE_HISTORY_STORAGE_KEY,
} from "./tradeHistory";
import { calculateTrade } from "./tradeCalculator";
import type { SavedTrade } from "../types/app";

describe("tradeHistory", () => {
  it("stores and restores saved trades", () => {
    const storage = createMemoryStorage();
    const trade = createSavedTrade();

    saveTradeHistory([trade], storage);

    expect(loadTradeHistory(storage)).toEqual([trade]);
    expect(storage.values[TRADE_HISTORY_STORAGE_KEY]).toContain("BTCUSDT");
  });

  it("returns empty history for corrupted storage", () => {
    expect(parseTradeHistory("{bad json")).toEqual([]);
    expect(parseTradeHistory(JSON.stringify({ items: [] }))).toEqual([]);
  });

  it("does not throw when storage is unavailable", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };

    expect(loadTradeHistory(storage)).toEqual([]);
    expect(() => saveTradeHistory([createSavedTrade()], storage)).not.toThrow();
  });
});

function createSavedTrade(): SavedTrade {
  return {
    id: "trade-1",
    savedAt: "2026-07-09T10:00:00.000Z",
    instructions: "",
    analysis: {
      bundleType: "Фьючерс + Спот",
      legs: [],
      future: { symbol: "BTCUSDT", realizedPnlUsdt: 100, volumeUsdt: 1000 },
      spot: { rawPnlUsdt: 20, volumeUsdt: 1000 },
      conflicts: [],
      confidence: 0.9,
      notes: [],
    },
    calculation: calculateTrade({
      future: { symbol: "BTCUSDT", realizedPnlUsdt: 100, volumeUsdt: 1000 },
      spot: { rawPnlUsdt: 20, volumeUsdt: 1000 },
    }),
  };
}

function createMemoryStorage() {
  const values: Record<string, string> = {};

  return {
    values,
    getItem(key: string) {
      return values[key] ?? null;
    },
    setItem(key: string, value: string) {
      values[key] = value;
    },
  };
}
