import Papa from "papaparse";
import type { AnalysisResponse } from "./analysisSchema";
import {
  calculateTrade,
  formatUsdt,
  type TradeCalculation,
} from "./tradeCalculator";
import type { SavedTrade } from "../types/app";

export type TradeCsvImportIssue = {
  row: number;
  message: string;
};

export type TradeCsvImportRowStatus = "imported" | "duplicate" | "error";

export type TradeCsvImportDraft = {
  symbol: string;
  period: string;
  quantity: string;
  spreadEntry: string;
  spreadExit: string;
  longPnl: string;
  shortPnl: string;
  spreadContribution: string;
  total: string;
};

export type TradeCsvImportRowResult = {
  row: number | null;
  symbol: string | null;
  period: string | null;
  status: TradeCsvImportRowStatus;
  message: string;
  tradeId?: string;
  values?: TradeCsvImportDraft;
};

export type TradeCsvImportResult = {
  trades: SavedTrade[];
  duplicateCount: number;
  issues: TradeCsvImportIssue[];
  rows: TradeCsvImportRowResult[];
};

export type TradeCsvImportReport = {
  fileName: string;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: TradeCsvImportRowResult[];
};

type ParsedPeriod = {
  startedAt: string;
  endedAt: string;
  endedDate: Date;
};

type ImportedAnalysisLeg = AnalysisResponse["legs"][number];

type ColumnName =
  | "symbol"
  | "period"
  | "quantity"
  | "spreadEntry"
  | "spreadExit"
  | "longPnl"
  | "shortPnl"
  | "spreadContribution"
  | "total";

const columnAliases: Record<ColumnName, string[]> = {
  symbol: ["монета", "symbol", "coin"],
  period: ["период", "period"],
  quantity: ["кол во", "количество", "quantity", "amount"],
  spreadEntry: ["спред вход", "спред входа", "entry spread"],
  spreadExit: ["спред выход", "спред выхода", "exit spread"],
  longPnl: ["pnl лонг", "лонг pnl", "long pnl"],
  shortPnl: ["pnl шорт", "шорт pnl", "short pnl"],
  spreadContribution: ["спред принес", "результат спреда", "spread result"],
  total: ["итого usdt", "итого", "total usdt", "total"],
};

export function parseTradeCsv(
  csvText: string,
  existingHistory: SavedTrade[] = [],
): TradeCsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const fields = parsed.meta.fields ?? [];
  const columns = resolveColumns(fields);
  const missingColumns = getMissingRequiredColumns(columns);

  if (missingColumns.length > 0) {
    const message = `Не найдены обязательные колонки: ${missingColumns.join(", ")}.`;
    return {
      trades: [],
      duplicateCount: 0,
      issues: [
        {
          row: 1,
          message,
        },
      ],
      rows: [
        {
          row: 1,
          symbol: null,
          period: null,
          status: "error",
          message,
        },
      ],
    };
  }

  const parserIssues: TradeCsvImportIssue[] = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 2,
    message: error.message,
  }));
  const issues: TradeCsvImportIssue[] = [...parserIssues];
  const rows: TradeCsvImportRowResult[] = [];
  const handledParserRows = new Set<number>();
  const existingTradeKeys = new Set(
    existingHistory.map((trade) => createCsvTradeDuplicateKey(trade)),
  );
  const importedTradeKeys = new Set<string>();
  const trades: SavedTrade[] = [];
  let duplicateCount = 0;

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const values = extractCsvDraft(row, columns);
    const rawSymbol = values.symbol;
    const symbol = normalizeSymbol(rawSymbol) ?? normalizeOptionalText(rawSymbol);
    const period = normalizeOptionalText(values.period);
    const rowParserIssues = parserIssues.filter((issue) => issue.row === rowNumber);

    if (rowParserIssues.length > 0) {
      handledParserRows.add(rowNumber);
      rows.push({
        row: rowNumber,
        symbol,
        period,
        status: "error",
        message: rowParserIssues.map((issue) => issue.message).join(" "),
        values,
      });
      return;
    }

    const result = createTradeFromCsvDraft(values, rowNumber, {
      requireTotal: true,
      allowTotalOnly: true,
    });

    if ("message" in result) {
      issues.push({ row: rowNumber, message: result.message });
      rows.push({
        row: rowNumber,
        symbol,
        period,
        status: "error",
        message: result.message,
        values,
      });
      return;
    }

    const duplicateKey = createCsvTradeDuplicateKey(result.trade);
    if (
      existingTradeKeys.has(duplicateKey) ||
      importedTradeKeys.has(duplicateKey)
    ) {
      duplicateCount += 1;
      rows.push({
        row: rowNumber,
        symbol: result.trade.calculation.symbol,
        period: result.trade.calculation.period,
        status: "duplicate",
        message: "Связка уже существует и была пропущена.",
        tradeId: result.trade.id,
        values,
      });
      return;
    }

    importedTradeKeys.add(duplicateKey);
    trades.push(result.trade);
    rows.push({
      row: rowNumber,
      symbol: result.trade.calculation.symbol,
      period: result.trade.calculation.period,
      status: "imported",
      message: "Импортировано.",
      tradeId: result.trade.id,
      values,
    });
  });

  parserIssues
    .filter((issue) => !handledParserRows.has(issue.row))
    .forEach((issue) => {
      rows.push({
        row: issue.row,
        symbol: null,
        period: null,
        status: "error",
        message: issue.message,
      });
    });

  return {
    trades: trades.sort(compareSavedAt),
    duplicateCount,
    issues,
    rows,
  };
}

export function mergeImportedTrades(
  history: SavedTrade[],
  importedTrades: SavedTrade[],
) {
  const merged = new Map(history.map((trade) => [trade.id, trade]));
  for (const trade of importedTrades) {
    merged.set(trade.id, trade);
  }

  return Array.from(merged.values()).sort(compareSavedAt);
}

function extractCsvDraft(
  row: Record<string, string>,
  columns: Partial<Record<ColumnName, string>>,
): TradeCsvImportDraft {
  return {
    symbol: readCell(row, columns.symbol),
    period: readCell(row, columns.period),
    quantity: readCell(row, columns.quantity),
    spreadEntry: readCell(row, columns.spreadEntry),
    spreadExit: readCell(row, columns.spreadExit),
    longPnl: readCell(row, columns.longPnl),
    shortPnl: readCell(row, columns.shortPnl),
    spreadContribution: readCell(row, columns.spreadContribution),
    total: readCell(row, columns.total),
  };
}

export function createTradeFromCsvDraft(
  values: TradeCsvImportDraft,
  rowNumber: number,
  options: { requireTotal?: boolean; allowTotalOnly?: boolean } = {},
): { trade: SavedTrade } | { message: string } {
  const symbol = normalizeSymbol(values.symbol);
  if (!symbol) {
    return { message: "Не указана монета." };
  }

  const period = parsePeriod(values.period);
  if (!period) {
    return { message: "Не удалось распознать период сделки." };
  }

  const longPnl = parseLocalizedNumber(values.longPnl);
  const shortPnl = parseLocalizedNumber(values.shortPnl);
  const sourceTotal = parseLocalizedNumber(values.total);
  const isTotalOnly = longPnl === null && shortPnl === null;
  if (isTotalOnly && !options.allowTotalOnly) {
    return { message: "Не найден PnL Long или Short." };
  }

  if ((options.requireTotal || isTotalOnly) && sourceTotal === null) {
    return { message: "Не указан итог связки в USDT." };
  }
  const calculatedTotal = [longPnl, shortPnl]
    .filter((value): value is number => value !== null)
    .reduce((total, value) => total + value, 0);
  const netResult = sourceTotal ?? calculatedTotal;
  const spreadEntry = parseLocalizedNumber(values.spreadEntry);
  const spreadExit = parseLocalizedNumber(values.spreadExit);
  const quantity = normalizeOptionalText(values.quantity);
  const spreadContribution = normalizeOptionalText(values.spreadContribution);
  const legs = isTotalOnly && sourceTotal !== null
    ? [createManualTotalLeg(symbol, period, sourceTotal)]
    : createFuturesLegs({
        symbol,
        period,
        longPnl,
        shortPnl,
      });
  const notes = ["Импортировано из CSV."];

  if (isTotalOnly) {
    notes.push("PnL Long и Short не указан; используется ручной итог связки.");
  }

  if (quantity) {
    notes.push(`Количество монет: ${quantity}.`);
  }
  if (spreadContribution) {
    notes.push(`Значение «Спред принес»: ${spreadContribution}.`);
  }
  if (sourceTotal !== null && Math.abs(sourceTotal - calculatedTotal) > 0.01) {
    notes.push(
      `Итог CSV ${formatUsdt(sourceTotal)} отличается от суммы Long и Short ${formatUsdt(calculatedTotal)}; используется итог из CSV.`,
    );
  }

  const primaryLeg = legs[0];
  const analysis: AnalysisResponse = {
    bundleType: isTotalOnly
      ? "Ручной итог"
      : legs.length > 1
        ? "Фьючерс + Фьючерс"
        : "Фьючерс",
    spread: { entry: spreadEntry, exit: spreadExit },
    legs,
    future: {
      symbol,
      side: isTotalOnly ? "unknown" : primaryLeg.side,
      startedAt: period.startedAt,
      endedAt: period.endedAt,
      volumeUsdt: null,
      realizedPnlUsdt: isTotalOnly ? null : primaryLeg.pnlUsdt,
    },
    spot: {},
    conflicts: [],
    confidence: null,
    notes,
  };
  const calculation = withImportedNetResult(calculateTrade(analysis), netResult);
  const id = createCsvTradeId(symbol, period, netResult);

  return {
    trade: {
      id,
      savedAt: period.endedDate.toISOString(),
      analysis,
      calculation,
      instructions: [
        `Импортировано из CSV, строка ${rowNumber}.`,
        quantity ? `Количество монет: ${quantity}.` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join("\n"),
    },
  };
}

function createManualTotalLeg(
  symbol: string,
  period: ParsedPeriod,
  total: number,
): ImportedAnalysisLeg {
  return {
    id: "import-manual-total",
    label: "Ручной итог",
    type: "unknown",
    symbol,
    side: "unknown",
    startedAt: period.startedAt,
    endedAt: period.endedAt,
    volumeUsdt: null,
    pnlUsdt: total,
  };
}

function createFuturesLegs({
  symbol,
  period,
  longPnl,
  shortPnl,
}: {
  symbol: string;
  period: ParsedPeriod;
  longPnl: number | null;
  shortPnl: number | null;
}): ImportedAnalysisLeg[] {
  const legs: ImportedAnalysisLeg[] = [];

  if (longPnl !== null) {
    legs.push({
      id: "import-long",
      label: `Long ${symbol}`,
      type: "futures",
      symbol,
      side: "long",
      startedAt: period.startedAt,
      endedAt: period.endedAt,
      volumeUsdt: null,
      pnlUsdt: longPnl,
      realizedPnlUsdt: longPnl,
    });
  }

  if (shortPnl !== null) {
    legs.push({
      id: "import-short",
      label: `Short ${symbol}`,
      type: "futures",
      symbol,
      side: "short",
      startedAt: period.startedAt,
      endedAt: period.endedAt,
      volumeUsdt: null,
      pnlUsdt: shortPnl,
      realizedPnlUsdt: shortPnl,
    });
  }

  return legs;
}

function withImportedNetResult(
  calculation: TradeCalculation,
  netResult: number,
): TradeCalculation {
  return {
    ...calculation,
    netResult,
    isProfitable: netResult >= 0,
    display: {
      ...calculation.display,
      netResult: formatUsdt(netResult),
    },
  };
}

function resolveColumns(fields: string[]) {
  const columns: Partial<Record<ColumnName, string>> = {};

  for (const [column, aliases] of Object.entries(columnAliases) as Array<
    [ColumnName, string[]]
  >) {
    columns[column] = fields.find((field) => aliases.includes(field));
  }

  return columns;
}

function getMissingRequiredColumns(
  columns: Partial<Record<ColumnName, string>>,
) {
  const required: Array<[ColumnName, string]> = [
    ["symbol", "Монета"],
    ["period", "Период"],
    ["total", "Итого (USDT)"],
  ];

  return required
    .filter(([column]) => !columns[column])
    .map(([, label]) => label);
}

function normalizeHeader(header: string) {
  return header
    .replace(/^\uFEFF/, "")
    .normalize("NFKC")
    .replace(/\*/g, "")
    .replace(/ё/gi, "е")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function readCell(row: Record<string, string>, column?: string) {
  if (!column) {
    return "";
  }

  const value = row[column];
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeSymbol(value: string) {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9._/-]+$/.test(normalized) ? normalized : null;
}

function normalizeOptionalText(value: string) {
  const normalized = value.trim();
  return normalized && !/^[—–-]$/.test(normalized) ? normalized : null;
}

export function parseLocalizedNumber(value: string): number | null {
  const normalizedText = normalizeOptionalText(value);
  if (!normalizedText) {
    return null;
  }

  const negative =
    /^\s*[-−]/.test(normalizedText) || /^\s*\([^)]*\)\s*$/.test(normalizedText);
  let numeric = normalizedText
    .replace(/[−–—]/g, "-")
    .replace(/\s|\u00a0|\u202f/g, "")
    .replace(/[^\d.,+-]/g, "")
    .replace(/^[+-]/, "");

  const commaIndex = numeric.lastIndexOf(",");
  const dotIndex = numeric.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    numeric = numeric.split(thousandsSeparator).join("");
    numeric = numeric.replace(decimalSeparator, ".");
  } else if (commaIndex >= 0) {
    numeric = numeric.replace(/,/g, ".");
  }

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return negative ? -Math.abs(parsed) : parsed;
}

function parsePeriod(value: string): ParsedPeriod | null {
  const parts = value.trim().split(/\s+[—–]\s+|\s+-\s+/);
  if (parts.length !== 2) {
    return null;
  }

  const started = parseDateTime(parts[0]);
  if (!started) {
    return null;
  }

  let ended = parseDateTime(parts[1]);
  if (!ended) {
    const timeMatch = parts[1].match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return null;
    }

    ended = new Date(started);
    ended.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    if (ended.getTime() < started.getTime()) {
      ended.setDate(ended.getDate() + 1);
    }
  }

  return {
    startedAt: formatDateTime(started),
    endedAt: formatDateTime(ended),
    endedDate: ended,
  };
}

function parseDateTime(value: string) {
  const match = value.trim().match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/,
  );
  if (!match) {
    return null;
  }

  const [, day, month, year, hours, minutes] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    0,
    0,
  );
  const valid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day) &&
    date.getHours() === Number(hours) &&
    date.getMinutes() === Number(minutes);

  return valid ? date : null;
}

function formatDateTime(date: Date) {
  return [
    [date.getDate(), date.getMonth() + 1, date.getFullYear()]
      .map((part) => String(part).padStart(2, "0"))
      .join("."),
    [date.getHours(), date.getMinutes()]
      .map((part) => String(part).padStart(2, "0"))
      .join(":"),
  ].join(" ");
}

function createCsvTradeId(
  symbol: string,
  period: ParsedPeriod,
  netResult: number,
) {
  const identity = [
    symbol,
    period.startedAt,
    period.endedAt,
    normalizeResultIdentity(netResult),
  ].join("|");
  return `csv-${symbol.toLowerCase()}-${stableHash(identity)}`;
}

export function createCsvTradeDuplicateKey(trade: SavedTrade) {
  return [
    trade.calculation.symbol.trim().toUpperCase(),
    trade.calculation.period.trim().replace(/\s+/g, " "),
    normalizeResultIdentity(trade.calculation.netResult),
  ].join("|");
}

function normalizeResultIdentity(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return value === 0 ? "0" : String(value);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function compareSavedAt(first: SavedTrade, second: SavedTrade) {
  return second.savedAt.localeCompare(first.savedAt);
}
