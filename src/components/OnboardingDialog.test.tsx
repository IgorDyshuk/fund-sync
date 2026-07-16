// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingDialog } from "./OnboardingDialog";

describe("OnboardingDialog", () => {
  afterEach(cleanup);

  it("moves through all six steps and finishes from the last step", () => {
    const onClose = vi.fn();
    render(<OnboardingDialog isOpen onClose={onClose} />);

    expect(
      screen.getByRole("heading", { name: "Добро пожаловать в Fund Sync" }),
    ).not.toBeNull();
    expect(
      screen.getAllByRole("button", { name: /Перейти к шагу/ }),
    ).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByRole("heading", { name: "Добавьте связку" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(
      screen.getByRole("heading", { name: "Добро пожаловать в Fund Sync" }),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Перейти к шагу 6" }));
    fireEvent.click(screen.getByRole("button", { name: "Начать работу" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("supports arrow keys, Escape and explicit skipping", () => {
    const onClose = vi.fn();
    render(<OnboardingDialog isOpen onClose={onClose} />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Добавьте связку" })).not.toBeNull();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(
      screen.getByRole("heading", { name: "Добро пожаловать в Fund Sync" }),
    ).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("changes slides with horizontal touch gestures", () => {
    render(<OnboardingDialog isOpen onClose={() => undefined} />);
    const viewport = screen.getByTestId("onboarding-slide-viewport");

    fireEvent.touchStart(viewport, { touches: [{ clientX: 280 }] });
    fireEvent.touchEnd(viewport, { changedTouches: [{ clientX: 180 }] });
    expect(screen.getByRole("heading", { name: "Добавьте связку" })).not.toBeNull();

    fireEvent.touchStart(viewport, { touches: [{ clientX: 180 }] });
    fireEvent.touchEnd(viewport, { changedTouches: [{ clientX: 280 }] });
    expect(
      screen.getByRole("heading", { name: "Добро пожаловать в Fund Sync" }),
    ).not.toBeNull();
  });

  it("ignores navigation keys while it is closed", () => {
    const onClose = vi.fn();
    render(<OnboardingDialog isOpen={false} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        name: "Добро пожаловать в Fund Sync",
        hidden: true,
      }),
    ).not.toBeNull();
  });
});
