// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { AnalyzeSheet } from "./AnalyzeSheet";
import { AccountDialog } from "./AccountDialog";
import { AuthDialog } from "./AuthDialog";
import { HistoryPage } from "./HistoryPage";
import { HomePage } from "./HomePage";
import { TradeDetailsSheet } from "./TradeDetailsSheet";
import { calculateTrade } from "../lib/tradeCalculator";
import { saveTradeHistory } from "../lib/tradeHistory";
import type { AnalysisResponse } from "../lib/analysisSchema";
import type { SavedTrade } from "../types/app";

beforeEach(() => {
  localStorage.clear();

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  }

  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("history screen interactions", () => {
  it("opens the account dialog and explains local mode before Firebase is configured", () => {
    const onClose = vi.fn();

    render(
      <AuthDialog
        isOpen
        firebaseConfigured={false}
        onClose={onClose}
        onAuthenticated={() => undefined}
      />,
    );

    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByText(/Firebase пока не настроен/)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("opens the history page from the home widget and returns back", () => {
    const trade = createTrade("history-1", "BTCUSDT", 12);
    saveTradeHistory([trade]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Показать все/ }));
    expect(screen.getByRole("heading", { name: "Все связки" })).not.toBeNull();
    expect(screen.getByText("1 связка")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Вернуться на главную" }));
    expect(screen.getByRole("heading", { name: "Обзор" })).not.toBeNull();
  });

  it("opens a saved trade from both home and full-history rows", () => {
    const trade = createTrade("details-1", "ETHUSDT", 24);
    const onHomeSelect = vi.fn();
    const onHistorySelect = vi.fn();

    const { unmount } = render(
      <HomePage
        history={[trade]}
        onTradeSelect={onHomeSelect}
        onOpenHistory={() => undefined}
        authUser={null}
        authLoading={false}
        authError={null}
        onOpenAuth={() => undefined}
        onOpenAccount={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Открыть связку ETHUSDT" }));
    expect(onHomeSelect).toHaveBeenCalledWith(trade);
    unmount();

    render(
      <HistoryPage
        history={[trade]}
        onBack={() => undefined}
        onTradeSelect={onHistorySelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Открыть связку ETHUSDT" }));
    expect(onHistorySelect).toHaveBeenCalledWith(trade);
  });
});

describe("account interactions", () => {
  it("shows Google as a separate authentication option", () => {
    render(
      <AuthDialog
        isOpen
        firebaseConfigured
        onClose={() => undefined}
        onAuthenticated={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Продолжить с Google" }),
    ).not.toBeNull();
    expect(screen.getByText("или по email")).not.toBeNull();
  });

  it("shows the account email and logs out only from the account dialog", () => {
    const onLogout = vi.fn();

    const { container, rerender } = render(
      <AccountDialog
        isOpen
        user={{ uid: "user-1", email: "user@example.com", displayName: null }}
        onClose={() => undefined}
        onLogout={onLogout}
      />,
    );

    expect(container.firstElementChild?.className).toContain("opacity-100");
    expect(screen.getByText("user@example.com")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Выйти из аккаунта" }));
    expect(onLogout).toHaveBeenCalledOnce();

    rerender(
      <AccountDialog
        isOpen={false}
        user={{ uid: "user-1", email: "user@example.com", displayName: null }}
        onClose={() => undefined}
        onLogout={onLogout}
      />,
    );
    expect(container.firstElementChild?.className).toContain("opacity-0");
  });
});

describe("trade details interactions", () => {
  it("requires confirmation before deleting and deletes only after confirmation", () => {
    const onDelete = vi.fn();

    render(
      <TradeDetailsSheet
        trade={createTrade("delete-1", "SOLUSDT", 8)}
        isOpen
        onClose={() => undefined}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Удалить связку" }));
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Удалить связку" }));
    fireEvent.click(screen.getByRole("button", { name: /^Удалить$/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button, overlay and a downward swipe", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <TradeDetailsSheet
        trade={createTrade("close-1", "XRPUSDT", 2)}
        isOpen
        onClose={onClose}
        onDelete={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <TradeDetailsSheet
        trade={createTrade("close-1", "XRPUSDT", 2)}
        isOpen
        onClose={onClose}
        onDelete={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть информацию о связке" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <TradeDetailsSheet
        trade={createTrade("close-1", "XRPUSDT", 2)}
        isOpen
        onClose={onClose}
        onDelete={() => undefined}
      />,
    );
    const header = screen.getByRole("dialog").querySelector("header");
    expect(header).not.toBeNull();
    fireEvent.touchStart(header as HTMLElement, { touches: [{ clientY: 50 }] });
    fireEvent.touchMove(header as HTMLElement, { touches: [{ clientY: 140 }] });
    fireEvent.touchEnd(header as HTMLElement, { touches: [] });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("analyzer close confirmation", () => {
  it("shows and allows saving a result with only one short position", () => {
    const analysis: AnalysisResponse = {
      bundleType: "Фьючерс",
      legs: [
        {
          id: "future-short",
          label: "Short BTCUSDT",
          type: "futures",
          symbol: "BTCUSDT",
          side: "short",
          startedAt: "15.07.2026 10:00",
          endedAt: "15.07.2026 11:30",
          volumeUsdt: 750,
          pnlUsdt: -18.42,
          realizedPnlUsdt: -18.42,
        },
      ],
      future: {
        symbol: "BTCUSDT",
        side: "short",
        startedAt: "15.07.2026 10:00",
        endedAt: "15.07.2026 11:30",
        volumeUsdt: 750,
        realizedPnlUsdt: -18.42,
      },
      spot: {},
      conflicts: [],
      confidence: 0.98,
      notes: [],
    };
    const calculation = calculateTrade(analysis);
    const onDone = vi.fn();

    render(
      <AnalyzeSheet
        isOpen
        files={[]}
        instructions=""
        status="result"
        error={null}
        analysis={analysis}
        resultAnalysis={analysis}
        calculation={calculation}
        conflictDrafts={{}}
        onClose={() => undefined}
        onFilesChange={() => undefined}
        onInstructionsChange={() => undefined}
        onAnalyze={() => undefined}
        onReset={() => undefined}
        onDraftsChange={() => undefined}
        onApplyConflicts={() => undefined}
        onDone={onDone}
        onRetry={() => undefined}
        spotSignPromptOpen={false}
        onSpotSignSelect={() => undefined}
      />,
    );

    expect(screen.getAllByText("-18,42 USDT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("750,00 USDT")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("offers save, discard and stay actions after a result is ready", () => {
    const analysis = createTrade("analyzer", "BTCUSDT", 20).analysis;
    const calculation = calculateTrade(analysis);
    const onDone = vi.fn();
    const onClose = vi.fn();

    render(
      <AnalyzeSheet
        isOpen
        files={[]}
        instructions=""
        status="result"
        error={null}
        analysis={analysis}
        resultAnalysis={analysis}
        calculation={calculation}
        conflictDrafts={{}}
        onClose={onClose}
        onFilesChange={() => undefined}
        onInstructionsChange={() => undefined}
        onAnalyze={() => undefined}
        onReset={() => undefined}
        onDraftsChange={() => undefined}
        onApplyConflicts={() => undefined}
        onDone={onDone}
        onRetry={() => undefined}
        spotSignPromptOpen={false}
        onSpotSignSelect={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.getByRole("alertdialog")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape", repeat: true });
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Остаться" }));

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "Не сохранять" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("closes immediately with Escape before a result exists", () => {
    const onClose = vi.fn();
    render(
      <AnalyzeSheet
        isOpen
        files={[]}
        instructions=""
        status="idle"
        error={null}
        analysis={null}
        resultAnalysis={null}
        calculation={null}
        conflictDrafts={{}}
        onClose={onClose}
        onFilesChange={() => undefined}
        onInstructionsChange={() => undefined}
        onAnalyze={() => undefined}
        onReset={() => undefined}
        onDraftsChange={() => undefined}
        onApplyConflicts={() => undefined}
        onDone={() => undefined}
        onRetry={() => undefined}
        spotSignPromptOpen={false}
        onSpotSignSelect={() => undefined}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("prevents duplicate completion while cloud saving is in progress", () => {
    const analysis = createTrade("saving", "ETHUSDT", 8).analysis;
    const onDone = vi.fn();
    render(
      <AnalyzeSheet
        isOpen
        files={[]}
        instructions=""
        status="result"
        error={null}
        analysis={analysis}
        resultAnalysis={analysis}
        calculation={calculateTrade(analysis)}
        conflictDrafts={{}}
        onClose={() => undefined}
        onFilesChange={() => undefined}
        onInstructionsChange={() => undefined}
        onAnalyze={() => undefined}
        onReset={() => undefined}
        onDraftsChange={() => undefined}
        onApplyConflicts={() => undefined}
        onDone={onDone}
        onRetry={() => undefined}
        isSaving
        spotSignPromptOpen={false}
        onSpotSignSelect={() => undefined}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "Сохраняем..." });
    expect(saveButton).toHaveProperty("disabled", true);
    fireEvent.click(saveButton);
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("App delete integration", () => {
  it("removes the selected trade from localStorage after confirmation", async () => {
    const trade = createTrade("persisted-1", "VANRYUSDT", 15.8);
    saveTradeHistory([trade]);
    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Открыть связку VANRYUSDT" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Удалить связку" }));
    fireEvent.click(screen.getByRole("button", { name: /^Удалить$/ }));

    await waitFor(() => {
      expect(localStorage.getItem("fund-sync:trade-history:v1")).toBe("[]");
    });
  });
});

function createTrade(id: string, symbol: string, netResult: number): SavedTrade {
  const futurePnl = netResult + 10;
  const spotPnl = netResult - futurePnl;
  const analysis: AnalysisResponse = {
    bundleType: "Фьючерс + Спот",
    legs: [],
    future: {
      symbol,
      side: "short",
      startedAt: "14.07.2026 11:00",
      endedAt: "14.07.2026 12:00",
      volumeUsdt: 1000,
      realizedPnlUsdt: futurePnl,
    },
    spot: {
      method: "manual",
      volumeUsdt: 1000,
      rawPnlUsdt: Math.abs(spotPnl),
    },
    conflicts: [],
    confidence: 1,
    notes: [],
  };

  return {
    id,
    savedAt: "2026-07-14T12:00:00.000Z",
    instructions: "",
    analysis,
    calculation: calculateTrade(analysis),
  };
}
