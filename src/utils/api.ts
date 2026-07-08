const analyzeTimeoutMs = 90_000;

export function getAnalyzeApiUrl() {
  const configuredUrl = import.meta.env.VITE_ANALYZE_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (import.meta.env.PROD && window.location.hostname.endsWith("github.io")) {
    throw new Error(
      "Для GitHub Pages не задан VITE_ANALYZE_API_URL. Нужен backend URL, например https://your-vercel-project.vercel.app/api/analyze.",
    );
  }

  return "/api/analyze";
}

export async function postAnalyze(formData: FormData) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), analyzeTimeoutMs);

  try {
    return await fetch(getAnalyzeApiUrl(), {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function isAnalyzeTimeout(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // Fall back to status when the server does not return JSON.
  }

  return `POST ${getAnalyzeApiUrl()} вернул ${response.status}`;
}
