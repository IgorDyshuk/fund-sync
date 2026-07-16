// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, cleanup, within } from "@testing-library/react";
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
    expect(screen.getAllByText("1 связка").length).toBeGreaterThan(0);

    const historyPage = screen
      .getByRole("heading", { name: "Все связки" })
      .closest("main");
    fireEvent.click(
      within(historyPage as HTMLElement).getByRole("button", {
        name: "Вернуться на главную",
      }),
    );
    expect(screen.getByRole("heading", { name: "Обзор" })).not.toBeNull();
  });

  it("opens the monthly overview from the home widget and returns back", () => {
    saveTradeHistory([createTrade("monthly-1", "BTCUSDT", 12)]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Подробнее/ }));
    expect(
      screen.getByRole("heading", { name: "Обзор за месяц" }),
    ).not.toBeNull();

    const monthlyPage = screen
      .getByRole("heading", { name: "Обзор за месяц" })
      .closest("main");
    fireEvent.click(
      within(monthlyPage as HTMLElement).getByRole("button", {
        name: "Вернуться на главную",
      }),
    );
    expect(screen.getByRole("heading", { name: "Обзор" })).not.toBeNull();
  });

  it("locks the monthly page, hides add, and resets filters after leaving", async () => {
    saveTradeHistory([createTrade("monthly-filter", "BTCUSDT", 12)]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Подробнее/ }));
    const monthlyPage = screen
      .getByRole("heading", { name: "Обзор за месяц" })
      .closest("main");
    const monthlyScroller = monthlyPage?.parentElement as HTMLDivElement;
    expect(screen.getByRole("button", { name: "Добавить связку" })).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Выбрать период анализа" }),
    );
    expect(screen.queryByRole("button", { name: "Добавить связку" })).toBeNull();
    expect(monthlyPage?.parentElement?.className).toContain("overflow-hidden");

    fireEvent.click(screen.getByRole("radio", { name: "День" }));
    fireEvent.click(screen.getByRole("button", { name: "Применить" }));
    expect(screen.getByRole("heading", { name: "Обзор за день" })).not.toBeNull();

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Период анализа" })).toBeNull();
      expect(screen.getByRole("button", { name: "Добавить связку" })).not.toBeNull();
    });

    const dailyPage = screen
      .getByRole("heading", { name: "Обзор за день" })
      .closest("main");
    monthlyScroller.scrollTop = 420;
    fireEvent.click(
      within(dailyPage as HTMLElement).getByRole("button", {
        name: "Вернуться на главную",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Подробнее/ }));

    expect(
      screen.getByRole("heading", { name: "Обзор за месяц" }),
    ).not.toBeNull();
    expect(monthlyScroller.scrollTop).toBe(0);
  });

  it("unlocks the monthly page after closing the filter with Escape or the backdrop", async () => {
    saveTradeHistory([createTrade("monthly-close", "BTCUSDT", 12)]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Подробнее/ }));
    const monthlyPage = screen
      .getByRole("heading", { name: "Обзор за месяц" })
      .closest("main");
    const monthlyScroller = monthlyPage?.parentElement as HTMLDivElement;

    fireEvent.click(
      screen.getByRole("button", { name: "Выбрать период анализа" }),
    );
    expect(monthlyScroller.className).toContain("overflow-hidden");
    expect(screen.queryByRole("button", { name: "Добавить связку" })).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Период анализа" })).toBeNull();
    });
    expect(monthlyScroller.className).toContain("overflow-y-auto");
    expect(monthlyScroller.className).not.toContain("overflow-hidden");
    expect(screen.getByRole("button", { name: "Добавить связку" })).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Выбрать период анализа" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Закрыть выбор периода" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Период анализа" })).toBeNull();
    });
    expect(monthlyScroller.className).toContain("overflow-y-auto");
    expect(screen.getByRole("button", { name: "Добавить связку" })).not.toBeNull();
  });

  it("keeps a custom range after opening a coin and returning to the overview", async () => {
    saveTradeHistory([createTrade("coin-custom", "BTCUSDT", 12)]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Подробнее/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Выбрать период анализа" }),
    );
    fireEvent.change(screen.getByLabelText("От"), {
      target: { value: "2026-07-14" },
    });
    fireEvent.change(screen.getByLabelText("До"), {
      target: { value: "2026-07-14" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Применить" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Период анализа" })).toBeNull();
    });
    expect(screen.getByRole("heading", { name: "Обзор за период" })).not.toBeNull();

    const openCoinButton = screen.getByRole("button", {
      name: "Открыть связки BTCUSDT за 14 июля 2026 г.",
    });
    fireEvent.click(openCoinButton);

    const coinPage = screen
      .getByRole("heading", { name: "BTCUSDT", level: 1 })
      .closest("main");
    expect(
      within(coinPage as HTMLElement).getAllByText("14 июля 2026 г.").length,
    ).toBeGreaterThan(0);
    expect(
      within(coinPage as HTMLElement).queryByRole("region", { name: /Динамика/ }),
    ).toBeNull();

    fireEvent.click(
      within(coinPage as HTMLElement).getByRole("button", {
        name: "Вернуться к обзору месяца",
      }),
    );
    expect(screen.getByRole("heading", { name: "Обзор за период" })).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Открыть связки BTCUSDT за 14 июля 2026 г.",
      }),
    ).not.toBeNull();
  });

  it("opens a coin month page and returns to the same monthly overview", () => {
    saveTradeHistory([createTrade("coin-month-1", "BTCUSDT", 12)]);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Подробнее/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: /Открыть связки BTCUSDT за Июль 2026 г\./,
      }),
    );

    const coinMonthPage = screen
      .getByRole("heading", { name: "BTCUSDT", level: 1 })
      .closest("main");
    expect(coinMonthPage).not.toBeNull();
    expect(within(coinMonthPage as HTMLElement).getByText("1 связка")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Вернуться к обзору месяца" }),
    );
    expect(
      screen.getByRole("heading", { name: "Обзор за месяц" }),
    ).not.toBeNull();
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
        onOpenMonthlyOverview={() => undefined}
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

  it("deletes all history only after confirmation", async () => {
    const onDeleteAll = vi.fn().mockResolvedValue(undefined);
    render(
      <HistoryPage
        history={[
          createTrade("first", "BTCUSDT", 10),
          createTrade("second", "ETHUSDT", -5),
        ]}
        onBack={() => undefined}
        onTradeSelect={() => undefined}
        onDeleteAll={onDeleteAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    expect(onDeleteAll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));

    await waitFor(() => expect(onDeleteAll).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps the delete-all confirmation open when deletion fails", async () => {
    render(
      <HistoryPage
        history={[createTrade("first", "BTCUSDT", 10)]}
        onBack={() => undefined}
        onTradeSelect={() => undefined}
        onDeleteAll={() => Promise.reject(new Error("Firestore недоступен"))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Firestore недоступен");
    expect(screen.getByRole("alertdialog")).not.toBeNull();
  });

  it("closes the delete-all confirmation from Escape and the backdrop", () => {
    render(
      <HistoryPage
        history={[createTrade("first", "BTCUSDT", 10)]}
        onBack={() => undefined}
        onTradeSelect={() => undefined}
        onDeleteAll={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("prevents closing or repeating delete-all while deletion is pending", async () => {
    let finishDeletion: (() => void) | undefined;
    const onDeleteAll = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDeletion = resolve;
        }),
    );
    render(
      <HistoryPage
        history={[createTrade("first", "BTCUSDT", 10)]}
        onBack={() => undefined}
        onTradeSelect={() => undefined}
        onDeleteAll={onDeleteAll}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));
    expect(screen.getByRole("button", { name: "Удаляем..." })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Отмена" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Удаляем..." }));
    expect(onDeleteAll).toHaveBeenCalledOnce();
    expect(screen.getByRole("alertdialog")).not.toBeNull();

    finishDeletion?.();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
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
    const onEdit = vi.fn();

    render(
      <TradeDetailsSheet
        trade={createTrade("delete-1", "SOLUSDT", 8)}
        isOpen
        onClose={() => undefined}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    expect(onEdit).toHaveBeenCalledOnce();
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
        onEdit={() => undefined}
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
        onEdit={() => undefined}
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
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );
    const header = screen.getByRole("dialog").querySelector("header");
    expect(header).not.toBeNull();
    fireEvent.touchStart(header as HTMLElement, { touches: [{ clientY: 50 }] });
    fireEvent.touchMove(header as HTMLElement, { touches: [{ clientY: 140 }] });
    fireEvent.touchEnd(header as HTMLElement, { touches: [] });
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it("uses Escape to close a nested confirmation before the detail sheet", () => {
    const onClose = vi.fn();

    render(
      <TradeDetailsSheet
        trade={createTrade("escape-1", "BTCUSDT", 4)}
        isOpen
        onClose={onClose}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Удалить связку" }));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close the detail sheet while an edit dialog handles Escape", () => {
    const onClose = vi.fn();

    render(
      <TradeDetailsSheet
        trade={createTrade("nested-escape", "ETHUSDT", 5)}
        isOpen
        isNestedDialogOpen
        onClose={onClose}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
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

describe("App manual trade integration", () => {
  it("opens manual entry from inside the analyzer and Escape closes only that form", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить связку" }));
    expect(screen.getByRole("dialog", { name: "Анализ связки" })).not.toBeNull();
    const manualButton = screen.getByRole("button", { name: "Вручную" });
    const analyzeButton = screen.getByRole("button", { name: "Анализировать" });
    expect(
      manualButton.compareDocumentPosition(analyzeButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    fireEvent.click(manualButton);
    expect(
      screen.getByRole("dialog", { name: "Добавить связку вручную" }),
    ).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Добавить связку вручную" }),
      ).toBeNull();
    });
    expect(screen.getByRole("dialog", { name: "Анализ связки" })).not.toBeNull();
  });

  it("adds a total-only trade from the analyzer and persists it locally", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить связку" }));
    fireEvent.click(screen.getByRole("button", { name: "Вручную" }));
    fireEvent.change(screen.getByLabelText("Монета *"), {
      target: { value: "ARBUSDT" },
    });
    fireEvent.change(screen.getByLabelText("Итог, USDT *"), {
      target: { value: "12,45" },
    });
    selectManualPeriod("2026-07-15T10:00", "2026-07-15T11:30");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Открыть связку ARBUSDT" }),
      ).toHaveLength(2);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Добавить связку вручную" }),
      ).toBeNull();
      expect(
        screen.queryByRole("dialog", { name: "Анализ связки" }),
      ).toBeNull();
    });
    const stored = JSON.parse(
      localStorage.getItem("fund-sync:trade-history:v1") ?? "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].analysis.bundleType).toBe("Ручной итог");
    expect(stored[0].calculation.netResult).toBe(12.45);
    expect(stored[0].analysis.notes).toContain("Добавлено вручную.");
  });

  it("edits a saved trade in place from its detail sheet", async () => {
    const originalTrade = createTrade("edit-1", "ADAUSDT", 8);
    saveTradeHistory([originalTrade]);
    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Открыть связку ADAUSDT" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));

    expect(
      screen.getByRole("dialog", { name: "Редактировать связку" }),
    ).not.toBeNull();
    expect((screen.getByLabelText("Монета *") as HTMLInputElement).value).toBe(
      "ADAUSDT",
    );
    expect(
      (screen.getByLabelText("Начало *") as HTMLInputElement).value,
    ).toBe("2026-07-14T11:00");
    expect(
      (screen.getByLabelText("Окончание *") as HTMLInputElement).value,
    ).toBe("2026-07-14T12:00");

    fireEvent.change(screen.getByLabelText("Монета *"), {
      target: { value: "XLMUSDT" },
    });
    fireEvent.change(screen.getByLabelText("Итог, USDT *"), {
      target: { value: "9,75" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Редактировать связку" }),
      ).toBeNull();
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Информация о связке" }),
      ).toBeNull();
    });

    const stored = JSON.parse(
      localStorage.getItem("fund-sync:trade-history:v1") ?? "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("edit-1");
    expect(stored[0].calculation.symbol).toBe("XLMUSDT");
    expect(stored[0].calculation.netResult).toBe(9.75);
    expect(stored[0].analysis.notes).toContain("Отредактировано вручную.");
  });

  it("closes only the editor on Escape and keeps trade details open", async () => {
    saveTradeHistory([createTrade("edit-escape", "NEARUSDT", 11)]);
    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Открыть связку NEARUSDT" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Редактировать связку" }),
      ).toBeNull();
    });
    expect(
      screen.getByRole("dialog", { name: "Информация о связке" }),
    ).not.toBeNull();
  });

  it("rejects editing a trade into a duplicate of another saved trade", async () => {
    const firstTrade = createTrade("duplicate-edit-1", "APTUSDT", 6);
    const secondTrade = createTrade("duplicate-edit-2", "SUIUSDT", 9);
    saveTradeHistory([firstTrade, secondTrade]);
    render(<App />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Открыть связку APTUSDT" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    fireEvent.change(screen.getByLabelText("Монета *"), {
      target: { value: "SUIUSDT" },
    });
    fireEvent.change(screen.getByLabelText("Итог, USDT *"), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "уже существует",
    );
    expect(
      screen.getByRole("dialog", { name: "Редактировать связку" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Информация о связке" }),
    ).not.toBeNull();
    const stored = JSON.parse(
      localStorage.getItem("fund-sync:trade-history:v1") ?? "[]",
    );
    expect(stored).toHaveLength(2);
    expect(stored.map((trade: SavedTrade) => trade.id)).toContain(
      "duplicate-edit-1",
    );
  });

  it("requires a recognizable period and rejects a duplicate manual trade", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить связку" }));
    fireEvent.click(screen.getByRole("button", { name: "Вручную" }));
    fireEvent.change(screen.getByLabelText("Монета *"), {
      target: { value: "SOLUSDT" },
    });
    fireEvent.change(screen.getByLabelText("Итог, USDT *"), {
      target: { value: "7,5" },
    });
    selectManualPeriod("2026-07-15T13:00", "2026-07-15T12:00");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Окончание связки должно быть позже её начала.",
    );

    selectManualPeriod("2026-07-15T12:00", "2026-07-15T13:00");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Добавить связку вручную" }),
      ).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Добавить связку" }));
    fireEvent.click(screen.getByRole("button", { name: "Вручную" }));
    fireEvent.change(screen.getByLabelText("Монета *"), {
      target: { value: "SOLUSDT" },
    });
    fireEvent.change(screen.getByLabelText("Итог, USDT *"), {
      target: { value: "7,5" },
    });
    selectManualPeriod("2026-07-15T12:00", "2026-07-15T13:00");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "уже существует",
    );
    expect(
      JSON.parse(localStorage.getItem("fund-sync:trade-history:v1") ?? "[]"),
    ).toHaveLength(1);
  });
});

function selectManualPeriod(startedAt: string, endedAt: string) {
  fireEvent.change(screen.getByLabelText("Начало *"), {
    target: { value: startedAt },
  });
  fireEvent.change(screen.getByLabelText("Окончание *"), {
    target: { value: endedAt },
  });
}

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
