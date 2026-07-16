import { ArrowDown, ArrowUp, CircleHelp } from "lucide-react";
import type { ManualSpotSign } from "../lib/manualInstructions";
import { getAppLocale, translate as t } from "../lib/i18n";

type SpotSignPromptProps = {
  amount: number | null | undefined;
  onSelect: (sign: ManualSpotSign) => void;
};

export function SpotSignPrompt({ amount, onSelect }: SpotSignPromptProps) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="spot-sign-title"
        aria-describedby="spot-sign-description"
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#11141a] p-4 text-[#e7e9ee] shadow-2xl shadow-black sm:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10">
            <CircleHelp className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h3 id="spot-sign-title" className="text-lg font-semibold text-white">
              {t("Уточнить знак Spot?")}
            </h3>
            <p
              id="spot-sign-description"
              className="mt-1 text-sm leading-6 text-[#aeb7c3]"
            >
              {t("Ты указал {amount} без знака. Результат по Spot был в плюс или в минус?", {
                amount: formatAmount(amount),
              })}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSelect("negative")}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-red-300/25 bg-red-400/10 px-3 text-sm font-semibold text-red-100 transition hover:bg-red-400/20"
          >
            <ArrowDown className="h-4 w-4" />
            {t("В минус")}
          </button>
          <button
            type="button"
            onClick={() => onSelect("positive")}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-300 px-3 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200"
          >
            <ArrowUp className="h-4 w-4" />
            {t("В плюс")}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatAmount(amount: number | null | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return t("указанную сумму");
  }

  return `${new Intl.NumberFormat(getAppLocale(), {
    maximumFractionDigits: 8,
  }).format(Math.abs(amount))} USDT`;
}
