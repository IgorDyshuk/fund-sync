import type { AnalysisResponse } from "../lib/analysisSchema";
import type { TradeCalculation } from "../lib/tradeCalculator";

export type AppStatus = "idle" | "analyzing" | "review" | "result" | "error";

export type ConflictDraft = {
  choiceId: string;
  customValue: string;
};

export type SavedTrade = {
  id: string;
  savedAt: string;
  analysis: AnalysisResponse;
  calculation: TradeCalculation;
  instructions: string;
};
