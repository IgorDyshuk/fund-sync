import { describe, expect, it } from "vitest";
import { getSyncErrorMessage } from "./syncErrors";

describe("cloud synchronization errors", () => {
  it.each(["failed-precondition", "firestore/not-found"])(
    "explains missing Firestore for %s",
    (code) => {
      expect(getSyncErrorMessage({ code })).toContain("Firestore ещё не настроен");
    },
  );

  it.each(["permission-denied", "firestore/permission-denied"])(
    "explains denied Firestore rules for %s",
    (code) => {
      expect(getSyncErrorMessage({ code })).toContain("опубликуй правила");
    },
  );

  it("preserves an unknown Error and safely handles non-errors", () => {
    expect(getSyncErrorMessage(new Error("offline"))).toBe("offline");
    expect(getSyncErrorMessage(null)).toBe("Не удалось синхронизировать историю.");
  });
});
