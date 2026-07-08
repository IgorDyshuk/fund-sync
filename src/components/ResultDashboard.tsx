import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Database,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AnalysisResponse } from "../lib/analysisSchema";
import {
  formatPercent,
  type TradeCalculation,
  type TradeLegCalculation,
} from "../lib/tradeCalculator";
import { cn } from "../utils/cn";

type ResultDashboardProps = {
  analysis: AnalysisResponse | null;
  calculation: TradeCalculation | null;
  isLoading: boolean;
};

export function ResultDashboard({
  analysis,
  calculation,
  isLoading,
}: ResultDashboardProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center p-4 lg:min-h-full">
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-[#c5ccd6]">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
          Анализ сделки
        </div>
      </div>
    );
  }

  if (!calculation || !analysis) {
    return (
      <div className="grid min-h-60 place-items-center p-4 lg:min-h-full">
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#11141a] p-4 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-[#6f7885]" />
          <h2 className="mt-3 text-lg font-semibold text-white">
            Ожидание анализа
          </h2>
          <p className="mt-1 text-sm text-[#9aa3af]">-</p>
        </div>
      </div>
    );
  }

  const positive = calculation.isProfitable === true;
  const negative = calculation.isProfitable === false;

  return (
    <article className="flex min-h-full flex-col">
      <header className="border-b border-white/10 p-3 sm:p-4 xl:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between xl:gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-white sm:text-2xl xl:text-3xl">
                {getPrimarySymbol(calculation.symbol)}
              </h2>
              <BundleBadge label={calculation.bundleType} />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-[#aeb7c3] sm:text-sm xl:mt-3">
              <CalendarClock className="h-4 w-4 text-[#8a93a0]" />
              <span>{calculation.period}</span>
            </div>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-[#b9c0ca] sm:text-sm xl:px-3 xl:py-2">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Confidence{" "}
            {typeof analysis.confidence === "number"
              ? formatPercent(analysis.confidence * 100)
              : "-"}
          </div>
        </div>
      </header>

      <div className="grid gap-3 p-3 xl:gap-5 xl:p-6">
        <section className="grid gap-2 xl:gap-4">
          <div className="grid gap-2 xl:flex xl:flex-nowrap xl:items-stretch xl:gap-4">
            <VolumeSummary calculation={calculation} />

            <div className="grid grid-cols-2 gap-2 xl:flex xl:min-w-0 xl:flex-1 xl:flex-nowrap xl:gap-4">
              {calculation.legs.map((leg) => (
                <SideResultCard key={leg.id} leg={leg} />
              ))}
            </div>
          </div>

          <NetResultCard
            displayValue={calculation.display.netResult}
            positive={positive}
            negative={negative}
          />
        </section>

        {analysis.notes.length > 0 ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              Notes
            </div>
            <ul className="grid gap-1 text-sm text-[#aeb7c3]">
              {analysis.notes.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function VolumeSummary({ calculation }: { calculation: TradeCalculation }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 xl:flex xl:min-h-[190px] xl:flex-[0_0_450px] xl:flex-col xl:p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white xl:mb-4 xl:gap-3 xl:text-xl">
        <BarChart3 className="h-4 w-4 text-emerald-300 xl:h-7 xl:w-7" />
        Задействовано USDT
      </div>
      <div className="grid min-w-0 grid-cols-3 gap-1.5 xl:min-h-0 xl:flex-1 xl:grid-cols-[repeat(3,minmax(0,1fr))] xl:items-stretch xl:gap-3">
        <VolumeCell
          label="Всего"
          value={calculation.display.totalVolume}
          primary
        />
        <VolumeCell
          label="Фьючерсы"
          value={calculation.display.futuresVolume}
        />
        <VolumeCell label="Спот" value={calculation.display.spotVolume} />
      </div>
    </section>
  );
}

function VolumeCell({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border px-2 py-1.5 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:justify-center xl:rounded-lg xl:px-4 xl:py-3",
        primary
          ? "border-emerald-300/30 bg-emerald-300/[0.07]"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="truncate text-[11px] font-medium uppercase text-[#8a93a0] xl:text-xs">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 min-w-0 break-words text-[11px] font-semibold leading-tight xl:mt-2 xl:whitespace-nowrap xl:text-[clamp(0.8rem,0.82vw,1rem)]",
          primary ? "text-emerald-100" : "text-white",
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function SideResultCard({ leg }: { leg: TradeLegCalculation }) {
  const tone = numberTone(leg.pnl);
  const positive = tone === "positive";
  const negative = tone === "negative";

  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border p-2.5 transition xl:min-h-[190px] xl:flex-1 xl:p-5",
        positive
          ? "border-emerald-300/40 bg-emerald-300/[0.08] shadow-[0_0_28px_rgba(110,231,183,0.1)]"
          : negative
            ? "border-red-300/40 bg-red-400/[0.08] shadow-[0_0_28px_rgba(248,113,113,0.1)]"
            : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="grid h-full min-w-0 content-between gap-2 xl:gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-white xl:gap-2 xl:text-base">
            {leg.type === "futures" ? (
              <BarChart3 className="h-4 w-4 text-emerald-300 xl:h-5 xl:w-5" />
            ) : leg.type === "spot" ? (
              <Wallet className="h-4 w-4 text-cyan-300 xl:h-5 xl:w-5" />
            ) : (
              <Database className="h-4 w-4 text-[#8a93a0] xl:h-5 xl:w-5" />
            )}
            <span className="min-w-0 truncate">{leg.title}</span>
          </div>
          <span className="mt-1 block truncate text-[11px] text-[#8a93a0] xl:text-sm">
            {leg.subtitle}
          </span>
        </div>
        <div className="min-w-0">
          <div
            className={cn(
              "break-words text-lg font-semibold leading-tight xl:text-3xl",
              positive
                ? "text-emerald-200"
                : negative
                  ? "text-red-200"
                  : "text-white",
            )}
          >
            {leg.display.pnl}
          </div>
          <div
            className="mt-1 truncate text-[11px] text-[#aeb7c3] xl:mt-2 xl:text-sm"
            title={leg.display.volume}
          >
            {leg.display.volume}
          </div>
        </div>
      </div>
    </section>
  );
}

function NetResultCard({
  displayValue,
  positive,
  negative,
}: {
  displayValue: string;
  positive: boolean;
  negative: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border p-3 transition xl:p-5",
        positive
          ? "border-emerald-300/40 bg-emerald-300/[0.08] shadow-[0_0_32px_rgba(110,231,183,0.14)]"
          : negative
            ? "border-red-300/40 bg-red-400/[0.08] shadow-[0_0_32px_rgba(248,113,113,0.12)]"
            : "border-white/10 bg-white/[0.03]",
      )}
    >
      <div className="flex h-full flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#dce2ea] xl:text-sm">
          {positive ? (
            <TrendingUp className="h-4 w-4 text-emerald-300 xl:h-5 xl:w-5" />
          ) : negative ? (
            <TrendingDown className="h-4 w-4 text-red-300 xl:h-5 xl:w-5" />
          ) : (
            <BarChart3 className="h-4 w-4 text-[#8a93a0] xl:h-5 xl:w-5" />
          )}
          Итог по связке
        </div>
        <div
          className={cn(
            "break-words text-2xl font-semibold leading-tight xl:text-4xl",
            positive
              ? "text-emerald-200"
              : negative
                ? "text-red-200"
                : "text-white",
          )}
        >
          {displayValue}
        </div>
      </div>
    </section>
  );
}

function BundleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2.5 text-sm font-semibold text-cyan-100">
      {label}
    </span>
  );
}

function getPrimarySymbol(symbol: string) {
  return symbol.split("/")[0]?.trim() || symbol;
}

function numberTone(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null || value === 0) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}
