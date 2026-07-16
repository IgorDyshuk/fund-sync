import Papa from "papaparse";
import type { SavedTrade } from "../types/app";
import { createManualTradeDraft } from "./manualTradeDraft";
import {
  getAnalyticsRangeTrades,
  type AnalyticsRange,
} from "./monthlyAnalytics";
import { getTradeClosedAt } from "./tradeHistoryView";

export const tradeCsvExportColumns = [
  "Монета",
  "Период",
  "Кол-во",
  "Спред Вход",
  "Спред Выход",
  "PnL Лонг",
  "PnL Шорт",
  "Спред принес",
  "Итого (USDT)",
] as const;

export type TradeCsvExport = {
  csv: string;
  fileName: string;
  tradeCount: number;
};

export function createTradeCsvExport(
  history: SavedTrade[],
  range: AnalyticsRange,
): TradeCsvExport {
  const trades = getAnalyticsRangeTrades(history, range).sort(
    (first, second) =>
      (getTradeClosedAt(first)?.getTime() ?? 0) -
      (getTradeClosedAt(second)?.getTime() ?? 0),
  );
  const rows = trades.map((trade) => {
    const draft = createManualTradeDraft(trade);

    return {
      "Монета": fallbackCell(draft.symbol),
      "Период": fallbackCell(draft.period),
      "Кол-во": fallbackCell(draft.quantity),
      "Спред Вход": formatPercentCell(draft.spreadEntry),
      "Спред Выход": formatPercentCell(draft.spreadExit),
      "PnL Лонг": fallbackCell(draft.longPnl),
      "PnL Шорт": fallbackCell(draft.shortPnl),
      "Спред принес":
        draft.spreadContribution.trim() || formatSpreadContribution(draft.total),
      "Итого (USDT)": fallbackCell(draft.total),
    };
  });
  const csv = rows.length > 0
    ? Papa.unparse(rows, {
        columns: [...tradeCsvExportColumns],
        delimiter: ";",
        newline: "\r\n",
        quotes: true,
      })
    : Papa.unparse([[...tradeCsvExportColumns]], {
        delimiter: ";",
        newline: "\r\n",
        quotes: true,
      });

  return {
    csv: `\uFEFF${csv}`,
    fileName: `fund-sync-${sanitizeRangeKey(range.key)}.csv`,
    tradeCount: trades.length,
  };
}

export function downloadTradeCsvExport(result: TradeCsvExport) {
  const blob = new Blob([result.csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fallbackCell(value: string) {
  return value.trim() || "-";
}

function formatPercentCell(value: string) {
  const normalized = value.trim();
  return normalized ? `${normalized}%` : "-";
}

function formatSpreadContribution(total: string) {
  const normalized = total.trim();
  return normalized ? `- (${normalized} USDT)` : "-";
}

function sanitizeRangeKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}
