import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  createAnalyticsRange,
  createAnalyticsSeries,
  createTradeRangeSummary,
  shiftAnalyticsRange,
  type AnalyticsRange,
} from "../lib/monthlyAnalytics";
import { getMonthlyCoinColor } from "../lib/monthlyChart";
import { formatUsdt } from "../lib/tradeCalculator";
import type { SavedTrade } from "../types/app";
import { cn } from "../utils/cn";
import { AnalyticsTimeframeSheet } from "./AnalyticsTimeframeSheet";
import { MonthlyDonutChart } from "./MonthlyDonutChart";

type MonthlyOverviewPageProps = {
  history: SavedTrade[];
  onBack: () => void;
  onCoinSelect: (symbol: string, range: AnalyticsRange) => void;
  initialMonth?: Date;
  isActive?: boolean;
  onFilterOpenChange?: (isOpen: boolean) => void;
};

export function MonthlyOverviewPage({
  history,
  onBack,
  onCoinSelect,
  initialMonth = new Date(),
  isActive = true,
  onFilterOpenChange = () => undefined,
}: MonthlyOverviewPageProps) {
  const [selectedRange, setSelectedRange] = useState(() =>
    createAnalyticsRange("month", initialMonth),
  );
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const currentDate = useMemo(() => new Date(), []);
  const summary = useMemo(
    () => createTradeRangeSummary(history, selectedRange),
    [history, selectedRange],
  );
  const series = useMemo(
    () =>
      selectedRange.timeframe === "custom"
        ? []
        : createAnalyticsSeries(
            history,
            selectedRange.timeframe,
            currentDate,
            7,
          ),
    [currentDate, history, selectedRange.timeframe],
  );
  const maxSeriesResult = Math.max(
    ...series.map((month) => Math.abs(month.totalResult)),
    1,
  );
  const currentRange =
    selectedRange.timeframe === "custom"
      ? null
      : createAnalyticsRange(selectedRange.timeframe, currentDate);
  const canGoForward =
    currentRange !== null &&
    selectedRange.end.getTime() < currentRange.end.getTime();
  const isCustomRange = selectedRange.timeframe === "custom";

  const openTimeframe = () => {
    setIsTimeframeOpen(true);
    onFilterOpenChange(true);
  };

  const closeTimeframe = () => {
    setIsTimeframeOpen(false);
    onFilterOpenChange(false);
  };

  return (
    <main className="min-h-full bg-[#08090d] text-[#e7e9ee]">
      <section className="mx-auto min-h-full w-full max-w-[1120px] px-[15px] pb-3 sm:px-5 sm:pb-6 lg:px-8 lg:pb-10">
        <header className="sticky top-0 z-30 -mx-[15px] grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 border-b border-white/[0.08] bg-[#08090d]/95 px-[15px] py-3 backdrop-blur-xl sm:-mx-5 sm:gap-4 sm:px-5 sm:py-4 lg:-mx-8 lg:px-8">
          <button
            type="button"
            onClick={onBack}
            aria-label="Вернуться на главную"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#c5ccd6] transition hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-center text-xl font-semibold tracking-tight text-white sm:text-4xl">
            {getOverviewTitle(selectedRange)}
          </h1>
          <button
            type="button"
            onClick={openTimeframe}
            aria-label="Выбрать период анализа"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#c5ccd6] transition hover:bg-white/[0.07] hover:text-white"
          >
            <SlidersHorizontal className="h-5 w-5" />
            {selectedRange.timeframe !== "month" ? (
              <span className="absolute right-1.5 bottom-1.5 h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-[#08090d]" />
            ) : null}
          </button>
        </header>

        {isCustomRange ? (
          <div className="mt-6 text-center text-sm font-semibold text-white sm:mt-8 sm:text-lg">
            {summary.label}
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-3 sm:mt-8">
            <button
              type="button"
              onClick={() =>
                setSelectedRange((range) => shiftAnalyticsRange(range, -1))
              }
              aria-label={getPeriodNavigationLabel(selectedRange, "previous")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#b9c1cc] transition hover:bg-white/[0.05] hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-[176px] text-center text-base font-semibold text-white sm:min-w-[220px] sm:text-lg">
              {summary.label}
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedRange((range) => shiftAnalyticsRange(range, 1))
              }
              disabled={!canGoForward}
              aria-label={getPeriodNavigationLabel(selectedRange, "next")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#b9c1cc] transition hover:bg-white/[0.05] hover:text-white disabled:cursor-default disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10">
          <div className="flex justify-center">
            <MonthlyDonutChart
              key={summary.key}
              summary={summary}
              size="large"
              animate={isActive}
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <SummaryMetric
              icon={TrendingUp}
              label="Прибыль"
              value={formatUsdt(summary.positiveResult)}
              tone="positive"
            />
            <SummaryMetric
              icon={TrendingDown}
              label="Убытки"
              value={formatUsdt(summary.negativeResult)}
              tone="negative"
            />
            <SummaryMetric
              icon={CalendarDays}
              label="Связок"
              value={String(summary.tradeCount)}
            />
            <SummaryMetric
              icon={TrendingUp}
              label="Чистый итог"
              value={formatUsdt(summary.totalResult)}
              tone={summary.totalResult >= 0 ? "positive" : "negative"}
            />
          </div>
        </div>

        {!isCustomRange ? (
          <section
            aria-label={
              selectedRange.timeframe === "month"
                ? "Динамика по месяцам"
                : "Динамика по периодам"
            }
            className="mt-7 border-y border-white/[0.08] py-5 sm:mt-10 sm:py-6"
          >
            <div className="grid h-[116px] grid-cols-7 items-end gap-2 sm:h-[142px] sm:gap-4">
              {series.map((period) => {
                const barHeight =
                  period.totalResult === 0
                    ? 8
                    : Math.max(
                        (Math.abs(period.totalResult) / maxSeriesResult) * 88,
                        14,
                      );
                const isSelected = period.key === summary.key;

                return (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => setSelectedRange(period.range)}
                    aria-label={`${period.label}: ${formatUsdt(period.totalResult)}`}
                    className="group flex h-full min-w-0 flex-col items-center justify-end gap-2"
                  >
                    <div className="flex h-[88px] w-full max-w-12 items-end rounded-t-sm bg-white/[0.035] sm:h-[108px]">
                      <span
                        className={cn(
                          "block w-full rounded-t-sm transition-all duration-300",
                          period.totalResult > 0 && "bg-emerald-400/80",
                          period.totalResult < 0 && "bg-red-400/80",
                          period.totalResult === 0 && "bg-white/10",
                          isSelected && "brightness-125",
                        )}
                        style={{ height: `${barHeight}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] uppercase text-[#737c88] transition group-hover:text-white sm:text-xs",
                        isSelected && "font-semibold text-white",
                      )}
                    >
                      {period.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="pb-24 pt-5 sm:pb-10 sm:pt-7">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Результат по монетам
            </h2>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[#d6dae1] sm:text-base">
              {formatUsdt(summary.totalResult)}
            </span>
          </div>

          {summary.coins.length > 0 ? (
            <div className="divide-y divide-white/[0.08]">
              {summary.coins.map((coin, index) => (
                <button
                  key={coin.symbol}
                  type="button"
                  onClick={() => onCoinSelect(coin.symbol, selectedRange)}
                  aria-label={`Открыть связки ${coin.symbol} за ${summary.label}`}
                  className="flex min-h-[76px] w-full items-center gap-3 py-3 text-left transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70 sm:min-h-[88px] sm:gap-4 sm:py-4"
                >
                  <span
                    aria-hidden="true"
                    className="h-8 w-2 shrink-0 rounded-full sm:h-9"
                    style={{ backgroundColor: getMonthlyCoinColor(index) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white sm:text-base">
                      {coin.symbol}
                      <span className="ml-1.5 font-normal text-[#7f8894]">
                        {coin.sharePercent.toLocaleString("ru-RU", {
                          maximumFractionDigits: 1,
                        })}%
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[#7f8894] sm:text-sm">
                      {coin.tradeCount} {getTradeWord(coin.tradeCount)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums sm:text-base",
                      coin.result > 0 && "text-emerald-200",
                      coin.result < 0 && "text-red-200",
                      coin.result === 0 && "text-[#b6bdc7]",
                    )}
                  >
                    {formatUsdt(coin.result)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#68717d]" />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-[180px] place-items-center text-center">
              <div>
                <p className="text-sm font-medium text-[#d6dae1]">
                  Нет закрытых связок
                </p>
                <p className="mt-1 text-xs text-[#7f8894]">
                  Выберите другой период.
                </p>
              </div>
            </div>
          )}
        </section>
      </section>

      {isTimeframeOpen ? (
        <AnalyticsTimeframeSheet
          initialRange={selectedRange}
          onApply={setSelectedRange}
          onClose={closeTimeframe}
        />
      ) : null}
    </main>
  );
}

function getOverviewTitle(range: AnalyticsRange) {
  if (range.timeframe === "day") return "Обзор за день";
  if (range.timeframe === "quarter") return "Обзор за квартал";
  if (range.timeframe === "year") return "Обзор за год";
  if (range.timeframe === "custom") return "Обзор за период";
  return "Обзор за месяц";
}

function getPeriodNavigationLabel(
  range: AnalyticsRange,
  direction: "previous" | "next",
) {
  const prefix = direction === "previous" ? "Предыдущий" : "Следующий";
  if (range.timeframe === "day") return `${prefix} день`;
  if (range.timeframe === "quarter") return `${prefix} квартал`;
  if (range.timeframe === "year") return `${prefix} год`;
  return `${prefix} месяц`;
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-[#111318] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs text-[#8f98a5] sm:text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "mt-2 truncate text-base font-semibold tabular-nums sm:text-xl",
          tone === "positive" && "text-emerald-200",
          tone === "negative" && "text-red-200",
          tone === "neutral" && "text-white",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
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
