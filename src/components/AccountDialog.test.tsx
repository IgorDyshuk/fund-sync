// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDialog } from "./AccountDialog";

const user = {
  uid: "user-1",
  email: "owner@example.com",
  displayName: null,
};

describe("AccountDialog", () => {
  afterEach(cleanup);

  it("shows only account details and uses fade-only animation states", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Закрыть личный кабинет" }));
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
});
