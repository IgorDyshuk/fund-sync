export async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // Fall back to status when the server does not return JSON.
  }

  return `POST /api/analyze вернул ${response.status}`;
}
