import { fetchList, normalizeUsername, type Film, type ListResult } from './letterboxd.ts';
import { withPosters } from './posters.ts';

export interface CommonFilm {
  title: string;
  year: number | null;
  url: string;
  /** Poster que carga (CDN de Letterboxd o Wikipedia), o null. */
  poster?: string | null;
}

export interface CompareResult {
  /** Avisos si Letterboxd no dejó leer alguna watchlist completa. */
  warnings: string[];
  userA: string;
  userB: string;
  avatarA?: string | null;
  avatarB?: string | null;
  /** Nombre visible en Letterboxd (puede diferir del usuario). */
  nameA?: string | null;
  nameB?: string | null;
  watchlistTotalA: number;
  watchlistTotalB: number;
  /** Pelis que están en la watchlist de los dos → para ver juntos. */
  watchlistCommon: CommonFilm[];
  generatedAt: string;
}

const titleYearKey = (f: Film) => `${f.title.trim().toLowerCase()}|${f.year ?? ''}`;

/** Cruza por slug y, si no coincide, por título + año. */
export function commonFilms(a: Film[], b: Film[]): Film[] {
  const slugs = new Set(b.map((f) => f.slug));
  const titles = new Set(b.map(titleYearKey));
  return a
    .filter((f) => slugs.has(f.slug) || titles.has(titleYearKey(f)))
    .sort((x, y) => x.title.localeCompare(y.title, 'es', { sensitivity: 'base' }));
}

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: Promise<ListResult> }>();

function cachedWatchlist(user: string): Promise<ListResult> {
  const hit = cache.get(user);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = fetchList(user, 'watchlist');
  cache.set(user, { at: Date.now(), data });
  // No cachear errores ni resultados incompletos.
  data.then(
    (d) => {
      if (d.pagesRead < d.pagesTotal) cache.delete(user);
    },
    () => cache.delete(user),
  );
  return data;
}

const partial = (user: string, r: ListResult) =>
  r.pagesRead < r.pagesTotal
    ? [`${user}: Letterboxd solo dejó leer ${r.pagesRead} de ${r.pagesTotal} páginas de la watchlist (${r.films.length} pelis).`]
    : [];

export async function compareUsers(rawA: string, rawB: string): Promise<CompareResult> {
  const userA = normalizeUsername(rawA);
  const userB = normalizeUsername(rawB);
  const [a, b] = await Promise.all([cachedWatchlist(userA), cachedWatchlist(userB)]);
  return {
    warnings: [...partial(userA, a), ...partial(userB, b)],
    userA,
    userB,
    avatarA: a.avatar,
    avatarB: b.avatar,
    nameA: a.name,
    nameB: b.name,
    watchlistTotalA: a.films.length,
    watchlistTotalB: b.films.length,
    watchlistCommon: (await withPosters(commonFilms(a.films, b.films), (f) => f.posters)).map((f) => ({
      title: f.title,
      year: f.year,
      url: f.url,
      poster: f.poster,
    })),
    generatedAt: new Date().toISOString(),
  };
}
