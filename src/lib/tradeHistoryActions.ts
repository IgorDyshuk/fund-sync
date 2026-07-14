import type { SavedTrade } from "../types/app";

export function prependSavedTrade(
  history: SavedTrade[],
  trade: SavedTrade,
): SavedTrade[] {
  return [trade, ...history];
}

export function removeSavedTrade(
  history: SavedTrade[],
  tradeId: string,
): SavedTrade[] {
  return history.filter((trade) => trade.id !== tradeId);
}
