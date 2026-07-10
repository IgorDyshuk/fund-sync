import type { AnalysisResponse } from "./analysisSchema";
import { parseNumericValue } from "./tradeCalculator";

type ManualSpotOverride = {
  amount: number;
  mode: "raw" | "signed";
};

const spotPnlPatterns = [
  /(?<phrase>(?:спот|spot)[^\n.;]{0,80}?(?:pnl|пнл|итог|результат|считать|плюс|минус|прибыл\p{L}*|убыт\p{L}*)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
  /(?<phrase>(?:pnl|пнл|итог|результат|плюс|минус|прибыл\p{L}*|убыт\p{L}*)[^\n.;]{0,50}?(?:по\s+)?(?:спот|spot)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
  /(?<phrase>(?:spot\s+pnl|pnl\s+spot)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
];

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

  return null;
}

export function applyManualInstructionsToAnalysis(
  analysis: AnalysisResponse,
  instructions: string,
): AnalysisResponse {
  const spotOverride = parseManualSpotOverride(instructions);
  if (!spotOverride) {
    return analysis;
  }

  const nextAnalysis: AnalysisResponse = structuredClone(analysis);
  const rawPnlUsdt = Math.abs(spotOverride.amount);
  const signedPnlUsdt =
    spotOverride.mode === "signed" ? spotOverride.amount : null;

  nextAnalysis.spot = {
    ...nextAnalysis.spot,
    method: "manual",
    rawPnlUsdt,
    pnlUsdt: signedPnlUsdt,
  };

  const spotLegIndex = nextAnalysis.legs.findIndex(
    (leg) => leg.type === "spot",
  );

  if (spotLegIndex >= 0) {
    const currentSpotLeg = nextAnalysis.legs[spotLegIndex];
    nextAnalysis.legs[spotLegIndex] = {
      ...currentSpotLeg,
      method: "manual",
      rawPnlUsdt,
      pnlUsdt: signedPnlUsdt,
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
      volumeUsdt: nextAnalysis.spot.volumeUsdt ?? null,
      pnlUsdt: signedPnlUsdt,
      realizedPnlUsdt: null,
      rawPnlUsdt,
      roiPercent: null,
      method: "manual",
      balanceBeforeUsdt: null,
      balanceAfterUsdt: null,
      revenueUsdt: null,
      costUsdt: null,
    });
  }

  return {
    ...nextAnalysis,
    conflicts: nextAnalysis.conflicts.filter(
      (conflict) => !isManualSpotConflict(conflict.field),
    ),
  };
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
