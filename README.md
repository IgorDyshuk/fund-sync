# Fund Sync

React-приложение для анализа скриншотов криптосделок через Vision API и расчета
результата по связкам вроде `Фьючерс + Спот` и `Фьючерс + Фьючерс`. Первая
версия реализует UI, расчетную логику, review-конфликты и контракт серверного
LLM proxy.

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
```

## API Contract

During local development Vite serves `POST /api/analyze` from `vite.config.ts`.
Set `GOOGLE_CREDENTIALS_BASE64` and `GEMINI_API_KEY` to enable the default OCR
analysis pipeline. Without the required provider credentials the endpoint returns
a setup error.

Create `.env` from `.env.example` for real screenshot analysis:

```bash
AI_PROVIDER=google-ocr-gemini
GOOGLE_CREDENTIALS_BASE64=your-base64-service-account-json
OCR_TIMEOUT_MS=20000
ENABLE_VISION_FALLBACK=true
GEMINI_MODELS=gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash-lite,gemini-2.5-flash
GEMINI_SMART_MODELS=gemini-3.1-pro-preview,gemini-2.5-pro,gemini-3.5-flash,gemini-2.5-flash
GEMINI_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_TIMEOUT_MS=75000
GEMINI_SMART_TIMEOUT_MS=120000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_SMART_MODEL=gpt-4.1
OPENAI_TIMEOUT_MS=75000
OPENAI_SMART_TIMEOUT_MS=120000
VITE_ANALYZE_API_URL=
```

Encode a Google service account JSON file for `GOOGLE_CREDENTIALS_BASE64`:

```bash
base64 -i service-account.json | tr -d '\n'
```

Restart `npm run dev` after changing `.env`.

## Production Deploy

GitHub Pages can host only the static React build. It cannot run `/api/analyze`
or safely store API keys, so the deployed page must call a separate backend
endpoint.

This repo includes a Vercel serverless function at `api/analyze.ts`. The most
reliable option is to deploy the whole app to Vercel. In that case the frontend
and `/api/analyze` live on the same domain, and no `VITE_ANALYZE_API_URL` is
needed.

Set these environment variables in the Vercel project:

```bash
AI_PROVIDER=google-ocr-gemini
GOOGLE_CREDENTIALS_BASE64=your-base64-service-account-json
OCR_TIMEOUT_MS=20000
ENABLE_VISION_FALLBACK=true
GEMINI_MODELS=gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash-lite,gemini-2.5-flash
GEMINI_SMART_MODELS=gemini-3.1-pro-preview,gemini-2.5-pro,gemini-3.5-flash,gemini-2.5-flash
GEMINI_API_KEY=your-gemini-key-here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_TIMEOUT_MS=75000
GEMINI_SMART_TIMEOUT_MS=120000

# Optional OpenAI provider:
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_SMART_MODEL=gpt-4.1
OPENAI_TIMEOUT_MS=75000
OPENAI_SMART_TIMEOUT_MS=120000

ALLOWED_ORIGIN=https://igordyshuk.github.io
```

Provider selection:

- `AI_PROVIDER=google-ocr-gemini`: use Google Cloud Vision OCR first, then parse
  the extracted text with Gemini. This is the recommended production mode.
- `AI_PROVIDER=openai`: use OpenAI Vision.
- `AI_PROVIDER=gemini`: use Gemini.
- `AI_PROVIDER=auto`: try OpenAI first, then Gemini if both keys are set.
- If `AI_PROVIDER` is not set, the backend uses OpenAI when `OPENAI_API_KEY` is
  available, otherwise Gemini.
- `ENABLE_VISION_FALLBACK=true`: when OCR or text parsing fails, fall back to
  the older Gemini Vision screenshot parser.
- `GEMINI_MODELS` is the comma-separated fallback chain for regular/fast
  analysis.
- `GEMINI_SMART_MODELS` is the first part of the fallback chain for automatic
  smart analysis. The backend appends `GEMINI_MODELS` after it, so Pro model
  errors fall back to regular models before the API returns an error.
- Automatic quality selection currently starts with smart analysis for every
  screenshot-based request; text-only manual requests use regular analysis.

If the static frontend stays on GitHub Pages, build it with the full Vercel API
URL:

```bash
VITE_ANALYZE_API_URL=https://your-vercel-project.vercel.app/api/analyze npm run deploy
```

After that, `https://IgorDyshuk.github.io/fund-sync/` will send screenshots to
the deployed backend instead of the local Vite-only API.

`npm run deploy` intentionally fails when `VITE_ANALYZE_API_URL` is missing,
because GitHub Pages cannot handle `POST /api/analyze` and would return `405`.

`POST /api/analyze`

Request: `multipart/form-data`

- `tradeImages[]`: all screenshots for the trade bundle. In the default OCR mode,
  Google Cloud Vision extracts text from each image and Gemini parses that text
  into raw futures/spot data.
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

The browser never receives Gemini or Google Cloud credentials. The backend calls
Google Cloud Vision/Gemini and returns this structured JSON shape.
