import type {
  AnalysisConflict,
  AnalysisConflictChoice,
  AnalysisResponse,
} from "./analysisSchema";
import { formatPercent, formatUsdt, parseNumericValue } from "./tradeCalculator";
import type { ConflictDraft } from "../types/app";

export function createInitialConflictDrafts(conflicts: AnalysisConflict[]) {
  return conflicts.reduce<Record<string, ConflictDraft>>((drafts, conflict) => {
    const manualChoiceIndex = conflict.choices.findIndex(
      (choice) => choice.source === "manual",
    );
    const selectedIndex = manualChoiceIndex >= 0 ? manualChoiceIndex : 0;
    const selectedChoice = conflict.choices[selectedIndex];

    drafts[conflict.field] = {
      choiceId: selectedChoice
        ? getChoiceId(conflict, selectedChoice, selectedIndex)
        : "custom",
      customValue: "",
    };

    return drafts;
  }, {});
}

export function applyConflictDrafts(
  analysis: AnalysisResponse,
  drafts: Record<string, ConflictDraft>,
): AnalysisResponse {
  const clonedAnalysis: AnalysisResponse = structuredClone(analysis);

  for (const conflict of analysis.conflicts) {
    const draft = drafts[conflict.field];
    if (!draft) {
      continue;
    }

    const value =
      draft.choiceId === "custom"
        ? draft.customValue
        : conflict.choices.find(
            (choice, index) =>
              getChoiceId(conflict, choice, index) === draft.choiceId,
          )?.value;

    const normalizedValue = normalizeConflictValue(conflict.field, value);
    if (normalizedValue !== null) {
      setNestedValue(clonedAnalysis, conflict.field, normalizedValue);
    }
  }

  return { ...clonedAnalysis, conflicts: [] };
}

export function getChoiceId(
  conflict: AnalysisConflict,
  choice: AnalysisConflictChoice,
  index: number,
) {
  return choice.id ?? `${conflict.field}-${index}`;
}

export function formatConflictValue(field: string, value: unknown) {
  const numericValue = parseNumericValue(value);
  if (numericValue !== null && field.endsWith("Usdt")) {
    return formatUsdt(numericValue);
  }
  if (numericValue !== null && field.endsWith("Percent")) {
    return formatPercent(numericValue);
  }
  return value === null || value === undefined || value === ""
    ? "-"
    : String(value);
}

export function getFieldLabel(field: string) {
  const labels: Record<string, string> = {
    "spot.volumeUsdt": "Объем спота",
    "spot.rawPnlUsdt": "PnL Spot",
    "spot.balanceBeforeUsdt": "Баланс до",
    "spot.balanceAfterUsdt": "Баланс после",
    "spot.revenueUsdt": "Выручка",
    "spot.costUsdt": "Затраты",
  };

  return labels[field] ?? field;
}

function normalizeConflictValue(field: string, value: unknown) {
  if (field.endsWith("Usdt") || field.endsWith("Percent")) {
    return parseNumericValue(value);
  }

  return value === undefined ? null : value;
}

function setNestedValue(
  target: AnalysisResponse,
  path: string,
  value: unknown,
) {
  const keys = path.split(".");
  let current: Record<string, unknown> = target as Record<string, unknown>;

  keys.slice(0, -1).forEach((key) => {
    const existing = current[key];
    if (!existing || typeof existing !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  });

  current[keys[keys.length - 1]] = value;
}
