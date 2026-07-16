import { describe, expect, it, vi } from "vitest";
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
  onboardingStorageKey,
} from "./onboarding";

describe("onboarding storage", () => {
  it("treats a missing marker as a first visit", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    };

    expect(hasCompletedOnboarding(storage)).toBe(false);
    expect(storage.getItem).toHaveBeenCalledWith(onboardingStorageKey);
  });

  it("stores and reads the versioned completion marker", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    markOnboardingCompleted(storage);

    expect(values.get(onboardingStorageKey)).toBe("completed");
    expect(hasCompletedOnboarding(storage)).toBe(true);
  });

  it("does not break the application when browser storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(hasCompletedOnboarding(storage)).toBe(true);
    expect(() => markOnboardingCompleted(storage)).not.toThrow();
  });
});
