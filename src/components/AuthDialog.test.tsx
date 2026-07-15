// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "./AuthDialog";

const cloudSyncMocks = vi.hoisted(() => ({
  loginWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  registerWithEmail: vi.fn(),
}));

vi.mock("../lib/cloudSync", () => cloudSyncMocks);

describe("AuthDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cloudSyncMocks.loginWithEmail.mockResolvedValue({ uid: "user-1" });
    cloudSyncMocks.loginWithGoogle.mockResolvedValue({ uid: "user-1" });
    cloudSyncMocks.registerWithEmail.mockResolvedValue({ uid: "user-1" });
  });

  afterEach(cleanup);

  it("shows local setup guidance and hides unavailable authentication forms", () => {
    render(
      <AuthDialog
        isOpen
        firebaseConfigured={false}
        onClose={() => undefined}
        onAuthenticated={() => undefined}
      />,
    );

    expect(screen.getByText(/Firebase пока не настроен/)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Продолжить с Google" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("uses fade-only open and closed states", () => {
    const { container, rerender } = render(
      <AuthDialog
        isOpen
        firebaseConfigured
        onClose={() => undefined}
        onAuthenticated={() => undefined}
      />,
    );

    expect(container.firstElementChild?.className).toContain("opacity-100");
    expect(screen.getByRole("dialog").className).toContain("opacity-100");
    expect(screen.getByRole("dialog").className).not.toContain("translate-y");

    rerender(
      <AuthDialog
        isOpen={false}
        firebaseConfigured
        onClose={() => undefined}
        onAuthenticated={() => undefined}
      />,
    );

    expect(container.firstElementChild?.className).toContain("opacity-0");
    expect(container.querySelector("[role='dialog']")?.className).toContain(
      "opacity-0",
    );
  });

  it("submits normalized email credentials and closes after login", async () => {
    const onAuthenticated = vi.fn();
    const { container } = render(
      <AuthDialog
        isOpen
        firebaseConfigured
        onClose={() => undefined}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " owner@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "secret1" },
    });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      expect(cloudSyncMocks.loginWithEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "secret1",
      );
      expect(onAuthenticated).toHaveBeenCalledOnce();
    });
  });

  it("does not register when password confirmation differs", () => {
    const { container } = render(
      <AuthDialog
        isOpen
        firebaseConfigured
        onClose={() => undefined}
        onAuthenticated={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Регистрация" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Повтори пароль"), {
      target: { value: "secret2" },
    });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(screen.getByRole("alert").textContent).toContain("Пароли не совпадают");
    expect(cloudSyncMocks.registerWithEmail).not.toHaveBeenCalled();
  });

  it("registers matching email credentials and reports provider errors", async () => {
    const onAuthenticated = vi.fn();
    const { container } = render(
      <AuthDialog
        isOpen
        firebaseConfigured
        onClose={() => undefined}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Регистрация" }));
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Пароль"), {
      target: { value: "secret1" },
    });
    fireEvent.change(screen.getByLabelText("Повтори пароль"), {
      target: { value: "secret1" },
    });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      expect(cloudSyncMocks.registerWithEmail).toHaveBeenCalledWith(
        "owner@example.com",
        "secret1",
      );
      expect(onAuthenticated).toHaveBeenCalledOnce();
    });
  });

  it("signs in with Google and shows a localized popup error", async () => {
    const onAuthenticated = vi.fn();
    cloudSyncMocks.loginWithGoogle.mockRejectedValueOnce({
      code: "auth/popup-blocked",
    });
    render(
      <AuthDialog
        isOpen
        firebaseConfigured
        onClose={() => undefined}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Продолжить с Google" }));
    expect(
      await screen.findByText(/Браузер заблокировал окно Google/),
    ).not.toBeNull();
    expect(onAuthenticated).not.toHaveBeenCalled();

    cloudSyncMocks.loginWithGoogle.mockResolvedValueOnce({ uid: "user-1" });
    fireEvent.click(screen.getByRole("button", { name: "Продолжить с Google" }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce());
  });
});
