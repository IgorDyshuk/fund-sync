import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyzeSheet } from "./components/AnalyzeSheet";
import { AccountDialog } from "./components/AccountDialog";
import { AuthDialog } from "./components/AuthDialog";
import { CsvImportResultDialog } from "./components/CsvImportResultDialog";
import { FloatingAddButton } from "./components/FloatingAddButton";
import { HistoryPage } from "./components/HistoryPage";
import { HomePage } from "./components/HomePage";
import { ManualTradeDialog } from "./components/ManualTradeDialog";
import { MonthlyCoinTradesPage } from "./components/MonthlyCoinTradesPage";
import { MonthlyOverviewPage } from "./components/MonthlyOverviewPage";
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
import type {
  TradeCsvImportDraft,
  TradeCsvImportReport,
  TradeCsvImportRowResult,
} from "./lib/tradeCsvImport";
import {
  prependSavedTrade,
  removeSavedTrade,
} from "./lib/tradeHistoryActions";
import { isFirebaseConfigured } from "./lib/firebaseEnv";
import { loadTradeHistory, saveTradeHistory } from "./lib/tradeHistory";
import {
  createManualTradeDraft,
  mergeEditedTrade,
} from "./lib/manualTradeDraft";
import type { AppStatus, ConflictDraft, SavedTrade } from "./types/app";
import type { AuthUserSummary } from "./types/auth";
import { isAnalyzeTimeout, postAnalyze, readApiError } from "./utils/api";
import { cn } from "./utils/cn";

const sheetAnimationMs = 300;
const authDialogAnimationMs = 200;
const accountDialogAnimationMs = 220;
const csvImportDialogAnimationMs = 200;
const initialCloudSyncTimeoutMs = 15_000;

function App() {
  const closeTimerRef = useRef<number | null>(null);
  const detailCloseTimerRef = useRef<number | null>(null);
  const accountCloseTimerRef = useRef<number | null>(null);
  const authCloseTimerRef = useRef<number | null>(null);
  const csvImportCloseTimerRef = useRef<number | null>(null);
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
  const [activePage, setActivePage] = useState<
    "home" | "history" | "monthly" | "monthlyCoin"
  >("home");
  const [selectedMonthlyCoin, setSelectedMonthlyCoin] = useState<{
    symbol: string;
    monthDate: Date;
  } | null>(null);
  const [authUser, setAuthUser] = useState<AuthUserSummary | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthMounted, setIsAuthMounted] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountMounted, setIsAccountMounted] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [csvImportReport, setCsvImportReport] =
    useState<TradeCsvImportReport | null>(null);
  const [isCsvImportReportOpen, setIsCsvImportReportOpen] = useState(false);
  const [isManualTradeOpen, setIsManualTradeOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<SavedTrade | null>(null);
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
  const manualTradeInitialValues = useMemo(
    () => (editingTrade ? createManualTradeDraft(editingTrade) : undefined),
    [editingTrade],
  );

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

  async function deleteAllTrades() {
    setAuthError(null);
    const tradeIds = history.map((trade) => trade.id);

    if (authUser) {
      try {
        const { deleteCloudTrade } = await import("./lib/cloudSync");
        for (let index = 0; index < tradeIds.length; index += 20) {
          await Promise.all(
            tradeIds
              .slice(index, index + 20)
              .map((tradeId) => deleteCloudTrade(tradeId)),
          );
        }
      } catch (error) {
        const message = getSyncErrorMessage(error);
        setAuthError(message);
        throw new Error(message, { cause: error });
      }
    }

    saveTradeHistory([]);
    setHistory([]);
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

  async function importTradeHistoryCsv(file: File): Promise<void> {
    let report: TradeCsvImportReport;

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("CSV слишком большой. Максимальный размер файла — 5 МБ.");
      }

      const csvText = await file.text();
      const { mergeImportedTrades, parseTradeCsv } = await import(
        "./lib/tradeCsvImport"
      );
      const parsed = parseTradeCsv(csvText, history);
      let rows = parsed.rows;
      let importedTrades = parsed.trades;

      if (authUser && importedTrades.length > 0) {
        const { saveCloudTrade } = await import("./lib/cloudSync");
        const failedTrades = new Map<string, string>();

        for (let index = 0; index < importedTrades.length; index += 20) {
          const chunk = importedTrades.slice(index, index + 20);
          const results = await Promise.allSettled(
            chunk.map((trade) => saveCloudTrade(trade)),
          );

          results.forEach((result, resultIndex) => {
            if (result.status === "rejected") {
              failedTrades.set(
                chunk[resultIndex].id,
                `Не удалось сохранить в Firestore: ${getSyncErrorMessage(result.reason)}`,
              );
            }
          });
        }

        if (failedTrades.size > 0) {
          importedTrades = importedTrades.filter(
            (trade) => !failedTrades.has(trade.id),
          );
          rows = rows.map((row): TradeCsvImportRowResult => {
            const failure = row.tradeId ? failedTrades.get(row.tradeId) : null;
            return failure
              ? {
                  ...row,
                  status: "error",
                  message: failure,
                }
              : row;
          });
        }
      }

      if (importedTrades.length > 0) {
        setHistory((currentHistory) => {
          const nextHistory = mergeImportedTrades(currentHistory, importedTrades);
          saveTradeHistory(nextHistory);
          return nextHistory;
        });
      }

      report = createCsvImportReport(file.name, rows);
    } catch (error) {
      report = createCsvImportReport(file.name, [
        {
          row: null,
          symbol: null,
          period: null,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось прочитать или импортировать CSV.",
        },
      ]);
    }

    closeAccountDialog();
    await wait(accountDialogAnimationMs);
    openCsvImportResultDialog(report);
  }

  function openCsvImportResultDialog(report: TradeCsvImportReport) {
    clearCsvImportCloseTimer();
    setCsvImportReport(report);
    window.requestAnimationFrame(() => setIsCsvImportReportOpen(true));
  }

  function closeCsvImportResultDialog() {
    clearCsvImportCloseTimer();
    setIsCsvImportReportOpen(false);
    csvImportCloseTimerRef.current = window.setTimeout(() => {
      setCsvImportReport(null);
    }, csvImportDialogAnimationMs);
  }

  async function resolveCsvImportRow(
    row: TradeCsvImportRowResult,
    values: TradeCsvImportDraft,
  ) {
    const { trade, isDuplicate } = await saveTradeDraft(values, {
      rowNumber: row.row ?? 2,
      source: "csv",
    });

    const resolvedRow: TradeCsvImportRowResult = {
      ...row,
      symbol: trade.calculation.symbol,
      period: trade.calculation.period,
      status: isDuplicate ? "duplicate" : "imported",
      message: isDuplicate
        ? "Связка уже существует и была пропущена."
        : "Заполнено и импортировано вручную.",
      tradeId: trade.id,
      values,
    };

    setCsvImportReport((currentReport) => {
      if (!currentReport) {
        return currentReport;
      }

      return createCsvImportReport(
        currentReport.fileName,
        currentReport.rows.map((candidate) =>
          isSameCsvImportRow(candidate, row) ? resolvedRow : candidate,
        ),
      );
    });
  }

  async function saveManualTrade(values: TradeCsvImportDraft) {
    const { isDuplicate } = await saveTradeDraft(values, {
      rowNumber: 2,
      source: "manual",
    });

    if (isDuplicate) {
      throw new Error(
        "Связка с такой монетой, периодом и итогом уже существует.",
      );
    }
  }

  async function saveManualTradeAndCloseAnalyzer(
    values: TradeCsvImportDraft,
  ) {
    if (editingTrade) {
      await updateManualTrade(editingTrade, values);
      closeTradeDetails();
      return;
    }

    await saveManualTrade(values);
    closeAnalyzeSheet();
  }

  async function updateManualTrade(
    originalTrade: SavedTrade,
    values: TradeCsvImportDraft,
  ) {
    const {
      createCsvTradeDuplicateKey,
      createTradeFromCsvDraft,
      mergeImportedTrades,
    } = await import("./lib/tradeCsvImport");
    const result = createTradeFromCsvDraft(values, 2, {
      requireTotal: true,
      allowTotalOnly: true,
      source: "manual",
    });

    if ("message" in result) {
      throw new Error(result.message);
    }

    const updatedTrade = mergeEditedTrade(originalTrade, result.trade);
    const duplicateKey = createCsvTradeDuplicateKey(updatedTrade);
    const isDuplicate = history.some(
      (trade) =>
        trade.id !== originalTrade.id &&
        createCsvTradeDuplicateKey(trade) === duplicateKey,
    );

    if (isDuplicate) {
      throw new Error(
        "Связка с такой монетой, периодом и итогом уже существует.",
      );
    }

    if (authUser) {
      try {
        const { saveCloudTrade } = await import("./lib/cloudSync");
        await saveCloudTrade(updatedTrade);
      } catch (error) {
        throw new Error(
          `Не удалось сохранить в Firestore: ${getSyncErrorMessage(error)}`,
          { cause: error },
        );
      }
    }

    setHistory((currentHistory) => {
      const nextHistory = mergeImportedTrades(currentHistory, [updatedTrade]);
      saveTradeHistory(nextHistory);
      return nextHistory;
    });
    setSelectedTrade((currentTrade) =>
      currentTrade?.id === originalTrade.id ? updatedTrade : currentTrade,
    );
  }

  function openManualTradeDialog() {
    setEditingTrade(null);
    setIsManualTradeOpen(true);
  }

  function openTradeEditor(trade: SavedTrade) {
    setEditingTrade(trade);
    setIsManualTradeOpen(true);
  }

  function closeManualTradeDialog() {
    setIsManualTradeOpen(false);
    setEditingTrade(null);
  }

  async function saveTradeDraft(
    values: TradeCsvImportDraft,
    options: { rowNumber: number; source: "csv" | "manual" },
  ) {
    const {
      createCsvTradeDuplicateKey,
      createTradeFromCsvDraft,
      mergeImportedTrades,
    } = await import("./lib/tradeCsvImport");
    const result = createTradeFromCsvDraft(values, options.rowNumber, {
      requireTotal: true,
      allowTotalOnly: true,
      source: options.source,
    });

    if ("message" in result) {
      throw new Error(result.message);
    }

    const duplicateKey = createCsvTradeDuplicateKey(result.trade);
    const isDuplicate = history.some(
      (trade) => createCsvTradeDuplicateKey(trade) === duplicateKey,
    );
    if (!isDuplicate && authUser) {
      try {
        const { saveCloudTrade } = await import("./lib/cloudSync");
        await saveCloudTrade(result.trade);
      } catch (error) {
        throw new Error(
          `Не удалось сохранить в Firestore: ${getSyncErrorMessage(error)}`,
          { cause: error },
        );
      }
    }

    if (!isDuplicate) {
      setHistory((currentHistory) => {
        const nextHistory = mergeImportedTrades(currentHistory, [result.trade]);
        saveTradeHistory(nextHistory);
        return nextHistory;
      });
    }

    return { trade: result.trade, isDuplicate };
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

  function clearCsvImportCloseTimer() {
    if (csvImportCloseTimerRef.current !== null) {
      window.clearTimeout(csvImportCloseTimerRef.current);
      csvImportCloseTimerRef.current = null;
    }
  }

  return (
    <div className="relative h-[100svh] overflow-hidden">
      <div
        className={cn(
          "h-[100svh] transform-gpu transition-transform duration-300 ease-out",
          activePage !== "home"
            ? "pointer-events-none -translate-x-full overflow-y-hidden"
            : "translate-x-0 overflow-y-auto",
        )}
      >
        <HomePage
          history={history}
          onOpenHistory={() => setActivePage("history")}
          onOpenMonthlyOverview={() => setActivePage("monthly")}
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
          activePage === "history"
            ? "pointer-events-auto translate-x-0 overflow-y-auto"
            : "pointer-events-none translate-x-full overflow-y-hidden",
        )}
      >
        <HistoryPage
          history={history}
          onBack={() => setActivePage("home")}
          onTradeSelect={openTradeDetails}
          onDeleteAll={deleteAllTrades}
        />
      </div>

      <div
        className={cn(
          "absolute inset-0 h-[100svh] transform-gpu transition-transform duration-300 ease-out",
          activePage === "monthly"
            ? "pointer-events-auto translate-x-0 overflow-y-auto"
            : activePage === "monthlyCoin"
              ? "pointer-events-none -translate-x-full overflow-y-hidden"
              : "pointer-events-none translate-x-full overflow-y-hidden",
        )}
      >
        <MonthlyOverviewPage
          history={history}
          isActive={activePage === "monthly"}
          onCoinSelect={(symbol, monthDate) => {
            setSelectedMonthlyCoin({ symbol, monthDate });
            setActivePage("monthlyCoin");
          }}
          onBack={() => setActivePage("home")}
        />
      </div>

      <div
        className={cn(
          "absolute inset-0 h-[100svh] transform-gpu transition-transform duration-300 ease-out",
          activePage === "monthlyCoin"
            ? "pointer-events-auto translate-x-0 overflow-y-auto"
            : "pointer-events-none translate-x-full overflow-y-hidden",
        )}
      >
        {selectedMonthlyCoin ? (
          <MonthlyCoinTradesPage
            key={`${selectedMonthlyCoin.symbol}-${selectedMonthlyCoin.monthDate.toISOString()}`}
            history={history}
            symbol={selectedMonthlyCoin.symbol}
            monthDate={selectedMonthlyCoin.monthDate}
            onBack={() => setActivePage("monthly")}
            onTradeSelect={openTradeDetails}
          />
        ) : null}
      </div>

      <FloatingAddButton onClick={openAnalyzeSheet} />

      <ManualTradeDialog
        key={editingTrade?.id ?? "new-manual-trade"}
        isOpen={isManualTradeOpen}
        title={editingTrade ? "Редактировать связку" : "Добавить связку вручную"}
        description={
          editingTrade
            ? "Измените нужные поля и сохраните обновлённый результат."
            : "Укажите монету, период и итог по связке. Остальные поля можно оставить пустыми."
        }
        initialValues={manualTradeInitialValues}
        onClose={closeManualTradeDialog}
        onSave={saveManualTradeAndCloseAnalyzer}
      />

      {isDetailsMounted && selectedTrade ? (
        <TradeDetailsSheet
          trade={selectedTrade}
          isOpen={isDetailsOpen}
          onClose={closeTradeDetails}
          onEdit={() => openTradeEditor(selectedTrade)}
          onDelete={() => deleteTrade(selectedTrade.id)}
          isNestedDialogOpen={isManualTradeOpen}
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
          onManual={openManualTradeDialog}
          onReset={resetAnalysisState}
          onDraftsChange={setConflictDrafts}
          onApplyConflicts={applyConflicts}
          onDone={completeTrade}
          onRetry={retryAnalysis}
          isSaving={isCloudSaving}
          isNestedDialogOpen={isManualTradeOpen}
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
          onImportCsv={importTradeHistoryCsv}
        />
      ) : null}

      {csvImportReport ? (
        <CsvImportResultDialog
          isOpen={isCsvImportReportOpen}
          report={csvImportReport}
          onClose={closeCsvImportResultDialog}
          onResolveRow={resolveCsvImportRow}
        />
      ) : null}
    </div>
  );
}

function createCsvImportReport(
  fileName: string,
  rows: TradeCsvImportRowResult[],
): TradeCsvImportReport {
  return {
    fileName,
    importedCount: rows.filter((row) => row.status === "imported").length,
    duplicateCount: rows.filter((row) => row.status === "duplicate").length,
    invalidCount: rows.filter((row) => row.status === "error").length,
    rows,
  };
}

function isSameCsvImportRow(
  candidate: TradeCsvImportRowResult,
  target: TradeCsvImportRowResult,
) {
  return (
    candidate.row === target.row &&
    candidate.status === target.status &&
    candidate.message === target.message
  );
}

function createHistoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `trade-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default App;
