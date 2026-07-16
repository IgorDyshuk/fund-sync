import { translate as t } from "./i18n";

export function getAuthErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return t("Этот email уже зарегистрирован.");
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return t("Неверный email или пароль.");
    case "auth/weak-password":
      return t("Пароль должен содержать минимум 6 символов.");
    case "auth/invalid-email":
      return t("Проверь формат email.");
    case "auth/too-many-requests":
      return t("Слишком много попыток. Попробуй позже.");
    case "auth/popup-closed-by-user":
      return t("Вход через Google отменён.");
    case "auth/popup-blocked":
      return t("Браузер заблокировал окно Google. Разреши всплывающие окна и повтори вход.");
    case "auth/unauthorized-domain":
      return t("Этот домен не разрешён в Firebase Authentication.");
    case "auth/operation-not-allowed":
      return t("Этот способ входа не включён в Firebase Authentication.");
    case "auth/account-exists-with-different-credential":
      return t("Аккаунт с этим email уже использует другой способ входа.");
    default:
      return error instanceof Error ? error.message : t("Не удалось выполнить действие.");
  }
}
