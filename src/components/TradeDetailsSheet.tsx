import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { SavedTrade } from "../types/app";
import { cn } from "../utils/cn";
import { ResultDashboard } from "./ResultDashboard";

type TradeDetailsSheetProps = {
  trade: SavedTrade;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
};

export function TradeDetailsSheet({
  trade,
  isOpen,
  onClose,
  onDelete,
}: TradeDetailsSheetProps) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const swipeStartYRef = useRef<number | null>(null);
  const swipeLastYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDeleteConfirmOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDeleteConfirmOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleteConfirmOpen]);

  function handleSwipeStart(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1) {
      return;
    }

    swipeStartYRef.current = event.touches[0].clientY;
    swipeLastYRef.current = event.touches[0].clientY;
  }

  function handleSwipeMove(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1 || swipeStartYRef.current === null) {
      return;
    }

    swipeLastYRef.current = event.touches[0].clientY;
  }

  function handleSwipeEnd() {
    const startY = swipeStartYRef.current;
    const lastY = swipeLastYRef.current;
    swipeStartYRef.current = null;
    swipeLastYRef.current = null;

    if (startY !== null && lastY !== null && lastY - startY > 72) {
      onClose();
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      <button
        type="button"
        aria-label="Закрыть информацию о связке"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/70 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Информация о связке"
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[94svh] w-full max-w-[1050px] transform-gpu flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#08090d] text-[#e7e9ee] shadow-2xl shadow-black transition-transform duration-300 ease-out will-change-transform lg:max-h-[92vh]",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <header
          className="flex min-h-14 touch-pan-y items-center justify-between gap-3 border-b border-white/10 bg-[#0d0f14] px-3 sm:px-4"
          onTouchStart={handleSwipeStart}
          onTouchMove={handleSwipeMove}
          onTouchEnd={handleSwipeEnd}
          onTouchCancel={handleSwipeEnd}
        >
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white sm:text-lg">
              Информация о связке
            </h2>
            <p className="truncate text-xs text-[#9aa3af]">
              Сохранённый результат сделки
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:px-4 lg:py-4">
          <section className="mx-auto w-full max-w-none overflow-hidden rounded-lg border border-white/10 bg-[#0d0f14] shadow-2xl shadow-black/30">
            <ResultDashboard
              analysis={trade.analysis}
              calculation={trade.calculation}
              isLoading={false}
            />
          </section>
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-[#0d0f14] p-3 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-300/25 px-4 text-sm font-medium text-red-100 transition hover:bg-red-400/10 hover:text-white sm:w-auto sm:min-w-40"
          >
            <Trash2 className="h-4 w-4" />
            Удалить связку
          </button>
        </footer>
      </section>

      <div
        className={cn(
          "absolute inset-0 z-50 grid place-items-center bg-black/70 p-4 transition-opacity duration-200",
          isDeleteConfirmOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden={!isDeleteConfirmOpen}
        onClick={() => setIsDeleteConfirmOpen(false)}
      >
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-trade-title"
          aria-describedby="delete-trade-description"
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
              <h3
                id="delete-trade-title"
                className="text-lg font-semibold text-white"
              >
                Удалить связку?
              </h3>
              <p
                id="delete-trade-description"
                className="mt-1 text-sm leading-6 text-[#aeb7c3]"
              >
                Итог будет удалён из истории без возможности восстановления.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-white/10 px-3 text-sm font-medium text-[#c5ccd6] transition hover:bg-white/[0.06] hover:text-white"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-red-400/90 px-3 text-sm font-semibold text-white transition hover:bg-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
