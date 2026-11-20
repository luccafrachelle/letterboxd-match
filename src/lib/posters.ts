// Resuelve un poster que cargue de verdad para cada peli:
// 1) el CDN de imágenes de Letterboxd (URL armada con id + slug),
// 2) si no existe ahí, la imagen principal del artículo de Wikipedia de la peli.
import type { CommonFilm } from './compare.ts';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const UA = 'letterboxd-match/1.0 (https://github.com/luccafrachelle/letterboxd-match)';
const TTL_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 6;

const cache = new Map<string, { at: number; url: Promise<string | null> }>();

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' });
    return res.ok && (res.headers.get('content-type') ?? '').startsWith('image/');
  } catch {
    return false;
  }
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function wikipediaPoster(title: string, year: number | null): Promise<string | null> {
  try {
    const q = new URLSearchParams({
      action: 'query', format: 'json', list: 'search', srlimit: '5',
      srsearch: `${title} ${year ?? ''} film`.trim(),
    });
    const search = await fetchWithTimeout(`${WIKI_API}?${q}`, { headers: { 'User-Agent': UA } }).then((r) => r.json());
    const hits: { title: string }[] = search?.query?.search ?? [];
    // El artículo tiene que llamarse como la peli (con o sin "(film)", "(2012 film)", etc.).
    const page = hits.find((h) => norm(h.title.replace(/\s*\(.*\)$/, '')) === norm(title));
    if (!page) return null;
    const p = new URLSearchParams({
      action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail',
      pithumbsize: '460', pilicense: 'any', titles: page.title,
    });
    const data = await fetchWithTimeout(`${WIKI_API}?${p}`, { headers: { 'User-Agent': UA } }).then((r) => r.json());
    const pg: any = Object.values(data?.query?.pages ?? {})[0];
    const src: string | undefined = pg?.thumbnail?.source;
    return src && /^https:\/\/upload\.wikimedia\.org\//.test(src) ? src.split('?')[0] : null;
  } catch {
    return null;
  }
}

async function resolve(film: CommonFilm, candidates: string[]): Promise<string | null> {
  for (const url of candidates) if (await exists(url)) return url;
  return wikipediaPoster(film.title, film.year);
}

function cached(key: string, fn: () => Promise<string | null>) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.url;
  const url = fn();
  cache.set(key, { at: Date.now(), url });
  url.catch(() => cache.delete(key));
  return url;
}

/** Devuelve las pelis con `poster` resuelto (o null si no se encontró ninguno). */
export async function withPosters<T extends CommonFilm>(
  films: T[],
  candidatesOf: (f: T) => string[],
): Promise<(T & { poster: string | null })[]> {
  const out: (T & { poster: string | null })[] = new Array(films.length);
  let next = 0;
  const worker = async () => {
    while (next < films.length) {
      const i = next++;
      const f = films[i];
      const poster = await cached(f.url, () => resolve(f, candidatesOf(f)));
      out[i] = { ...f, poster };
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}
