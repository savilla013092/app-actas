import tercerosCatalog from './tercerosCatalog.json';

export type RawTerceroCatalogEntry = {
  nombre: string;
  documento: string;
  dv?: string;
};

export type TerceroCatalogEntry = RawTerceroCatalogEntry & {
  normalizado: string;
  tokens: string[];
};

export type TerceroMatch = Pick<TerceroCatalogEntry, 'nombre' | 'documento' | 'dv'> & {
  score: number;
};

const STOP_WORDS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);

export const normalizarNombreTercero = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const tokenizeQuery = (value: string) =>
  normalizarNombreTercero(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const terceros = (tercerosCatalog as RawTerceroCatalogEntry[]).map((entry) => ({
  ...entry,
  normalizado: normalizarNombreTercero(entry.nombre),
  tokens: tokenizeQuery(entry.nombre),
}));

const scoreEntry = (entry: TerceroCatalogEntry, query: string, queryTokens: string[]) => {
  if (!query || queryTokens.length === 0) return 0;

  if (entry.normalizado === query) return 100;
  if (entry.normalizado.startsWith(query) && query.length >= 4) return 96;
  if (query.length >= 6 && entry.normalizado.includes(query)) return 93;

  const matchedTokens = queryTokens.filter((token) => entry.tokens.includes(token));
  const tokenScore = Math.round((matchedTokens.length / queryTokens.length) * 86);

  if (matchedTokens.length === queryTokens.length && queryTokens.length >= 2) {
    const phrase = queryTokens.join(' ');
    if (entry.normalizado.includes(phrase)) return 92;
    return queryTokens.length >= 3 ? 91 : 88;
  }

  return tokenScore;
};

export function buscarTercerosPorNombre(nombre: string, limit = 5): TerceroMatch[] {
  const query = normalizarNombreTercero(nombre);
  const queryTokens = tokenizeQuery(nombre);

  return terceros
    .map((entry) => ({
      nombre: entry.nombre,
      documento: entry.documento,
      dv: entry.dv,
      score: scoreEntry(entry, query, queryTokens),
    }))
    .filter((entry) => entry.score >= 55)
    .sort((a, b) => b.score - a.score || a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limit);
}

export function seleccionarTerceroAutomatico(matches: TerceroMatch[]) {
  const [best, second] = matches;
  if (!best) return null;

  if (best.score >= 96) return best;
  if (best.score >= 90 && (!second || best.score - second.score >= 6)) return best;

  return null;
}
