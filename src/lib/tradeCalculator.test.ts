import { describe, expect, it } from 'vitest'
import { calculateTrade, formatUsdt } from './tradeCalculator'

describe('calculateTrade', () => {
  it('makes spot PnL negative when futures position closes positive', () => {
    const result = calculateTrade({
      future: { realizedPnlUsdt: 100 },
      spot: { rawPnlUsdt: 15.54 },
    })

    expect(result.signedSpotPnl).toBeCloseTo(-15.54)
    expect(result.netResult).toBeCloseTo(84.46)
  })

  it('makes spot PnL positive when futures position closes negative', () => {
    const result = calculateTrade({
      future: { realizedPnlUsdt: -50 },
      spot: { rawPnlUsdt: 19.54 },
    })

    expect(result.signedSpotPnl).toBeCloseTo(19.54)
    expect(result.netResult).toBeCloseTo(-30.46)
  })

  it('calculates net result and total involved volume from both sides', () => {
    const result = calculateTrade({
      future: { volumeUsdt: 1550, realizedPnlUsdt: 62.54 },
      spot: { volumeUsdt: 1550, rawPnlUsdt: 15.54 },
    })

    expect(result.netResult).toBeCloseTo(47)
    expect(result.display.futuresVolume).toBe('1 550,00 USDT')
    expect(result.display.spotVolume).toBe('1 550,00 USDT')
    expect(result.display.totalVolume).toBe('3 100,00 USDT')
    expect(result.display.netResult).toBe('47,00 USDT')
  })

  it('shows total volume as missing when one side volume is missing', () => {
    const result = calculateTrade({
      future: { realizedPnlUsdt: 35.08 },
      spot: { rawPnlUsdt: 15.54 },
    })

    expect(result.display.futuresVolume).toBe('-')
    expect(result.display.spotVolume).toBe('-')
    expect(result.display.totalVolume).toBe('-')
    expect(result.display.netResult).toBe('19,54 USDT')
  })

  it('uses spot order cost as a fallback for spot volume', () => {
    const result = calculateTrade({
      future: { volumeUsdt: 1550, realizedPnlUsdt: -50 },
      spot: { revenueUsdt: 1535, costUsdt: 1550 },
    })

    expect(result.display.spotVolume).toBe('1 550,00 USDT')
    expect(result.display.totalVolume).toBe('3 100,00 USDT')
  })

  it('distinguishes and sums two futures legs', () => {
    const result = calculateTrade({
      future: {},
      legs: [
        {
          id: 'future-a',
          type: 'futures',
          label: 'Фьючерс 1',
          symbol: 'BTCUSDT',
          side: 'long',
          volumeUsdt: 1000,
          pnlUsdt: 40,
        },
        {
          id: 'future-b',
          type: 'futures',
          label: 'Фьючерс 2',
          symbol: 'ETHUSDT',
          side: 'short',
          volumeUsdt: 900,
          pnlUsdt: -12,
        },
      ],
    })

    expect(result.bundleType).toBe('Фьючерс + Фьючерс')
    expect(result.legs).toHaveLength(2)
    expect(result.display.futuresVolume).toBe('1 900,00 USDT')
    expect(result.display.spotVolume).toBe('-')
    expect(result.display.totalVolume).toBe('1 900,00 USDT')
    expect(result.display.netResult).toBe('28,00 USDT')
  })

  it('uses signed leg PnL without forcing the spot hedge sign', () => {
    const result = calculateTrade({
      future: {},
      legs: [
        {
          type: 'futures',
          symbol: 'SOLUSDT',
          side: 'long',
          volumeUsdt: 1550,
          pnlUsdt: 62.54,
        },
        {
          type: 'spot',
          symbol: 'SOLUSDT',
          volumeUsdt: 1550,
          pnlUsdt: 14.82,
        },
      ],
    })

    expect(result.bundleType).toBe('Фьючерс + Спот')
    expect(result.signedSpotPnl).toBeCloseTo(14.82)
    expect(result.netResult).toBeCloseTo(77.36)
    expect(result.display.totalVolume).toBe('3 100,00 USDT')
  })

  it('applies hedge sign to spot leg raw PnL instead of trusting model sign', () => {
    const result = calculateTrade({
      future: {},
      legs: [
        {
          type: 'futures',
          symbol: 'SOLUSDT',
          volumeUsdt: 1550,
          pnlUsdt: 62.54,
          realizedPnlUsdt: 62.54,
        },
        {
          type: 'spot',
          symbol: 'SOLUSDT',
          volumeUsdt: 1550,
          pnlUsdt: 15.54,
          rawPnlUsdt: 15.54,
          method: 'balance_delta',
        },
      ],
    })

    expect(result.signedSpotPnl).toBeCloseTo(-15.54)
    expect(result.netResult).toBeCloseTo(47)
  })

  it('applies hedge sign to spot balance delta when futures leg is negative', () => {
    const result = calculateTrade({
      future: {},
      legs: [
        {
          type: 'futures',
          symbol: 'SOLUSDT',
          volumeUsdt: 1550,
          pnlUsdt: -62.54,
          realizedPnlUsdt: -62.54,
        },
        {
          type: 'spot',
          symbol: 'SOLUSDT',
          volumeUsdt: 1550,
          balanceBeforeUsdt: 2840.18,
          balanceAfterUsdt: 2824.64,
          method: 'balance_delta',
        },
      ],
    })

    expect(result.signedSpotPnl).toBeCloseTo(15.54)
    expect(result.netResult).toBeCloseTo(-47)
  })

  it('keeps manual signed spot leg PnL as the highest priority', () => {
    const result = calculateTrade({
      future: {},
      legs: [
        {
          type: 'futures',
          symbol: 'SOLUSDT',
          volumeUsdt: 1550,
          pnlUsdt: 62.54,
        },
        {
          type: 'spot',
          symbol: 'SOLUSDT',
          volumeUsdt: 1550,
          pnlUsdt: 15.54,
          rawPnlUsdt: 15.54,
          method: 'manual',
        },
      ],
    })

    expect(result.signedSpotPnl).toBeCloseTo(15.54)
    expect(result.netResult).toBeCloseTo(78.08)
  })

  it('shows dashes when required data is missing', () => {
    const result = calculateTrade({
      future: {},
      spot: {},
    })

    expect(result.display.futuresPnl).toBe('-')
    expect(result.display.totalVolume).toBe('-')
    expect(result.display.spotPnl).toBe('-')
    expect(result.display.netResult).toBe('-')
    expect(formatUsdt(null)).toBe('-')
  })
})
