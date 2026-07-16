import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  PencilLine,
  Save,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type {
  TradeCsvImportDraft,
  TradeCsvImportReport,
  TradeCsvImportRowResult,
} from "../lib/tradeCsvImport";
import { translate as t } from "../lib/i18n";
import { cn } from "../utils/cn";

type CsvImportResultDialogProps = {
  isOpen: boolean;
  report: TradeCsvImportReport;
  onClose: () => void;
  onResolveRow?: (
    row: TradeCsvImportRowResult,
    values: TradeCsvImportDraft,
  ) => Promise<void>;
};

export function CsvImportResultDialog({
  isOpen,
  report,
  onClose,
  onResolveRow,
}: CsvImportResultDialogProps) {
  const problemRows = report.rows.filter((row) => row.status !== "imported");
  const [editingRow, setEditingRow] = useState<TradeCsvImportRowResult | null>(null);
  const [draft, setDraft] = useState<TradeCsvImportDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (editingRow && !isSaving) {
          setEditingRow(null);
          setDraft(null);
          setSaveError(null);
        } else if (!isSaving) {
          onClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingRow, isOpen, isSaving, onClose]);

  function startEditing(row: TradeCsvImportRowResult) {
    if (!row.values) {
      return;
    }
    setEditingRow(row);
    setDraft(row.values);
    setSaveError(null);
  }

  function stopEditing() {
    if (isSaving) {
      return;
    }
    setEditingRow(null);
    setDraft(null);
    setSaveError(null);
  }

  async function saveManualTrade() {
    if (!editingRow || !draft || !onResolveRow) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onResolveRow(editingRow, draft);
      setEditingRow(null);
      setDraft(null);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : t("Не удалось сохранить связку."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        "fixed inset-0 z-[110] grid place-items-center bg-black/75 p-4 transition-opacity duration-200 ease-out",
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-import-result-title"
        className={cn(
          "flex max-h-[min(88svh,46rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#11141a] text-[#e7e9ee] shadow-2xl shadow-black transition-opacity duration-200 ease-out",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10">
              <FileSpreadsheet className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 id="csv-import-result-title" className="text-lg font-semibold text-white">
                {t("Результат импорта")}
              </h2>
              <p className="mt-0.5 truncate text-xs text-[#929ca9]" title={report.fileName}>
                {report.fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Закрыть результат импорта")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2">
            <SummaryMetric label={t("Добавлено")} value={report.importedCount} tone="success" />
            <SummaryMetric label={t("Дубликаты")} value={report.duplicateCount} tone="warning" />
            <SummaryMetric label={t("Ошибки")} value={report.invalidCount} tone="error" />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-white">
              {t(problemRows.length > 0 ? "Строки, требующие внимания" : "Импорт завершен")}
            </h3>

            {problemRows.length > 0 ? (
              <div className="mt-2 divide-y divide-white/10 border-y border-white/10">
                {problemRows.map((row, index) => (
                  <ProblemRow
                    key={`${row.row ?? "file"}-${row.tradeId ?? index}`}
                    result={row}
                    onEdit={
                      onResolveRow && row.status === "error" && row.values
                        ? () => startEditing(row)
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 text-sm text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t("Все строки обработаны без ошибок.")}</p>
              </div>
            )}
          </div>

        </div>

        <footer className="border-t border-white/10 p-4 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07120f] transition hover:bg-emerald-200"
          >
            {t("Готово")}
          </button>
        </footer>

        {editingRow && draft ? (
          <ManualTradeForm
            row={editingRow}
            draft={draft}
            error={saveError}
            isSaving={isSaving}
            onChange={setDraft}
            onCancel={stopEditing}
            onSave={() => void saveManualTrade()}
          />
        ) : null}
      </section>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "error";
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-2.5 py-3",
        tone === "success" && "border-emerald-300/20 bg-emerald-300/[0.06]",
        tone === "warning" && "border-amber-300/20 bg-amber-300/[0.06]",
        tone === "error" && "border-red-300/20 bg-red-400/[0.06]",
      )}
    >
      <p className="truncate text-[11px] text-[#929ca9] sm:text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          tone === "success" && "text-emerald-200",
          tone === "warning" && "text-amber-200",
          tone === "error" && "text-red-200",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ProblemRow({
  result,
  onEdit,
}: {
  result: TradeCsvImportRowResult;
  onEdit?: () => void;
}) {
  const isError = result.status === "error";
  const Icon = isError ? AlertTriangle : Info;
  const location = result.row === null
    ? t("Файл")
    : t("Строка {row}", { row: result.row });

  return (
    <div className="flex items-center gap-2.5 py-3 first:pt-3 last:pb-3 sm:gap-3">
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isError ? "text-red-300" : "text-amber-300",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">
          {location}
          {result.symbol ? ` · ${result.symbol}` : ""}
        </p>
        {result.period ? (
          <p className="mt-0.5 break-words text-xs text-[#929ca9]">{result.period}</p>
        ) : null}
        <p className={cn("mt-1 text-sm leading-5", isError ? "text-red-200" : "text-amber-100")}>
          {t(result.message)}
        </p>
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.06] sm:gap-2 sm:px-3 sm:text-xs"
        >
          <PencilLine className="h-3.5 w-3.5" />
          {t("Заполнить вручную")}
        </button>
      ) : null}
    </div>
  );
}

function ManualTradeForm({
  row,
  draft,
  error,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: {
  row: TradeCsvImportRowResult;
  draft: TradeCsvImportDraft;
  error: string | null;
  isSaving: boolean;
  onChange: (draft: TradeCsvImportDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  function update(field: keyof TradeCsvImportDraft, value: string) {
    onChange({ ...draft, [field]: value });
  }

  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-black/80 p-3 sm:p-5"
      onClick={(event) => {
        event.stopPropagation();
        onCancel();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-csv-trade-title"
        className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-[#11141a] shadow-2xl shadow-black"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <PencilLine className="h-4 w-4 shrink-0 text-emerald-300" />
            <h3 id="manual-csv-trade-title" className="truncate text-base font-semibold text-white">
              {t("Заполнить строку {row}", { row: row.row ?? t("вручную") })}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            aria-label={t("Закрыть ручное заполнение")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs leading-5 text-[#929ca9]">
            {t("Уже распознанные значения сохранены. Дополните или исправьте недостающие поля.")}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <FormField label={t("Монета")} required className="col-span-1">
              <input
                value={draft.symbol}
                onChange={(event) => update("symbol", event.target.value)}
                placeholder="BTCUSDT"
                required
                autoFocus
                className={inputClassName}
              />
            </FormField>
            <FormField label={t("Итог, USDT")} required className="col-span-1">
              <input
                value={draft.total}
                onChange={(event) => update("total", event.target.value)}
                placeholder="15,80"
                inputMode="decimal"
                required
                className={inputClassName}
              />
            </FormField>
            <FormField label={t("Период")} required className="col-span-2">
              <input
                value={draft.period}
                onChange={(event) => update("period", event.target.value)}
                placeholder="30.06.2026 21:48 — 01.07.2026 09:37"
                required
                className={inputClassName}
              />
            </FormField>
            <FormField label="PnL Long">
              <input
                value={draft.longPnl}
                onChange={(event) => update("longPnl", event.target.value)}
                placeholder="-"
                inputMode="decimal"
                className={inputClassName}
              />
            </FormField>
            <FormField label="PnL Short">
              <input
                value={draft.shortPnl}
                onChange={(event) => update("shortPnl", event.target.value)}
                placeholder="-"
                inputMode="decimal"
                className={inputClassName}
              />
            </FormField>
            <FormField label={t("Спред входа, %")}>
              <input
                value={draft.spreadEntry}
                onChange={(event) => update("spreadEntry", event.target.value)}
                placeholder="-"
                inputMode="decimal"
                className={inputClassName}
              />
            </FormField>
            <FormField label={t("Спред выхода, %")}>
              <input
                value={draft.spreadExit}
                onChange={(event) => update("spreadExit", event.target.value)}
                placeholder="-"
                inputMode="decimal"
                className={inputClassName}
              />
            </FormField>
            <FormField label={t("Количество монет")} className="col-span-2">
              <input
                value={draft.quantity}
                onChange={(event) => update("quantity", event.target.value)}
                placeholder={t("Необязательно")}
                inputMode="decimal"
                className={inputClassName}
              />
            </FormField>
            <FormField label={t("Спред принес")} className="col-span-2">
              <input
                value={draft.spreadContribution}
                onChange={(event) => update("spreadContribution", event.target.value)}
                placeholder={t("Необязательно")}
                className={inputClassName}
              />
            </FormField>
          </div>

          {error ? (
            <p role="alert" className="mt-3 rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="grid grid-cols-[0.85fr_1.15fr] gap-2 border-t border-white/10 p-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="min-h-10 rounded-lg border border-white/10 px-3 text-sm font-semibold text-[#c6ccd5] transition hover:bg-white/[0.05] disabled:opacity-50"
          >
            {t("Отмена")}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-300 px-2 text-xs font-semibold text-[#07120f] transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-60 sm:gap-2 sm:px-3 sm:text-sm"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t(isSaving ? "Сохраняем..." : "Сохранить связку")}
          </button>
        </footer>
      </form>
    </div>
  );
}

function FormField({
  label,
  required = false,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("min-w-0", className)}>
      <span className="mb-1.5 block text-xs text-[#aeb6c1]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "min-h-10 w-full rounded-lg border border-white/10 bg-[#090c11] px-3 text-sm text-white outline-none transition placeholder:text-[#646d79] focus:border-emerald-300/45";
