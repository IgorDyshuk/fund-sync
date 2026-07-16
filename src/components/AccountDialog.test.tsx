// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDialog } from "./AccountDialog";
import { I18nProvider } from "../lib/I18nProvider";
import { setAppLanguage } from "../lib/i18n";

const user = {
  uid: "user-1",
  email: "owner@example.com",
  displayName: null,
};

describe("AccountDialog", () => {
  afterEach(() => {
    cleanup();
    setAppLanguage("ru");
    localStorage.clear();
  });

  it("switches the complete settings interface to English", () => {
    render(
      <I18nProvider>
        <AccountDialog
          isOpen
          user={user}
          onClose={() => undefined}
          onLogout={() => undefined}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Settings" })).not.toBeNull();
    expect(screen.getByText("Language")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).not.toBeNull();
    expect(localStorage.getItem("fund-sync:language:v1")).toBe("en");
  });

  it("renders a spacious settings layout and uses fade-only animation states", () => {
    const { container, rerender } = render(
      <AccountDialog
        isOpen
        user={user}
        onClose={() => undefined}
        onLogout={() => undefined}
      />,
    );

    expect(screen.getByText("owner@example.com")).not.toBeNull();
    expect(screen.getByText("Синхронизация включена")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Настройки" })).not.toBeNull();
    expect(screen.getByRole("dialog").className).toContain("max-w-2xl");
    expect(screen.getByRole("dialog").className).toContain("sm:min-h-[520px]");
    expect(container.firstElementChild?.className).toContain("opacity-100");
    expect(screen.getByRole("dialog").className).not.toContain("translate-y");

    rerender(
      <AccountDialog
        isOpen={false}
        user={user}
        onClose={() => undefined}
        onLogout={() => undefined}
      />,
    );
    expect(container.firstElementChild?.className).toContain("opacity-0");
  });

  it("closes from the close button, backdrop and Escape only while open", () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <AccountDialog
        isOpen
        user={user}
        onClose={onClose}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Закрыть настройки" }));
    fireEvent.click(container.firstElementChild as HTMLElement);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);

    rerender(
      <AccountDialog
        isOpen={false}
        user={user}
        onClose={onClose}
        onLogout={() => undefined}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("keeps logout disabled until the asynchronous operation finishes", async () => {
    let finishLogout: (() => void) | undefined;
    const onLogout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLogout = resolve;
        }),
    );
    render(
      <AccountDialog
        isOpen
        user={user}
        onClose={() => undefined}
        onLogout={onLogout}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Выйти из аккаунта" }));
    const busyButton = screen.getByRole("button", { name: "Выходим..." });
    expect(busyButton).toHaveProperty("disabled", true);
    expect(onLogout).toHaveBeenCalledOnce();

    finishLogout?.();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Выйти из аккаунта" }),
      ).toHaveProperty("disabled", false);
    });
  });

  it("selects a CSV file without rendering the import report inside the account", async () => {
    const onImportCsv = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountDialog
        isOpen
        user={user}
        onClose={() => undefined}
        onLogout={() => undefined}
        onImportCsv={onImportCsv}
      />,
    );

    const file = new File(["Монета;Период"], "history.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onImportCsv).toHaveBeenCalledWith(file));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Импортировать CSV" }),
      ).toHaveProperty("disabled", false);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("locks account actions while a CSV file is being imported", async () => {
    let finishImport: (() => void) | undefined;
    const onClose = vi.fn();
    const onImportCsv = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishImport = resolve;
        }),
    );
    const { container } = render(
      <AccountDialog
        isOpen
        user={user}
        onClose={onClose}
        onLogout={() => undefined}
        onImportCsv={onImportCsv}
      />,
    );
    const file = new File(["data"], "history.csv", { type: "text/csv" });

    fireEvent.change(screen.getByLabelText("Выбрать CSV с историей"), {
      target: { files: [file] },
    });

    expect(
      screen.getByRole("button", { name: "Импортируем..." }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Закрыть настройки" }),
    ).toHaveProperty("disabled", true);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();

    finishImport?.();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Импортировать CSV" }),
      ).toHaveProperty("disabled", false);
    });
  });

  it("opens the application tutorial from settings", () => {
    const onOpenOnboarding = vi.fn();
    render(
      <AccountDialog
        isOpen
        user={user}
        onClose={() => undefined}
        onLogout={() => undefined}
        onOpenOnboarding={onOpenOnboarding}
      />,
    );

    expect(screen.getByRole("heading", { name: "Обучение" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Пройти обучение" }));
    expect(onOpenOnboarding).toHaveBeenCalledOnce();
  });

  it("selects a period and exports history as CSV", async () => {
    const onClose = vi.fn();
    const onExportCsv = vi.fn().mockResolvedValue(undefined);
    render(
      <AccountDialog
        isOpen
        user={user}
        onClose={onClose}
        onLogout={() => undefined}
        onExportCsv={onExportCsv}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Экспортировать" }));
    expect(
      screen.getByRole("dialog", { name: "Экспорт истории" }),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Год" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Экспортировать CSV" }),
    );

    await waitFor(() => expect(onExportCsv).toHaveBeenCalledOnce());
    expect(onExportCsv.mock.calls[0][0].timeframe).toBe("year");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the export period open when there are no matching trades", async () => {
    render(
      <AccountDialog
        isOpen
        user={user}
        onClose={() => undefined}
        onLogout={() => undefined}
        onExportCsv={() => "За выбранный период нет связок для экспорта."}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Экспортировать" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Экспортировать CSV" }),
    );

    expect(
      await screen.findByText("За выбранный период нет связок для экспорта."),
    ).not.toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Экспорт истории" }),
    ).not.toBeNull();
  });
});
