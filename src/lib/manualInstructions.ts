import type { AnalysisResponse } from "./analysisSchema";
import { parseNumericValue } from "./tradeCalculator";

type ManualSpotOverride = {
  amount: number;
  mode: "raw" | "signed";
};

export type ManualSpotSign = "positive" | "negative";

export type ManualSpotSummary = {
  volumeUsdt: number | null;
  revenueUsdt: number | null;
  costUsdt: number | null;
};

const spotPnlPatterns = [
  /(?<phrase>(?:спот|spot)[^\n.;]{0,80}?)(?<value>[+-]\s*\d[\d\s.,]*)/iu,
  /(?<phrase>(?:спот|spot)[^\n.;]{0,80}?(?:pnl|пнл|итог|результат|считать|вышел\p{L}*|вышло|получил\p{L}*|плюс|минус|прибыл\p{L}*|убыт\p{L}*)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
  /(?<phrase>(?:pnl|пнл|итог|результат|плюс|минус|прибыл\p{L}*|убыт\p{L}*)[^\n.;]{0,50}?(?:по\s+)?(?:спот|spot)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
  /(?<phrase>(?:spot\s+pnl|pnl\s+spot)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
];

const spotSummaryPnlPattern =
  /(?:^|\n)\s*(?:[-*]\s*)?(?<phrase>(?:pnl|пнл|profit|прибыл\p{L}*|результат)(?:\s*\([^\n)]*\))?)[^\n.;:]{0,20}[:=]\s*(?<value>[+-]?\s*\d[\d\s.,]*)/iu;

const manualSummaryNumber = "[+-]?(?:\\d[\\d\\s.,]*\\d|\\d)";

export function parseManualSpotOverride(
  instructions: string,
): ManualSpotOverride | null {
  const normalizedInstructions = instructions.trim();
  if (!normalizedInstructions) {
    return null;
  }

  for (const pattern of spotPnlPatterns) {
    const match = normalizedInstructions.match(pattern);
    const phrase = match?.groups?.phrase;
    const valueText = match?.groups?.value;
    if (!phrase || !valueText || isLikelyVolumePhrase(phrase)) {
      continue;
    }

    const parsedAmount = parseNumericValue(valueText);
    if (parsedAmount === null) {
      continue;
    }

    return normalizeManualSpotAmount(parsedAmount, phrase, valueText);
  }

  if (hasSpotSummaryContext(normalizedInstructions)) {
    const match = normalizedInstructions.match(spotSummaryPnlPattern);
    const phrase = match?.groups?.phrase;
    const valueText = match?.groups?.value;
    const parsedAmount = valueText ? parseNumericValue(valueText) : null;

    if (phrase && valueText && parsedAmount !== null) {
      return normalizeManualSpotAmount(parsedAmount, phrase, valueText);
    }
  }

  return null;
}

function hasSpotSummaryContext(instructions: string) {
  return /(?:средн(?:яя|ей)?\s+цен(?:а|ы)\s+(?:покупки|продажи)|average\s+(?:buy|sell)\s+price|всего\s+задействовано|получено[^\n.;]{0,40}(?:потрачено|spent)|received[^\n.;]{0,40}spent)/iu.test(
    instructions,
  );
}

export function applyManualInstructionsToAnalysis(
  analysis: AnalysisResponse,
  instructions: string,
): AnalysisResponse {
  const spotOverride = parseManualSpotOverride(instructions);
  const spotSummary = parseManualSpotSummary(instructions);
  if (!spotOverride && !hasManualSpotSummary(spotSummary)) {
    return analysis;
  }

  const nextAnalysis: AnalysisResponse = structuredClone(analysis);
  const rawPnlUsdt = spotOverride ? Math.abs(spotOverride.amount) : null;
  const signedPnlUsdt =
    spotOverride?.mode === "signed" ? spotOverride.amount : null;

  nextAnalysis.spot = {
    ...nextAnalysis.spot,
    ...(spotOverride ? { method: "manual", rawPnlUsdt, pnlUsdt: signedPnlUsdt } : {}),
    volumeUsdt: spotSummary.volumeUsdt ?? nextAnalysis.spot.volumeUsdt,
    revenueUsdt: spotSummary.revenueUsdt ?? nextAnalysis.spot.revenueUsdt,
    costUsdt: spotSummary.costUsdt ?? nextAnalysis.spot.costUsdt,
  };

  const spotLegIndex = nextAnalysis.legs.findIndex(
    (leg) => leg.type === "spot",
  );

  if (spotLegIndex >= 0) {
    const currentSpotLeg = nextAnalysis.legs[spotLegIndex];
    nextAnalysis.legs[spotLegIndex] = {
      ...currentSpotLeg,
      ...(spotOverride
        ? { method: "manual", rawPnlUsdt, pnlUsdt: signedPnlUsdt }
        : {}),
      volumeUsdt: spotSummary.volumeUsdt ?? currentSpotLeg.volumeUsdt,
      revenueUsdt: spotSummary.revenueUsdt ?? currentSpotLeg.revenueUsdt,
      costUsdt: spotSummary.costUsdt ?? currentSpotLeg.costUsdt,
    };
  } else if (nextAnalysis.legs.length > 0) {
    nextAnalysis.legs.push({
      id: "manual-spot",
      label: "Спот",
      type: "spot",
      symbol:
        nextAnalysis.future.symbol ??
        nextAnalysis.legs.find((leg) => leg.type === "futures")?.symbol ??
        null,
      side: "unknown",
      startedAt: null,
      endedAt: null,
      volumeUsdt: spotSummary.volumeUsdt ?? nextAnalysis.spot.volumeUsdt ?? null,
      pnlUsdt: signedPnlUsdt,
      realizedPnlUsdt: null,
      rawPnlUsdt,
      roiPercent: null,
      method: "manual",
      balanceBeforeUsdt: null,
      balanceAfterUsdt: null,
      revenueUsdt: spotSummary.revenueUsdt,
      costUsdt: spotSummary.costUsdt,
    });
  }

  return {
    ...nextAnalysis,
    conflicts: nextAnalysis.conflicts.filter(
      (conflict) => !isManualSpotConflict(conflict.field),
    ),
  };
}

export function applyManualSpotSign(
  analysis: AnalysisResponse,
  sign: ManualSpotSign,
): AnalysisResponse {
  const nextAnalysis: AnalysisResponse = structuredClone(analysis);
  const rawPnlUsdt = nextAnalysis.spot.rawPnlUsdt;
  const signedPnlUsdt =
    rawPnlUsdt === null || rawPnlUsdt === undefined
      ? null
      : sign === "positive"
        ? Math.abs(rawPnlUsdt)
        : -Math.abs(rawPnlUsdt);

  nextAnalysis.spot = {
    ...nextAnalysis.spot,
    method: "manual",
    pnlUsdt: signedPnlUsdt,
  };

  const spotLegIndex = nextAnalysis.legs.findIndex(
    (leg) => leg.type === "spot",
  );

  if (spotLegIndex >= 0) {
    nextAnalysis.legs[spotLegIndex] = {
      ...nextAnalysis.legs[spotLegIndex],
      method: "manual",
      pnlUsdt: signedPnlUsdt,
    };
  }

  return nextAnalysis;
}

export function parseManualSpotSummary(instructions: string): ManualSpotSummary {
  return {
    volumeUsdt: findManualSummaryNumber(instructions, [
      new RegExp(
        `(?:всего\\s+задействовано|total\\s+(?:involved|used|volume))[^\\n.;]{0,100}?(?<value>${manualSummaryNumber})`,
        "iu",
      ),
    ]),
    revenueUsdt: findManualSummaryNumber(instructions, [
      new RegExp(
        `(?<value>${manualSummaryNumber})\\s*(?:usdt)?[^\\n.;]{0,16}(?:получено|received)`,
        "iu",
      ),
    ]),
    costUsdt: findManualSummaryNumber(instructions, [
      new RegExp(
        `(?<value>${manualSummaryNumber})\\s*(?:usdt)?[^\\n.;]{0,16}(?:потрачено|spent)`,
        "iu",
      ),
    ]),
  };
}

function findManualSummaryNumber(instructions: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const valueText = instructions.match(pattern)?.groups?.value;
    const value = valueText ? parseNumericValue(valueText) : null;
    if (value !== null && value > 0) {
      return value;
    }
  }

  return null;
}

function hasManualSpotSummary(summary: ManualSpotSummary) {
  return Object.values(summary).some((value) => value !== null);
}

function normalizeManualSpotAmount(
  amount: number,
  phrase: string,
  valueText: string,
): ManualSpotOverride {
  const normalizedPhrase = phrase.toLowerCase();
  const normalizedValue = valueText.trim();

  if (/^[+-]/.test(normalizedValue)) {
    return { amount, mode: "signed" };
  }

  if (/(^|[^\p{L}])минус([^\p{L}]|$)|убыт|loss/u.test(normalizedPhrase)) {
    return { amount: -Math.abs(amount), mode: "signed" };
  }

  if (/(^|[^\p{L}])плюс([^\p{L}]|$)|прибыл|profit/u.test(normalizedPhrase)) {
    return { amount: Math.abs(amount), mode: "signed" };
  }

  return { amount: Math.abs(amount), mode: "raw" };
}

function isLikelyVolumePhrase(phrase: string) {
  return /\bоб[ъь]е[мё]\b|\bvolume\b|\bдепозит\b|\bdeposit\b/i.test(phrase);
}

function isManualSpotConflict(field: string) {
  return (
    field === "spot.rawPnlUsdt" ||
    field === "spot.pnlUsdt" ||
    /^legs\.\d+\.(?:rawPnlUsdt|pnlUsdt|method)$/.test(field)
  );
}
