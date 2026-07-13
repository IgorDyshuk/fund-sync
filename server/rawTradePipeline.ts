type TradeSide = 'long' | 'short' | 'unknown'
type SpotMethod = 'balance_delta' | 'orders' | 'manual' | 'unknown'
type MarketType = 'futures' | 'spot' | 'unknown'
type TransactionType = 'buy' | 'sell' | 'deposit' | 'withdrawal'

type ConflictChoice = {
  id: string | null
  label: string | null
  source: string | null
  value: number | string | null
}

type AnalysisConflict = {
  field: string
  label: string | null
  message: string | null
  choices: ConflictChoice[]
}

type AnalysisLeg = {
  id: string | null
  label: string | null
  type: MarketType
  symbol: string | null
  side: TradeSide
  startedAt: string | null
  endedAt: string | null
  volumeUsdt: number | null
  pnlUsdt: number | null
  realizedPnlUsdt: number | null
  rawPnlUsdt: number | null
  roiPercent: number | null
  method: SpotMethod
  balanceBeforeUsdt: number | null
  balanceAfterUsdt: number | null
  revenueUsdt: number | null
  costUsdt: number | null
}

export type AnalysisResponseContract = {
  bundleType: string | null
  spread: {
    entry: number | null
    exit: number | null
  }
  legs: AnalysisLeg[]
  future: {
    symbol: string | null
    side: TradeSide
    startedAt: string | null
    endedAt: string | null
    volumeUsdt: number | null
    roiPercent: number | null
    realizedPnlUsdt: number | null
  }
  spot: {
    method: SpotMethod
    volumeUsdt: number | null
    rawPnlUsdt: number | null
    pnlUsdt: number | null
    balanceBeforeUsdt: number | null
    balanceAfterUsdt: number | null
    revenueUsdt: number | null
    costUsdt: number | null
  }
  conflicts: AnalysisConflict[]
  confidence: number | null
  notes: string[]
}

export type RawTransaction = {
  type: TransactionType
  symbol: string | null
  amount: number | null
  price: number | null
  totalUsdt: number | null
}

export type RawFuturesLeg = {
  symbol: string | null
  side: TradeSide
  realizedPnlUsdt: number | null
  volumeUsdt: number | null
  coinAmount: number | null
  entryPrice: number | null
  exitPrice: number | null
  startedAt: string | null
  endedAt: string | null
  roiPercent: number | null
}

export type RawExtractionResult = {
  bundleType: string | null
  futuresLegs: RawFuturesLeg[]
  futuresLeg: RawFuturesLeg | null
  spotData: {
    method: SpotMethod
    balanceBeforeUsdt: number | null
    balanceAfterUsdt: number | null
    extractedTransactions: RawTransaction[]
    ignoredTransactions: RawTransaction[]
    manualPnl: number | null
  }
  conflicts: AnalysisConflict[]
  confidence: number | null
  notes: string[]
}

type ManualSpotOverride = {
  amount: number
  mode: 'raw' | 'signed'
}

export type ManualSpreadPrices = {
  spotBuyPrice: number | null
  spotSellPrice: number | null
  spotVolumeUsdt: number | null
  spotRevenueUsdt: number | null
  spotCostUsdt: number | null
  futuresEntryPrice: number | null
  futuresExitPrice: number | null
}

type SpreadCalculation = {
  entry: number | null
  exit: number | null
  notes: string[]
}

type SpotCalculation = {
  method: SpotMethod
  volumeUsdt: number | null
  rawPnlUsdt: number | null
  pnlUsdt: number | null
  balanceBeforeUsdt: number | null
  balanceAfterUsdt: number | null
  revenueUsdt: number | null
  costUsdt: number | null
  conflicts: AnalysisConflict[]
  notes: string[]
}

const spotPnlPatterns = [
  /(?<phrase>(?:спот|spot)[^\n.;]{0,80}?)(?<value>[+-]\s*\d[\d\s.,]*)/iu,
  /(?<phrase>(?:спот|spot)[^\n.;]{0,80}?(?:pnl|пнл|итог|результат|считать|вышел\p{L}*|вышло|получил\p{L}*|плюс|минус|прибыл\p{L}*|убыт\p{L}*)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
  /(?<phrase>(?:pnl|пнл|итог|результат|плюс|минус|прибыл\p{L}*|убыт\p{L}*)[^\n.;]{0,50}?(?:по\s+)?(?:спот|spot)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
  /(?<phrase>(?:spot\s+pnl|pnl\s+spot)[^\n.;]{0,30}?(?<value>[+-]?\s*\d[\d\s.,]*))/iu,
]

const spotSummaryPnlPattern =
  /(?:^|\n)\s*(?:[-*]\s*)?(?<phrase>(?:pnl|пнл|profit|прибыл\p{L}*|результат)(?:\s*\([^\n)]*\))?)[^\n.;:]{0,20}[:=]\s*(?<value>[+-]?\s*\d[\d\s.,]*)/iu

export function createRawExtractionPrompt({
  instructions,
  imageCount,
  analysisQuality,
}: {
  instructions: string
  imageCount: number
  analysisQuality: 'balanced' | 'smart'
}) {
  return `
Analyze screenshots for one crypto trade bundle. You are Stage 1 of a two-stage pipeline.

Files:
- total screenshots: ${imageCount}
- analysis quality: ${analysisQuality}

Manual instructions have highest priority for extraction:
${instructions || '-'}

You are a strict data extraction engine for crypto screenshots. Your ONLY job is to extract raw numbers and classify rows. Do NOT calculate total PnL, spot hedge sign, net result, net ROI, or final bundle totals.
${analysisQuality === 'smart' ? 'Smart mode is enabled: spend extra attention on spot order rows, balance chronology, and unrelated transfer/deposit/withdrawal rows. Cross-check visible labels before classifying any value.' : ''}

Extraction rules:
- Do not rely on upload order. Classify each screenshot by visible content.
- Extract every distinct futures position into futuresLegs[]. Use futuresLeg for the primary first futures leg for legacy compatibility.
- For futures, extract only visible/raw fields: symbol, side, realizedPnlUsdt, volumeUsdt, coinAmount, entryPrice, exitPrice, startedAt, endedAt, roiPercent.
- For futures, entryPrice and exitPrice mean the visible average opening and closing prices. Extract them exactly when visible; never calculate them from PnL.
- If futures volumeUsdt is not visible but quantity/size/amount in coins and entryPrice are visible, set coinAmount and entryPrice; Stage 2 will calculate volumeUsdt as abs(coinAmount * entryPrice).
- For spot order history, extract EACH filled order row into spotData.extractedTransactions[] with type "buy" or "sell".
- When OCR includes prepared layout rows, use one prepared row as one order. Do not combine amount, price, and totalUsdt from different rows.
- For spot balances, extract balanceBeforeUsdt and balanceAfterUsdt only when chronology is visible or clearly inferable from timestamps/status bars.
- CRITICAL: deposits, withdrawals, transfers, funding, internal moves, and unrelated account operations must go ONLY to spotData.ignoredTransactions[]. Do NOT include them in extractedTransactions[].
- If the user provides a manual spot instruction like "спот считать 15.54", set spotData.manualPnl to that number. Do not calculate hedge sign.
- If a number is unclear, use null and add a note. Do not estimate.
- If multiple source values may be valid, add a conflict candidate instead of choosing silently.
- Return strictly the requested JSON schema. No markdown, no prose outside JSON.
`.trim()
}

export function createRawExtractionPromptFromOcrText({
  instructions,
  ocrText,
  imageCount,
  analysisQuality,
}: {
  instructions: string
  ocrText: string
  imageCount: number
  analysisQuality: 'balanced' | 'smart'
}) {
  return `
Parse OCR data for one crypto trade bundle. You are Stage 1 of a two-stage pipeline.
Screenshots: ${imageCount}. Return raw facts only; never calculate final PnL.

Manual instructions have highest priority for extraction:
${instructions || '-'}

Prepared OCR data:
${ocrText || '-'}

Do not calculate spot hedge sign, net result, net ROI, or final bundle totals.
${analysisQuality === 'smart' ? 'Smart mode is enabled: spend extra attention on reconstructing table rows from OCR text where columns may be split or reordered.' : ''}

Extraction rules:
- Treat each "--- OCR screenshot N ---" section as one screenshot source.
- Classify content by visible labels and nearby text, not by upload order.
- Use Raw OCR text to verify labels and numbers, and Prepared layout rows to pair values from the same visual row. Neither source should be ignored.
- Extract every distinct futures position into futuresLegs[]. Use futuresLeg for the primary first futures leg for legacy compatibility.
- For futures, extract only raw fields visible in OCR: symbol, side, realizedPnlUsdt, volumeUsdt, coinAmount, entryPrice, exitPrice, startedAt, endedAt, roiPercent.
- For futures, entryPrice and exitPrice mean the visible average opening and closing prices. Extract them exactly when visible; never calculate them from PnL.
- If futures volumeUsdt is not visible but quantity/size/amount in coins and entryPrice are visible, set coinAmount and entryPrice; Stage 2 will calculate volumeUsdt as abs(coinAmount * entryPrice).
- For spot order history, reconstruct filled order rows from OCR text and put each row into spotData.extractedTransactions[] with type "buy" or "sell".
- Prefer the prepared layout rows over raw OCR text when pairing amount, price, and totalUsdt. Do not combine values from different rows.
- Treat amount as base-asset quantity and price as quote price per coin. If totalUsdt is not visible but amount and price are present in the same row, keep both values so Stage 2 can derive the total.
- For spot balances, extract balanceBeforeUsdt and balanceAfterUsdt only when chronology is visible or clearly inferable.
- CRITICAL: deposits, withdrawals, transfers, funding, internal moves, and unrelated account operations must go ONLY to spotData.ignoredTransactions[]. Do NOT include them in extractedTransactions[].
- If the user provides a manual spot instruction like "спот считать 15.54", set spotData.manualPnl to that number. Do not calculate hedge sign.
- If table columns are ambiguous, use null or conflicts instead of guessing.
- Return strictly the requested JSON schema. No markdown, no prose outside JSON.
`.trim()
}

export const rawExtractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bundleType: nullableString(),
    futuresLegs: {
      type: 'array',
      items: rawFuturesLegJsonSchema(),
    },
    futuresLeg: {
      anyOf: [rawFuturesLegJsonSchema(), { type: 'null' }],
    },
    spotData: {
      type: 'object',
      additionalProperties: false,
      properties: {
        method: {
          type: 'string',
          enum: ['orders', 'balance_delta', 'manual', 'unknown'],
        },
        balanceBeforeUsdt: nullableNumber(),
        balanceAfterUsdt: nullableNumber(),
        extractedTransactions: {
          type: 'array',
          items: rawTransactionJsonSchema(),
        },
        ignoredTransactions: {
          type: 'array',
          items: rawTransactionJsonSchema(),
        },
        manualPnl: nullableNumber(),
      },
      required: [
        'method',
        'balanceBeforeUsdt',
        'balanceAfterUsdt',
        'extractedTransactions',
        'ignoredTransactions',
        'manualPnl',
      ],
    },
    conflicts: {
      type: 'array',
      items: conflictJsonSchema(),
    },
    confidence: nullableNumber(),
    notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'bundleType',
    'futuresLegs',
    'futuresLeg',
    'spotData',
    'conflicts',
    'confidence',
    'notes',
  ],
}

export function buildAnalysisFromRawExtraction(
  rawInput: unknown,
  options: { instructions?: string } = {},
): AnalysisResponseContract {
  const raw = normalizeRawExtraction(rawInput)
  const futuresLegs = getRawFuturesLegs(raw)
  const futuresAnalysisLegs = futuresLegs.map((leg, index) =>
    rawFuturesToAnalysisLeg(leg, index, futuresLegs.length),
  )
  const futuresPnlContext = getFuturesPnlContext(futuresLegs)
  const spotCalculation = calculateSpot(raw.spotData, {
    instructions: options.instructions ?? '',
    futuresPnlContext,
    spotLegIndex: futuresAnalysisLegs.length,
  })
  const spotSymbol = getSpotSymbol(raw.spotData, futuresLegs)
  const spotLeg = shouldIncludeSpotLeg(spotCalculation)
    ? rawSpotToAnalysisLeg(spotCalculation, spotSymbol)
    : null
  const legs = spotLeg ? [...futuresAnalysisLegs, spotLeg] : futuresAnalysisLegs
  const primaryFuture = futuresLegs[0] ?? null
  const spread = calculateSpread(futuresLegs, raw.spotData, options.instructions ?? '')
  const notes = [
    ...raw.notes,
    ...spotCalculation.notes,
    ...createFuturesVolumeNotes(futuresLegs),
    ...spread.notes,
  ]
  const conflicts = [...raw.conflicts, ...spotCalculation.conflicts]

  return {
    bundleType: getBundleType(legs, raw.bundleType),
    spread: {
      entry: spread.entry,
      exit: spread.exit,
    },
    legs,
    future: {
      symbol: primaryFuture?.symbol ?? null,
      side: primaryFuture?.side ?? 'unknown',
      startedAt: primaryFuture?.startedAt ?? null,
      endedAt: primaryFuture?.endedAt ?? null,
      volumeUsdt: primaryFuture ? getFuturesVolumeUsdt(primaryFuture) : null,
      roiPercent: primaryFuture?.roiPercent ?? null,
      realizedPnlUsdt: primaryFuture?.realizedPnlUsdt ?? null,
    },
    spot: {
      method: spotCalculation.method,
      volumeUsdt: spotCalculation.volumeUsdt,
      rawPnlUsdt: spotCalculation.rawPnlUsdt,
      pnlUsdt: spotCalculation.pnlUsdt,
      balanceBeforeUsdt: spotCalculation.balanceBeforeUsdt,
      balanceAfterUsdt: spotCalculation.balanceAfterUsdt,
      revenueUsdt: spotCalculation.revenueUsdt,
      costUsdt: spotCalculation.costUsdt,
    },
    conflicts,
    confidence: raw.confidence,
    notes: Array.from(new Set(notes.filter(Boolean))),
  }
}

export function normalizeRawExtraction(rawInput: unknown): RawExtractionResult {
  const raw = asRecord(rawInput)
  const spotData = asRecord(raw.spotData)
  const futuresLegs = normalizeArray(raw.futuresLegs)
    .map(normalizeRawFuturesLeg)
    .filter((leg): leg is RawFuturesLeg => leg !== null)
  const legacyFuture = normalizeRawFuturesLeg(raw.futuresLeg)
  const normalizedFuturesLegs =
    futuresLegs.length > 0 ? futuresLegs : legacyFuture ? [legacyFuture] : []
  const primaryFuture = legacyFuture ?? normalizedFuturesLegs[0] ?? null

  return {
    bundleType: normalizeString(raw.bundleType),
    futuresLegs: normalizedFuturesLegs,
    futuresLeg: primaryFuture,
    spotData: {
      method: normalizeSpotMethod(spotData.method),
      balanceBeforeUsdt: normalizeNumber(spotData.balanceBeforeUsdt),
      balanceAfterUsdt: normalizeNumber(spotData.balanceAfterUsdt),
      extractedTransactions: normalizeArray(spotData.extractedTransactions)
        .map(normalizeRawTransaction)
        .filter((transaction): transaction is RawTransaction => transaction !== null),
      ignoredTransactions: normalizeArray(spotData.ignoredTransactions)
        .map(normalizeRawTransaction)
        .filter((transaction): transaction is RawTransaction => transaction !== null),
      manualPnl: normalizeNumber(spotData.manualPnl),
    },
    conflicts: normalizeArray(raw.conflicts)
      .map(normalizeConflict)
      .filter((conflict): conflict is AnalysisConflict => conflict !== null),
    confidence: normalizeNumber(raw.confidence),
    notes: normalizeArray(raw.notes)
      .map((note) => normalizeString(note))
      .filter((note): note is string => Boolean(note)),
  }
}

function calculateSpot(
  spotData: RawExtractionResult['spotData'],
  options: {
    instructions: string
    futuresPnlContext: number | null
    spotLegIndex: number
  },
): SpotCalculation {
  const manualOverride = parseManualSpotOverride(options.instructions)
  const manualSpotSummary = parseManualSpreadPrices(options.instructions)
  const manualPnl = manualOverride?.amount ?? normalizeNumber(spotData.manualPnl)
  const manualIsSigned = manualOverride?.mode === 'signed' || (manualOverride ? false : isNegative(manualPnl))
  const orderTotals = getOrderTotals(spotData.extractedTransactions)
  const ordersRawPnl = getOrdersRawPnl(orderTotals)
  const balanceRawPnl = getBalanceRawPnl(spotData)
  const method = getSpotCalculationMethod({
    rawMethod: spotData.method,
    manualPnl,
    ordersRawPnl,
    balanceRawPnl,
  })
  const rawPnlUsdt = getSelectedRawSpotPnl({
    method,
    manualPnl,
    ordersRawPnl,
    balanceRawPnl,
  })
  const manualSignedPnl = manualIsSigned && manualPnl !== null ? manualPnl : null
  const pnlUsdt =
    manualOverride?.mode === 'raw'
      ? null
      : manualSignedPnl ??
        (rawPnlUsdt !== null ? getSignedSpotPnl(options.futuresPnlContext, rawPnlUsdt) : null)
  const conflicts = createSpotSourceConflicts({
    ordersRawPnl,
    balanceRawPnl,
    spotLegIndex: options.spotLegIndex,
  })
  const notes = createSpotNotes(
    spotData,
    orderTotals,
    ordersRawPnl,
    balanceRawPnl,
  )
  const manualSummaryNotes = createManualSpotSummaryNotes(manualSpotSummary)

  return {
    method,
    volumeUsdt: manualSpotSummary.spotVolumeUsdt ?? orderTotals.volumeUsdt,
    rawPnlUsdt,
    pnlUsdt,
    balanceBeforeUsdt: spotData.balanceBeforeUsdt,
    balanceAfterUsdt: spotData.balanceAfterUsdt,
    revenueUsdt: manualSpotSummary.spotRevenueUsdt ?? orderTotals.revenueUsdt,
    costUsdt: manualSpotSummary.spotCostUsdt ?? orderTotals.costUsdt,
    conflicts,
    notes: [...notes, ...manualSummaryNotes],
  }
}

function createManualSpotSummaryNotes(prices: ManualSpreadPrices) {
  const notes: string[] = []

  if (prices.spotVolumeUsdt !== null) {
    notes.push(`Ручной объем спота: ${formatUsdt(prices.spotVolumeUsdt)}.`)
  }

  if (prices.spotRevenueUsdt !== null && prices.spotCostUsdt !== null) {
    notes.push(
      `Ручной spot summary: выручка ${formatUsdt(prices.spotRevenueUsdt)}, затраты ${formatUsdt(prices.spotCostUsdt)}.`,
    )
  }

  return notes
}

function rawFuturesToAnalysisLeg(
  leg: RawFuturesLeg,
  index: number,
  futuresCount: number,
): AnalysisLeg {
  return {
    id: `future-${index + 1}`,
    label: getFutureLabel(leg, index, futuresCount),
    type: 'futures',
    symbol: leg.symbol,
    side: leg.side,
    startedAt: leg.startedAt,
    endedAt: leg.endedAt,
    volumeUsdt: getFuturesVolumeUsdt(leg),
    pnlUsdt: leg.realizedPnlUsdt,
    realizedPnlUsdt: leg.realizedPnlUsdt,
    rawPnlUsdt: null,
    roiPercent: leg.roiPercent,
    method: 'unknown',
    balanceBeforeUsdt: null,
    balanceAfterUsdt: null,
    revenueUsdt: null,
    costUsdt: null,
  }
}

function rawSpotToAnalysisLeg(
  spotCalculation: SpotCalculation,
  symbol: string | null,
): AnalysisLeg {
  return {
    id: 'spot-main',
    label: 'Спот',
    type: 'spot',
    symbol,
    side: 'unknown',
    startedAt: null,
    endedAt: null,
    volumeUsdt: spotCalculation.volumeUsdt,
    pnlUsdt: spotCalculation.pnlUsdt,
    realizedPnlUsdt: null,
    rawPnlUsdt: spotCalculation.rawPnlUsdt,
    roiPercent: null,
    method: spotCalculation.method,
    balanceBeforeUsdt: spotCalculation.balanceBeforeUsdt,
    balanceAfterUsdt: spotCalculation.balanceAfterUsdt,
    revenueUsdt: spotCalculation.revenueUsdt,
    costUsdt: spotCalculation.costUsdt,
  }
}

function getRawFuturesLegs(raw: RawExtractionResult) {
  if (raw.futuresLegs.length > 0) {
    return raw.futuresLegs
  }

  return raw.futuresLeg ? [raw.futuresLeg] : []
}

function getFuturesPnlContext(futuresLegs: RawFuturesLeg[]) {
  if (futuresLegs.length === 0) {
    return null
  }

  const pnls = futuresLegs.map((leg) => normalizeNumber(leg.realizedPnlUsdt))
  if (pnls.some((pnl) => pnl === null)) {
    return null
  }

  return pnls.reduce<number>((total, pnl) => total + (pnl ?? 0), 0)
}

function getFuturesVolumeUsdt(leg: RawFuturesLeg) {
  if (leg.volumeUsdt !== null && leg.volumeUsdt !== 0) {
    return Math.abs(leg.volumeUsdt)
  }

  if (leg.coinAmount !== null && leg.entryPrice !== null && leg.entryPrice !== 0) {
    return Math.abs(leg.coinAmount * leg.entryPrice)
  }

  return null
}

function getOrderTotals(transactions: RawTransaction[]) {
  const buyTransactions = transactions.filter(isCompleteBuyOrder)
  const sellTransactions = transactions.filter(isCompleteSellOrder)
  const rejectedTransactions = transactions.filter(
    (transaction) =>
      (transaction.type === 'buy' || transaction.type === 'sell') &&
      isArithmeticConflict(transaction),
  ).length
  const costUsdt =
    buyTransactions.length > 0
      ? buyTransactions.reduce((total, transaction) => total + (getTransactionTotalUsdt(transaction) ?? 0), 0)
      : null
  const revenueUsdt =
    sellTransactions.length > 0
      ? sellTransactions.reduce((total, transaction) => total + (getTransactionTotalUsdt(transaction) ?? 0), 0)
      : null
  const volumeUsdt =
    costUsdt !== null || revenueUsdt !== null
      ? Math.max(Math.abs(costUsdt ?? 0), Math.abs(revenueUsdt ?? 0))
      : null
  const derivedTransactions = transactions.filter(
    (transaction) =>
      (transaction.type === 'buy' || transaction.type === 'sell') &&
      transaction.totalUsdt === null &&
      getTransactionTotalUsdt(transaction) !== null,
  ).length

  return {
    costUsdt,
    revenueUsdt,
    volumeUsdt,
    rejectedTransactions,
    derivedTransactions,
  }
}

function getOrdersRawPnl(orderTotals: {
  costUsdt: number | null
  revenueUsdt: number | null
}) {
  if (orderTotals.costUsdt === null || orderTotals.revenueUsdt === null) {
    return null
  }

  return Math.abs(orderTotals.revenueUsdt - orderTotals.costUsdt)
}

function getBalanceRawPnl(spotData: RawExtractionResult['spotData']) {
  if (spotData.balanceAfterUsdt === null || spotData.balanceBeforeUsdt === null) {
    return null
  }

  return Math.abs(spotData.balanceAfterUsdt - spotData.balanceBeforeUsdt)
}

function getSpotCalculationMethod({
  rawMethod,
  manualPnl,
  ordersRawPnl,
  balanceRawPnl,
}: {
  rawMethod: SpotMethod
  manualPnl: number | null
  ordersRawPnl: number | null
  balanceRawPnl: number | null
}): SpotMethod {
  if (manualPnl !== null) {
    return 'manual'
  }

  if (rawMethod === 'orders' && ordersRawPnl !== null) {
    return 'orders'
  }

  if (rawMethod === 'balance_delta' && balanceRawPnl !== null) {
    return 'balance_delta'
  }

  if (ordersRawPnl !== null) {
    return 'orders'
  }

  if (balanceRawPnl !== null) {
    return 'balance_delta'
  }

  return rawMethod
}

function getSelectedRawSpotPnl({
  method,
  manualPnl,
  ordersRawPnl,
  balanceRawPnl,
}: {
  method: SpotMethod
  manualPnl: number | null
  ordersRawPnl: number | null
  balanceRawPnl: number | null
}) {
  if (manualPnl !== null) {
    return Math.abs(manualPnl)
  }

  if (method === 'orders') {
    return ordersRawPnl
  }

  if (method === 'balance_delta') {
    return balanceRawPnl
  }

  return ordersRawPnl ?? balanceRawPnl
}

function getSignedSpotPnl(
  futuresPnl: number | null,
  rawSpotPnl: number | null,
) {
  if (futuresPnl === null || rawSpotPnl === null) {
    return null
  }

  if (futuresPnl > 0) {
    return -Math.abs(rawSpotPnl)
  }

  if (futuresPnl < 0) {
    return Math.abs(rawSpotPnl)
  }

  return null
}

function createSpotSourceConflicts({
  ordersRawPnl,
  balanceRawPnl,
  spotLegIndex,
}: {
  ordersRawPnl: number | null
  balanceRawPnl: number | null
  spotLegIndex: number
}) {
  if (ordersRawPnl === null || balanceRawPnl === null) {
    return []
  }

  const base = Math.max(Math.abs(ordersRawPnl), Math.abs(balanceRawPnl), 1)
  const differenceRatio = Math.abs(ordersRawPnl - balanceRawPnl) / base

  if (differenceRatio <= 0.01) {
    return []
  }

  return [
    {
      field: `legs.${spotLegIndex}.rawPnlUsdt`,
      label: 'PnL спота',
      message:
        'PnL по ордерам и дельте баланса отличается больше чем на 1%. Выбери источник для расчета.',
      choices: [
        {
          id: 'orders',
          label: `${formatUsdt(ordersRawPnl)} по ордерам`,
          source: 'orders',
          value: ordersRawPnl,
        },
        {
          id: 'balance-delta',
          label: `${formatUsdt(balanceRawPnl)} по балансу`,
          source: 'balance_delta',
          value: balanceRawPnl,
        },
      ],
    },
  ]
}

function createSpotNotes(
  spotData: RawExtractionResult['spotData'],
  orderTotals: {
    costUsdt: number | null
    revenueUsdt: number | null
    rejectedTransactions: number
    derivedTransactions: number
  },
  ordersRawPnl: number | null,
  balanceRawPnl: number | null,
) {
  const notes: string[] = []
  const ignoredCount = spotData.ignoredTransactions.length

  if (ignoredCount > 0) {
    notes.push(`Игнорировано переводов/депозитов/выводов: ${ignoredCount}.`)
  }

  if (orderTotals.rejectedTransactions > 0) {
    notes.push(
      `Исключено ордеров из-за расхождения amount × price и totalUsdt: ${orderTotals.rejectedTransactions}.`,
    )
  }

  if (orderTotals.derivedTransactions > 0) {
    notes.push(
      `Рассчитан totalUsdt по amount × price для ордеров: ${orderTotals.derivedTransactions}.`,
    )
  }

  if (spotData.extractedTransactions.length > 0 && ordersRawPnl === null) {
    notes.push(
      'Спотовые ордера извлечены неполно: для PnL нужны заполненные buy и sell totalUsdt.',
    )
  }

  if (
    ordersRawPnl !== null &&
    balanceRawPnl !== null &&
    orderTotals.costUsdt !== null &&
    orderTotals.revenueUsdt !== null
  ) {
    notes.push(
      `Спот по ордерам: выручка ${formatUsdt(orderTotals.revenueUsdt)}, затраты ${formatUsdt(orderTotals.costUsdt)}.`,
    )
  }

  return notes
}

function createFuturesVolumeNotes(futuresLegs: RawFuturesLeg[]) {
  return futuresLegs
    .filter(
      (leg) =>
        leg.volumeUsdt === null &&
        leg.coinAmount !== null &&
        leg.entryPrice !== null,
    )
    .map((leg, index) => {
      const label = leg.symbol ?? `фьючерс ${index + 1}`
      return `Объем ${label} рассчитан из количества монет и цены входа.`
    })
}

function calculateSpread(
  futuresLegs: RawFuturesLeg[],
  spotData: RawExtractionResult['spotData'],
  instructions: string,
): SpreadCalculation {
  const manualPrices = parseManualSpreadPrices(instructions)
  const adjustedFuturesLegs = futuresLegs.map((leg, index) => {
    if (index !== 0) {
      return leg
    }

    return {
      ...leg,
      entryPrice: manualPrices.futuresEntryPrice ?? leg.entryPrice,
      exitPrice: manualPrices.futuresExitPrice ?? leg.exitPrice,
    }
  })

  const longLegs = adjustedFuturesLegs.filter((leg) => leg.side === 'long')
  const shortLegs = adjustedFuturesLegs.filter((leg) => leg.side === 'short')

  if (longLegs.length > 0 && shortLegs.length > 0) {
    const longEntry = getWeightedFuturesPrice(longLegs, 'entryPrice')
    const shortEntry = getWeightedFuturesPrice(shortLegs, 'entryPrice')
    const longExit = getWeightedFuturesPrice(longLegs, 'exitPrice')
    const shortExit = getWeightedFuturesPrice(shortLegs, 'exitPrice')
    const entry = getSignedSpreadPercent(
      longEntry,
      shortEntry,
      longEntry !== null && shortEntry !== null && longEntry < shortEntry,
    )
    const exit = getSignedSpreadPercent(
      longExit,
      shortExit,
      longExit !== null && shortExit !== null && longExit > shortExit,
    )

    return {
      entry,
      exit,
      notes: createFuturesSpreadNotes({
        entry,
        exit,
        longEntry,
        shortEntry,
        longExit,
        shortExit,
      }),
    }
  }

  const primaryFuture = adjustedFuturesLegs[0] ?? null
  if (!primaryFuture || primaryFuture.side !== 'short') {
    return { entry: null, exit: null, notes: [] }
  }

  const spotEntryPrice =
    manualPrices.spotBuyPrice ?? getWeightedAveragePrice(spotData.extractedTransactions, 'buy')
  const spotExitPrice =
    manualPrices.spotSellPrice ?? getWeightedAveragePrice(spotData.extractedTransactions, 'sell')
  const entry = getSignedSpreadPercent(
    spotEntryPrice,
    primaryFuture.entryPrice,
    spotEntryPrice !== null && primaryFuture.entryPrice !== null && spotEntryPrice < primaryFuture.entryPrice,
  )
  const exit = getSignedSpreadPercent(
    spotExitPrice,
    primaryFuture.exitPrice,
    spotExitPrice !== null && primaryFuture.exitPrice !== null && spotExitPrice > primaryFuture.exitPrice,
  )

  return {
    entry,
    exit,
    notes: createFuturesSpotSpreadNotes({
      entry,
      exit,
      futuresEntry: primaryFuture.entryPrice,
      spotBuy: spotEntryPrice,
      spotSell: spotExitPrice,
      futuresExit: primaryFuture.exitPrice,
      manualPrices,
    }),
  }
}

function createFuturesSpotSpreadNotes({
  entry,
  exit,
  futuresEntry,
  spotBuy,
  spotSell,
  futuresExit,
  manualPrices,
}: {
  entry: number | null
  exit: number | null
  futuresEntry: number | null
  spotBuy: number | null
  spotSell: number | null
  futuresExit: number | null
  manualPrices: ManualSpreadPrices
}) {
  const notes: string[] = []
  const spotBuySource = manualPrices.spotBuyPrice !== null ? 'ручная цена' : 'средняя по spot buy'
  const spotSellSource = manualPrices.spotSellPrice !== null ? 'ручная цена' : 'средняя по spot sell'

  if (entry !== null && futuresEntry !== null && spotBuy !== null) {
    notes.push(
      `Спред входа: ${formatNumber(entry)}% (${spotBuySource}: spot entry ${formatNumber(spotBuy)} ${getComparisonLabel(spotBuy, futuresEntry, 'ниже', 'выше')} futures entry ${formatNumber(futuresEntry)}).`,
    )
  }

  if (exit !== null && spotSell !== null && futuresExit !== null) {
    notes.push(
      `Спред выхода: ${formatNumber(exit)}% (${spotSellSource}: spot exit ${formatNumber(spotSell)} ${getComparisonLabel(spotSell, futuresExit, 'выше', 'ниже')} futures exit ${formatNumber(futuresExit)}).`,
    )
  }

  return notes
}

function createFuturesSpreadNotes({
  entry,
  exit,
  longEntry,
  shortEntry,
  longExit,
  shortExit,
}: {
  entry: number | null
  exit: number | null
  longEntry: number | null
  shortEntry: number | null
  longExit: number | null
  shortExit: number | null
}) {
  const notes: string[] = []

  if (entry !== null && longEntry !== null && shortEntry !== null) {
    notes.push(
      `Спред входа: ${formatNumber(entry)}% (long entry ${formatNumber(longEntry)} ${getComparisonLabel(longEntry, shortEntry, 'ниже', 'выше')} short entry ${formatNumber(shortEntry)}).`,
    )
  }

  if (exit !== null && longExit !== null && shortExit !== null) {
    notes.push(
      `Спред выхода: ${formatNumber(exit)}% (long exit ${formatNumber(longExit)} ${getComparisonLabel(longExit, shortExit, 'выше', 'ниже')} short exit ${formatNumber(shortExit)}).`,
    )
  }

  return notes
}

function getWeightedAveragePrice(transactions: RawTransaction[], type: 'buy' | 'sell') {
  const matchingTransactions = transactions.filter(
    (transaction) =>
      transaction.type === type &&
      transaction.amount !== null &&
      transaction.price !== null &&
      transaction.amount > 0 &&
      isUsableOrderTotal(transaction),
  )

  if (matchingTransactions.length === 0) {
    return null
  }

  const totalAmount = matchingTransactions.reduce(
    (total, transaction) => total + (transaction.amount ?? 0),
    0,
  )
  if (totalAmount <= 0) {
    return null
  }

  return (
    matchingTransactions.reduce(
      (total, transaction) =>
        total + (transaction.amount ?? 0) * (transaction.price ?? 0),
      0,
    ) / totalAmount
  )
}

function getWeightedFuturesPrice(
  legs: RawFuturesLeg[],
  field: 'entryPrice' | 'exitPrice',
) {
  const weightedLegs = legs
    .map((leg) => {
      const price = leg[field]
      if (price === null || price <= 0) {
        return null
      }

      const weight = getFuturesPriceWeight(leg, price)
      return weight !== null && weight > 0 ? { price, weight } : null
    })
    .filter((value): value is { price: number; weight: number } => value !== null)

  if (weightedLegs.length === 0) {
    return null
  }

  const totalWeight = weightedLegs.reduce((total, item) => total + item.weight, 0)
  return weightedLegs.reduce((total, item) => total + item.price * item.weight, 0) / totalWeight
}

function getSignedSpreadPercent(
  priceA: number | null,
  priceB: number | null,
  isPositive: boolean,
) {
  if (priceA === null || priceB === null || priceA <= 0 || priceB <= 0) {
    return null
  }

  const averagePrice = (priceA + priceB) / 2
  if (averagePrice === 0) {
    return null
  }

  const magnitude = (Math.abs(priceA - priceB) / averagePrice) * 100
  if (magnitude === 0) {
    return 0
  }

  return isPositive ? magnitude : -magnitude
}

function getComparisonLabel(
  priceA: number,
  priceB: number,
  lowerLabel: string,
  higherLabel: string,
) {
  if (priceA === priceB) {
    return 'равна'
  }

  return priceA < priceB ? lowerLabel : higherLabel
}

function getFuturesPriceWeight(leg: RawFuturesLeg, price: number) {
  if (leg.coinAmount !== null && leg.coinAmount > 0) {
    return Math.abs(leg.coinAmount)
  }

  if (leg.volumeUsdt !== null && leg.volumeUsdt > 0) {
    return Math.abs(leg.volumeUsdt) / price
  }

  return null
}

function shouldIncludeSpotLeg(spotCalculation: SpotCalculation) {
  return [
    spotCalculation.rawPnlUsdt,
    spotCalculation.pnlUsdt,
    spotCalculation.volumeUsdt,
    spotCalculation.balanceBeforeUsdt,
    spotCalculation.balanceAfterUsdt,
    spotCalculation.revenueUsdt,
    spotCalculation.costUsdt,
  ].some((value) => value !== null)
}

function getSpotSymbol(
  spotData: RawExtractionResult['spotData'],
  futuresLegs: RawFuturesLeg[],
) {
  return (
    spotData.extractedTransactions.find((transaction) => transaction.symbol)?.symbol ??
    futuresLegs.find((leg) => leg.symbol)?.symbol ??
    null
  )
}

function getBundleType(legs: AnalysisLeg[], fallback: string | null) {
  const futuresCount = legs.filter((leg) => leg.type === 'futures').length
  const spotCount = legs.filter((leg) => leg.type === 'spot').length

  if (futuresCount >= 2 && spotCount === 0) {
    return 'Фьючерс + Фьючерс'
  }

  if (futuresCount >= 1 && spotCount >= 1) {
    return 'Фьючерс + Спот'
  }

  if (futuresCount === 1 && spotCount === 0) {
    return 'Фьючерс'
  }

  if (futuresCount === 0 && spotCount >= 1) {
    return spotCount > 1 ? 'Спот + Спот' : 'Спот'
  }

  return fallback ?? null
}

function getFutureLabel(leg: RawFuturesLeg, index: number, futuresCount: number) {
  const sideLabel = leg.side === 'long' ? 'Long' : leg.side === 'short' ? 'Short' : null
  if (sideLabel && leg.symbol) {
    return `${sideLabel} ${leg.symbol}`
  }

  if (futuresCount > 1) {
    return `Фьючерс ${index + 1}`
  }

  return 'Фьючерс'
}

function normalizeRawFuturesLeg(value: unknown): RawFuturesLeg | null {
  const raw = asRecord(value)
  const leg: RawFuturesLeg = {
    symbol: normalizeString(raw.symbol),
    side: normalizeSide(raw.side),
    realizedPnlUsdt: normalizeNumber(raw.realizedPnlUsdt),
    volumeUsdt: normalizeNumber(raw.volumeUsdt),
    coinAmount: normalizeNumber(
      raw.coinAmount ??
        raw.amount ??
        raw.quantity ??
        raw.size ??
        raw.positionSize ??
        raw.positionAmount ??
        raw.baseAmount,
    ),
    entryPrice: normalizeNumber(raw.entryPrice),
    exitPrice: normalizeNumber(raw.exitPrice),
    startedAt: normalizeString(raw.startedAt),
    endedAt: normalizeString(raw.endedAt),
    roiPercent: normalizeNumber(raw.roiPercent),
  }

  const hasData = Object.values(leg).some(
    (fieldValue) => fieldValue !== null && fieldValue !== 'unknown',
  )

  return hasData ? leg : null
}

function normalizeRawTransaction(value: unknown): RawTransaction | null {
  const raw = asRecord(value)
  const type = normalizeTransactionType(raw.type)

  if (!type) {
    return null
  }

  return {
    type,
    symbol: normalizeString(raw.symbol),
    amount: normalizeNumber(raw.amount),
    price: normalizeNumber(raw.price),
    totalUsdt: normalizeNumber(raw.totalUsdt),
  }
}

function normalizeConflict(value: unknown): AnalysisConflict | null {
  const raw = asRecord(value)
  const field = normalizeString(raw.field)
  if (!field) {
    return null
  }

  return {
    field,
    label: normalizeString(raw.label),
    message: normalizeString(raw.message),
    choices: normalizeArray(raw.choices)
      .map((choice) => {
        const rawChoice = asRecord(choice)
        return {
          id: normalizeString(rawChoice.id),
          label: normalizeString(rawChoice.label),
          source: normalizeString(rawChoice.source),
          value: normalizeConflictChoiceValue(rawChoice.value),
        }
      })
      .filter((choice) => choice.value !== undefined),
  }
}

function parseManualSpotOverride(instructions: string): ManualSpotOverride | null {
  const normalizedInstructions = instructions.trim()
  if (!normalizedInstructions) {
    return null
  }

  for (const pattern of spotPnlPatterns) {
    const match = normalizedInstructions.match(pattern)
    const phrase = match?.groups?.phrase
    const valueText = match?.groups?.value
    if (!phrase || !valueText || isLikelyVolumePhrase(phrase)) {
      continue
    }

    const parsedAmount = normalizeNumber(valueText)
    if (parsedAmount === null) {
      continue
    }

    return normalizeManualSpotAmount(parsedAmount, phrase, valueText)
  }

  if (hasSpotSummaryContext(normalizedInstructions)) {
    const match = normalizedInstructions.match(spotSummaryPnlPattern)
    const phrase = match?.groups?.phrase
    const valueText = match?.groups?.value
    const parsedAmount = valueText ? normalizeNumber(valueText) : null

    if (phrase && valueText && parsedAmount !== null) {
      return normalizeManualSpotAmount(parsedAmount, phrase, valueText)
    }
  }

  return null
}

function hasSpotSummaryContext(instructions: string) {
  return /(?:средн(?:яя|ей)?\s+цен(?:а|ы)\s+(?:покупки|продажи)|average\s+(?:buy|sell)\s+price|всего\s+задействовано|получено[^\n.;]{0,40}(?:потрачено|spent)|received[^\n.;]{0,40}spent)/iu.test(
    instructions,
  )
}

const manualPriceToken = '[+-]?(?:\\d[\\d\\s.,]*\\d|\\d)'

export function parseManualSpreadPrices(instructions: string): ManualSpreadPrices {
  const normalizedInstructions = instructions.trim()
  if (!normalizedInstructions) {
    return {
      spotBuyPrice: null,
      spotSellPrice: null,
      spotVolumeUsdt: null,
      spotRevenueUsdt: null,
      spotCostUsdt: null,
      futuresEntryPrice: null,
      futuresExitPrice: null,
    }
  }

  const explicitFuturesEntry = findManualPrice(normalizedInstructions, [
    new RegExp(`(?:фьючерс(?:ная)?|futures?)?[^\\n.;]{0,50}(?:entry|open|вход(?:а|у)?|открытия)[^\\n.;:=-]{0,20}(?:[:=-]\\s*)?[^\\d+\\-]{0,12}(?<value>${manualPriceToken})`, 'iu'),
  ])
  const explicitFuturesExit = findManualPrice(normalizedInstructions, [
    new RegExp(`(?:фьючерс(?:ная)?|futures?)?[^\\n.;]{0,50}(?:exit|close|выход(?:а|у)?|закрытия)[^\\n.;:=-]{0,20}(?:[:=-]\\s*)?[^\\d+\\-]{0,12}(?<value>${manualPriceToken})`, 'iu'),
  ])
  const genericBuy = findManualPrice(normalizedInstructions, [
    new RegExp(`(?:средняя\\s+)?(?:цена\\s+)?(?:покупки|buy(?:ing)?)(?:\\s+price)?\\s*(?:[:=-]\\s*)?[^\\d+\\-]{0,12}(?<value>${manualPriceToken})`, 'iu'),
    new RegExp(`(?:average\\s+buy\\s+price|buy\\s+average)\\s*(?:[:=-]\\s*)?[^\\d+\\-]{0,12}(?<value>${manualPriceToken})`, 'iu'),
  ])
  const genericSell = findManualPrice(normalizedInstructions, [
    new RegExp(`(?:средняя\\s+)?(?:цена\\s+)?(?:продажи|sell(?:ing)?)(?:\\s+price)?\\s*(?:[:=-]\\s*)?[^\\d+\\-]{0,12}(?<value>${manualPriceToken})`, 'iu'),
    new RegExp(`(?:average\\s+sell\\s+price|sell\\s+average)\\s*(?:[:=-]\\s*)?[^\\d+\\-]{0,12}(?<value>${manualPriceToken})`, 'iu'),
  ])
  const spotVolume = findManualPrice(normalizedInstructions, [
    new RegExp(`(?:всего\\s+задействовано|total\\s+(?:involved|used|volume))[^\\n.;]{0,100}?(?<value>${manualPriceToken})`, 'iu'),
  ])
  const spotRevenue = findManualPrice(normalizedInstructions, [
    new RegExp(`(?<value>${manualPriceToken})\\s*(?:usdt)?[^\\n.;]{0,16}(?:получено|received)`, 'iu'),
  ])
  const spotCost = findManualPrice(normalizedInstructions, [
    new RegExp(`(?<value>${manualPriceToken})\\s*(?:usdt)?[^\\n.;]{0,16}(?:потрачено|spent)`, 'iu'),
  ])

  return {
    spotBuyPrice: genericBuy,
    spotSellPrice: genericSell,
    spotVolumeUsdt: spotVolume,
    spotRevenueUsdt: spotRevenue,
    spotCostUsdt: spotCost,
    futuresEntryPrice: explicitFuturesEntry,
    futuresExitPrice: explicitFuturesExit,
  }
}

function findManualPrice(instructions: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = instructions.match(pattern)
    const valueText = match?.groups?.value
    const value = valueText ? normalizeNumber(valueText) : null
    if (value !== null && value > 0) {
      return value
    }
  }

  return null
}

function normalizeManualSpotAmount(
  amount: number,
  phrase: string,
  valueText: string,
): ManualSpotOverride {
  const normalizedPhrase = phrase.toLowerCase()
  const normalizedValue = valueText.trim()

  if (/^[+-]/.test(normalizedValue)) {
    return { amount, mode: 'signed' }
  }

  if (/(^|[^\p{L}])минус([^\p{L}]|$)|убыт|loss/u.test(normalizedPhrase)) {
    return { amount: -Math.abs(amount), mode: 'signed' }
  }

  if (/(^|[^\p{L}])плюс([^\p{L}]|$)|прибыл|profit/u.test(normalizedPhrase)) {
    return { amount: Math.abs(amount), mode: 'signed' }
  }

  return { amount: Math.abs(amount), mode: 'raw' }
}

export function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const source = value.trim()
  if (!source) {
    return null
  }

  const isParenthesizedNegative = /^\(.*\)$/.test(source)
  const normalizedSource = source
    .replace(/[−–—]/g, '-')
    .replace(/\s/g, '')
    .replace(/[^\d,.+-]/g, '')

  const sign = normalizedSource.includes('-') || isParenthesizedNegative ? -1 : 1
  const unsigned = normalizedSource.replace(/[+-]/g, '')
  if (!unsigned || !/^\d[\d,.]*$/.test(unsigned)) {
    return null
  }

  const commaCount = countOccurrences(unsigned, ',')
  const dotCount = countOccurrences(unsigned, '.')
  let normalized = unsigned

  if (commaCount > 0 && dotCount > 0) {
    const decimalIndex = Math.max(unsigned.lastIndexOf(','), unsigned.lastIndexOf('.'))
    normalized = `${unsigned.slice(0, decimalIndex).replace(/[,.]/g, '')}.${unsigned
      .slice(decimalIndex + 1)
      .replace(/[,.]/g, '')}`
  } else if (commaCount > 0 || dotCount > 0) {
    const separator = commaCount > 0 ? ',' : '.'
    const separatorCount = commaCount + dotCount
    const parts = unsigned.split(separator)
    const looksLikeGroupedThousands =
      separatorCount > 1 && parts.slice(1).every((part) => part.length === 3)

    if (looksLikeGroupedThousands) {
      normalized = parts.join('')
    } else {
      const decimalIndex = unsigned.lastIndexOf(separator)
      normalized = `${unsigned.slice(0, decimalIndex).replace(/[,.]/g, '')}.${unsigned
        .slice(decimalIndex + 1)
        .replace(/[,.]/g, '')}`
    }
  }

  const parsed = Number(normalized) * sign
  return Number.isFinite(parsed) ? parsed : null
}

function countOccurrences(value: string, character: string) {
  return value.split(character).length - 1
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).trim()
  return normalized || null
}

function normalizeSide(value: unknown): TradeSide {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['long', 'лонг', 'buy'].includes(normalized)) {
    return 'long'
  }
  if (['short', 'шорт', 'sell'].includes(normalized)) {
    return 'short'
  }
  return 'unknown'
}

function normalizeSpotMethod(value: unknown): SpotMethod {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['orders', 'order_history'].includes(normalized)) {
    return 'orders'
  }
  if (['balance_delta', 'balance', 'balances', 'delta'].includes(normalized)) {
    return 'balance_delta'
  }
  if (['manual', 'text'].includes(normalized)) {
    return 'manual'
  }
  return 'unknown'
}

function normalizeTransactionType(value: unknown): TransactionType | null {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['buy', 'покупка'].includes(normalized)) {
    return 'buy'
  }
  if (['sell', 'продажа'].includes(normalized)) {
    return 'sell'
  }
  if (['deposit', 'депозит', 'transfer_in', 'in'].includes(normalized)) {
    return 'deposit'
  }
  if (['withdrawal', 'withdraw', 'вывод', 'transfer_out', 'out'].includes(normalized)) {
    return 'withdrawal'
  }
  return null
}

function normalizeConflictChoiceValue(value: unknown) {
  const numericValue = normalizeNumber(value)
  if (numericValue !== null) {
    return numericValue
  }

  if (value === null) {
    return null
  }

  return typeof value === 'string' ? value : null
}

function isCompleteBuyOrder(transaction: RawTransaction) {
  return transaction.type === 'buy' && isUsableOrderTotal(transaction)
}

function isCompleteSellOrder(transaction: RawTransaction) {
  return transaction.type === 'sell' && isUsableOrderTotal(transaction)
}

function isUsableOrderTotal(transaction: RawTransaction) {
  return getTransactionTotalUsdt(transaction) !== null && !isArithmeticConflict(transaction)
}

function getTransactionTotalUsdt(transaction: RawTransaction) {
  if (transaction.totalUsdt !== null) {
    return Math.abs(transaction.totalUsdt)
  }

  if (transaction.amount !== null && transaction.price !== null) {
    return Math.abs(transaction.amount * transaction.price)
  }

  return null
}

function isArithmeticConflict(transaction: RawTransaction) {
  if (
    transaction.amount === null ||
    transaction.price === null ||
    transaction.totalUsdt === null
  ) {
    return false
  }

  const calculatedTotal = Math.abs(transaction.amount * transaction.price)
  const extractedTotal = Math.abs(transaction.totalUsdt)
  const base = Math.max(calculatedTotal, extractedTotal, 1)

  return Math.abs(calculatedTotal - extractedTotal) / base > 0.02
}

function isNegative(value: number | null) {
  return value !== null && value < 0
}

function isLikelyVolumePhrase(phrase: string) {
  return /\bоб[ъь]е[мё]\b|\bvolume\b|\bдепозит\b|\bdeposit\b/i.test(phrase)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function nullableString() {
  return { anyOf: [{ type: 'string' }, { type: 'null' }] }
}

function nullableNumber() {
  return { anyOf: [{ type: 'number' }, { type: 'null' }] }
}

function rawFuturesLegJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      symbol: nullableString(),
      side: { type: 'string', enum: ['long', 'short', 'unknown'] },
      realizedPnlUsdt: nullableNumber(),
      volumeUsdt: nullableNumber(),
      coinAmount: nullableNumber(),
      entryPrice: nullableNumber(),
      exitPrice: nullableNumber(),
      startedAt: nullableString(),
      endedAt: nullableString(),
      roiPercent: nullableNumber(),
    },
    required: [
      'symbol',
      'side',
      'realizedPnlUsdt',
      'volumeUsdt',
      'coinAmount',
      'entryPrice',
      'exitPrice',
      'startedAt',
      'endedAt',
      'roiPercent',
    ],
  }
}

function rawTransactionJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['buy', 'sell', 'deposit', 'withdrawal'] },
      symbol: nullableString(),
      amount: nullableNumber(),
      price: nullableNumber(),
      totalUsdt: nullableNumber(),
    },
    required: ['type', 'symbol', 'amount', 'price', 'totalUsdt'],
  }
}

function conflictJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      field: { type: 'string' },
      label: nullableString(),
      message: nullableString(),
      choices: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: nullableString(),
            label: nullableString(),
            source: nullableString(),
            value: {
              anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
            },
          },
          required: ['id', 'label', 'source', 'value'],
        },
      },
    },
    required: ['field', 'label', 'message', 'choices'],
  }
}

function formatUsdt(value: number) {
  return `${new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} USDT`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value)
}
