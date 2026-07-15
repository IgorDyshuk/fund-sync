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

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Firestore отклонил доступ",
    );
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
