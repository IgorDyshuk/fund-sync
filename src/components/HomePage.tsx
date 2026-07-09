import { BarChart3, CalendarClock, Database, Plus } from "lucide-react";
import type { SavedTrade } from "../types/app";
import { cn } from "../utils/cn";

type HomePageProps = {
  history: SavedTrade[];
  onCreateTrade: () => void;
};

export function HomePage({ history, onCreateTrade }: HomePageProps) {
  return (
    <main className="min-h-screen bg-[#08090d] text-[#e7e9ee]">
      <section className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col px-3 py-4 sm:px-5 lg:px-8 lg:py-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-300">Fund Sync</p>
            <h1 className="mt-1 text-2xl font-semibold text-white sm:text-4xl">
              История связок
            </h1>
          </div>
          <div className="hidden rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#9aa3af] sm:block">
            {history.length} сохранено
          </div>
        </header>

        {history.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {history.map((trade) => (
              <HistoryCard key={trade.id} trade={trade} />
            ))}
          </div>
        ) : (
          <div className="grid flex-1 place-items-center">
            <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#101217] p-5 text-center shadow-2xl shadow-black/20">
              <Database className="mx-auto h-9 w-9 text-[#6f7885]" />
              <h2 className="mt-3 text-lg font-semibold text-white">
                История пока пустая
              </h2>
              <p className="mt-1 text-sm text-[#9aa3af]">
                Новые итоги появятся здесь после сохранения связки.
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onCreateTrade}
          aria-label="Добавить связку"
          className="fixed bottom-4 right-4 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-300 text-[#07110c] shadow-[0_0_28px_rgba(110,231,183,0.28)] transition hover:bg-emerald-200 active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Plus className="h-7 w-7" />
        </button>
      </section>
    </main>
  );
}

function HistoryCard({ trade }: { trade: SavedTrade }) {
  const { calculation } = trade;
  const positive = calculation.isProfitable === true;
  const negative = calculation.isProfitable === false;

  return (
    <article
      className={cn(
        "rounded-lg border p-3 shadow-2xl shadow-black/20 transition",
        positive
          ? "border-emerald-300/30 bg-emerald-300/[0.07]"
          : negative
            ? "border-red-300/30 bg-red-400/[0.07]"
            : "border-white/10 bg-[#101217]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">
            {getPrimarySymbol(calculation.symbol)}
          </h2>
          <p className="mt-1 truncate text-sm text-[#9aa3af]">
            {calculation.bundleType}
          </p>
        </div>
        <div
          className={cn(
            "shrink-0 rounded-md border px-2 py-1 text-sm font-semibold",
            positive
              ? "border-emerald-300/30 text-emerald-100"
              : negative
                ? "border-red-300/30 text-red-100"
                : "border-white/10 text-white",
          )}
        >
          {calculation.display.netResult}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Задействовано" value={calculation.display.totalVolume} />
        <Metric label="Дата" value={formatSavedDate(trade.savedAt)} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-[#9aa3af]">
        <CalendarClock className="h-4 w-4 text-[#7d8794]" />
        <span className="min-w-0 truncate">{calculation.period}</span>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-black/10 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase text-[#8a93a0]">
        <BarChart3 className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-white" title={value}>
        {value}
      </div>
    </div>
  );
}

function getPrimarySymbol(symbol: string) {
  return symbol.split("/")[0]?.trim() || symbol;
}

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
