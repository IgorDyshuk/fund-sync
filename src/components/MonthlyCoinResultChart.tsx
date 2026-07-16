import { useMemo } from "react";
import {
  createMonthKey,
  createMonthlyCoinSeries,
} from "../lib/monthlyAnalytics";
import type { SavedTrade } from "../types/app";
import { cn } from "../utils/cn";

type MonthlyCoinResultChartProps = {
  history: SavedTrade[];
  symbol: string;
  endingMonth: Date;
  selectedMonth: Date;
  onMonthSelect: (monthDate: Date) => void;
};

export function MonthlyCoinResultChart({
  history,
  symbol,
  endingMonth,
  selectedMonth,
  onMonthSelect,
}: MonthlyCoinResultChartProps) {
  const points = useMemo(
    () => createMonthlyCoinSeries(history, symbol, endingMonth, 7),
    [endingMonth, history, symbol],
  );
  const selectedMonthKey = createMonthKey(selectedMonth);
  const highestResult = Math.max(0, ...points.map((point) => point.result));
  const lowestResult = Math.min(0, ...points.map((point) => point.result));
  const chartRange = highestResult - lowestResult || 1;
  const zeroPosition = (highestResult / chartRange) * 100;
  const middleResult = (highestResult + lowestResult) / 2;

  return (
    <section
      role="region"
      aria-label={`Динамика ${symbol} за семь месяцев`}
      className="border-b border-white/[0.08] py-7 sm:py-9"
    >
      <div className="relative h-[280px] sm:h-[330px]">
        <div className="absolute inset-x-0 top-0 bottom-8">
          <ChartGuide position={0} value={highestResult} />
          <ChartGuide position={50} value={middleResult} />
          <ChartGuide position={100} value={lowestResult} />

          <div className="absolute top-0 right-0 bottom-0 left-[78px] grid grid-cols-7 gap-2 sm:left-[96px] sm:gap-4">
            {points.map((point) => {
              const valuePosition =
                ((highestResult - point.result) / chartRange) * 100;
              const barTop = Math.min(valuePosition, zeroPosition);
              const barHeight = Math.abs(valuePosition - zeroPosition);
              const isSelected = point.key === selectedMonthKey;

              return (
                <div
                  key={point.key}
                  className="relative h-full min-w-0"
                >
                  {point.result !== 0 ? (
                    <span
                      data-month-bar={point.key}
                      aria-label={`${point.label}: ${formatChartValue(point.result)}`}
                      className={cn(
                        "absolute left-1/2 w-[72%] -translate-x-1/2 rounded-t-[3px] transition-all duration-500 sm:w-[64%]",
                        point.result > 0 && "bg-emerald-400/75",
                        point.result < 0 && "rounded-t-none rounded-b-[3px] bg-red-400/75",
                        isSelected && point.result > 0 && "bg-emerald-300",
                        isSelected && point.result < 0 && "bg-red-300",
                      )}
                      style={{
                        top: `${barTop}%`,
                        height: `${Math.max(barHeight, 1.5)}%`,
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <span
            aria-hidden="true"
            className="absolute right-0 left-[78px] border-t border-white/15 sm:left-[96px]"
            style={{ top: `${zeroPosition}%` }}
          />
        </div>

        <div className="absolute right-0 bottom-0 left-[78px] grid h-7 grid-cols-7 gap-2 sm:left-[96px] sm:gap-4">
          {points.map((point) => (
            <span
              key={point.key}
              className={cn(
                "self-end truncate text-center text-[10px] uppercase text-[#737c88] sm:text-xs",
                point.key === selectedMonthKey && "font-semibold text-white",
              )}
            >
              {point.shortLabel}
            </span>
          ))}
        </div>

        <div className="absolute top-0 right-0 bottom-0 left-[78px] z-10 grid grid-cols-7 gap-2 sm:left-[96px] sm:gap-4">
          {points.map((point) => (
            <button
              key={point.key}
              type="button"
              onClick={() =>
                onMonthSelect(new Date(point.year, point.month, 1))
              }
              aria-label={`Показать связки ${symbol} за ${point.label}`}
              aria-pressed={point.key === selectedMonthKey}
              title={`${point.label}: ${formatChartValue(point.result)}`}
              className="h-full min-w-0 rounded-sm transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ChartGuide({ position, value }: { position: number; value: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute right-0 left-0 flex -translate-y-1/2 items-center gap-2"
      style={{ top: `${position}%` }}
    >
      <span className="w-[70px] shrink-0 text-right text-[10px] tabular-nums text-[#6f7885] sm:w-[88px] sm:text-xs">
        {formatChartValue(value)}
      </span>
      <span className="h-px flex-1 border-t border-dashed border-white/15" />
    </div>
  );
}

function formatChartValue(value: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(value)} USDT`;
}
