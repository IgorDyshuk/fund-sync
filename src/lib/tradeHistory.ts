import type { SavedTrade } from "../types/app";
import { analysisResponseSchema } from "./analysisSchema";

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

  const hasValidAnalysis = hasRequiredAnalysisShape(candidate.analysis);
  const calculation = candidate.calculation;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.instructions === "string" &&
    hasValidAnalysis &&
    isTradeCalculationShape(calculation)
  );
}

function hasRequiredAnalysisShape(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const analysis = value as Record<string, unknown>;
  if (
    !analysisResponseSchema.safeParse(value).success ||
    !analysis.future ||
    typeof analysis.future !== "object" ||
    !analysis.spot ||
    typeof analysis.spot !== "object" ||
    !Array.isArray(analysis.legs)
  ) {
    return false;
  }

  return true;
}

function isTradeCalculationShape(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const calculation = value as Record<string, unknown>;
  const display = calculation.display;

  return (
    typeof calculation.symbol === "string" &&
    typeof calculation.period === "string" &&
    Array.isArray(calculation.legs) &&
    Boolean(display) &&
    typeof display === "object"
  );
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
