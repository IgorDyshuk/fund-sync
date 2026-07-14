import type { SavedTrade } from '../types/app'

export type TradeHistoryGroup = {
  key: string
  label: string
  trades: SavedTrade[]
}

export function groupTradesByClosedDate(history: SavedTrade[]): TradeHistoryGroup[] {
  const grouped = new Map<string, SavedTrade[]>()

  for (const trade of history) {
    const closedAt = getTradeClosedAt(trade)
    const key = closedAt ? getDateKey(closedAt) : 'unknown'
    const current = grouped.get(key) ?? []
    current.push(trade)
    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .map(([key, trades]) => ({
      key,
      label: key === 'unknown' ? 'Дата не определена' : formatHistoryDate(trades),
      trades: trades.sort(compareTradesByClosedAt),
    }))
    .sort((first, second) => {
      if (first.key === 'unknown') {
        return 1
      }
      if (second.key === 'unknown') {
        return -1
      }
      return second.key.localeCompare(first.key)
    })
}

export function getTradeClosedAt(trade: SavedTrade): Date | null {
  const dates = trade.calculation.legs
    .map((leg) => parseTradeDate(leg.endedAt))
    .filter(isDate)

  if (dates.length === 0) {
    return null
  }

  return dates.sort((first, second) => second.getTime() - first.getTime())[0]
}

function formatHistoryDate(trades: SavedTrade[]): string {
  const closedAt = getTradeClosedAt(trades[0])
  if (!closedAt) {
    return 'Дата не определена'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(closedAt)
}

function compareTradesByClosedAt(first: SavedTrade, second: SavedTrade): number {
  const firstDate = getTradeClosedAt(first)?.getTime() ?? Number.NEGATIVE_INFINITY
  const secondDate = getTradeClosedAt(second)?.getTime() ?? Number.NEGATIVE_INFINITY

  return secondDate - firstDate
}

function getDateKey(date: Date): string {
  return [date.getFullYear(), date.getMonth(), date.getDate()]
    .map((value) => String(value).padStart(2, '0'))
    .join('-')
}

function parseTradeDate(value: string): Date | null {
  if (!value || value === '-') {
    return null
  }

  const normalized = value.trim()
  const ruMatch = normalized.match(
    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/,
  )
  if (ruMatch) {
    const [, day, month, year, hours, minutes, seconds = '0'] = ruMatch
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    )
  }

  const isoMatch = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  )
  if (isoMatch) {
    const [, year, month, day, hours, minutes, seconds = '0'] = isoMatch
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
    )
  }

  return null
}

function isDate(value: Date | null): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}
