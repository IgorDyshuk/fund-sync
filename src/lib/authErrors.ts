export function getAuthErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Этот email уже зарегистрирован.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверный email или пароль.";
    case "auth/weak-password":
      return "Пароль должен содержать минимум 6 символов.";
    case "auth/invalid-email":
      return "Проверь формат email.";
    case "auth/too-many-requests":
      return "Слишком много попыток. Попробуй позже.";
    case "auth/popup-closed-by-user":
      return "Вход через Google отменён.";
    case "auth/popup-blocked":
      return "Браузер заблокировал окно Google. Разреши всплывающие окна и повтори вход.";
    case "auth/unauthorized-domain":
      return "Этот домен не разрешён в Firebase Authentication.";
    case "auth/operation-not-allowed":
      return "Этот способ входа не включён в Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "Аккаунт с этим email уже использует другой способ входа.";
    default:
      return error instanceof Error ? error.message : "Не удалось выполнить действие.";
  }
}
