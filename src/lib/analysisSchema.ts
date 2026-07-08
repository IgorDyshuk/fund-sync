import { z } from 'zod'
import { parseNumericValue } from './tradeCalculator'
import type { MarketType, SpotMethod, TradeSide } from './tradeCalculator'

const numberField = z
  .preprocess((value) => parseNumericValue(value), z.number().finite().nullable())
  .catch(null)

const textField = z
  .preprocess((value) => {
    if (value === null || value === undefined) {
      return null
    }

    const normalized = String(value).trim()
    return normalized || null
  }, z.string().nullable())
  .catch(null)

const sideField = z
  .preprocess((value) => {
    const normalized = String(value ?? '').trim().toLowerCase()
    if (['long', 'лонг', 'buy'].includes(normalized)) {
      return 'long'
    }
    if (['short', 'шорт', 'sell'].includes(normalized)) {
      return 'short'
    }
    return 'unknown'
  }, z.enum(['long', 'short', 'unknown']))
  .catch('unknown')

const methodField = z
  .preprocess((value) => {
    const normalized = String(value ?? '').trim().toLowerCase()
    if (['balance_delta', 'balance', 'balances', 'delta'].includes(normalized)) {
      return 'balance_delta'
    }
    if (['orders', 'order_history'].includes(normalized)) {
      return 'orders'
    }
    if (['manual', 'text'].includes(normalized)) {
      return 'manual'
    }
    return 'unknown'
  }, z.enum(['balance_delta', 'orders', 'manual', 'unknown']))
  .catch('unknown')

const marketTypeField = z
  .preprocess((value) => {
    const normalized = String(value ?? '').trim().toLowerCase()
    if (['futures', 'future', 'фьючерс', 'фьючерсы', 'perp', 'perpetual'].includes(normalized)) {
      return 'futures'
    }
    if (['spot', 'спот'].includes(normalized)) {
      return 'spot'
    }
    return 'unknown'
  }, z.enum(['futures', 'spot', 'unknown']))
  .catch('unknown')

export const conflictChoiceSchema = z.object({
  id: textField.optional(),
  label: textField.optional(),
  source: textField.optional(),
  value: z.unknown(),
})

export const conflictSchema = z.object({
  field: z.string().min(1),
  label: textField.optional(),
  message: textField.optional(),
  choices: z.array(conflictChoiceSchema).default([]),
})

const futureSchema = z.object({
  symbol: textField.optional(),
  side: sideField.optional(),
  startedAt: textField.optional(),
  endedAt: textField.optional(),
  volumeUsdt: numberField.optional(),
  roiPercent: numberField.optional(),
  realizedPnlUsdt: numberField.optional(),
})

const spotSchema = z.object({
  method: methodField.optional(),
  volumeUsdt: numberField.optional(),
  rawPnlUsdt: numberField.optional(),
  pnlUsdt: numberField.optional(),
  balanceBeforeUsdt: numberField.optional(),
  balanceAfterUsdt: numberField.optional(),
  revenueUsdt: numberField.optional(),
  costUsdt: numberField.optional(),
})

const legSchema = z.object({
  id: textField.optional(),
  label: textField.optional(),
  type: marketTypeField.optional(),
  symbol: textField.optional(),
  side: sideField.optional(),
  startedAt: textField.optional(),
  endedAt: textField.optional(),
  volumeUsdt: numberField.optional(),
  pnlUsdt: numberField.optional(),
  realizedPnlUsdt: numberField.optional(),
  rawPnlUsdt: numberField.optional(),
  roiPercent: numberField.optional(),
  method: methodField.optional(),
  balanceBeforeUsdt: numberField.optional(),
  balanceAfterUsdt: numberField.optional(),
  revenueUsdt: numberField.optional(),
  costUsdt: numberField.optional(),
})

export const analysisResponseSchema = z.object({
  bundleType: textField.optional(),
  legs: z.array(legSchema).catch([]).default([]),
  future: futureSchema.default({}),
  spot: spotSchema.default({}),
  conflicts: z.array(conflictSchema).default([]),
  confidence: numberField.optional(),
  notes: z.array(z.string()).catch([]).default([]),
})

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>
export type AnalysisConflict = z.infer<typeof conflictSchema>
export type AnalysisConflictChoice = z.infer<typeof conflictChoiceSchema>

export type NormalizedAnalysisResponse = AnalysisResponse & {
  bundleType?: string | null
  legs: Array<AnalysisResponse['legs'][number] & { type?: MarketType; side?: TradeSide }>
  future: AnalysisResponse['future'] & { side?: TradeSide }
  spot: AnalysisResponse['spot'] & { method?: SpotMethod }
}
