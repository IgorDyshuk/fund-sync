import { ArrowLeft } from "lucide-react";
import type { SavedTrade } from "../types/app";
import { groupTradesByClosedDate } from "../lib/tradeHistoryView";
import { TradeHistoryRow } from "./TradeHistoryRow";

type HistoryPageProps = {
  history: SavedTrade[];
  onBack: () => void;
  onTradeSelect: (trade: SavedTrade) => void;
};

export function HistoryPage({
  history,
  onBack,
  onTradeSelect,
}: HistoryPageProps) {
  const groups = groupTradesByClosedDate(history);

  return (
    <main className="min-h-full bg-[#08090d] text-[#e7e9ee]">
      <section className="mx-auto min-h-full w-full max-w-[1120px] px-[15px] py-3 sm:px-5 sm:py-6 lg:px-8 lg:py-10">
        <header className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onBack}
              aria-label="Вернуться на главную"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#c5ccd6] transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Все связки
            </h1>
          </div>
          <span className="shrink-0 text-sm font-medium text-[#b9c1cc] sm:text-base">
            {history.length} {getSavedWord(history.length)}
          </span>
        </header>

        {groups.length > 0 ? (
          <div className="mt-8 space-y-7 sm:mt-10 sm:space-y-9">
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-3 text-sm font-medium text-[#8f98a5] sm:mb-4 sm:text-base">
                  {group.label}
                </h2>
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
          <div className="grid min-h-[60vh] place-items-center">
            <p className="text-sm text-[#87909d]">История пока пустая</p>
          </div>
        )}

      </section>
    </main>
  );
}

function getSavedWord(count: number) {
  if (count === 1) {
    return "связка";
  }

  if (count >= 2 && count <= 4) {
    return "связки";
  }

  return "связок";
}
