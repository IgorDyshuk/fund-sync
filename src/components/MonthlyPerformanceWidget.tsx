import { ChevronRight, TrendingUp } from "lucide-react";
import { createMonthlyTradeSummary } from "../lib/monthlyAnalytics";
import { getMonthlyCoinColor } from "../lib/monthlyChart";
import { formatUsdt } from "../lib/tradeCalculator";
import type { SavedTrade } from "../types/app";
import { cn } from "../utils/cn";
import { MonthlyDonutChart } from "./MonthlyDonutChart";

type MonthlyPerformanceWidgetProps = {
  history: SavedTrade[];
  onOpen: () => void;
  monthDate?: Date;
};

export function MonthlyPerformanceWidget({
  history,
  onOpen,
  monthDate = new Date(),
}: MonthlyPerformanceWidgetProps) {
  const summary = createMonthlyTradeSummary(history, monthDate);
  const visibleCoins = summary.coins.slice(0, 4);
  const hiddenCoinCount = Math.max(summary.coins.length - visibleCoins.length, 0);

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111318] shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp className="h-5 w-5 shrink-0 text-emerald-300" />
          <h2 className="truncate text-base font-semibold text-white sm:text-lg">
            Результат за {summary.label.split(" ")[0].toLowerCase()}
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-[#aeb7c4] transition hover:text-white sm:text-sm"
        >
          Подробнее
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="border-t border-white/[0.08] px-3 py-3 sm:px-5 sm:py-4">
        {summary.tradeCount > 0 ? (
          <div className="flex min-h-[138px] items-center gap-4 sm:gap-6">
            <MonthlyDonutChart summary={summary} />

            <div className="min-w-0 flex-1 space-y-2.5 sm:space-y-3">
              {visibleCoins.map((coin, index) => (
                <div key={coin.symbol} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getMonthlyCoinColor(index) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#d6dae1] sm:text-sm">
                    {coin.symbol}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold tabular-nums sm:text-sm",
                      coin.result > 0 && "text-emerald-200",
                      coin.result < 0 && "text-red-200",
                      coin.result === 0 && "text-[#b6bdc7]",
                    )}
                  >
                    {formatUsdt(coin.result)}
                  </span>
                </div>
              ))}

              {hiddenCoinCount > 0 ? (
                <p className="pl-[18px] text-[11px] text-[#7f8894] sm:text-xs">
                  Ещё {hiddenCoinCount}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[138px] items-center gap-4 sm:gap-6">
            <MonthlyDonutChart summary={summary} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#d6dae1]">
                Нет закрытых связок
              </p>
              <p className="mt-1 text-xs leading-5 text-[#7f8894]">
                Итоги появятся после сохранения сделок за этот месяц.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
