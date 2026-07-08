import { useEffect, useMemo, useRef, useState } from "react";
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
import { ConflictReview } from "./components/ConflictReview";
import { ResultDashboard } from "./components/ResultDashboard";
import { TradeInputPanel } from "./components/TradeInputPanel";
import type { AppStatus, ConflictDraft } from "./types/app";
import { readApiError } from "./utils/api";

function App() {
  const resultPanelRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    if (status !== "result" || !resultAnalysis) {
      return;
    }

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      resultPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [resultAnalysis, status]);

  async function analyzeTrade() {
    if (!canAnalyze) {
      setStatus("error");
      setError("Добавь скриншоты или условия сделки.");
      return;
    }

    setStatus("analyzing");
    setError(null);
    setResultAnalysis(null);

    const formData = new FormData();
    tradeFiles.forEach((file) => formData.append("tradeImages[]", file));
    formData.append("instructions", instructions);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

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
      setStatus("error");
      setError(
        requestError instanceof Error
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

  function resetApp() {
    setTradeFiles([]);
    setInstructions("");
    setStatus("idle");
    setAnalysis(null);
    setResultAnalysis(null);
    setConflictDrafts({});
    setError(null);
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-[#e7e9ee]">
      <div className="mx-auto grid w-full max-w-[1440px] gap-3 px-3 py-3 md:px-4 lg:grid-cols-[390px_minmax(0,1fr)] lg:py-5">
        <TradeInputPanel
          files={tradeFiles}
          instructions={instructions}
          status={status}
          error={error}
          onFilesChange={setTradeFiles}
          onInstructionsChange={setInstructions}
          onAnalyze={analyzeTrade}
          onReset={resetApp}
        />

        <section
          ref={resultPanelRef}
          className="scroll-mt-3 rounded-lg border border-white/10 bg-[#0d0f14] shadow-2xl shadow-black/30 lg:min-h-[calc(100vh-2.5rem)]"
        >
          {status === "review" && analysis ? (
            <ConflictReview
              analysis={analysis}
              drafts={conflictDrafts}
              onDraftsChange={setConflictDrafts}
              onApply={applyConflicts}
            />
          ) : (
            <ResultDashboard
              analysis={resultAnalysis}
              calculation={calculation}
              isLoading={status === "analyzing"}
            />
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
