// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./I18nProvider";
import { useI18n } from "./I18nContext";
import { getAppLocale, setAppLanguage, translate } from "./i18n";
import { createAnalyticsRange } from "./monthlyAnalytics";
import { formatSpread, formatUsdt } from "./tradeCalculator";

function LanguageProbe() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div>
      <span>{language}</span>
      <span>{t("Обзор")}</span>
      <button type="button" onClick={() => setLanguage("en")}>English</button>
    </div>
  );
}

describe("i18n", () => {
  afterEach(() => {
    cleanup();
    setAppLanguage("ru");
    localStorage.clear();
  });

  it("switches the interface language and persists the selection", () => {
    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("Обзор")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByText("Overview")).not.toBeNull();
    expect(localStorage.getItem("fund-sync:language:v1")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(getAppLocale()).toBe("en-US");
  });

  it("keeps English on a new provider mount", () => {
    setAppLanguage("en");
    const firstRender = render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );
    firstRender.unmount();

    render(
      <I18nProvider>
        <LanguageProbe />
      </I18nProvider>,
    );

    expect(screen.getByText("en")).not.toBeNull();
    expect(screen.getByText("Overview")).not.toBeNull();
    expect(localStorage.getItem("fund-sync:language:v1")).toBe("en");
  });

  it("translates placeholders and compound trade labels", () => {
    setAppLanguage("en");

    expect(translate("Открыть связки {symbol} за {period}", {
      symbol: "BTCUSDT",
      period: "July 2026",
    })).toBe("Open BTCUSDT trades for July 2026");
    expect(translate("Шорт · BTCUSDT · ручной ввод")).toBe(
      "Short · BTCUSDT · manual entry",
    );
    expect(translate("Фьючерс + Спот")).toBe("Futures + Spot");
  });

  it("uses the selected locale for money, spreads and period labels", () => {
    setAppLanguage("en");

    expect(formatUsdt(1234.5)).toBe("1,234.50 USDT");
    expect(formatSpread(-0.1234)).toBe("-0.1234%");
    expect(createAnalyticsRange("month", new Date(2026, 6, 15)).label).toBe(
      "July 2026",
    );

    setAppLanguage("ru");

    expect(formatUsdt(1234.5)).toBe("1\u00a0234,50 USDT");
    expect(formatSpread(-0.1234)).toBe("-0,1234%");
    expect(createAnalyticsRange("month", new Date(2026, 6, 15)).label).toBe(
      "Июль 2026 г.",
    );
  });
});
