import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  analyzeFormData,
  missingGeminiApiKeyMessage,
  requestToFormData,
} from '../server/geminiAnalyzer.js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const defaultAllowedOrigin = 'https://igordyshuk.github.io'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      sendJson(res, 503, {
        error: missingGeminiApiKeyMessage,
        code: 'missing_gemini_api_key',
      })
      return
    }

    const formData = await requestToFormData(req)
    const analysis = await analyzeFormData({
      runtimeEnv: process.env,
      formData,
    })

    sendJson(res, 200, analysis)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analyze error'
    sendJson(res, 500, { error: message })
  }
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const requestOrigin = Array.isArray(req.headers.origin)
    ? req.headers.origin[0]
    : req.headers.origin
  const configuredOrigins = process.env.ALLOWED_ORIGIN ?? defaultAllowedOrigin
  const allowedOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean)
  const normalizedRequestOrigin = requestOrigin?.toLowerCase()

  const allowOrigin = allowedOrigins.includes('*')
    ? '*'
    : normalizedRequestOrigin && allowedOrigins.includes(normalizedRequestOrigin)
      ? requestOrigin
      : configuredOrigins.split(',')[0]?.trim() || defaultAllowedOrigin

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Vary', 'Origin')
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
