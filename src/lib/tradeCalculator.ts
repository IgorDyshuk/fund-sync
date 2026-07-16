import { getAppLocale } from './i18n'

export type TradeSide = 'long' | 'short' | 'unknown'
export type SpotMethod = 'balance_delta' | 'orders' | 'manual' | 'unknown'
export type MarketType = 'futures' | 'spot' | 'unknown'

export type FutureSnapshot = {
  symbol?: string | null
  side?: TradeSide | null
  startedAt?: string | null
  endedAt?: string | null
  volumeUsdt?: number | null
  roiPercent?: number | null
  realizedPnlUsdt?: number | null
}

export type SpotSnapshot = {
  method?: SpotMethod | null
  volumeUsdt?: number | null
  rawPnlUsdt?: number | null
  pnlUsdt?: number | null
  balanceBeforeUsdt?: number | null
  balanceAfterUsdt?: number | null
  revenueUsdt?: number | null
  costUsdt?: number | null
}

export type SpreadSnapshot = {
  entry?: number | null
  exit?: number | null
}

export type TradeLegSnapshot = {
  id?: string | null
  label?: string | null
  type?: MarketType | null
  symbol?: string | null
  side?: TradeSide | null
  startedAt?: string | null
  endedAt?: string | null
  volumeUsdt?: number | null
  pnlUsdt?: number | null
  realizedPnlUsdt?: number | null
  rawPnlUsdt?: number | null
  roiPercent?: number | null
  method?: SpotMethod | null
  balanceBeforeUsdt?: number | null
  balanceAfterUsdt?: number | null
  revenueUsdt?: number | null
  costUsdt?: number | null
}

export type TradeAnalysisInput = {
  future: FutureSnapshot
  spot?: SpotSnapshot | null
  spread?: SpreadSnapshot | null
  legs?: TradeLegSnapshot[] | null
  bundleType?: string | null
}

export type TradeLegCalculation = {
  id: string
  type: MarketType
  title: string
  subtitle: string
  symbol: string
  side: TradeSide
  startedAt: string
  endedAt: string
  volume: number | null
  pnl: number | null
  display: {
    volume: string
    pnl: string
  }
}

export type TradeCalculation = {
  symbol: string
  side: TradeSide
  bundleType: string
  period: string
  legs: TradeLegCalculation[]
  futuresVolume: number | null
  spotVolume: number | null
  totalVolume: number | null
  futuresPnl: number | null
  rawSpotPnl: number | null
  signedSpotPnl: number | null
  spreadEntry: number | null
  spreadExit: number | null
  netResult: number | null
  isProfitable: boolean | null
  display: {
    futuresVolume: string
    spotVolume: string
    totalVolume: string
    futuresPnl: string
    spotPnl: string
    rawSpotPnl: string
    spreadEntry: string
    spreadExit: string
    netResult: string
    bundleType: string
  }
}

const dateTimePattern = /^(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})$/

export function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.+-]/g, '')

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function getNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function getRawSpotPnl(spot?: SpotSnapshot | null): number | null {
  if (!spot) {
    return null
  }

  const explicitPnl = getNumber(spot.rawPnlUsdt)
  if (explicitPnl !== null) {
    return Math.abs(explicitPnl)
  }

  const before = getNumber(spot.balanceBeforeUsdt)
  const after = getNumber(spot.balanceAfterUsdt)
  if (before !== null && after !== null) {
    return Math.abs(after - before)
  }

  const revenue = getNumber(spot.revenueUsdt)
  const cost = getNumber(spot.costUsdt)
  if (revenue !== null && cost !== null) {
    return Math.abs(revenue - cost)
  }

  return null
}

export function getSpotVolume(spot?: SpotSnapshot | null): number | null {
  if (!spot) {
    return null
  }

  const explicitVolume = getNumber(spot.volumeUsdt)
  if (explicitVolume !== null) {
    return Math.abs(explicitVolume)
  }

  const cost = getNumber(spot.costUsdt)
  if (cost !== null) {
    return Math.abs(cost)
  }

  const revenue = getNumber(spot.revenueUsdt)
  if (revenue !== null) {
    return Math.abs(revenue)
  }

  return null
}

export function getTotalVolume(legs: TradeLegCalculation[]): number | null {
  const volumes = legs.map((leg) => getNumber(leg.volume))

  if (volumes.length === 0 || volumes.some((volume) => volume === null)) {
    return null
  }

  return volumes.reduce<number>((total, volume) => total + Math.abs(volume ?? 0), 0)
}

export function getSignedSpotPnl(
  futuresPnl: number | null | undefined,
  rawSpotPnl: number | null | undefined,
): number | null {
  const normalizedFuturesPnl = getNumber(futuresPnl)
  const normalizedSpotPnl = getNumber(rawSpotPnl)

  if (normalizedFuturesPnl === null || normalizedSpotPnl === null) {
    return null
  }

  if (normalizedFuturesPnl > 0) {
    return -Math.abs(normalizedSpotPnl)
  }

  if (normalizedFuturesPnl < 0) {
    return Math.abs(normalizedSpotPnl)
  }

  return null
}

export function calculateTrade(input: TradeAnalysisInput): TradeCalculation {
  const legs = normalizeTradeLegs(input)
  const futuresLegs = legs.filter((leg) => leg.type === 'futures')
  const spotLegs = legs.filter((leg) => leg.type === 'spot')
  const futuresVolume = sumComplete(futuresLegs.map((leg) => leg.volume), true)
  const spotVolume = sumComplete(spotLegs.map((leg) => leg.volume), true)
  const totalVolume = getTotalVolume(legs)
  const futuresPnl = sumComplete(futuresLegs.map((leg) => leg.pnl))
  const signedSpotPnl = sumComplete(spotLegs.map((leg) => leg.pnl))
  const rawSpotPnl = getRawSpotPnl(input.spot)
  const netResult = legs.length > 0 ? sumComplete(legs.map((leg) => leg.pnl)) : null
  const spreadEntry = getNumber(input.spread?.entry)
  const spreadExit = getNumber(input.spread?.exit)
  const bundleType = getBundleType(legs, input.bundleType)

  return {
    symbol: getBundleSymbol(legs, input.future.symbol),
    side: getBundleSide(legs, input.future.side),
    bundleType,
    period: getBundlePeriod(legs, input.future),
    legs,
    futuresVolume,
    spotVolume,
    totalVolume,
    futuresPnl,
    rawSpotPnl,
    signedSpotPnl,
    spreadEntry,
    spreadExit,
    netResult,
    isProfitable: netResult === null ? null : netResult >= 0,
    display: {
      futuresVolume: formatUsdt(futuresVolume),
      spotVolume: formatUsdt(spotVolume),
      totalVolume: formatUsdt(totalVolume),
      futuresPnl: formatUsdt(futuresPnl),
      spotPnl: formatUsdt(signedSpotPnl),
      rawSpotPnl: formatUsdt(rawSpotPnl),
      spreadEntry: formatSpread(spreadEntry),
      spreadExit: formatSpread(spreadExit),
      netResult: formatUsdt(netResult),
      bundleType,
    },
  }
}

export function normalizeTradeLegs(input: TradeAnalysisInput): TradeLegCalculation[] {
  const futuresPnlContext = getFuturesPnlContext(input)
  const extractedLegs =
    input.legs
      ?.map((leg, index) => normalizeTradeLeg(leg, index, futuresPnlContext))
      .filter((leg): leg is TradeLegCalculation => leg !== null) ?? []

  if (extractedLegs.length > 0) {
    return extractedLegs
  }

  return normalizeLegacyLegs(input)
}

function normalizeLegacyLegs(input: TradeAnalysisInput): TradeLegCalculation[] {
  const legs: TradeLegCalculation[] = []
  const futuresPnl = getNumber(input.future.realizedPnlUsdt)
  const rawSpotPnl = getRawSpotPnl(input.spot)
  const signedSpotPnl = getSignedSpotPnl(futuresPnl, rawSpotPnl)

  if (hasFutureData(input.future)) {
    legs.push(
      normalizeTradeLeg(
        {
          type: 'futures',
          label: 'Фьючерс',
          symbol: input.future.symbol,
          side: input.future.side,
          startedAt: input.future.startedAt,
          endedAt: input.future.endedAt,
          volumeUsdt: input.future.volumeUsdt,
          pnlUsdt: futuresPnl,
          roiPercent: input.future.roiPercent,
        },
        0,
      ) as TradeLegCalculation,
    )
  }

  if (hasSpotData(input.spot)) {
    legs.push(
      normalizeTradeLeg(
        {
          type: 'spot',
          label: 'Спот',
          symbol: input.future.symbol,
          volumeUsdt: getSpotVolume(input.spot),
          pnlUsdt: signedSpotPnl,
          rawPnlUsdt: rawSpotPnl,
          method: input.spot?.method,
          balanceBeforeUsdt: input.spot?.balanceBeforeUsdt,
          balanceAfterUsdt: input.spot?.balanceAfterUsdt,
          revenueUsdt: input.spot?.revenueUsdt,
          costUsdt: input.spot?.costUsdt,
        },
        legs.length,
        futuresPnl,
      ) as TradeLegCalculation,
    )
  }

  return legs
}

function normalizeTradeLeg(
  leg: TradeLegSnapshot,
  index: number,
  futuresPnlContext?: number | null,
): TradeLegCalculation | null {
  const type = leg.type ?? 'unknown'
  const volume = getLegVolume(leg)
  const pnl = getLegPnl(leg, futuresPnlContext)
  const symbol = normalizeDisplayText(leg.symbol)
  const side = leg.side ?? 'unknown'

  if (type === 'unknown' && volume === null && pnl === null && symbol === '-') {
    return null
  }

  const title = getLegTitle(leg, type, index)
  const subtitle = getLegSubtitle({ type, symbol, side, method: leg.method })

  return {
    id: leg.id?.trim() || `${type}-${index}`,
    type,
    title,
    subtitle,
    symbol,
    side,
    startedAt: normalizeDisplayText(leg.startedAt),
    endedAt: normalizeDisplayText(leg.endedAt),
    volume,
    pnl,
    display: {
      volume: formatUsdt(volume),
      pnl: formatUsdt(pnl),
    },
  }
}

function getLegVolume(leg: TradeLegSnapshot): number | null {
  const explicitVolume = getNumber(leg.volumeUsdt)
  if (explicitVolume !== null) {
    return Math.abs(explicitVolume)
  }

  if (leg.type === 'spot') {
    return getSpotVolume(leg)
  }

  return null
}

function getLegPnl(
  leg: TradeLegSnapshot,
  futuresPnlContext?: number | null,
): number | null {
  const signedPnl = getNumber(leg.pnlUsdt)

  if (leg.type === 'futures') {
    return signedPnl ?? getNumber(leg.realizedPnlUsdt)
  }

  if (leg.type === 'spot') {
    if (leg.method === 'manual' && signedPnl !== null) {
      return signedPnl
    }

    const rawSpotPnl = getRawSpotPnl(leg)
    const hedgeSignedPnl = getSignedSpotPnl(futuresPnlContext, rawSpotPnl)
    if (hedgeSignedPnl !== null) {
      return hedgeSignedPnl
    }
  }

  return signedPnl
}

function getFuturesPnlContext(input: TradeAnalysisInput): number | null {
  const legFuturesPnls =
    input.legs
      ?.filter((leg) => leg.type === 'futures')
      .map((leg) => getNumber(leg.pnlUsdt) ?? getNumber(leg.realizedPnlUsdt)) ?? []

  const summedLegPnl = sumComplete(legFuturesPnls)
  if (summedLegPnl !== null) {
    return summedLegPnl
  }

  return getNumber(input.future.realizedPnlUsdt)
}

function hasFutureData(future: FutureSnapshot): boolean {
  return [
    future.symbol,
    future.side,
    future.startedAt,
    future.endedAt,
    future.volumeUsdt,
    future.roiPercent,
    future.realizedPnlUsdt,
  ].some((value) => value !== null && value !== undefined && value !== 'unknown')
}

function hasSpotData(spot?: SpotSnapshot | null): boolean {
  if (!spot) {
    return false
  }

  return [
    spot.method,
    spot.volumeUsdt,
    spot.rawPnlUsdt,
    spot.pnlUsdt,
    spot.balanceBeforeUsdt,
    spot.balanceAfterUsdt,
    spot.revenueUsdt,
    spot.costUsdt,
  ].some((value) => value !== null && value !== undefined && value !== 'unknown')
}

function sumComplete(values: Array<number | null | undefined>, absolute = false): number | null {
  if (values.length === 0) {
    return null
  }

  const numbers = values.map((value) => getNumber(value))
  if (numbers.some((value) => value === null)) {
    return null
  }

  return numbers.reduce<number>(
    (total, value) => total + (absolute ? Math.abs(value ?? 0) : value ?? 0),
    0,
  )
}

function getBundleSymbol(legs: TradeLegCalculation[], fallback?: string | null): string {
  const symbols = Array.from(new Set(legs.map((leg) => leg.symbol).filter((symbol) => symbol !== '-')))
  if (symbols.length > 0) {
    return symbols.join(' / ')
  }

  return normalizeDisplayText(fallback)
}

function getBundleSide(
  legs: TradeLegCalculation[],
  fallback?: TradeSide | null,
): TradeSide {
  const futuresSides = Array.from(
    new Set(
      legs
        .filter((leg) => leg.type === 'futures')
        .map((leg) => leg.side)
        .filter((side) => side !== 'unknown'),
    ),
  )

  if (futuresSides.length === 1) {
    return futuresSides[0]
  }

  if (legs.length > 0) {
    return 'unknown'
  }

  return fallback ?? 'unknown'
}

function getBundleType(legs: TradeLegCalculation[], fallback?: string | null): string {
  const normalizedFallback = normalizeDisplayText(fallback)
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

  if (futuresCount === 0 && spotCount >= 2) {
    return 'Спот + Спот'
  }

  if (futuresCount === 0 && spotCount === 1) {
    return 'Спот'
  }

  return normalizedFallback
}

function getBundlePeriod(legs: TradeLegCalculation[], fallback: FutureSnapshot): string {
  const firstStartedAt =
    legs
      .map((leg) => leg.startedAt)
      .find((value) => value !== '-') ?? fallback.startedAt
  const lastEndedAt =
    [...legs]
      .reverse()
      .map((leg) => leg.endedAt)
      .find((value) => value !== '-') ?? fallback.endedAt

  return formatTradePeriod(firstStartedAt, lastEndedAt)
}

function getLegTitle(leg: TradeLegSnapshot, type: MarketType, index: number): string {
  const explicitLabel = normalizeDisplayText(leg.label)
  if (explicitLabel !== '-') {
    return explicitLabel
  }

  if (type === 'futures') {
    return `Фьючерс ${index + 1}`
  }

  if (type === 'spot') {
    return 'Спот'
  }

  return `Сторона ${index + 1}`
}

function getLegSubtitle({
  type,
  symbol,
  side,
  method,
}: {
  type: MarketType
  symbol: string
  side: TradeSide
  method?: SpotMethod | null
}): string {
  const parts = [
    type === 'futures' ? getSideLabel(side) : getMarketTypeLabel(type),
    symbol !== '-' ? symbol : null,
    type === 'spot' && method ? getSpotMethodLabel(method) : null,
  ].filter((part): part is string => Boolean(part && part !== '-'))

  return parts.length > 0 ? parts.join(' · ') : '-'
}

function getMarketTypeLabel(type: MarketType): string {
  const labels: Record<MarketType, string> = {
    futures: 'Фьючерс',
    spot: 'Спот',
    unknown: '-',
  }

  return labels[type]
}

function getSideLabel(side: TradeSide): string {
  const labels: Record<TradeSide, string> = {
    long: 'Лонг',
    short: 'Шорт',
    unknown: '-',
  }

  return labels[side]
}

function getSpotMethodLabel(method: SpotMethod): string {
  const labels: Record<SpotMethod, string> = {
    balance_delta: 'балансы',
    orders: 'ордера',
    manual: 'ручной ввод',
    unknown: '-',
  }

  return labels[method]
}

export function formatUsdt(value: number | null | undefined): string {
  const normalized = getNumber(value)
  if (normalized === null) {
    return '-'
  }

  return `${new Intl.NumberFormat(getAppLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized)} USDT`
}

export function formatPercent(value: number | null | undefined): string {
  const normalized = getNumber(value)
  if (normalized === null) {
    return '-'
  }

  return `${new Intl.NumberFormat(getAppLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized)}%`
}

export function formatSpread(value: number | null | undefined): string {
  const normalized = getNumber(value)
  if (normalized === null) {
    return '-'
  }

  return `${new Intl.NumberFormat(getAppLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(normalized)}%`
}

export function formatTradePeriod(
  startedAt?: string | null,
  endedAt?: string | null,
): string {
  const start = normalizeDisplayText(startedAt)
  const end = normalizeDisplayText(endedAt)

  if (start === '-' || end === '-') {
    return '-'
  }

  const startMatch = start.match(dateTimePattern)
  const endMatch = end.match(dateTimePattern)
  if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
    return `${start} — ${endMatch[2]}`
  }

  return `${start} — ${end}`
}

export function normalizeDisplayText(value?: string | null): string {
  const normalized = value?.trim()
  return normalized ? normalized : '-'
}
