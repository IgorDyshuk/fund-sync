import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyzeSheet } from "./components/AnalyzeSheet";
import { AccountDialog } from "./components/AccountDialog";
import { AuthDialog } from "./components/AuthDialog";
import { FloatingAddButton } from "./components/FloatingAddButton";
import { HistoryPage } from "./components/HistoryPage";
import { HomePage } from "./components/HomePage";
import { TradeDetailsSheet } from "./components/TradeDetailsSheet";
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
import { wait, withTimeout } from "./lib/asyncUtils";
import { getSyncErrorMessage } from "./lib/syncErrors";
import {
  prependSavedTrade,
  removeSavedTrade,
} from "./lib/tradeHistoryActions";
import { isFirebaseConfigured } from "./lib/firebaseEnv";
import { loadTradeHistory, saveTradeHistory } from "./lib/tradeHistory";
import type { AppStatus, ConflictDraft, SavedTrade } from "./types/app";
import type { AuthUserSummary } from "./types/auth";
import { isAnalyzeTimeout, postAnalyze, readApiError } from "./utils/api";
import { cn } from "./utils/cn";

const sheetAnimationMs = 300;
const authDialogAnimationMs = 200;
const accountDialogAnimationMs = 220;
const initialCloudSyncTimeoutMs = 15_000;

function App() {
  const closeTimerRef = useRef<number | null>(null);
  const detailCloseTimerRef = useRef<number | null>(null);
  const accountCloseTimerRef = useRef<number | null>(null);
  const authCloseTimerRef = useRef<number | null>(null);
  const requestTokenRef = useRef(0);
  const hadAuthenticatedSessionRef = useRef(false);
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
  const [selectedTrade, setSelectedTrade] = useState<SavedTrade | null>(null);
  const [isDetailsMounted, setIsDetailsMounted] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isHistoryPage, setIsHistoryPage] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUserSummary | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthMounted, setIsAuthMounted] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountMounted, setIsAccountMounted] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  useEffect(() => {
    let isActive = true;
    let stopCloudSubscription: (() => void) | null = null;

    let stopAuthSubscription: () => void = () => undefined;

    if (isFirebaseConfigured) {
      void import("./lib/cloudSync")
        .then(({ observeAuthState, observeCloudTrades, syncUserHistory }) => {
          if (!isActive) {
            return;
          }

          stopAuthSubscription = observeAuthState((user) => {
            stopCloudSubscription?.();
            stopCloudSubscription = null;

            if (!isActive) {
              return;
            }

            setAuthUser(user);
            // Authentication is ready at this point. Cloud history can continue
            // loading independently without blocking the account controls.
            setAuthLoading(false);
            setAuthError(null);

            if (!user) {
              if (hadAuthenticatedSessionRef.current) {
                saveTradeHistory([]);
                setHistory([]);
              } else {
                setHistory(loadTradeHistory());
              }
              setAuthLoading(false);
              return;
            }

            hadAuthenticatedSessionRef.current = true;

            void withTimeout(
              syncUserHistory(user),
              initialCloudSyncTimeoutMs,
              "Не удалось загрузить облачную историю за 15 секунд.",
            )
              .then((nextHistory) => {
                if (!isActive) {
                  return;
                }

                setHistory(nextHistory);
                saveTradeHistory(nextHistory);
                stopCloudSubscription = observeCloudTrades(
                  (cloudHistory) => {
                    if (!isActive) {
                      return;
                    }
                    setHistory(cloudHistory);
                    saveTradeHistory(cloudHistory);
                  },
                  (error) => {
                    if (isActive) {
                      setAuthError(getSyncErrorMessage(error));
                    }
                  },
                );
              })
              .catch((error) => {
                if (isActive) {
                  setAuthError(getSyncErrorMessage(error));
                }
              })
              .finally(() => {
                if (isActive) {
                  setAuthLoading(false);
                }
              });
          });
        })
        .catch((error) => {
          if (isActive) {
            setAuthLoading(false);
            setAuthError(getSyncErrorMessage(error));
          }
        });
    }

    return () => {
      isActive = false;
      stopCloudSubscription?.();
      stopAuthSubscription();
    };
  }, []);

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

  function openTradeDetails(trade: SavedTrade) {
    clearDetailCloseTimer();
    setSelectedTrade(trade);
    setIsDetailsMounted(true);
    window.requestAnimationFrame(() => setIsDetailsOpen(true));
  }

  function closeTradeDetails() {
    clearDetailCloseTimer();
    setIsDetailsOpen(false);
    detailCloseTimerRef.current = window.setTimeout(() => {
      setIsDetailsMounted(false);
      setSelectedTrade(null);
    }, sheetAnimationMs);
  }

  async function deleteTrade(tradeId: string) {
    setAuthError(null);
    if (authUser) {
      try {
        const { deleteCloudTrade } = await import("./lib/cloudSync");
        await deleteCloudTrade(tradeId);
      } catch (error) {
        setAuthError(getSyncErrorMessage(error));
        return;
      }
    }

    setHistory((currentHistory) => {
      const nextHistory = removeSavedTrade(currentHistory, tradeId);
      saveTradeHistory(nextHistory);
      return nextHistory;
    });
    closeTradeDetails();
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

  async function completeTrade() {
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

    setIsCloudSaving(true);
    setAuthError(null);
    try {
      if (authUser) {
        const { saveCloudTrade } = await import("./lib/cloudSync");
        await saveCloudTrade(savedTrade);
      }

      setHistory((currentHistory) => {
        const nextHistory = prependSavedTrade(currentHistory, savedTrade);
        saveTradeHistory(nextHistory);
        return nextHistory;
      });

      closeAnalyzeSheet();
    } catch (error) {
      setAuthError(getSyncErrorMessage(error));
    } finally {
      setIsCloudSaving(false);
    }
  }

  async function handleLogout() {
    try {
      closeAccountDialog();
      await wait(accountDialogAnimationMs);
      const { logoutFromCloud } = await import("./lib/cloudSync");
      await logoutFromCloud();
    } catch (error) {
      setAuthError(getSyncErrorMessage(error));
    }
  }

  function openAccountDialog() {
    clearAccountCloseTimer();
    setIsAccountMounted(true);
    window.requestAnimationFrame(() => setIsAccountOpen(true));
  }

  function openAuthDialog() {
    clearAuthCloseTimer();
    setIsAuthMounted(true);
    window.requestAnimationFrame(() => setIsAuthOpen(true));
  }

  function closeAuthDialog() {
    clearAuthCloseTimer();
    setIsAuthOpen(false);
    authCloseTimerRef.current = window.setTimeout(() => {
      setIsAuthMounted(false);
    }, authDialogAnimationMs);
  }

  function closeAccountDialog() {
    clearAccountCloseTimer();
    setIsAccountOpen(false);
    accountCloseTimerRef.current = window.setTimeout(() => {
      setIsAccountMounted(false);
    }, accountDialogAnimationMs);
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

  function clearDetailCloseTimer() {
    if (detailCloseTimerRef.current !== null) {
      window.clearTimeout(detailCloseTimerRef.current);
      detailCloseTimerRef.current = null;
    }
  }

  function clearAccountCloseTimer() {
    if (accountCloseTimerRef.current !== null) {
      window.clearTimeout(accountCloseTimerRef.current);
      accountCloseTimerRef.current = null;
    }
  }

  function clearAuthCloseTimer() {
    if (authCloseTimerRef.current !== null) {
      window.clearTimeout(authCloseTimerRef.current);
      authCloseTimerRef.current = null;
    }
  }

  return (
    <div className="relative h-[100svh] overflow-hidden">
      <div
        className={cn(
          "h-[100svh] transform-gpu transition-transform duration-300 ease-out",
          isHistoryPage
            ? "pointer-events-none -translate-x-full overflow-y-hidden"
            : "translate-x-0 overflow-y-auto",
        )}
      >
        <HomePage
          history={history}
          onOpenHistory={() => setIsHistoryPage(true)}
          onTradeSelect={openTradeDetails}
          authUser={authUser}
          authLoading={authLoading}
          authError={authError}
          onOpenAuth={openAuthDialog}
          onOpenAccount={openAccountDialog}
        />
      </div>

      <div
        className={cn(
          "absolute inset-0 h-[100svh] transform-gpu transition-transform duration-300 ease-out",
          isHistoryPage
            ? "pointer-events-auto translate-x-0 overflow-y-auto"
            : "pointer-events-none translate-x-full overflow-y-hidden",
        )}
      >
        <HistoryPage
          history={history}
          onBack={() => setIsHistoryPage(false)}
          onTradeSelect={openTradeDetails}
        />
      </div>

      <FloatingAddButton onClick={openAnalyzeSheet} />

      {isDetailsMounted && selectedTrade ? (
        <TradeDetailsSheet
          trade={selectedTrade}
          isOpen={isDetailsOpen}
          onClose={closeTradeDetails}
          onDelete={() => deleteTrade(selectedTrade.id)}
        />
      ) : null}

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
          isSaving={isCloudSaving}
          spotSignPromptOpen={spotSignPromptOpen}
          onSpotSignSelect={applySpotSign}
        />
      ) : null}

      {isAuthMounted ? (
        <AuthDialog
          isOpen={isAuthOpen}
          onClose={closeAuthDialog}
          onAuthenticated={closeAuthDialog}
        />
      ) : null}

      {isAccountMounted && authUser ? (
        <AccountDialog
          isOpen={isAccountOpen}
          user={authUser}
          onClose={closeAccountDialog}
          onLogout={handleLogout}
        />
      ) : null}
    </div>
  );
}

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `trade-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default App;
