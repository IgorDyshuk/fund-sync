import { describe, expect, it } from "vitest";
import {
  createTradeFromCsvDraft,
  mergeImportedTrades,
  parseLocalizedNumber,
  parseTradeCsv,
} from "./tradeCsvImport";

const sampleCsv = `Монета;Период;Кол-во;Спред Вход;Спред Выход;PnL Лонг;PnL Шорт;Спред принес;Итого (USDT)
INUSDT;30.06.2026 21:48 — 01.07.2026 09:37;10000;30,92%;-29,84%;319,44;-303,64;- (15,80 USDT);15,8
TAIKOUSDT;01.07.2026 15:52 — 02.07.2026 01:40;8500;-42,63%;-;-541,96;609,65;- (67,69 USDT);67,69
TAIKOUSDT;02.07.2026 17:26 — 22:15;5000;3,73%;-;25,14;2,25;- (27,39 USDT);27,39
ESPORTSUSDT;29.06.2026 14:40 — 05.07.2026 09:41;40 000;15,04%;-;167,92;-147,8;- (20,12 USDT);20,12
LABUSDT;06.07.2026 14:08 — 20:59;100;-11,08%;7,35%;251,87;-188,79;- (63,08 USDT);63,08
VANRYUSDT;06.07.2026 17:51 — 07.07.2026 06:48;93 000;5,54%;-;47,28;9,61;- (56,89 USDT);56,89
ABUSDT;07.07.2026 18:00 — 18:55;200;11,21%;-;170,26;-112,28;- (57,98 USDT);57,98`;

describe("trade CSV import", () => {
  it("imports the provided Google Sheets layout without treating coin quantity as USDT", () => {
    const result = parseTradeCsv(sampleCsv);

    expect(result.issues).toEqual([]);
    expect(result.duplicateCount).toBe(0);
    expect(result.trades).toHaveLength(7);
    expect(result.rows).toHaveLength(7);
    expect(result.rows.every((row) => row.status === "imported")).toBe(true);

    const trade = result.trades.find(
      (candidate) => candidate.calculation.symbol === "INUSDT",
    );
    expect(trade).toBeDefined();
    expect(trade?.analysis.bundleType).toBe("Фьючерс + Фьючерс");
    expect(trade?.analysis.spread).toEqual({ entry: 30.92, exit: -29.84 });
    expect(trade?.calculation.legs.map((leg) => [leg.side, leg.pnl])).toEqual([
      ["long", 319.44],
      ["short", -303.64],
    ]);
    expect(trade?.calculation.totalVolume).toBeNull();
    expect(trade?.calculation.display.totalVolume).toBe("-");
    expect(trade?.calculation.netResult).toBe(15.8);
    expect(trade?.calculation.display.netResult).toBe("15,80 USDT");
    expect(trade?.analysis.notes).toContain("Количество монет: 10000.");
  });

  it("uses the starting date when the period contains only an ending time", () => {
    const result = parseTradeCsv(sampleCsv);
    const trade = result.trades.find(
      (candidate) =>
        candidate.calculation.symbol === "TAIKOUSDT" &&
        candidate.calculation.period.includes("17:26"),
    );

    expect(trade?.calculation.period).toBe("02.07.2026 17:26 — 22:15");
    expect(trade?.calculation.legs[0].endedAt).toBe("02.07.2026 22:15");
  });

  it("supports a row with only one futures side", () => {
    const csv = `Монета;Период;PnL Лонг;PnL Шорт;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;-;-18,42;-18,42`;
    const result = parseTradeCsv(csv);
    const trade = result.trades[0];

    expect(result.issues).toEqual([]);
    expect(trade.analysis.bundleType).toBe("Фьючерс");
    expect(trade.calculation.legs).toHaveLength(1);
    expect(trade.calculation.legs[0].side).toBe("short");
    expect(trade.calculation.netResult).toBe(-18.42);
  });

  it("automatically imports a row with only symbol, period and total", () => {
    const csv = `Монета;Период;Итого (USDT)
ARBUSDT;11.07.2026 09:00 — 10:30;-12,40`;
    const result = parseTradeCsv(csv);
    const trade = result.trades[0];

    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      row: 2,
      symbol: "ARBUSDT",
      status: "imported",
    });
    expect(trade.analysis.bundleType).toBe("Ручной итог");
    expect(trade.calculation.netResult).toBe(-12.4);
    expect(trade.calculation.legs[0]).toMatchObject({
      title: "Ручной итог",
      side: "unknown",
      pnl: -12.4,
    });
  });

  it("uses the CSV total as authoritative and records a mismatch note", () => {
    const csv = `Монета;Период;PnL Лонг;PnL Шорт;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;10;-3;8`;
    const trade = parseTradeCsv(csv).trades[0];

    expect(trade.calculation.netResult).toBe(8);
    expect(trade.analysis.notes.some((note) => note.includes("отличается"))).toBe(
      true,
    );
  });

  it("skips deterministic duplicates and merges history newest first", () => {
    const initial = parseTradeCsv(sampleCsv);
    const repeated = parseTradeCsv(sampleCsv, initial.trades);

    expect(repeated.trades).toEqual([]);
    expect(repeated.duplicateCount).toBe(7);
    expect(repeated.rows[0]).toMatchObject({
      row: 2,
      symbol: "INUSDT",
      status: "duplicate",
    });
    expect(mergeImportedTrades([], initial.trades)[0].calculation.symbol).toBe(
      "ABUSDT",
    );
  });

  it("treats only symbol, period and total together as the duplicate key", () => {
    const originalCsv = `Монета;Период;PnL Лонг;PnL Шорт;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;10;-2;8`;
    const original = parseTradeCsv(originalCsv).trades[0];
    const legacyIdTrade = { ...original, id: "legacy-csv-id" };

    const sameThreeCriteria = parseTradeCsv(
      `Монета;Период;PnL Лонг;PnL Шорт;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;20;-12;8`,
      [legacyIdTrade],
    );
    expect(sameThreeCriteria.trades).toEqual([]);
    expect(sameThreeCriteria.duplicateCount).toBe(1);

    const differentTotal = parseTradeCsv(
      `Монета;Период;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;9`,
      [legacyIdTrade],
    );
    expect(differentTotal.trades).toHaveLength(1);
    expect(differentTotal.duplicateCount).toBe(0);
    expect(differentTotal.trades[0].id).not.toBe(original.id);

    const differentPeriod = parseTradeCsv(
      `Монета;Период;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:01;8`,
      [legacyIdTrade],
    );
    expect(differentPeriod.trades).toHaveLength(1);
    expect(differentPeriod.duplicateCount).toBe(0);
  });

  it("keeps rows with the same symbol and period when their totals differ", () => {
    const result = parseTradeCsv(`Монета;Период;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;8
BTCUSDT;10.07.2026 10:00 — 11:00;9`);

    expect(result.trades).toHaveLength(2);
    expect(result.duplicateCount).toBe(0);
    expect(new Set(result.trades.map((trade) => trade.id)).size).toBe(2);
  });

  it("marks repeated rows inside one file as duplicates only when all three keys match", () => {
    const result = parseTradeCsv(`Монета;Период;Итого (USDT)
BTCUSDT;10.07.2026 10:00 — 11:00;8,00
BTCUSDT;10.07.2026 10:00 — 11:00;8.0
ETHUSDT;10.07.2026 10:00 — 11:00;8`);

    expect(result.trades).toHaveLength(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.rows.map((row) => row.status)).toEqual([
      "imported",
      "duplicate",
      "imported",
    ]);
  });

  it("accepts English aliases, a BOM and comma-delimited exports", () => {
    const result = parseTradeCsv(
      "\uFEFFCoin,Period,Total USDT\nBTCUSDT,10.07.2026 10:00 — 11:00,8.25",
    );

    expect(result.issues).toEqual([]);
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].calculation).toMatchObject({
      symbol: "BTCUSDT",
      netResult: 8.25,
    });
  });

  it("reports every missing required row value and preserves the editable draft", () => {
    const result = parseTradeCsv(`Монета;Период;Итого (USDT)
;10.07.2026 10:00 — 11:00;8
BTCUSDT;;9
ETHUSDT;10.07.2026 12:00 — 13:00;`);

    expect(result.trades).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.message)).toEqual([
      "Не указана монета.",
      "Не удалось распознать период сделки.",
      "Не указан итог связки в USDT.",
    ]);
    expect(result.rows[0]).toMatchObject({
      row: 2,
      symbol: null,
      period: "10.07.2026 10:00 — 11:00",
      status: "error",
    });
    expect(result.rows[1].values).toMatchObject({
      symbol: "BTCUSDT",
      period: "",
      total: "9",
    });
    expect(result.rows[2].values).toMatchObject({
      symbol: "ETHUSDT",
      total: "",
    });
  });

  it("rejects malformed symbols and impossible calendar dates", () => {
    const result = parseTradeCsv(`Монета;Период;Итого (USDT)
BTC@USDT;10.07.2026 10:00 — 11:00;8
ETHUSDT;31.02.2026 10:00 — 11:00;9`);

    expect(result.trades).toEqual([]);
    expect(result.rows.map((row) => row.message)).toEqual([
      "Не указана монета.",
      "Не удалось распознать период сделки.",
    ]);
  });

  it("reports missing columns and invalid rows without throwing", () => {
    const missingColumns = parseTradeCsv("Монета;Период\nBTCUSDT;bad");
    expect(missingColumns.trades).toEqual([]);
    expect(missingColumns.issues[0].message).toContain("Итого (USDT)");

    const invalidRow = parseTradeCsv(`Монета;Период;PnL Лонг;Итого (USDT)
BTCUSDT;неизвестно;10;10`);
    expect(invalidRow.trades).toEqual([]);
    expect(invalidRow.issues[0]).toEqual({
      row: 2,
      message: "Не удалось распознать период сделки.",
    });
    expect(invalidRow.rows[0]).toMatchObject({
      row: 2,
      symbol: "BTCUSDT",
      period: "неизвестно",
      status: "error",
      message: "Не удалось распознать период сделки.",
    });
    expect(invalidRow.rows[0].values?.longPnl).toBe("10");
  });

  it("creates a valid trade after the missing CSV values are filled manually", () => {
    const result = createTradeFromCsvDraft(
      {
        symbol: "SOLUSDT",
        period: "10.07.2026 12:00 — 13:00",
        quantity: "250",
        spreadEntry: "3,2%",
        spreadExit: "-1,1%",
        longPnl: "",
        shortPnl: "5,25",
        spreadContribution: "",
        total: "5,25",
      },
      4,
      { requireTotal: true },
    );

    expect("trade" in result).toBe(true);
    if ("trade" in result) {
      expect(result.trade.calculation.symbol).toBe("SOLUSDT");
      expect(result.trade.calculation.netResult).toBe(5.25);
      expect(result.trade.analysis.spread).toEqual({ entry: 3.2, exit: -1.1 });
      expect(result.trade.analysis.notes).toContain("Количество монет: 250.");
    }
  });

  it("requires a manual total when resolving an invalid import row", () => {
    const result = createTradeFromCsvDraft(
      {
        symbol: "SOLUSDT",
        period: "10.07.2026 12:00 — 13:00",
        quantity: "",
        spreadEntry: "",
        spreadExit: "",
        longPnl: "",
        shortPnl: "5",
        spreadContribution: "",
        total: "",
      },
      4,
      { requireTotal: true },
    );

    expect(result).toEqual({ message: "Не указан итог связки в USDT." });
  });

  it("creates a manual total trade without Long or Short PnL", () => {
    const result = createTradeFromCsvDraft(
      {
        symbol: "ARBUSDT",
        period: "11.07.2026 09:00 — 10:30",
        quantity: "",
        spreadEntry: "",
        spreadExit: "",
        longPnl: "",
        shortPnl: "",
        spreadContribution: "",
        total: "-12,40",
      },
      5,
      { requireTotal: true, allowTotalOnly: true },
    );

    expect("trade" in result).toBe(true);
    if ("trade" in result) {
      expect(result.trade.analysis.bundleType).toBe("Ручной итог");
      expect(result.trade.calculation.netResult).toBe(-12.4);
      expect(result.trade.calculation.legs).toHaveLength(1);
      expect(result.trade.calculation.legs[0]).toMatchObject({
        title: "Ручной итог",
        side: "unknown",
        pnl: -12.4,
      });
    }
  });

  it("parses localized values used by the spreadsheet", () => {
    expect(parseLocalizedNumber("40 000")).toBe(40000);
    expect(parseLocalizedNumber("30,92%")).toBe(30.92);
    expect(parseLocalizedNumber("- (15,80 USDT)")).toBe(-15.8);
    expect(parseLocalizedNumber("1.234,56")).toBe(1234.56);
    expect(parseLocalizedNumber("1,234.56")).toBe(1234.56);
    expect(parseLocalizedNumber("-")).toBeNull();
  });
});
