import { BarChart3, ChevronRight } from "lucide-react";
import type { SavedTrade } from "../types/app";
import { cn } from "../utils/cn";
import { getAppLanguage, translate as t } from "../lib/i18n";
import { formatUsdt } from "../lib/tradeCalculator";

type TradeHistoryRowProps = {
  trade: SavedTrade;
  onSelect: (trade: SavedTrade) => void;
};

export function TradeHistoryRow({ trade, onSelect }: TradeHistoryRowProps) {
  const { calculation } = trade;
  const symbol = getPrimarySymbol(calculation.symbol);
  const resultTone = getResultTone(calculation.netResult);
  const displayResult = getAppLanguage() === "en"
    ? formatUsdt(calculation.netResult)
    : calculation.display.netResult;

  return (
    <button
      type="button"
      onClick={() => onSelect(trade)}
      aria-label={t("Открыть связку {symbol}", { symbol })}
      className="flex min-h-[72px] w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70 sm:min-h-[92px] sm:gap-4 sm:px-6 sm:py-4"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.045] sm:h-10 sm:w-10">
        <BarChart3 className="h-4 w-4 text-[#aeb7c4] sm:h-5 sm:w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[14px] font-semibold text-white sm:text-lg">
          {symbol}
        </h3>
        <div className="mt-0.75 truncate text-[11px] text-[#8f98a5] sm:text-sm">
          {calculation.period}
        </div>
      </div>

      <div
        className={cn(
          "flex min-w-[96px] shrink-0 items-center justify-end px-1 py-1.5 text-right text-sm font-semibold sm:min-w-[138px] sm:px-1 sm:py-2.5 sm:text-base",
          resultTone === "positive" && "text-emerald-200",
          resultTone === "negative" && "text-red-200",
          resultTone === "neutral" && "text-[#c5cbd3]",
        )}
        title={displayResult}
      >
        <span className="truncate">{displayResult}</span>
      </div>

      <ChevronRight className="hidden h-4 w-4 shrink-0 text-[#68717d] sm:block" />
    </button>
  );
}

function getPrimarySymbol(symbol: string) {
  return symbol.split("/")[0]?.trim() || symbol;
}

function getResultTone(value: number | null) {
  if (value === null) {
    return "neutral";
  }

  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}
