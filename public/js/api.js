// Dünner Fetch-Wrapper für die API.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Antwort ohne JSON-Körper
  }
  if (!response.ok) {
    throw new ApiError(data?.error ?? 'Etwas ist schiefgegangen.', response.status);
  }
  return data;
}
