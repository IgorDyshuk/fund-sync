import { AlertTriangle, Check } from "lucide-react";
import type {
  AnalysisConflict,
  AnalysisConflictChoice,
  AnalysisResponse,
} from "../lib/analysisSchema";
import {
  formatConflictValue,
  getChoiceId,
  getFieldLabel,
} from "../lib/conflicts";
import { cn } from "../utils/cn";
import type { ConflictDraft } from "../types/app";
import { translate as t } from "../lib/i18n";

type ConflictReviewProps = {
  analysis: AnalysisResponse;
  drafts: Record<string, ConflictDraft>;
  onDraftsChange: (drafts: Record<string, ConflictDraft>) => void;
  onApply: () => void;
};

export function ConflictReview({
  analysis,
  drafts,
  onDraftsChange,
  onApply,
}: ConflictReviewProps) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-white/10 p-5 md:p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-white">{t("Проверь данные")}</h2>
            <p className="mt-1 text-sm text-[#9aa3af]">
              {t(analysis.bundleType ?? analysis.future.symbol ?? "Сделка")} ·{" "}
              {analysis.conflicts.length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:p-6">
        {analysis.conflicts.map((conflict) => (
          <ConflictCard
            key={conflict.field}
            conflict={conflict}
            draft={drafts[conflict.field] ?? { choiceId: "", customValue: "" }}
            drafts={drafts}
            onDraftsChange={onDraftsChange}
          />
        ))}
      </div>

      <div className="mt-auto border-t border-white/10 p-5 md:p-6">
        <button
          type="button"
          onClick={onApply}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#07110c] transition hover:bg-emerald-200"
        >
          <Check className="h-4 w-4" />
          {t("Применить значения")}
        </button>
      </div>
    </div>
  );
}

function ConflictCard({
  conflict,
  draft,
  drafts,
  onDraftsChange,
}: {
  conflict: AnalysisConflict;
  draft: ConflictDraft;
  drafts: Record<string, ConflictDraft>;
  onDraftsChange: (drafts: Record<string, ConflictDraft>) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#11141a]">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-white">
            {t(conflict.label ?? getFieldLabel(conflict.field))}
          </h3>
          <span className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-[#9aa3af]">
            {conflict.field}
          </span>
        </div>
        {conflict.message ? (
          <p className="mt-2 text-sm text-[#aeb7c3]">{t(conflict.message)}</p>
        ) : null}
      </div>

      <div className="grid gap-2 p-4">
        {conflict.choices.map((choice, index) => (
          <ConflictChoiceButton
            key={getChoiceId(conflict, choice, index)}
            conflict={conflict}
            choice={choice}
            index={index}
            selected={draft.choiceId === getChoiceId(conflict, choice, index)}
            drafts={drafts}
            draft={draft}
            onDraftsChange={onDraftsChange}
          />
        ))}

        <label className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <span className="text-sm font-medium text-[#c5ccd6]">{t("Свое значение")}</span>
          <input
            value={draft.customValue}
            onFocus={() =>
              onDraftsChange({
                ...drafts,
                [conflict.field]: { ...draft, choiceId: "custom" },
              })
            }
            onChange={(event) =>
              onDraftsChange({
                ...drafts,
                [conflict.field]: {
                  choiceId: "custom",
                  customValue: event.target.value,
                },
              })
            }
            inputMode="decimal"
            className="h-10 rounded-md border border-white/10 bg-[#0b0d12] px-3 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:ring-2 focus:ring-emerald-300/20"
          />
        </label>
      </div>
    </div>
  );
}

function ConflictChoiceButton({
  conflict,
  choice,
  index,
  selected,
  drafts,
  draft,
  onDraftsChange,
}: {
  conflict: AnalysisConflict;
  choice: AnalysisConflictChoice;
  index: number;
  selected: boolean;
  drafts: Record<string, ConflictDraft>;
  draft: ConflictDraft;
  onDraftsChange: (drafts: Record<string, ConflictDraft>) => void;
}) {
  const choiceId = getChoiceId(conflict, choice, index);

  return (
    <button
      type="button"
      onClick={() =>
        onDraftsChange({
          ...drafts,
          [conflict.field]: { ...draft, choiceId },
        })
      }
      className={cn(
        "flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm transition",
        selected
          ? "border-emerald-300/70 bg-emerald-300/10 text-white"
          : "border-white/10 bg-white/[0.03] text-[#c5ccd6] hover:bg-white/[0.06]",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            selected
              ? "border-emerald-300 bg-emerald-300 text-[#07110c]"
              : "border-white/20",
          )}
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </span>
        <span className="min-w-0 truncate">
          {t(choice.label ?? choice.source ?? "Вариант")}
        </span>
      </span>
      <span className="shrink-0 font-semibold">
        {formatConflictValue(conflict.field, choice.value)}
      </span>
    </button>
  );
}
