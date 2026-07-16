import type { TradeCsvImportDraft } from "./tradeCsvImport";
import type { SavedTrade } from "../types/app";
import { calculateTrade, formatUsdt } from "./tradeCalculator";

export function createManualTradeDraft(
  trade: SavedTrade,
): TradeCsvImportDraft {
  const longPnl = sumLegPnl(
    trade,
    (leg) => leg.side === "long" || (leg.type === "spot" && leg.side !== "short"),
  );
  const shortPnl = sumLegPnl(trade, (leg) => leg.side === "short");

  return {
    symbol: trade.calculation.symbol === "-" ? "" : trade.calculation.symbol,
    period: trade.calculation.period === "-" ? "" : trade.calculation.period,
    quantity: readSavedValue(trade, "Количество монет"),
    spreadEntry: formatEditableNumber(trade.calculation.spreadEntry),
    spreadExit: formatEditableNumber(trade.calculation.spreadExit),
    longPnl: formatEditableNumber(longPnl),
    shortPnl: formatEditableNumber(shortPnl),
    spreadContribution: readSavedValue(trade, "Значение «Спред принес»"),
    total: formatEditableNumber(trade.calculation.netResult),
  };
}

export function mergeEditedTrade(
  originalTrade: SavedTrade,
  generatedTrade: SavedTrade,
): SavedTrade {
  const availableOriginalLegs = [...originalTrade.calculation.legs];
  const mergedLegs = generatedTrade.analysis.legs.map((generatedLeg) => {
    const role = getLegRole(generatedLeg);
    const sourceIndex = availableOriginalLegs.findIndex(
      (originalLeg) => getLegRole(originalLeg) === role,
    );
    const originalLeg = sourceIndex >= 0
      ? availableOriginalLegs.splice(sourceIndex, 1)[0]
      : null;

    if (!originalLeg) {
      return generatedLeg;
    }

    return {
      ...generatedLeg,
      id: originalLeg.id,
      label: createEditedLegLabel(originalLeg, generatedLeg.symbol),
      type: originalLeg.type,
      side: originalLeg.side,
      volumeUsdt: originalLeg.volume,
    };
  });
  const preservesOriginalStructure =
    mergedLegs.length === originalTrade.calculation.legs.length &&
    availableOriginalLegs.length === 0;
  const mergedFutureLeg = mergedLegs.find((leg) => leg.type === "futures");
  const mergedSpotLeg = mergedLegs.find((leg) => leg.type === "spot");
  const analysis = {
    ...generatedTrade.analysis,
    bundleType: preservesOriginalStructure
      ? originalTrade.analysis.bundleType
      : generatedTrade.analysis.bundleType,
    legs: mergedLegs,
    future: {
      ...originalTrade.analysis.future,
      ...generatedTrade.analysis.future,
      side: mergedFutureLeg?.side ?? generatedTrade.analysis.future.side,
      volumeUsdt:
        mergedFutureLeg?.volumeUsdt ?? originalTrade.analysis.future.volumeUsdt,
      realizedPnlUsdt:
        mergedFutureLeg?.pnlUsdt ??
        generatedTrade.analysis.future.realizedPnlUsdt,
    },
    spot: mergedSpotLeg
      ? {
          ...originalTrade.analysis.spot,
          volumeUsdt: mergedSpotLeg.volumeUsdt,
          rawPnlUsdt:
            typeof mergedSpotLeg.pnlUsdt === "number"
              ? Math.abs(mergedSpotLeg.pnlUsdt)
              : null,
          pnlUsdt: mergedSpotLeg.pnlUsdt,
        }
      : generatedTrade.analysis.spot,
    confidence: originalTrade.analysis.confidence,
    notes: generatedTrade.analysis.notes.map((note) =>
      note === "Добавлено вручную." ? "Отредактировано вручную." : note,
    ),
  };
  const calculated = calculateTrade(analysis);
  const netResult = generatedTrade.calculation.netResult;
  const calculation = {
    ...calculated,
    netResult,
    isProfitable: netResult === null ? null : netResult >= 0,
    display: {
      ...calculated.display,
      netResult: formatUsdt(netResult),
    },
  };

  return {
    ...generatedTrade,
    id: originalTrade.id,
    analysis,
    calculation,
    instructions: "Отредактировано вручную.",
  };
}

function sumLegPnl(
  trade: SavedTrade,
  matches: (leg: SavedTrade["calculation"]["legs"][number]) => boolean,
) {
  const values = trade.calculation.legs
    .filter(matches)
    .map((leg) => leg.pnl)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return values.length > 0
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

function getLegRole(
  leg:
    | SavedTrade["calculation"]["legs"][number]
    | SavedTrade["analysis"]["legs"][number],
) {
  if (leg.type === "spot") {
    return "long";
  }
  if (leg.side === "long" || leg.side === "short") {
    return leg.side;
  }
  return "unknown";
}

function createEditedLegLabel(
  originalLeg: SavedTrade["calculation"]["legs"][number],
  symbol: string | null | undefined,
) {
  const normalizedSymbol = symbol?.trim() || originalLeg.symbol;
  if (originalLeg.type === "spot") {
    return `Спот ${normalizedSymbol}`;
  }
  if (originalLeg.side === "long") {
    return `Long ${normalizedSymbol}`;
  }
  if (originalLeg.side === "short") {
    return `Short ${normalizedSymbol}`;
  }
  return originalLeg.title;
}

function formatEditableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value).replace(".", ",")
    : "";
}

function readSavedValue(trade: SavedTrade, prefix: string) {
  const sources = [...trade.analysis.notes, ...trade.instructions.split("\n")];

  for (const source of sources) {
    const normalized = source.trim();
    const marker = `${prefix}:`;
    if (!normalized.toLocaleLowerCase("ru").startsWith(marker.toLocaleLowerCase("ru"))) {
      continue;
    }

    return normalized.slice(marker.length).trim().replace(/\.$/, "");
  }

  return "";
}
