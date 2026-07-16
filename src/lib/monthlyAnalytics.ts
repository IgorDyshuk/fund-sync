import type { SavedTrade } from "../types/app";
import { getTradeClosedAt } from "./tradeHistoryView";

export type MonthlyCoinResult = {
  symbol: string;
  result: number;
  tradeCount: number;
  sharePercent: number;
};

export type AnalyticsTimeframe = "day" | "month" | "quarter" | "year" | "custom";

export type AnalyticsRange = {
  timeframe: AnalyticsTimeframe;
  key: string;
  start: Date;
  end: Date;
  label: string;
  shortLabel: string;
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
  range: AnalyticsRange;
};

export type MonthlyCoinSeriesPoint = {
  key: string;
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  result: number;
  tradeCount: number;
  range: AnalyticsRange;
};

export function createMonthlyTradeSummary(
  history: SavedTrade[],
  monthDate: Date,
): MonthlyTradeSummary {
  return createTradeRangeSummary(
    history,
    createAnalyticsRange("month", monthDate),
  );
}

export function createTradeRangeSummary(
  history: SavedTrade[],
  range: AnalyticsRange,
): MonthlyTradeSummary {
  const year = range.start.getFullYear();
  const month = range.start.getMonth();
  const groupedCoins = new Map<string, { result: number; tradeCount: number }>();
  let tradeCount = 0;

  for (const trade of history) {
    const closedAt = getTradeClosedAt(trade);
    const result = trade.calculation.netResult;
    if (
      !closedAt ||
      closedAt.getTime() < range.start.getTime() ||
      closedAt.getTime() > range.end.getTime() ||
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
    key: range.key,
    year,
    month,
    label: range.label,
    shortLabel: range.shortLabel,
    totalResult,
    positiveResult,
    negativeResult,
    tradeCount,
    contributionTotal,
    coins,
    range,
  };
}

export function createMonthlySeries(
  history: SavedTrade[],
  selectedMonth: Date,
  count = 7,
) {
  return createAnalyticsSeries(history, "month", selectedMonth, count);
}

export function createAnalyticsSeries(
  history: SavedTrade[],
  timeframe: Exclude<AnalyticsTimeframe, "custom">,
  endingPeriod: Date,
  count = 7,
) {
  return Array.from({ length: count }, (_, index) => {
    const anchor = shiftAnalyticsAnchor(
      timeframe,
      endingPeriod,
      index - count + 1,
    );
    return createTradeRangeSummary(
      history,
      createAnalyticsRange(timeframe, anchor),
    );
  });
}

export function getMonthlyCoinTrades(
  history: SavedTrade[],
  symbol: string,
  monthDate: Date,
) {
  return getAnalyticsRangeTrades(
    history,
    createAnalyticsRange("month", monthDate),
    symbol,
  );
}

export function getAnalyticsRangeTrades(
  history: SavedTrade[],
  range: AnalyticsRange,
  symbol?: string,
) {
  const normalizedSymbol = symbol ? normalizeAnalyticsSymbol(symbol) : null;

  return history.filter((trade) => {
    const closedAt = getTradeClosedAt(trade);
    const result = trade.calculation.netResult;
    return (
      closedAt !== null &&
      closedAt.getTime() >= range.start.getTime() &&
      closedAt.getTime() <= range.end.getTime() &&
      (normalizedSymbol === null ||
        normalizeAnalyticsSymbol(trade.calculation.symbol) === normalizedSymbol) &&
      typeof result === "number" &&
      Number.isFinite(result)
    );
  });
}

export function createAnalyticsCoinSeries(
  history: SavedTrade[],
  symbol: string,
  timeframe: Exclude<AnalyticsTimeframe, "custom">,
  endingPeriod: Date,
  count = 7,
): MonthlyCoinSeriesPoint[] {
  const normalizedSymbol = normalizeAnalyticsSymbol(symbol);

  return createAnalyticsSeries(history, timeframe, endingPeriod, count).map(
    (period) => {
      const coin = period.coins.find(
        (candidate) => candidate.symbol === normalizedSymbol,
      );

      return {
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        shortLabel: period.shortLabel,
        result: coin?.result ?? 0,
        tradeCount: coin?.tradeCount ?? 0,
        range: period.range,
      };
    },
  );
}

export function createMonthlyCoinSeries(
  history: SavedTrade[],
  symbol: string,
  endingMonth: Date,
  count = 7,
): MonthlyCoinSeriesPoint[] {
  return createAnalyticsCoinSeries(history, symbol, "month", endingMonth, count);
}

export function createAnalyticsRange(
  timeframe: Exclude<AnalyticsTimeframe, "custom">,
  anchor: Date,
): AnalyticsRange {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const day = anchor.getDate();

  if (timeframe === "day") {
    const start = startOfDay(new Date(year, month, day));
    return {
      timeframe,
      key: `day:${createDateKey(start)}`,
      start,
      end: endOfDay(start),
      label: formatDayLabel(start),
      shortLabel: formatShortDayLabel(start),
    };
  }

  if (timeframe === "quarter") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    const start = startOfDay(new Date(year, quarterStartMonth, 1));
    const end = endOfDay(new Date(year, quarterStartMonth + 3, 0));
    const quarter = Math.floor(quarterStartMonth / 3) + 1;
    return {
      timeframe,
      key: `quarter:${year}-${quarter}`,
      start,
      end,
      label: `${toRomanQuarter(quarter)} квартал ${year} г.`,
      shortLabel: `${toRomanQuarter(quarter)} кв`,
    };
  }

  if (timeframe === "year") {
    const start = startOfDay(new Date(year, 0, 1));
    return {
      timeframe,
      key: `year:${year}`,
      start,
      end: endOfDay(new Date(year, 11, 31)),
      label: `${year} год`,
      shortLabel: String(year),
    };
  }

  const start = startOfDay(new Date(year, month, 1));
  return {
    timeframe,
    key: createMonthKey(start),
    start,
    end: endOfDay(new Date(year, month + 1, 0)),
    label: formatMonthLabel(start),
    shortLabel: formatShortMonthLabel(start),
  };
}

export function createCustomAnalyticsRange(from: Date, to: Date): AnalyticsRange {
  const orderedStart = from.getTime() <= to.getTime() ? from : to;
  const orderedEnd = from.getTime() <= to.getTime() ? to : from;
  const start = startOfDay(orderedStart);
  const end = endOfDay(orderedEnd);

  return {
    timeframe: "custom",
    key: `custom:${createDateKey(start)}:${createDateKey(end)}`,
    start,
    end,
    label: formatCustomRangeLabel(start, end),
    shortLabel: "Период",
  };
}

export function shiftAnalyticsRange(range: AnalyticsRange, offset: number) {
  if (range.timeframe === "custom") {
    return range;
  }

  return createAnalyticsRange(
    range.timeframe,
    shiftAnalyticsAnchor(range.timeframe, range.start, offset),
  );
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

function shiftAnalyticsAnchor(
  timeframe: Exclude<AnalyticsTimeframe, "custom">,
  date: Date,
  offset: number,
) {
  if (timeframe === "day") {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  }
  if (timeframe === "quarter") {
    return new Date(date.getFullYear(), date.getMonth() + offset * 3, 1);
  }
  if (timeframe === "year") {
    return new Date(date.getFullYear() + offset, 0, 1);
  }
  return shiftMonth(date, offset);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function createDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDayLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatCustomRangeLabel(start: Date, end: Date) {
  if (createDateKey(start) === createDateKey(end)) {
    return formatDayLabel(start);
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(start)} — ${formatter.format(end)}`;
}

function toRomanQuarter(quarter: number) {
  return ["I", "II", "III", "IV"][quarter - 1] ?? String(quarter);
}
