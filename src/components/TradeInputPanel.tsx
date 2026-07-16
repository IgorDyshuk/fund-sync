import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Copy,
  Loader2,
  PencilLine,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import type { AppStatus } from "../types/app";
import { FileDrop } from "./FileDrop";
import { StatusPill } from "./StatusPill";

type TradeInputPanelProps = {
  files: File[];
  instructions: string;
  status: AppStatus;
  error: string | null;
  onFilesChange: (files: File[]) => void;
  onInstructionsChange: (instructions: string) => void;
  onAnalyze: () => void;
  onManual?: () => void;
  onReset: () => void;
};

export function TradeInputPanel({
  files,
  instructions,
  status,
  error,
  onFilesChange,
  onInstructionsChange,
  onAnalyze,
  onManual,
  onReset,
}: TradeInputPanelProps) {
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  async function copyErrorText() {
    if (!error) {
      return;
    }

    try {
      await copyTextToClipboard(error);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <>
      <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#101217] p-3 shadow-2xl shadow-black/30 lg:min-h-full lg:gap-2.5">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 lg:pb-2.5">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#9aa3af] lg:text-xs">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Fund Sync
            </div>
            <h1 className="mt-1 text-xl font-semibold text-white lg:text-lg">
              Связка сделки
            </h1>
          </div>
          <StatusPill status={status} />
        </div>

        <FileDrop
          title="Скриншоты сделки"
          files={files}
          inputName="trade"
          accent="emerald"
          description="Загрузи все фото одной связки: фьючерсы, спот, балансы, ордера, депозиты и выводы."
          onFilesChange={onFilesChange}
        />

        <label className="flex flex-1 flex-col gap-2">
          <span className="flex items-center gap-2 text-sm font-medium text-[#dce2ea] lg:text-[13px]">
            <ClipboardCheck className="h-4 w-4 text-amber-300" />
            Условия и корректировки
          </span>
          <textarea
            value={instructions}
            onChange={(event) => onInstructionsChange(event.target.value)}
            placeholder="Например: спот вышел в -16.9 USDT"
            className="min-h-24 resize-none rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20 lg:min-h-[112px] lg:flex-1"
          />
        </label>

        {error ? (
          <button
            type="button"
            onClick={() => {
              setCopyStatus("idle");
              setIsErrorModalOpen(true);
            }}
            className="inline-flex min-h-11 items-center justify-between gap-3 rounded-lg border border-red-300/40 bg-red-500/20 px-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 hover:text-white"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-200" />
              Error
            </span>
            <span className="shrink-0 text-xs font-medium text-red-100/70">
              Открыть
            </span>
          </button>
        ) : null}

        <div className="grid gap-2">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            {onManual ? (
              <button
                type="button"
                onClick={onManual}
                disabled={status === "analyzing"}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-3 text-xs font-semibold text-[#c5ccd6] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40 lg:min-h-10"
              >
                <PencilLine className="h-3.5 w-3.5" />
                Вручную
              </button>
            ) : null}
            <button
              type="button"
              onClick={onAnalyze}
              disabled={status === "analyzing"}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/40 lg:min-h-10"
            >
              {status === "analyzing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Анализировать
            </button>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white lg:min-h-9"
          >
            <RefreshCcw className="h-4 w-4" />
            Очистить
          </button>
        </div>
      </section>

      {error && isErrorModalOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
          onClick={() => setIsErrorModalOpen(false)}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="error-modal-title"
            aria-describedby="error-modal-description"
            className="w-full max-w-lg rounded-xl border border-red-300/20 bg-[#11141a] p-4 text-[#e7e9ee] shadow-2xl shadow-black sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-300/25 bg-red-400/10">
                  <AlertTriangle className="h-5 w-5 text-red-200" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="error-modal-title"
                    className="text-lg font-semibold text-white"
                  >
                    Ошибка анализа
                  </h3>
                  <p className="mt-1 text-sm text-[#aeb7c3]">
                    Полный текст ошибки можно скопировать.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsErrorModalOpen(false)}
                aria-label="Закрыть"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              id="error-modal-description"
              className="mt-4 max-h-[45vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-red-300/20 bg-red-500/10 p-3 text-sm leading-6 text-red-50"
            >
              {error}
            </div>

            <div className="mt-4 grid gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={copyErrorText}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-[#dce2ea] transition hover:bg-white/[0.06] hover:text-white"
              >
                {copyStatus === "copied" ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copyStatus === "copied"
                  ? "Скопировано"
                  : copyStatus === "failed"
                    ? "Не скопировано"
                    : "Копировать"}
              </button>
              <button
                type="button"
                onClick={() => setIsErrorModalOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200"
              >
                Закрыть
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  document.body.append(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}
