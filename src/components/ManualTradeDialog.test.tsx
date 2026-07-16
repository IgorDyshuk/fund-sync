// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualTradeDialog } from "./ManualTradeDialog";

describe("ManualTradeDialog", () => {
  afterEach(cleanup);

  it("submits required and optional trade fields", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ManualTradeDialog
        isOpen
        title="Добавить связку вручную"
        description="Описание"
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Монета *"), {
      target: { value: "BTCUSDT" },
    });
    fireEvent.change(screen.getByLabelText("Итог, USDT *"), {
      target: { value: "15,80" },
    });
    fireEvent.change(screen.getByLabelText("Начало *"), {
      target: { value: "2026-07-15T12:00" },
    });
    fireEvent.change(screen.getByLabelText("Окончание *"), {
      target: { value: "2026-07-15T13:00" },
    });
    fireEvent.change(screen.getByLabelText("PnL Short"), {
      target: { value: "15,8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0]).toMatchObject({
      symbol: "BTCUSDT",
      period: "15.07.2026 12:00 — 13:00",
      total: "15,80",
      shortPnl: "15,8",
      longPnl: "",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps native date controls inside clipped interactive fields", () => {
    render(
      <ManualTradeDialog
        isOpen
        title="Добавить связку вручную"
        description="Описание"
        initialValues={createValidDraft()}
        onClose={() => undefined}
        onSave={() => Promise.resolve()}
      />,
    );

    const startedAtInput = screen.getByLabelText("Начало *");
    expect(startedAtInput.getAttribute("type")).toBe("datetime-local");
    expect(startedAtInput.className).toContain("absolute");
    expect(startedAtInput.parentElement?.className).toContain("overflow-hidden");
    expect(
      startedAtInput.closest("fieldset")?.querySelector(".grid")?.className,
    ).toContain("grid-cols-2");
    expect(screen.getByText("15.07.26, 14:00")).not.toBeNull();
  });

  it("prefills and submits a period that ends on the next day", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ManualTradeDialog
        isOpen
        title="Редактировать связку"
        description="Описание"
        initialValues={{
          ...createValidDraft(),
          period: "15.07.2026 23:30 — 16.07.2026 00:15",
        }}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );

    expect(
      (screen.getByLabelText("Начало *") as HTMLInputElement).value,
    ).toBe("2026-07-15T23:30");
    expect(
      (screen.getByLabelText("Окончание *") as HTMLInputElement).value,
    ).toBe("2026-07-16T00:15");

    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].period).toBe(
      "15.07.2026 23:30 — 16.07.2026 00:15",
    );
  });

  it("keeps the form open and displays an exact save error", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockRejectedValue(new Error("Такая связка уже существует."));
    render(
      <ManualTradeDialog
        isOpen
        title="Добавить связку вручную"
        description="Описание"
        initialValues={createValidDraft()}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Такая связка уже существует.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close or submit twice while saving", async () => {
    let resolveSave: (() => void) | undefined;
    const onClose = vi.fn();
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <ManualTradeDialog
        isOpen
        title="Добавить связку вручную"
        description="Описание"
        initialValues={createValidDraft()}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сохранить связку" }));
    const savingButton = screen.getByRole("button", { name: "Сохраняем..." });
    fireEvent.click(savingButton);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onSave).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();

    resolveSave?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});

function createValidDraft() {
  return {
    symbol: "ETHUSDT",
    period: "15.07.2026 14:00 — 15:00",
    quantity: "",
    spreadEntry: "",
    spreadExit: "",
    longPnl: "",
    shortPnl: "",
    spreadContribution: "",
    total: "8,5",
  };
}
