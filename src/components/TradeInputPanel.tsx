import {
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
  onReset,
}: TradeInputPanelProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#101217] p-3 shadow-2xl shadow-black/30 lg:sticky lg:top-5 lg:min-h-[calc(100vh-2.5rem)]">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#9aa3af]">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Fund Sync
          </div>
          <h1 className="mt-1 text-xl font-semibold text-white">Связка сделки</h1>
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
        <span className="flex items-center gap-2 text-sm font-medium text-[#dce2ea]">
          <ClipboardCheck className="h-4 w-4 text-amber-300" />
          Условия и корректировки
        </span>
        <textarea
          value={instructions}
          onChange={(event) => onInstructionsChange(event.target.value)}
          placeholder="Например: спот считать 15,54 USDT; комиссия уже учтена"
          className="min-h-24 resize-none rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20 lg:flex-1"
        />
      </label>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-2">
        <button
          type="button"
          onClick={onAnalyze}
          disabled={status === "analyzing"}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200 disabled:bg-white/10 disabled:text-white/40"
        >
          {status === "analyzing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Анализировать
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-medium text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCcw className="h-4 w-4" />
          Очистить
        </button>
      </div>
    </section>
  );
}
