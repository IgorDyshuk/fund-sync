import { analyzeFormData, missingGeminiApiKeyMessage } from '../server/geminiAnalyzer.ts'

const defaultAllowedOrigin = 'https://igordyshuk.github.io'

export default {
  async fetch(request: Request) {
    const corsHeaders = createCorsHeaders(request)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, corsHeaders)
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        return json(
          {
            error: missingGeminiApiKeyMessage,
            code: 'missing_gemini_api_key',
          },
          503,
          corsHeaders,
        )
      }

      const formData = await request.formData()
      const analysis = await analyzeFormData({
        runtimeEnv: process.env,
        formData,
      })

      return json(analysis, 200, corsHeaders)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown analyze error'
      return json({ error: message }, 500, corsHeaders)
    }
  },
}

function createCorsHeaders(request: Request) {
  const requestOrigin = request.headers.get('origin')
  const configuredOrigins = process.env.ALLOWED_ORIGIN ?? defaultAllowedOrigin
  const allowedOrigins = configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const allowOrigin = allowedOrigins.includes('*')
    ? '*'
    : requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : (allowedOrigins[0] ?? defaultAllowedOrigin)

  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allowOrigin,
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  })
}
