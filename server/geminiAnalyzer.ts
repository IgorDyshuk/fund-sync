import { Buffer } from 'node:buffer'
import type { IncomingMessage } from 'node:http'
import Busboy from 'busboy'

type RuntimeEnv = Record<string, string | undefined>

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

export const missingGeminiApiKeyMessage =
  'GEMINI_API_KEY не задан. Добавь ключ в переменные окружения backend-деплоя или в локальный .env, затем перезапусти сервер.'

export async function requestToFormData(req: IncomingMessage) {
  const contentType = String(req.headers['content-type'] ?? '')
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return new FormData()
  }

  return new Promise<FormData>((resolve, reject) => {
    const formData = new FormData()
    const busboy = Busboy({ headers: req.headers })
    let settled = false

    function fail(error: unknown) {
      if (settled) {
        return
      }

      settled = true
      reject(error)
    }

    function finish() {
      if (settled) {
        return
      }

      settled = true
      resolve(formData)
    }

    busboy.on('field', (fieldName, value) => {
      formData.append(fieldName, value)
    })

    busboy.on('file', (fieldName, file, info) => {
      const chunks: Buffer[] = []

      file.on('data', (chunk: Uint8Array) => {
        chunks.push(Buffer.from(chunk))
      })

      file.on('error', fail)

      file.on('end', () => {
        const fileName = info.filename || 'upload'
        const mimeType = info.mimeType || 'application/octet-stream'
        const fileBuffer = Buffer.concat(chunks)
        const fileBytes = new Uint8Array(fileBuffer.byteLength)
        fileBytes.set(fileBuffer)
        formData.append(fieldName, new File([fileBytes], fileName, { type: mimeType }))
      })
    })

    busboy.on('error', fail)
    busboy.on('finish', finish)
    req.on('error', fail)
    req.pipe(busboy)
  })
}

export function getFiles(formData: FormData, fieldName: string) {
  return formData.getAll(fieldName).filter((value): value is File => value instanceof File)
}

export function getTradeImages(formData: FormData) {
  return [
    ...getFiles(formData, 'tradeImages[]'),
    ...getFiles(formData, 'futuresImages[]'),
    ...getFiles(formData, 'spotImages[]'),
  ]
}

export async function analyzeFormData({
  runtimeEnv,
  formData,
}: {
  runtimeEnv: RuntimeEnv
  formData: FormData
}) {
  const instructions = String(formData.get('instructions') ?? '')
  const tradeImages = getTradeImages(formData)

  return analyzeWithGemini({
    runtimeEnv,
    instructions,
    tradeImages,
  })
}

export async function analyzeWithGemini({
  runtimeEnv,
  instructions,
  tradeImages,
}: {
  runtimeEnv: RuntimeEnv
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
  const timeoutMs = getGeminiTimeoutMs(runtimeEnv)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
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
  } catch (error) {
    if (isAbortError(error)) {
      const timeoutError = new Error(
        `Gemini не ответил за ${Math.round(timeoutMs / 1000)} секунд. Попробуй меньше скриншотов или повтори запрос позже.`,
      )
      timeoutError.cause = error
      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }

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

function getGeminiTimeoutMs(runtimeEnv: RuntimeEnv) {
  const configuredTimeout = Number(runtimeEnv.GEMINI_TIMEOUT_MS)
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout
  }

  return 75_000
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
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
