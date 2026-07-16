import { Check, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createAnalyticsRange,
  createCustomAnalyticsRange,
  type AnalyticsRange,
  type AnalyticsTimeframe,
} from "../lib/monthlyAnalytics";
import { cn } from "../utils/cn";

type AnalyticsTimeframeSheetProps = {
  initialRange: AnalyticsRange;
  onApply: (range: AnalyticsRange) => void;
  onClose: () => void;
};

const presetOptions: Array<{
  value: AnalyticsTimeframe;
  label: string;
}> = [
  { value: "custom", label: "Свой период" },
  { value: "day", label: "День" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Год" },
];

export function AnalyticsTimeframeSheet({
  initialRange,
  onApply,
  onClose,
}: AnalyticsTimeframeSheetProps) {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>(
    initialRange.timeframe,
  );
  const [from, setFrom] = useState(formatDateInput(initialRange.start));
  const [to, setTo] = useState(formatDateInput(initialRange.end));
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestClose = useCallback(() => {
    if (isClosing) {
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = setTimeout(onClose, 220);
  }, [isClosing, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [requestClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const handleDateChange = (
    setter: (value: string) => void,
    value: string,
  ) => {
    setter(value);
    setTimeframe("custom");
    setError(null);
  };

  const handleTimeframeSelect = (value: AnalyticsTimeframe) => {
    setTimeframe(value);
    setError(null);

    if (value === "custom") {
      return;
    }

    const range = createAnalyticsRange(value, new Date());
    setFrom(formatDateInput(range.start));
    setTo(formatDateInput(range.end));
  };

  const handleApply = () => {
    if (timeframe === "custom") {
      const startDate = parseDateInput(from);
      const endDate = parseDateInput(to);
      if (!startDate || !endDate) {
        setError("Укажите начало и окончание периода.");
        return;
      }
      if (startDate.getTime() > endDate.getTime()) {
        setError("Дата начала не может быть позже даты окончания.");
        return;
      }
      onApply(createCustomAnalyticsRange(startDate, endDate));
      requestClose();
      return;
    }

    onApply(createAnalyticsRange(timeframe, new Date()));
    requestClose();
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-end justify-center overscroll-contain bg-black/70 px-0 transition-opacity duration-200 sm:px-4",
        !isClosing && "timeframe-sheet-overlay",
        isClosing ? "opacity-0" : "opacity-100",
      )}
      role="presentation"
    >
      <button
        type="button"
        aria-label="Закрыть выбор периода"
        className="absolute inset-0 cursor-default"
        onClick={requestClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeframe-dialog-title"
        className={cn(
          "relative z-10 max-h-[90svh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#13151a] shadow-2xl shadow-black/50 transition-[transform,opacity] duration-200 ease-out sm:max-w-[560px] sm:rounded-2xl",
          !isClosing && "timeframe-sheet-panel",
          isClosing ? "translate-y-8 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-white/20 sm:hidden" />
        <header className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 border-b border-white/10 px-[15px] py-3 sm:px-5">
          <button
            type="button"
            onClick={requestClose}
            aria-label="Закрыть"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-[#b5bdc8] transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <h2
            id="timeframe-dialog-title"
            className="text-center text-xl font-semibold text-white"
          >
            Период анализа
          </h2>
          <span aria-hidden="true" />
        </header>

        <div className="px-[15px] py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <DateField
              label="От"
              value={from}
              onChange={(value) => handleDateChange(setFrom, value)}
            />
            <DateField
              label="До"
              value={to}
              onChange={(value) => handleDateChange(setTo, value)}
            />
          </div>

          <div className="mt-4 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {presetOptions.map((option) => {
              const isSelected = timeframe === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleTimeframeSelect(option.value)}
                  className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left text-base font-medium text-[#e0e3e8] transition hover:text-white sm:min-h-16"
                >
                  {option.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2",
                      isSelected
                        ? "border-emerald-300 bg-emerald-300 text-[#07110e]"
                        : "border-white/30",
                    )}
                  >
                    {isSelected ? <Check className="h-4 w-4" /> : null}
                  </span>
                </button>
              );
            })}
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleApply}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-emerald-300 text-base font-semibold text-[#07110e] transition hover:bg-emerald-200"
          >
            Применить
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 overflow-hidden rounded-xl bg-white/[0.055] px-3 py-2.5">
      <span className="block text-xs text-[#8e97a4]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block h-7 w-full min-w-0 max-w-full bg-transparent text-[13px] font-medium text-white outline-none sm:text-sm"
      />
    </label>
  );
}

function formatDateInput(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
