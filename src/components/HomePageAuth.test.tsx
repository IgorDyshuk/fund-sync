// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage account controls", () => {
  afterEach(cleanup);

  it("shows a compact loading icon without exposing account actions", () => {
    renderHome({ authLoading: true });

    expect(screen.getByLabelText("Проверка аккаунта")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Войти в аккаунт" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Открыть личный кабинет" }),
    ).toBeNull();
  });

  it("opens authentication for a guest", () => {
    const onOpenAuth = vi.fn();
    renderHome({ onOpenAuth });

    fireEvent.click(screen.getByRole("button", { name: "Войти в аккаунт" }));
    expect(onOpenAuth).toHaveBeenCalledOnce();
  });

  it("opens the personal account for a user without rendering email in the header", () => {
    const onOpenAccount = vi.fn();
    renderHome({
      authUser: {
        uid: "user-1",
        email: "owner@example.com",
        displayName: null,
      },
      onOpenAccount,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Открыть личный кабинет" }),
    );
    expect(onOpenAccount).toHaveBeenCalledOnce();
    expect(screen.queryByText("owner@example.com")).toBeNull();
  });

  it("shows cloud synchronization errors without hiding the page", () => {
    renderHome({ authError: "Firestore отклонил доступ." });

    expect(screen.getByRole("alert").textContent).toContain(
      "Firestore отклонил доступ.",
    );
    expect(screen.getByRole("heading", { name: "Обзор" })).not.toBeNull();
  });
});

function renderHome(
  overrides: Partial<{
    authUser: {
      uid: string;
      email: string | null;
      displayName: string | null;
    } | null;
    authLoading: boolean;
    authError: string | null;
    onOpenAuth: () => void;
    onOpenAccount: () => void;
  }> = {},
) {
  return render(
    <HomePage
      history={[]}
      onTradeSelect={() => undefined}
      onOpenHistory={() => undefined}
      authUser={overrides.authUser ?? null}
      authLoading={overrides.authLoading ?? false}
      authError={overrides.authError ?? null}
      onOpenAuth={overrides.onOpenAuth ?? (() => undefined)}
      onOpenAccount={overrides.onOpenAccount ?? (() => undefined)}
    />,
  );
}
