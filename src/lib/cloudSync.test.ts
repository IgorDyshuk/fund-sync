import { describe, expect, it } from "vitest";
import {
  getAuthErrorMessage,
  mergeTradeHistories,
} from "./cloudSync";
import { hasCompleteFirebaseConfig } from "./firebaseEnv";
import { calculateTrade } from "./tradeCalculator";
import type { SavedTrade } from "../types/app";

describe("cloudSync", () => {
  it("detects an incomplete Firebase config without relying on local env", () => {
    const completeConfig = {
      apiKey: "api-key",
      authDomain: "fund-sync.firebaseapp.com",
      projectId: "fund-sync",
      storageBucket: "fund-sync.firebasestorage.app",
      messagingSenderId: "123",
      appId: "1:123:web:abc",
    };

    expect(hasCompleteFirebaseConfig({})).toBe(false);
    expect(
      hasCompleteFirebaseConfig({ ...completeConfig, apiKey: "" }),
    ).toBe(false);
    expect(hasCompleteFirebaseConfig({ ...completeConfig, appId: "   " })).toBe(
      false,
    );
    expect(hasCompleteFirebaseConfig(completeConfig)).toBe(true);
  });

  it("merges local migration records with cloud data and gives cloud precedence", () => {
    const local = [
      createTrade("shared", "BTCUSDT", "2026-07-14T10:00:00.000Z", 1),
      createTrade("local-only", "ETHUSDT", "2026-07-14T11:00:00.000Z", 2),
    ];
    const cloud = [
      createTrade("shared", "BTCUSDT", "2026-07-14T12:00:00.000Z", 99),
      createTrade("cloud-only", "SOLUSDT", "2026-07-14T13:00:00.000Z", 3),
    ];

    const merged = mergeTradeHistories(cloud, local);

    expect(merged.map((trade) => trade.id)).toEqual([
      "cloud-only",
      "shared",
      "local-only",
    ]);
    expect(merged.find((trade) => trade.id === "shared")?.instructions).toBe(
      "99",
    );
  });

  it("maps common Firebase auth errors to user-facing messages", () => {
    expect(getAuthErrorMessage({ code: "auth/email-already-in-use" })).toBe(
      "Этот email уже зарегистрирован.",
    );
    expect(getAuthErrorMessage({ code: "auth/weak-password" })).toBe(
      "Пароль должен содержать минимум 6 символов.",
    );
    expect(getAuthErrorMessage(new Error("network"))).toBe("network");
    expect(getAuthErrorMessage({ code: "auth/popup-closed-by-user" })).toBe(
      "Вход через Google отменён.",
    );
    expect(getAuthErrorMessage({ code: "auth/unauthorized-domain" })).toBe(
      "Этот домен не разрешён в Firebase Authentication.",
    );
  });
});

function createTrade(
  id: string,
  symbol: string,
  savedAt: string,
  instructions: number,
): SavedTrade {
  const analysis = {
    bundleType: "Фьючерс + Спот",
    future: { symbol, volumeUsdt: 1000, realizedPnlUsdt: 10 },
    spot: { volumeUsdt: 1000, rawPnlUsdt: 5 },
    legs: [],
    conflicts: [],
    notes: [],
  };

  return {
    id,
    savedAt,
    instructions: String(instructions),
    analysis,
    calculation: calculateTrade(analysis),
  };
}
