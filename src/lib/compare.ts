import { fetchList, normalizeUsername, type Film, type ListResult } from './letterboxd.ts';

export interface CommonFilm {
  title: string;
  year: number | null;
  url: string;
  ratingA: number | null;
  ratingB: number | null;
}

export interface UserFilms {
  watched: Film[];
  watchlist: Film[];
}

export interface CompareResult {
  /** Avisos de listas que Letterboxd no dejó leer completas. */
  warnings: string[];
  userA: string;
  userB: string;
  avatarA?: string | null;
  avatarB?: string | null;
  totalA: number;
  totalB: number;
  watchlistTotalA: number;
  watchlistTotalB: number;
  /** Pelis que vieron los dos. */
  common: CommonFilm[];
  /** Pelis que están en la watchlist de los dos → para ver juntos. */
  watchlistCommon: CommonFilm[];
  generatedAt: string;
}

const titleYearKey = (f: Film) => `${f.title.trim().toLowerCase()}|${f.year ?? ''}`;

/** Cruza por slug y, si no coincide, por título + año. */
export function commonFilms(a: Film[], b: Film[]): CommonFilm[] {
  const bySlug = new Map(b.map((f) => [f.slug, f]));
  const byTitle = new Map(b.map((f) => [titleYearKey(f), f]));
  const out: CommonFilm[] = [];
  for (const f of a) {
    const match = bySlug.get(f.slug) ?? byTitle.get(titleYearKey(f));
    if (!match) continue;
    out.push({ title: f.title, year: f.year, url: f.url, ratingA: f.rating, ratingB: match.rating });
  }
  return out.sort((x, y) => x.title.localeCompare(y.title, 'es', { sensitivity: 'base' }));
}

export function buildResult(
  userA: string,
  userB: string,
  a: UserFilms,
  b: UserFilms,
  warnings: string[] = [],
): CompareResult {
  return {
    warnings,
    userA,
    userB,
    totalA: a.watched.length,
    totalB: b.watched.length,
    watchlistTotalA: a.watchlist.length,
    watchlistTotalB: b.watchlist.length,
    common: commonFilms(a.watched, b.watched),
    watchlistCommon: commonFilms(a.watchlist, b.watchlist).map((f) => ({ ...f, ratingA: null, ratingB: null })),
    generatedAt: new Date().toISOString(),
  };
}

const TTL_MS = 10 * 60 * 1000;
type UserData = { watched: ListResult; watchlist: ListResult };
const cache = new Map<string, { at: number; data: Promise<UserData> }>();

function cachedUser(user: string): Promise<UserData> {
  const hit = cache.get(user);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = (async () => ({
    watched: await fetchList(user, 'films'),
    watchlist: await fetchList(user, 'watchlist'),
  }))();
  cache.set(user, { at: Date.now(), data });
  // No cachear errores ni resultados incompletos.
  data.then(
    (d) => {
      if (d.watched.pagesRead < d.watched.pagesTotal || d.watchlist.pagesRead < d.watchlist.pagesTotal) cache.delete(user);
    },
    () => cache.delete(user),
  );
  return data;
}

function partialWarnings(user: string, d: UserData): string[] {
  const out: string[] = [];
  const label = { films: 'pelis vistas', watchlist: 'watchlist' } as const;
  for (const [kind, r] of [['films', d.watched], ['watchlist', d.watchlist]] as const) {
    if (r.pagesRead < r.pagesTotal) {
      out.push(
        `${user}: Letterboxd solo dejó leer ${r.pagesRead} de ${r.pagesTotal} páginas de ${label[kind]} (${r.films.length} pelis).`,
      );
    }
  }
  return out;
}

export async function compareUsers(rawA: string, rawB: string): Promise<CompareResult> {
  const userA = normalizeUsername(rawA);
  const userB = normalizeUsername(rawB);
  const [a, b] = await Promise.all([cachedUser(userA), cachedUser(userB)]);
  return {
    ...buildResult(
      userA,
      userB,
      { watched: a.watched.films, watchlist: a.watchlist.films },
      { watched: b.watched.films, watchlist: b.watchlist.films },
      [...partialWarnings(userA, a), ...partialWarnings(userB, b)],
    ),
    avatarA: a.watched.avatar,
    avatarB: b.watched.avatar,
  };
}
