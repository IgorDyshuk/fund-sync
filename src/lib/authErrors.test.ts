import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./authErrors";

describe("Firebase auth error messages", () => {
  it.each([
    ["auth/email-already-in-use", "Этот email уже зарегистрирован."],
    ["auth/invalid-credential", "Неверный email или пароль."],
    ["auth/wrong-password", "Неверный email или пароль."],
    ["auth/user-not-found", "Неверный email или пароль."],
    ["auth/weak-password", "Пароль должен содержать минимум 6 символов."],
    ["auth/invalid-email", "Проверь формат email."],
    ["auth/too-many-requests", "Слишком много попыток. Попробуй позже."],
    ["auth/popup-closed-by-user", "Вход через Google отменён."],
    [
      "auth/popup-blocked",
      "Браузер заблокировал окно Google. Разреши всплывающие окна и повтори вход.",
    ],
    [
      "auth/unauthorized-domain",
      "Этот домен не разрешён в Firebase Authentication.",
    ],
    [
      "auth/operation-not-allowed",
      "Этот способ входа не включён в Firebase Authentication.",
    ],
    [
      "auth/account-exists-with-different-credential",
      "Аккаунт с этим email уже использует другой способ входа.",
    ],
  ])("maps %s", (code, expectedMessage) => {
    expect(getAuthErrorMessage({ code })).toBe(expectedMessage);
  });

  it("keeps an unknown Error message and safely handles non-errors", () => {
    expect(getAuthErrorMessage(new Error("network unavailable"))).toBe(
      "network unavailable",
    );
    expect(getAuthErrorMessage({ code: "auth/new-error" })).toBe(
      "Не удалось выполнить действие.",
    );
    expect(getAuthErrorMessage(null)).toBe("Не удалось выполнить действие.");
  });
});
