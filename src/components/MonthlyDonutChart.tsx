import type { CSSProperties } from "react";
import type { MonthlyTradeSummary } from "../lib/monthlyAnalytics";
import { getMonthlyCoinColor } from "../lib/monthlyChart";
import { formatUsdt } from "../lib/tradeCalculator";
import { cn } from "../utils/cn";

type MonthlyDonutChartProps = {
  summary: MonthlyTradeSummary;
  size?: "compact" | "large";
  animate?: boolean;
};

export function MonthlyDonutChart({
  summary,
  size = "compact",
  animate = false,
}: MonthlyDonutChartProps) {
  const chartBackground = createDonutGradient(summary);
  const resultTone =
    summary.totalResult > 0
      ? "text-emerald-200"
      : summary.totalResult < 0
        ? "text-red-200"
        : "text-[#d6dae1]";
  const formattedResult = formatUsdt(summary.totalResult);
  const compactResult = formattedResult.replace(/\sUSDT$/, "");

  return (
    <div
      role="img"
      aria-label={`Результат за ${summary.label}: ${formatUsdt(summary.totalResult)}`}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full",
        size === "large"
          ? "h-[min(72vw,310px)] w-[min(72vw,310px)] sm:h-[340px] sm:w-[340px]"
          : "h-[126px] w-[126px] sm:h-[148px] sm:w-[148px]",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-[#292d35]"
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 rounded-full",
          animate && "monthly-donut-reveal",
        )}
        style={{ background: chartBackground } as CSSProperties}
      />
      <div
        className={cn(
          "absolute grid place-items-center rounded-full bg-[#111318] text-center",
          size === "large" ? "inset-[17%]" : "inset-[11%] sm:inset-[13%]",
        )}
      >
        <div className="min-w-0 px-2">
          <p
            className={cn(
              "font-semibold tabular-nums tracking-normal",
              size === "large" ? "text-2xl sm:text-3xl" : "text-sm sm:text-base",
              resultTone,
            )}
          >
            {size === "large" ? formattedResult : compactResult}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[#8f98a5]",
              size === "large" ? "text-sm sm:text-base" : "text-[10px] sm:text-xs",
            )}
          >
            {size === "large" ? "Итог" : "USDT · Итог"}
          </p>
        </div>
      </div>
    </div>
  );
}

function createDonutGradient(summary: MonthlyTradeSummary) {
  const visibleCoins = summary.coins.filter((coin) => coin.sharePercent > 0);
  if (visibleCoins.length === 0) {
    return "conic-gradient(#292d35 0deg 360deg)";
  }

  const gapSize = visibleCoins.length > 1 ? 1.5 : 0;
  const availableDegrees = 360 - gapSize * visibleCoins.length;
  let cursor = 0;
  const segments: string[] = [];

  visibleCoins.forEach((coin, index) => {
    const segmentSize = (coin.sharePercent / 100) * availableDegrees;
    const segmentEnd = cursor + segmentSize;
    segments.push(
      `${getMonthlyCoinColor(index)} ${cursor.toFixed(3)}deg ${segmentEnd.toFixed(3)}deg`,
    );

    if (gapSize > 0) {
      const gapEnd = segmentEnd + gapSize;
      segments.push(`#111318 ${segmentEnd.toFixed(3)}deg ${gapEnd.toFixed(3)}deg`);
      cursor = gapEnd;
    } else {
      cursor = segmentEnd;
    }
  });

  return `conic-gradient(${segments.join(", ")})`;
}
