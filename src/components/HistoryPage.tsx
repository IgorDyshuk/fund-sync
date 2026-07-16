import { AlertTriangle, ArrowLeft, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { SavedTrade } from "../types/app";
import { groupTradesByClosedDate } from "../lib/tradeHistoryView";
import { TradeHistoryRow } from "./TradeHistoryRow";
import { cn } from "../utils/cn";
import { getAppLanguage, translate as t } from "../lib/i18n";

type HistoryPageProps = {
  history: SavedTrade[];
  onBack: () => void;
  onTradeSelect: (trade: SavedTrade) => void;
  onDeleteAll?: () => void | Promise<void>;
};

export function HistoryPage({
  history,
  onBack,
  onTradeSelect,
  onDeleteAll,
}: HistoryPageProps) {
  const groups = groupTradesByClosedDate(history);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDeleteConfirmOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeletingAll) {
        setIsDeleteConfirmOpen(false);
        setDeleteError(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleteConfirmOpen, isDeletingAll]);

  function openDeleteConfirm() {
    setDeleteError(null);
    setIsDeleteConfirmOpen(true);
  }

  function closeDeleteConfirm() {
    if (isDeletingAll) {
      return;
    }
    setIsDeleteConfirmOpen(false);
    setDeleteError(null);
  }

  async function deleteAll() {
    if (!onDeleteAll || isDeletingAll) {
      return;
    }

    setIsDeletingAll(true);
    setDeleteError(null);
    try {
      await onDeleteAll();
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : t("Не удалось удалить историю связок."),
      );
    } finally {
      setIsDeletingAll(false);
    }
  }

  return (
    <main className="min-h-full bg-[#08090d] text-[#e7e9ee]">
      <section className="mx-auto min-h-full w-full max-w-[1120px] px-[15px] pb-3 sm:px-5 sm:pb-6 lg:px-8 lg:pb-10">
        <header className="sticky top-0 z-30 -mx-[15px] flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#08090d]/95 px-[15px] py-3 backdrop-blur-xl sm:-mx-5 sm:gap-4 sm:px-5 sm:py-4 lg:-mx-8 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onBack}
              aria-label={t("Вернуться на главную")}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#c5ccd6] transition hover:bg-white/[0.07] hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {t("Все связки")}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-[#b9c1cc] sm:text-base">
              {history.length} {getSavedWord(history.length)}
            </span>
            {history.length > 0 && onDeleteAll ? (
              <button
                type="button"
                onClick={openDeleteConfirm}
                aria-label={t("Удалить все связки")}
                title={t("Удалить все связки")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-300/20 text-red-200 transition hover:border-red-300/35 hover:bg-red-400/10 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
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
            <p className="text-sm text-[#87909d]">{t("История пока пустая")}</p>
          </div>
        )}

      </section>

      <div
        className={cn(
          "fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 transition-opacity duration-200",
          isDeleteConfirmOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden={!isDeleteConfirmOpen}
        onClick={closeDeleteConfirm}
      >
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-all-trades-title"
          aria-describedby="delete-all-trades-description"
          className={cn(
            "w-full max-w-md rounded-xl border border-white/10 bg-[#11141a] p-4 text-[#e7e9ee] shadow-2xl shadow-black transition duration-200 sm:p-5",
            isDeleteConfirmOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-[0.98] opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-300/25 bg-red-400/10">
              <AlertTriangle className="h-5 w-5 text-red-300" />
            </div>
            <div className="min-w-0">
              <h2
                id="delete-all-trades-title"
                className="text-lg font-semibold text-white"
              >
                {t("Удалить всю историю?")}
              </h2>
              <p
                id="delete-all-trades-description"
                className="mt-1 text-sm leading-6 text-[#aeb7c3]"
              >
                {t("Будет удалена вся история: {count} {word}. Восстановить её будет невозможно.", {
                  count: history.length,
                  word: getSavedWord(history.length),
                })}
              </p>
            </div>
          </div>

          {deleteError ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm text-red-100"
            >
              {deleteError}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={closeDeleteConfirm}
              disabled={isDeletingAll}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 px-3 text-sm font-medium text-[#c5ccd6] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              {t("Отмена")}
            </button>
            <button
              type="button"
              onClick={() => void deleteAll()}
              disabled={isDeletingAll}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-400/90 px-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isDeletingAll ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t(isDeletingAll ? "Удаляем..." : "Удалить всё")}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function getSavedWord(count: number) {
  if (getAppLanguage() === "en") {
    return count === 1 ? "trade" : "trades";
  }
  if (count === 1) {
    return "связка";
  }

  if (count >= 2 && count <= 4) {
    return "связки";
  }

  return "связок";
}
