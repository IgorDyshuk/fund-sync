import { beforeEach, describe, expect, it, vi } from 'vitest'

const visionMocks = vi.hoisted(() => ({
  batchAnnotateImages: vi.fn(),
  documentTextDetection: vi.fn(),
}))

vi.mock('@google-cloud/vision', () => ({
  default: {
    ImageAnnotatorClient: vi.fn(function ImageAnnotatorClient() {
      return visionMocks
    }),
  },
}))

import { analyzeWithGoogleOcrGemini } from './geminiAnalyzer.js'

const rawExtraction = {
  bundleType: null,
  futuresLegs: [
    {
      symbol: 'SOLUSDT',
      side: 'long',
      realizedPnlUsdt: 10,
      volumeUsdt: 100,
      coinAmount: null,
      amountUnit: 'unknown',
      contractSize: null,
      entryPrice: null,
      exitPrice: null,
      startedAt: null,
      endedAt: null,
      roiPercent: null,
    },
  ],
  futuresLeg: null,
  spotData: {
    method: 'unknown',
    balanceBeforeUsdt: null,
    balanceAfterUsdt: null,
    extractedTransactions: [],
    ignoredTransactions: [],
    manualPnl: null,
  },
  conflicts: [],
  confidence: 0.9,
  notes: [],
}

const credentials = Buffer.from(
  JSON.stringify({
    client_email: 'vision@example.com',
    private_key: 'private-key',
  }),
).toString('base64')

describe('successful OCR Gemini analysis', () => {
  beforeEach(() => {
    visionMocks.batchAnnotateImages.mockReset()
    visionMocks.documentTextDetection.mockReset()
    vi.restoreAllMocks()
    visionMocks.batchAnnotateImages.mockResolvedValue([
      { responses: [{ fullTextAnnotation: { text: 'SOLUSDT realized PNL 10' } }] },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(rawExtraction) }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
  })

  it('uses one text-only Gemini request after successful batch OCR', async () => {
    const analysis = await analyzeWithGoogleOcrGemini({
      runtimeEnv: {
        GEMINI_API_KEY: 'gemini-key',
        GEMINI_MODELS: 'gemini-test',
        GOOGLE_CREDENTIALS_BASE64: credentials,
        ENABLE_VISION_FALLBACK: 'true',
      },
      instructions: '',
      analysisQuality: 'balanced',
      tradeImages: [new File([new Uint8Array([1])], 'trade.png', { type: 'image/png' })],
    })

    expect(analysis.future.symbol).toBe('SOLUSDT')
    expect(visionMocks.batchAnnotateImages).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledOnce()
    expect(analysis.notes.some((note) => note.includes('fallback'))).toBe(false)
  })
})
