import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  analyzeWithGoogleOcrGemini,
  chooseAnalysisQuality,
  getGeminiModels,
  hasConfiguredAnalyzeProvider,
} from './geminiAnalyzer.js'

describe('google OCR Gemini provider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requires both Google Vision credentials and Gemini key', () => {
    expect(
      hasConfiguredAnalyzeProvider({
        AI_PROVIDER: 'google-ocr-gemini',
        GEMINI_API_KEY: 'gemini-key',
      }),
    ).toBe(false)
    expect(
      hasConfiguredAnalyzeProvider({
        AI_PROVIDER: 'google-ocr-gemini',
        GOOGLE_CREDENTIALS_BASE64: 'credentials',
      }),
    ).toBe(false)
    expect(
      hasConfiguredAnalyzeProvider({
        AI_PROVIDER: 'google-ocr-gemini',
        GOOGLE_CREDENTIALS_BASE64: 'credentials',
        GEMINI_API_KEY: 'gemini-key',
      }),
    ).toBe(true)
  })

  it('chooses smart analysis for every screenshot-based analysis', () => {
    expect(chooseAnalysisQuality({ imageCount: 1 })).toBe('smart')
    expect(chooseAnalysisQuality({ imageCount: 4 })).toBe('smart')
    expect(chooseAnalysisQuality({ imageCount: 6 })).toBe('smart')
  })

  it('uses balanced analysis when there are no screenshots', () => {
    expect(chooseAnalysisQuality({ imageCount: 0 })).toBe('balanced')
  })

  it('appends regular Gemini models after smart models as fallback', () => {
    expect(
      getGeminiModels(
        {
          GEMINI_SMART_MODELS: 'gemini-pro-a,gemini-pro-b',
          GEMINI_MODELS: 'gemini-flash-a,gemini-flash-b',
        },
        'smart',
      ),
    ).toEqual(['gemini-pro-a', 'gemini-pro-b', 'gemini-flash-a', 'gemini-flash-b'])
  })

  it('falls back to Gemini Vision when OCR pipeline fails', async () => {
    const rawExtraction = {
      bundleType: null,
      futuresLegs: [
        {
          symbol: 'SOLUSDT',
          side: 'long',
          realizedPnlUsdt: 10,
          volumeUsdt: 100,
          coinAmount: null,
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
      confidence: 0.5,
      notes: [],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(rawExtraction) }],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }),
    )

    const analysis = await analyzeWithGoogleOcrGemini({
      runtimeEnv: {
        GEMINI_API_KEY: 'gemini-key',
        GEMINI_MODELS: 'gemini-test',
        GOOGLE_CREDENTIALS_BASE64: 'invalid',
        ENABLE_VISION_FALLBACK: 'true',
      },
      instructions: '',
      analysisQuality: 'balanced',
      tradeImages: [new File([new Uint8Array([1])], 'trade.png', { type: 'image/png' })],
    })

    expect(analysis.future.symbol).toBe('SOLUSDT')
    expect(analysis.notes[0]).toContain('Использован fallback Gemini Vision')
    expect(fetch).toHaveBeenCalledOnce()
  })
})
