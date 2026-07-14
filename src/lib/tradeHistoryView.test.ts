import { describe, expect, it } from 'vitest'
import { calculateTrade } from './tradeCalculator'
import { getTradeClosedAt, groupTradesByClosedDate } from './tradeHistoryView'
import type { SavedTrade } from '../types/app'

describe('tradeHistoryView', () => {
  it('groups trades by closing date instead of opening date', () => {
    const groups = groupTradesByClosedDate([
      createTrade('opened-earlier', '13.07.2026 23:50', '14.07.2026 00:20'),
      createTrade('closed-earlier', '14.07.2026 10:00', '14.07.2026 11:00'),
      createTrade('previous-day', '12.07.2026 23:00', '13.07.2026 00:10'),
    ])

    expect(groups.map((group) => group.label)).toEqual([
      '14 июля 2026 г.',
      '13 июля 2026 г.',
    ])
    expect(groups[0].trades.map((trade) => trade.id)).toEqual([
      'closed-earlier',
      'opened-earlier',
    ])
  })

  it('uses the latest closing leg when a bundle has multiple futures legs', () => {
    const trade = createTrade('multi-leg', '14.07.2026 10:00', '14.07.2026 10:30')
    trade.calculation.legs.push({
      ...trade.calculation.legs[0],
      id: 'second-leg',
      endedAt: '15.07.2026 08:15',
    })

    expect(getTradeClosedAt(trade)?.getDate()).toBe(15)
    expect(groupTradesByClosedDate([trade])[0].label).toBe('15 июля 2026 г.')
  })

  it('supports ISO timestamps and keeps invalid dates in a separate group', () => {
    const valid = createTrade('iso', '2026-07-14T09:00:00', '2026-07-14T10:05:30')
    const invalid = createTrade('unknown', '-', '-')

    const groups = groupTradesByClosedDate([invalid, valid])

    expect(groups.map((group) => group.key)).toEqual(['2026-06-14', 'unknown'])
    expect(groups[0].trades.map((trade) => trade.id)).toEqual(['iso'])
    expect(groups[1].label).toBe('Дата не определена')
  })

  it('sorts trades inside the same closing date from latest to earliest', () => {
    const groups = groupTradesByClosedDate([
      createTrade('later', '14.07.2026 12:00', '14.07.2026 18:00'),
      createTrade('earlier', '14.07.2026 08:00', '14.07.2026 09:00'),
    ])

    expect(groups[0].trades.map((trade) => trade.id)).toEqual(['later', 'earlier'])
  })
})

function createTrade(id: string, startedAt: string, endedAt: string): SavedTrade {
  const analysis = {
    future: {
      symbol: 'BTCUSDT',
      side: 'short' as const,
      startedAt,
      endedAt,
      volumeUsdt: 1000,
      realizedPnlUsdt: 20,
    },
    spot: { volumeUsdt: 1000, rawPnlUsdt: 5 },
    legs: [],
    conflicts: [],
    notes: [],
  }

  return {
    id,
    savedAt: '2026-07-14T12:00:00.000Z',
    instructions: '',
    analysis,
    calculation: calculateTrade(analysis),
  }
}
