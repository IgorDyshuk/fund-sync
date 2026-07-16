import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import {
  createTradeRangeSummary,
  getAnalyticsRangeTrades,
  normalizeAnalyticsSymbol,
  type AnalyticsRange,
} from "../lib/monthlyAnalytics";
import { formatUsdt } from "../lib/tradeCalculator";
import { groupTradesByClosedDate } from "../lib/tradeHistoryView";
import type { SavedTrade } from "../types/app";
import { cn } from "../utils/cn";
import { MonthlyCoinResultChart } from "./MonthlyCoinResultChart";
import { TradeHistoryRow } from "./TradeHistoryRow";

type MonthlyCoinTradesPageProps = {
  history: SavedTrade[];
  symbol: string;
  range: AnalyticsRange;
  onBack: () => void;
  onTradeSelect: (trade: SavedTrade) => void;
};

export function MonthlyCoinTradesPage({
  history,
  symbol,
  range,
  onBack,
  onTradeSelect,
}: MonthlyCoinTradesPageProps) {
  const normalizedSymbol = normalizeAnalyticsSymbol(symbol);
  const [selectedRange, setSelectedRange] = useState(range);
  const trades = useMemo(
    () => getAnalyticsRangeTrades(history, selectedRange, normalizedSymbol),
    [history, normalizedSymbol, selectedRange],
  );
  const groups = useMemo(() => groupTradesByClosedDate(trades), [trades]);
  const periodSummary = useMemo(
    () => createTradeRangeSummary(history, selectedRange),
    [history, selectedRange],
  );
  const coinResult =
    periodSummary.coins.find((coin) => coin.symbol === normalizedSymbol)?.result ??
    0;

  return (
    <main className="min-h-full bg-[#08090d] text-[#e7e9ee]">
      <section className="mx-auto min-h-full w-full max-w-[1120px] px-[15px] py-3 sm:px-5 sm:py-6 lg:px-8 lg:py-10">
        <header className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Вернуться к обзору месяца"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#c5ccd6] transition hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-center text-xl font-semibold text-white sm:text-3xl">
            {normalizedSymbol}
          </h1>
          <span aria-hidden="true" />
        </header>

        <section className="mt-8 pb-2 sm:mt-10 sm:pb-3">
          <p className="text-sm font-medium text-[#8f98a5] sm:text-base">
            {periodSummary.label}
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-semibold tabular-nums sm:text-5xl",
              coinResult > 0 && "text-emerald-200",
              coinResult < 0 && "text-red-200",
              coinResult === 0 && "text-white",
            )}
          >
            {formatUsdt(coinResult)}
          </p>
        </section>

        {range.timeframe !== "custom" ? (
          <MonthlyCoinResultChart
            history={history}
            symbol={normalizedSymbol}
            endingRange={range}
            selectedRange={selectedRange}
            onPeriodSelect={setSelectedRange}
          />
        ) : null}

        <section className="pb-24 pt-6 sm:pb-10 sm:pt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">
              Связки
            </h2>
            <span className="text-sm font-medium text-[#8f98a5] sm:text-base">
              {trades.length} {getTradeWord(trades.length)}
            </span>
          </div>

          <div
            key={selectedRange.key}
            data-testid="monthly-coin-trades-content"
            aria-live="polite"
            className="monthly-trades-reveal"
          >
            {groups.length > 0 ? (
              <div className="mt-6 space-y-7 sm:mt-8 sm:space-y-9">
                {groups.map((group) => (
                  <section key={group.key}>
                    <h3 className="mb-3 text-sm font-medium text-[#8f98a5] sm:mb-4 sm:text-base">
                      {group.label}
                    </h3>
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111318] shadow-2xl shadow-black/20">
                      <div className="divide-y divide-white/[0.08]">
                        {group.trades.map((trade) => (
                          <TradeHistoryRow
                            key={trade.id}
                            trade={trade}
                            onSelect={onTradeSelect}
                          />
                        ))}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid min-h-[45vh] place-items-center text-center">
                <p className="text-sm text-[#87909d]">
                  Связки за этот период не найдены
                </p>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function getTradeWord(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "связок";
  }
  if (lastDigit === 1) {
    return "связка";
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return "связки";
  }
  return "связок";
}
