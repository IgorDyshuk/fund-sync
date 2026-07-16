export type AppLanguage = "ru" | "en";

const languageStorageKey = "fund-sync:language:v1";

const english: Record<string, string> = {
  "Обзор": "Overview",
  "Проверка аккаунта": "Checking account",
  "Открыть личный кабинет": "Open account settings",
  "Войти в аккаунт": "Sign in",
  "История пока пустая": "No history yet",
  "Новые итоги появятся после сохранения связки.": "New results will appear after you save a trade.",
  "Последние связки": "Recent trades",
  "Показать все": "Show all",
  "Добавить связку": "Add trade",
  "Настройки": "Settings",
  "Аккаунт, синхронизация и данные": "Account, sync and data",
  "Закрыть настройки": "Close settings",
  "Аккаунт": "Account",
  "Данные профиля и состояние облачной синхронизации.": "Profile details and cloud sync status.",
  "Email не указан": "Email not provided",
  "Синхронизация включена": "Sync enabled",
  "Данные": "Data",
  "Управление историей связок и перенос данных.": "Manage trade history and move your data.",
  "Импорт истории": "Import history",
  "Файл CSV с сохранёнными связками": "CSV file with saved trades",
  "Выбрать CSV с историей": "Choose history CSV",
  "Импортируем...": "Importing...",
  "Импортировать CSV": "Import CSV",
  "Экспорт истории": "Export history",
  "CSV со связками за выбранный период": "CSV with trades for the selected period",
  "Экспортировать": "Export",
  "Экспортировать CSV": "Export CSV",
  "Язык": "Language",
  "Язык интерфейса приложения.": "Application interface language.",
  "Русский": "Russian",
  "Английский": "English",
  "Обучение": "Tutorial",
  "Краткое знакомство с основными возможностями Fund Sync.": "A quick introduction to Fund Sync.",
  "Обзор приложения": "Application overview",
  "6 коротких шагов": "6 short steps",
  "Пройти обучение": "View tutorial",
  "Выходим...": "Signing out...",
  "Выйти из аккаунта": "Sign out",
  "Свой период": "Custom range",
  "День": "Day",
  "Месяц": "Month",
  "Квартал": "Quarter",
  "Год": "Year",
  "Период анализа": "Analysis period",
  "Применить": "Apply",
  "Не удалось применить выбранный период.": "Could not apply the selected period.",
  "Укажите начало и окончание периода.": "Select the start and end dates.",
  "Дата начала не может быть позже даты окончания.": "The start date cannot be after the end date.",
  "Закрыть выбор периода": "Close period picker",
  "Закрыть": "Close",
  "От": "From",
  "До": "To",
  "Подготавливаем...": "Preparing...",
  "Все связки": "All trades",
  "Вернуться на главную": "Back to overview",
  "Удалить все связки": "Delete all trades",
  "Удалить всю историю?": "Delete all history?",
  "Отмена": "Cancel",
  "Удаляем...": "Deleting...",
  "Удалить всё": "Delete all",
  "Обзор за день": "Daily overview",
  "Обзор за месяц": "Monthly overview",
  "Обзор за квартал": "Quarterly overview",
  "Обзор за год": "Yearly overview",
  "Обзор за период": "Range overview",
  "Выбрать период анализа": "Select analysis period",
  "Прибыль": "Profit",
  "Убытки": "Losses",
  "Связок": "Trades",
  "Чистый итог": "Net result",
  "Динамика по месяцам": "Monthly performance",
  "Динамика по периодам": "Period performance",
  "Результат по монетам": "Result by coin",
  "Нет закрытых связок": "No closed trades",
  "Выберите другой период.": "Select another period.",
  "Предыдущий": "Previous",
  "Следующий": "Next",
  "день": "day",
  "месяц": "month",
  "квартал": "quarter",
  "год": "year",
  "Результат за": "Result for",
  "Подробнее": "Details",
  "Итоги появятся после сохранения сделок за этот месяц.": "Results will appear after trades are saved for this month.",
  "Ещё": "More",
  "Итог": "Total",
  "USDT · Итог": "USDT · Total",
  "Связки": "Trades",
  "Связки за этот период не найдены": "No trades found for this period",
  "Вернуться к обзору месяца": "Back to period overview",
  "Связка сделки": "Trade bundle",
  "Скриншоты сделки": "Trade screenshots",
  "Загрузи все фото одной связки: фьючерсы, спот, балансы, ордера, депозиты и выводы.": "Upload all screenshots for one trade: futures, spot, balances, orders, deposits and withdrawals.",
  "Условия и корректировки": "Conditions and adjustments",
  "Например: спот вышел в -16.9 USDT": "For example: spot result was -16.9 USDT",
  "Открыть": "Open",
  "Вручную": "Manual",
  "Анализировать": "Analyze",
  "Очистить": "Clear",
  "Ошибка анализа": "Analysis error",
  "Полный текст ошибки можно скопировать.": "You can copy the full error message.",
  "Скопировано": "Copied",
  "Не скопировано": "Not copied",
  "Копировать": "Copy",
  "Выбрать изображения": "Choose images",
  "Новая связка": "New trade",
  "Загрузка скриншотов, анализ и сохранение итога": "Upload screenshots, analyze and save the result",
  "Закрыть окно анализа": "Close analysis window",
  "Анализ связки": "Trade analysis",
  "Повторить": "Retry",
  "Сохраняем...": "Saving...",
  "Готово": "Done",
  "Сохранить результат?": "Save the result?",
  "Итог по связке уже рассчитан. Сохрани его в историю или закрой окно без сохранения.": "The trade result is ready. Save it to history or close without saving.",
  "Не сохранять": "Don't save",
  "Остаться": "Stay",
  "Сохранить": "Save",
  "Проверь данные": "Review data",
  "Сделка": "Trade",
  "Применить значения": "Apply values",
  "Свое значение": "Custom value",
  "Вариант": "Option",
  "Уточнить знак Spot?": "Confirm Spot sign?",
  "В минус": "Negative",
  "В плюс": "Positive",
  "указанную сумму": "the specified amount",
  "Готов": "Ready",
  "Анализ": "Analysis",
  "Проверка": "Review",
  "Ошибка": "Error",
  "Анализ сделки": "Trade analysis",
  "Ожидание анализа": "Waiting for analysis",
  "Заметки по связке": "Trade notes",
  "Закрыть заметки": "Close notes",
  "Краткая сводка": "Summary",
  "Общий объем": "Total volume",
  "Спред входа": "Entry spread",
  "Спред выхода": "Exit spread",
  "Итог по связке": "Trade result",
  "Информация о связке": "Trade details",
  "Закрыть информацию о связке": "Close trade details",
  "Сохранённый результат сделки": "Saved trade result",
  "Редактировать": "Edit",
  "Удалить связку": "Delete trade",
  "Удалить связку?": "Delete this trade?",
  "Итог будет удалён из истории без возможности восстановления.": "The result will be permanently removed from history.",
  "Удалить": "Delete",
  "Результат импорта": "Import result",
  "Закрыть результат импорта": "Close import result",
  "Добавлено": "Added",
  "Дубликаты": "Duplicates",
  "Ошибки": "Errors",
  "Строки, требующие внимания": "Rows requiring attention",
  "Импорт завершен": "Import complete",
  "Все строки обработаны без ошибок.": "All rows were processed successfully.",
  "Файл": "File",
  "Строка": "Row",
  "Заполнить вручную": "Fill manually",
  "Заполнить строку": "Complete row",
  "Закрыть ручное заполнение": "Close manual entry",
  "Уже распознанные значения сохранены. Дополните или исправьте недостающие поля.": "Recognized values are preserved. Complete or correct the missing fields.",
  "Монета": "Coin",
  "Итог, USDT": "Total, USDT",
  "Период": "Period",
  "Начало": "Start",
  "Окончание": "End",
  "Спред входа, %": "Entry spread, %",
  "Спред выхода, %": "Exit spread, %",
  "Количество монет": "Coin quantity",
  "Необязательно": "Optional",
  "Спред принес": "Spread contribution",
  "Сохранить связку": "Save trade",
  "Добавить связку вручную": "Add trade manually",
  "Редактировать связку": "Edit trade",
  "Измените нужные поля и сохраните обновлённый результат.": "Edit the fields you need and save the updated result.",
  "Укажите монету, период и итог по связке. Остальные поля можно оставить пустыми.": "Enter the coin, period and trade result. Other fields are optional.",
  "Выбрать дату и время": "Select date and time",
  "Создать аккаунт": "Create account",
  "История связок будет доступна на всех устройствах.": "Your trade history will be available on all devices.",
  "Firebase пока не настроен. Добавь `VITE_FIREBASE_*` переменные из Firebase Console в `.env` или Vercel Environment Variables.": "Firebase is not configured yet. Add the `VITE_FIREBASE_*` variables from Firebase Console to `.env` or Vercel Environment Variables.",
  "Продолжить с Google": "Continue with Google",
  "Подключение...": "Connecting...",
  "или по email": "or use email",
  "Войти": "Sign in",
  "Регистрация": "Sign up",
  "Пароль": "Password",
  "Повтори пароль": "Repeat password",
  "Подожди...": "Please wait...",
  "Добро пожаловать в Fund Sync": "Welcome to Fund Sync",
  "Сохраняйте сделки, считайте общий результат связок и анализируйте прибыль по каждой монете.": "Save trades, calculate bundle results and analyze profit by coin.",
  "Добавьте связку": "Add a trade",
  "Кнопка «+» открывает анализатор. Связку можно распознать по скриншотам или добавить вручную.": "The “+” button opens the analyzer. Analyze screenshots or add a trade manually.",
  "Скриншоты и условия": "Screenshots and conditions",
  "Загрузите все изображения одной сделки вместе. Текстовые уточнения имеют приоритет над распознанными данными.": "Upload all images for one trade together. Text instructions take priority over recognized data.",
  "Проверьте результат": "Review the result",
  "Сверьте стороны сделки, PnL, общий объём и спреды. Сохраните результат или запустите анализ повторно.": "Review trade sides, PnL, total volume and spreads. Save the result or run the analysis again.",
  "История и аналитика": "History and analytics",
  "Просматривайте сохранённые сделки, результат по монетам и выбирайте день, месяц, квартал, год или свой период.": "Review saved trades and coin results for a day, month, quarter, year or custom range.",
  "Аккаунт и синхронизация": "Account and sync",
  "Войдите в аккаунт, чтобы история была доступна на всех устройствах. Обучение всегда можно открыть снова в настройках.": "Sign in to access your history on every device. You can reopen this tutorial from Settings.",
  "Пропустить": "Skip",
  "Слайды обучения": "Tutorial slides",
  "Назад": "Back",
  "Начать работу": "Get started",
  "Далее": "Next",
  "Все скриншоты": "All screenshots",
  "Условия": "Conditions",
  "Ваш аккаунт": "Your account",
  "Облачная история": "Cloud history",
  "Включена": "Enabled",
  "Фьючерс + Спот": "Futures + Spot",
  "Фьючерс + Фьючерс": "Futures + Futures",
  "Фьючерс": "Futures",
  "Спот": "Spot",
  "Лонг": "Long",
  "Шорт": "Short",
  "балансы": "balances",
  "ордера": "orders",
  "ручной ввод": "manual entry",
  "Ручной итог": "Manual result",
  "Закрыть ручное добавление": "Close manual entry",
  "Укажите дату и время начала и окончания связки.": "Enter the trade start and end date and time.",
  "Окончание связки должно быть позже её начала.": "The trade must end after it starts.",
  "Не удалось сохранить связку.": "Could not save the trade.",
  "Пароли не совпадают.": "Passwords do not match.",
  "Ты указал {amount} без знака. Результат по Spot был в плюс или в минус?": "You entered {amount} without a sign. Was the Spot result positive or negative?",
  "Не удалось загрузить облачную историю за 15 секунд.": "Cloud history did not load within 15 seconds.",
  "Добавь скриншоты или условия сделки.": "Add screenshots or trade instructions.",
  "Ответ /api/analyze не совпадает с контрактом.": "The /api/analyze response does not match the contract.",
  "API анализа не ответил за 130 секунд. Попробуй меньше скриншотов или повтори запрос позже.": "The analysis API did not respond within 130 seconds. Try fewer screenshots or retry later.",
  "Не удалось обработать сделку.": "Could not process the trade.",
  "CSV слишком большой. Максимальный размер файла — 5 МБ.": "The CSV file is too large. The maximum size is 5 MB.",
  "Не удалось сохранить в Firestore: {error}": "Could not save to Firestore: {error}",
  "Не удалось прочитать или импортировать CSV.": "Could not read or import the CSV file.",
  "За выбранный период нет связок для экспорта.": "There are no trades to export for the selected period.",
  "Связка уже существует и была пропущена.": "The trade already exists and was skipped.",
  "Заполнено и импортировано вручную.": "Completed and imported manually.",
  "Связка с такой монетой, периодом и итогом уже существует.": "A trade with the same coin, period and result already exists.",
  "Будет удалена вся история: {count} {word}. Восстановить её будет невозможно.": "All history will be deleted: {count} {word}. This action cannot be undone.",
  "Открыть связки {symbol} за {period}": "Open {symbol} trades for {period}",
  "Показать связки {symbol} за {period}": "Show {symbol} trades for {period}",
  "Динамика {symbol} за семь месяцев": "{symbol} performance over seven months",
  "Динамика {symbol} по периодам": "{symbol} performance by period",
  "Результат за {period}: {result}": "Result for {period}: {result}",
  "Удалить {name}": "Remove {name}",
  "Открыть связку {symbol}": "Open {symbol} trade",
  "Проверка аккаунта...": "Checking account...",
  "Дата не определена": "Date not available",
  "Экспорт истории в CSV": "Export history to CSV",
  "Сохранить CSV": "Save CSV",
  "Строка {row}": "Row {row}",
  "Заполнить строку {row}": "Complete row {row}",
  "вручную": "manually",
  "Шаг {current} из {total}": "Step {current} of {total}",
  "Перейти к шагу {step}": "Go to step {step}",
  "Спот + Спот": "Spot + Spot",
  "Объем спота": "Spot volume",
  "Баланс до": "Opening balance",
  "Баланс после": "Closing balance",
  "Выручка": "Revenue",
  "Затраты": "Costs",
  "Этот email уже зарегистрирован.": "This email is already registered.",
  "Неверный email или пароль.": "Incorrect email or password.",
  "Пароль должен содержать минимум 6 символов.": "The password must contain at least 6 characters.",
  "Проверь формат email.": "Check the email format.",
  "Слишком много попыток. Попробуй позже.": "Too many attempts. Try again later.",
  "Вход через Google отменён.": "Google sign-in was cancelled.",
  "Браузер заблокировал окно Google. Разреши всплывающие окна и повтори вход.": "The browser blocked the Google window. Allow pop-ups and try again.",
  "Этот домен не разрешён в Firebase Authentication.": "This domain is not authorized in Firebase Authentication.",
  "Этот способ входа не включён в Firebase Authentication.": "This sign-in method is not enabled in Firebase Authentication.",
  "Аккаунт с этим email уже использует другой способ входа.": "An account with this email already uses another sign-in method.",
  "Не удалось выполнить действие.": "Could not complete the action.",
  "Firestore ещё не настроен. Создай базу данных в Firebase Console.": "Firestore is not configured yet. Create a database in Firebase Console.",
  "Firestore отклонил доступ. Проверь и опубликуй правила базы данных.": "Firestore denied access. Check and publish the database rules.",
  "Не удалось синхронизировать историю.": "Could not sync history.",
  "Не указана монета.": "Coin is missing.",
  "Не удалось распознать период сделки.": "Could not recognize the trade period.",
  "Не найден PnL Long или Short.": "Long or Short PnL is missing.",
  "Не указан итог связки в USDT.": "Trade result in USDT is missing.",
  "Импортировано.": "Imported.",
  "Добавлено вручную.": "Added manually.",
  "Импортировано из CSV.": "Imported from CSV.",
  "PnL Long и Short не указан; используется ручной итог связки.": "Long and Short PnL is missing; the manual trade result is used.",
  "Не удалось удалить историю связок.": "Could not delete trade history.",
  "Уверенность": "Confidence",
};

let activeLanguage: AppLanguage = readStoredLanguage();

export function translate(
  source: string,
  values?: Record<string, string | number>,
) {
  let result = activeLanguage === "en" ? translateToEnglish(source) : source;
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      result = result.replaceAll(`{${key}}`, String(value));
    }
  }
  return result;
}

export function getAppLanguage() {
  return activeLanguage;
}

export function getAppLocale() {
  return activeLanguage === "en" ? "en-US" : "ru-RU";
}

export function setAppLanguage(language: AppLanguage) {
  applyLanguage(language);
}

function translateToEnglish(source: string) {
  const exact = english[source];
  if (exact) {
    return exact;
  }

  if (source.includes(" · ")) {
    return source
      .split(" · ")
      .map((part) => english[part] ?? translateDomainPrefix(part))
      .join(" · ");
  }

  const csvRow = source.match(/^Импортировано из CSV, строка (\d+)\.$/);
  if (csvRow) {
    return `Imported from CSV, row ${csvRow[1]}.`;
  }

  const quantity = source.match(/^Количество монет: (.+)\.$/);
  if (quantity) {
    return `Coin quantity: ${quantity[1]}.`;
  }

  const spreadContribution = source.match(/^Значение «Спред принес»: (.+)\.$/);
  if (spreadContribution) {
    return `Spread contribution: ${spreadContribution[1]}.`;
  }

  const missingColumns = source.match(/^Не найдены обязательные колонки: (.+)\.$/);
  if (missingColumns) {
    return `Required columns were not found: ${missingColumns[1]}.`;
  }

  return translateDomainPrefix(source);
}

function translateDomainPrefix(source: string) {
  return source
    .replace(/^Фьючерс(?=\s|$)/, "Futures")
    .replace(/^Сторона(?=\s|$)/, "Leg")
    .replace(/^Лонг(?=\s|$)/, "Long")
    .replace(/^Шорт(?=\s|$)/, "Short")
    .replace(/^Спот(?=\s|$)/, "Spot");
}

function applyLanguage(language: AppLanguage) {
  activeLanguage = language;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(languageStorageKey, language);
    } catch {
      // The selected language still applies for this session.
    }
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

function readStoredLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "ru";
  }
  try {
    return window.localStorage.getItem(languageStorageKey) === "en" ? "en" : "ru";
  } catch {
    return "ru";
  }
}
