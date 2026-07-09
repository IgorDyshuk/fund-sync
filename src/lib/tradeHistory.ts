import type { SavedTrade } from "../types/app";

export const TRADE_HISTORY_STORAGE_KEY = "fund-sync:trade-history:v1";

type TradeHistoryStorage = Pick<Storage, "getItem" | "setItem">;

export function loadTradeHistory(
  storage: TradeHistoryStorage | undefined = getBrowserStorage(),
): SavedTrade[] {
  if (!storage) {
    return [];
  }

  try {
    return parseTradeHistory(storage.getItem(TRADE_HISTORY_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveTradeHistory(
  history: SavedTrade[],
  storage: TradeHistoryStorage | undefined = getBrowserStorage(),
) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(TRADE_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage can be unavailable or full; the UI still keeps in-memory history.
  }
}

export function parseTradeHistory(rawValue: string | null): SavedTrade[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedTrade);
  } catch {
    return [];
  }
}

function isSavedTrade(value: unknown): value is SavedTrade {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SavedTrade>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.instructions === "string" &&
    Boolean(candidate.analysis) &&
    Boolean(candidate.calculation)
  );
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
