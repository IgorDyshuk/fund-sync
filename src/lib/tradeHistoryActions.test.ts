import { describe, expect, it } from "vitest";
import {
  prependSavedTrade,
  removeSavedTrade,
} from "./tradeHistoryActions";
import { calculateTrade } from "./tradeCalculator";
import type { SavedTrade } from "../types/app";

describe("tradeHistoryActions", () => {
  it("prepends a completed trade without mutating the existing history", () => {
    const existing = [createTrade("old")];
    const next = prependSavedTrade(existing, createTrade("new"));

    expect(next.map((trade) => trade.id)).toEqual(["new", "old"]);
    expect(existing.map((trade) => trade.id)).toEqual(["old"]);
  });

  it("does not duplicate a trade already delivered by cloud sync", () => {
    const cloudTrade = createTrade("shared");
    const savedTrade = {
      ...cloudTrade,
      instructions: "latest local value",
    };

    const next = prependSavedTrade([cloudTrade, createTrade("old")], savedTrade);

    expect(next.map((trade) => trade.id)).toEqual(["shared", "old"]);
    expect(next[0].instructions).toBe("latest local value");
  });

  it("removes only the requested trade", () => {
    const history = [createTrade("first"), createTrade("second")];

    expect(removeSavedTrade(history, "first").map((trade) => trade.id)).toEqual([
      "second",
    ]);
    expect(removeSavedTrade(history, "missing")).toEqual(history);
  });

});

function createTrade(id: string): SavedTrade {
  const analysis = {
    bundleType: "Фьючерс + Спот",
    future: { symbol: "BTCUSDT", volumeUsdt: 1000, realizedPnlUsdt: 10 },
    spot: { volumeUsdt: 1000, rawPnlUsdt: 5 },
    legs: [],
    conflicts: [],
    notes: [],
  };

  return {
    id,
    savedAt: "2026-07-14T12:00:00.000Z",
    instructions: "",
    analysis,
    calculation: calculateTrade(analysis),
  };
}
