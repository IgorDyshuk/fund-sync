import { AlertTriangle, Check, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import type { AnalysisResponse } from "../lib/analysisSchema";
import type { TradeCalculation } from "../lib/tradeCalculator";
import type { AppStatus, ConflictDraft } from "../types/app";
import { cn } from "../utils/cn";
import { ConflictReview } from "./ConflictReview";
import { ResultDashboard } from "./ResultDashboard";
import { SpotSignPrompt } from "./SpotSignPrompt";
import { TradeInputPanel } from "./TradeInputPanel";

const mobileResultRevealClass =
  "duration-[0ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
const mobileResultScrollDurationMs = 700;

type AnalyzeSheetProps = {
  isOpen: boolean;
  files: File[];
  instructions: string;
  status: AppStatus;
  error: string | null;
  analysis: AnalysisResponse | null;
  resultAnalysis: AnalysisResponse | null;
  calculation: TradeCalculation | null;
  conflictDrafts: Record<string, ConflictDraft>;
  onClose: () => void;
  onFilesChange: (files: File[]) => void;
  onInstructionsChange: (instructions: string) => void;
  onAnalyze: () => void;
  onManual?: () => void;
  onReset: () => void;
  onDraftsChange: (drafts: Record<string, ConflictDraft>) => void;
  onApplyConflicts: () => void;
  onDone: () => void | Promise<void>;
  onRetry: () => void;
  isSaving?: boolean;
  isNestedDialogOpen?: boolean;
  spotSignPromptOpen: boolean;
  onSpotSignSelect: (sign: "positive" | "negative") => void;
};

export function AnalyzeSheet({
  isOpen,
  files,
  instructions,
  status,
  error,
  analysis,
  resultAnalysis,
  calculation,
  conflictDrafts,
  onClose,
  onFilesChange,
  onInstructionsChange,
  onAnalyze,
  onManual,
  onReset,
  onDraftsChange,
  onApplyConflicts,
  onDone,
  onRetry,
  isSaving = false,
  isNestedDialogOpen = false,
  spotSignPromptOpen,
  onSpotSignSelect,
}: AnalyzeSheetProps) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const closeSwipeStartYRef = useRef<number | null>(null);
  const closeSwipeLastYRef = useRef<number | null>(null);
  const showDoneActions = status === "result" && Boolean(calculation);
  const showRetryAction = status === "error";
  const showFooterActions = showDoneActions || showRetryAction;
  const showResultPanel =
    (status === "review" && Boolean(analysis?.conflicts.length)) ||
    status === "result" ||
    Boolean(resultAnalysis);

  useEffect(() => {
    if (status !== "result" || !showResultPanel) {
      return;
    }

    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) {
      return;
    }

    let cancelScroll = () => {};

    const timeoutId = window.setTimeout(() => {
      if (!scrollContainerRef.current || !resultPanelRef.current) {
        return;
      }

      cancelScroll = scrollToElementInContainer({
        container: scrollContainerRef.current,
        element: resultPanelRef.current,
        durationMs: mobileResultScrollDurationMs,
      });
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
      cancelScroll();
    };
  }, [showResultPanel, status, resultAnalysis]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.repeat) {
        return;
      }

      if (isNestedDialogOpen) {
        return;
      }

      event.preventDefault();

      if (showCloseConfirm) {
        setShowCloseConfirm(false);
      } else if (showDoneActions) {
        setShowCloseConfirm(true);
      } else {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNestedDialogOpen, isOpen, onClose, showCloseConfirm, showDoneActions]);

  function requestClose() {
    if (showDoneActions) {
      setShowCloseConfirm(true);
      return;
    }

    onClose();
  }

  function saveAndClose() {
    setShowCloseConfirm(false);
    onDone();
  }

  function discardAndClose() {
    setShowCloseConfirm(false);
    onClose();
  }

  function handleCloseSwipeStart(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1) {
      return;
    }

    closeSwipeStartYRef.current = event.touches[0].clientY;
    closeSwipeLastYRef.current = event.touches[0].clientY;
  }

  function handleCloseSwipeMove(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1 || closeSwipeStartYRef.current === null) {
      return;
    }

    closeSwipeLastYRef.current = event.touches[0].clientY;
  }

  function handleCloseSwipeEnd() {
    const startY = closeSwipeStartYRef.current;
    const lastY = closeSwipeLastYRef.current;
    closeSwipeStartYRef.current = null;
    closeSwipeLastYRef.current = null;

    if (startY === null || lastY === null || showCloseConfirm) {
      return;
    }

    if (lastY - startY > 72) {
      requestClose();
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
        aria-label="Закрыть окно анализа"
        onClick={requestClose}
        className={cn(
          "absolute inset-0 bg-black/70 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Анализ связки"
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[94svh] w-full max-w-[1360px] transform-gpu flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#08090d] text-[#e7e9ee] shadow-2xl shadow-black transition-transform duration-300 ease-out will-change-transform lg:max-h-[92vh]",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <header
          className="flex min-h-14 touch-pan-y items-center justify-between gap-3 border-b border-white/10 bg-[#0d0f14] px-3 sm:px-4"
          onTouchStart={handleCloseSwipeStart}
          onTouchMove={handleCloseSwipeMove}
          onTouchEnd={handleCloseSwipeEnd}
          onTouchCancel={handleCloseSwipeEnd}
        >
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white sm:text-lg">
              Новая связка
            </h2>
            <p className="truncate text-xs text-[#9aa3af]">
              Загрузка скриншотов, анализ и сохранение итога
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Закрыть"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          ref={scrollContainerRef}
          className="min-h-0 overflow-y-auto p-3 md:px-4 lg:grid lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-3 lg:py-4"
        >
          <div className="mx-auto w-full max-w-[520px] lg:mx-0 lg:max-w-none">
            <TradeInputPanel
              files={files}
              instructions={instructions}
              status={status}
              error={error}
              onFilesChange={onFilesChange}
              onInstructionsChange={onInstructionsChange}
              onAnalyze={onAnalyze}
              onManual={onManual}
              onReset={onReset}
            />
          </div>

          <div
            ref={resultPanelRef}
            className={cn(
              "mx-auto grid w-full max-w-[1120px] transition-[grid-template-rows,opacity,margin-top] lg:mx-0 lg:max-w-none lg:transition-[max-height,min-height,opacity,border-color] lg:duration-300 lg:ease-out",
              mobileResultRevealClass,
              showResultPanel
                ? "mt-3 grid-rows-[1fr] opacity-100 lg:mt-0 lg:min-h-full lg:max-h-[1800px]"
                : "mt-0 grid-rows-[0fr] opacity-0 lg:min-h-0 lg:max-h-0",
            )}
          >
            <div className="min-h-0 overflow-hidden lg:h-full">
              {showResultPanel ? (
                <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0d0f14] shadow-2xl shadow-black/30 lg:min-h-full">
                  {status === "review" && analysis ? (
                    <ConflictReview
                      analysis={analysis}
                      drafts={conflictDrafts}
                      onDraftsChange={onDraftsChange}
                      onApply={onApplyConflicts}
                    />
                  ) : (
                    <ResultDashboard
                      analysis={resultAnalysis}
                      calculation={calculation}
                      isLoading={false}
                    />
                  )}
                </section>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "grid shrink-0 transition-[grid-template-rows,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
            showFooterActions
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!showFooterActions}
        >
          <div className="min-h-0 overflow-hidden">
            <footer
              className={cn(
                "grid gap-2 border-t border-white/10 bg-[#0d0f14] p-3 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:flex sm:justify-end",
                showFooterActions
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0",
              )}
            >
              {showDoneActions ? (
                <>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-[#c5ccd6] transition hover:bg-white/[0.06] hover:text-white sm:min-w-36"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Повторить
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDone()}
                    disabled={isSaving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-5 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/40 sm:min-w-36"
                  >
                    <Check className="h-4 w-4" />
                    {isSaving ? "Сохраняем..." : "Готово"}
                  </button>
                </>
              ) : null}

              {showRetryAction ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-[#c5ccd6] transition hover:bg-white/[0.06] hover:text-white sm:min-w-36"
                >
                  <RotateCcw className="h-4 w-4" />
                  Повторить
                </button>
              ) : null}
            </footer>
          </div>
        </div>
      </section>

      <div
        className={cn(
          "absolute inset-0 z-50 grid place-items-center bg-black/65 p-4 transition-opacity duration-200",
          showCloseConfirm
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden={!showCloseConfirm}
        onClick={() => setShowCloseConfirm(false)}
      >
        <section
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="close-result-title"
          aria-describedby="close-result-description"
          className={cn(
            "w-full max-w-xl rounded-xl border border-white/10 bg-[#11141a] p-4 text-[#e7e9ee] shadow-2xl shadow-black transition duration-200 sm:p-5",
            showCloseConfirm
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-[0.98] opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3
                id="close-result-title"
                className="text-lg font-semibold text-white"
              >
                Сохранить результат?
              </h3>
              <p
                id="close-result-description"
                className="mt-1 text-sm leading-6 text-[#aeb7c3]"
              >
                Итог по связке уже рассчитан. Сохрани его в историю или закрой
                окно без сохранения.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-center">
            <button
              type="button"
              onClick={discardAndClose}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-red-300/25 px-3 text-sm font-medium text-red-100 transition hover:bg-red-400/10 hover:text-white sm:order-1 sm:px-4"
            >
              <Trash2 className="h-4 w-4" />
              Не сохранять
            </button>
            <button
              type="button"
              onClick={() => setShowCloseConfirm(false)}
              className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg border border-white/10 px-3 text-sm font-medium text-[#c5ccd6] transition hover:bg-white/[0.06] hover:text-white sm:order-2 sm:px-4"
            >
              Остаться
            </button>
            <button
              type="button"
              onClick={saveAndClose}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-300 px-3 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200 sm:order-3 sm:justify-self-end sm:px-4"
            >
              <Save className="h-4 w-4" />
              Сохранить
            </button>
          </div>
        </section>
      </div>

      {spotSignPromptOpen ? (
        <SpotSignPrompt
          amount={analysis?.spot.rawPnlUsdt}
          onSelect={onSpotSignSelect}
        />
      ) : null}
    </div>
  );
}

function scrollToElementInContainer({
  container,
  element,
  durationMs,
}: {
  container: HTMLElement;
  element: HTMLElement;
  durationMs: number;
}) {
  const start = container.scrollTop;
  const startedAt = performance.now();
  let frameId = 0;
  let cancelled = false;

  function easeOutCubic(progress: number) {
    return 1 - (1 - progress) ** 3;
  }

  function animate(now: number) {
    if (cancelled) {
      return;
    }

    const progress = Math.min((now - startedAt) / durationMs, 1);
    const target = getElementBottomScrollTarget(container, element);
    container.scrollTop = start + (target - start) * easeOutCubic(progress);

    if (progress < 1) {
      frameId = requestAnimationFrame(animate);
    }
  }

  frameId = requestAnimationFrame(animate);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
  };
}

function getElementBottomScrollTarget(
  container: HTMLElement,
  element: HTMLElement,
) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const maxScroll = container.scrollHeight - container.clientHeight;
  const target =
    container.scrollTop + elementRect.bottom - containerRect.bottom + 12;

  return Math.max(0, Math.min(maxScroll, target));
}
