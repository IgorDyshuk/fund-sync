import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import vision from '@google-cloud/vision'

type RuntimeEnv = Record<string, string | undefined>

type GoogleCredentials = {
  client_email?: string
  private_key?: string
  project_id?: string
  [key: string]: unknown
}

export type OcrImageText = {
  imageIndex: number
  fileName: string
  text: string
  lines?: OcrLayoutLine[]
  fromCache?: boolean
}

export type OcrLayoutWord = {
  text: string
  left: number
  top: number
  right: number
  bottom: number
}

export type OcrLayoutLine = {
  text: string
  top: number
  bottom: number
  words: OcrLayoutWord[]
}

type CachedOcrResult = {
  createdAt: number
  text: string
  lines: OcrLayoutLine[]
}

const ocrCache = new Map<string, CachedOcrResult>()
const defaultOcrCacheTtlMs = 10 * 60 * 1000
const maxOcrCacheEntries = 100
const maxBatchSize = 16

export function hasGoogleVisionCredentials(runtimeEnv: RuntimeEnv) {
  return Boolean(runtimeEnv.GOOGLE_CREDENTIALS_BASE64?.trim())
}

export function parseGoogleCredentials(runtimeEnv: RuntimeEnv): GoogleCredentials {
  const encodedCredentials = runtimeEnv.GOOGLE_CREDENTIALS_BASE64?.trim()
  if (!encodedCredentials) {
    throw new Error(
      'GOOGLE_CREDENTIALS_BASE64 не задан. Добавь base64 service account JSON для Google Cloud Vision.',
    )
  }

  try {
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8')
    const credentials = JSON.parse(decodedCredentials) as GoogleCredentials

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('service account JSON must contain client_email and private_key')
    }

    return credentials
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown parse error'
    const wrappedError = new Error(
      `GOOGLE_CREDENTIALS_BASE64 содержит некорректный service account JSON: ${message}`,
    )
    ;(wrappedError as Error & { cause?: unknown }).cause = error
    throw wrappedError
  }
}

export function getOcrTimeoutMs(runtimeEnv: RuntimeEnv) {
  const configuredTimeout = Number(runtimeEnv.OCR_TIMEOUT_MS)
  if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
    return configuredTimeout
  }

  return 20_000
}

export function getOcrCacheTtlMs(runtimeEnv: RuntimeEnv) {
  const configuredTtl = Number(runtimeEnv.OCR_CACHE_TTL_MS)
  if (Number.isFinite(configuredTtl) && configuredTtl > 0) {
    return configuredTtl
  }

  return defaultOcrCacheTtlMs
}

export async function getOcrCacheKey(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  return createHash('sha256').update(buffer).digest('hex')
}

export function clearOcrCache() {
  ocrCache.clear()
}

export async function extractTextsWithGoogleVision({
  runtimeEnv,
  files,
}: {
  runtimeEnv: RuntimeEnv
  files: File[]
}): Promise<OcrImageText[]> {
  const credentials = parseGoogleCredentials(runtimeEnv)
  const timeoutMs = getOcrTimeoutMs(runtimeEnv)
  const cacheTtlMs = getOcrCacheTtlMs(runtimeEnv)
  const client = new vision.ImageAnnotatorClient({ credentials })
  const preparedFiles = await Promise.all(
    files.map(async (file, index) => {
      const buffer = Buffer.from(await file.arrayBuffer())
      return {
        file,
        index,
        fileName: file.name || `image-${index + 1}`,
        buffer,
        cacheKey: createHash('sha256').update(buffer).digest('hex'),
      }
    }),
  )
  const results: Array<OcrImageText | null> = Array.from({ length: files.length }, () => null)
  const uncachedFiles = []

  for (const preparedFile of preparedFiles) {
    const cached = getCachedOcr(preparedFile.cacheKey, cacheTtlMs)
    if (cached) {
      results[preparedFile.index] = {
        imageIndex: preparedFile.index,
        fileName: preparedFile.fileName,
        text: cached.text,
        lines: cached.lines,
        fromCache: true,
      }
    } else {
      uncachedFiles.push(preparedFile)
    }
  }

  const fileBatches = chunkArray(uncachedFiles, maxBatchSize)
  const batchResults = await Promise.all(
    fileBatches.map((batch) =>
      extractBatchWithFallback({
        client,
        batch,
        timeoutMs,
      }),
    ),
  )

  for (const extractedFile of batchResults.flat()) {
    setCachedOcr(extractedFile.cacheKey, extractedFile.extracted)
    results[extractedFile.index] = {
      imageIndex: extractedFile.index,
      fileName: extractedFile.fileName,
      text: extractedFile.extracted.text,
      lines: extractedFile.extracted.lines,
      fromCache: false,
    }
  }

  return results.filter((result): result is OcrImageText => result !== null)
}

export function formatOcrTextsForPrompt(ocrTexts: OcrImageText[]) {
  return ocrTexts
    .map((ocrText) => {
      const text = ocrText.text.trim() || '[empty OCR result]'
      const layoutRows = formatLayoutRows(ocrText.lines ?? [])
      const layoutSection = layoutRows || '[layout coordinates unavailable]'
      return `--- OCR screenshot ${ocrText.imageIndex + 1}: ${ocrText.fileName} ---\nRaw OCR text:\n${text}\nPrepared layout rows:\n${layoutSection}`
    })
    .join('\n\n')
}

export function createOcrNotes(ocrTexts: OcrImageText[]) {
  const emptyImages = ocrTexts.filter((ocrText) => !ocrText.text.trim())
  const notes = [`OCR обработал скриншотов: ${ocrTexts.length}.`]

  if (emptyImages.length > 0) {
    notes.push(
      `OCR не нашел текст на скриншотах: ${emptyImages
        .map((ocrText) => String(ocrText.imageIndex + 1))
        .join(', ')}.`,
    )
  }

  return notes
}

type PreparedOcrFile = {
  file: File
  index: number
  fileName: string
  buffer: Buffer
  cacheKey: string
}

type ExtractedOcr = {
  text: string
  lines: OcrLayoutLine[]
}

async function extractBatchWithFallback({
  client,
  batch,
  timeoutMs,
}: {
  client: vision.ImageAnnotatorClient
  batch: PreparedOcrFile[]
  timeoutMs: number
}) {
  try {
    const extracted = await withTimeout(
      () => extractTextBatch(client, batch),
      timeoutMs,
      `Google Vision batch OCR не ответил за ${Math.round(timeoutMs / 1000)} секунд.`,
    )
    return extracted
  } catch {
    return Promise.all(
      batch.map(async (preparedFile) => ({
        ...preparedFile,
        extracted: await withTimeout(
          () => extractTextFromImage(client, preparedFile.buffer),
          timeoutMs,
          `Google Vision OCR не ответил за ${Math.round(timeoutMs / 1000)} секунд для файла ${preparedFile.fileName}.`,
        ),
      })),
    )
  }
}

async function extractTextBatch(
  client: vision.ImageAnnotatorClient,
  batch: PreparedOcrFile[],
) {
  const [response] = await client.batchAnnotateImages({
    requests: batch.map((preparedFile) => ({
      image: { content: preparedFile.buffer },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    })),
  })

  const responses = response.responses ?? []
  if (responses.length !== batch.length) {
    throw new Error('Google Vision batch OCR вернул неполное количество ответов.')
  }

  return batch.map((preparedFile, index) => {
    const imageResponse = responses[index]
    const errorMessage = imageResponse.error?.message
    if (errorMessage) {
      throw new Error(`Google Vision OCR для ${preparedFile.fileName}: ${errorMessage}`)
    }

    return {
      ...preparedFile,
      extracted: extractAnnotation(imageResponse.fullTextAnnotation),
    }
  })
}

async function extractTextFromImage(
  client: vision.ImageAnnotatorClient,
  buffer: Buffer,
) {
  const [result] = await client.documentTextDetection({
    image: {
      content: buffer,
    },
  })

  return extractAnnotation(result.fullTextAnnotation)
}

function extractAnnotation(annotation: unknown): ExtractedOcr {
  return {
    text: getRecord(annotation).text ? String(getRecord(annotation).text) : '',
    lines: buildLayoutLines(annotation),
  }
}

function buildLayoutLines(annotation: unknown): OcrLayoutLine[] {
  const words = extractLayoutWords(annotation)
  const lines: Array<{ centerY: number; words: OcrLayoutWord[] }> = []

  for (const word of words.sort((left, right) => {
    const leftCenter = (left.top + left.bottom) / 2
    const rightCenter = (right.top + right.bottom) / 2
    return leftCenter - rightCenter || left.left - right.left
  })) {
    const centerY = (word.top + word.bottom) / 2
    const height = Math.max(1, word.bottom - word.top)
    const matchingLine = lines.find((line) => {
      const lineHeight = line.words.reduce(
        (maxHeight, lineWord) =>
          Math.max(maxHeight, lineWord.bottom - lineWord.top),
        1,
      )
      return Math.abs(line.centerY - centerY) <= Math.max(6, Math.min(28, Math.max(height, lineHeight) * 0.7))
    })

    if (matchingLine) {
      matchingLine.words.push(word)
    } else {
      lines.push({ centerY, words: [word] })
    }
  }

  return lines
    .sort((left, right) => left.centerY - right.centerY)
    .map((line) => {
      const wordsInLine = [...line.words].sort((left, right) => left.left - right.left)
      return {
        text: wordsInLine.map((word) => word.text).join(' '),
        top: Math.min(...wordsInLine.map((word) => word.top)),
        bottom: Math.max(...wordsInLine.map((word) => word.bottom)),
        words: wordsInLine,
      }
    })
}

function extractLayoutWords(annotation: unknown): OcrLayoutWord[] {
  const pages = getArray(getRecord(annotation).pages)
  const words: OcrLayoutWord[] = []

  for (const page of pages) {
    for (const block of getArray(getRecord(page).blocks)) {
      for (const paragraph of getArray(getRecord(block).paragraphs)) {
        for (const word of getArray(getRecord(paragraph).words)) {
          const symbols = getArray(getRecord(word).symbols)
          const text = symbols
            .map((symbol) => String(getRecord(symbol).text ?? ''))
            .join('')
            .trim()
          const bounds = getBounds(getRecord(getRecord(word).boundingBox))

          if (text && bounds) {
            words.push({ text, ...bounds })
          }
        }
      }
    }
  }

  return words
}

function formatLayoutRows(lines: OcrLayoutLine[]) {
  if (lines.length === 0) {
    return ''
  }

  return lines
    .map((line, index) => {
      const words = line.words
        .map((word) => `[x=${Math.round(word.left)}] ${word.text}`)
        .join(' | ')
      return `row ${index + 1}: ${words}`
    })
    .join('\n')
}

function getBounds(value: Record<string, unknown>) {
  const vertices = getArray(value.vertices)
  if (vertices.length === 0) {
    return null
  }

  const points = vertices.map((vertex) => {
    const point = getRecord(vertex)
    return {
      x: toFiniteNumber(point.x),
      y: toFiniteNumber(point.y),
    }
  })

  if (points.some((point) => point.x === null || point.y === null)) {
    return null
  }

  return {
    left: Math.min(...points.map((point) => point.x ?? 0)),
    top: Math.min(...points.map((point) => point.y ?? 0)),
    right: Math.max(...points.map((point) => point.x ?? 0)),
    bottom: Math.max(...points.map((point) => point.y ?? 0)),
  }
}

function getCachedOcr(key: string, ttlMs: number) {
  const cached = ocrCache.get(key)
  if (!cached) {
    return null
  }

  if (Date.now() - cached.createdAt > ttlMs) {
    ocrCache.delete(key)
    return null
  }

  return cached
}

function setCachedOcr(
  key: string,
  result: { text: string; lines: OcrLayoutLine[] },
) {
  ocrCache.set(key, { ...result, createdAt: Date.now() })

  while (ocrCache.size > maxOcrCacheEntries) {
    const oldestKey = ocrCache.keys().next().value
    if (!oldestKey) {
      break
    }
    ocrCache.delete(oldestKey)
  }
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function toFiniteNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

async function withTimeout<T>(
  task: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  }
}
