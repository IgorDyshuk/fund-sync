// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResponse } from "../lib/analysisSchema";
import { calculateTrade } from "../lib/tradeCalculator";
import type { SavedTrade } from "../types/app";
import { MonthlyCoinTradesPage } from "./MonthlyCoinTradesPage";
import { MonthlyOverviewPage } from "./MonthlyOverviewPage";
import { MonthlyPerformanceWidget } from "./MonthlyPerformanceWidget";

afterEach(cleanup);

describe("monthly analytics UI", () => {
  it("groups repeated coins and shows the signed monthly result", () => {
    render(
      <MonthlyPerformanceWidget
        history={[
          createTrade("one", "BTCUSDT", 20, "05.07.2026 12:00"),
          createTrade("two", "BTCUSDT", -5, "08.07.2026 12:00"),
          createTrade("three", "ETHUSDT", 7, "09.07.2026 12:00"),
        ]}
        monthDate={new Date(2026, 6, 1)}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText("Результат за июль")).not.toBeNull();
    expect(screen.getAllByText("BTCUSDT")).toHaveLength(1);
    expect(screen.getByText("15,00 USDT")).not.toBeNull();
    expect(screen.getByText("7,00 USDT")).not.toBeNull();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "22,00 USDT",
    );
    expect(screen.getByRole("img").innerHTML).toContain("inset-[13%]");
  });

  it("opens the detailed page from the widget action", () => {
    const onOpen = vi.fn();
    render(
      <MonthlyPerformanceWidget
        history={[]}
        monthDate={new Date(2026, 6, 1)}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Подробнее/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getByText("Нет закрытых связок")).not.toBeNull();
  });

  it("limits the compact widget list to four coins", () => {
    render(
      <MonthlyPerformanceWidget
        history={[
          createTrade("one", "ONEUSDT", 50, "01.07.2026 12:00"),
          createTrade("two", "TWOUSDT", 40, "02.07.2026 12:00"),
          createTrade("three", "THREEUSDT", 30, "03.07.2026 12:00"),
          createTrade("four", "FOURUSDT", 20, "04.07.2026 12:00"),
          createTrade("five", "FIVEUSDT", 10, "05.07.2026 12:00"),
        ]}
        monthDate={new Date(2026, 6, 1)}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText("Ещё 1")).not.toBeNull();
    expect(screen.queryByText("FIVEUSDT")).toBeNull();
  });

  it("renders monthly totals, losses and all grouped coins", () => {
    render(
      <MonthlyOverviewPage
        history={[
          createTrade("one", "INUSDT", 30, "05.07.2026 12:00"),
          createTrade("two", "INUSDT", 5, "08.07.2026 12:00"),
          createTrade("three", "TAIKOUSDT", -10, "09.07.2026 12:00"),
        ]}
        initialMonth={new Date(2026, 6, 1)}
        onBack={() => undefined}
        onCoinSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Обзор за месяц" })).not.toBeNull();
    expect(screen.getByText("Июль 2026 г.")).not.toBeNull();
    expect(screen.getAllByText("35,00 USDT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-10,00 USDT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("25,00 USDT").length).toBeGreaterThan(0);
    expect(screen.getByText(/INUSDT/)).not.toBeNull();
    expect(screen.getByText(/TAIKOUSDT/)).not.toBeNull();
    expect(screen.getByText("2 связки")).not.toBeNull();
    expect(
      screen.getByRole("img").querySelector(".monthly-donut-reveal"),
    ).not.toBeNull();
    expect(
      screen.getByRole("region", { name: "Динамика по месяцам" }).innerHTML,
    ).toContain("grid-cols-7");
    expect(
      screen.getByRole("region", { name: "Динамика по месяцам" }).innerHTML,
    ).not.toContain("overflow-x-auto");
  });

  it("changes the selected month from the month controls", () => {
    render(
      <MonthlyOverviewPage
        history={[
          createTrade("june", "SOLUSDT", 9, "12.06.2026 12:00"),
          createTrade("july", "BTCUSDT", 4, "12.07.2026 12:00"),
        ]}
        initialMonth={new Date(2026, 6, 1)}
        onBack={() => undefined}
        onCoinSelect={() => undefined}
      />,
    );

    const monthRegion = screen.getByRole("region", {
      name: "Динамика по месяцам",
    });
    const monthsBefore = Array.from(monthRegion.querySelectorAll("button")).map(
      (button) => button.getAttribute("aria-label"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Предыдущий месяц" }));
    expect(screen.getByText("Июнь 2026 г.")).not.toBeNull();
    expect(screen.getByText("SOLUSDT")).not.toBeNull();
    expect(screen.queryByText("BTCUSDT")).toBeNull();
    expect(
      Array.from(monthRegion.querySelectorAll("button")).map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(monthsBefore);
  });

  it("opens the selected coin and month from the monthly result list", () => {
    const onCoinSelect = vi.fn();
    render(
      <MonthlyOverviewPage
        history={[createTrade("btc", "BTCUSDT", 12, "12.07.2026 12:00")]}
        initialMonth={new Date(2026, 6, 1)}
        onBack={() => undefined}
        onCoinSelect={onCoinSelect}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Открыть связки BTCUSDT за Июль 2026 г.",
      }),
    );

    expect(onCoinSelect).toHaveBeenCalledOnce();
    expect(onCoinSelect.mock.calls[0][0]).toBe("BTCUSDT");
    expect(onCoinSelect.mock.calls[0][1]).toEqual(new Date(2026, 6, 1));
  });

  it("selects a fixed chart month and disables navigation beyond the current month", () => {
    const onCoinSelect = vi.fn();
    render(
      <MonthlyOverviewPage
        history={[
          createTrade("june", "SOLUSDT", 9, "12.06.2026 12:00"),
          createTrade("july", "BTCUSDT", 4, "12.07.2026 12:00"),
        ]}
        initialMonth={new Date(2026, 6, 1)}
        onBack={() => undefined}
        onCoinSelect={onCoinSelect}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Следующий месяц" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Июнь 2026 г.: 9,00 USDT" }),
    );
    expect(screen.getByText("Июнь 2026 г.")).not.toBeNull();
    expect(screen.getByText("SOLUSDT")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Открыть связки SOLUSDT за Июнь 2026 г.",
      }),
    );
    expect(onCoinSelect).toHaveBeenCalledWith("SOLUSDT", new Date(2026, 5, 1));
  });

  it("shows only the selected coin trades grouped by closing date", () => {
    const firstTrade = createTrade("first", "BTCUSDT", 10, "05.07.2026 12:00");
    const secondTrade = createTrade("second", "BTCUSDT", 5, "12.07.2026 12:00");
    const juneTrade = createTrade("old", "BTCUSDT", 30, "12.06.2026 12:00");
    const onTradeSelect = vi.fn();

    render(
      <MonthlyCoinTradesPage
        history={[
          firstTrade,
          secondTrade,
          createTrade("other", "ETHUSDT", 20, "12.07.2026 12:00"),
          juneTrade,
        ]}
        symbol="BTCUSDT"
        monthDate={new Date(2026, 6, 1)}
        onBack={() => undefined}
        onTradeSelect={onTradeSelect}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "BTCUSDT", level: 1 }),
    ).not.toBeNull();
    expect(screen.getByText("Июль 2026 г.")).not.toBeNull();
    expect(screen.getByText("15,00 USDT")).not.toBeNull();
    expect(screen.getByText("12 июля 2026 г.")).not.toBeNull();
    expect(screen.getByText("5 июля 2026 г.")).not.toBeNull();
    expect(screen.getByText("2 связки")).not.toBeNull();
    expect(screen.queryByText("ETHUSDT")).toBeNull();
    expect(
      screen.getByRole("region", { name: "Динамика BTCUSDT за семь месяцев" }),
    ).not.toBeNull();
    expect(document.querySelectorAll("[data-month-bar]")).toHaveLength(2);
    const chart = screen.getByRole("region", {
      name: "Динамика BTCUSDT за семь месяцев",
    });
    const monthButtonsBefore = Array.from(chart.querySelectorAll("button")).map(
      (button) => button.getAttribute("aria-label"),
    );
    const julyTradesContent = screen.getByTestId("monthly-coin-trades-content");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Открыть связку BTCUSDT" })[0],
    );
    expect(onTradeSelect).toHaveBeenCalledWith(secondTrade);
    onTradeSelect.mockClear();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Показать связки BTCUSDT за Июнь 2026 г.",
      }),
    );
    expect(screen.getByText("Июнь 2026 г.")).not.toBeNull();
    expect(screen.getByText("30,00 USDT")).not.toBeNull();
    expect(screen.getByText("12 июня 2026 г.")).not.toBeNull();
    expect(screen.getByText("1 связка")).not.toBeNull();
    expect(
      screen
        .getByTestId("monthly-coin-trades-content")
        .classList.contains("monthly-trades-reveal"),
    ).toBe(true);
    expect(screen.getByTestId("monthly-coin-trades-content")).not.toBe(
      julyTradesContent,
    );
    expect(
      Array.from(chart.querySelectorAll("button")).map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(monthButtonsBefore);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Открыть связку BTCUSDT" })[0],
    );
    expect(onTradeSelect).toHaveBeenCalledWith(juneTrade);
  });

  it("shows an empty state when a chart month has no trades for the coin", () => {
    render(
      <MonthlyCoinTradesPage
        history={[createTrade("july", "BTCUSDT", 15, "12.07.2026 12:00")]}
        symbol="BTCUSDT"
        monthDate={new Date(2026, 6, 1)}
        onBack={() => undefined}
        onTradeSelect={() => undefined}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Показать связки BTCUSDT за Июнь 2026 г.",
      }),
    );

    expect(screen.getByText("Июнь 2026 г.")).not.toBeNull();
    expect(screen.getByText("0,00 USDT")).not.toBeNull();
    expect(screen.getByText("0 связок")).not.toBeNull();
    expect(screen.getByText("Связки за этот месяц не найдены")).not.toBeNull();
  });
});

function createTrade(
  id: string,
  symbol: string,
  netResult: number,
  endedAt: string,
): SavedTrade {
  const analysis: AnalysisResponse = {
    bundleType: "Фьючерс",
    legs: [
      {
        id: `${id}-leg`,
        type: "futures",
        side: "short",
        symbol,
        startedAt: endedAt.replace(/\d{2}:\d{2}$/, "10:00"),
        endedAt,
        pnlUsdt: netResult,
      },
    ],
    future: { symbol, endedAt, realizedPnlUsdt: netResult },
    spot: {},
    conflicts: [],
    notes: [],
  };
  const calculation = calculateTrade(analysis);

  return {
    id,
    savedAt: "2026-07-10T10:00:00.000Z",
    analysis,
    calculation: {
      ...calculation,
      netResult,
      isProfitable: netResult >= 0,
      display: { ...calculation.display, netResult: `${netResult} USDT` },
    },
    instructions: "",
  };
}
