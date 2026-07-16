// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CsvImportResultDialog } from "./CsvImportResultDialog";

const report = {
  fileName: "history-july.csv",
  importedCount: 2,
  duplicateCount: 1,
  invalidCount: 1,
  rows: [
    {
      row: 2,
      symbol: "BTCUSDT",
      period: "10.07.2026 10:00 — 11:00",
      status: "imported" as const,
      message: "Импортировано.",
      tradeId: "btc",
    },
    {
      row: 3,
      symbol: "ETHUSDT",
      period: "10.07.2026 12:00 — 13:00",
      status: "duplicate" as const,
      message: "Связка уже существует и была пропущена.",
      tradeId: "eth",
    },
    {
      row: 4,
      symbol: "SOLUSDT",
      period: "неизвестно",
      status: "error" as const,
      message: "Не удалось распознать период сделки.",
      values: {
        symbol: "SOLUSDT",
        period: "неизвестно",
        quantity: "250",
        spreadEntry: "3,2%",
        spreadExit: "",
        longPnl: "",
        shortPnl: "5",
        spreadContribution: "",
        total: "5",
      },
    },
  ],
};

describe("CsvImportResultDialog", () => {
  afterEach(cleanup);

  it("shows the import totals and identifies every problematic CSV row", () => {
    render(
      <CsvImportResultDialog isOpen report={report} onClose={() => undefined} />,
    );

    expect(screen.getByText("history-july.csv")).not.toBeNull();
    expect(screen.getByText("Строка 3 · ETHUSDT")).not.toBeNull();
    expect(screen.getByText("Строка 4 · SOLUSDT")).not.toBeNull();
    expect(screen.getByText("10.07.2026 12:00 — 13:00")).not.toBeNull();
    expect(screen.getByText("Не удалось распознать период сделки.")).not.toBeNull();
    expect(screen.queryByText("Строка 2 · BTCUSDT")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Заполнить вручную" }),
    ).toBeNull();
  });

  it("closes from Escape, the backdrop and the action button", () => {
    const onClose = vi.fn();
    const { container } = render(
      <CsvImportResultDialog isOpen report={report} onClose={onClose} />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(container.firstElementChild as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("prefills an invalid row and sends manually corrected values", async () => {
    const onResolveRow = vi.fn().mockResolvedValue(undefined);
    render(
      <CsvImportResultDialog
        isOpen
        report={report}
        onClose={() => undefined}
        onResolveRow={onResolveRow}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    expect(
      screen.getByRole("dialog", { name: "Заполнить строку 4" }),
    ).not.toBeNull();
    expect(screen.getByDisplayValue("SOLUSDT")).not.toBeNull();
    expect(screen.getByDisplayValue("250")).not.toBeNull();
    expect(screen.getAllByDisplayValue("5")).toHaveLength(2);

    const periodInput = screen.getByDisplayValue("неизвестно");
    fireEvent.change(periodInput, {
      target: { value: "10.07.2026 12:00 — 13:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    await waitFor(() => expect(onResolveRow).toHaveBeenCalledOnce());
    expect(onResolveRow.mock.calls[0][1]).toMatchObject({
      symbol: "SOLUSDT",
      period: "10.07.2026 12:00 — 13:00",
      shortPnl: "5",
      total: "5",
    });
  });

  it("closes the manual editor first on Escape and keeps the import report open", () => {
    const onClose = vi.fn();
    render(
      <CsvImportResultDialog
        isOpen
        report={report}
        onClose={onClose}
        onResolveRow={() => Promise.resolve()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    expect(
      screen.getByRole("dialog", { name: "Заполнить строку 4" }),
    ).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Заполнить строку 4" }),
    ).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Результат импорта" }),
    ).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the manual editor open and shows the exact save failure", async () => {
    const onResolveRow = vi
      .fn()
      .mockRejectedValue(new Error("Firestore отклонил доступ"));
    render(
      <CsvImportResultDialog
        isOpen
        report={report}
        onClose={() => undefined}
        onResolveRow={onResolveRow}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Firestore отклонил доступ",
    );
    expect(
      screen.getByRole("dialog", { name: "Заполнить строку 4" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Сохранить связку" }),
    ).toHaveProperty("disabled", false);
  });

  it("blocks closing and repeated saves while a manual row is being saved", async () => {
    let finishSaving: (() => void) | undefined;
    const onClose = vi.fn();
    const onResolveRow = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSaving = resolve;
        }),
    );
    render(
      <CsvImportResultDialog
        isOpen
        report={report}
        onClose={onClose}
        onResolveRow={onResolveRow}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Заполнить вручную" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));
    const savingButton = screen.getByRole("button", { name: "Сохраняем..." });
    expect(savingButton).toHaveProperty("disabled", true);
    fireEvent.click(savingButton);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onResolveRow).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Заполнить строку 4" }),
    ).not.toBeNull();

    finishSaving?.();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Заполнить строку 4" }),
      ).toBeNull();
    });
  });
});
