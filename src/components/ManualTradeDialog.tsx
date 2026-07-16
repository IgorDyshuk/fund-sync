import {
  CalendarClock,
  CalendarRange,
  LoaderCircle,
  PencilLine,
  Save,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { TradeCsvImportDraft } from "../lib/tradeCsvImport";
import { translate as t } from "../lib/i18n";
import { cn } from "../utils/cn";

type ManualTradeDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  initialValues?: TradeCsvImportDraft;
  onClose: () => void;
  onSave: (values: TradeCsvImportDraft) => Promise<void>;
};

export function ManualTradeDialog({
  isOpen,
  title,
  description,
  initialValues,
  onClose,
  onSave,
}: ManualTradeDialogProps) {
  const initialPeriod = readPeriodInputs(initialValues?.period ?? "");
  const [draft, setDraft] = useState<TradeCsvImportDraft>(() =>
    initialValues ? { ...initialValues } : createEmptyDraft(),
  );
  const [startedAt, setStartedAt] = useState(initialPeriod.startedAt);
  const [endedAt, setEndedAt] = useState(initialPeriod.endedAt);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const closeDialog = useCallback(() => {
    const nextPeriod = readPeriodInputs(initialValues?.period ?? "");
    setDraft(initialValues ? { ...initialValues } : createEmptyDraft());
    setStartedAt(nextPeriod.startedAt);
    setEndedAt(nextPeriod.endedAt);
    setSaveError(null);
    onClose();
  }, [initialValues, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        closeDialog();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, isOpen, isSaving]);

  function update(field: keyof TradeCsvImportDraft, value: string) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function updatePeriod(nextStartedAt: string, nextEndedAt: string) {
    setStartedAt(nextStartedAt);
    setEndedAt(nextEndedAt);
    update("period", formatPeriod(nextStartedAt, nextEndedAt));
    setSaveError(null);
  }

  async function submit() {
    if (isSaving) {
      return;
    }

    if (!startedAt || !endedAt) {
      setSaveError(t("Укажите дату и время начала и окончания связки."));
      return;
    }

    if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
      setSaveError(t("Окончание связки должно быть позже её начала."));
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
      closeDialog();
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
        "fixed inset-0 z-[130] grid place-items-center bg-black/80 p-3 transition-opacity duration-200 ease-out sm:p-5",
        isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      onClick={(event) => {
        event.stopPropagation();
        if (!isSaving) {
          closeDialog();
        }
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-trade-title"
        noValidate
        className={cn(
          "flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-white/10 bg-[#11141a] shadow-2xl shadow-black transition-opacity duration-200 ease-out",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <PencilLine className="h-4 w-4 shrink-0 text-emerald-300" />
            <h3
              id="manual-trade-title"
              className="truncate text-base font-semibold text-white"
            >
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={isSaving}
            aria-label={t("Закрыть ручное добавление")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[#b9c0ca] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs leading-5 text-[#929ca9]">{description}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <FormField label={t("Монета")} required>
              <input
                value={draft.symbol}
                onChange={(event) => update("symbol", event.target.value)}
                placeholder="BTCUSDT"
                required
                autoFocus
                className={inputClassName}
              />
            </FormField>
            <FormField label={t("Итог, USDT")} required>
              <input
                value={draft.total}
                onChange={(event) => update("total", event.target.value)}
                placeholder="15,80"
                inputMode="decimal"
                required
                className={inputClassName}
              />
            </FormField>
            <fieldset className="col-span-2 min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#0c0f14] p-3">
              <legend className="px-1 text-xs text-[#aeb6c1]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5 text-emerald-300" />
                  {t("Период")} *
                </span>
              </legend>
              <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
                <DateTimePickerField
                  id="manual-trade-started-at"
                  label={t("Начало")}
                  value={startedAt}
                  max={endedAt || undefined}
                  onChange={(value) => updatePeriod(value, endedAt)}
                />
                <DateTimePickerField
                  id="manual-trade-ended-at"
                  label={t("Окончание")}
                  value={endedAt}
                  min={startedAt || undefined}
                  onChange={(value) => updatePeriod(startedAt, value)}
                />
              </div>
            </fieldset>
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

          {saveError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            >
              {saveError}
            </p>
          ) : null}
        </div>

        <footer className="grid grid-cols-[0.85fr_1.15fr] gap-2 border-t border-white/10 p-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={closeDialog}
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
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
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
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  if (htmlFor) {
    return (
      <div className={cn("min-w-0", className)}>
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block text-xs text-[#aeb6c1]"
        >
          {label}
          {required ? " *" : ""}
        </label>
        {children}
      </div>
    );
  }

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

function DateTimePickerField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label} required htmlFor={id}>
      <span className="relative block min-h-10 min-w-0 max-w-full overflow-hidden rounded-lg border border-white/10 bg-[#090c11]">
        <span
          aria-hidden="true"
          className="flex min-h-10 min-w-0 items-center justify-between gap-1.5 px-2 text-xs text-white sm:gap-2 sm:px-3 sm:text-sm"
        >
          <span className={cn("min-w-0 truncate", !value && "text-[#646d79]")}>
            {value ? formatPickerValue(value) : t("Выбрать дату и время")}
          </span>
          <CalendarClock className="h-4 w-4 shrink-0 text-[#7d8794]" />
        </span>
        <input
          id={id}
          type="datetime-local"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          required
          className="absolute inset-0 z-10 block h-full w-full min-w-0 max-w-full cursor-pointer opacity-0"
        />
      </span>
    </FormField>
  );
}

function createEmptyDraft(): TradeCsvImportDraft {
  return {
    symbol: "",
    period: "",
    quantity: "",
    spreadEntry: "",
    spreadExit: "",
    longPnl: "",
    shortPnl: "",
    spreadContribution: "",
    total: "",
  };
}

function formatPeriod(startedAt: string, endedAt: string) {
  if (!startedAt || !endedAt) {
    return "";
  }

  const formattedStart = formatDateTimeInput(startedAt);
  const formattedEnd = formatDateTimeInput(endedAt);
  const sameDate = formattedStart.slice(0, 10) === formattedEnd.slice(0, 10);

  return `${formattedStart} — ${sameDate ? formattedEnd.slice(11) : formattedEnd}`;
}

function formatDateTimeInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return "";
  }

  const [, year, month, day, hours, minutes] = match;
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function readPeriodInputs(period: string) {
  const matches = Array.from(
    period.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/g),
  );

  const startedAt = matches[0] ? toDateTimeInput(matches[0]) : "";
  if (!startedAt) {
    return { startedAt: "", endedAt: "" };
  }

  if (matches[1]) {
    return { startedAt, endedAt: toDateTimeInput(matches[1]) };
  }

  const endTimeMatch = period
    .split(/\s+[—–]\s+|\s+-\s+/)[1]
    ?.match(/^(\d{1,2}):(\d{2})$/);
  if (!endTimeMatch) {
    return { startedAt, endedAt: "" };
  }

  const endedDate = new Date(startedAt);
  endedDate.setHours(Number(endTimeMatch[1]), Number(endTimeMatch[2]), 0, 0);
  if (endedDate.getTime() <= new Date(startedAt).getTime()) {
    endedDate.setDate(endedDate.getDate() + 1);
  }

  return { startedAt, endedAt: toLocalDateTimeInput(endedDate) };
}

function toDateTimeInput(match: RegExpMatchArray) {
  const [, day, month, year, hours, minutes] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes}`;
}

function toLocalDateTimeInput(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatPickerValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return t("Выбрать дату и время");
  }

  const [, year, month, day, hours, minutes] = match;
  return `${day}.${month}.${year.slice(2)}, ${hours}:${minutes}`;
}

const inputClassName =
  "min-h-10 w-full rounded-lg border border-white/10 bg-[#090c11] px-3 text-sm text-white outline-none transition placeholder:text-[#646d79] focus:border-emerald-300/45";
