import type { APIRoute } from 'astro';
import type { CommonFilm, CompareResult } from '../../lib/compare.ts';
import { buildWorkbook } from '../../lib/excel.ts';
import { LetterboxdError } from '../../lib/letterboxd.ts';
import { errorResponse } from '../../lib/http.ts';

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const safeUrl = (v: unknown) => {
  const s = str(v, 500);
  return /^https:\/\/(letterboxd\.com|boxd\.it)\//.test(s) ? s : '';
};

function sanitize(body: any): CompareResult {
  const list = body?.watchlistCommon;
  if (!Array.isArray(list) || list.length > 50000) {
    throw new LetterboxdError('Datos inválidos para generar el Excel', 400);
  }
  return {
    warnings: Array.isArray(body.warnings) ? body.warnings.slice(0, 10).map((w: unknown) => str(w)) : [],
    userA: str(body.userA, 40) || 'A',
    userB: str(body.userB, 40) || 'B',
    watchlistTotalA: num(body.watchlistTotalA) ?? 0,
    watchlistTotalB: num(body.watchlistTotalB) ?? 0,
    generatedAt: new Date().toISOString(),
    watchlistCommon: list.map((f: any): CommonFilm => ({ title: str(f?.title), year: num(f?.year), url: safeUrl(f?.url), poster: null })),
  };
}

/** POST con el JSON de un resultado → descarga .xlsx */
export const POST: APIRoute = async ({ request }) => {
  try {
    const res = sanitize(await request.json().catch(() => null));
    const buf = await buildWorkbook(res);
    const name = `para_ver_juntos_${res.userA}_${res.userB}.xlsx`.replace(/[^\w.-]+/g, '_');
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
};
