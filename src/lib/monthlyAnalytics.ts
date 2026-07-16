import type { SavedTrade } from "../types/app";
import { getTradeClosedAt } from "./tradeHistoryView";

export type MonthlyCoinResult = {
  symbol: string;
  result: number;
  tradeCount: number;
  sharePercent: number;
};

export type MonthlyTradeSummary = {
  key: string;
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  totalResult: number;
  positiveResult: number;
  negativeResult: number;
  tradeCount: number;
  contributionTotal: number;
  coins: MonthlyCoinResult[];
};

export type MonthlyCoinSeriesPoint = {
  key: string;
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  result: number;
  tradeCount: number;
};

export function createMonthlyTradeSummary(
  history: SavedTrade[],
  monthDate: Date,
): MonthlyTradeSummary {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const groupedCoins = new Map<string, { result: number; tradeCount: number }>();
  let tradeCount = 0;

  for (const trade of history) {
    const closedAt = getTradeClosedAt(trade);
    const result = trade.calculation.netResult;
    if (
      !closedAt ||
      closedAt.getFullYear() !== year ||
      closedAt.getMonth() !== month ||
      typeof result !== "number" ||
      !Number.isFinite(result)
    ) {
      continue;
    }

    const symbol = normalizeAnalyticsSymbol(trade.calculation.symbol);
    const current = groupedCoins.get(symbol) ?? { result: 0, tradeCount: 0 };
    current.result += result;
    current.tradeCount += 1;
    groupedCoins.set(symbol, current);
    tradeCount += 1;
  }

  const contributionTotal = Array.from(groupedCoins.values()).reduce(
    (total, coin) => total + Math.abs(coin.result),
    0,
  );
  const coins = Array.from(groupedCoins.entries())
    .map(([symbol, coin]) => ({
      symbol,
      result: coin.result,
      tradeCount: coin.tradeCount,
      sharePercent:
        contributionTotal > 0
          ? (Math.abs(coin.result) / contributionTotal) * 100
          : 0,
    }))
    .sort(
      (first, second) =>
        Math.abs(second.result) - Math.abs(first.result) ||
        second.result - first.result ||
        first.symbol.localeCompare(second.symbol),
    );
  const totalResult = coins.reduce((total, coin) => total + coin.result, 0);
  const positiveResult = coins.reduce(
    (total, coin) => total + Math.max(coin.result, 0),
    0,
  );
  const negativeResult = coins.reduce(
    (total, coin) => total + Math.min(coin.result, 0),
    0,
  );

  return {
    key: createMonthKey(monthDate),
    year,
    month,
    label: formatMonthLabel(monthDate),
    shortLabel: formatShortMonthLabel(monthDate),
    totalResult,
    positiveResult,
    negativeResult,
    tradeCount,
    contributionTotal,
    coins,
  };
}

export function createMonthlySeries(
  history: SavedTrade[],
  selectedMonth: Date,
  count = 7,
) {
  return Array.from({ length: count }, (_, index) =>
    createMonthlyTradeSummary(
      history,
      shiftMonth(selectedMonth, index - count + 1),
    ),
  );
}

export function getMonthlyCoinTrades(
  history: SavedTrade[],
  symbol: string,
  monthDate: Date,
) {
  const normalizedSymbol = normalizeAnalyticsSymbol(symbol);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  return history.filter((trade) => {
    const closedAt = getTradeClosedAt(trade);
    const result = trade.calculation.netResult;
    return (
      closedAt !== null &&
      closedAt.getFullYear() === year &&
      closedAt.getMonth() === month &&
      normalizeAnalyticsSymbol(trade.calculation.symbol) === normalizedSymbol &&
      typeof result === "number" &&
      Number.isFinite(result)
    );
  });
}

export function createMonthlyCoinSeries(
  history: SavedTrade[],
  symbol: string,
  endingMonth: Date,
  count = 7,
): MonthlyCoinSeriesPoint[] {
  const normalizedSymbol = normalizeAnalyticsSymbol(symbol);

  return createMonthlySeries(history, endingMonth, count).map((month) => {
    const coin = month.coins.find(
      (candidate) => candidate.symbol === normalizedSymbol,
    );

    return {
      key: month.key,
      year: month.year,
      month: month.month,
      label: month.label,
      shortLabel: month.shortLabel,
      result: coin?.result ?? 0,
      tradeCount: coin?.tradeCount ?? 0,
    };
  });
}

export function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function createMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeAnalyticsSymbol(symbol: string) {
  return symbol.split("/")[0]?.trim().toUpperCase() || "НЕИЗВЕСТНО";
}

function formatMonthLabel(date: Date) {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatShortMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { month: "short" })
    .format(date)
    .replace(".", "")
    .slice(0, 3);
}
