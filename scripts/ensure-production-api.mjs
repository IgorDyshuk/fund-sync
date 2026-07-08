const analyzeApiUrl = process.env.VITE_ANALYZE_API_URL?.trim()

if (!analyzeApiUrl) {
  console.error(
    [
      'VITE_ANALYZE_API_URL is required before deploying to GitHub Pages.',
      '',
      'GitHub Pages cannot run POST /api/analyze.',
      'Deploy the backend first, then run:',
      'VITE_ANALYZE_API_URL=https://your-backend-domain/api/analyze npm run deploy',
      '',
      'For a single-origin deploy, publish the whole app to Vercel instead of GitHub Pages.',
    ].join('\n'),
  )
  process.exit(1)
}

try {
  const url = new URL(analyzeApiUrl)
  if (url.protocol !== 'https:') {
    throw new Error('VITE_ANALYZE_API_URL must use https.')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid VITE_ANALYZE_API_URL.')
  process.exit(1)
}
