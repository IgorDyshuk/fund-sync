import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cwd } from 'node:process'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const runtimeEnv = loadEnv(mode, cwd(), '')

  return {
    plugins: [analyzeApiPlugin(runtimeEnv), react(), tailwindcss()],
  }
})

type TextContent = {
  type: 'text'
  text: string
}

type ImageContent = {
  type: 'image'
  data: string
  mime_type: string
}

type GeminiResponse = {
  future?: unknown
  legs?: unknown
  output_text?: string
  outputText?: string
  text?: string
  response?: {
    output_text?: string
    outputText?: string
  }
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
    finishReason?: string
  }>
  promptFeedback?: {
    blockReason?: string
  }
  error?: {
    message?: string
  }
}

function analyzeApiPlugin(runtimeEnv: Record<string, string | undefined>): Plugin {
  return {
    name: 'fund-sync-analyze-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' })
          return
        }

        try {
          const formData = await requestToFormData(req)
          const instructions = String(formData.get('instructions') ?? '')
          const tradeImages = [
            ...getFiles(formData, 'tradeImages[]'),
            ...getFiles(formData, 'futuresImages[]'),
            ...getFiles(formData, 'spotImages[]'),
          ]

          if (!runtimeEnv.GEMINI_API_KEY) {
            sendJson(res, 503, {
              error:
                'GEMINI_API_KEY не задан. Создай .env в корне проекта, добавь GEMINI_API_KEY=..., затем перезапусти npm run dev. Кнопка "Демо" работает без ключа.',
              code: 'missing_gemini_api_key',
            })
            return
          }

          const analysis = await analyzeWithGemini({
            runtimeEnv,
            instructions,
            tradeImages,
          })
          sendJson(res, 200, analysis)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown analyze error'
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

async function requestToFormData(req: IncomingMessage) {
  const host = req.headers.host ?? '127.0.0.1'
  const body = Readable.toWeb(req) as ReadableStream<Uint8Array>
  const request = new Request(`http://${host}${req.url ?? '/api/analyze'}`, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })

  return request.formData()
}

function getFiles(formData: FormData, fieldName: string) {
  return formData.getAll(fieldName).filter((value): value is File => value instanceof File)
}

async function analyzeWithGemini({
  runtimeEnv,
  instructions,
  tradeImages,
}: {
  runtimeEnv: Record<string, string | undefined>
  instructions: string
  tradeImages: File[]
}) {
  const geminiApiKey = runtimeEnv.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini analysis.')
  }

  const content: Array<TextContent | ImageContent> = [
    {
      type: 'text',
      text: createVisionPrompt(instructions, tradeImages.length),
    },
  ]

  for (const file of tradeImages) {
    content.push({
      type: 'image',
      data: await fileToBase64(file),
      mime_type: file.type || 'image/png',
    })
  }

  const model = runtimeEnv.GEMINI_MODEL ?? 'gemini-3.5-flash'
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: 'You extract crypto trade facts from screenshots. Never guess numbers, dates, symbols, or signs. Use null when unreadable. Return only schema-valid JSON.',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: content.map(geminiContentToPart),
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: tradeAnalysisJsonSchema,
        },
      }),
    },
  )

  const payload = (await response.json()) as GeminiResponse
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini API returned ${response.status}`)
  }

  return extractGeminiJson(payload)
}

async function fileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer).toString('base64')
}

function createVisionPrompt(instructions: string, imageCount: number) {
  return `
Analyze screenshots for one crypto trade bundle with two or more economic sides.

Files:
- total screenshots: ${imageCount}

Manual instructions have highest priority:
${instructions || '-'}

You are a conservative OCR/data extraction engine for crypto trade screenshots.

Extraction rules:
- First classify each screenshot by content: futures position, spot balance, spot order history, deposit/withdrawal history, or unknown.
- Do not rely on upload order. The user can upload all screenshots mixed together.
- Build legs[] as the main result. A leg is one side of the trade bundle: one futures position or one spot side.
- If the bundle has two futures positions, return two separate legs with type "futures".
- If the bundle has futures + spot, return one futures leg and one spot leg.
- Merge duplicate screenshots of the same side into one leg. Do not duplicate a leg just because there are multiple screenshots for that same side.
- Set bundleType in Russian, for example "Фьючерс + Спот" or "Фьючерс + Фьючерс".
- Futures screenshots are the source of truth for futures leg symbol, direction, realized PnL, ROI, volume, start time, and end time.
- Use DD.MM.YYYY HH:MM for dates when visible. If only one date is visible, use it for both start and end time when appropriate.
- For each leg, volumeUsdt is the USDT amount involved on that side.
- For each futures leg, pnlUsdt is the signed realized PnL from the screenshot.
- For each spot leg, pnlUsdt is the signed spot-side result when the sign is visible, calculable from orders, calculable from balance before/after, or explicitly given by manual instructions.
- If a spot screenshot only gives an unsigned/raw amount, put that amount in rawPnlUsdt and set pnlUsdt to null unless manual instructions define the sign.
- Extract spot.volumeUsdt as the USDT amount involved on the spot side when it is visible as order/fill notional, buy cost, sell revenue, a deal-related deposit/withdrawal amount, or a manual instruction.
- Do not use the whole account balance before/after as spot.volumeUsdt unless the user explicitly says that balance is the trade amount.
- rawPnlUsdt is only the absolute raw spot amount when the signed spot PnL is not proven.
- If spot balances are visible, use balance_delta and fill balanceBeforeUsdt/balanceAfterUsdt.
- If spot order history is visible, use orders and fill revenueUsdt/costUsdt.
- Keep filling legacy future and spot objects for compatibility: use the primary futures leg for future, and the primary spot leg for spot. If there is no spot, use method "unknown" and null numeric values.
- If a number is unclear, use null and add a note. Do not estimate.
- If screenshots and manual instructions conflict, put the conflict in conflicts instead of silently choosing.
- Do not calculate net result or net ROI. The app calculates the final total from legs[].
`.trim()
}

const tradeAnalysisJsonSchema = {
  type: 'object',
  properties: {
    bundleType: nullableString(),
    legs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: nullableString(),
          label: nullableString(),
          type: { type: 'string', enum: ['futures', 'spot', 'unknown'] },
          symbol: nullableString(),
          side: { type: 'string', enum: ['long', 'short', 'unknown'] },
          startedAt: nullableString(),
          endedAt: nullableString(),
          volumeUsdt: nullableNumber(),
          pnlUsdt: nullableNumber(),
          realizedPnlUsdt: nullableNumber(),
          rawPnlUsdt: nullableNumber(),
          roiPercent: nullableNumber(),
          method: {
            type: 'string',
            enum: ['balance_delta', 'orders', 'manual', 'unknown'],
          },
          balanceBeforeUsdt: nullableNumber(),
          balanceAfterUsdt: nullableNumber(),
          revenueUsdt: nullableNumber(),
          costUsdt: nullableNumber(),
        },
        required: [
          'id',
          'label',
          'type',
          'symbol',
          'side',
          'startedAt',
          'endedAt',
          'volumeUsdt',
          'pnlUsdt',
          'realizedPnlUsdt',
          'rawPnlUsdt',
          'roiPercent',
          'method',
          'balanceBeforeUsdt',
          'balanceAfterUsdt',
          'revenueUsdt',
          'costUsdt',
        ],
      },
    },
    future: {
      type: 'object',
      properties: {
        symbol: nullableString(),
        side: { type: 'string', enum: ['long', 'short', 'unknown'] },
        startedAt: nullableString(),
        endedAt: nullableString(),
        volumeUsdt: nullableNumber(),
        roiPercent: nullableNumber(),
        realizedPnlUsdt: nullableNumber(),
      },
      required: [
        'symbol',
        'side',
        'startedAt',
        'endedAt',
        'volumeUsdt',
        'roiPercent',
        'realizedPnlUsdt',
      ],
    },
    spot: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['balance_delta', 'orders', 'manual', 'unknown'],
        },
        volumeUsdt: nullableNumber(),
        rawPnlUsdt: nullableNumber(),
        pnlUsdt: nullableNumber(),
        balanceBeforeUsdt: nullableNumber(),
        balanceAfterUsdt: nullableNumber(),
        revenueUsdt: nullableNumber(),
        costUsdt: nullableNumber(),
      },
      required: [
        'method',
        'volumeUsdt',
        'rawPnlUsdt',
        'pnlUsdt',
        'balanceBeforeUsdt',
        'balanceAfterUsdt',
        'revenueUsdt',
        'costUsdt',
      ],
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          label: nullableString(),
          message: nullableString(),
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: nullableString(),
                label: nullableString(),
                source: nullableString(),
                value: {
                  anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
                },
              },
              required: ['id', 'label', 'source', 'value'],
            },
          },
        },
        required: ['field', 'label', 'message', 'choices'],
      },
    },
    confidence: nullableNumber(),
    notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['bundleType', 'legs', 'future', 'spot', 'conflicts', 'confidence', 'notes'],
}

function nullableString() {
  return { anyOf: [{ type: 'string' }, { type: 'null' }] }
}

function nullableNumber() {
  return { anyOf: [{ type: 'number' }, { type: 'null' }] }
}

function geminiContentToPart(content: TextContent | ImageContent) {
  if (content.type === 'text') {
    return { text: content.text }
  }

  return {
    inlineData: {
      mimeType: content.mime_type,
      data: content.data,
    },
  }
}

function extractGeminiJson(payload: GeminiResponse) {
  if (payload.future || payload.legs) {
    return payload
  }

  const candidateText = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter((partText): partText is string => Boolean(partText))
    .join('\n')

  const rawContent =
    candidateText ||
    (payload.output_text ??
      payload.outputText ??
      payload.text ??
      payload.response?.output_text ??
      payload.response?.outputText)

  if (!rawContent) {
    const blockReason = payload.promptFeedback?.blockReason
    const finishReason = payload.candidates?.[0]?.finishReason
    throw new Error(
      blockReason
        ? `Gemini заблокировал запрос: ${blockReason}`
        : `Gemini response did not include JSON content.${finishReason ? ` Finish reason: ${finishReason}` : ''}`,
    )
  }

  return JSON.parse(stripJsonFence(rawContent))
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
