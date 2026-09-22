// Angemeldeten User zurückgeben.

import { json } from '../../shared/http.js';

export async function onRequestGet({ data }) {
  return json({ user: data.user });
}
