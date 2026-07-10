import { describe, expect, it } from 'vitest'
import {
  getOcrCacheKey,
  createOcrNotes,
  formatOcrTextsForPrompt,
  parseGoogleCredentials,
} from './googleVisionOcr.js'

describe('googleVisionOcr helpers', () => {
  it('parses base64 service account credentials', () => {
    const credentials = {
      client_email: 'vision@example.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----\\n',
      project_id: 'fund-sync',
    }
    const encodedCredentials = Buffer.from(JSON.stringify(credentials)).toString('base64')

    expect(
      parseGoogleCredentials({ GOOGLE_CREDENTIALS_BASE64: encodedCredentials }),
    ).toMatchObject(credentials)
  })

  it('throws a readable error for missing or invalid credentials', () => {
    expect(() => parseGoogleCredentials({})).toThrow('GOOGLE_CREDENTIALS_BASE64')
    expect(() =>
      parseGoogleCredentials({
        GOOGLE_CREDENTIALS_BASE64: Buffer.from('{"project_id":"x"}').toString('base64'),
      }),
    ).toThrow('client_email')
  })

  it('formats OCR texts in screenshot order', () => {
    const formattedText = formatOcrTextsForPrompt([
      {
        imageIndex: 0,
        fileName: 'future.png',
        text: 'Realized PNL 10',
        lines: [
          {
            text: 'BUY 1.5 100 150',
            top: 10,
            bottom: 30,
            words: [
              { text: 'BUY', left: 10, top: 10, right: 30, bottom: 30 },
              { text: '1.5', left: 40, top: 10, right: 60, bottom: 30 },
            ],
          },
        ],
      },
      { imageIndex: 1, fileName: 'spot.png', text: 'BUY 100 USDT' },
    ])

    expect(formattedText).toContain('--- OCR screenshot 1: future.png ---')
    expect(formattedText).toContain('Raw OCR text:\nRealized PNL 10')
    expect(formattedText).toContain('Prepared layout rows:')
    expect(formattedText).toContain('row 1: [x=10] BUY | [x=40] 1.5')
    expect(formattedText).toContain('Raw OCR text:\nBUY 100 USDT')
    expect(formattedText).toContain('--- OCR screenshot 2: spot.png ---')
    expect(formattedText.indexOf('future.png')).toBeLessThan(
      formattedText.indexOf('spot.png'),
    )
  })

  it('adds a note for empty OCR output', () => {
    expect(
      createOcrNotes([
        { imageIndex: 0, fileName: 'empty.png', text: '' },
        { imageIndex: 1, fileName: 'filled.png', text: 'PNL 10' },
      ]),
    ).toEqual(['OCR обработал скриншотов: 2.', 'OCR не нашел текст на скриншотах: 1.'])
  })

  it('creates the same cache key for identical image bytes', async () => {
    const first = new File([new Uint8Array([1, 2, 3])], 'first.png')
    const second = new File([new Uint8Array([1, 2, 3])], 'second.png')

    await expect(getOcrCacheKey(first)).resolves.toBe(await getOcrCacheKey(second))
  })
})
