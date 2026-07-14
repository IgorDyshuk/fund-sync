import { BarChart3, ChevronRight, Database } from "lucide-react";
import type { SavedTrade } from "../types/app";
import { TradeHistoryRow } from "./TradeHistoryRow";

const recentTradesLimit = 5;

type HomePageProps = {
  history: SavedTrade[];
  onTradeSelect: (trade: SavedTrade) => void;
  onOpenHistory: () => void;
};

export function HomePage({
  history,
  onTradeSelect,
  onOpenHistory,
}: HomePageProps) {
  const recentTrades = history.slice(0, recentTradesLimit);

  return (
    <main className="h-full bg-[#08090d] text-[#e7e9ee]">
      <section className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col px-[15px] py-3 sm:px-5 sm:py-6 lg:px-8 lg:py-10">
        <header>
          <div>
            <p className="text-sm font-medium text-emerald-300">Fund Sync</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Обзор
            </h1>
          </div>
        </header>

        {recentTrades.length > 0 ? (
          <RecentTradesWidget
            trades={recentTrades}
            onTradeSelect={onTradeSelect}
            onOpenHistory={onOpenHistory}
          />
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

      </section>
    </main>
  );
}

function RecentTradesWidget({
  trades,
  onTradeSelect,
  onOpenHistory,
}: {
  trades: SavedTrade[];
  onTradeSelect: (trade: SavedTrade) => void;
  onOpenHistory: () => void;
}) {
  return (
    <section className="mt-4 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#111318] shadow-2xl shadow-black/20 sm:mt-8">
      <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-5 w-5 shrink-0 text-emerald-300" />
          <h2 className="text-base font-semibold text-white sm:text-lg">
            Последние связки
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenHistory}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-[#aeb7c4] transition hover:text-white sm:text-sm"
        >
          Показать все
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
        {trades.map((trade) => (
          <TradeHistoryRow key={trade.id} trade={trade} onSelect={onTradeSelect} />
        ))}
      </div>
    </section>
  );
}
