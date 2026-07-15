import { afterEach, describe, expect, it, vi } from "vitest";
import { wait, withTimeout } from "./asyncUtils";

describe("async utilities", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the original result before the timeout", async () => {
    await expect(withTimeout(Promise.resolve("ready"), 100, "late")).resolves.toBe(
      "ready",
    );
  });

  it("preserves an original rejection", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("source failed")), 100, "late"),
    ).rejects.toThrow("source failed");
  });

  it("rejects a stalled operation with the provided timeout message", async () => {
    vi.useFakeTimers();
    const stalled = withTimeout(new Promise<never>(() => undefined), 15_000, "sync timeout");
    const rejection = expect(stalled).rejects.toThrow("sync timeout");

    await vi.advanceTimersByTimeAsync(15_000);

    await rejection;
  });

  it("waits for the requested duration", async () => {
    vi.useFakeTimers();
    const completed = vi.fn();
    void wait(220).then(completed);

    await vi.advanceTimersByTimeAsync(219);
    expect(completed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(completed).toHaveBeenCalledOnce();
  });
});
