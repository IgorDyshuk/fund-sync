import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../App";
import { FloatingAddButton } from "./FloatingAddButton";
import { HistoryPage } from "./HistoryPage";
import { HomePage } from "./HomePage";
import { TradeDetailsSheet } from "./TradeDetailsSheet";
import { TradeHistoryRow } from "./TradeHistoryRow";
import { calculateTrade } from "../lib/tradeCalculator";
import type { AnalysisResponse } from "../lib/analysisSchema";
import type { SavedTrade } from "../types/app";

describe("history UI structure", () => {
  it("shows only five latest trades and exposes the full-history action", () => {
    const trades = Array.from({ length: 6 }, (_, index) =>
      createTrade(`trade-${index}`, `COIN${index}USDT`, index + 1),
    );

    const markup = renderToStaticMarkup(
      <HomePage
        history={trades}
        onTradeSelect={() => undefined}
        onOpenHistory={() => undefined}
        authUser={null}
        authLoading={false}
        authError={null}
        onOpenAuth={() => undefined}
        onOpenAccount={() => undefined}
      />,
    );

    expect(markup).toContain("Последние связки");
    expect(markup).toContain("Показать все");
    expect(markup).toContain("COIN0USDT");
    expect(markup).toContain("COIN4USDT");
    expect(markup).not.toContain("COIN5USDT");
    expect(markup).not.toContain("Фьючерс + Спот");
  });

  it("renders the history count, closing-date groups and the shared row format", () => {
    const markup = renderToStaticMarkup(
      <HistoryPage
        history={[
          createTrade("new", "NEWUSDT", 12, "14.07.2026 18:00"),
          createTrade("old", "OLDUSDT", -4, "13.07.2026 18:00"),
        ]}
        onBack={() => undefined}
        onTradeSelect={() => undefined}
        onDeleteAll={() => undefined}
      />,
    );

    expect(markup).toContain("Все связки");
    expect(markup).toContain("2 связки");
    expect(markup).toContain("14 июля 2026 г.");
    expect(markup).toContain("13 июля 2026 г.");
    expect(markup).toContain("NEWUSDT");
    expect(markup).toContain("OLDUSDT");
    expect(markup).toContain("text-emerald-200");
    expect(markup).toContain("text-red-200");
    expect(markup).toContain('aria-label="Удалить все связки"');
    expect(markup).toContain("Удалить всю историю?");
  });

  it("keeps the row compact, clickable and strips the quote suffix from symbols", () => {
    const markup = renderToStaticMarkup(
      <TradeHistoryRow
        trade={createTrade("row", "VANRYUSDT/USDT", 15)}
        onSelect={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Открыть связку VANRYUSDT"');
    expect(markup).toContain("VANRYUSDT");
    expect(markup).toContain("2026");
    expect(markup).toContain("min-h-[72px]");
    expect(markup).toContain("hover:bg-white/[0.025]");
  });

  it("renders the global add button as a fixed control", () => {
    const markup = renderToStaticMarkup(
      <FloatingAddButton onClick={() => undefined} />,
    );

    expect(markup).toContain('aria-label="Добавить связку"');
    expect(markup).toContain("fixed bottom-4 right-4");
    expect(markup).toContain("active:scale-95");
  });

  it("renders saved trade details and the delete action in the bottom sheet", () => {
    const markup = renderToStaticMarkup(
      <TradeDetailsSheet
        trade={createTrade("details", "BTCUSDT", 20)}
        isOpen
        onClose={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain("Информация о связке");
    expect(markup).toContain("Сохранённый результат сделки");
    expect(markup).toContain("Краткая сводка");
    expect(markup).toContain("Заметки по связке");
    expect(markup).toContain("Удалить связку");
    expect(markup).toContain("max-w-[1050px]");
  });

  it("keeps the detail sheet mounted for the reverse animation when closing", () => {
    const markup = renderToStaticMarkup(
      <TradeDetailsSheet
        trade={createTrade("closed", "BTCUSDT", 20)}
        isOpen={false}
        onClose={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(markup).toContain("pointer-events-none");
    expect(markup).toContain("translate-y-full");
    expect(markup).toContain("duration-300");
  });
});

describe("App viewport structure", () => {
  it("uses a fixed viewport shell and keeps page scrolling inside the active page", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("relative h-[100svh] overflow-hidden");
    expect(markup).toContain("h-[100svh] transform-gpu");
    expect(markup).toContain("translate-x-0 overflow-y-auto");
    expect(markup).toContain("overflow-y-hidden");
    expect(markup).toContain('aria-label="Добавить связку"');
  });
});

function createTrade(
  id: string,
  symbol: string,
  netResult: number,
  endedAt = "14.07.2026 12:00",
): SavedTrade {
  const futurePnl = netResult >= 0 ? netResult + 10 : netResult - 10;
  const spotPnl = netResult - futurePnl;
  const analysis: AnalysisResponse = {
    bundleType: "Фьючерс + Спот",
    legs: [],
    future: {
      symbol,
      side: "short",
      startedAt: "14.07.2026 11:00",
      endedAt,
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
    notes: ["Тестовая заметка"],
  };

  return {
    id,
    savedAt: "2026-07-14T12:00:00.000Z",
    analysis,
    calculation: {
      ...calculateTrade(analysis),
      netResult,
      isProfitable: netResult >= 0,
      display: {
        ...calculateTrade(analysis).display,
        netResult: `${netResult.toFixed(2)} USDT`,
      },
    },
    instructions: "Тестовая связка",
  };
}
