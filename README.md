# Fund Sync

React-приложение для анализа скриншотов криптосделок через Gemini и расчета
результата по связкам вроде `Фьючерс + Спот` и `Фьючерс + Фьючерс`. Первая
версия реализует UI, расчетную логику, review-конфликты и контракт серверного
Gemini proxy.

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
```

## API Contract

During local development Vite serves `POST /api/analyze` from `vite.config.ts`.
Set `GEMINI_API_KEY` to enable real Vision analysis. Without it the endpoint returns
a setup error; use the `Демо` button to test the UI without calling Gemini.

Create `.env` from `.env.example` for real screenshot analysis:

```bash
GEMINI_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-3.5-flash
```

Restart `npm run dev` after changing `.env`.

`POST /api/analyze`

Request: `multipart/form-data`

- `tradeImages[]`: all screenshots for the trade bundle. Gemini classifies them as futures/spot/order/balance/deposit/withdrawal internally.
- `instructions`: manual conditions and corrections.

Response:

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
      "pnlUsdt": 14.82,
      "realizedPnlUsdt": null,
      "rawPnlUsdt": 14.82,
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

The browser never receives a Gemini API key. The local server endpoint calls Gemini
and returns this structured JSON shape.
