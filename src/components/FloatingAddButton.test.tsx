// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FloatingAddButton } from "./FloatingAddButton";

describe("FloatingAddButton", () => {
  afterEach(cleanup);

  it("opens the analyzer directly", () => {
    const onClick = vi.fn();
    render(<FloatingAddButton onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Добавить связку" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Вручную" })).toBeNull();
  });
});
