export interface Film {
  slug: string;
  title: string;
  year: number | null;
  url: string;
  /** Rating en estrellas (0.5–5) o null si no puntuó. */
  rating: number | null;
}

export class LetterboxdError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const BASE = 'https://letterboxd.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const USERNAME_RE = /^[A-Za-z0-9_]{1,40}$/;

/** Acepta "frache04", "@frache04" o "https://letterboxd.com/frache04/...". */
export function normalizeUsername(input: string): string {
  let s = (input ?? '').trim();
  const m = s.match(/letterboxd\.com\/([^/?#]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, '').replace(/\/+$/, '');
  if (!USERNAME_RE.test(s)) {
    throw new LetterboxdError(`Usuario inválido: "${input}"`, 400);
  }
  return s.toLowerCase();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function attr(html: string, name: string): string | null {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? decodeEntities(m[1]) : null;
}

export function parseFilmsPage(html: string): Film[] {
  const films: Film[] = [];
  const chunks = html.split('<li class="griditem').slice(1);
  for (const chunk of chunks) {
    const block = chunk.split('</li>')[0];
    const slug = attr(block, 'data-item-slug');
    const name = attr(block, 'data-item-name');
    if (!slug || !name) continue;
    const link = attr(block, 'data-item-link') ?? `/film/${slug}/`;
    const ym = name.match(/^(.*) \((\d{4})\)$/);
    const ratingM = block.match(/\brated-(\d{1,2})\b/);
    films.push({
      slug,
      title: ym ? ym[1] : name,
      year: ym ? Number(ym[2]) : null,
      url: BASE + link,
      rating: ratingM ? Number(ratingM[1]) / 2 : null,
    });
  }
  return films;
}

export function parseAvatar(html: string, username: string): string | null {
  for (const m of html.matchAll(/<img src="(https:\/\/a\.ltrbxd\.com\/resized\/avatar\/[^"]+)" alt="([^"]*)"/g)) {
    if (m[2].toLowerCase() === username.toLowerCase()) return m[1].replace(/-0-\d+-0-\d+-crop/, '-0-220-0-220-crop');
  }
  return null;
}

export function parseLastPage(html: string): number {
  const pages = [...html.matchAll(/\/(?:films|watchlist)\/page\/(\d+)\//g)].map((m) => Number(m[1]));
  return pages.length ? Math.max(1, ...pages) : 1;
}

export type ListKind = 'films' | 'watchlist';

async function fetchPage(username: string, page: number, list: ListKind): Promise<string> {
  const url = `${BASE}/${username}/${list}/${page > 1 ? `page/${page}/` : ''}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (res.ok) return res.text();
    if (res.status === 404) {
      throw new LetterboxdError(`No existe el usuario "${username}" en Letterboxd`, 404);
    }
    if (res.status === 403) {
      throw new LetterboxdError(
        `Letterboxd bloqueó la consulta automática (verificación anti-bots en ${list} página ${page} de ${username}). Probá de nuevo en un rato.`,
        503,
      );
    }
    if (res.status !== 429 && res.status < 500) {
      throw new LetterboxdError(`Letterboxd respondió ${res.status} para ${url}`, 502);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new LetterboxdError(`Letterboxd no responde (${url})`, 502);
}

export interface ListResult {
  films: Film[];
  /** Avatar del perfil (sale en la primera página). */
  avatar: string | null;
  /** Páginas leídas / totales. Si leídas < totales, Letterboxd cortó la lectura. */
  pagesRead: number;
  pagesTotal: number;
}

/**
 * Todas las pelis de una lista del usuario: vistas ('films') o watchlist.
 * Si Letterboxd bloquea alguna página después de la primera, devuelve lo leído hasta ahí.
 */
export async function fetchList(username: string, list: ListKind): Promise<ListResult> {
  const first = await fetchPage(username, 1, list);
  const last = parseLastPage(first);
  const pages: string[] = [first];
  for (let p = 2; p <= last; p++) {
    try {
      await new Promise((r) => setTimeout(r, 300));
      pages.push(await fetchPage(username, p, list));
    } catch (err) {
      if (err instanceof LetterboxdError && err.status === 503) break;
      throw err;
    }
  }
  const bySlug = new Map<string, Film>();
  for (const html of pages) for (const f of parseFilmsPage(html)) bySlug.set(f.slug, f);
  return { films: [...bySlug.values()], avatar: parseAvatar(first, username), pagesRead: pages.length, pagesTotal: last };
}
