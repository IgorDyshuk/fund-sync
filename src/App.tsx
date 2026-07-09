import { useMemo, useRef, useState } from "react";
import { AnalyzeSheet } from "./components/AnalyzeSheet";
import { HomePage } from "./components/HomePage";
import { analysisResponseSchema, type AnalysisResponse } from "./lib/analysisSchema";
import {
  applyConflictDrafts,
  createInitialConflictDrafts,
} from "./lib/conflicts";
import { demoAnalysis } from "./lib/demoAnalysis";
import {
  calculateTrade,
  type TradeAnalysisInput,
  type TradeCalculation,
} from "./lib/tradeCalculator";
import { loadTradeHistory, saveTradeHistory } from "./lib/tradeHistory";
import type { AppStatus, ConflictDraft, SavedTrade } from "./types/app";
import { isAnalyzeTimeout, postAnalyze, readApiError } from "./utils/api";

const sheetAnimationMs = 300;
const demoEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === "true";

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
      const response = await postAnalyze(formData);
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
          ? "API анализа не ответил за 90 секунд. Проверь backend-деплой и ключ Gemini."
          : requestError instanceof Error
            ? requestError.message
            : "Не удалось обработать сделку.",
      );
    }
  }

  function openAnalysis(nextAnalysis: AnalysisResponse) {
    setAnalysis(nextAnalysis);
    setError(null);

    if (nextAnalysis.conflicts.length > 0) {
      setConflictDrafts(createInitialConflictDrafts(nextAnalysis.conflicts));
      setStatus("review");
      return;
    }

    setResultAnalysis(nextAnalysis);
    setStatus("result");
  }

  function applyConflicts() {
    if (!analysis) {
      return;
    }

    const patchedAnalysis = applyConflictDrafts(analysis, conflictDrafts);
    setResultAnalysis(patchedAnalysis);
    setStatus("result");
    setError(null);
  }

  function openDemoResult() {
    requestTokenRef.current += 1;
    setTradeFiles([]);
    setInstructions("Демо-режим: локальный пример без запроса к Gemini.");
    setAnalysis(demoAnalysis);
    setResultAnalysis(demoAnalysis);
    setConflictDrafts({});
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
    resetAnalysisState();
  }

  function resetAnalysisState() {
    requestTokenRef.current += 1;
    setTradeFiles([]);
    setInstructions("");
    setStatus("idle");
    setAnalysis(null);
    setResultAnalysis(null);
    setConflictDrafts({});
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
          onDemo={demoEnabled ? openDemoResult : undefined}
          onReset={resetAnalysisState}
          onDraftsChange={setConflictDrafts}
          onApplyConflicts={applyConflicts}
          onDone={completeTrade}
          onRetry={retryAnalysis}
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
