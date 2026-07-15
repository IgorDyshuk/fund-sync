export function getSyncErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);

    if (code === "failed-precondition" || code === "firestore/not-found") {
      return "Firestore ещё не настроен. Создай базу данных в Firebase Console.";
    }

    if (code === "permission-denied" || code === "firestore/permission-denied") {
      return "Firestore отклонил доступ. Проверь и опубликуй правила базы данных.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Не удалось синхронизировать историю.";
}
