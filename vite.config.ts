import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cwd, env as processEnv } from 'node:process'
import type { ServerResponse } from 'node:http'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import {
  analyzeFormData,
  missingGeminiApiKeyMessage,
  requestToFormData,
} from './server/geminiAnalyzer.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const runtimeEnv = { ...processEnv, ...loadEnv(mode, cwd(), '') }
  const base = runtimeEnv.VITE_BASE_PATH ?? (runtimeEnv.VERCEL ? '/' : '/fund-sync/')

  return {
    base,
    plugins: [analyzeApiPlugin(runtimeEnv), react(), tailwindcss()],
  }
})

function analyzeApiPlugin(runtimeEnv: Record<string, string | undefined>): Plugin {
  return {
    name: 'fund-sync-analyze-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method not allowed' })
          return
        }

        try {
          if (!runtimeEnv.GEMINI_API_KEY) {
            sendJson(res, 503, {
              error: missingGeminiApiKeyMessage,
              code: 'missing_gemini_api_key',
            })
            return
          }

          const formData = await requestToFormData(req)
          const analysis = await analyzeFormData({
            runtimeEnv,
            formData,
          })

          sendJson(res, 200, analysis)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown analyze error'
          sendJson(res, 500, { error: message })
        }
      })
    },
  }
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
