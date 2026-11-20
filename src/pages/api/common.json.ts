import type { APIRoute } from 'astro';
import { compareUsers } from '../../lib/compare.ts';
import { errorResponse, json } from '../../lib/http.ts';

/** GET /api/common.json?a=user1&b=user2 — scrapea los perfiles públicos. */
export const GET: APIRoute = async ({ url }) => {
  try {
    return json(await compareUsers(url.searchParams.get('a') ?? '', url.searchParams.get('b') ?? ''));
  } catch (err) {
    return errorResponse(err);
  }
};
