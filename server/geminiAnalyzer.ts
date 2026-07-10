import { Buffer } from 'node:buffer'
import type { IncomingMessage } from 'node:http'
import Busboy from 'busboy'
import {
  buildAnalysisFromRawExtraction,
  createRawExtractionPromptFromOcrText,
  createRawExtractionPrompt,
  rawExtractionJsonSchema,
} from './rawTradePipeline.js'
import {
  createOcrNotes,
  extractTextsWithGoogleVision,
  formatOcrTextsForPrompt,
  hasGoogleVisionCredentials,
  type OcrImageText,
} from './googleVisionOcr.js'

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

type AnalyzeProvider = 'openai' | 'gemini' | 'auto' | 'google-ocr-gemini'

type OpenAIResponse = {
  output_text?: string
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
      json?: unknown
    }>
  }>
  error?: {
    message?: string
  }
}

type ProviderError = Error & {
  provider?: string
  model?: string
  status?: number
}

type AnalysisQuality = 'balanced' | 'smart'

export const missingGeminiApiKeyMessage =
  'GEMINI_API_KEY не задан. Добавь ключ в переменные окружения backend-деплоя или в локальный .env, затем перезапусти сервер.'

export const missingAnalyzeApiKeyMessage =
  'Не задан ключ провайдера анализа. Для OCR добавь GOOGLE_CREDENTIALS_BASE64 и GEMINI_API_KEY. Для OpenAI добавь OPENAI_API_KEY. Для Gemini добавь GEMINI_API_KEY.'

export function hasConfiguredAnalyzeProvider(runtimeEnv: RuntimeEnv) {
  const provider = getAnalyzeProvider(runtimeEnv)

  if (provider === 'openai') {
    return Boolean(runtimeEnv.OPENAI_API_KEY)
  }

  if (provider === 'gemini') {
    return Boolean(runtimeEnv.GEMINI_API_KEY)
  }

  if (provider === 'google-ocr-gemini') {
    return hasGoogleVisionCredentials(runtimeEnv) && Boolean(runtimeEnv.GEMINI_API_KEY)
  }

  return Boolean(runtimeEnv.OPENAI_API_KEY || runtimeEnv.GEMINI_API_KEY)
}

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
  const analysisQuality = chooseAnalysisQuality({
    instructions,
    imageCount: tradeImages.length,
  })
  const provider = getAnalyzeProvider(runtimeEnv)
  let rawExtraction: unknown

  if (provider === 'google-ocr-gemini') {
    return analyzeWithGoogleOcrGemini({
      runtimeEnv,
      instructions,
      analysisQuality,
      tradeImages,
    })
  }

  if (provider === 'openai') {
    rawExtraction = await extractWithOpenAI({
      runtimeEnv,
      instructions,
      analysisQuality,
      tradeImages,
    })

    return buildAnalysisFromRawExtraction(rawExtraction, { instructions })
  }

  if (provider === 'gemini') {
    rawExtraction = await extractWithGemini({
      runtimeEnv,
      instructions,
      analysisQuality,
      tradeImages,
    })

    return buildAnalysisFromRawExtraction(rawExtraction, { instructions })
  }

  if (runtimeEnv.OPENAI_API_KEY) {
    try {
      rawExtraction = await extractWithOpenAI({
        runtimeEnv,
        instructions,
        analysisQuality,
        tradeImages,
      })

      return buildAnalysisFromRawExtraction(rawExtraction, { instructions })
    } catch (error) {
      if (!runtimeEnv.GEMINI_API_KEY) {
        throw error
      }
    }
  }

  rawExtraction = await extractWithGemini({
    runtimeEnv,
    instructions,
    analysisQuality,
    tradeImages,
  })

  return buildAnalysisFromRawExtraction(rawExtraction, { instructions })
}

export async function analyzeWithGoogleOcrGemini({
  runtimeEnv,
  instructions,
  analysisQuality = 'balanced',
  tradeImages,
}: {
  runtimeEnv: RuntimeEnv
  instructions: string
  analysisQuality?: AnalysisQuality
  tradeImages: File[]
}) {
  const fallbackEnabled = runtimeEnv.ENABLE_VISION_FALLBACK !== 'false'
  let pipelineError: unknown
  const pipelineStartedAt = Date.now()

  try {
    const ocrStartedAt = Date.now()
    const ocrTexts = await extractTextsWithGoogleVision({
      runtimeEnv,
      files: tradeImages,
    })
    console.info(
      `[api/analyze] OCR completed in ${Date.now() - ocrStartedAt}ms (images=${ocrTexts.length}, cacheHits=${ocrTexts.filter((image) => image.fromCache).length})`,
    )

    const parserStartedAt = Date.now()
    const rawExtraction = await extractOcrTextWithGemini({
      runtimeEnv,
      instructions,
      analysisQuality,
      ocrTexts,
    })
    console.info(`[api/analyze] Gemini text parser completed in ${Date.now() - parserStartedAt}ms`)

    const calculationStartedAt = Date.now()
    const analysis = buildAnalysisFromRawExtraction(rawExtraction, { instructions })
    console.info(
      `[api/analyze] TypeScript calculation completed in ${Date.now() - calculationStartedAt}ms`,
    )
    console.info(
      `[api/analyze] OCR pipeline completed in ${Date.now() - pipelineStartedAt}ms`,
    )

    return {
      ...analysis,
      notes: [...createOcrNotes(ocrTexts), ...analysis.notes],
    }
  } catch (error) {
    pipelineError = error

    if (!fallbackEnabled) {
      throw new Error(`OCR-пайплайн не смог обработать сделку: ${getErrorMessage(error)}`, {
        cause: error,
      })
    }
  }

  console.warn(
    `[api/analyze] OCR pipeline failed after ${Date.now() - pipelineStartedAt}ms; starting Gemini Vision fallback: ${getErrorMessage(pipelineError)}`,
  )

  try {
    const parserStartedAt = Date.now()
    const fallbackRawExtraction = await extractWithGemini({
      runtimeEnv,
      instructions,
      analysisQuality,
      tradeImages,
    })
    console.info(
      `[api/analyze] Gemini Vision fallback parser completed in ${Date.now() - parserStartedAt}ms`,
    )

    const calculationStartedAt = Date.now()
    const fallbackAnalysis = buildAnalysisFromRawExtraction(fallbackRawExtraction, {
      instructions,
    })
    console.info(
      `[api/analyze] Gemini Vision fallback calculation completed in ${Date.now() - calculationStartedAt}ms`,
    )
    console.info(
      `[api/analyze] analysis pipeline completed with fallback in ${Date.now() - pipelineStartedAt}ms`,
    )

    return {
      ...fallbackAnalysis,
      notes: [
        `Использован fallback Gemini Vision: OCR-пайплайн вернул ошибку (${getErrorMessage(pipelineError)}).`,
        ...fallbackAnalysis.notes,
      ],
    }
  } catch (fallbackError) {
    throw new Error(
      `OCR-пайплайн не смог обработать сделку: ${getErrorMessage(pipelineError)}. Fallback Gemini Vision тоже завершился ошибкой: ${getErrorMessage(fallbackError)}`,
      { cause: fallbackError },
    )
  }
}

export async function extractOcrTextWithGemini({
  runtimeEnv,
  instructions,
  analysisQuality = 'balanced',
  ocrTexts,
}: {
  runtimeEnv: RuntimeEnv
  instructions: string
  analysisQuality?: AnalysisQuality
  ocrTexts: OcrImageText[]
}) {
  const geminiApiKey = runtimeEnv.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required for OCR text parsing.')
  }

  const models = getGeminiModels(runtimeEnv, analysisQuality)
  const errors: string[] = []

  for (const model of models) {
    try {
      return await extractOcrTextWithGeminiModel({
        runtimeEnv,
        instructions,
        analysisQuality,
        ocrTexts,
        model,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${model}: ${message}`)
    }
  }

  throw new Error(`Все Gemini text-модели вернули ошибку. ${errors.join(' | ')}`)
}

async function extractOcrTextWithGeminiModel({
  runtimeEnv,
  instructions,
  analysisQuality,
  ocrTexts,
  model,
}: {
  runtimeEnv: RuntimeEnv
  instructions: string
  analysisQuality: AnalysisQuality
  ocrTexts: OcrImageText[]
  model: string
}) {
  const geminiApiKey = runtimeEnv.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required for OCR text parsing.')
  }

  const prompt = createRawExtractionPromptFromOcrText({
    instructions,
    ocrText: formatOcrTextsForPrompt(ocrTexts),
    imageCount: ocrTexts.length,
    analysisQuality,
  })
  const timeoutMs = getGeminiTimeoutMs(runtimeEnv, analysisQuality)
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
                text: 'You are Stage 1 of a crypto OCR pipeline. Parse raw OCR text into schema-valid JSON. Never calculate final PnL, hedge signs, net result, or ROI.',
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseJsonSchema: rawExtractionJsonSchema,
          },
        }),
      },
    )
  } catch (error) {
    if (isAbortError(error)) {
      const timeoutError = new Error(
        `Gemini text parser не ответил за ${Math.round(timeoutMs / 1000)} секунд. Попробуй меньше скриншотов или повтори запрос позже.`,
      )
      ;(timeoutError as Error & { cause?: unknown }).cause = error
      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const payload = (await response.json()) as GeminiResponse
  if (!response.ok) {
    throw createProviderError(payload.error?.message ?? `Gemini API returned ${response.status}`, {
      status: response.status,
      provider: 'gemini',
      model,
    })
  }

  return extractGeminiJson(payload)
}

export async function extractWithOpenAI({
  runtimeEnv,
  instructions,
  analysisQuality = 'balanced',
  tradeImages,
}: {
  runtimeEnv: RuntimeEnv
  instructions: string
  analysisQuality?: AnalysisQuality
  tradeImages: File[]
}) {
  const openaiApiKey = runtimeEnv.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required for OpenAI analysis.')
  }

  const content: Array<
    | {
        type: 'input_text'
        text: string
      }
    | {
        type: 'input_image'
        image_url: string
        detail: 'high'
      }
  > = [
    {
      type: 'input_text',
      text: createRawExtractionPrompt({
        instructions,
        imageCount: tradeImages.length,
        analysisQuality,
      }),
    },
  ]

  for (const file of tradeImages) {
    const mimeType = file.type || 'image/png'
    content.push({
      type: 'input_image',
      image_url: `data:${mimeType};base64,${await fileToBase64(file)}`,
      detail: 'high',
    })
  }

  const model = getOpenAIModel(runtimeEnv, analysisQuality)
  const timeoutMs = getOpenAITimeoutMs(runtimeEnv, analysisQuality)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response

  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions:
          'You are Stage 1 of a crypto screenshot pipeline. Extract only raw facts and classify rows. Never calculate final PnL, hedge signs, net result, or ROI. Return only schema-valid JSON.',
        input: [
          {
            role: 'user',
            content,
          },
        ],
        temperature: 0,
        text: {
          format: {
            type: 'json_schema',
            name: 'raw_trade_extraction',
            strict: true,
            schema: rawExtractionJsonSchema,
          },
        },
      }),
    })
  } catch (error) {
    if (isAbortError(error)) {
      const timeoutError = new Error(
        `OpenAI не ответил за ${Math.round(timeoutMs / 1000)} секунд. Попробуй меньше скриншотов или повтори запрос позже.`,
      )
      ;(timeoutError as Error & { cause?: unknown }).cause = error
      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const payload = (await response.json()) as OpenAIResponse
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI API returned ${response.status}`)
  }

  return extractOpenAIJson(payload)
}

export async function extractWithGemini({
  runtimeEnv,
  instructions,
  analysisQuality = 'balanced',
  tradeImages,
}: {
  runtimeEnv: RuntimeEnv
  instructions: string
  analysisQuality?: AnalysisQuality
  tradeImages: File[]
}) {
  const geminiApiKey = runtimeEnv.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini analysis.')
  }

  const models = getGeminiModels(runtimeEnv, analysisQuality)
  const errors: string[] = []

  for (const model of models) {
    try {
      return await extractWithGeminiModel({
        runtimeEnv,
        instructions,
        analysisQuality,
        tradeImages,
        model,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${model}: ${message}`)
    }
  }

  throw new Error(`Все Gemini-модели вернули ошибку. ${errors.join(' | ')}`)
}

async function extractWithGeminiModel({
  runtimeEnv,
  instructions,
  analysisQuality,
  tradeImages,
  model,
}: {
  runtimeEnv: RuntimeEnv
  instructions: string
  analysisQuality: AnalysisQuality
  tradeImages: File[]
  model: string
}) {
  const geminiApiKey = runtimeEnv.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required for Gemini analysis.')
  }

  const content: Array<TextContent | ImageContent> = [
    {
      type: 'text',
      text: createRawExtractionPrompt({
        instructions,
        imageCount: tradeImages.length,
        analysisQuality,
      }),
    },
  ]

  for (const file of tradeImages) {
    content.push({
      type: 'image',
      data: await fileToBase64(file),
      mime_type: file.type || 'image/png',
    })
  }

  const timeoutMs = getGeminiTimeoutMs(runtimeEnv, analysisQuality)
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
                text: 'You are Stage 1 of a crypto screenshot pipeline. Extract only raw facts and classify rows. Never calculate final PnL, hedge signs, net result, or ROI. Return only schema-valid JSON.',
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
            responseJsonSchema: rawExtractionJsonSchema,
          },
        }),
      },
    )
  } catch (error) {
    if (isAbortError(error)) {
      const timeoutError = new Error(
        `Gemini не ответил за ${Math.round(timeoutMs / 1000)} секунд. Попробуй меньше скриншотов или повтори запрос позже.`,
      )
      ;(timeoutError as Error & { cause?: unknown }).cause = error
      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const payload = (await response.json()) as GeminiResponse
  if (!response.ok) {
    throw createProviderError(payload.error?.message ?? `Gemini API returned ${response.status}`, {
      status: response.status,
      provider: 'gemini',
      model,
    })
  }

  return extractGeminiJson(payload)
}

async function fileToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  return Buffer.from(arrayBuffer).toString('base64')
}

function getAnalyzeProvider(runtimeEnv: RuntimeEnv): AnalyzeProvider {
  const configuredProvider = String(
    runtimeEnv.AI_PROVIDER ?? runtimeEnv.ANALYZE_PROVIDER ?? '',
  )
    .trim()
    .toLowerCase()

  if (
    configuredProvider === 'openai' ||
    configuredProvider === 'gemini' ||
    configuredProvider === 'auto' ||
    configuredProvider === 'google-ocr-gemini'
  ) {
    return configuredProvider
  }

  if (configuredProvider === 'google_ocr_gemini' || configuredProvider === 'ocr') {
    return 'google-ocr-gemini'
  }

  return runtimeEnv.OPENAI_API_KEY ? 'openai' : 'gemini'
}

export function chooseAnalysisQuality({
  imageCount,
}: {
  instructions?: string
  imageCount: number
}): AnalysisQuality {
  if (imageCount > 0) {
    return 'smart'
  }

  return 'balanced'
}

function getOpenAIModel(runtimeEnv: RuntimeEnv, analysisQuality: AnalysisQuality) {
  if (analysisQuality === 'smart') {
    return runtimeEnv.OPENAI_SMART_MODEL?.trim() || runtimeEnv.OPENAI_MODEL?.trim() || 'gpt-4.1'
  }

  return runtimeEnv.OPENAI_MODEL?.trim() || 'gpt-4.1-mini'
}

export function getGeminiModels(runtimeEnv: RuntimeEnv, analysisQuality: AnalysisQuality) {
  const primaryModel = runtimeEnv.GEMINI_MODEL?.trim()

  const balancedModels = getConfiguredModelList(runtimeEnv.GEMINI_MODELS, [
    primaryModel,
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ])

  if (analysisQuality === 'balanced') {
    return balancedModels
  }

  const smartModels = getConfiguredModelList(
    runtimeEnv.GEMINI_SMART_MODELS ?? runtimeEnv.AI_SMART_MODELS,
    [
      runtimeEnv.GEMINI_SMART_MODEL?.trim(),
      'gemini-3.1-pro-preview',
      'gemini-2.5-pro',
      primaryModel,
    ],
  )

  return [...new Set([...smartModels, ...balancedModels])]
}

function getConfiguredModelList(value: string | undefined, fallback: Array<string | undefined>) {
  const configuredModels = String(value ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)

  const models = configuredModels.length > 0 ? configuredModels : fallback

  return [...new Set(models.filter((model): model is string => Boolean(model)))]
}

function getGeminiTimeoutMs(runtimeEnv: RuntimeEnv, analysisQuality: AnalysisQuality) {
  const configuredTimeout = Number(
    analysisQuality === 'smart'
      ? runtimeEnv.GEMINI_SMART_TIMEOUT_MS ?? runtimeEnv.GEMINI_TIMEOUT_MS
      : runtimeEnv.GEMINI_TIMEOUT_MS,
  )
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout
  }

  return analysisQuality === 'smart' ? 120_000 : 75_000
}

function getOpenAITimeoutMs(runtimeEnv: RuntimeEnv, analysisQuality: AnalysisQuality) {
  const configuredTimeout = Number(
    analysisQuality === 'smart'
      ? runtimeEnv.OPENAI_SMART_TIMEOUT_MS ??
          runtimeEnv.OPENAI_TIMEOUT_MS ??
          runtimeEnv.AI_TIMEOUT_MS
      : runtimeEnv.OPENAI_TIMEOUT_MS ?? runtimeEnv.AI_TIMEOUT_MS,
  )
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout
  }

  return analysisQuality === 'smart' ? 120_000 : 75_000
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function createProviderError(
  message: string,
  metadata: {
    provider: string
    model: string
    status?: number
  },
) {
  const error = new Error(message) as ProviderError
  error.provider = metadata.provider
  error.model = metadata.model
  error.status = metadata.status

  return error
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
  const directPayload = payload as GeminiResponse & Record<string, unknown>
  if (directPayload.futuresLegs || directPayload.futuresLeg || directPayload.spotData) {
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

function extractOpenAIJson(payload: OpenAIResponse) {
  const jsonContent = payload.output
    ?.flatMap((outputItem) => outputItem.content ?? [])
    .map((contentItem) => contentItem.json)
    .find((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object')

  if (jsonContent) {
    return jsonContent
  }

  const outputContent = payload.output
    ?.flatMap((outputItem) => outputItem.content ?? [])
    .map((contentItem) => contentItem.text)
    .filter((contentText): contentText is string => Boolean(contentText))
    .join('\n')

  const rawContent = payload.output_text || outputContent
  if (!rawContent) {
    throw new Error('OpenAI response did not include JSON content.')
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
