import { LetterboxdError } from './letterboxd.ts';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export function errorResponse(err: unknown) {
  if (err instanceof LetterboxdError) return json({ error: err.message }, err.status);
  console.error(err);
  return json({ error: 'Error inesperado procesando la solicitud' }, 500);
}
