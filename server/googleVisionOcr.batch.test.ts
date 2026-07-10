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

import {
  clearOcrCache,
  extractTextsWithGoogleVision,
} from './googleVisionOcr.js'

const runtimeEnv = {
  GOOGLE_CREDENTIALS_BASE64: Buffer.from(
    JSON.stringify({
      client_email: 'vision@example.com',
      private_key: 'private-key',
    }),
  ).toString('base64'),
  OCR_TIMEOUT_MS: '1000',
  OCR_CACHE_TTL_MS: '600000',
}

describe('Google Vision batch OCR', () => {
  beforeEach(() => {
    clearOcrCache()
    visionMocks.batchAnnotateImages.mockReset()
    visionMocks.documentTextDetection.mockReset()
  })

  it('uses one batch request and preserves file order', async () => {
    visionMocks.batchAnnotateImages.mockResolvedValue([
      {
        responses: [
          { fullTextAnnotation: { text: 'future text' } },
          { fullTextAnnotation: { text: 'spot text' } },
        ],
      },
    ])

    const result = await extractTextsWithGoogleVision({
      runtimeEnv,
      files: [
        new File([new Uint8Array([1])], 'future.png'),
        new File([new Uint8Array([2])], 'spot.png'),
      ],
    })

    expect(visionMocks.batchAnnotateImages).toHaveBeenCalledOnce()
    expect(visionMocks.documentTextDetection).not.toHaveBeenCalled()
    expect(result.map((item) => item.fileName)).toEqual(['future.png', 'spot.png'])
    expect(result.map((item) => item.text)).toEqual(['future text', 'spot text'])
  })

  it('does not call Vision again for cached image bytes', async () => {
    visionMocks.batchAnnotateImages.mockResolvedValue([
      { responses: [{ fullTextAnnotation: { text: 'cached text' } }] },
    ])
    const file = new File([new Uint8Array([3])], 'same.png')

    await extractTextsWithGoogleVision({ runtimeEnv, files: [file] })
    const secondResult = await extractTextsWithGoogleVision({
      runtimeEnv,
      files: [new File([new Uint8Array([3])], 'renamed.png')],
    })

    expect(visionMocks.batchAnnotateImages).toHaveBeenCalledOnce()
    expect(visionMocks.documentTextDetection).not.toHaveBeenCalled()
    expect(secondResult[0]).toMatchObject({
      fileName: 'renamed.png',
      text: 'cached text',
      fromCache: true,
    })
  })

  it('falls back to individual OCR when a batch request fails', async () => {
    visionMocks.batchAnnotateImages.mockRejectedValue(new Error('batch unavailable'))
    visionMocks.documentTextDetection.mockImplementation(async ({ image }) => [
      { fullTextAnnotation: { text: Buffer.from(image.content).toString('utf8') } },
    ])

    const result = await extractTextsWithGoogleVision({
      runtimeEnv,
      files: [
        new File([Buffer.from('first')], 'first.png'),
        new File([Buffer.from('second')], 'second.png'),
      ],
    })

    expect(visionMocks.batchAnnotateImages).toHaveBeenCalledOnce()
    expect(visionMocks.documentTextDetection).toHaveBeenCalledTimes(2)
    expect(result.map((item) => item.text)).toEqual(['first', 'second'])
  })
})
