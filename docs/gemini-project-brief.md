# Fund Sync: Бриф Для Обсуждения С Gemini

## Задача

Я делаю веб-приложение для анализа криптовалютных сделок по связкам, например:

- `Фьючерс + Спот`
- `Фьючерс + Фьючерс`
- потенциально другие комбинации из двух экономических сторон

Пользователь загружает все скриншоты одной связки в одно поле: фьючерсные позиции, спотовые балансы, историю ордеров, депозиты/выводы и дополнительные текстовые условия. Приложение должно автоматически определить, какие скриншоты к чему относятся, извлечь данные и показать финансовый итог сделки.

Главная цель: правильно распознавать данные со скриншотов и корректно считать итог связки. Особенно важен спот, потому что там часто есть балансы до/после, история ордеров, переводы, депозиты/выводы, и модель может путать, что является объемом, что является PnL, а что вообще не относится к сделке.

## Текущая Архитектура

Frontend:

- React + Vite + TypeScript
- Tailwind CSS
- lucide-react
- localStorage для истории сделок

Backend:

- Vercel serverless function `POST /api/analyze`
- локально этот же endpoint поднимается через Vite middleware
- API-ключи не попадают в браузер
- frontend отправляет `multipart/form-data`

LLM:

- сейчас основной провайдер Gemini
- есть поддержка режимов анализа:
  - `balanced` - быстрый обычный режим
  - `smart` - более качественный режим, где первыми пробуются Pro-модели

Текущие env-переменные:

```env
AI_PROVIDER=gemini
GEMINI_MODELS=gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash-lite,gemini-2.5-flash
GEMINI_SMART_MODELS=gemini-3.1-pro-preview,gemini-2.5-pro,gemini-3.5-flash,gemini-2.5-flash
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
GEMINI_TIMEOUT_MS=75000
GEMINI_SMART_TIMEOUT_MS=120000
```

## Входные Данные API

`POST /api/analyze`

`multipart/form-data`:

- `tradeImages[]` - все скриншоты одной связки в любом порядке
- `instructions` - ручные условия пользователя
- `analysisQuality` - `balanced` или `smart`

Пользовательские текстовые условия имеют высший приоритет. Примеры:

- `спот считать 15,54 USDT`
- `итог по споту -15,54`
- `комиссия уже учтена`
- `используй только скриншоты KuCoin`

## Что Должна Делать Модель

Модель не должна считать финальный результат связки. Ее задача - только извлечь структурированные данные и явно показать сомнения/конфликты.

Модель должна:

1. Классифицировать каждый скриншот:
   - futures position
   - spot balance
   - spot order history
   - deposit/withdrawal history
   - unknown
2. Определить стороны сделки и вернуть `legs[]`.
3. Для фьючерсов извлечь:
   - символ
   - направление `long` / `short`
   - время начала и конца
   - объем в USDT
   - realized PnL
   - ROI, если виден
4. Для спота извлечь именно исходные данные:
   - метод: `balance_delta`, `orders`, `manual`, `unknown`
   - `balanceBeforeUsdt`
   - `balanceAfterUsdt`
   - `revenueUsdt`
   - `costUsdt`
   - `rawPnlUsdt`
   - `volumeUsdt`
5. Если есть неоднозначность, не угадывать, а вернуть `conflicts[]`.
6. Если число не видно или непонятно, вернуть `null`.

## Главное Правило По Споту

Спот лучше возвращать как сырой модуль результата, а не как финальный signed PnL.

Например:

- если есть балансы до/после:
  - `rawPnlUsdt = abs(balanceAfterUsdt - balanceBeforeUsdt)`
- если есть история ордеров:
  - `rawPnlUsdt = abs(revenueUsdt - costUsdt)`
- если пользователь написал `спот считать 15,54 USDT`:
  - `rawPnlUsdt = 15.54`
  - знак потом применит приложение

Причина: в хедж-связке знак спота зависит от результата фьючерса.

## Расчет В Приложении

Финальные расчеты делает TypeScript-код, не LLM.

Правила:

1. `legs[]` - основной источник для расчета.
2. Фьючерсный PnL берется как signed realized PnL.
3. Для spot raw PnL:
   - сначала `rawPnlUsdt`
   - если его нет, `abs(balanceAfterUsdt - balanceBeforeUsdt)`
   - если этого нет, `abs(revenueUsdt - costUsdt)`
4. Знак spot PnL по хеджу:
   - если фьючерс в плюс, spot PnL становится отрицательным
   - если фьючерс в минус, spot PnL становится положительным
   - если фьючерсный PnL неизвестен или равен 0, spot PnL не считается автоматически
5. Если пользователь явно ввел signed spot PnL, например `итог по споту -15,54`, это считается ручным подтверждением и знак сохраняется.
6. `netResult = сумма pnl всех legs`
7. `totalVolume = сумма volume всех legs`, если объем известен по всем сторонам.

## Текущая JSON-Схема Ответа

```json
{
  "bundleType": "Фьючерс + Спот",
  "legs": [
    {
      "id": "future-main",
      "label": "Фьючерс",
      "type": "futures",
      "symbol": "SOLUSDT",
      "side": "short",
      "startedAt": "08.07.2026 13:18",
      "endedAt": "08.07.2026 15:06",
      "volumeUsdt": 1550,
      "pnlUsdt": -62.54,
      "realizedPnlUsdt": -62.54,
      "rawPnlUsdt": null,
      "roiPercent": -4.02,
      "method": "unknown",
      "balanceBeforeUsdt": null,
      "balanceAfterUsdt": null,
      "revenueUsdt": null,
      "costUsdt": null
    },
    {
      "id": "spot-main",
      "label": "Спот",
      "type": "spot",
      "symbol": "SOLUSDT",
      "side": "unknown",
      "startedAt": null,
      "endedAt": null,
      "volumeUsdt": 1550,
      "pnlUsdt": null,
      "realizedPnlUsdt": null,
      "rawPnlUsdt": 15.54,
      "roiPercent": null,
      "method": "balance_delta",
      "balanceBeforeUsdt": 2840.18,
      "balanceAfterUsdt": 2824.64,
      "revenueUsdt": null,
      "costUsdt": null
    }
  ],
  "future": {
    "symbol": "SOLUSDT",
    "side": "short",
    "startedAt": "08.07.2026 13:18",
    "endedAt": "08.07.2026 15:06",
    "volumeUsdt": 1550,
    "roiPercent": -4.02,
    "realizedPnlUsdt": -62.54
  },
  "spot": {
    "method": "balance_delta",
    "volumeUsdt": 1550,
    "rawPnlUsdt": 15.54,
    "pnlUsdt": null,
    "balanceBeforeUsdt": 2840.18,
    "balanceAfterUsdt": 2824.64,
    "revenueUsdt": null,
    "costUsdt": null
  },
  "conflicts": [],
  "confidence": 0.86,
  "notes": []
}
```

## Поля `legs[]`

Каждая сторона сделки:

```ts
type Leg = {
  id: string | null
  label: string | null
  type: "futures" | "spot" | "unknown"
  symbol: string | null
  side: "long" | "short" | "unknown"
  startedAt: string | null
  endedAt: string | null
  volumeUsdt: number | null
  pnlUsdt: number | null
  realizedPnlUsdt: number | null
  rawPnlUsdt: number | null
  roiPercent: number | null
  method: "balance_delta" | "orders" | "manual" | "unknown"
  balanceBeforeUsdt: number | null
  balanceAfterUsdt: number | null
  revenueUsdt: number | null
  costUsdt: number | null
}
```

## Конфликты

Если модель видит несколько возможных значений, она должна вернуть конфликт:

```json
{
  "field": "spot.rawPnlUsdt",
  "label": "PnL спота",
  "message": "На скриншотах видно несколько возможных значений спотового результата.",
  "choices": [
    {
      "id": "balance-delta",
      "label": "15.54 USDT по балансу",
      "source": "balance screenshots",
      "value": 15.54
    },
    {
      "id": "orders",
      "label": "14.82 USDT по ордерам",
      "source": "order history",
      "value": 14.82
    }
  ]
}
```

Пользователь выбирает правильный вариант в UI.

## Проблемы Сейчас

1. Быстрые Gemini Flash/Lite модели иногда неправильно понимают спотовую часть.
2. Модель может взять не тот баланс или перепутать общий баланс кошелька с объемом сделки.
3. Модель может использовать депозит/вывод как PnL, хотя это просто перевод.
4. Модель может игнорировать ручную инструкцию пользователя.
5. Модель может вернуть финальный signed spot PnL, хотя лучше вернуть raw source fields.
6. При сложных скриншотах нужна более умная модель или другой pipeline.

## Что Я Хочу Обсудить

Нужно понять, как лучше построить надежный анализатор:

1. Какая Gemini-модель лучше всего подходит для этой задачи с учетом:
   - OCR по скриншотам бирж
   - таблиц/историй ордеров
   - балансов до/после
   - строгого JSON-ответа
   - устойчивости и лимитов
2. Стоит ли использовать двухэтапный pipeline:
   - этап 1: OCR/extraction всех чисел и подписей со скриншотов
   - этап 2: reasoning/model logic, которая классифицирует числа и заполняет JSON
3. Стоит ли делать отдельный prompt для каждого типа скриншота:
   - futures
   - spot balance
   - order history
   - deposits/withdrawals
4. Как лучше заставить модель не считать финальный результат, а возвращать только исходные данные.
5. Как лучше обрабатывать ручные инструкции пользователя.
6. Какую JSON-схему лучше использовать: текущую или стоит добавить новые поля.
7. Нужны ли дополнительные поля вроде:
   - `sourceImageIndex`
   - `sourceText`
   - `extractedRows`
   - `confidenceByField`
   - `warnings`
   - `ignoredValues`
8. Как сделать проверку результата:
   - например, если `rawPnlUsdt` не равен `abs(balanceAfter - balanceBefore)`, возвращать conflict
   - если сумма ордеров не сходится с балансами, возвращать conflict
9. Какую стратегию fallback-моделей использовать.

## Желательное Поведение

Если модель уверена:

- возвращает чистый JSON
- заполняет `legs[]`
- не добавляет лишний текст
- не считает netResult

Если модель не уверена:

- ставит `null`
- добавляет `conflicts[]`
- добавляет короткие `notes[]`
- не выдумывает числа

Если пользователь явно написал ручное значение:

- оно должно иметь приоритет
- но если фото явно противоречит ручному значению, лучше добавить conflict или note

## Текущий Prompt Backend

Сейчас backend отправляет модели примерно такой смысл:

```text
Analyze screenshots for one crypto trade bundle with two or more economic sides.

Manual instructions have highest priority.

You are a conservative OCR/data extraction engine for crypto trade screenshots.

Extraction rules:
- First classify each screenshot by content.
- Do not rely on upload order.
- Build legs[] as the main result.
- Futures screenshots are the source of truth for futures data.
- For spot balances, identify before and after by timestamps/status bars.
- For spot orders, sum filled SELL proceeds and BUY costs.
- Do not use whole wallet balance as spot volume unless manual instructions say so.
- Do not treat unrelated deposits/withdrawals as spot PnL.
- If unclear, return null or conflicts.
- Do not calculate net result or net ROI.
```

## Вопрос К Gemini

Посмотри на этот проект и предложи самый надежный подход, чтобы приложение правильно распознавало и считало связки криптосделок.

Мне нужны конкретные рекомендации:

1. Какую Gemini-модель использовать для `balanced` и для `smart`.
2. Какой pipeline лучше: один запрос с несколькими изображениями или несколько этапов.
3. Как переписать prompt, чтобы модель лучше распознавала спот.
4. Какую JSON-схему стоит изменить или расширить.
5. Как валидировать ответ модели перед расчетом.
6. Как снизить ошибки на балансах, ордерах, депозитах и ручных указаниях.
7. Что лучше считать в LLM, а что строго в TypeScript-коде.
8. Как сделать систему устойчивой к перегрузке моделей и лимитам.
