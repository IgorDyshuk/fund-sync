// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUserSummary } from "../types/auth";
import type { SavedTrade } from "../types/app";
import { calculateTrade } from "../lib/tradeCalculator";

const cloudMocks = vi.hoisted(() => ({
  authListener: null as ((user: AuthUserSummary | null) => void) | null,
  authUnsubscribe: vi.fn(),
  liveListener: null as ((trades: SavedTrade[]) => void) | null,
  liveErrorListener: null as ((error: unknown) => void) | null,
  liveUnsubscribe: vi.fn(),
  deleteCloudTrade: vi.fn(),
  logoutFromCloud: vi.fn(),
  observeAuthState: vi.fn(),
  observeCloudTrades: vi.fn(),
  saveCloudTrade: vi.fn(),
  syncUserHistory: vi.fn(),
}));

vi.mock("../lib/firebaseEnv", () => ({
  isFirebaseConfigured: true,
}));

vi.mock("../lib/cloudSync", () => ({
  deleteCloudTrade: cloudMocks.deleteCloudTrade,
  logoutFromCloud: cloudMocks.logoutFromCloud,
  observeAuthState: cloudMocks.observeAuthState,
  observeCloudTrades: cloudMocks.observeCloudTrades,
  saveCloudTrade: cloudMocks.saveCloudTrade,
  syncUserHistory: cloudMocks.syncUserHistory,
}));

import App from "../App";

const authenticatedUser: AuthUserSummary = {
  uid: "user-1",
  email: "owner@example.com",
  displayName: null,
};

describe("App cloud integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    cloudMocks.authListener = null;
    cloudMocks.authUnsubscribe = vi.fn();
    cloudMocks.liveListener = null;
    cloudMocks.liveErrorListener = null;
    cloudMocks.liveUnsubscribe = vi.fn();

    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    cloudMocks.observeAuthState.mockImplementation((listener) => {
      cloudMocks.authListener = listener;
      listener(authenticatedUser);
      return cloudMocks.authUnsubscribe;
    });
    cloudMocks.observeCloudTrades.mockImplementation((listener, onError) => {
      cloudMocks.liveListener = listener;
      cloudMocks.liveErrorListener = onError;
      return cloudMocks.liveUnsubscribe;
    });
    cloudMocks.syncUserHistory.mockResolvedValue([]);
    cloudMocks.deleteCloudTrade.mockResolvedValue(undefined);
    cloudMocks.saveCloudTrade.mockResolvedValue(undefined);
    cloudMocks.logoutFromCloud.mockImplementation(async () => {
      cloudMocks.authListener?.(null);
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("finishes account checking before a slow cloud-history migration completes", async () => {
    let resolveHistory: ((trades: SavedTrade[]) => void) | undefined;
    cloudMocks.syncUserHistory.mockReturnValue(
      new Promise<SavedTrade[]>((resolve) => {
        resolveHistory = resolve;
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    ).not.toBeNull();
    expect(screen.queryByLabelText("Проверка аккаунта")).toBeNull();
    expect(cloudMocks.observeCloudTrades).not.toHaveBeenCalled();

    resolveHistory?.([]);
    await waitFor(() => expect(cloudMocks.observeCloudTrades).toHaveBeenCalledOnce());
  });

  it("fades the login dialog in and out for an unauthenticated visitor", async () => {
    cloudMocks.observeAuthState.mockImplementation((listener) => {
      cloudMocks.authListener = listener;
      listener(null);
      return cloudMocks.authUnsubscribe;
    });
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Войти в аккаунт" }),
    );
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.className).toContain("opacity-100"));

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(dialog.className).toContain("opacity-0");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("renders initial cloud history and applies subsequent live snapshots", async () => {
    cloudMocks.syncUserHistory.mockResolvedValue([
      createTrade("initial", "BTCUSDT", "2026-07-15T10:00:00.000Z"),
    ]);
    render(<App />);

    expect(
      await screen.findAllByRole("button", { name: "Открыть связку BTCUSDT" }),
    ).toHaveLength(2);

    act(() => {
      cloudMocks.liveListener?.([
        createTrade("live", "ETHUSDT", "2026-07-15T11:00:00.000Z"),
      ]);
    });

    expect(
      screen.getAllByRole("button", { name: "Открыть связку ETHUSDT" }),
    ).toHaveLength(2);
    expect(screen.queryAllByRole("button", { name: "Открыть связку BTCUSDT" })).toHaveLength(0);
  });

  it("shows initial and live Firestore failures as user-facing sync errors", async () => {
    cloudMocks.syncUserHistory.mockRejectedValue({ code: "permission-denied" });
    const { unmount } = render(<App />);

    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.every((alert) => alert.textContent?.includes("Firestore отклонил доступ")),
    ).toBe(true);
    unmount();

    cloudMocks.syncUserHistory.mockResolvedValue([]);
    render(<App />);
    await waitFor(() => expect(cloudMocks.observeCloudTrades).toHaveBeenCalled());
    act(() => {
      cloudMocks.liveErrorListener?.({ code: "firestore/permission-denied" });
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Firestore отклонил доступ",
    );
  });

  it("deletes an authenticated trade from cloud and local history", async () => {
    cloudMocks.syncUserHistory.mockResolvedValue([
      createTrade("delete-1", "SOLUSDT", "2026-07-15T10:00:00.000Z"),
    ]);
    render(<App />);

    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Открыть связку SOLUSDT" }))[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Удалить связку" }));
    fireEvent.click(screen.getByRole("button", { name: /^Удалить$/ }));

    await waitFor(() => {
      expect(cloudMocks.deleteCloudTrade).toHaveBeenCalledWith("delete-1");
      expect(
        screen.queryAllByRole("button", { name: "Открыть связку SOLUSDT" }),
      ).toHaveLength(0);
    });
  });

  it("deletes every authenticated trade from cloud and local history after confirmation", async () => {
    cloudMocks.syncUserHistory.mockResolvedValue([
      createTrade("first", "BTCUSDT", "2026-07-15T10:00:00.000Z"),
      createTrade("second", "ETHUSDT", "2026-07-15T11:00:00.000Z"),
    ]);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Показать все/ }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));

    await waitFor(() => {
      expect(cloudMocks.deleteCloudTrade).toHaveBeenCalledTimes(2);
      expect(cloudMocks.deleteCloudTrade).toHaveBeenCalledWith("first");
      expect(cloudMocks.deleteCloudTrade).toHaveBeenCalledWith("second");
      expect(screen.getAllByText("История пока пустая")).toHaveLength(2);
    });
    expect(localStorage.getItem("fund-sync:trade-history:v1")).toBe("[]");
  });

  it("keeps local history when one cloud delete-all operation fails", async () => {
    const trades = [
      createTrade("first", "BTCUSDT", "2026-07-15T10:00:00.000Z"),
      createTrade("second", "ETHUSDT", "2026-07-15T11:00:00.000Z"),
    ];
    cloudMocks.syncUserHistory.mockResolvedValue(trades);
    cloudMocks.deleteCloudTrade.mockImplementation(async (tradeId: string) => {
      if (tradeId === "second") {
        throw { code: "firestore/permission-denied" };
      }
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Показать все/ }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить все связки" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить всё" }));

    const deleteAlerts = await screen.findAllByRole("alert");
    expect(
      deleteAlerts.every((alert) =>
        alert.textContent?.includes("Firestore отклонил доступ"),
      ),
    ).toBe(true);
    expect(screen.getByRole("alertdialog")).not.toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Открыть связку BTCUSDT" }),
    ).toHaveLength(2);
    expect(
      JSON.parse(localStorage.getItem("fund-sync:trade-history:v1") ?? "[]"),
    ).toHaveLength(2);
  });

  it("imports CSV history into cloud and local state without duplicating a repeated file", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );

    const csv = `Монета;Период;Кол-во;Спред Вход;Спред Выход;PnL Лонг;PnL Шорт;Итого (USDT)
INUSDT;30.06.2026 21:48 — 01.07.2026 09:37;10000;30,92%;-29,84%;319,44;-303,64;15,8`;
    const file = new File([csv], "history.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockResolvedValue(csv),
    });
    const input = screen.getByLabelText("Выбрать CSV с историей");

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(cloudMocks.saveCloudTrade).toHaveBeenCalledOnce();
      expect(
        screen.getAllByRole("button", { name: "Открыть связку INUSDT" }),
      ).toHaveLength(2);
    });
    const firstReport = await screen.findByRole("dialog", {
      name: "Результат импорта",
    });
    expect(firstReport.textContent).toContain("Добавлено1");
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Результат импорта" }),
      ).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Открыть личный кабинет" }));
    const repeatedInput = await screen.findByLabelText("Выбрать CSV с историей");

    fireEvent.change(repeatedInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Результат импорта" }).textContent,
      ).toContain("Дубликаты1");
    });
    expect(cloudMocks.saveCloudTrade).toHaveBeenCalledOnce();
    expect(
      JSON.parse(localStorage.getItem("fund-sync:trade-history:v1") ?? "[]"),
    ).toHaveLength(1);
  });

  it("keeps two imported trades when only their totals differ", async () => {
    render(<App />);
    const period = "10.07.2026 10:00 — 11:00";

    async function importTotal(total: string) {
      fireEvent.click(
        await screen.findByRole("button", { name: "Открыть личный кабинет" }),
      );
      const csv = `Монета;Период;Итого (USDT)\nBTCUSDT;${period};${total}`;
      const file = new File([csv], `total-${total}.csv`, { type: "text/csv" });
      Object.defineProperty(file, "text", {
        value: vi.fn().mockResolvedValue(csv),
      });
      fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
        target: { files: [file] },
      });
      await screen.findByRole("dialog", { name: "Результат импорта" });
      fireEvent.click(screen.getByRole("button", { name: "Готово" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", { name: "Результат импорта" }),
        ).toBeNull();
      });
    }

    await importTotal("8");
    await importTotal("9");

    expect(cloudMocks.saveCloudTrade).toHaveBeenCalledTimes(2);
    expect(
      screen.getAllByRole("button", { name: "Открыть связку BTCUSDT" }),
    ).toHaveLength(4);
    expect(
      JSON.parse(localStorage.getItem("fund-sync:trade-history:v1") ?? "[]"),
    ).toHaveLength(2);
  });

  it("shows oversized and unreadable CSV failures in the result dialog", async () => {
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );
    const oversizedFile = new File(["data"], "oversized.csv", {
      type: "text/csv",
    });
    Object.defineProperty(oversizedFile, "size", { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [oversizedFile] },
    });

    expect(
      (await screen.findByRole("dialog", { name: "Результат импорта" }))
        .textContent,
    ).toContain("CSV слишком большой");
    expect(screen.getByText("Файл")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Результат импорта" }),
      ).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Открыть личный кабинет" }));
    const unreadableFile = new File(["data"], "unreadable.csv", {
      type: "text/csv",
    });
    Object.defineProperty(unreadableFile, "text", {
      value: vi.fn().mockRejectedValue(new Error("Не удалось прочитать файл")),
    });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [unreadableFile] },
    });

    expect(
      (await screen.findByRole("dialog", { name: "Результат импорта" }))
        .textContent,
    ).toContain("Не удалось прочитать файл");
    expect(cloudMocks.saveCloudTrade).not.toHaveBeenCalled();
  });

  it("reports the exact CSV trade when Firestore rejects only one imported row", async () => {
    cloudMocks.saveCloudTrade.mockImplementation(async (trade: SavedTrade) => {
      if (trade.calculation.symbol === "ETHUSDT") {
        throw { code: "firestore/permission-denied" };
      }
    });
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );

    const csv = `Монета;Период;PnL Лонг;PnL Шорт;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;8;-;8
ETHUSDT;10.07.2026 12:00 — 13:00;-;5;5`;
    const file = new File([csv], "partial.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockResolvedValue(csv),
    });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [file] },
    });

    const report = await screen.findByRole("dialog", {
      name: "Результат импорта",
    });
    expect(report.textContent).toContain("Строка 3 · ETHUSDT");
    expect(report.textContent).toContain("10.07.2026 12:00 — 13:00");
    expect(report.textContent).toContain("Не удалось сохранить в Firestore");
    expect(report.textContent).toContain("Добавлено1");
    expect(report.textContent).toContain("Ошибки1");
    expect(
      screen.getAllByRole("button", { name: "Открыть связку BTCUSDT" }),
    ).toHaveLength(2);
    expect(
      screen.queryAllByRole("button", { name: "Открыть связку ETHUSDT" }),
    ).toHaveLength(0);
  });

  it("imports a CSV trade without Long and Short PnL when the required total is present", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );

    const csv = `Монета;Период;Итого (USDT)
ARBUSDT;11.07.2026 09:00 — 10:30;-12,40`;
    const file = new File([csv], "totals-only.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockResolvedValue(csv),
    });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [file] },
    });

    const report = await screen.findByRole("dialog", {
      name: "Результат импорта",
    });
    expect(report.textContent).toContain("Добавлено1");
    expect(report.textContent).toContain("Ошибки0");
    expect(cloudMocks.saveCloudTrade).toHaveBeenCalledOnce();
    expect(
      screen.getAllByRole("button", { name: "Открыть связку ARBUSDT" }),
    ).toHaveLength(2);
  });

  it("lets the user complete an invalid CSV trade and saves the corrected row", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );

    const csv = `Монета;Период;PnL Лонг;PnL Шорт;Итого (USDT)
SOLUSDT;неизвестно;-;-;7,5`;
    const file = new File([csv], "invalid-period.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: vi.fn().mockResolvedValue(csv),
    });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [file] },
    });

    await screen.findByRole("dialog", { name: "Результат импорта" });
    expect(screen.getByText("Строка 2 · SOLUSDT")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    fireEvent.change(screen.getByDisplayValue("неизвестно"), {
      target: { value: "10.07.2026 12:00 — 13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    await waitFor(() => {
      expect(cloudMocks.saveCloudTrade).toHaveBeenCalledOnce();
      expect(
        screen.getAllByRole("button", { name: "Открыть связку SOLUSDT" }),
      ).toHaveLength(2);
      expect(screen.getByText("Все строки обработаны без ошибок.")).not.toBeNull();
    });
    expect(
      JSON.parse(localStorage.getItem("fund-sync:trade-history:v1") ?? "[]"),
    ).toHaveLength(1);
  });

  it("validates manual corrections before saving an invalid CSV row", async () => {
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );
    const csv = `Монета;Период;Итого (USDT)
SOLUSDT;неизвестно;7,5`;
    const file = new File([csv], "invalid.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(csv) });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [file] },
    });

    await screen.findByRole("dialog", { name: "Результат импорта" });
    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Не удалось распознать период сделки.",
    );
    expect(cloudMocks.saveCloudTrade).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Заполнить строку 2" }),
    ).not.toBeNull();
  });

  it("keeps a manually corrected row unsaved when Firestore rejects it", async () => {
    cloudMocks.saveCloudTrade.mockRejectedValue({
      code: "firestore/permission-denied",
    });
    render(<App />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );
    const csv = `Монета;Период;Итого (USDT)
SOLUSDT;неизвестно;7,5`;
    const file = new File([csv], "firestore-error.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(csv) });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [file] },
    });

    await screen.findByRole("dialog", { name: "Результат импорта" });
    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    fireEvent.change(screen.getByDisplayValue("неизвестно"), {
      target: { value: "10.07.2026 12:00 — 13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Не удалось сохранить в Firestore",
    );
    expect(
      screen.queryAllByRole("button", { name: "Открыть связку SOLUSDT" }),
    ).toHaveLength(0);
    expect(
      JSON.parse(localStorage.getItem("fund-sync:trade-history:v1") ?? "[]"),
    ).toHaveLength(0);
  });

  it("marks a manually corrected row as duplicate by symbol, period and total", async () => {
    render(<App />);
    const validPeriod = "10.07.2026 12:00 — 13:00";

    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );
    const validCsv = `Монета;Период;Итого (USDT)\nSOLUSDT;${validPeriod};7,5`;
    const validFile = new File([validCsv], "valid.csv", { type: "text/csv" });
    Object.defineProperty(validFile, "text", {
      value: vi.fn().mockResolvedValue(validCsv),
    });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [validFile] },
    });
    await screen.findByRole("dialog", { name: "Результат импорта" });
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Результат импорта" }),
      ).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Открыть личный кабинет" }));
    const invalidCsv = `Монета;Период;Итого (USDT)\nSOLUSDT;неизвестно;7,5`;
    const invalidFile = new File([invalidCsv], "duplicate.csv", {
      type: "text/csv",
    });
    Object.defineProperty(invalidFile, "text", {
      value: vi.fn().mockResolvedValue(invalidCsv),
    });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [invalidFile] },
    });
    await screen.findByRole("dialog", { name: "Результат импорта" });
    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    fireEvent.change(screen.getByDisplayValue("неизвестно"), {
      target: { value: validPeriod },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Результат импорта" }).textContent,
      ).toContain("Дубликаты1");
    });
    expect(cloudMocks.saveCloudTrade).toHaveBeenCalledOnce();
    expect(
      JSON.parse(localStorage.getItem("fund-sync:trade-history:v1") ?? "[]"),
    ).toHaveLength(1);
  });

  it("animates the account dialog out, signs out and clears private local history", async () => {
    const trade = createTrade("private", "XRPUSDT", "2026-07-15T10:00:00.000Z");
    cloudMocks.syncUserHistory.mockResolvedValue([trade]);
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Открыть личный кабинет" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Выйти из аккаунта" }),
    );

    await waitFor(
      () => {
        expect(cloudMocks.logoutFromCloud).toHaveBeenCalledOnce();
        expect(
          screen.getByRole("button", { name: "Войти в аккаунт" }),
        ).not.toBeNull();
      },
      { timeout: 1_000 },
    );
    expect(localStorage.getItem("fund-sync:trade-history:v1")).toBe("[]");
  });

  it("unsubscribes auth and live Firestore listeners on unmount", async () => {
    const { unmount } = render(<App />);
    await waitFor(() => expect(cloudMocks.observeCloudTrades).toHaveBeenCalledOnce());

    unmount();

    expect(cloudMocks.authUnsubscribe).toHaveBeenCalledOnce();
    expect(cloudMocks.liveUnsubscribe).toHaveBeenCalledOnce();
  });
});

function createTrade(id: string, symbol: string, savedAt: string): SavedTrade {
  const analysis = {
    bundleType: "Фьючерс + Спот",
    future: { symbol, volumeUsdt: 1000, realizedPnlUsdt: 10 },
    spot: { volumeUsdt: 1000, rawPnlUsdt: 5 },
    legs: [],
    conflicts: [],
    notes: [],
  };

  return {
    id,
    savedAt,
    instructions: "",
    analysis,
    calculation: calculateTrade(analysis),
  };
}
