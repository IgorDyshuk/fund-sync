import { useMemo, useRef, useState } from "react";
import { AnalyzeSheet } from "./components/AnalyzeSheet";
import { HomePage } from "./components/HomePage";
import { analysisResponseSchema, type AnalysisResponse } from "./lib/analysisSchema";
import {
  applyConflictDrafts,
  createInitialConflictDrafts,
} from "./lib/conflicts";
import {
  calculateTrade,
  type TradeAnalysisInput,
  type TradeCalculation,
} from "./lib/tradeCalculator";
import {
  applyManualInstructionsToAnalysis,
  applyManualSpotSign,
  parseManualSpotOverride,
} from "./lib/manualInstructions";
import { loadTradeHistory, saveTradeHistory } from "./lib/tradeHistory";
import type { AppStatus, ConflictDraft, SavedTrade } from "./types/app";
import { isAnalyzeTimeout, postAnalyze, readApiError } from "./utils/api";

const sheetAnimationMs = 300;

function App() {
  const closeTimerRef = useRef<number | null>(null);
  const requestTokenRef = useRef(0);
  const [history, setHistory] = useState<SavedTrade[]>(() => loadTradeHistory());
  const [isSheetMounted, setIsSheetMounted] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tradeFiles, setTradeFiles] = useState<File[]>([]);
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<AppStatus>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [resultAnalysis, setResultAnalysis] = useState<AnalysisResponse | null>(
    null,
  );
  const [conflictDrafts, setConflictDrafts] = useState<
    Record<string, ConflictDraft>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [spotSignPromptOpen, setSpotSignPromptOpen] = useState(false);

  const calculation = useMemo<TradeCalculation | null>(() => {
    if (!resultAnalysis) {
      return null;
    }

    return calculateTrade(resultAnalysis as TradeAnalysisInput);
  }, [resultAnalysis]);

  const canAnalyze = tradeFiles.length > 0 || Boolean(instructions.trim());

  function openAnalyzeSheet() {
    clearCloseTimer();
    setIsSheetMounted(true);
    window.requestAnimationFrame(() => setIsSheetOpen(true));
  }

  function closeAnalyzeSheet() {
    clearCloseTimer();
    requestTokenRef.current += 1;
    setIsSheetOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setIsSheetMounted(false);
      resetAnalysisState();
    }, sheetAnimationMs);
  }

  async function analyzeTrade() {
    if (!canAnalyze) {
      setStatus("error");
      setError("Добавь скриншоты или условия сделки.");
      return;
    }

    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    setStatus("analyzing");
    setError(null);
    setResultAnalysis(null);

    const formData = new FormData();
    tradeFiles.forEach((file) => formData.append("tradeImages[]", file));
    formData.append("instructions", instructions);

    try {
      const response = await postAnalyze(formData, {
        timeoutMs: 130_000,
      });
      if (requestTokenRef.current !== requestToken) {
        return;
      }

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = await response.json();
      const parsed = analysisResponseSchema.safeParse(payload);

      if (!parsed.success) {
        throw new Error("Ответ /api/analyze не совпадает с контрактом.");
      }

      openAnalysis(parsed.data);
    } catch (requestError) {
      if (requestTokenRef.current !== requestToken) {
        return;
      }

      setStatus("error");
      setError(
        isAnalyzeTimeout(requestError)
          ? "API анализа не ответил за 130 секунд. Попробуй меньше скриншотов или повтори запрос позже."
          : requestError instanceof Error
            ? requestError.message
            : "Не удалось обработать сделку.",
      );
    }
  }

  function openAnalysis(nextAnalysis: AnalysisResponse) {
    const patchedAnalysis = applyManualInstructionsToAnalysis(
      nextAnalysis,
      instructions,
    );
    const needsSpotSign = parseManualSpotOverride(instructions)?.mode === "raw";

    setAnalysis(patchedAnalysis);
    setError(null);

    if (patchedAnalysis.conflicts.length > 0) {
      setConflictDrafts(createInitialConflictDrafts(patchedAnalysis.conflicts));
      setSpotSignPromptOpen(false);
      setStatus("review");
      return;
    }

    if (needsSpotSign) {
      setSpotSignPromptOpen(true);
      setStatus("review");
      return;
    }

    setResultAnalysis(patchedAnalysis);
    setStatus("result");
  }

  function applyConflicts() {
    if (!analysis) {
      return;
    }

    const patchedAnalysis = applyConflictDrafts(analysis, conflictDrafts);
    const nextAnalysis = applyManualInstructionsToAnalysis(
      patchedAnalysis,
      instructions,
    );
    setAnalysis(nextAnalysis);
    if (parseManualSpotOverride(instructions)?.mode === "raw") {
      setSpotSignPromptOpen(true);
      setStatus("review");
      return;
    }

    setResultAnalysis(nextAnalysis);
    setStatus("result");
    setError(null);
  }

  function applySpotSign(sign: "positive" | "negative") {
    if (!analysis) {
      return;
    }

    const nextAnalysis = applyManualSpotSign(analysis, sign);
    setAnalysis(nextAnalysis);
    setResultAnalysis(nextAnalysis);
    setSpotSignPromptOpen(false);
    setStatus("result");
    setError(null);
  }

  function completeTrade() {
    if (!resultAnalysis || !calculation) {
      return;
    }

    const savedTrade: SavedTrade = {
      id: createHistoryId(),
      savedAt: new Date().toISOString(),
      analysis: resultAnalysis,
      calculation,
      instructions,
    };

    setHistory((currentHistory) => {
      const nextHistory = [savedTrade, ...currentHistory];
      saveTradeHistory(nextHistory);
      return nextHistory;
    });

    closeAnalyzeSheet();
  }

  function retryAnalysis() {
    requestTokenRef.current += 1;
    setStatus("idle");
    setAnalysis(null);
    setResultAnalysis(null);
    setConflictDrafts({});
    setSpotSignPromptOpen(false);
    setError(null);
    void analyzeTrade();
  }

  function resetAnalysisState() {
    requestTokenRef.current += 1;
    setTradeFiles([]);
    setInstructions("");
    setStatus("idle");
    setAnalysis(null);
    setResultAnalysis(null);
    setConflictDrafts({});
    setSpotSignPromptOpen(false);
    setError(null);
  }

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  return (
    <>
      <HomePage history={history} onCreateTrade={openAnalyzeSheet} />

      {isSheetMounted ? (
        <AnalyzeSheet
          isOpen={isSheetOpen}
          files={tradeFiles}
          instructions={instructions}
          status={status}
          error={error}
          analysis={analysis}
          resultAnalysis={resultAnalysis}
          calculation={calculation}
          conflictDrafts={conflictDrafts}
          onClose={closeAnalyzeSheet}
          onFilesChange={setTradeFiles}
          onInstructionsChange={setInstructions}
          onAnalyze={analyzeTrade}
          onReset={resetAnalysisState}
          onDraftsChange={setConflictDrafts}
          onApplyConflicts={applyConflicts}
          onDone={completeTrade}
          onRetry={retryAnalysis}
          spotSignPromptOpen={spotSignPromptOpen}
          onSpotSignSelect={applySpotSign}
        />
      ) : null}
    </>
  );
}

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `trade-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default App;
